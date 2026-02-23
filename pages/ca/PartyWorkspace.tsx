import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { getAIGSTRMapping } from '../../services/gemini';
import { User } from '../../types';
import { GSTR1Dashboard } from './components/GSTR1Dashboard';

interface PartyWorkspaceProps {
  user: User;
  onLogout: () => void;
}

type ActiveModule = 'Uploaded Files' | 'Data Automation Tool' | 'GSTR Verification' | 'GST Logs';

interface UploadRecord {
  id: string;
  file_name: string;
  month: string;
  financial_year: string;
  status: string;
  storage_key: string;
  uploaded_at: string;
  gstr_sheet?: string;
  note?: string;
}

interface VerificationResult {
  run_id: string;
  total_checked: number;
  total_invalid: number;
  total_moved_to_b2cs: number;
  corrected_key?: string;
  error_report_key?: string;
  json_key?: string;
  json_download_url?: string;
  status: string;
  dashboard_data?: any; // Added for dashboard data
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
const Spinner = () => (
  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cls =
    status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
      status === 'Pending' ? 'bg-amber-100 text-amber-700' :
        status === 'Received' ? 'bg-indigo-100 text-indigo-700' :
          status === 'Processing' ? 'bg-blue-100 text-blue-700' :
            'bg-rose-100 text-rose-700';
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cls}`}>{status}</span>;
};

// ─── GSTR Sheet options ───────────────────────────────────────────────────────
const GSTR_SHEETS = ['b2b', 'b2cl', 'b2cs', 'hsn', 'cdnr', 'cdnur', 'Nil_exempt_NonGST', 'Docs_issued'];

const CAPartyWorkspace: React.FC<PartyWorkspaceProps> = ({ user, onLogout }) => {
  const { partyId } = useParams<{ partyId: string }>();
  const [searchParams] = useSearchParams();
  const fy = searchParams.get('fy') || '2024-25';
  const navigate = useNavigate();

  const [activeModule, setActiveModule] = useState<ActiveModule>('Uploaded Files');

  // ── Data state ──────────────────────────────────────────────────────────────
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [partyName, setPartyName] = useState('');
  const [partyGstin, setPartyGstin] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // ── Automation state ────────────────────────────────────────────────────────
  const [automationMonth, setAutomationMonth] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [generatedOutputKey, setGeneratedOutputKey] = useState('');
  const [generatedDownloadUrl, setGeneratedDownloadUrl] = useState('');

  // ── AI Mapping state ────────────────────────────────────────────────────────
  const [aiMapping, setAiMapping] = useState<any>(null);
  const [isMapping, setIsMapping] = useState(false);
  const [mappingFile, setMappingFile] = useState<UploadRecord | null>(null);

  // ── Verification state ──────────────────────────────────────────────────────
  const [verificationMonth, setVerificationMonth] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verificationError, setVerificationError] = useState('');
  const [correctedDownloadUrl, setCorrectedDownloadUrl] = useState('');
  const [errorReportUrl, setErrorReportUrl] = useState('');
  const [jsonDownloadUrl, setJsonDownloadUrl] = useState('');
  const [viewingDashboard, setViewingDashboard] = useState(false);

  // ── Expanded rows ───────────────────────────────────────────────────────────
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  // ─── Fetch uploads ──────────────────────────────────────────────────────────
  const fetchUploads = useCallback(async () => {
    if (!partyId) return;
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await api.getCustomerUploads(partyId, fy);
      const list: UploadRecord[] = data?.results || data || [];
      setUploads(list);
      // Extract party name from first upload (backend includes customer_name)
      if (list.length > 0 && (data as any).customer_name) {
        setPartyName((data as any).customer_name);
        setPartyGstin((data as any).customer_gstin || '');
      }
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load uploads.');
    } finally {
      setIsLoading(false);
    }
  }, [partyId, fy]);

  useEffect(() => { fetchUploads(); }, [fetchUploads]);

  // ─── Group uploads by month ─────────────────────────────────────────────────
  const groupedUploads = useMemo(() => {
    const groups: Record<string, UploadRecord[]> = {};
    uploads.forEach(u => {
      if (!groups[u.month]) groups[u.month] = [];
      groups[u.month].push(u);
    });
    return groups;
  }, [uploads]);

  const availableMonths = Object.keys(groupedUploads);

  // ─── Handle GSTR sheet mapping ──────────────────────────────────────────────
  const handleMapSheet = async (upload: UploadRecord, sheet: string) => {
    try {
      await api.mapSheet(upload.id, sheet);
      setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, gstr_sheet: sheet } : u));
    } catch (err: any) {
      alert(`Failed to map sheet: ${err.message}`);
    }
  };

  // ─── Handle AI mapping analysis ─────────────────────────────────────────────
  const handleRunAIMapping = async (file: UploadRecord) => {
    setIsMapping(true);
    setMappingFile(file);
    setAiMapping(null);
    try {
      // Use filename to infer headers (since we don't have content client-side anymore)
      const inferredHeaders = ['GSTIN/UIN', 'Invoice No', 'Invoice Date', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Rate', 'HSN'];
      const result = await getAIGSTRMapping(file.file_name, inferredHeaders);
      setAiMapping(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsMapping(false);
    }
  };

  // ─── Handle Download All (Month) ──────────────────────────────────────────
  const handleDownloadMonth = async (month: string) => {
    const files = groupedUploads[month] || [];
    if (files.length === 0) return;

    for (const f of files) {
      try {
        const res = await api.downloadUpload(f.id);
        const a = document.createElement('a');
        a.href = res.download_url;
        a.download = res.file_name || f.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Delay to allow sequential downloads without popup blockers
        await new Promise(r => setTimeout(r, 600));
      } catch (err: any) {
        console.error('Failed to download', f.file_name, err);
      }
    }
  };

  // ─── Handle GSTR1 generation via FastAPI ────────────────────────────────────
  const handleBulkConvert = async () => {
    if (!automationMonth || !partyId) return;
    const filesInMonth = groupedUploads[automationMonth] || [];
    if (filesInMonth.length === 0) {
      alert('No files found for this month.');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Sending to processing service...');
    setGeneratedOutputKey('');
    setGeneratedDownloadUrl('');

    try {
      // Trigger GSTR1 generation via Django → FastAPI
      setProcessingStatus('Generating GSTR1 Excel...');
      const result = await api.triggerGeneration(
        partyId,
        fy,
        automationMonth,
        filesInMonth.map(f => f.id)
      );

      setGeneratedOutputKey(result.storage_key || '');
      setProcessingStatus(`✓ Generated: ${result.file_name || 'GSTR1.xlsx'} (${result.sheets_processed || '?'} sheets)`);

      // Get download URL if available
      if (result.download_url) {
        setGeneratedDownloadUrl(result.download_url);
      } else if (result.output_id) {
        const dlData = await api.downloadOutput(result.output_id);
        setGeneratedDownloadUrl(dlData.download_url || '');
      }

      // Refresh uploads to show updated status
      await fetchUploads();
    } catch (err: any) {
      setProcessingStatus('');
      alert(`Generation failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Handle GSTIN verification via FastAPI ───────────────────────────────────
  const handleGstrVerify = async () => {
    if (!verificationMonth || !partyId) {
      alert('Please select a month to verify.');
      return;
    }

    // Find the generated output for this month
    const monthUploads = groupedUploads[verificationMonth] || [];
    if (monthUploads.length === 0) {
      alert('No files found for this month. Generate GSTR1 first.');
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);
    setVerificationError('');
    setCorrectedDownloadUrl('');
    setErrorReportUrl('');
    setJsonDownloadUrl('');

    try {
      // Trigger verification via Django → FastAPI
      const result = await api.triggerVerification(partyId, fy, verificationMonth);
      setVerificationResult(result);

      if (result.corrected_download_url) setCorrectedDownloadUrl(result.corrected_download_url);
      if (result.error_report_download_url) setErrorReportUrl(result.error_report_download_url);
      if (result.json_download_url) setJsonDownloadUrl(result.json_download_url);
    } catch (err: any) {
      setVerificationError(err.message || 'Verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  // ─── Sidebar modules ─────────────────────────────────────────────────────────
  const modules: { id: ActiveModule; label: string; disabled?: boolean }[] = [
    { id: 'Uploaded Files', label: 'Uploaded Files' },
    { id: 'Data Automation Tool', label: 'Data Automation Tool' },
    { id: 'GSTR Verification', label: 'GSTR Verification' },
    { id: 'GST Logs', label: 'GST Logs' },
  ];

  if (!partyId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="font-medium text-lg">Select a party from the sidebar to view workspace</p>
      </div>
    );
  }

  if (viewingDashboard && verificationResult?.dashboard_data) {
    return <GSTR1Dashboard data={verificationResult.dashboard_data} onBack={() => setViewingDashboard(false)} jsonUrl={jsonDownloadUrl} />;
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-slate-200 flex flex-col bg-slate-50">
        <div className="p-6">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Modules</h2>
          <nav className="space-y-1">
            {modules.map(mod => (
              <button
                key={mod.id}
                onClick={() => !mod.disabled && setActiveModule(mod.id)}
                disabled={mod.disabled}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all flex justify-between items-center ${activeModule === mod.id
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                  : mod.disabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-600 hover:bg-slate-100'
                  }`}>
                {mod.label}
                {mod.disabled && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded uppercase tracking-wide">Soon</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="px-8 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/ca/dashboard')} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {partyName || 'Loading...'}
                <span className="ml-2 px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded border border-indigo-100">FY {fy}</span>
              </h1>
              {partyGstin && <p className="text-sm text-slate-500 font-mono">{partyGstin}</p>}
            </div>
          </div>
          <button onClick={onLogout} className="text-sm font-semibold text-red-600 hover:underline">Logout</button>
        </header>

        {/* Module Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-50/30">

          {/* ── Uploaded Files ── */}
          {activeModule === 'Uploaded Files' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900">Monthly File Archive</h2>
                <button onClick={fetchUploads} className="text-sm text-indigo-600 font-semibold hover:underline flex items-center gap-1">
                  {isLoading ? <Spinner /> : '↻'} Refresh
                </button>
              </div>

              {loadError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{loadError}</div>
              )}

              {isLoading ? (
                <div className="p-10 text-center text-slate-400 text-sm flex flex-col items-center gap-3">
                  <Spinner /> Loading uploads...
                </div>
              ) : availableMonths.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
                  No files uploaded for FY {fy} yet.
                </div>
              ) : (
                availableMonths.map(monthName => (
                  <div key={monthName} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div
                      onClick={() => setExpandedMonth(expandedMonth === monthName ? null : monthName)}
                      className="w-full px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition-colors cursor-pointer select-none">
                      <span className="text-base font-bold text-slate-800">{monthName}</span>
                      <div className="flex items-center gap-3">
                        <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[10px] font-bold">
                          {groupedUploads[monthName].length} FILES
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownloadMonth(monthName); }}
                          className="bg-emerald-50 text-emerald-600 px-2 py-1 flex items-center gap-1 rounded text-[10px] font-bold hover:bg-emerald-100 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          DOWNLOAD ALL
                        </button>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-400 transition-transform ${expandedMonth === monthName ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>

                    {expandedMonth === monthName && (
                      <div className="border-t border-slate-100">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                            <tr>
                              <th className="px-6 py-3">File</th>
                              <th className="px-6 py-3">GSTR Sheet</th>
                              <th className="px-6 py-3">Status</th>
                              <th className="px-6 py-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {groupedUploads[monthName].map(u => (
                              <tr key={u.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4">
                                  <p className="font-medium text-slate-800">{u.file_name}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {new Date(u.uploaded_at).toLocaleDateString('en-IN')}
                                  </p>
                                </td>
                                <td className="px-6 py-4">
                                  <select
                                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={u.gstr_sheet || ''}
                                    onChange={e => handleMapSheet(u, e.target.value)}>
                                    <option value="">Auto-detect</option>
                                    {GSTR_SHEETS.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                </td>
                                <td className="px-6 py-4"><StatusBadge status={u.status} /></td>
                                <td className="px-6 py-4 flex items-center gap-4">
                                  <button
                                    onClick={() => handleRunAIMapping(u)}
                                    disabled={isMapping && mappingFile?.id === u.id}
                                    className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
                                    {isMapping && mappingFile?.id === u.id ? <><Spinner /> Analyzing...</> : '✦ AI Analyze'}
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const res = await api.downloadUpload(u.id);
                                        window.open(res.download_url, '_blank');
                                      } catch (err: any) {
                                        alert('Failed to get download link: ' + err.message);
                                      }
                                    }}
                                    className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* AI Mapping Result */}
              {aiMapping && (
                <div className="mt-6 p-6 bg-white rounded-2xl border border-indigo-100 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-bold text-slate-900">
                      AI Column Mapping — <span className="text-indigo-600">{mappingFile?.file_name}</span>
                    </h3>
                    <button onClick={() => setAiMapping(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {aiMapping.mapping?.map((m: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Client Field</span>
                        <span className="font-mono text-sm text-slate-800 block truncate">{m.clientHeader}</span>
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <span className="text-indigo-600 font-bold text-sm">→ {m.standardHeader}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Data Automation Tool ── */}
          {activeModule === 'Data Automation Tool' && (
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">GSTR1 Generator</h2>
              <p className="text-sm text-slate-500 mb-8">
                Select a month and trigger the FastAPI processing service to generate the GSTR1 Excel from uploaded CSVs.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Select Month</label>
                  <select
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={automationMonth}
                    onChange={e => { setAutomationMonth(e.target.value); setProcessingStatus(''); setGeneratedDownloadUrl(''); }}>
                    <option value="">Choose month...</option>
                    {availableMonths.map(m => (
                      <option key={m} value={m}>{m} ({groupedUploads[m].length} files)</option>
                    ))}
                  </select>
                </div>

                {automationMonth && groupedUploads[automationMonth] && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Files to process:</p>
                    <ul className="space-y-1">
                      {groupedUploads[automationMonth].map(f => (
                        <li key={f.id} className="text-sm text-slate-700 flex items-center gap-2">
                          <span className="text-indigo-400">▸</span>
                          {f.file_name}
                          {f.gstr_sheet && <span className="text-xs font-mono text-slate-400">→ {f.gstr_sheet}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={handleBulkConvert}
                  disabled={!automationMonth || isProcessing}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${!automationMonth || isProcessing
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95'
                    }`}>
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-3">
                      <Spinner /> {processingStatus || 'Processing...'}
                    </span>
                  ) : 'Generate GSTR1 Excel →'}
                </button>

                {processingStatus && !isProcessing && (
                  <div className={`p-4 rounded-xl border text-sm font-medium ${processingStatus.startsWith('✓')
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-red-50 border-red-100 text-red-600'
                    }`}>
                    {processingStatus}
                    {generatedDownloadUrl && (
                      <a href={generatedDownloadUrl} download
                        className="ml-4 inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">
                        ↓ Download Excel
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── GSTR Verification ── */}
          {activeModule === 'GSTR Verification' && (
            <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-200 max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">GSTIN Verification</h2>
              <p className="text-sm text-slate-500 mb-8">
                Validates all GSTINs in the generated GSTR1 Excel. Invalid GSTINs are moved to B2CS and an error report is generated.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Select Month to Verify</label>
                  <select
                    className="w-full p-3.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={verificationMonth}
                    onChange={e => { setVerificationMonth(e.target.value); setVerificationResult(null); setVerificationError(''); }}>
                    <option value="">Choose month...</option>
                    {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <button
                  onClick={handleGstrVerify}
                  disabled={!verificationMonth || isVerifying}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${!verificationMonth || isVerifying
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95'
                    }`}>
                  {isVerifying ? (
                    <span className="flex items-center justify-center gap-3"><Spinner /> Verifying GSTINs...</span>
                  ) : 'Run GSTIN Verification →'}
                </button>

                {verificationError && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{verificationError}</div>
                )}

                {verificationResult && (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'GSTINs Checked', value: verificationResult.total_checked, color: 'text-slate-700' },
                        { label: 'Invalid Found', value: verificationResult.total_invalid, color: 'text-rose-600' },
                        { label: 'Moved to B2CS', value: verificationResult.total_moved_to_b2cs, color: 'text-amber-600' },
                      ].map((stat, i) => (
                        <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                          <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                          <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Downloads */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {correctedDownloadUrl && (
                        <a href={correctedDownloadUrl} download
                          className="flex items-center justify-center gap-2 py-4 px-6 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg hover:bg-emerald-700 transition-all">
                          ↓ Download Corrected Excel
                        </a>
                      )}

                      {verificationResult?.dashboard_data && Object.keys(verificationResult.dashboard_data).length > 0 && (
                        <button onClick={() => setViewingDashboard(true)} className="col-span-1 md:col-span-2 flex items-center justify-center gap-2 py-4 px-6 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition-all">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
                          View GSTR-1 Dashboard
                        </button>
                      )}

                      {errorReportUrl && (
                        <a href={errorReportUrl} download
                          className="col-span-1 md:col-span-2 flex items-center justify-center gap-2 py-4 px-6 bg-amber-500 text-white font-bold rounded-2xl shadow-lg hover:bg-amber-600 transition-all">
                          ↓ Download Extracted Error Report (CSV)
                        </a>
                      )}
                      {!correctedDownloadUrl && !errorReportUrl && (
                        <div className="col-span-2 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700 text-center">
                          ✓ Verification complete. Run ID: <span className="font-mono text-xs">{verificationResult.run_id}</span>
                          <br /><span className="text-xs text-slate-500 mt-1 block">Download links will appear here once files are ready.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── GST Logs ── */}
          {activeModule === 'GST Logs' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Processing Logs</h2>
              <div className="p-10 text-center text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
                <p className="text-4xl mb-3">📋</p>
                <p className="font-medium">Logs coming soon</p>
                <p className="text-xs mt-1">Processing history will be stored and displayed here.</p>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default CAPartyWorkspace;