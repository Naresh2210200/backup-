import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { User } from '../../types';
import { generateFinancialYears } from '../../services/utils';

interface CustomerDashboardProps {
  user: User;
  onLogout: () => void;
}

interface UploadRecord {
  id: string;
  file_name: string;
  month: string;
  financial_year: string;
  status: string;
  uploaded_at: string;
  note: string;
}

const FY_OPTIONS = generateFinancialYears(5);
const MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cls =
    status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
      status === 'Pending' ? 'bg-amber-100 text-amber-700' :
        status === 'Error' ? 'bg-rose-100 text-rose-700' :
          'bg-blue-100 text-blue-700';
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cls}`}>{status}</span>;
};

const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ user, onLogout }) => {
  const [files, setFiles] = useState<FileList | null>(null);
  const [note, setNote] = useState('');
  const [month, setMonth] = useState(new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date()));
  const [fy, setFy] = useState(FY_OPTIONS[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [isLoadingUploads, setIsLoadingUploads] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load upload history from Django
  const fetchUploads = async () => {
    setIsLoadingUploads(true);
    try {
      const data = await api.getMyUploads(fy);
      setUploads(data?.results || data || []);
    } catch (err: any) {
      console.error('Failed to load uploads:', err.message);
    } finally {
      setIsLoadingUploads(false);
    }
  };

  useEffect(() => { fetchUploads(); }, [fy]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files || files.length === 0) return;
    setUploadError('');
    setUploadSuccess('');

    // Client-side validation
    const fileArr = Array.from(files as FileList) as File[];
    const invalid = fileArr.filter(f => !f.name.toLowerCase().endsWith('.csv') && f.type !== 'text/csv');
    if (invalid.length > 0) {
      setUploadError(`Only CSV files accepted. Invalid: ${invalid.map(f => f.name).join(', ')}`);
      return;
    }
    const oversized = fileArr.filter(f => f.size > 10 * 1024 * 1024);
    if (oversized.length > 0) {
      setUploadError(`Files must be under 10MB. Oversized: ${oversized.map(f => f.name).join(', ')}`);
      return;
    }

    setIsUploading(true);
    const uploaded: string[] = [];
    const failed: string[] = [];

    for (const file of fileArr) {
      try {
        // Step 1: Get presigned URL (or local upload URL) from Django
        const presignResult = await api.getPresignedUploadUrl(file.name, fy, month);

        // Step 2: Upload file — auto-detects local mode vs R2
        await api.uploadFile(file, presignResult);

        // Step 3: Confirm upload with Django (creates DB record)
        await api.confirmUpload(presignResult.storage_key, file.name, fy, month, note);
        uploaded.push(file.name);
      } catch (err: any) {
        console.error(`Upload failed for ${file.name}:`, err);
        failed.push(file.name);
      }
    }

    setIsUploading(false);

    if (uploaded.length > 0) {
      setUploadSuccess(`✓ Uploaded: ${uploaded.join(', ')}`);
      setFiles(null);
      setNote('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchUploads(); // Refresh list
    }
    if (failed.length > 0) {
      setUploadError(`Failed to upload: ${failed.join(', ')}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-lg">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Welcome, {user.fullName}</h1>
            {user.gstin && <p className="text-sm text-slate-500 font-mono">{user.gstin}</p>}
          </div>
        </div>
        <button onClick={onLogout} className="px-4 py-2 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-50 transition-all">
          Logout
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Upload Monthly Data</h2>
            <p className="text-xs text-slate-400 mb-6">CSV files only · Max 10MB each</p>

            <form onSubmit={handleUpload} className="space-y-4">
              {uploadError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">{uploadError}</div>
              )}
              {uploadSuccess && (
                <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-100">{uploadSuccess}</div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Financial Year</label>
                <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={fy} onChange={e => setFy(e.target.value)}>
                  {FY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Month</label>
                <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={month} onChange={e => setMonth(e.target.value)}>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">CSV Files</label>
                <input type="file" multiple accept=".csv,text/csv" required ref={fileInputRef}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  onChange={e => { setFiles(e.target.files); setUploadError(''); setUploadSuccess(''); }} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes <span className="font-normal text-slate-400">(optional)</span></label>
                <textarea className="w-full p-2.5 border border-slate-200 rounded-lg text-sm h-20 resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Sales data for April, includes export invoices..."
                  value={note} onChange={e => setNote(e.target.value)} />
              </div>

              <button type="submit" disabled={isUploading || !files}
                className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${isUploading || !files
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95'
                  }`}>
                {isUploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Uploading to R2...
                  </span>
                ) : 'Send to CA'}
              </button>
            </form>
          </div>
        </div>

        {/* Upload History */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-bold text-slate-900">Upload History</h2>
              <select className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={fy} onChange={e => setFy(e.target.value)}>
                {FY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            {isLoadingUploads ? (
              <div className="p-10 text-center text-slate-400 text-sm">
                <svg className="animate-spin h-6 w-6 mx-auto mb-3 text-indigo-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading uploads...
              </div>
            ) : uploads.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">
                No uploads yet for {fy}. Upload your first CSV above.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-semibold">File</th>
                    <th className="px-6 py-3 font-semibold">Period</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {uploads.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{u.file_name}</td>
                      <td className="px-6 py-4 text-slate-500">{u.month} · {u.financial_year}</td>
                      <td className="px-6 py-4"><StatusBadge status={u.status} /></td>
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {new Date(u.uploaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;