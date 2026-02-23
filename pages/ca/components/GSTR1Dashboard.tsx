import React, { useMemo } from 'react';

interface GSTR1DashboardProps {
    data: any;
    onBack: () => void;
    jsonUrl?: string;
}

// Global utility for consistent Indian formatting and sign handling
const formatRs = (num: number) => {
    const val = num || 0;
    const formatted = Math.abs(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return val < 0 ? `-₹${formatted}` : `₹${formatted}`;
};

// Reusable card for high-level dashboard metrics
const SummaryCard = ({
    title,
    value,
    trend,
    trendColor = "text-emerald-500"
}: {
    title: string;
    value: number;
    trend: string;
    trendColor?: string;
}) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wide">{title}</h3>
        <p className="text-3xl font-extrabold text-slate-800 mb-2">{formatRs(value)}</p>
        <p className={`${trendColor} text-xs font-bold`}>{trend}</p>
    </div>
);

interface TableRowProps {
    title: string;
    subtitle?: string;
    data: { taxable: number; cgst: number; sgst: number; igst: number; cess: number };
    totalValue?: number;
    isAggregate?: boolean;
    textColorClass?: string;
}

// Reusable dynamic table row for rendering GST returns consistently
const TableRow = ({ title, subtitle, data, totalValue, isAggregate, textColorClass = "text-slate-600" }: TableRowProps) => {
    // Statistically verify if a custom total is supplied, otherwise dynamically calculate it
    const rowTotal = totalValue !== undefined
        ? totalValue
        : data.taxable + data.cgst + data.sgst + data.igst + data.cess;

    if (isAggregate) {
        return (
            <tr className="bg-[#24265D] text-white">
                <td className="px-6 py-5 font-bold tracking-widest text-[13px] uppercase text-left">{title}</td>
                <td className="px-6 py-5 font-bold text-[15px]">{formatRs(data.taxable)}</td>
                <td className="px-6 py-5 font-bold text-[15px]">{formatRs(data.cgst)}</td>
                <td className="px-6 py-5 font-bold text-[15px]">{formatRs(data.sgst)}</td>
                <td className="px-6 py-5 font-bold text-[15px]">{formatRs(data.igst)}</td>
                <td className="px-6 py-5 font-bold text-[15px]">{formatRs(data.cess)}</td>
                <td className="px-6 py-5 font-bold text-[15px]">{formatRs(rowTotal)}</td>
            </tr>
        );
    }

    const cellClass = `px-6 py-5 font-semibold ${textColorClass}`;
    const totalClass = `px-6 py-5 font-bold ${textColorClass === 'text-red-500' ? 'text-red-600' : 'text-slate-800'}`;

    return (
        <tr className="hover:bg-slate-50 transition-colors cursor-pointer select-none">
            <td className="px-6 py-5 text-left">
                <p className="font-bold text-slate-800 text-[15px] mb-0.5">{title}</p>
                {subtitle && <p className="text-xs text-slate-400 font-normal">{subtitle}</p>}
            </td>
            <td className={cellClass}>{formatRs(data.taxable)}</td>
            <td className={cellClass}>{formatRs(data.cgst)}</td>
            <td className={cellClass}>{formatRs(data.sgst)}</td>
            <td className={cellClass}>{formatRs(data.igst)}</td>
            <td className={cellClass}>{formatRs(data.cess)}</td>
            <td className={totalClass}>{formatRs(rowTotal)}</td>
        </tr>
    );
};

