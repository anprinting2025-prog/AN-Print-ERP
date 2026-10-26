import React, { useEffect, useState } from 'react';
import { api } from '../services/api.ts';
import { Order, Customer, OrderItem, OrderStatus, OrderLog } from '../types/erp.ts';
import { formatDZD, formatDate, exportToCSV, getWhatsAppUrl } from '../utils/format.ts';
import { Badge } from '../components/common/Badge.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useUndo } from '../context/UndoContext.tsx';
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Trash2,
  Calendar,
  CheckCircle,
  Truck,
  Layers,
  ArrowRight,
  Phone,
  MessageSquare,
  History,
  Clock,
  User,
  ShieldCheck,
  Send,
  MessageCircle,
  Pencil,
  AlertTriangle,
} from 'lucide-react';

export const OrdersView: React.FC = () => {
  const { token, profile } = useAuth();
  const { showUndoToast } = useUndo();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Search
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Delete & Feedback States
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Permission: Owner, Admin, or user with orders permission
  const canDeleteOrder =
    profile?.role === 'owner' ||
    profile?.role === 'admin' ||
    (Array.isArray(profile?.permissions) &&
      (profile.permissions.includes('orders') || profile.permissions.includes('all')));

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Order | null>(null);
  const [selectedOrderForLogs, setSelectedOrderForLogs] = useState<Order | null>(null);

  // Edit Order State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editCustomerId, setEditCustomerId] = useState<string>('');
  const [editWalkInName, setEditWalkInName] = useState<string>('');
  const [editOrderDate, setEditOrderDate] = useState<string>('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editChannel, setEditChannel] = useState<string>('whatsapp');
  const [editStatus, setEditStatus] = useState<OrderStatus>('new');
  const [editDiscountDzd, setEditDiscountDzd] = useState<string>('0');
  const [editDeliveryFeeDzd, setEditDeliveryFeeDzd] = useState<string>('0');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editModificationReason, setEditModificationReason] = useState<string>('');
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  // Status Change Dialog State
  const [statusChangeModal, setStatusChangeModal] = useState<{
    isOpen: boolean;
    orderId: string;
    newStatus: OrderStatus;
    note: string;
  }>({
    isOpen: false,
    orderId: '',
    newStatus: 'new',
    note: '',
  });

  // Form State
  const [customerId, setCustomerId] = useState<string>('');
  const [walkInName, setWalkInName] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>('');
  const [orderChannel, setOrderChannel] = useState<string>('whatsapp');
  const [discountDzd, setDiscountDzd] = useState<string>('0');
  const [deliveryFeeDzd, setDeliveryFeeDzd] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<OrderItem[]>([
    {
      bagType: 'plastic',
      size: '25x35',
      bagColor: 'White',
      printColors: '1 Color Gold',
      designNotes: 'Front center boutique logo with phone number and Instagram handle',
      quantityPieces: '1000',
      unitPriceDzd: '18.50',
      lineTotalDzd: '18500',
    },
  ]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [oData, cData] = await Promise.all([api.getOrders(), api.getCustomers()]);
      setOrders(oData);
      setCustomers(cData);
    } catch (err) {
      console.error('Failed to load orders:', err);
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

  const handleOpenAdd = () => {
    setCustomerId(customers.length > 0 ? customers[0].id : '');
    setWalkInName('');
    setOrderDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDueDate(d.toISOString().split('T')[0]);
    setOrderChannel('whatsapp');
    setDiscountDzd('0');
    setDeliveryFeeDzd('0');
    setNotes('');
    setItems([
      {
        bagType: 'plastic',
        size: '25x35',
        bagColor: 'White',
        printColors: '1 Color Gold',
        designNotes: 'Front boutique logo with contact details',
        quantityPieces: '1000',
        unitPriceDzd: '18.50',
        lineTotalDzd: '18500',
      },
    ]);
    setIsAddModalOpen(true);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        bagType: 'carton',
        size: '26x32',
        bagColor: 'Kraft Brown',
        printColors: '1 Color Black',
        designNotes: '',
        quantityPieces: '500',
        unitPriceDzd: '45.00',
        lineTotalDzd: '22500',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof OrderItem, val: any) => {
    const updated = [...items];
    const target = updated[index];
    (target as any)[field] = val;

    if (field === 'quantityPieces' || field === 'unitPriceDzd') {
      const q = parseFloat(target.quantityPieces || '0');
      const p = parseFloat(target.unitPriceDzd || '0');
      target.lineTotalDzd = String(Math.round(q * p));
    }

    setItems(updated);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createOrder(
        {
          customerId: customerId || null,
          customerName: walkInName,
          orderDate,
          dueDate,
          channel: orderChannel,
          discountDzd,
          deliveryFeeDzd,
          notes,
          items,
          createdByName: profile?.fullName || profile?.email?.split('@')[0] || 'Workshop Staff',
          createdByRole: profile?.role || 'owner',
        },
        token
      );
      setIsAddModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error creating order');
    }
  };

  // Open Edit Order Modal with populated order data
  const handleOpenEdit = (order: Order) => {
    setEditingOrder(order);
    setEditCustomerId(order.customerId || '');
    setEditWalkInName(order.customerId ? '' : (order.customerName || ''));
    setEditOrderDate(order.orderDate || new Date().toISOString().split('T')[0]);
    setEditDueDate(order.dueDate || '');
    setEditChannel(order.channel || 'whatsapp');
    setEditStatus(order.status || 'new');
    const parsedDisc = order.discountDzd ? String(parseFloat(order.discountDzd)) : '0';
    const parsedDeliv = order.deliveryFeeDzd ? String(parseFloat(order.deliveryFeeDzd)) : '0';
    setEditDiscountDzd(parsedDisc === 'NaN' ? '0' : parsedDisc);
    setEditDeliveryFeeDzd(parsedDeliv === 'NaN' ? '0' : parsedDeliv);
    setEditNotes(order.notes || '');
    setEditModificationReason('');

    const clonedItems: OrderItem[] = (order.items && order.items.length > 0)
      ? order.items.map((it) => ({
          bagType: it.bagType || 'plastic',
          size: it.size || '25x35',
          bagColor: it.bagColor || 'White',
          printColors: it.printColors || '1 Color Gold',
          designNotes: it.designNotes || '',
          quantityPieces: String(it.quantityPieces || '1000'),
          unitPriceDzd: String(it.unitPriceDzd || '18.50'),
          lineTotalDzd: String(it.lineTotalDzd || (parseFloat(it.quantityPieces || '0') * parseFloat(it.unitPriceDzd || '0'))),
        }))
      : [
          {
            bagType: 'plastic',
            size: '25x35',
            bagColor: 'White',
            printColors: '1 Color Gold',
            designNotes: '',
            quantityPieces: '1000',
            unitPriceDzd: '20',
            lineTotalDzd: '20000',
          },
        ];

    setEditItems(clonedItems);
    setIsEditModalOpen(true);
  };

  const handleEditAddItem = () => {
    setEditItems([
      ...editItems,
      {
        bagType: 'plastic',
        size: '25x35',
        bagColor: 'White',
        printColors: '1 Color Gold',
        designNotes: '',
        quantityPieces: '1000',
        unitPriceDzd: '20.00',
        lineTotalDzd: '20000',
      },
    ]);
  };

  const handleEditRemoveItem = (index: number) => {
    if (editItems.length <= 1) return;
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const handleEditItemChange = (index: number, field: keyof OrderItem, val: any) => {
    const updated = [...editItems];
    const target = updated[index];
    (target as any)[field] = val;

    if (field === 'quantityPieces' || field === 'unitPriceDzd') {
      const q = parseFloat(target.quantityPieces || '0');
      const p = parseFloat(target.unitPriceDzd || '0');
      target.lineTotalDzd = String(Math.round(q * p));
    }

    setEditItems(updated);
  };

  const handleSubmitEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    try {
      setIsSubmittingEdit(true);
      const selectedCust = customers.find((c) => c.id === editCustomerId);
      const resolvedCustName = editCustomerId
        ? (selectedCust ? selectedCust.name : editingOrder.customerName)
        : (editWalkInName.trim() || 'Client de passage');

      await api.updateOrder(
        editingOrder.id,
        {
          customerId: editCustomerId || null,
          customerName: resolvedCustName,
          orderDate: editOrderDate,
          dueDate: editDueDate,
          channel: editChannel,
          status: editStatus,
          discountDzd: String(numEditDiscount),
          deliveryFeeDzd: String(numEditDelivery),
          notes: editNotes,
          items: editItems,
          modificationDetails: editModificationReason.trim() || undefined,
          modifierName: profile?.fullName || profile?.email?.split('@')[0] || 'Workshop Staff',
          modifierRole: profile?.role || 'owner',
        },
        token
      );
      showUndoToast(editingOrder.id, `Commande "${editingOrder.orderNumber}" modifiée`);
      setFeedbackBanner({
        type: 'success',
        message: `Commande ${editingOrder.orderNumber} modifiée avec succès. Vous pouvez l'annuler via Undo.`,
      });
      setTimeout(() => setFeedbackBanner(null), 5000);
      setIsEditModalOpen(false);
      setEditingOrder(null);
      await loadData();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: err.message || 'Erreur lors de la modification de la commande',
      });
      setTimeout(() => setFeedbackBanner(null), 5000);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteOrder = (order: Order) => {
    setOrderToDelete(order);
  };

  const handleConfirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    try {
      setIsDeletingOrder(true);
      const res = await api.deleteOrder(orderToDelete.id, token);
      showUndoToast(orderToDelete.id, `Commande "${orderToDelete.orderNumber}" supprimée`);
      setFeedbackBanner({
        type: 'success',
        message: res.message || `Commande ${orderToDelete.orderNumber} supprimée. Cliquez sur "Undo" pour la restaurer.`,
      });
      setTimeout(() => setFeedbackBanner(null), 6000);
      setOrderToDelete(null);
      await loadData();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: err.message || 'Erreur lors de la suppression de la commande',
      });
      setTimeout(() => setFeedbackBanner(null), 6000);
    } finally {
      setIsDeletingOrder(false);
    }
  };

  const promptStatusChange = (orderId: string, newStatus: OrderStatus) => {
    setStatusChangeModal({
      isOpen: true,
      orderId,
      newStatus,
      note: '',
    });
  };

  const handleConfirmStatusChange = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const { orderId, newStatus, note } = statusChangeModal;
    try {
      await api.updateOrderStatus(
        orderId,
        newStatus,
        {
          modificationNotes: note.trim() || undefined,
          modifierName: profile?.fullName || profile?.email?.split('@')[0] || 'Workshop Staff',
          modifierRole: profile?.role || 'owner',
        },
        token
      );
      setStatusChangeModal({ isOpen: false, orderId: '', newStatus: 'new', note: '' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating order status');
    }
  };

  // Calculations for Edit order modal
  const editSubtotal = editItems.reduce((sum, it) => {
    const q = parseFloat(String(it.quantityPieces || '0').replace(/,/g, '.'));
    const p = parseFloat(String(it.unitPriceDzd || '0').replace(/,/g, '.'));
    return sum + (isNaN(q) || isNaN(p) ? 0 : q * p);
  }, 0);

  const numEditDiscount = Math.max(0, parseFloat(String(editDiscountDzd || '0').replace(/,/g, '.')) || 0);
  const numEditDelivery = Math.max(0, parseFloat(String(editDeliveryFeeDzd || '0').replace(/,/g, '.')) || 0);
  const editTotal = Math.max(0, editSubtotal - numEditDiscount + numEditDelivery);
  const editPaid = parseFloat(editingOrder?.amountPaidDzd || '0') || 0;
  const editRemaining = Math.max(0, editTotal - editPaid);

  // Calculations for new order modal
  const subtotal = items.reduce(
    (sum, it) => sum + parseFloat(it.quantityPieces || '0') * parseFloat(it.unitPriceDzd || '0'),
    0
  );
  const total = Math.max(
    0,
    subtotal - parseFloat(discountDzd || '0') + parseFloat(deliveryFeeDzd || '0')
  );

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const matchSearch =
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusBadgeVariant = (status: OrderStatus) => {
    switch (status) {
      case 'new':
        return 'neutral';
      case 'confirmed':
        return 'primary';
      case 'confirmed_phone':
        return 'info';
      case 'in_production':
        return 'warning';
      case 'ready_for_delivery':
        return 'warning';
      case 'delivered':
        return 'success';
      case 'cancelled':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const formatStatusLabel = (status: OrderStatus | string) => {
    switch (status) {
      case 'new':
        return 'New';
      case 'confirmed':
        return 'Confirmed';
      case 'confirmed_phone':
        return 'Confirmed via Phone';
      case 'in_production':
        return 'In Production';
      case 'ready_for_delivery':
        return 'Ready for Delivery';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status ? String(status).replace(/_/g, ' ') : '';
    }
  };

  const getOrderWhatsAppMessage = (order: Order) => {
    const itemsText = (order.items || [])
      .map(
        (it) =>
          `• ${it.quantityPieces} pcs Sac ${it.bagType} (${it.size}) - ${it.bagColor} - ${it.printColors}`
      )
      .join('\n');
    return `*An Printing — Fiche Commande*\nNuméro: ${order.orderNumber}\nClient: ${order.customerName}\nStatut: ${formatStatusLabel(order.status)}\n\nArticles:\n${itemsText}\n\nTotal: ${formatDZD(order.totalAmountDzd)}\nPayé: ${formatDZD(order.amountPaidDzd)}\nReste: ${formatDZD(order.remainingBalance)}\n\nMerci pour votre confiance ! (Alger, Algérie)`;
  };

  // Helper to progress to next logical status with single click
  const getNextStatus = (current: OrderStatus): OrderStatus | null => {
    const sequence: OrderStatus[] = [
      'new',
      'confirmed',
      'confirmed_phone',
      'in_production',
      'ready_for_delivery',
      'delivered',
    ];
    const idx = sequence.indexOf(current);
    if (idx >= 0 && idx < sequence.length - 1) {
      return sequence[idx + 1];
    }
    return null;
  };

  const getChannelBadge = (ch?: string) => {
    switch (ch) {
      case 'whatsapp':
        return <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">WhatsApp</span>;
      case 'messenger':
        return <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">Messenger</span>;
      case 'phone':
        return <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">Phone Call</span>;
      case 'tiktok':
        return <span className="inline-flex items-center gap-1 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">TikTok DM</span>;
      case 'instagram':
        return <span className="inline-flex items-center gap-1 rounded bg-fuchsia-50 px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-700 border border-fuchsia-200">Instagram DM</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">Walk-in</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Printing Orders & Log Audit</h1>
          <p className="text-sm text-slate-500">
            Order statuses (New, Confirmed, Phone Confirmed, In Production, Ready for Delivery), creator tracking & full modification logs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              exportToCSV(
                'an_printing_orders',
                filteredOrders.map((o) => ({
                  OrderNumber: o.orderNumber,
                  Customer: o.customerName,
                  Date: o.orderDate,
                  DueDate: o.dueDate,
                  Status: o.status,
                  CreatedBy: `${o.createdByName || 'Staff'} (${o.createdByRole || 'owner'})`,
                  Channel: o.channel || 'whatsapp',
                  TotalAmountDZD: o.totalAmountDzd,
                  AmountPaidDZD: o.amountPaidDzd,
                  RemainingBalanceDZD: o.remainingBalance,
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
            Create Printing Order
          </button>
        </div>
      </div>

      {/* Real-time Feedback & Undo Banner */}
      {feedbackBanner && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition shadow-xs ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            onClick={() => setFeedbackBanner(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search order #, customer, or creator..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
          >
            <option value="all">All Order Statuses</option>
            <option value="new">New</option>
            <option value="confirmed">Confirmed</option>
            <option value="confirmed_phone">Confirmed via Phone</option>
            <option value="in_production">In Production</option>
            <option value="ready_for_delivery">Ready for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Mobile Orders Card List (Visible on Phone Screens) */}
      <div className="space-y-3 md:hidden">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((o) => {
            const cust = customers.find((c) => c.id === o.customerId);
            const customerPhone = cust?.phone;
            const nextStatus = getNextStatus(o.status);

            return (
              <div
                key={o.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-indigo-600">{o.orderNumber}</span>
                      <Badge variant={statusBadgeVariant(o.status)}>
                        {formatStatusLabel(o.status)}
                      </Badge>
                      {getChannelBadge(o.channel)}
                    </div>

                    <h3 className="font-extrabold text-slate-900 text-sm mt-1">{o.customerName}</h3>
                    
                    {/* Creator Info */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1 font-medium">
                      <User className="h-3 w-3 text-indigo-500" />
                      <span>Created by:</span>
                      <strong className="text-slate-700">{o.createdByName || 'Staff'}</strong>
                      <span className="text-[10px] px-1 py-0.2 bg-slate-100 rounded text-slate-600">
                        {o.createdByRole || 'owner'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Order: {formatDate(o.orderDate)} {o.dueDate && `• Due: ${formatDate(o.dueDate)}`}
                    </div>

                    {/* Quick Phone & WhatsApp Actions */}
                    {customerPhone && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <a
                          href={`tel:${customerPhone}`}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          <Phone className="h-2.5 w-2.5 text-emerald-600" />
                          <span>{customerPhone}</span>
                        </a>
                        <a
                          href={getWhatsAppUrl(customerPhone, getOrderWhatsAppMessage(o))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                        >
                          <MessageSquare className="h-2.5 w-2.5 text-emerald-600" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="font-black text-sm text-slate-900">{formatDZD(o.totalAmountDzd)}</div>
                    {(o.remainingBalance || 0) > 0 ? (
                      <span className="text-[10px] font-bold text-rose-600">
                        Balance: {formatDZD(o.remainingBalance)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-600">Fully Paid</span>
                    )}
                  </div>
                </div>

                {/* Items summary */}
                <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 text-xs space-y-1">
                  {o.items?.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px] text-slate-700">
                      <span className="font-semibold text-indigo-700">
                        {it.quantityPieces} pcs • {it.bagType} ({it.size})
                      </span>
                      <span className="text-slate-500">{it.printColors}</span>
                    </div>
                  ))}
                </div>

                {/* Status selector & Audit Log button */}
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-[10px] font-bold text-slate-400">STATUS:</span>
                      <select
                        value={o.status}
                        onChange={(e) => promptStatusChange(o.id, e.target.value as OrderStatus)}
                        className="flex-1 rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-semibold text-slate-700"
                      >
                        <option value="new">New</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="confirmed_phone">Confirmed via Phone</option>
                        <option value="in_production">In Production</option>
                        <option value="ready_for_delivery">Ready for Delivery</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    <button
                      onClick={() => handleOpenEdit(o)}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 shadow-xs transition"
                      title="Modifier les articles, prix ou détails de cette commande"
                    >
                      <Pencil className="h-3.5 w-3.5 text-indigo-600" />
                      Modifier
                    </button>

                    <button
                      onClick={() => setSelectedOrderForLogs(o)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 shadow-xs"
                      title="View complete modification history and user log"
                    >
                      <History className="h-3.5 w-3.5" />
                      Logs ({o.logs?.length || 1})
                    </button>

                    <button
                      onClick={() => setSelectedOrderForPrint(o)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 shadow-xs"
                    >
                      <Printer className="h-3.5 w-3.5 text-indigo-600" />
                      Job Card
                    </button>

                    {canDeleteOrder && (
                      <button
                        onClick={() => handleDeleteOrder(o)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 flex items-center gap-1 shadow-xs transition"
                        title="Supprimer la commande"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* 1-Tap Thumb Advance Button */}
                  {nextStatus && (
                    <button
                      onClick={() => promptStatusChange(o.id, nextStatus)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
                    >
                      <span>Advance to:</span>
                      <span className="capitalize underline">{formatStatusLabel(nextStatus)}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
            No printing orders found.
          </div>
        )}
      </div>

      {/* Desktop Orders Table (Hidden on Mobile) */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider whitespace-nowrap text-[11px]">
                <th className="py-3 px-3">Order # / Date</th>
                <th className="py-3 px-3">Customer & Channel</th>
                <th className="py-3 px-3">Created By</th>
                <th className="py-3 px-3">Bag Items & Print Specs</th>
                <th className="py-3 px-3 text-right">Total</th>
                <th className="py-3 px-3 text-right">Paid</th>
                <th className="py-3 px-3 text-right">Balance</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Quick Status</th>
                <th className="py-3 px-3 text-center">Audit Logs</th>
                <th className="py-3 px-3 text-center">Job Card</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-mono text-xs font-bold text-indigo-600">{o.orderNumber}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Date: {formatDate(o.orderDate)}</div>
                      {o.dueDate && (
                        <div className="text-[10px] text-amber-600 font-medium">Due: {formatDate(o.dueDate)}</div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{o.customerName}</div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {getChannelBadge(o.channel)}
                        {o.customer?.phone && (
                          <span className="text-[11px] text-slate-400 font-mono">{o.customer.phone}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                          {(o.createdByName || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 text-xs">
                            {o.createdByName || 'Workshop Staff'}
                          </div>
                          <div className="text-[10px] text-slate-400 capitalize">
                            Role: {o.createdByRole || 'owner'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 min-w-[180px] max-w-xs">
                      <div className="space-y-1">
                        {o.items?.map((it, idx) => (
                          <div key={idx} className="text-[11px] text-slate-700">
                            <span className="font-semibold text-indigo-700">
                              {it.quantityPieces} pcs
                            </span>{' '}
                            • {it.bagType} ({it.size}) • {it.bagColor} / {it.printColors}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      {formatDZD(o.totalAmountDzd)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-emerald-600 whitespace-nowrap">
                      {formatDZD(o.amountPaidDzd)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-rose-600 whitespace-nowrap">
                      {formatDZD(o.remainingBalance)}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <Badge variant={statusBadgeVariant(o.status)}>
                        {formatStatusLabel(o.status)}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <select
                        value={o.status}
                        onChange={(e) => promptStatusChange(o.id, e.target.value as OrderStatus)}
                        className="rounded border border-slate-200 bg-white p-1 text-[11px] font-medium text-slate-700 focus:border-indigo-500"
                      >
                        <option value="new">New</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="confirmed_phone">Confirmed via Phone</option>
                        <option value="in_production">In Production</option>
                        <option value="ready_for_delivery">Ready for Delivery</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => setSelectedOrderForLogs(o)}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
                        title="View audit trail: who modified what & when"
                      >
                        <History className="h-3.5 w-3.5" />
                        <span>Logs</span>
                        <span className="ml-0.5 rounded-full bg-indigo-600 px-1.5 py-0.2 text-[9px] text-white font-mono">
                          {o.logs?.length || 1}
                        </span>
                      </button>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => setSelectedOrderForPrint(o)}
                        title="Print workshop job card & invoice"
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                      >
                        <Printer className="h-3.5 w-3.5 text-indigo-600" />
                        Print
                      </button>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(o)}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
                          title="Modifier les articles, prix ou détails de la commande"
                        >
                          <Pencil className="h-3.5 w-3.5 text-indigo-600" />
                          <span>Modifier</span>
                        </button>
                        {canDeleteOrder && (
                          <button
                            onClick={() => handleDeleteOrder(o)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-100 hover:border-rose-300 transition shadow-2xs"
                            title="Supprimer la commande"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Supprimer</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400">
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Log Modal */}
      <Modal
        isOpen={!!selectedOrderForLogs}
        onClose={() => setSelectedOrderForLogs(null)}
        title={`Order Audit Trail & History: ${selectedOrderForLogs?.orderNumber || ''}`}
        maxWidth="2xl"
      >
        {selectedOrderForLogs && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Client</span>
                <span className="font-extrabold text-sm text-slate-900">{selectedOrderForLogs.customerName}</span>
                <span className="text-xs text-slate-500 block">Total: {formatDZD(selectedOrderForLogs.totalAmountDzd)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Order Created By</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <User className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="font-bold text-xs text-slate-800">{selectedOrderForLogs.createdByName || 'Staff'}</span>
                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                    {selectedOrderForLogs.createdByRole || 'owner'}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Current Status</span>
                <Badge variant={statusBadgeVariant(selectedOrderForLogs.status)}>
                  {formatStatusLabel(selectedOrderForLogs.status)}
                </Badge>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-indigo-600" />
                Chronological Modification History ({selectedOrderForLogs.logs?.length || 1} Event(s))
              </h4>

              {selectedOrderForLogs.logs && selectedOrderForLogs.logs.length > 0 ? (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-100">
                  {selectedOrderForLogs.logs.map((log: OrderLog, i: number) => (
                    <div key={log.id || i} className="relative group">
                      {/* Timeline dot */}
                      <div className="absolute -left-6 top-1 h-5 w-5 rounded-full border-2 border-white bg-indigo-600 shadow-xs flex items-center justify-center text-white">
                        <History className="h-2.5 w-2.5" />
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs space-y-1.5 hover:border-indigo-200 transition">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-slate-900">{log.userName || 'Staff'}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600 capitalize">
                              {log.userRole || 'worker'}
                            </span>
                            <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.2 text-[10px] font-bold text-indigo-700">
                              {log.action}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {formatDate(log.timestamp)}
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/75 p-2 rounded-lg border border-slate-100">
                          {log.modification}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 text-center">
                  Created by {selectedOrderForLogs.createdByName || 'Staff'} on {formatDate(selectedOrderForLogs.orderDate)}.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedOrderForLogs(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Close Log
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Status Change Note Dialog */}
      <Modal
        isOpen={statusChangeModal.isOpen}
        onClose={() => setStatusChangeModal({ isOpen: false, orderId: '', newStatus: 'new', note: '' })}
        title="Confirm Order Status Modification"
        maxWidth="md"
      >
        <form onSubmit={handleConfirmStatusChange} className="space-y-4">
          <div className="rounded-lg bg-indigo-50/70 border border-indigo-100 p-3 text-xs text-indigo-900">
            You are changing status to:{' '}
            <strong className="font-bold underline uppercase">{formatStatusLabel(statusChangeModal.newStatus)}</strong>.
            This action, your name (<strong className="font-semibold">{profile?.fullName || 'Staff'}</strong>), and timestamp will be permanently logged in the order's audit trail.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Modification Note / Reason (Optional)
            </label>
            <textarea
              rows={2}
              value={statusChangeModal.note}
              onChange={(e) => setStatusChangeModal({ ...statusChangeModal, note: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="e.g. Customer called to confirm order quantity; printed plates approved"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setStatusChangeModal({ isOpen: false, orderId: '', newStatus: 'new', note: '' })}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
            >
              Confirm & Save Log
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Order Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create New Custom Bag Printing Order"
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmitOrder} className="space-y-4">
          {/* Creator notice banner */}
          <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <User className="h-4 w-4 text-indigo-600" />
              <span>Logged-in Creator:</span>
              <strong className="text-slate-900">{profile?.fullName || profile?.email || 'Workshop Staff'}</strong>
              <span className="rounded bg-indigo-100 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700 capitalize">
                {profile?.role || 'owner'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Audit trail logged automatically</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Customer</label>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  if (e.target.value) setWalkInName('');
                }}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              >
                <option value="">-- Walk-in / Unregistered Client --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.shopName ? `(${c.shopName})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {!customerId && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Walk-in Client Name *</label>
                <input
                  type="text"
                  required={!customerId}
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                  placeholder="e.g. Boutique Nadia Oran"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Order Received Via (Channel) *</label>
              <select
                value={orderChannel}
                onChange={(e) => setOrderChannel(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium"
              >
                <option value="whatsapp">WhatsApp Message</option>
                <option value="messenger">Facebook Messenger</option>
                <option value="phone">Direct Phone Call</option>
                <option value="tiktok">TikTok Direct Message (DM)</option>
                <option value="instagram">Instagram Direct Message (DM)</option>
                <option value="walk_in">In-Store / Walk-in</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Order Date *</label>
              <input
                type="date"
                required
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>
          </div>

          {/* Bag Order Items Builder */}
          <div className="border rounded-lg border-slate-200 p-3 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Bag Specifications & Printing Lines</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Bag Item Line
              </button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-white border border-slate-200 space-y-2 text-xs shadow-xs"
                >
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Bag Type</label>
                      <select
                        value={it.bagType}
                        onChange={(e) => handleItemChange(idx, 'bagType', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs"
                      >
                        <option value="plastic">Plastic (HDPE/LDPE)</option>
                        <option value="carton">Carton / Kraft</option>
                        <option value="tnt">TNT Non-Woven</option>
                        <option value="custom">Custom Bag</option>
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Size</label>
                      <select
                        value={it.size}
                        onChange={(e) => handleItemChange(idx, 'size', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs font-mono"
                      >
                        <option value="15x22">15×22 cm (Pharmacy/Small)</option>
                        <option value="23x33">23×33 cm (Medium)</option>
                        <option value="25x35">25×35 cm (Standard Boutique)</option>
                        <option value="30x40">30×40 cm (Large Retail)</option>
                        <option value="35x45">35×45 cm (Extra Large)</option>
                        <option value="custom">Custom Size</option>
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Bag Color</label>
                      <input
                        type="text"
                        value={it.bagColor}
                        onChange={(e) => handleItemChange(idx, 'bagColor', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs"
                        placeholder="White, Black, Transparent"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Print Color(s)</label>
                      <input
                        type="text"
                        value={it.printColors}
                        onChange={(e) => handleItemChange(idx, 'printColors', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs"
                        placeholder="1 Color Gold, 2 Colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Customer Logo / Design Specs</label>
                      <input
                        type="text"
                        value={it.designNotes}
                        onChange={(e) => handleItemChange(idx, 'designNotes', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs"
                        placeholder="Logo centered, phone number on bottom"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Quantity (pcs)</label>
                      <input
                        type="number"
                        required
                        value={it.quantityPieces}
                        onChange={(e) => handleItemChange(idx, 'quantityPieces', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs font-mono"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Price / pc (DZD)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={it.unitPriceDzd}
                        onChange={(e) => handleItemChange(idx, 'unitPriceDzd', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs font-mono"
                      />
                    </div>

                    <div className="col-span-2 text-right">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Line Total</label>
                      <div className="font-bold text-slate-900 pt-1">
                        {formatDZD(parseFloat(it.quantityPieces || '0') * parseFloat(it.unitPriceDzd || '0'))}
                      </div>
                    </div>

                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 mt-3"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Discount (DZD)</label>
              <input
                type="number"
                step="0.01"
                value={discountDzd}
                onChange={(e) => setDiscountDzd(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Fee (DZD)</label>
              <input
                type="number"
                step="0.01"
                value={deliveryFeeDzd}
                onChange={(e) => setDeliveryFeeDzd(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-right">
              <span className="text-xs text-slate-500">Total Order Amount:</span>
              <div className="text-xl font-black text-indigo-600">{formatDZD(total)}</div>
              <span className="text-[10px] text-slate-400">Subtotal: {formatDZD(subtotal)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">General Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="e.g. Urgent order for boutique opening event"
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
              Confirm Order
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Order Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingOrder(null);
        }}
        title={`Modifier la Commande : ${editingOrder?.orderNumber || ''}`}
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmitEditOrder} className="space-y-4">
          {/* Header banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-indigo-50 border border-indigo-200 p-2.5 text-xs">
            <div className="flex items-center gap-2 text-indigo-900">
              <Pencil className="h-4 w-4 text-indigo-600 shrink-0" />
              <span>Modification en cours par :</span>
              <strong className="text-slate-900">{profile?.fullName || profile?.email || 'Workshop Staff'}</strong>
              <span className="rounded bg-indigo-200/80 px-1.5 py-0.2 text-[10px] font-bold text-indigo-800 capitalize">
                {profile?.role || 'owner'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-indigo-200 shadow-xs">
                <span className="text-[11px] text-slate-500 font-medium">Total Commande :</span>
                <span className="font-mono font-black text-indigo-700 text-xs">{formatDZD(editTotal)}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-rose-200 shadow-xs">
                <span className="text-[11px] text-slate-500 font-medium">Reste :</span>
                <span className="font-mono font-bold text-rose-600 text-xs">{formatDZD(editRemaining)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Client Assigné</label>
              <select
                value={editCustomerId}
                onChange={(e) => {
                  setEditCustomerId(e.target.value);
                  if (e.target.value) setEditWalkInName('');
                }}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              >
                <option value="">-- Client de passage / Non enregistré --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.shopName ? `(${c.shopName})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {!editCustomerId && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nom du Client de Passage *</label>
                <input
                  type="text"
                  required={!editCustomerId}
                  value={editWalkInName}
                  onChange={(e) => setEditWalkInName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                  placeholder="ex: Boutique Nadia Oran"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Statut de la Commande</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as OrderStatus)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold text-indigo-900 bg-indigo-50/50"
              >
                <option value="new">New (Nouvelle)</option>
                <option value="confirmed">Confirmed (Confirmée)</option>
                <option value="confirmed_phone">Confirmed via Phone (Confirmée par Téléphone)</option>
                <option value="in_production">In Production (En Impression / Atelier)</option>
                <option value="ready_for_delivery">Ready for Delivery (Prête à Livrer)</option>
                <option value="delivered">Delivered (Livrée &amp; Réceptionnée)</option>
                <option value="cancelled">Cancelled (Annulée)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Canal de Réception (Canal) *</label>
              <select
                value={editChannel}
                onChange={(e) => setEditChannel(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium"
              >
                <option value="whatsapp">WhatsApp Message</option>
                <option value="messenger">Facebook Messenger</option>
                <option value="phone">Appel Téléphonique Direct</option>
                <option value="tiktok">TikTok Direct Message (DM)</option>
                <option value="instagram">Instagram Direct Message (DM)</option>
                <option value="walk_in">Sur Place / Atelier</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date de Commande *</label>
              <input
                type="date"
                required
                value={editOrderDate}
                onChange={(e) => setEditOrderDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date d'Échéance / Livraison Souhaitée</label>
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>
          </div>

          {/* Bag Order Items Builder */}
          <div className="border rounded-lg border-slate-200 p-3 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Spécifications des Sacs &amp; Impression</span>
              <button
                type="button"
                onClick={handleEditAddItem}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> + Ajouter une Ligne de Sac
              </button>
            </div>

            <div className="space-y-3">
              {editItems.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-white border border-slate-200 space-y-2 text-xs shadow-xs"
                >
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Type de Sac</label>
                      <select
                        value={it.bagType}
                        onChange={(e) => handleEditItemChange(idx, 'bagType', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs"
                      >
                        <option value="plastic">Plastique (HDPE/LDPE)</option>
                        <option value="carton">Carton / Kraft</option>
                        <option value="tnt">TNT Non-Tissé</option>
                        <option value="custom">Sac Spécial / Sur Mesure</option>
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Format / Taille</label>
                      <select
                        value={it.size}
                        onChange={(e) => handleEditItemChange(idx, 'size', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs font-mono"
                      >
                        <option value="15x22">15×22 cm (Pharmacie / Petit)</option>
                        <option value="23x33">23×33 cm (Moyen)</option>
                        <option value="25x35">25×35 cm (Standard Boutique)</option>
                        <option value="26x32">26×32 cm (Standard Carton)</option>
                        <option value="30x40">30×40 cm (Grand Retail)</option>
                        <option value="35x45">35×45 cm (Très Grand)</option>
                        <option value="40x50">40×50 cm (Maxi)</option>
                        <option value="custom">Format Personnalisé</option>
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Couleur du Sac</label>
                      <input
                        type="text"
                        value={it.bagColor || ''}
                        onChange={(e) => handleEditItemChange(idx, 'bagColor', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs"
                        placeholder="Blanc, Noir, Kraft, Transparent..."
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Couleur(s) d'Impression</label>
                      <input
                        type="text"
                        value={it.printColors || ''}
                        onChange={(e) => handleEditItemChange(idx, 'printColors', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs"
                        placeholder="1 Couleur Or, 2 Couleurs..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Instructions Logo / Cliché</label>
                      <input
                        type="text"
                        value={it.designNotes || ''}
                        onChange={(e) => handleEditItemChange(idx, 'designNotes', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs"
                        placeholder="Logo centré, coordonnées en bas"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Quantité (pcs)</label>
                      <input
                        type="number"
                        required
                        value={it.quantityPieces}
                        onChange={(e) => handleEditItemChange(idx, 'quantityPieces', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs font-mono"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Prix Unit. (DZD)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={it.unitPriceDzd}
                        onChange={(e) => handleEditItemChange(idx, 'unitPriceDzd', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs font-mono"
                      />
                    </div>

                    <div className="col-span-2 text-right">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Total Ligne</label>
                      <div className="font-bold text-slate-900 pt-1">
                        {formatDZD(parseFloat(it.quantityPieces || '0') * parseFloat(it.unitPriceDzd || '0'))}
                      </div>
                    </div>

                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => handleEditRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 mt-3"
                        title="Supprimer la ligne"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 bg-slate-50/75 p-3.5 rounded-xl border border-slate-200">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Remise Accordée (DZD)</label>
                {numEditDiscount > 0 && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-mono">
                    -{formatDZD(numEditDiscount)}
                  </span>
                )}
              </div>
              <input
                type="number"
                step="any"
                min="0"
                value={editDiscountDzd}
                onChange={(e) => setEditDiscountDzd(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-mono font-bold text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="0"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Déduit directement du sous-total</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Frais de Livraison (DZD)</label>
                {numEditDelivery > 0 && (
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded font-mono">
                    +{formatDZD(numEditDelivery)}
                  </span>
                )}
              </div>
              <input
                type="number"
                step="any"
                min="0"
                value={editDeliveryFeeDzd}
                onChange={(e) => setEditDeliveryFeeDzd(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-mono font-bold text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="0"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Ajouté aux frais de commande</span>
            </div>

            <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-1.5 shadow-xs">
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Sous-Total Articles :</span>
                <span className="font-mono font-bold text-slate-800">{formatDZD(editSubtotal)}</span>
              </div>
              {numEditDiscount > 0 && (
                <div className="flex justify-between items-center text-xs text-emerald-600">
                  <span>Remise déduite :</span>
                  <span className="font-mono font-bold">-{formatDZD(numEditDiscount)}</span>
                </div>
              )}
              {numEditDelivery > 0 && (
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>Livraison :</span>
                  <span className="font-mono font-bold">+{formatDZD(numEditDelivery)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xs border-t border-slate-200 pt-1.5 font-black">
                <span className="text-slate-900">Total Net Commande :</span>
                <span className="font-mono text-indigo-600 text-sm font-black">{formatDZD(editTotal)}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-500">
                <span>Déjà Réglé par le client :</span>
                <span className="font-mono text-emerald-600 font-bold">{formatDZD(editPaid)}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] border-t border-dashed border-slate-200 pt-1 font-bold">
                <span className="text-rose-600">Nouveau Reste à Payer :</span>
                <span className="font-mono text-rose-600 text-xs">{formatDZD(editRemaining)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes Générales &amp; Atelier</label>
              <textarea
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                placeholder="Consignes d'impression ou remarques de livraison..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motif de Modification (Enregistré dans l'Audit Log)
              </label>
              <textarea
                rows={2}
                value={editModificationReason}
                onChange={(e) => setEditModificationReason(e.target.value)}
                className="w-full rounded-lg border border-indigo-200 bg-indigo-50/30 p-2 text-xs"
                placeholder="ex: Changement de couleur d'encre demandé par le client..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingOrder(null);
              }}
              disabled={isSubmittingEdit}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmittingEdit}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmittingEdit ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Mise à jour en cours...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>Enregistrer les Modifications</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Job Card & Invoice Modal */}
      <Modal
        isOpen={!!selectedOrderForPrint}
        onClose={() => setSelectedOrderForPrint(null)}
        title={`Workshop Job Card & Invoice: ${selectedOrderForPrint?.orderNumber || ''}`}
        maxWidth="3xl"
      >
        {selectedOrderForPrint && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">An Printing</h3>
                <p className="text-xs text-slate-500">Spécialiste de l'impression sur sacs plastique, carton & TNT</p>
                <p className="text-xs text-slate-500">Zone Industrielle, Alger • Tél: +213 555 12 34 56</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-indigo-600 font-mono text-sm block">
                  {selectedOrderForPrint.orderNumber}
                </span>
                <span className="text-xs text-slate-500">Date: {formatDate(selectedOrderForPrint.orderDate)}</span>
                {selectedOrderForPrint.dueDate && (
                  <span className="text-xs text-slate-500 block">Due: {formatDate(selectedOrderForPrint.dueDate)}</span>
                )}
              </div>
            </div>

            {/* Customer Details */}
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 flex justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">CLIENT</span>
                <strong className="text-slate-800 text-sm">{selectedOrderForPrint.customerName}</strong>
                {selectedOrderForPrint.customer?.address && (
                  <div className="text-slate-500 mt-0.5">{selectedOrderForPrint.customer.address}</div>
                )}
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Order Creator:</span>
                  <strong className="text-slate-700">{selectedOrderForPrint.createdByName || 'Staff'}</strong>
                  <span className="text-[10px] text-slate-500">({selectedOrderForPrint.createdByRole || 'owner'})</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px]">STATUT PRODUCTION</span>
                <Badge variant={statusBadgeVariant(selectedOrderForPrint.status)}>
                  {formatStatusLabel(selectedOrderForPrint.status)}
                </Badge>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase">
                    <th className="py-2.5 px-3">Description Sac & Spécifications</th>
                    <th className="py-2.5 px-3">Couleurs Impression</th>
                    <th className="py-2.5 px-3 text-right">Quantité</th>
                    <th className="py-2.5 px-3 text-right">Prix Unitaire</th>
                    <th className="py-2.5 px-3 text-right">Total (DZD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {selectedOrderForPrint.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800">
                          Sac {it.bagType} ({it.size}) • Couleur: {it.bagColor}
                        </div>
                        {it.designNotes && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5">{it.designNotes}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-indigo-700">{it.printColors}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">{it.quantityPieces} pcs</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatDZD(it.unitPriceDzd)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatDZD(it.lineTotalDzd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-slate-200 pt-3 flex justify-end">
              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Sous-total:</span>
                  <span>{formatDZD(selectedOrderForPrint.subtotalDzd)}</span>
                </div>
                {parseFloat(selectedOrderForPrint.discountDzd || '0') > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Remise:</span>
                    <span>-{formatDZD(selectedOrderForPrint.discountDzd)}</span>
                  </div>
                )}
                {parseFloat(selectedOrderForPrint.deliveryFeeDzd || '0') > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Livraison:</span>
                    <span>+{formatDZD(selectedOrderForPrint.deliveryFeeDzd)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm text-slate-900 border-t pt-1.5">
                  <span>Total Commande:</span>
                  <span className="text-indigo-600">{formatDZD(selectedOrderForPrint.totalAmountDzd)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Montant Payé:</span>
                  <span className="text-emerald-600 font-semibold">{formatDZD(selectedOrderForPrint.amountPaidDzd)}</span>
                </div>
                <div className="flex justify-between font-bold text-rose-600 border-t pt-1">
                  <span>Reste à payer:</span>
                  <span>{formatDZD(selectedOrderForPrint.remainingBalance)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-between items-center gap-2 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                  <Printer className="h-4 w-4" /> Imprimer Fiche / Facture
                </button>
                <a
                  href={getWhatsAppUrl(
                    customers.find((c) => c.id === selectedOrderForPrint.customerId)?.phone,
                    getOrderWhatsAppMessage(selectedOrderForPrint)
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition"
                >
                  <MessageSquare className="h-4 w-4" /> Partager sur WhatsApp
                </a>
              </div>
              <button
                onClick={() => setSelectedOrderForPrint(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Delete Order Modal */}
      <Modal
        isOpen={!!orderToDelete}
        onClose={() => !isDeletingOrder && setOrderToDelete(null)}
        title={`Supprimer la Commande ${orderToDelete?.orderNumber || ''}`}
        maxWidth="md"
      >
        {orderToDelete && (
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <Trash2 className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
              <div className="text-xs text-rose-900 space-y-1.5">
                <div className="font-bold text-sm text-rose-900">Confirmation de suppression</div>
                <p>
                  Êtes-vous sûr de vouloir supprimer la commande{' '}
                  <span className="font-mono font-bold text-rose-950">{orderToDelete.orderNumber}</span> ({orderToDelete.customerName}) ?
                </p>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  Cette action nettoie les articles et fiches de fabrication associées.
                  <span className="block mt-1 font-bold text-indigo-700">
                    💡 Vous pourrez annuler cette suppression à tout moment via le bouton Undo (Ctrl+Z) dans la barre supérieure.
                  </span>
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingOrder}
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeletingOrder}
                onClick={handleConfirmDeleteOrder}
                className="px-4 py-2 rounded-lg bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 transition flex items-center gap-1.5 shadow-xs"
              >
                {isDeletingOrder ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Suppression en cours...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Confirmer la suppression</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
