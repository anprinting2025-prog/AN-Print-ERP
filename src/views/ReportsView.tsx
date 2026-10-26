import React, { useEffect, useState } from 'react';
import { api } from '../services/api.ts';
import { DashboardData } from '../types/erp.ts';
import { formatDZD, formatDate, exportToCSV } from '../utils/format.ts';
import { Badge } from '../components/common/Badge.tsx';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  DollarSign,
  TrendingUp,
  Boxes,
  Users,
  CreditCard,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dateFilter, setDateFilter] = useState<string>('this_month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      let start: string | undefined;
      let end: string | undefined;

      if (dateFilter === 'this_month') {
        start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        end = today;
      } else if (dateFilter === 'last_month') {
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        start = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
        end = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${lastDay}`;
      } else if (dateFilter === 'this_year') {
        start = `${now.getFullYear()}-01-01`;
        end = today;
      } else if (dateFilter === 'custom' && customStart && customEnd) {
        start = customStart;
        end = customEnd;
      }

      const res = await api.getDashboard(start, end);
      setData(res);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateFilter, customStart, customEnd]);

  const p = data?.profit;
  const sales = data?.sales;
  const debts = data?.debts;
  const inventory = data?.inventory;

  const handleExportPnL = () => {
    if (!p) return;
    exportToCSV('an_printing_pnl_report', [
      { Category: 'Sales Revenue', AmountDZD: p.salesRevenue },
      { Category: 'Cost of Materials Consumed', AmountDZD: p.materialsConsumedCost },
      { Category: 'Estimated Gross Profit', AmountDZD: p.estimatedGrossProfit },
      { Category: 'Operating Expenses', AmountDZD: p.operatingExpenses },
      { Category: 'Estimated Net Operating Profit', AmountDZD: p.estimatedNetProfit },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Financial & Operational Reports</h1>
          <p className="text-sm text-slate-500">
            Profit and loss estimates, inventory valuation, receivables aging, and exportable ledgers
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <Printer className="h-4 w-4" /> Print Reports
          </button>
          <button
            onClick={handleExportPnL}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export P&L (CSV)
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-xs">
        <Calendar className="h-4 w-4 text-slate-400 ml-2" />
        <span className="text-xs font-bold text-slate-700">Reporting Period:</span>
        {[
          { id: 'this_month', label: 'This Month' },
          { id: 'last_month', label: 'Last Month' },
          { id: 'this_year', label: 'This Year' },
          { id: 'custom', label: 'Custom Range' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setDateFilter(f.id)}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
              dateFilter === f.id
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {f.label}
          </button>
        ))}

        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 ml-4">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded border border-slate-300 p-1 text-xs"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded border border-slate-300 p-1 text-xs"
            />
          </div>
        )}
      </div>

      {/* P&L Statement Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Estimated Profit & Loss Summary</h2>
          <p className="text-xs text-slate-500">
            Calculated from completed sales invoices, actual workshop production consumption, and recorded overhead expenses
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50 font-bold text-slate-900 text-sm">
                <td className="py-3.5 px-4">Sales Revenue (Invoiced Bags)</td>
                <td className="py-3.5 px-4 text-right text-indigo-600">
                  {formatDZD(p?.salesRevenue)}
                </td>
              </tr>

              <tr className="text-slate-700">
                <td className="py-3 px-4 pl-8">
                  <div className="font-medium text-slate-800">Less: Direct Materials Consumed</div>
                  <div className="text-[11px] text-slate-400">
                    Blank plastic/carton/TNT bags + screen inks + diluent thinner from production records
                  </div>
                </td>
                <td className="py-3 px-4 text-right text-rose-600 font-mono font-medium">
                  -{formatDZD(p?.materialsConsumedCost)}
                </td>
              </tr>

              <tr className="bg-emerald-50/50 font-bold text-slate-900">
                <td className="py-3 px-4 font-semibold text-emerald-950">Estimated Gross Margin (Gross Profit)</td>
                <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">
                  {formatDZD(p?.estimatedGrossProfit)}
                </td>
              </tr>

              <tr className="text-slate-700">
                <td className="py-3 px-4 pl-8">
                  <div className="font-medium text-slate-800">Less: Operating Expenses (Overheads)</div>
                  <div className="text-[11px] text-slate-400">
                    Rent, electricity, water, salaries, maintenance, phone, and logistics
                  </div>
                </td>
                <td className="py-3 px-4 text-right text-rose-600 font-mono font-medium">
                  -{formatDZD(p?.operatingExpenses)}
                </td>
              </tr>

              <tr className="bg-indigo-50/60 font-black text-slate-900 text-base">
                <td className="py-4 px-4 text-indigo-950">Estimated Net Operating Profit</td>
                <td className={`py-4 px-4 text-right ${(p?.estimatedNetProfit || 0) >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
                  {formatDZD(p?.estimatedNetProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 border border-amber-200 text-[11px] text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <span>
            <strong>Disclaimer:</strong> This statement provides an internal operational estimate based on recorded raw material consumption and direct expenses. It is designed for workshop managerial decisions and does not constitute official tax filings or certified financial audits.
          </span>
        </div>
      </div>

      {/* Secondary Financial Summaries */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Receivables & Liabilities Aging */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900">Debt Position Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50/60 border border-amber-100">
              <div>
                <span className="text-xs font-bold text-amber-900">Total Customer Receivables</span>
                <p className="text-[11px] text-amber-700">Cash waiting to be collected from clients</p>
              </div>
              <div className="text-lg font-black text-amber-700">
                {formatDZD(debts?.customerOutstanding)}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-rose-50/60 border border-rose-100">
              <div>
                <span className="text-xs font-bold text-rose-900">Total Supplier Liabilities</span>
                <p className="text-[11px] text-rose-700">Unpaid balances for delivered raw materials</p>
              </div>
              <div className="text-lg font-black text-rose-700">
                {formatDZD(debts?.supplierOutstanding)}
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Valuation Breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900">Inventory Valuation Summary</h3>
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 text-center">
            <span className="text-xs text-slate-500">Current Material Asset Value on Hand:</span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {formatDZD(inventory?.totalValuation)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {inventory?.lowStockMaterials?.length || 0} items currently flagged as low stock
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