export const GSTR1Dashboard: React.FC<GSTR1DashboardProps> = ({ data, onBack, jsonUrl }) => {
    const handleDownloadJson = async () => {
        if (!jsonUrl) return;
        try {
            const response = await fetch(jsonUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "gstr1_standard.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to download JSON", error);
            // Fallback to opening in new tab
            window.open(jsonUrl, '_blank');
        }
    };

    // Memoize pure data processing logic for improved re-render efficiency
    const metrics = useMemo(() => {
        const getRaw = (prefix: string) => ({
            taxable: data?.[`${prefix}_taxable`] || 0,
            cgst: data?.[`${prefix}_cgst`] || 0,
            sgst: data?.[`${prefix}_sgst`] || 0,
            igst: data?.[`${prefix}_igst`] || 0,
            cess: data?.[`${prefix}_cess`] || 0,
        });

        const b2b = getRaw('b2b');
        const b2c = getRaw('b2c');
        const hsn = getRaw('hsn');
        const nil = getRaw('nil');
        const exp = getRaw('exp');
        const at = getRaw('at');
        const atadj = getRaw('atadj');

        // CDNR: Force to negative for display and naturally subtractive math
        const cdnr_raw = getRaw('cdnr');
        const cdnr = {
            taxable: -Math.abs(cdnr_raw.taxable),
            cgst: -Math.abs(cdnr_raw.cgst),
            sgst: -Math.abs(cdnr_raw.sgst),
            igst: -Math.abs(cdnr_raw.igst),
            cess: -Math.abs(cdnr_raw.cess),
        };

        // Total Aggregate = B2B + B2C + CDNR + Nil/Exempt + Export + Advance Tax - Adjusted (CDNR is already negative)
        const agg = {
            taxable: b2b.taxable + b2c.taxable + cdnr.taxable + nil.taxable + exp.taxable + at.taxable - atadj.taxable,
            cgst: b2b.cgst + b2c.cgst + cdnr.cgst + nil.cgst + exp.cgst + at.cgst - atadj.cgst,
            sgst: b2b.sgst + b2c.sgst + cdnr.sgst + nil.sgst + exp.sgst + at.sgst - atadj.sgst,
            igst: b2b.igst + b2c.igst + cdnr.igst + nil.igst + exp.igst + at.igst - atadj.igst,
            cess: b2b.cess + b2c.cess + cdnr.cess + nil.cess + exp.cess + at.cess - atadj.cess,
        };

        const totalTax = agg.cgst + agg.sgst + agg.igst;
        const totalInvoice = agg.taxable + totalTax + agg.cess;
        const cdnrTotal = cdnr.taxable + cdnr.cgst + cdnr.sgst + cdnr.igst + cdnr.cess;

        return { b2b, b2c, cdnr, nil, exp, at, atadj, hsn, agg, totalTax, totalInvoice, cdnrTotal };
    }, [data]);

    const { b2b, b2c, cdnr, nil, exp, at, atadj, hsn, agg, totalTax, totalInvoice, cdnrTotal } = metrics;

    return (
        <div className="bg-slate-50 min-h-screen font-sans text-slate-800 absolute inset-0 z-50 overflow-y-auto">
            {/* Top Navigation */}
            <div className="bg-[#24265D] text-white px-8 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div className="bg-white/10 p-2 rounded">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 8v7a1 1 0 100 2h14a1 1 0 100-2V8a1 1 0 00.496-1.868l-7-4zM6 9a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1zm3 1a1 1 0 012 0v3a1 1 0 11-2 0v-3zm5-1a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight uppercase">Party GSTR-1 Data</h1>
                        <p className="text-xs text-white/70">GSTIN: {data?.gstin || '29XXXXA0000A1Z5'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-6 text-sm font-medium">
                    <button className="hover:text-white/80 transition-colors flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        File Return
                    </button>
                    <button className="hover:text-white/80 transition-colors flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Summary
                    </button>
                    {jsonUrl ? (
                        <button
                            onClick={handleDownloadJson}
                            className="bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-white font-bold shadow-lg shadow-emerald-500/30"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download JSON
                        </button>
                    ) : (
                        <button className="text-white/40 cursor-not-allowed flex items-center gap-2" disabled>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download JSON
                        </button>
                    )}
                </div>
            </div>

            {/* Dashboard Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h2 className="text-3xl font-extrabold text-slate-800 mb-1">GSTR-1 Dashboard</h2>
                        <p className="text-slate-500 font-medium">Summary of outward supplies of goods or services</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 border border-emerald-100">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            READY TO FILE
                        </span>
                        <button className="bg-[#24265D] hover:bg-[#1C1D4A] text-white px-6 py-2 rounded-md text-sm font-bold transition-colors">
                            PROCEED TO FILE
                        </button>
                    </div>
                </div>

                {/* KPI Overview Cards */}
                <div className="grid grid-cols-4 gap-6 mb-8">
                    <SummaryCard title="Total Taxable Value" value={agg.taxable} trend="+12.5% vs Last Month" />
                    <SummaryCard title="Total Tax (C+S+I)" value={totalTax} trend="+10.2% vs Last Month" />
                    <SummaryCard title="Total Cess" value={agg.cess} trend="— Steady Trend" trendColor="text-slate-400" />
                    <SummaryCard title="Total Invoice Value" value={totalInvoice} trend="+11.8% vs Last Month" />
                </div>

                {/* Ledger Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-16">
                    <div className="px-6 py-5 flex justify-between items-center border-b border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800">Summary of Outward Supplies</h3>
                        <div className="flex gap-3">
                            <button className="px-4 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 focus:outline-none">Filter</button>
                            <button className="px-4 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 focus:outline-none">Print</button>
                        </div>
                    </div>

                    <table className="w-full text-right text-sm">
                        <thead>
                            <tr className="text-[11px] font-bold text-slate-500 bg-slate-50 uppercase tracking-wider">
                                <th className="px-6 py-4 text-left">Table Category</th>
                                <th className="px-6 py-4">Taxable Value</th>
                                <th className="px-6 py-4">CGST</th>
                                <th className="px-6 py-4">SGST</th>
                                <th className="px-6 py-4">IGST</th>
                                <th className="px-6 py-4">Cess</th>
                                <th className="px-6 py-4">Total Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <TableRow
                                title="4A, 4B, 4C - B2B Invoices"
                                subtitle="Registered Taxable Supplies"
                                data={b2b}
                            />
                            <TableRow
                                title="5A, 5B, 7 - B2C Invoices"
                                subtitle="Unregistered Taxable Supplies"
                                data={b2c}
                            />
                            <TableRow
                                title="9B - Credit/Debit Notes"
                                subtitle="Registered/Unregistered"
                                data={cdnr}
                                totalValue={cdnrTotal}
                                textColorClass="text-red-500"
                            />
                            <TableRow
                                title="8 - Nil Rated/Exempt"
                                subtitle="Nil Rated/Exempt/Non-GST"
                                data={nil}
                            />
                            <TableRow
                                title="6A - Export Supplies"
                                subtitle="Zero Rated Supplies"
                                data={exp}
                            />
                            <TableRow
                                title="11A, 11B - Advances"
                                subtitle="Received & Adjusted"
                                data={{
                                    taxable: at.taxable - atadj.taxable,
                                    cgst: at.cgst - atadj.cgst,
                                    sgst: at.sgst - atadj.sgst,
                                    igst: at.igst - atadj.igst,
                                    cess: at.cess - atadj.cess,
                                }}
                            />
                            <TableRow
                                title="Total Aggregate"
                                data={agg}
                                totalValue={totalInvoice}
                                isAggregate={true}
                            />
                            <TableRow
                                title="12 - HSN Summary"
                                subtitle="Outward Supplies Detail"
                                data={hsn}
                            />
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default GSTR1Dashboard;