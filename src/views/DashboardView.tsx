import React, { useEffect, useState } from 'react';
import { api } from '../services/api.ts';
import { DashboardData } from '../types/erp.ts';
import { formatDZD, formatDate } from '../utils/format.ts';
import { Badge } from '../components/common/Badge.tsx';
import { useRealtimeSync } from '../context/RealtimeSyncContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  DollarSign,
  AlertTriangle,
  Boxes,
  Users,
  CreditCard,
  Calendar,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Clock,
  Phone,
  Mail,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface DashboardViewProps {
  onNavigate: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const { pendingRequests, pendingCount, setIsJoinRequestsModalOpen, approveRequest, isLiveConnected } = useRealtimeSync();
  const isOwner = profile?.role === 'owner';

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dateFilter, setDateFilter] = useState<string>('this_month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      let start: string | undefined;
      let end: string | undefined;

      const now = new Date();
      const today = now.toISOString().split('T')[0];

      if (dateFilter === 'today') {
        start = today;
        end = today;
      } else if (dateFilter === 'yesterday') {
        const y = new Date(now);
        y.setDate(now.getDate() - 1);
        start = y.toISOString().split('T')[0];
        end = start;
      } else if (dateFilter === 'this_week') {
        const day = now.getDay() || 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - day + 1);
        start = monday.toISOString().split('T')[0];
        end = today;
      } else if (dateFilter === 'this_month') {
        start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        end = today;
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
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateFilter, customStart, customEnd]);

  // Real-time synchronization like Google Sheets (without page refresh!)
  useEffect(() => {
    const handleSync = () => {
      loadData();
    };
    window.addEventListener('an_erp_sync', handleSync);
    return () => {
      window.removeEventListener('an_erp_sync', handleSync);
    };
  }, [dateFilter, customStart, customEnd]);

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-500">Loading business analytics...</p>
        </div>
      </div>
    );
  }

  const sales = data?.sales;
  const debts = data?.debts;
  const expenses = data?.expenses;
  const profit = data?.profit;
  const ordersByStatus = data?.ordersByStatus;
  const inventory = data?.inventory;

  return (
    <div className="space-y-6">
      {/* OWNER & ADMIN ALERT: Join Requests submitted from Phone */}
      {(isOwner || profile?.role === 'admin') && pendingCount > 0 && (
        <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 animate-bounce">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                    Nouvelles Demandes d'Adhésion Commerciale ({pendingCount})
                  </h2>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Des personnes ont soumis une demande pour rejoindre votre équipe commerciale depuis leur téléphone
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsJoinRequestsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shadow-xs transition shrink-0"
            >
              <span>Gérer les Demandes</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Quick list of first 2 applicants */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            {pendingRequests.slice(0, 2).map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white border border-amber-200/80 shadow-2xs text-xs"
              >
                <div>
                  <div className="font-extrabold text-slate-900">{user.fullName}</div>
                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                    <span>{user.email}</span>
                    {user.phone && <span>• {user.phone}</span>}
                  </div>
                  {user.notes && (
                    <div className="text-[10px] text-amber-800 italic mt-0.5">"{user.notes}"</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => approveRequest(user)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition shrink-0"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Activer</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Header & Date Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Business Overview</h1>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-800">
              <span className={`h-1.5 w-1.5 rounded-full ${isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span>{isLiveConnected ? 'Live Synced' : 'Syncing...'}</span>
            </div>
          </div>
          <p className="text-sm text-slate-500">Live operational & financial metrics for An Printing</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-xs">
            {[
              { id: 'today', label: 'Today' },
              { id: 'this_week', label: 'This Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'this_year', label: 'This Year' },
              { id: 'custom', label: 'Custom' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  dateFilter === f.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadData}
            title="Refresh metrics"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {dateFilter === 'custom' && (
        <div className="flex items-center gap-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
          <span className="text-xs font-semibold text-indigo-900">Custom Date Range:</span>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700"
          />
        </div>
      )}

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Sales Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Sales</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900">{formatDZD(sales?.periodTotal)}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
              <span>Today: <strong className="text-slate-700">{formatDZD(sales?.today)}</strong></span>
              <span>•</span>
              <span>Month: <strong className="text-slate-700">{formatDZD(sales?.thisMonth)}</strong></span>
            </div>
          </div>
        </div>

        {/* Gross & Net Profit Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Est. Net Profit</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-extrabold ${(profit?.estimatedNetProfit || 0) >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
              {formatDZD(profit?.estimatedNetProfit)}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
              <span>Gross: <strong className="text-slate-700">{formatDZD(profit?.estimatedGrossProfit)}</strong></span>
              <span>•</span>
              <span>Materials: <strong className="text-slate-700">{formatDZD(profit?.materialsConsumedCost)}</strong></span>
            </div>
          </div>
        </div>

        {/* Customer Debts Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Customer Debts</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-amber-600">{formatDZD(debts?.customerOutstanding)}</div>
            <p className="mt-2 text-xs text-slate-500">Total outstanding receivables owed by clients</p>
          </div>
        </div>

        {/* Supplier Debts Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Supplier Liabilities</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-rose-600">{formatDZD(debts?.supplierOutstanding)}</div>
            <p className="mt-2 text-xs text-slate-500">Unpaid balances on raw material invoices</p>
          </div>
        </div>
      </div>

      {/* Orders Pipeline Bar & Inventory Valuation */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Order Status Breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Printing Orders Pipeline</h2>
            </div>
            <button
              onClick={() => onNavigate('orders')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              View all orders →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100">
              <span className="text-xs text-slate-500">Received / Confirmed</span>
              <div className="text-xl font-extrabold text-slate-800 mt-1">{ordersByStatus?.received || 0}</div>
            </div>
            <div className="rounded-lg bg-sky-50 p-3.5 border border-sky-100">
              <span className="text-xs text-sky-700">In Production</span>
              <div className="text-xl font-extrabold text-sky-800 mt-1">{ordersByStatus?.inProduction || 0}</div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3.5 border border-emerald-100">
              <span className="text-xs text-emerald-700">Ready for Delivery</span>
              <div className="text-xl font-extrabold text-emerald-800 mt-1">{ordersByStatus?.ready || 0}</div>
            </div>
            <div className="rounded-lg bg-indigo-50 p-3.5 border border-indigo-100">
              <span className="text-xs text-indigo-700">Delivered</span>
              <div className="text-xl font-extrabold text-indigo-800 mt-1">{ordersByStatus?.delivered || 0}</div>
            </div>
          </div>
        </div>

        {/* Inventory Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Stock Valuation</h2>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Manage stock →
            </button>
          </div>

          <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
            <span className="text-xs text-slate-500">Total Material Asset Value</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{formatDZD(inventory?.totalValuation)}</div>
            <p className="text-[11px] text-slate-400 mt-1">Based on weighted average purchase cost</p>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-700">Low-Stock Warnings:</span>
              <span className="font-bold text-rose-600">{inventory?.lowStockMaterials?.length || 0} items</span>
            </div>
            {inventory?.lowStockMaterials && inventory.lowStockMaterials.length > 0 ? (
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {inventory.lowStockMaterials.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-rose-50/70 border border-rose-100">
                    <span className="truncate max-w-[150px] font-medium text-rose-900">{m.name}</span>
                    <span className="font-mono text-[11px] text-rose-700">
                      {m.currentStock} {m.stockUnit}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-emerald-600 font-medium">All material stocks are above reorder threshold.</p>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Sales & Expenses Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Financial Performance Trends</h2>
            <p className="text-xs text-slate-500">Monthly Sales Revenue, Material Purchases, and Operating Expenses (DZD)</p>
          </div>
        </div>

        <div className="h-72 w-full">
          {data?.monthlyTrends && data.monthlyTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyTrends} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: any) => [formatDZD(Number(val)), '']}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px' }}
                />
                <Legend />
                <Bar dataKey="sales" name="Sales Revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchases" name="Material Purchases" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Operating Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              No trend data available yet.
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders & Top Customers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">Recent Printing Orders</h2>
            <button onClick={() => onNavigate('orders')} className="text-xs font-semibold text-indigo-600 hover:underline">
              View all
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {data?.recent?.orders && data.recent.orders.length > 0 ? (
              data.recent.orders.map((o) => (
                <div key={o.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-600">{o.orderNumber}</span>
                      <span className="text-xs font-semibold text-slate-800">{o.customerName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Date: {formatDate(o.orderDate)} • Due: {formatDate(o.dueDate)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900">{formatDZD(o.totalAmountDzd)}</div>
                    <div className="mt-0.5">
                      <Badge
                        variant={
                          o.status === 'delivered'
                            ? 'success'
                            : o.status === 'in_production'
                            ? 'info'
                            : o.status === 'ready_for_delivery'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {o.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No orders created yet.</p>
            )}
          </div>
        </div>

        {/* Top Customers */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">Top Customers by Revenue</h2>
            <button onClick={() => onNavigate('customers')} className="text-xs font-semibold text-indigo-600 hover:underline">
              View all
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {data?.topCustomers && data.topCustomers.length > 0 ? (
              data.topCustomers.map((c, i) => (
                <div key={c.customerId} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-800">{c.name}</div>
                      <div className="text-[11px] text-slate-400">{c.orderCount} orders recorded</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-indigo-600">{formatDZD(c.totalSales)}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No sales history yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
