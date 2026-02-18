import { User, FileUpload } from '../types';

const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';

// ─── Token Refresh ──────────────────────────────────────────────────────────
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = sessionStorage.getItem('refresh_token');
  if (!refresh) return null;

  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) throw new Error('Refresh failed');
    const data = await res.json();
    sessionStorage.setItem('access_token', data.access);
    return data.access;
  } catch {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('logged_user');
    window.location.hash = '#/';
    return null;
  }
}

// ─── Core Request ───────────────────────────────────────────────────────────
async function request(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<any> {
  const token = sessionStorage.getItem('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });

  // Auto-refresh on 401
  if (response.status === 401 && !isRetry) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;
      if (newToken) {
        onTokenRefreshed(newToken);
        return request(endpoint, options, true); // retry once with new token
      }
    } else {
      // Queue the retry until refresh completes
      return new Promise((resolve, reject) => {
        refreshSubscribers.push((newToken: string) => {
          const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
          fetch(`${BASE_URL}${endpoint}`, { ...options, headers: retryHeaders })
            .then(r => r.json()).then(resolve).catch(reject);
        });
      });
    }
    return; // redirect already happened inside refreshAccessToken
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    // Flatten DRF validation errors into a readable message
    const msg = error.detail || error.message || error.error ||
      Object.values(error).flat().join(' ') || 'Request failed';
    throw new Error(msg as string);
  }

  // Handle 204 No Content
  if (response.status === 204) return null;
  return response.json();
}

// ─── API Surface ────────────────────────────────────────────────────────────
export const api = {
  // Auth
  async loginUser(identifier: string, password: string, role: 'ca' | 'customer', caCode?: string) {
    const data = await request('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, role, ca_code: caCode })
    });
    sessionStorage.setItem('access_token', data.access);
    sessionStorage.setItem('refresh_token', data.refresh);
    return data;
  },

  async registerCA(formData: any) {
    return request('/api/auth/register/ca/', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
  },

  async registerCustomer(formData: any) {
    return request('/api/auth/register/customer/', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
  },

  async logout() {
    const refresh = sessionStorage.getItem('refresh_token');
    try {
      await request('/api/auth/logout/', { method: 'POST', body: JSON.stringify({ refresh }) });
    } finally {
      sessionStorage.clear();
      window.location.hash = '#/';
    }
  },

  // Uploads
  async getPresignedUploadUrl(fileName: string, financialYear: string, month: string) {
    return request('/api/uploads/presign/', {
      method: 'POST',
      body: JSON.stringify({ file_name: fileName, file_size: 0, financial_year: financialYear, month })
    });
  },

  /**
   * Upload a file to storage.
   * - local_mode=true  → POST file to Django's local-upload endpoint
   * - local_mode=false → PUT file directly to R2 presigned URL
   */
  async uploadFile(file: File, presignResult: { presigned_url: string; storage_key: string; local_mode?: boolean }) {
    if (presignResult.local_mode) {
      // Local dev: POST multipart to Django
      const token = sessionStorage.getItem('access_token');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(presignResult.presigned_url, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error(`Local upload failed: ${res.status}`);
      return;
    }
    // Production: PUT directly to R2
    const res = await fetch(presignResult.presigned_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/csv' },
      body: file,
    });
    if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
  },

  async confirmUpload(storageKey: string, fileName: string, financialYear: string, month: string, note: string) {
    return request('/api/uploads/confirm/', {
      method: 'POST',
      body: JSON.stringify({ storage_key: storageKey, file_name: fileName, financial_year: financialYear, month, note })
    });
  },

  async getMyUploads(financialYear?: string) {
    const query = financialYear ? `?financial_year=${financialYear}` : '';
    return request(`/api/uploads/my/${query}`);
  },

  // CA Workspace
  async getCustomerUploads(customerId: string, financialYear: string) {
    // 'all' is a sentinel value — return empty list, CA dashboard handles it
    if (customerId === 'all') return [];
    return request(`/api/uploads/customer/${customerId}/?financial_year=${financialYear}`);
  },

  async mapSheet(uploadId: string, gstrSheet: string) {
    return request(`/api/uploads/${uploadId}/map-sheet/`, {
      method: 'PATCH',
      body: JSON.stringify({ gstr_sheet: gstrSheet })
    });
  },

  async triggerGeneration(customerId: string, financialYear: string, month: string, uploadIds: string[]) {
    return request('/api/outputs/generate/', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customerId, financial_year: financialYear, month, upload_ids: uploadIds })
    });
  },

  async downloadOutput(outputId: string) {
    return request(`/api/outputs/${outputId}/download/`);
  },

  async triggerVerification(customerId: string, financialYear: string, month: string) {
    return request('/api/outputs/verify/', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customerId, financial_year: financialYear, month })
    });
  },

  async getCustomers() {
    return request('/api/users/customers/');
  },
};