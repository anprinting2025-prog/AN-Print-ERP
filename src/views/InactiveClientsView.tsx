import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api.ts';
import { Customer, Order } from '../types/erp.ts';
import { formatDZD, formatDate, exportToCSV, getWhatsAppUrl } from '../utils/format.ts';
import { Badge } from '../components/common/Badge.tsx';
import {
  Users,
  Clock,
  Calendar,
  AlertTriangle,
  Phone,
  MessageSquare,
  Send,
  Download,
  Search,
  Filter,
  ArrowRight,
  Plus,
  Store,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';

interface InactiveClientsViewProps {
  onNavigate?: (tab: any) => void;
}

export const InactiveClientsView: React.FC<InactiveClientsViewProps> = ({ onNavigate }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [inactivityFilter, setInactivityFilter] = useState<'all_inactive' | '30_days' | '60_days' | '90_days' | 'never_ordered'>('all_inactive');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const loadData = async () => {
    try {
      setLoading(true);
      const [cData, oData] = await Promise.all([api.getCustomers(), api.getOrders()]);
      setCustomers(cData);
      setOrders(oData);
    } catch (err) {
      console.error('Failed to load inactive clients data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => {
      loadData();
    };
    window.addEventListener('an_erp_sync', handleSync);
    return () => window.removeEventListener('an_erp_sync', handleSync);
  }, []);

  // Compute last order and days since last order for each customer
  const clientActivityList = useMemo(() => {
    const now = new Date().getTime();

    // Group orders by customerId
    const customerOrdersMap: Record<string, Order[]> = {};
    orders.forEach((o) => {
      if (o.customerId) {
        if (!customerOrdersMap[o.customerId]) customerOrdersMap[o.customerId] = [];
        customerOrdersMap[o.customerId].push(o);
      }
    });

    return customers.map((c) => {
      const custOrders = customerOrdersMap[c.id] || [];
      // Sort orders descending by orderDate
      custOrders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

      const lastOrder = custOrders[0] || null;
      let daysSinceLastOrder = Infinity;
      let lastOrderDateStr = '';

      if (lastOrder && lastOrder.orderDate) {
        const orderTime = new Date(lastOrder.orderDate).getTime();
        const diffMs = Math.max(0, now - orderTime);
        daysSinceLastOrder = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        lastOrderDateStr = lastOrder.orderDate;
      }

      return {
        customer: c,
        totalOrders: custOrders.length,
        lastOrder,
        lastOrderDateStr,
        daysSinceLastOrder,
        isNeverOrdered: custOrders.length === 0,
        isInactive30: daysSinceLastOrder >= 30,
        isInactive60: daysSinceLastOrder >= 60,
        isInactive90: daysSinceLastOrder >= 90,
      };
    });
  }, [customers, orders]);

  // Filter clients
  const filteredClients = useMemo(() => {
    return clientActivityList.filter((item) => {
      const c = item.customer;
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.shopName.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search) ||
        (c.category && c.category.toLowerCase().includes(search.toLowerCase()));

      const matchCategory = categoryFilter === 'all' || c.category === categoryFilter;

      let matchInactivity = false;
      if (inactivityFilter === 'all_inactive') {
        matchInactivity = item.daysSinceLastOrder >= 30 || item.isNeverOrdered;
      } else if (inactivityFilter === '30_days') {
        matchInactivity = item.daysSinceLastOrder >= 30 && item.daysSinceLastOrder < 60;
      } else if (inactivityFilter === '60_days') {
        matchInactivity = item.daysSinceLastOrder >= 60 && item.daysSinceLastOrder < 90;
      } else if (inactivityFilter === '90_days') {
        matchInactivity = item.daysSinceLastOrder >= 90;
      } else if (inactivityFilter === 'never_ordered') {
        matchInactivity = item.isNeverOrdered;
      }

      return matchSearch && matchCategory && matchInactivity;
    });
  }, [clientActivityList, search, inactivityFilter, categoryFilter]);

  // Overall metrics
  const countInactive30 = clientActivityList.filter((i) => i.daysSinceLastOrder >= 30 && i.daysSinceLastOrder < 60).length;
  const countInactive60 = clientActivityList.filter((i) => i.daysSinceLastOrder >= 60 && i.daysSinceLastOrder < 90).length;
  const countInactive90 = clientActivityList.filter((i) => i.daysSinceLastOrder >= 90).length;
  const countNeverOrdered = clientActivityList.filter((i) => i.isNeverOrdered).length;
  const totalInactive = clientActivityList.filter((i) => i.daysSinceLastOrder >= 30 || i.isNeverOrdered).length;

  const getReengagementMessage = (c: Customer, days: number, isNever: boolean) => {
    if (isNever) {
      return `Salam ${c.name} (${c.shopName || 'Boutique'}) ! L'équipe An Printing espère que vous allez bien. Nous serions ravis de personnaliser vos premiers sacs (plastique, kraft carton ou TNT) avec votre logo. Avez-vous un projet d'impression en cours ? N'hésitez pas ! (Alger, Algérie)`;
    }
    return `Salam ${c.name} (${c.shopName || 'Boutique'}) ! L'équipe An Printing espère que vous allez bien. Cela fait plus de ${days} jours depuis votre dernière commande de sacs personnalisés. Votre stock commence-t-il à baisser ? Nous sommes prêts à lancer votre réassort au meilleur prix.`;
  };

  const getCleanMessengerUrl = (input?: string) => {
    if (!input) return '';
    if (input.startsWith('http')) return input;
    const clean = input.replace(/^@/, '').trim();
    return `https://m.me/${clean}`;
  };

  const getCleanTikTokUrl = (input?: string) => {
    if (!input) return '';
    if (input.startsWith('http')) return input;
    const clean = input.replace(/^@/, '').trim();
    return `https://www.tiktok.com/@${clean}`;
  };

  const getCleanInstagramUrl = (input?: string) => {
    if (!input) return '';
    if (input.startsWith('http')) return input;
    const clean = input.replace(/^@/, '').trim();
    return `https://instagram.com/${clean}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="h-6 w-6 text-amber-500" />
            Client Follow-up & Inactivity Tracking
          </h1>
          <p className="text-sm text-slate-500">
            Identify clients who haven't placed an order in 1 month, 2 months, 3+ months, or never ordered, and re-engage them via WhatsApp & Messenger
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              exportToCSV(
                'inactive_clients_followup',
                filteredClients.map((item) => ({
                  CustomerName: item.customer.name,
                  ShopName: item.customer.shopName,
                  Category: item.customer.category,
                  Phone: item.customer.phone,
                  Channel: item.customer.contactChannel || 'whatsapp',
                  TotalPastOrders: item.totalOrders,
                  LastOrderDate: item.lastOrderDateStr || 'Never Ordered',
                  DaysSinceLastOrder: item.isNeverOrdered ? 'Never' : item.daysSinceLastOrder,
                  OutstandingDebt: item.customer.outstandingBalance || 0,
                }))
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <Download className="h-4 w-4" /> Export Inactive List CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <button
          onClick={() => setInactivityFilter('all_inactive')}
          className={`p-3.5 rounded-2xl border text-left transition ${
            inactivityFilter === 'all_inactive'
              ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Inactive</span>
          <div className="text-2xl font-black text-indigo-600 mt-0.5">{totalInactive}</div>
          <span className="text-[10px] text-slate-400">All 30+ days & never</span>
        </button>

        <button
          onClick={() => setInactivityFilter('30_days')}
          className={`p-3.5 rounded-2xl border text-left transition ${
            inactivityFilter === '30_days'
              ? 'border-amber-500 bg-amber-50/70 shadow-xs'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">&gt; 1 Month (30d)</span>
          <div className="text-2xl font-black text-amber-600 mt-0.5">{countInactive30}</div>
          <span className="text-[10px] text-slate-400">Between 30 & 60 days</span>
        </button>

        <button
          onClick={() => setInactivityFilter('60_days')}
          className={`p-3.5 rounded-2xl border text-left transition ${
            inactivityFilter === '60_days'
              ? 'border-orange-500 bg-orange-50/70 shadow-xs'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700 block">&gt; 2 Months (60d)</span>
          <div className="text-2xl font-black text-orange-600 mt-0.5">{countInactive60}</div>
          <span className="text-[10px] text-slate-400">Between 60 & 90 days</span>
        </button>

        <button
          onClick={() => setInactivityFilter('90_days')}
          className={`p-3.5 rounded-2xl border text-left transition ${
            inactivityFilter === '90_days'
              ? 'border-rose-500 bg-rose-50/70 shadow-xs'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">&gt; 3 Months (90d+)</span>
          <div className="text-2xl font-black text-rose-600 mt-0.5">{countInactive90}</div>
          <span className="text-[10px] text-slate-400">High risk of churn</span>
        </button>

        <button
          onClick={() => setInactivityFilter('never_ordered')}
          className={`p-3.5 rounded-2xl border text-left transition ${
            inactivityFilter === 'never_ordered'
              ? 'border-purple-600 bg-purple-50/70 shadow-xs'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">Never Ordered</span>
          <div className="text-2xl font-black text-purple-600 mt-0.5">{countNeverOrdered}</div>
          <span className="text-[10px] text-slate-400">Registered leads</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search inactive boutique, name, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={inactivityFilter}
            onChange={(e) => setInactivityFilter(e.target.value as any)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            <option value="all_inactive">All Inactive (30+ Days & Never)</option>
            <option value="30_days">Inactive &gt; 1 Month (30-59 Days)</option>
            <option value="60_days">Inactive &gt; 2 Months (60-89 Days)</option>
            <option value="90_days">Inactive &gt; 3 Months (90+ Days)</option>
            <option value="never_ordered">Never Placed Any Order</option>
          </select>
        </div>
      </div>

      {/* Mobile Inactive Client Cards */}
      <div className="space-y-3 md:hidden">
        {filteredClients.length > 0 ? (
          filteredClients.map((item) => {
            const c = item.customer;
            const msg = getReengagementMessage(c, item.daysSinceLastOrder, item.isNeverOrdered);
            const messengerUrl = getCleanMessengerUrl(c.messengerLink);

            return (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-indigo-600">{c.code}</span>
                      <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700">
                        {c.category || 'Clothing'}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-slate-900 text-sm mt-1">{c.name}</h3>
                    {c.shopName && (
                      <div className="flex items-center gap-1 text-slate-600 text-xs mt-0.5 font-medium">
                        <Store className="h-3 w-3 text-slate-400" />
                        <span>{c.shopName}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    {item.isNeverOrdered ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-black text-purple-700">
                        Never Ordered
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                        item.daysSinceLastOrder >= 90
                          ? 'bg-rose-100 text-rose-700'
                          : item.daysSinceLastOrder >= 60
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {item.daysSinceLastOrder} days ago
                      </span>
                    )}

                    <div className="text-[10px] text-slate-400 mt-1">
                      {item.isNeverOrdered ? '0 orders' : `${item.totalOrders} order(s) total`}
                    </div>
                  </div>
                </div>

                {/* Last order info */}
                {item.lastOrder && (
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 text-xs flex justify-between items-center">
                    <span className="text-slate-500">Last Order: {formatDate(item.lastOrderDateStr)}</span>
                    <span className="font-bold text-slate-800">{formatDZD(item.lastOrder.totalAmountDzd)}</span>
                  </div>
                )}

                {/* Direct 1-Tap Re-engagement Bar */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  {c.phone ? (
                    <a
                      href={getWhatsAppUrl(c.phone, msg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Re-engage on WhatsApp</span>
                    </a>
                  ) : messengerUrl ? (
                    <a
                      href={messengerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Message on Messenger</span>
                    </a>
                  ) : null}

                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100"
                    >
                      <Phone className="h-4 w-4 text-emerald-600" />
                    </a>
                  )}

                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('orders')}
                      className="rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Order
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
            No inactive clients found for this period. Great job on customer retention!
          </div>
        )}
      </div>

      {/* Desktop Inactive Clients Table */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Client / Code</th>
                <th className="py-3 px-4">Boutique & Category</th>
                <th className="py-3 px-4">Contact Phone & Channel</th>
                <th className="py-3 px-4 text-center">Inactivity Period</th>
                <th className="py-3 px-4 text-center">Past Orders</th>
                <th className="py-3 px-4">Last Order Date & Value</th>
                <th className="py-3 px-4 text-right">Outstanding Debt</th>
                <th className="py-3 px-4 text-center">Quick Re-engagement Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredClients.length > 0 ? (
                filteredClients.map((item) => {
                  const c = item.customer;
                  const msg = getReengagementMessage(c, item.daysSinceLastOrder, item.isNeverOrdered);
                  const messengerUrl = getCleanMessengerUrl(c.messengerLink);
                  const tiktokUrl = getCleanTikTokUrl(c.tiktokHandle);
                  const instagramUrl = getCleanInstagramUrl(c.instagramHandle);

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900">{c.name}</div>
                        <div className="font-mono text-[11px] text-indigo-600 font-bold mt-0.5">{c.code}</div>
                        {c.address && <div className="text-[10px] text-slate-400 truncate max-w-xs">{c.address}</div>}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{c.shopName || '—'}</div>
                        <div className="mt-1">
                          <span className="inline-flex items-center rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            {c.category || 'Clothing'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-700 font-medium">{c.phone || 'No phone'}</div>
                        <div className="mt-0.5 capitalize text-[10px] text-slate-400">
                          Prefers: {c.contactChannel || 'whatsapp'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {item.isNeverOrdered ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-[11px] font-black text-purple-700">
                            Never Ordered
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${
                            item.daysSinceLastOrder >= 90
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : item.daysSinceLastOrder >= 60
                              ? 'bg-orange-100 text-orange-700 border border-orange-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}>
                            <Clock className="h-3 w-3" />
                            {item.daysSinceLastOrder} days ago
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                        {item.totalOrders}
                      </td>

                      <td className="py-3.5 px-4">
                        {item.lastOrder ? (
                          <div>
                            <div className="font-semibold text-slate-900">{formatDate(item.lastOrderDateStr)}</div>
                            <div className="text-[11px] text-indigo-600 font-mono">
                              {formatDZD(item.lastOrder.totalAmountDzd)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No previous orders</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-amber-600">
                        {formatDZD(c.outstandingBalance)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {c.phone && (
                            <a
                              href={getWhatsAppUrl(c.phone, msg)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-2xs transition"
                              title="Send friendly 1-click WhatsApp restock follow-up"
                            >
                              <MessageSquare className="h-3 w-3" />
                              <span>WhatsApp</span>
                            </a>
                          )}

                          {messengerUrl && (
                            <a
                              href={messengerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700 shadow-2xs"
                              title="Chat on Facebook Messenger"
                            >
                              <Send className="h-3 w-3" />
                              <span>Messenger</span>
                            </a>
                          )}

                          {tiktokUrl && (
                            <a
                              href={tiktokUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-bold text-white hover:bg-slate-800"
                              title="TikTok"
                            >
                              <span>TikTok</span>
                            </a>
                          )}

                          {instagramUrl && (
                            <a
                              href={instagramUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-fuchsia-700"
                              title="Instagram"
                            >
                              <span>IG</span>
                            </a>
                          )}

                          {onNavigate && (
                            <button
                              onClick={() => onNavigate('orders')}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                              title="Create order for this client"
                            >
                              <ShoppingBag className="h-3 w-3" />
                              <span>Order</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No inactive clients found matching the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
