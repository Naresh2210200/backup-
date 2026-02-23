import React from 'react';

export const GSTR1Dashboard = ({ data, onBack }: { data: any, onBack: () => void }) => {
    const formatRs = (num: number) => {
        const val = num || 0;
        const formatted = Math.abs(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return val < 0 ? `-₹${formatted}` : `₹${formatted}`;
    };

    const b2b = {
        taxable: data?.b2b_taxable || 0,
        cgst: data?.b2b_cgst || 0,
        sgst: data?.b2b_sgst || 0,
        igst: data?.b2b_igst || 0,
        cess: data?.b2b_cess || 0,
    };

    const b2c = {
        taxable: data?.b2c_taxable || 0,
        cgst: data?.b2c_cgst || 0,
        sgst: data?.b2c_sgst || 0,
        igst: data?.b2c_igst || 0,
        cess: data?.b2c_cess || 0,
    };

    // ✅ CDNR: Backend sends POSITIVE values (e.g. cdnr_cgst = 637.27)
    // Store as positive. Subtract when calculating aggregate below.
    const cdnr = {
        taxable: Math.abs(data?.cdnr_taxable || 0),  // 14380.88
        cgst: Math.abs(data?.cdnr_cgst || 0),        // 637.27
        sgst: Math.abs(data?.cdnr_sgst || 0),        // 637.27
        igst: Math.abs(data?.cdnr_igst || 0),        // 1274.53
        cess: Math.abs(data?.cdnr_cess || 0),
    };

    const hsn = {
        taxable: data?.hsn_taxable || 0,
        cgst: data?.hsn_cgst || 0,
        sgst: data?.hsn_sgst || 0,
        igst: data?.hsn_igst || 0,
        cess: data?.hsn_cess || 0,
    };

    // ✅ CORRECT: Total Aggregate = B2B + B2C - CDNR
    // Backend sends CDNR as POSITIVE, so we must SUBTRACT it
    const agg = {
        taxable: b2b.taxable + b2c.taxable - cdnr.taxable,
        cgst: b2b.cgst + b2c.cgst - cdnr.cgst,
        sgst: b2b.sgst + b2c.sgst - cdnr.sgst,
        igst: b2b.igst + b2c.igst - cdnr.igst,
        cess: b2b.cess + b2c.cess - cdnr.cess,
    };

    const totalTax = agg.cgst + agg.sgst + agg.igst;
    const totalInvoice = agg.taxable + totalTax + agg.cess;

    const cdnrTotal = cdnr.taxable + cdnr.cgst + cdnr.sgst + cdnr.igst + cdnr.cess;

    return (
        <div className="bg-slate-50 min-h-screen font-sans text-slate-800 absolute inset-0 z-50 overflow-y-auto">
            {/* Top Navbar */}
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
                    <button className="hover:text-white/80 transition-colors flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download JSON
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header Section */}
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

                {/* 4 Summary Cards */}
                <div className="grid grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wide">Total Taxable Value</h3>
                        <p className="text-3xl font-extrabold text-slate-800 mb-2">{formatRs(agg.taxable)}</p>
                        <p className="text-emerald-500 text-xs font-bold">+12.5% vs Last Month</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wide">Total Tax (C+S+I)</h3>
                        <p className="text-3xl font-extrabold text-slate-800 mb-2">{formatRs(totalTax)}</p>
                        <p className="text-emerald-500 text-xs font-bold">+10.2% vs Last Month</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wide">Total Cess</h3>
                        <p className="text-3xl font-extrabold text-slate-800 mb-2">{formatRs(agg.cess)}</p>
                        <p className="text-slate-400 text-xs font-medium">— Steady Trend</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wide">Total Invoice Value</h3>
                        <p className="text-3xl font-extrabold text-slate-800 mb-2">{formatRs(totalInvoice)}</p>
                        <p className="text-emerald-500 text-xs font-bold">+11.8% vs Last Month</p>
                    </div>
                </div>

                {/* Table Section */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-16">
                    <div className="px-6 py-5 flex justify-between items-center border-b border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800">Summary of Outward Supplies</h3>
                        <div className="flex gap-3">
                            <button className="px-4 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50">
                                Filter
                            </button>
                            <button className="px-4 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50">
                                Print
                            </button>
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

                            {/* B2B Row */}
                            <tr className="hover:bg-slate-50 transition-colors cursor-pointer">
                                <td className="px-6 py-5 text-left">
                                    <p className="font-bold text-slate-800 text-[15px] mb-0.5">4A, 4B, 4C - B2B Invoices</p>
                                    <p className="text-xs text-slate-400 font-normal">Registered Taxable Supplies</p>
                                </td>
                                <td className="px-6 py-5 font-semibold text-slate-600">{formatRs(b2b.taxable)}</td>
                                <td className="px-6 py-5 font-semibold text-slate-600">{formatRs(b2b.cgst)}</td>
                                <td className="px-6 py-5 font-semibold text-slate-600">{formatRs(b2b.sgst)}</td>
                                <td className="px-6 py-5 font-semibold text-slate-600">{formatRs(b2b.igst)}</td>
                                <td className="px-6 py-5 font-semibold text-slate-600">{formatRs(b2b.cess)}</td>
                                <td className="px-6 py-5 font-bold text-slate-800">{formatRs(b2b.taxable + b2b.cgst + b2b.sgst + b2b.igst + b2b.cess)}</td>
                            </tr>

                            {/* B2C Row */}
                            <tr className="hover:bg-slate-50 transition-colors cursor-pointer">
                                <td className="px-6 py-5 text-left">
                                    <p className="font-bold text-slate-800 text-[15px] mb-0.5">5A, 5B, 7 - B2C Invoices</p>
                                    <p className="text-xs text-slate-400 font-normal">Unregistered Taxable Supplies</p>
                                </td>
                                <td className="px-6 py-5 font-semibold text-slate-600">{formatRs(b2c.taxable)}</td>
                                <td className="px-6 py-5 font-semibold text-slate-600">{formatRs(b2c.cgst)}</td>
                                <td className="px-6 py-5 font-semibold text-slate-600">{formatRs(b2c.sgst)}</td>
                                <td className="px-6 py-5 font-semibold text-slate-600">{formatRs(b2c.igst)}</td>
                                <td className="px-6 py-5 font-semibold text-slate-600">{formatRs(b2c.cess)}</td>
                                <td className="px-6 py-5 font-bold text-slate-800">{formatRs(b2c.taxable + b2c.cgst + b2c.sgst + b2c.igst + b2c.cess)}</td>
                            </tr>

                            {/* ✅ FIX 3: CDNR Row — display raw values from backend (already negative) */}
                            {/* No negation needed here. Backend sends -637.27, display as -₹637.27 */}
                            <tr className="hover:bg-slate-50 transition-colors cursor-pointer">
                                <td className="px-6 py-5 text-left">
                                    <p className="font-bold text-slate-800 text-[15px] mb-0.5">9B - Credit/Debit Notes</p>
                                    <p className="text-xs text-slate-400 font-normal">Registered/Unregistered</p>
                                </td>
                                <td className="px-6 py-5 font-semibold text-red-500">{formatRs(cdnr.taxable)}</td>
                                <td className="px-6 py-5 font-semibold text-red-500">{formatRs(cdnr.cgst)}</td>
                                <td className="px-6 py-5 font-semibold text-red-500">{formatRs(cdnr.sgst)}</td>
                                <td className="px-6 py-5 font-semibold text-red-500">{formatRs(cdnr.igst)}</td>
                                <td className="px-6 py-5 font-semibold text-red-500">{formatRs(cdnr.cess)}</td>
                                <td className="px-6 py-5 font-bold text-red-600">{formatRs(cdnrTotal)}</td>
                            </tr>

                            {/* Total Aggregate Row */}
                            <tr className="bg-[#24265D] text-white">
                                <td className="px-6 py-5 font-bold tracking-widest text-[13px] uppercase text-left">Total Aggregate</td>
                                <td className="px-6 py-5 font-bold text-[15px]">{formatRs(agg.taxable)}</td>
                                <td className="px-6 py-5 font-bold text-[15px]">{formatRs(agg.cgst)}</td>
                                <td className="px-6 py-5 font-bold text-[15px]">{formatRs(agg.sgst)}</td>
                                <td className="px-6 py-5 font-bold text-[15px]">{formatRs(agg.igst)}</td>
                                <td className="px-6 py-5 font-bold text-[15px]">{formatRs(agg.cess)}</td>
                                <td className="px-6 py-5 font-bold text-[15px]">{formatRs(totalInvoice)}</td>
                            </tr>

                            {/* ✅ FIX 4: HSN Row — removed border-t-4 border-[#1C1D4A] which caused blue highlight */}
                            {/* Also added select-none to prevent text selection blue highlight */}
                            <tr className="hover:bg-slate-50 transition-colors cursor-pointer select-none">
                                <td className="px-6 py-5 text-left">
                                    <p className="font-bold text-slate-800 text-[15px] mb-0.5">12 - HSN Summary</p>
                                    <p className="text-xs text-slate-400 font-normal">Outward Supplies Detail</p>
                                </td>
                                <td className="px-6 py-5 font-semibold text-slate-600">{formatRs(hsn.taxable)}</td>
                                <td className="px-6 py-5 font-semibold text-slate-600">{formatRs(hsn.cgst)}</td>
                                <td className="px-6 py-5 font-semibold text-slate-600">{formatRs(hsn.sgst)}</td>
                                <td className="px-6 py-5 font-semibold text-slate-600">{formatRs(hsn.igst)}</td>
                                <td className="px-6 py-5 font-semibold text-slate-600">{formatRs(hsn.cess)}</td>
                                <td className="px-6 py-5 font-bold text-slate-800">{formatRs(hsn.taxable + hsn.cgst + hsn.sgst + hsn.igst + hsn.cess)}</td>
                            </tr>

                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default GSTR1Dashboard;