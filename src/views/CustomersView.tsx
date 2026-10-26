import React, { useEffect, useState } from 'react';
import { api } from '../services/api.ts';
import { Customer, Order } from '../types/erp.ts';
import { formatDZD, formatDate, exportToCSV, getWhatsAppUrl } from '../utils/format.ts';
import { Badge } from '../components/common/Badge.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Users,
  Plus,
  Search,
  Store,
  Phone,
  FileText,
  Download,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Printer,
  Edit2,
  Tag,
  Share2,
  Check,
  Send,
  ShoppingBag,
  Layers,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

const DEFAULT_CATEGORIES = [
  'Clothing',
  'Jewelry',
  'Cosmetics & Beauty',
  'Shoes & Leather',
  'Food & Bakery',
  'Phone & Tech',
  'Wholesale / General',
];

export const CustomersView: React.FC = () => {
  const { token } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  // Custom categories list with persistence
  const [categoriesList, setCategoriesList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('an_printing_customer_categories');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return DEFAULT_CATEGORIES;
  });

  const [newCategoryInput, setNewCategoryInput] = useState<string>('');
  const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [statementData, setStatementData] = useState<any>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState<boolean>(false);

  // Customer Orders Details Modal (Requirement 3)
  const [selectedCustomerForOrders, setSelectedCustomerForOrders] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loadingCustomerOrders, setLoadingCustomerOrders] = useState<boolean>(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    shopName: '',
    phone: '',
    address: '',
    category: 'Clothing',
    contactChannel: 'whatsapp' as 'whatsapp' | 'messenger' | 'phone' | 'tiktok' | 'instagram' | 'walk_in',
    messengerLink: '',
    tiktokHandle: '',
    instagramHandle: '',
    openingBalanceDzd: '0',
    creditLimitDzd: '100000',
    notes: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getCustomers();
      setCustomers(data);

      // Collect any unknown categories from database and merge
      const foundCategories = new Set(categoriesList);
      data.forEach((c) => {
        if (c.category) foundCategories.add(c.category);
      });
      setCategoriesList(Array.from(foundCategories));
    } catch (err) {
      console.error('Failed to load customers:', err);
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

  const handleAddNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCategoryInput.trim();
    if (!clean) return;
    if (!categoriesList.includes(clean)) {
      const updated = [...categoriesList, clean];
      setCategoriesList(updated);
      try {
        localStorage.setItem('an_printing_customer_categories', JSON.stringify(updated));
      } catch (e) {}
    }
    setFormData((prev) => ({ ...prev, category: clean }));
    setNewCategoryInput('');
    setIsAddingCategory(false);
  };

  const handleOpenAdd = () => {
    setFormData({
      code: `CUST-${Date.now().toString().slice(-4)}`,
      name: '',
      shopName: '',
      phone: '',
      address: '',
      category: categoriesList[0] || 'Clothing',
      contactChannel: 'whatsapp',
      messengerLink: '',
      tiktokHandle: '',
      instagramHandle: '',
      openingBalanceDzd: '0',
      creditLimitDzd: '100000',
      notes: '',
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setSelectedCustomer(c);
    setFormData({
      code: c.code,
      name: c.name,
      shopName: c.shopName || '',
      phone: c.phone || '',
      address: c.address || '',
      category: c.category || 'Clothing',
      contactChannel: (c.contactChannel as any) || 'whatsapp',
      messengerLink: c.messengerLink || '',
      tiktokHandle: c.tiktokHandle || '',
      instagramHandle: c.instagramHandle || '',
      openingBalanceDzd: c.openingBalanceDzd || '0',
      creditLimitDzd: c.creditLimitDzd || '100000',
      notes: c.notes || '',
    });
    setIsEditModalOpen(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCustomer(formData, token);
      setIsAddModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error creating customer');
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      await api.updateCustomer(selectedCustomer.id, formData, token);
      setIsEditModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating customer');
    }
  };

  const handleViewStatement = async (c: Customer) => {
    try {
      const data = await api.getCustomerStatement(c.id);
      setStatementData(data);
      setIsStatementModalOpen(true);
    } catch (err) {
      alert('Failed to load customer statement');
    }
  };

  const handleOpenCustomerOrders = async (c: Customer) => {
    setSelectedCustomerForOrders(c);
    setIsOrdersModalOpen(true);
    setLoadingCustomerOrders(true);
    try {
      const orders = await api.getCustomerOrders(c.id);
      setCustomerOrders(orders);
    } catch (err) {
      console.warn('Failed to load customer orders directly, fetching all orders:', err);
      try {
        const all = await api.getOrders();
        setCustomerOrders(all.filter((o) => o.customerId === c.id));
      } catch {
        setCustomerOrders([]);
      }
    } finally {
      setLoadingCustomerOrders(false);
    }
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

  const filteredCustomers = customers.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.shopName.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.category && c.category.toLowerCase().includes(search.toLowerCase()));

    const matchCategory = categoryFilter === 'all' || c.category === categoryFilter;
    const matchChannel = channelFilter === 'all' || c.contactChannel === channelFilter;

    return matchSearch && matchCategory && matchChannel;
  });

  const getChannelBadge = (ch?: string) => {
    switch (ch) {
      case 'whatsapp':
        return <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">WhatsApp</span>;
      case 'messenger':
        return <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">Messenger</span>;
      case 'phone':
        return <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">Phone Call</span>;
      case 'tiktok':
        return <span className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">TikTok DM</span>;
      case 'instagram':
        return <span className="inline-flex items-center gap-1 rounded bg-fuchsia-50 px-2 py-0.5 text-[11px] font-bold text-fuchsia-700 border border-fuchsia-200">Instagram DM</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Walk-in</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Customer CRM & Contact Channels</h1>
          <p className="text-sm text-slate-500">
            Boutique categories (Clothing, Jewelry, Cosmetics, etc.), custom categories, and direct WhatsApp/Messenger/TikTok links
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              exportToCSV(
                'an_printing_customers',
                filteredCustomers.map((c) => ({
                  Code: c.code,
                  Name: c.name,
                  Shop: c.shopName,
                  Phone: c.phone,
                  Category: c.category,
                  ContactChannel: c.contactChannel || 'whatsapp',
                  Messenger: c.messengerLink || '',
                  TikTok: c.tiktokHandle || '',
                  Instagram: c.instagramHandle || '',
                  TotalSales: c.totalSales,
                  TotalPayments: c.totalPayments,
                  OutstandingDebt: c.outstandingBalance,
                }))
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Filter and Category Pills */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search customer, shop name, phone, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
            >
              <option value="all">All Categories</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
            >
              <option value="all">All Channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="messenger">Messenger</option>
              <option value="phone">Phone Call</option>
              <option value="tiktok">TikTok DM</option>
              <option value="instagram">Instagram DM</option>
              <option value="walk_in">Walk-in</option>
            </select>
          </div>
        </div>

        {/* Categories Bar with Quick Add */}
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-100/80 border border-slate-200 text-xs">
          <span className="font-bold text-slate-600 px-2 flex items-center gap-1">
            <Tag className="h-3 w-3 text-indigo-600" /> Categories:
          </span>
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
              categoryFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-200'
            }`}
          >
            All ({customers.length})
          </button>
          {categoriesList.map((cat) => {
            const count = customers.filter((c) => c.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                  categoryFilter === cat ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{cat}</span>
                <span className={`text-[10px] px-1 rounded-full ${categoryFilter === cat ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}

          {isAddingCategory ? (
            <form onSubmit={handleAddNewCategory} className="flex items-center gap-1 ml-auto">
              <input
                type="text"
                autoFocus
                placeholder="Category name..."
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                className="rounded-lg border border-indigo-400 bg-white px-2 py-0.5 text-xs text-slate-800"
              />
              <button
                type="submit"
                className="rounded bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setIsAddingCategory(false)}
                className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingCategory(true)}
              className="ml-auto inline-flex items-center gap-1 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
            >
              <Plus className="h-3 w-3" /> Add Category Manually
            </button>
          )}
        </div>
      </div>

      {/* Mobile Customer Cards List (Visible on Phone Screens) */}
      <div className="space-y-3 md:hidden">
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map((c) => {
            const messengerUrl = getCleanMessengerUrl(c.messengerLink);
            const tiktokUrl = getCleanTikTokUrl(c.tiktokHandle);
            const instagramUrl = getCleanInstagramUrl(c.instagramHandle);

            return (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-indigo-600">{c.code}</span>
                      <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.2 text-[10px] font-bold text-indigo-700">
                        {c.category || 'Clothing'}
                      </span>
                      {getChannelBadge(c.contactChannel)}
                    </div>

                    <h3 className="font-extrabold text-slate-900 text-sm mt-1">{c.name}</h3>
                    {c.shopName && (
                      <div className="flex items-center gap-1 text-slate-600 text-xs mt-0.5 font-medium">
                        <Store className="h-3 w-3 text-slate-400" />
                        <span>{c.shopName}</span>
                      </div>
                    )}

                    {/* Social & Contact Direct Links */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {c.phone && (
                        <>
                          <a
                            href={`tel:${c.phone}`}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                          >
                            <Phone className="h-2.5 w-2.5 text-emerald-600" />
                            <span>{c.phone}</span>
                          </a>
                          <a
                            href={getWhatsAppUrl(
                              c.phone,
                              `*An Printing — Situation Compte*\nSalam ${c.name},\nTotal Facturé: ${formatDZD(c.totalSales)}\nTotal Réglé: ${formatDZD(c.totalPayments)}\nSolde Dû: ${formatDZD(c.outstandingBalance)}`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                          >
                            <MessageSquare className="h-2.5 w-2.5 text-emerald-600" />
                            <span>WhatsApp</span>
                          </a>
                        </>
                      )}

                      {messengerUrl && (
                        <a
                          href={messengerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
                        >
                          <Send className="h-2.5 w-2.5 text-blue-600" />
                          <span>Messenger</span>
                        </a>
                      )}

                      {tiktokUrl && (
                        <a
                          href={tiktokUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-bold text-white hover:bg-slate-800"
                        >
                          <span>TikTok</span>
                        </a>
                      )}

                      {instagramUrl && (
                        <a
                          href={instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-fuchsia-50 border border-fuchsia-200 px-2 py-1 text-[11px] font-bold text-fuchsia-700 hover:bg-fuchsia-100"
                        >
                          <span>Instagram</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">Debt Owed</span>
                    <div className="font-black text-sm text-amber-600">{formatDZD(c.outstandingBalance)}</div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {c.orderCount || 0} orders
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Invoiced: {formatDZD(c.totalSales)}</span>
                    <span className="text-emerald-700 font-semibold">Paid: {formatDZD(c.totalPayments)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenCustomerOrders(c)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-2xs transition"
                      title="View all customer orders and details"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      <span>View Orders ({c.orderCount || 0})</span>
                    </button>

                    <button
                      onClick={() => handleViewStatement(c)}
                      className="rounded-xl bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 shadow-2xs"
                    >
                      <FileText className="h-3.5 w-3.5" /> Statement
                    </button>

                    <button
                      onClick={() => handleOpenEdit(c)}
                      className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                      title="Edit Customer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
            No customers found matching filters.
          </div>
        )}
      </div>

      {/* Desktop Customers Table (Hidden on Mobile) */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Customer / Code</th>
                <th className="py-3 px-4">Boutique & Category</th>
                <th className="py-3 px-4">Contact Channel & Direct Links</th>
                <th className="py-3 px-4 text-right">Total Invoiced</th>
                <th className="py-3 px-4 text-right">Total Paid</th>
                <th className="py-3 px-4 text-right">Outstanding Debt</th>
                <th className="py-3 px-4 text-center">Orders</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((c) => {
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
                        <div className="font-medium text-slate-800">{c.shopName || '—'}</div>
                        <div className="mt-1">
                          <span className="inline-flex items-center rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            {c.category || 'Clothing'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {getChannelBadge(c.contactChannel)}
                          {c.phone && <span className="text-[11px] font-mono text-slate-500">{c.phone}</span>}
                        </div>

                        {/* Direct Clickable Action Links */}
                        <div className="flex flex-wrap items-center gap-1">
                          {c.phone && (
                            <a
                              href={getWhatsAppUrl(
                                c.phone,
                                `*An Printing — Situation Compte*\nSalam ${c.name},\nTotal Facturé: ${formatDZD(c.totalSales)}\nTotal Réglé: ${formatDZD(c.totalPayments)}\nSolde Dû: ${formatDZD(c.outstandingBalance)}`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
                              title="Chat on WhatsApp"
                            >
                              <MessageSquare className="h-3 w-3 text-emerald-600" />
                              <span>WhatsApp</span>
                            </a>
                          )}

                          {messengerUrl && (
                            <a
                              href={messengerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100"
                              title="Chat on Messenger"
                            >
                              <Send className="h-3 w-3 text-blue-600" />
                              <span>Messenger</span>
                            </a>
                          )}

                          {tiktokUrl && (
                            <a
                              href={tiktokUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-slate-800"
                              title="TikTok Profile / DM"
                            >
                              <span>TikTok</span>
                            </a>
                          )}

                          {instagramUrl && (
                            <a
                              href={instagramUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded bg-fuchsia-50 border border-fuchsia-200 px-2 py-0.5 text-[10px] font-bold text-fuchsia-700 hover:bg-fuchsia-100"
                              title="Instagram Profile / DM"
                            >
                              <span>Instagram</span>
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatDZD(c.totalSales)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-emerald-600 font-medium">
                        {formatDZD(c.totalPayments)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-amber-600">
                        {formatDZD(c.outstandingBalance)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleOpenCustomerOrders(c)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs hover:bg-indigo-100 hover:border-indigo-300 transition shadow-2xs"
                          title="View all orders, bag sizes, quantities, and prices"
                        >
                          <ShoppingBag className="h-3 w-3" />
                          <span>{c.orderCount || 0} Orders</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleOpenCustomerOrders(c)}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-700 shadow-2xs transition"
                            title="View all orders placed by this customer"
                          >
                            <ShoppingBag className="h-3 w-3" />
                            <span>Orders</span>
                          </button>
                          <button
                            onClick={() => handleViewStatement(c)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
                            title="View Financial Account Statement"
                          >
                            <FileText className="h-3 w-3" />
                            <span>Statement</span>
                          </button>
                          <button
                            onClick={() => handleOpenEdit(c)}
                            title="Edit details and channels"
                            className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition shadow-2xs"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Customer / Boutique"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                placeholder="e.g. Karim Boukhalfa"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Shop / Boutique Name</label>
              <input
                type="text"
                value={formData.shopName}
                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                placeholder="e.g. Boutique Elegance Algiers"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Boutique Category *</label>
              <div className="flex gap-1.5">
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium"
                >
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Contact Channel *</label>
              <select
                value={formData.contactChannel}
                onChange={(e) => setFormData({ ...formData, contactChannel: e.target.value as any })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium"
              >
                <option value="whatsapp">WhatsApp (Most Frequent)</option>
                <option value="messenger">Facebook Messenger</option>
                <option value="phone">Direct Phone Call</option>
                <option value="tiktok">TikTok Direct Message</option>
                <option value="instagram">Instagram Direct Message</option>
                <option value="walk_in">Walk-in Boutique Client</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-3">
            <span className="text-xs font-bold text-slate-800 block">Contact & Direct Social Links</span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">WhatsApp / Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
                  placeholder="0550 11 22 33"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Facebook Messenger Link / Username</label>
                <input
                  type="text"
                  value={formData.messengerLink}
                  onChange={(e) => setFormData({ ...formData, messengerLink: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                  placeholder="e.g. boutique.elegance or https://m.me/..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">TikTok Handle / Link</label>
                <input
                  type="text"
                  value={formData.tiktokHandle}
                  onChange={(e) => setFormData({ ...formData, tiktokHandle: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                  placeholder="@boutique_elegance"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Instagram Handle / Link</label>
                <input
                  type="text"
                  value={formData.instagramHandle}
                  onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                  placeholder="@boutique_elegance_dz"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Location / Store Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                placeholder="e.g. Didouche Mourad, Algiers"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Credit Limit (DZD)</label>
              <input
                type="number"
                step="0.01"
                value={formData.creditLimitDzd}
                onChange={(e) => setFormData({ ...formData, creditLimitDzd: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Preferences</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="e.g. Regular orders for clothing boutique, prefer gold ink on black bags"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
            >
              Save Customer
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Customer: ${selectedCustomer?.name || ''}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Full Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Shop / Boutique Name</label>
              <input
                type="text"
                value={formData.shopName}
                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium"
              >
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Channel</label>
              <select
                value={formData.contactChannel}
                onChange={(e) => setFormData({ ...formData, contactChannel: e.target.value as any })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="messenger">Facebook Messenger</option>
                <option value="phone">Direct Phone Call</option>
                <option value="tiktok">TikTok DM</option>
                <option value="instagram">Instagram DM</option>
                <option value="walk_in">Walk-in</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-3">
            <span className="text-xs font-bold text-slate-800 block">Contact & Direct Social Links</span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Phone / WhatsApp</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Messenger Username / Link</label>
                <input
                  type="text"
                  value={formData.messengerLink}
                  onChange={(e) => setFormData({ ...formData, messengerLink: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">TikTok Handle</label>
                <input
                  type="text"
                  value={formData.tiktokHandle}
                  onChange={(e) => setFormData({ ...formData, tiktokHandle: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Instagram Handle</label>
                <input
                  type="text"
                  value={formData.instagramHandle}
                  onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Store Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Credit Limit (DZD)</label>
              <input
                type="number"
                step="0.01"
                value={formData.creditLimitDzd}
                onChange={(e) => setFormData({ ...formData, creditLimitDzd: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
            >
              Update Customer
            </button>
          </div>
        </form>
      </Modal>

      {/* Customer Statement Modal (Printable) */}
      <Modal
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
        title={`Customer Statement: ${statementData?.customer?.name || ''}`}
        maxWidth="3xl"
      >
        {statementData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <div>
                <h4 className="font-extrabold text-base text-slate-900">{statementData.customer.name}</h4>
                <p className="text-xs text-slate-500">
                  {statementData.customer.shopName && `${statementData.customer.shopName} • `}
                  {statementData.customer.phone}
                </p>
                {statementData.customer.address && (
                  <p className="text-xs text-slate-400">{statementData.customer.address}</p>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500">Outstanding Receivable Balance:</span>
                <div className="text-xl font-black text-amber-600">{formatDZD(statementData.currentBalance)}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Document Reference</th>
                    <th className="py-2.5 px-3 text-right">Invoiced (Debit)</th>
                    <th className="py-2.5 px-3 text-right">Payment (Credit)</th>
                    <th className="py-2.5 px-3 text-right">Running Debt</th>
                    <th className="py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {statementData.timeline.map((row: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2 px-3 font-mono text-[11px]">{formatDate(row.date)}</td>
                      <td className="py-2 px-3 font-mono text-indigo-600 font-semibold">{row.reference}</td>
                      <td className="py-2 px-3 text-right font-medium text-slate-900">
                        {row.debit > 0 ? formatDZD(row.debit) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-emerald-600">
                        {row.credit > 0 ? formatDZD(row.credit) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {formatDZD(row.balance)}
                      </td>
                      <td className="py-2 px-3 text-slate-400 italic text-[11px] truncate max-w-xs">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                <Printer className="h-4 w-4" /> Print Customer Statement
              </button>
              <button
                onClick={() => setIsStatementModalOpen(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Customer All Orders History Modal (Requirement 3) */}
      <Modal
        isOpen={isOrdersModalOpen}
        onClose={() => setIsOrdersModalOpen(false)}
        title={`Customer Order History: ${selectedCustomerForOrders?.name || ''}`}
        maxWidth="4xl"
      >
        {selectedCustomerForOrders && (
          <div className="space-y-4">
            {/* Customer Header Info Bar */}
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                      {selectedCustomerForOrders.code}
                    </span>
                    <span className="rounded-md bg-white border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                      {selectedCustomerForOrders.category || 'Clothing'}
                    </span>
                    {getChannelBadge(selectedCustomerForOrders.contactChannel)}
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mt-1">
                    {selectedCustomerForOrders.name}
                  </h3>
                  {selectedCustomerForOrders.shopName && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                      <Store className="h-3.5 w-3.5 text-slate-400" />
                      <span>{selectedCustomerForOrders.shopName}</span>
                    </div>
                  )}
                </div>

                {/* Direct quick contact links */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedCustomerForOrders.phone && (
                    <a
                      href={getWhatsAppUrl(
                        selectedCustomerForOrders.phone,
                        `Salam ${selectedCustomerForOrders.name}, concernant vos commandes An Printing...`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-2xs"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                  {selectedCustomerForOrders.phone && (
                    <a
                      href={`tel:${selectedCustomerForOrders.phone}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
                    >
                      <Phone className="h-3.5 w-3.5 text-indigo-600" />
                      <span>{selectedCustomerForOrders.phone}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Financial & Volume Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-indigo-100/60">
                <div className="rounded-xl bg-white p-2.5 border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Orders</span>
                  <div className="text-base font-black text-indigo-600 flex items-center gap-1">
                    <ShoppingBag className="h-4 w-4" />
                    <span>{customerOrders.length}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-white p-2.5 border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Bags Ordered</span>
                  <div className="text-base font-black text-slate-900 flex items-center gap-1">
                    <Layers className="h-4 w-4 text-indigo-500" />
                    <span>
                      {customerOrders
                        .reduce(
                          (acc, o) =>
                            acc +
                            (o.items?.reduce(
                              (sum, it) => sum + parseFloat(it.quantityPieces || '0'),
                              0
                            ) || 0),
                          0
                        )
                        .toLocaleString()}{' '}
                      <span className="text-xs font-normal text-slate-500">pcs</span>
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-white p-2.5 border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Invoiced</span>
                  <div className="text-base font-black text-slate-900">
                    {formatDZD(selectedCustomerForOrders.totalSales)}
                  </div>
                </div>

                <div className="rounded-xl bg-white p-2.5 border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining Balance</span>
                  <div className="text-base font-black text-amber-600">
                    {formatDZD(selectedCustomerForOrders.outstandingBalance)}
                  </div>
                </div>
              </div>
            </div>

            {/* Orders List Container */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4 text-indigo-600" />
                  <span>All Customer Orders &amp; Bag Item Details ({customerOrders.length})</span>
                </h4>
                <span className="text-[11px] text-slate-400">Sorted by most recent</span>
              </div>

              {loadingCustomerOrders ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2"></div>
                  <p>Loading customer order records...</p>
                </div>
              ) : customerOrders.length > 0 ? (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                  {customerOrders.map((ord) => {
                    const totalPieces =
                      ord.items?.reduce(
                        (sum, it) => sum + parseFloat(it.quantityPieces || '0'),
                        0
                      ) || 0;
                    const totalAmt = parseFloat(ord.totalAmountDzd || '0');
                    const paidAmt = parseFloat(ord.amountPaidDzd || '0');
                    const remaining = Math.max(0, totalAmt - paidAmt);

                    return (
                      <div
                        key={ord.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 transition hover:border-indigo-200"
                      >
                        {/* Order Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-extrabold text-indigo-600">
                                {ord.orderNumber}
                              </span>
                              <Badge
                                variant={
                                  ord.status === 'delivered'
                                    ? 'success'
                                    : ord.status === 'in_production' || ord.status === 'ready_for_delivery'
                                    ? 'info'
                                    : ord.status === 'confirmed' || ord.status === 'confirmed_phone'
                                    ? 'warning'
                                    : ord.status === 'cancelled'
                                    ? 'danger'
                                    : 'neutral'
                                }
                              >
                                {ord.status === 'confirmed_phone'
                                  ? 'Confirmed via phone'
                                  : ord.status === 'ready_for_delivery'
                                  ? 'Ready for delivery'
                                  : ord.status.replace('_', ' ')}
                              </Badge>

                              {ord.channel && (
                                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded uppercase">
                                  {ord.channel.replace('_', ' ')}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap">
                              <span>📅 Order Date: <strong className="text-slate-700">{formatDate(ord.orderDate)}</strong></span>
                              {ord.dueDate && (
                                <span>Due: <strong className="text-slate-700">{formatDate(ord.dueDate)}</strong></span>
                              )}
                              {ord.createdByName && (
                                <span>Created by: <strong className="text-indigo-600">{ord.createdByName}</strong></span>
                              )}
                            </div>
                          </div>

                          {/* Financial summary for order */}
                          <div className="text-right sm:text-right">
                            <div className="text-base font-black text-slate-900">
                              {formatDZD(ord.totalAmountDzd)}
                            </div>
                            <div className="text-[11px]">
                              {remaining === 0 && totalAmt > 0 ? (
                                <span className="font-bold text-emerald-600">✓ Fully Paid</span>
                              ) : paidAmt > 0 ? (
                                <span className="text-amber-600 font-semibold">
                                  Paid: {formatDZD(paidAmt)} • Bal: {formatDZD(remaining)}
                                </span>
                              ) : (
                                <span className="font-bold text-rose-600">Unpaid ({formatDZD(remaining)})</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Order Items Table (Bags size, quantity, unit price, total) */}
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
                            <span>Printed Bag Specifications &amp; Quantities:</span>
                            <span className="font-mono text-indigo-600">{totalPieces.toLocaleString()} pcs total</span>
                          </div>

                          <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                                  <th className="py-2 px-3">Bag Type</th>
                                  <th className="py-2 px-3">Bag Size (Dimensions)</th>
                                  <th className="py-2 px-3">Color &amp; Printing</th>
                                  <th className="py-2 px-3 text-right">Quantity</th>
                                  <th className="py-2 px-3 text-right">Unit Price</th>
                                  <th className="py-2 px-3 text-right">Line Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-700">
                                {ord.items && ord.items.length > 0 ? (
                                  ord.items.map((it, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                                      <td className="py-2.5 px-3">
                                        <span className="font-bold capitalize text-slate-900">
                                          {it.bagType} bag
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <span className="inline-flex items-center gap-1 font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-xs">
                                          📏 {it.size} cm
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <div className="font-medium text-slate-800">
                                          {it.bagColor || 'Standard'} • {it.printColors || '1 Color'}
                                        </div>
                                        {it.designNotes && (
                                          <div className="text-[10px] text-slate-400 italic truncate max-w-xs">
                                            {it.designNotes}
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-black text-slate-900 font-mono">
                                        {parseFloat(it.quantityPieces || '0').toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">pcs</span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-medium text-slate-700 font-mono">
                                        {formatDZD(it.unitPriceDzd)}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-black text-indigo-700 font-mono">
                                        {formatDZD(it.lineTotalDzd)}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={6} className="py-3 text-center text-xs text-slate-400 italic">
                                      Standard customized bag printing package
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Order Notes / Footer */}
                        {ord.notes && (
                          <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="font-semibold text-slate-700">Order Notes: </span>
                            {ord.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-2">
                  <ShoppingBag className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">No orders placed yet by this customer</p>
                  <p className="text-xs text-slate-400">
                    When this customer orders plastic, carton, or TNT printed bags, full details will appear here.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                <Printer className="h-4 w-4" />
                <span>Print Customer Orders Report</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOrdersModalOpen(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
