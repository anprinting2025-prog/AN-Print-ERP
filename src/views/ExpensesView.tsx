import React, { useEffect, useState } from 'react';
import { api } from '../services/api.ts';
import { Expense, ExpenseCategory } from '../types/erp.ts';
import { formatDZD, formatDate, exportToCSV } from '../utils/format.ts';
import { Badge } from '../components/common/Badge.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Download,
  Trash2,
  Tag,
  DollarSign,
  AlertCircle,
  Pencil,
} from 'lucide-react';

export const ExpensesView: React.FC = () => {
  const { token, profile } = useAuth();
  const isOwner = profile?.role === 'owner';

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form State (New)
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [amountDzd, setAmountDzd] = useState<string>('5000');
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'check' | 'other'>('cash');
  const [paidTo, setPaidTo] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [isPaid, setIsPaid] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');

  // Form State (Edit)
  const [editCategoryId, setEditCategoryId] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editAmountDzd, setEditAmountDzd] = useState<string>('5000');
  const [editExpenseDate, setEditExpenseDate] = useState<string>('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'cash' | 'bank_transfer' | 'check' | 'other'>('cash');
  const [editPaidTo, setEditPaidTo] = useState<string>('');
  const [editReferenceNumber, setEditReferenceNumber] = useState<string>('');
  const [editIsPaid, setEditIsPaid] = useState<boolean>(true);
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  // New Category State
  const [newCategoryName, setNewCategoryName] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [expData, catData] = await Promise.all([
        api.getExpenses(),
        api.getExpenseCategories(),
      ]);
      setExpenses(expData);
      setCategories(catData);
      if (catData.length > 0 && !categoryId) {
        setCategoryId(catData[0].id);
      }
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setDescription('');
    setAmountDzd('5000');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('cash');
    setPaidTo('');
    setReferenceNumber('');
    setIsPaid(true);
    setNotes('');
    setIsAddModalOpen(true);
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createExpense(
        {
          categoryId,
          description,
          amountDzd,
          expenseDate,
          paymentMethod,
          paidTo,
          referenceNumber,
          isPaid,
          notes,
        },
        token
      );
      setIsAddModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error recording expense');
    }
  };

  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setEditCategoryId(exp.categoryId || (categories.length > 0 ? categories[0].id : ''));
    setEditDescription(exp.description || '');
    setEditAmountDzd(String(parseFloat(exp.amountDzd || '0')));
    setEditExpenseDate(exp.expenseDate || new Date().toISOString().split('T')[0]);
    setEditPaymentMethod((exp.paymentMethod as any) || 'cash');
    setEditPaidTo(exp.paidTo || '');
    setEditReferenceNumber(exp.referenceNumber || '');
    setEditIsPaid(exp.isPaid ?? true);
    setEditNotes(exp.notes || '');
    setIsEditModalOpen(true);
  };

  const handleSubmitEditExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    try {
      setIsSubmittingEdit(true);
      await api.updateExpense(
        editingExpense.id,
        {
          categoryId: editCategoryId,
          description: editDescription,
          amountDzd: editAmountDzd,
          expenseDate: editExpenseDate,
          paymentMethod: editPaymentMethod,
          paidTo: editPaidTo,
          referenceNumber: editReferenceNumber,
          isPaid: editIsPaid,
          notes: editNotes,
        },
        token
      );
      setIsEditModalOpen(false);
      setEditingExpense(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating expense');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName) return;
    try {
      await api.createExpenseCategory(newCategoryName, token);
      setNewCategoryName('');
      setIsCategoryModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error creating category');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!isOwner) return;
    const confirmed = window.confirm('Are you sure you want to delete this expense record?');
    if (!confirmed) return;
    try {
      await api.deleteExpense(id, token);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error deleting expense');
    }
  };

  const filteredExpenses = expenses.filter((e) => {
    const matchSearch =
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.expenseNumber.toLowerCase().includes(search.toLowerCase()) ||
      e.paidTo.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategoryFilter === 'all' || e.categoryId === selectedCategoryFilter;
    return matchSearch && matchCat;
  });

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amountDzd || '0'), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Operating Expenses</h1>
          <p className="text-sm text-slate-500">
            Workshop overheads, electricity, rent, maintenance, and salaries (distinct from raw materials)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isOwner && (
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
            >
              <Tag className="h-4 w-4 text-indigo-600" />
              New Category
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Record Expense
          </button>
        </div>
      </div>

      {/* Info Notice on Expense Distinction */}
      <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4 text-xs text-sky-900 flex items-center justify-between">
        <div>
          <strong>Accounting Principle:</strong> Raw material purchases (blank bags, inks, thinners) are tracked under <strong>Purchases & Inventory</strong> and deducted as cost of goods sold. Operating expenses here represent facility and overhead costs to avoid double-counting.
        </div>
        <div className="text-right pl-4 font-bold text-slate-900 whitespace-nowrap">
          Total: {formatDZD(totalFiltered)}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search description, recipient, or expense #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
          >
            <option value="all">All Expense Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            onClick={() =>
              exportToCSV(
                'an_printing_expenses',
                filteredExpenses.map((e) => ({
                  ExpenseNumber: e.expenseNumber,
                  Date: e.expenseDate,
                  Category: e.categoryName,
                  Description: e.description,
                  AmountDZD: e.amountDzd,
                  PaymentMethod: e.paymentMethod,
                  PaidTo: e.paidTo,
                  Reference: e.referenceNumber,
                  Status: e.isPaid ? 'Paid' : 'Unpaid',
                }))
              )
            }
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Mobile Expenses Cards List (Visible on Phone Screens) */}
      <div className="space-y-3 md:hidden">
        {filteredExpenses.length > 0 ? (
          filteredExpenses.map((e) => (
            <div
              key={e.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2.5 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-600">{e.expenseNumber}</span>
                    <Badge variant="neutral">{e.categoryName}</Badge>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mt-1">{e.description}</h3>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {formatDate(e.expenseDate)} {e.paidTo && `• Paid to: ${e.paidTo}`}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-black text-sm text-slate-900">{formatDZD(e.amountDzd)}</div>
                  <Badge variant={e.isPaid ? 'success' : 'warning'}>
                    {e.isPaid ? 'Paid' : 'Unpaid'}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleOpenEdit(e)}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 shadow-xs"
                >
                  <Pencil className="h-3.5 w-3.5 text-indigo-600" /> Modifier
                </button>
                {isOwner && (
                  <button
                    onClick={() => handleDeleteExpense(e.id)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 flex items-center gap-1 shadow-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
            No operating expenses recorded.
          </div>
        )}
      </div>

      {/* Desktop Expenses Table (Hidden on Phone Screens) */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Expense # / Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Amount (DZD)</th>
                <th className="py-3 px-4">Paid To</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-xs font-bold text-indigo-600">{e.expenseNumber}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(e.expenseDate)}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="neutral">{e.categoryName}</Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{e.description}</div>
                      {e.notes && <div className="text-[11px] text-slate-400 mt-0.5">{e.notes}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-sm text-slate-900">
                      {formatDZD(e.amountDzd)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">{e.paidTo || '—'}</td>
                    <td className="py-3.5 px-4 capitalize text-slate-600">{e.paymentMethod}</td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge variant={e.isPaid ? 'success' : 'warning'}>
                        {e.isPaid ? 'Paid' : 'Unpaid Liability'}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(e)}
                          className="rounded p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                          title="Modifier la dépense"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => handleDeleteExpense(e.id)}
                            className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Supprimer la dépense"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No operating expenses recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Record Operating Expense"
        maxWidth="md"
      >
        <form onSubmit={handleSubmitExpense} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Category *</label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description *</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="e.g. Sonelgaz electricity bill for March 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (DZD) *</label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Date *</label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Paid To / Provider</label>
              <input
                type="text"
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                placeholder="e.g. Sonelgaz / Landlord / Algérie Télécom"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt / Facture Ref</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                placeholder="e.g. FACT-4091"
              />
            </div>
            <div className="pt-4">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPaid}
                  onChange={(e) => setIsPaid(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 h-4 w-4"
                />
                <span>Already Paid from Cashbox/Bank</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
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
              Record Expense
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Custom Category Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Add Expense Category"
        maxWidth="sm"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name *</label>
            <input
              type="text"
              required
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="e.g. Workshop Tool Replacement"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
            >
              Add Category
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Expense Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingExpense(null);
        }}
        title={`Modifier la Dépense : ${editingExpense?.expenseNumber || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleSubmitEditExpense} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catégorie de Dépense *</label>
            <select
              required
              value={editCategoryId}
              onChange={(e) => setEditCategoryId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description *</label>
            <input
              type="text"
              required
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="ex: Facture électricité Sonelgaz atelier"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Montant (DZD) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={editAmountDzd}
                onChange={(e) => setEditAmountDzd(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={editExpenseDate}
                onChange={(e) => setEditExpenseDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mode de Paiement</label>
              <select
                value={editPaymentMethod}
                onChange={(e) => setEditPaymentMethod(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              >
                <option value="cash">Espèces (Caisse)</option>
                <option value="bank_transfer">Virement Bancaire</option>
                <option value="check">Chèque</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bénéficiaire / Payé à</label>
              <input
                type="text"
                value={editPaidTo}
                onChange={(e) => setEditPaidTo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                placeholder="ex: Sonelgaz / Propriétaire"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Numéro de Reçu / Référence</label>
            <input
              type="text"
              value={editReferenceNumber}
              onChange={(e) => setEditReferenceNumber(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="ex: FACT-9871"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="editIsPaid"
              checked={editIsPaid}
              onChange={(e) => setEditIsPaid(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="editIsPaid" className="text-xs font-medium text-slate-700">
              Déjà réglé (Dépense payée)
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes Additionnelles</label>
            <textarea
              rows={2}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="Remarques éventuelles..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingExpense(null);
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
              {isSubmittingEdit ? 'Enregistrement...' : 'Enregistrer les Modifications'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
