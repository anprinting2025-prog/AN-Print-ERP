import React, { useEffect, useState } from 'react';
import { api } from '../services/api.ts';
import { Payment, Customer, Supplier, Order, Purchase } from '../types/erp.ts';
import { formatDZD, formatDate, exportToCSV } from '../utils/format.ts';
import { Badge } from '../components/common/Badge.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
} from 'lucide-react';

export const PaymentsView: React.FC = () => {
  const { token } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [receiptToPrint, setReceiptToPrint] = useState<Payment | null>(null);

  // Form State
  const [paymentType, setPaymentType] = useState<'customer_receipt' | 'supplier_payment'>('customer_receipt');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');
  const [amountDzd, setAmountDzd] = useState<string>('10000');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'check' | 'other'>('cash');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [payData, cData, sData, oData, pData] = await Promise.all([
        api.getPayments(),
        api.getCustomers(),
        api.getSuppliers(),
        api.getOrders(),
        api.getPurchases(),
      ]);
      setPayments(payData);
      setCustomers(cData);
      setSuppliers(sData);
      setOrders(oData);
      setPurchases(pData);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = (type: 'customer_receipt' | 'supplier_payment') => {
    setPaymentType(type);
    if (type === 'customer_receipt') {
      setSelectedCustomerId(customers.length > 0 ? customers[0].id : '');
      setSelectedOrderId('');
    } else {
      setSelectedSupplierId(suppliers.length > 0 ? suppliers[0].id : '');
      setSelectedPurchaseId('');
    }
    setAmountDzd('10000');
    setPaymentMethod('cash');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setReferenceNumber('');
    setNotes('');
    setIsAddModalOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.recordPayment(
        {
          paymentDate,
          paymentType,
          customerId: paymentType === 'customer_receipt' ? selectedCustomerId || null : null,
          supplierId: paymentType === 'supplier_payment' ? selectedSupplierId || null : null,
          orderId: paymentType === 'customer_receipt' ? selectedOrderId || null : null,
          purchaseId: paymentType === 'supplier_payment' ? selectedPurchaseId || null : null,
          amountDzd,
          paymentMethod,
          referenceNumber,
          notes,
        },
        token
      );
      setIsAddModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error recording payment');
    }
  };

  const filteredPayments = payments.filter((p) => {
    const matchSearch =
      p.paymentNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.partyName.toLowerCase().includes(search.toLowerCase()) ||
      p.referenceNumber.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || p.paymentType === typeFilter;
    return matchSearch && matchType;
  });

  // Candidate unpaid orders or purchases for allocation
  const candidateOrders = orders.filter(
    (o) =>
      (!selectedCustomerId || o.customerId === selectedCustomerId) &&
      (o.remainingBalance || 0) > 0
  );
  const candidatePurchases = purchases.filter(
    (p) =>
      (!selectedSupplierId || p.supplierId === selectedSupplierId) &&
      p.paymentStatus !== 'paid'
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Payments & Debt Settlements</h1>
          <p className="text-sm text-slate-500">
            Record customer advance and balance receipts, supplier invoice payments, and invoice allocations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleOpenAdd('customer_receipt')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs"
          >
            <ArrowDownLeft className="h-4 w-4" />
            Receive Customer Payment
          </button>
          <button
            onClick={() => handleOpenAdd('supplier_payment')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 shadow-xs"
          >
            <ArrowUpRight className="h-4 w-4" />
            Pay Supplier Invoice
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search payment #, client, or reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
          >
            <option value="all">All Payment Types</option>
            <option value="customer_receipt">Customer Receipts (Cash In)</option>
            <option value="supplier_payment">Supplier Payments (Cash Out)</option>
          </select>

          <button
            onClick={() =>
              exportToCSV(
                'an_printing_payments',
                filteredPayments.map((p) => ({
                  PaymentNumber: p.paymentNumber,
                  Date: p.paymentDate,
                  Type: p.paymentType,
                  Party: p.partyName,
                  AmountDZD: p.amountDzd,
                  Method: p.paymentMethod,
                  Reference: p.referenceNumber,
                  Notes: p.notes,
                }))
              )
            }
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Mobile Payments Cards List (Visible on Phone Screens) */}
      <div className="space-y-3 md:hidden">
        {filteredPayments.length > 0 ? (
          filteredPayments.map((p) => {
            const isReceipt = p.paymentType === 'customer_receipt';
            return (
              <div
                key={p.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-600">{p.paymentNumber}</span>
                      <Badge variant={isReceipt ? 'success' : 'danger'}>
                        {isReceipt ? 'Inflow' : 'Outflow'}
                      </Badge>
                    </div>
                    <h3 className="font-extrabold text-slate-900 text-sm mt-1">{p.partyName}</h3>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {formatDate(p.paymentDate)} • <span className="capitalize">{p.paymentMethod}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`font-black text-base ${isReceipt ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isReceipt ? '+' : '-'}{formatDZD(p.amountDzd)}
                    </div>
                    {p.referenceNumber && (
                      <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                        Ref: {p.referenceNumber}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-500">
                    {p.allocations && p.allocations.length > 0
                      ? p.allocations[0].orderId
                        ? 'Order allocated'
                        : 'Purchase invoice'
                      : 'Account balance'}
                  </span>

                  <button
                    onClick={() => setReceiptToPrint(p)}
                    className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 shadow-xs"
                  >
                    <Printer className="h-3 w-3 text-indigo-600" /> Receipt
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
            No payments recorded yet.
          </div>
        )}
      </div>

      {/* Desktop Payments Table (Hidden on Phone Screens) */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Payment # / Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Customer / Supplier</th>
                <th className="py-3 px-4 text-right">Amount (DZD)</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Reference #</th>
                <th className="py-3 px-4">Allocated Invoice</th>
                <th className="py-3 px-4 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredPayments.length > 0 ? (
                filteredPayments.map((p) => {
                  const isReceipt = p.paymentType === 'customer_receipt';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-xs font-bold text-indigo-600">{p.paymentNumber}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(p.paymentDate)}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={isReceipt ? 'success' : 'danger'}>
                          {isReceipt ? 'Customer Inflow' : 'Supplier Outflow'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900">{p.partyName}</span>
                      </td>
                      <td className={`py-3.5 px-4 text-right font-bold text-sm ${isReceipt ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isReceipt ? '+' : '-'}{formatDZD(p.amountDzd)}
                      </td>
                      <td className="py-3.5 px-4 capitalize text-slate-700">
                        {p.paymentMethod.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {p.referenceNumber || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        {p.allocations && p.allocations.length > 0 ? (
                          <div className="font-mono text-[11px] text-indigo-600">
                            {p.allocations[0].orderId ? 'Order allocated' : 'Purchase allocated'}
                          </div>
                        ) : (
                          <span className="text-slate-400">Account balance</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setReceiptToPrint(p)}
                          className="rounded border border-slate-200 bg-white p-1 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 shadow-xs"
                          title="Print official payment receipt"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No payment transactions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={paymentType === 'customer_receipt' ? 'Record Customer Payment Receipt' : 'Record Supplier Invoice Payment'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitPayment} className="space-y-4">
          <div className="flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setPaymentType('customer_receipt')}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                paymentType === 'customer_receipt'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Customer Receipt (Receivable)
            </button>
            <button
              type="button"
              onClick={() => setPaymentType('supplier_payment')}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                paymentType === 'supplier_payment'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Supplier Payment (Liability)
            </button>
          </div>

          {paymentType === 'customer_receipt' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Customer *</label>
              <select
                required
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.shopName ? `(${c.shopName})` : ''} - Debt: {formatDZD(c.outstandingBalance)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier *</label>
              <select
                required
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} - Owed: {formatDZD(s.outstandingBalance)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Optional specific invoice allocation */}
          {paymentType === 'customer_receipt' && candidateOrders.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Allocate against specific Order (Optional)
              </label>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              >
                <option value="">-- Apply to general customer balance --</option>
                {candidateOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} (Total: {formatDZD(o.totalAmountDzd)}, Remaining: {formatDZD(o.remainingBalance)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {paymentType === 'supplier_payment' && candidatePurchases.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Allocate against Purchase Invoice (Optional)
              </label>
              <select
                value={selectedPurchaseId}
                onChange={(e) => setSelectedPurchaseId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              >
                <option value="">-- Apply to general supplier balance --</option>
                {candidatePurchases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.purchaseNumber} (Invoice: {formatDZD(p.totalAmountDzd)}, Paid: {formatDZD(p.amountPaidDzd)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Amount (DZD) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={amountDzd}
                onChange={(e) => setAmountDzd(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              >
                <option value="cash">Cash (Espèces)</option>
                <option value="bank_transfer">Bank Transfer (Virement)</option>
                <option value="check">Check (Chèque)</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt / Ref #</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                placeholder="e.g. REC-1029 / Chèque #8821"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="e.g. 50% deposit received at order confirmation"
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
              className={`px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs ${
                paymentType === 'customer_receipt'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              Confirm Payment
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Payment Receipt Modal */}
      <Modal
        isOpen={!!receiptToPrint}
        onClose={() => setReceiptToPrint(null)}
        title={`Reçu de Paiement: ${receiptToPrint?.paymentNumber || ''}`}
        maxWidth="md"
      >
        {receiptToPrint && (
          <div className="space-y-4">
            <div className="text-center border-b pb-3 border-slate-200">
              <h3 className="text-lg font-black text-slate-900">An Printing</h3>
              <p className="text-xs text-slate-500">Impression sur Sacs Plastique, Carton & TNT</p>
              <p className="text-[11px] text-slate-400">Alger, Algérie • Tél: +213 555 12 34 56</p>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">N° Reçu:</span>
                <span className="font-mono font-bold text-slate-900">{receiptToPrint.paymentNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-medium text-slate-800">{formatDate(receiptToPrint.paymentDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bénéficiaire / Client:</span>
                <span className="font-bold text-slate-900">{receiptToPrint.partyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mode de règlement:</span>
                <span className="font-medium capitalize text-slate-800">{receiptToPrint.paymentMethod}</span>
              </div>
              {receiptToPrint.referenceNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Réf / N° Chèque:</span>
                  <span className="font-mono text-slate-800">{receiptToPrint.referenceNumber}</span>
                </div>
              )}
            </div>

            <div className="text-center py-2 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="text-xs text-emerald-700 block">Montant Encaissé:</span>
              <span className="text-2xl font-black text-emerald-800">{formatDZD(receiptToPrint.amountDzd)}</span>
            </div>

            {receiptToPrint.notes && (
              <p className="text-xs text-slate-500 italic">Notes: {receiptToPrint.notes}</p>
            )}

            <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                <Printer className="h-4 w-4" /> Imprimer Reçu
              </button>
              <button
                onClick={() => setReceiptToPrint(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
