import React, { useEffect, useState } from 'react';
import { api } from '../services/api.ts';
import { Material, StockMovement, MaterialCategory, TrackingMode, Purchase } from '../types/erp.ts';
import { formatDZD, formatDate, exportToCSV } from '../utils/format.ts';
import { Badge } from '../components/common/Badge.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  Download,
  AlertTriangle,
  History,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Edit2,
  PackageCheck,
  CreditCard,
  Truck,
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  FileText,
  Trash2,
} from 'lucide-react';
import { useUndo } from '../context/UndoContext.tsx';

export const InventoryView: React.FC = () => {
  const { token, profile } = useAuth();
  const { showUndoToast, undoLatest } = useUndo();
  const isOwner = profile?.role === 'owner';
  const isAdmin = profile?.role === 'admin';
  const userPerms = Array.isArray(profile?.permissions) ? profile.permissions : [];
  const canManageMaterials =
    isOwner ||
    isAdmin ||
    userPerms.includes('all') ||
    userPerms.includes('inventory') ||
    userPerms.includes('materials') ||
    !profile?.role; // Fallback so demo/preview staff can manage materials
  const isOwnerOrAdmin = canManageMaterials;

  const [materials, setMaterials] = useState<Material[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'materials' | 'movements' | 'purchases'>('materials');

  // Search & Filter
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

  // Deletion Confirmation Modals (in-app, no window.confirm)
  const [materialToDelete, setMaterialToDelete] = useState<Material | null>(null);
  const [isDeletingMaterial, setIsDeletingMaterial] = useState<boolean>(false);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState<boolean>(false);
  const [isDeletingAllMaterials, setIsDeletingAllMaterials] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Modify Purchase Payment Modal
  const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState<Purchase | null>(null);
  const [receiveStockTarget, setReceiveStockTarget] = useState<Purchase | null>(null);
  const [isReceivingStock, setIsReceivingStock] = useState<boolean>(false);
  const [stockFeedbackBanner, setStockFeedbackBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentStatus: 'unpaid' as 'unpaid' | 'partial' | 'paid',
    amountPaidDzd: '0',
    paymentMethod: 'cash',
    notes: '',
  });

  // Form states
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'blank_plastic' as MaterialCategory,
    description: '',
    trackingMode: 'dual_kg_units' as TrackingMode,
    purchaseUnit: 'kg',
    stockUnit: 'piece',
    piecesPerKg: '0',
    reorderThreshold: '300',
    unitCostDzd: '0',
    openingStockKg: '0',
    openingStockPieces: '0',
    isActive: true,
  });

  const [adjustData, setAdjustData] = useState({
    materialId: '',
    adjustmentType: 'adjustment_in' as 'adjustment_in' | 'adjustment_out',
    quantity: '100',
    unit: 'piece',
    unitCostDzd: '',
    notes: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [mats, movs, purch] = await Promise.all([
        api.getMaterials(),
        api.getStockMovements(),
        api.getPurchases(),
      ]);
      setMaterials(mats);
      setMovements(movs);
      setPurchases(purch);
    } catch (err) {
      console.error('Failed to load inventory:', err);
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
    setFormData({
      code: `MAT-${Date.now().toString().slice(-4)}`,
      name: '',
      category: 'blank_plastic',
      description: '',
      trackingMode: 'dual_kg_units',
      purchaseUnit: 'kg',
      stockUnit: 'piece',
      piecesPerKg: '0',
      reorderThreshold: '200',
      unitCostDzd: '0',
      openingStockKg: '0',
      openingStockPieces: '0',
      isActive: true,
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (m: Material) => {
    setSelectedMaterial(m);
    setFormData({
      code: m.code,
      name: m.name,
      category: m.category,
      description: m.description || '',
      trackingMode: m.trackingMode,
      purchaseUnit: m.purchaseUnit,
      stockUnit: m.stockUnit,
      piecesPerKg: m.piecesPerKg || '',
      reorderThreshold: m.reorderThreshold || '',
      unitCostDzd: m.unitCostDzd || '',
      openingStockKg: m.openingStockKg || '',
      openingStockPieces: m.openingStockPieces || '',
      isActive: m.isActive ?? true,
    });
    setIsEditModalOpen(true);
  };

  const handleOpenAdjust = (m?: Material) => {
    const target = m || materials[0];
    if (!target) return;
    setAdjustData({
      materialId: target.id,
      adjustmentType: 'adjustment_in',
      quantity: '50',
      unit: target.stockUnit,
      unitCostDzd: target.unitCostDzd,
      notes: 'Physical audit correction',
    });
    setIsAdjustModalOpen(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isBagCategory = ['blank_plastic', 'blank_carton', 'blank_tnt'].includes(formData.category);
      const stockUnit = isBagCategory ? 'piece' : (['ink', 'diluent', 'retarder'].includes(formData.category) ? 'kg' : 'piece');
      const purchaseUnit = ['ink', 'diluent', 'retarder'].includes(formData.category) ? 'kg' : (isBagCategory ? 'kg' : 'piece');
      const trackingMode = isBagCategory ? 'dual_kg_units' : 'units';

      await api.createMaterial(
        {
          code: formData.code.trim(),
          name: formData.name.trim(),
          category: formData.category,
          description: formData.description.trim(),
          trackingMode,
          purchaseUnit,
          stockUnit,
          piecesPerKg: '0',
          reorderThreshold: formData.reorderThreshold || '100',
          unitCostDzd: '0',
          openingStockKg: '0',
          openingStockPieces: '0',
        },
        token
      );
      setIsAddModalOpen(false);
      setFeedbackBanner({
        type: 'success',
        message: `Matière "${formData.name}" ajoutée au catalogue avec succès !`,
      });
      setTimeout(() => setFeedbackBanner(null), 5000);
      loadData();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: err.message || 'Error creating material',
      });
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;
    try {
      await api.updateMaterial(
        selectedMaterial.id,
        {
          ...formData,
          modifierName: profile?.fullName || 'Atelier Staff',
          modifierRole: profile?.role || 'owner',
        } as any,
        token
      );
      showUndoToast(selectedMaterial.id, `Matière "${formData.name}" modifiée`);
      setIsEditModalOpen(false);
      setFeedbackBanner({
        type: 'success',
        message: `Matière "${formData.name}" mise à jour avec succès !`,
      });
      setTimeout(() => setFeedbackBanner(null), 5000);
      loadData();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: err.message || 'Error updating material',
      });
    }
  };

  const handleOpenDelete = (m: Material) => {
    setMaterialToDelete(m);
  };

  const handleConfirmDeleteMaterial = async () => {
    if (!materialToDelete) return;
    setIsDeletingMaterial(true);
    try {
      const res = await api.deleteMaterial(materialToDelete.id, token);
      showUndoToast(materialToDelete.id, `Matière "${materialToDelete.name}" supprimée`);
      setFeedbackBanner({
        type: 'success',
        message: res.message || `Matière "${materialToDelete.name}" supprimée avec succès (Annulation possible).`,
      });
      setMaterialToDelete(null);
      await loadData();
      setTimeout(() => {
        setFeedbackBanner((prev) => (prev?.type === 'success' ? null : prev));
      }, 6000);
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: err.message || 'Erreur lors de la suppression de la matière',
      });
    } finally {
      setIsDeletingMaterial(false);
    }
  };

  const handleOpenDeleteAll = () => {
    setIsDeleteAllModalOpen(true);
  };

  const handleConfirmDeleteAll = async () => {
    if (materials.length === 0) return;
    setIsDeletingAllMaterials(true);
    try {
      const res = await api.deleteAllMaterials(token);
      showUndoToast('all', `Catalogue matières (${res.count || materials.length}) supprimé`);
      setFeedbackBanner({
        type: 'success',
        message: res.message || `Catalogue matières supprimé (${res.count || materials.length} article(s)).`,
      });
      setIsDeleteAllModalOpen(false);
      await loadData();
      setTimeout(() => {
        setFeedbackBanner((prev) => (prev?.type === 'success' ? null : prev));
      }, 6000);
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: err.message || 'Erreur lors de la suppression du catalogue',
      });
    } finally {
      setIsDeletingAllMaterials(false);
    }
  };

  const handleSubmitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.recordStockAdjustment(
        {
          materialId: adjustData.materialId,
          adjustmentType: adjustData.adjustmentType,
          quantity: parseFloat(adjustData.quantity),
          unit: adjustData.unit,
          unitCostDzd: parseFloat(adjustData.unitCostDzd || '0'),
          notes: adjustData.notes,
          modifierName: profile?.fullName || 'Atelier Staff',
        },
        token
      );
      setIsAdjustModalOpen(false);
      loadData();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: err.message || 'Error recording adjustment',
      });
    }
  };

  // Add Purchased Stock to Inventory (Receive Stock)
  const handleConfirmReceiveStock = (purchase: Purchase) => {
    if (purchase.receiptStatus === 'received') return;
    setReceiveStockTarget(purchase);
  };

  const handleExecuteReceiveStock = async () => {
    if (!receiveStockTarget) return;
    setIsReceivingStock(true);
    try {
      await api.receivePurchase(receiveStockTarget.id, token);
      setStockFeedbackBanner({
        type: 'success',
        message: `Purchased raw materials from ${receiveStockTarget.purchaseNumber} have been successfully received and added to inventory balances!`,
      });
      setTimeout(() => setStockFeedbackBanner(null), 6000);
      setReceiveStockTarget(null);
      await loadData();
    } catch (err: any) {
      setStockFeedbackBanner({
        type: 'error',
        message: err.message || 'Error adding purchased stock to inventory',
      });
    } finally {
      setIsReceivingStock(false);
    }
  };

  // Modify Purchase Payment Status & Amount Paid
  const handleOpenModifyPayment = (purchase: Purchase) => {
    setSelectedPurchaseForPayment(purchase);
    setPaymentForm({
      paymentStatus: (purchase.paymentStatus as any) || 'unpaid',
      amountPaidDzd: purchase.amountPaidDzd || '0',
      paymentMethod: 'cash',
      notes: purchase.notes || '',
    });
  };

  const handleSubmitModifyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurchaseForPayment) return;
    try {
      await api.updatePurchasePayment(
        selectedPurchaseForPayment.id,
        {
          paymentStatus: paymentForm.paymentStatus,
          amountPaidDzd: paymentForm.amountPaidDzd,
          notes: paymentForm.notes,
          paymentMethod: paymentForm.paymentMethod,
        },
        token
      );
      setSelectedPurchaseForPayment(null);
      loadData();
    } catch (err: any) {
      setStockFeedbackBanner({
        type: 'error',
        message: err.message || 'Error updating purchase invoice payment',
      });
    }
  };

  // Pending stock receipts count
  const pendingReceipts = purchases.filter((p) => p.receiptStatus === 'pending');

  // Filtered materials
  const filteredMaterials = materials.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.code.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'all' || m.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  // Filtered movements
  const filteredMovements = movements.filter((mv) => {
    if (movementTypeFilter === 'all') return true;
    return mv.movementType === movementTypeFilter;
  });

  const categoryLabels: Record<MaterialCategory, string> = {
    blank_plastic: 'Blank Plastic Bags',
    blank_carton: 'Blank Carton Bags',
    blank_tnt: 'Blank TNT Bags',
    ink: 'Printing Ink',
    diluent: 'Diluent / Thinner',
    retarder: 'Retarder Chemical',
    consumable: 'Other Consumable',
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Inventory & Stock Ledger</h1>
          <p className="text-sm text-slate-500">
            Raw materials (plastic, carton, TNT bags, inks), stock movements, and purchased stock intake
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isOwnerOrAdmin && materials.length > 0 && activeTab === 'materials' && (
            <button
              onClick={handleOpenDeleteAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 shadow-xs transition"
              title="Supprimer toutes les matières du catalogue (Annulable avec Undo)"
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
              Supprimer tout ({materials.length})
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => handleOpenAdjust()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
            >
              <Sliders className="h-4 w-4 text-indigo-600" />
              Manual Adjustment
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Add New Material
          </button>
        </div>
      </div>

      {/* Dynamic Feedback Banner with Direct Undo Action */}
      {feedbackBanner && (
        <div
          className={`rounded-xl p-3.5 text-xs flex items-center justify-between border shadow-xs transition ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'success' && (
              <button
                onClick={async () => {
                  await undoLatest();
                  await loadData();
                  setFeedbackBanner(null);
                }}
                className="inline-flex items-center gap-1 rounded bg-white px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-300 hover:bg-emerald-100 shadow-2xs transition"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Annuler (Undo)</span>
              </button>
            )}
            <button
              onClick={() => setFeedbackBanner(null)}
              className="text-xs font-bold underline opacity-75 hover:opacity-100"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Stock Reception Feedback Banner */}
      {stockFeedbackBanner && (
        <div
          className={`rounded-xl p-3.5 text-xs flex items-center justify-between border ${
            stockFeedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            {stockFeedbackBanner.type === 'success' ? (
              <PackageCheck className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            )}
            <span>{stockFeedbackBanner.message}</span>
          </div>
          <button
            onClick={() => setStockFeedbackBanner(null)}
            className="text-xs font-bold underline opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pending Receipts Alert Banner */}
      {pendingReceipts.length > 0 && activeTab !== 'purchases' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-amber-500 p-1.5 text-white">
              <Truck className="h-4 w-4" />
            </div>
            <div>
              <span className="font-extrabold text-amber-900">
                {pendingReceipts.length} Purchase Invoice(s) Pending Stock Addition
              </span>
              <p className="text-amber-700 text-[11px] mt-0.5">
                Purchased raw materials awaiting verification to enter the warehouse inventory ledger.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('purchases')}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 shadow-xs transition"
          >
            <PackageCheck className="h-3.5 w-3.5" />
            <span>View & Add to Stock</span>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('materials')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
              activeTab === 'materials'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Boxes className="h-4.5 w-4.5" />
            <span>Materials Catalog ({materials.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('purchases')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
              activeTab === 'purchases'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="h-4.5 w-4.5" />
            <span>Purchased Stock & Invoices ({purchases.length})</span>
            {pendingReceipts.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.2 text-[10px] font-bold text-white">
                {pendingReceipts.length} pending
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('movements')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
              activeTab === 'movements'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="h-4.5 w-4.5" />
            <span>Movements Ledger ({movements.length})</span>
          </button>
        </nav>
      </div>

      {/* Tab 1: Materials Catalog */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          {/* Inventory Valuation & Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Matières au Catalogue</div>
              <div className="text-lg font-black text-slate-900 mt-0.5">{materials.length} Référence(s)</div>
            </div>

            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/90 to-white p-3.5 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Valeur Totale du Stock</div>
              <div className="text-lg font-black text-indigo-900 mt-0.5">
                {formatDZD(
                  materials.reduce((acc, m) => {
                    const stock = m.currentStock || 0;
                    const unitCost = parseFloat(m.unitCostDzd || '0');
                    const piecesPerKg = parseFloat(m.piecesPerKg || '0');
                    if (['ink', 'diluent', 'retarder'].includes(m.category) || m.trackingMode === 'kg' || m.stockUnit === 'kg') {
                      return acc + stock * unitCost;
                    } else if (piecesPerKg > 0) {
                      const stockKg = stock / piecesPerKg;
                      return acc + stockKg * unitCost; // Price of Kg * current stock weight in Kg
                    } else {
                      return acc + stock * unitCost;
                    }
                  }, 0)
                )}
              </div>
              <div className="text-[10px] text-indigo-600 font-medium">Prix/Kg × Poids Réel Stock (Kg)</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Alerte Stock Bas</div>
              <div className="text-lg font-black text-amber-600 mt-0.5">
                {materials.filter((m) => (m.currentStock || 0) <= parseFloat(m.reorderThreshold || '0')).length} Matière(s)
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search material name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="all">All Categories</option>
                <option value="blank_plastic">Blank Plastic Bags</option>
                <option value="blank_carton">Blank Carton Bags</option>
                <option value="blank_tnt">Blank TNT Bags</option>
                <option value="ink">Printing Inks</option>
                <option value="diluent">Diluent / Thinner</option>
                <option value="retarder">Retarder Chemical</option>
                <option value="consumable">Other Consumables</option>
              </select>

              <button
                onClick={() =>
                  exportToCSV(
                    'an_printing_materials',
                    filteredMaterials.map((m) => ({
                      Code: m.code,
                      Name: m.name,
                      Category: m.category,
                      Stock: m.currentStock,
                      Unit: m.stockUnit,
                      PiecesPerKg: m.piecesPerKg,
                      UnitCostDZD: m.unitCostDzd,
                      ReorderThreshold: m.reorderThreshold,
                    }))
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>
          </div>

          {/* Mobile Materials Cards List */}
          <div className="space-y-3 md:hidden">
            {filteredMaterials.length > 0 ? (
              filteredMaterials.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2.5 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-600">{m.code}</span>
                        <Badge variant="neutral">{categoryLabels[m.category] || m.category}</Badge>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm mt-1">{m.name}</h3>
                    </div>

                    <div className="text-right">
                      <div className="font-black text-base text-slate-900">
                        {m.currentStock} {m.stockUnit}
                      </div>
                      {m.currentStock === 0 ? (
                        <span className="text-[10px] text-slate-400 block">En attente d'achat</span>
                      ) : (
                        m.trackingMode === 'dual_kg_units' && (
                          <div className="text-[10px] text-slate-500">
                            {parseFloat(m.piecesPerKg || '0') > 0
                              ? `≈ ${m.stockKg} kg (${m.stockPieces} pcs)`
                              : 'Selon arrivage'}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                    <span className="text-slate-500">
                      {['ink', 'diluent', 'retarder'].includes(m.category) ? (
                        <span>
                          Coût : {parseFloat(m.unitCostDzd || '0') > 0 ? (
                            <strong className="text-slate-800">{formatDZD(m.unitCostDzd)} / kg</strong>
                          ) : (
                            <span className="italic text-slate-400">Selon facture</span>
                          )}
                        </span>
                      ) : (
                        <span>
                          Prix/Kg : {parseFloat(m.unitCostDzd || '0') > 0 ? (
                            <strong className="text-slate-800">{formatDZD(m.unitCostDzd)}</strong>
                          ) : (
                            <span className="italic text-slate-400">N/A</span>
                          )}
                          {parseFloat(m.unitCostDzd || '0') > 0 && parseFloat(m.piecesPerKg || '0') > 0 && (
                            <span className="text-indigo-600 font-bold ml-2">
                              • {formatDZD(parseFloat(m.unitCostDzd || '0') / parseFloat(m.piecesPerKg))} / pc
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {isOwner && (
                        <button
                          onClick={() => handleOpenAdjust(m)}
                          className="rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-1 text-xs font-bold text-indigo-700"
                        >
                          Adjust
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEdit(m)}
                        className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:text-slate-700"
                        title="Modifier cette matière"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {isOwnerOrAdmin && (
                        <button
                          onClick={() => handleOpenDelete(m)}
                          className="rounded-lg border border-rose-200 bg-rose-50 p-1 text-rose-600 hover:bg-rose-100"
                          title="Supprimer cette matière (Annulable avec Undo)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                No materials found.
              </div>
            )}
          </div>

          {/* Desktop Materials Table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Code / Material</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Current Stock</th>
                    <th className="py-3 px-4 text-right">Dual Tracking (Kg/Pcs)</th>
                    <th className="py-3 px-4 text-right">Prix Kg / Prix Pièce</th>
                    <th className="py-3 px-4 text-center">Seuil Alerte</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredMaterials.length > 0 ? (
                    filteredMaterials.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{m.name}</div>
                          <div className="font-mono text-[11px] text-indigo-600">{m.code}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-700">
                            {categoryLabels[m.category] || m.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="font-black text-slate-900 text-sm">
                            {m.currentStock} {m.stockUnit}
                          </div>
                          {m.currentStock === 0 && (
                            <span className="inline-block mt-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              En attente d'achat
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 font-mono">
                          {m.trackingMode === 'dual_kg_units' ? (
                            parseFloat(m.piecesPerKg || '0') > 0 ? (
                              <div>
                                <span className="font-bold text-slate-800">
                                  {m.stockKg} kg ({m.stockPieces} pcs)
                                </span>
                                <div className="text-[10px] text-slate-400">
                                  {m.piecesPerKg} pcs/kg
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">
                                Selon arrivage fournisseur
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-800">
                          {['ink', 'diluent', 'retarder'].includes(m.category) ? (
                            parseFloat(m.unitCostDzd || '0') > 0 ? (
                              <span className="font-bold text-slate-900">{formatDZD(m.unitCostDzd)} / kg</span>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Selon facture</span>
                            )
                          ) : (
                            <div>
                              {parseFloat(m.unitCostDzd || '0') > 0 ? (
                                <>
                                  <div className="font-bold text-slate-900">{formatDZD(m.unitCostDzd)} / kg</div>
                                  {parseFloat(m.piecesPerKg || '0') > 0 ? (
                                    <div className="text-[11px] font-semibold text-indigo-600 mt-0.5">
                                      {formatDZD(parseFloat(m.unitCostDzd || '0') / parseFloat(m.piecesPerKg))} / pc
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-slate-400 italic">Prix pc d'après arrivage</div>
                                  )}
                                </>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">Selon facture</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-700">
                            {m.reorderThreshold} {m.stockUnit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isOwner && (
                              <button
                                onClick={() => handleOpenAdjust(m)}
                                className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                              >
                                <Sliders className="h-3 w-3" /> Adjust
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenEdit(m)}
                              className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-100"
                              title="Modifier cette matière"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            {isOwnerOrAdmin && (
                              <button
                                onClick={() => handleOpenDelete(m)}
                                className="rounded border border-rose-200 bg-rose-50/60 p-1 text-rose-600 hover:bg-rose-100 transition"
                                title="Supprimer cette matière (Annulable avec Undo)"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No materials found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Purchased Stock & Invoices (Add Purchased Stock & Modify Payment) */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600">
              Manage purchase invoices: modify payment status (paid, partial, unpaid) and add purchased raw materials directly to the warehouse inventory ledger.
            </p>
          </div>

          {/* Mobile Purchased Stock Cards */}
          <div className="space-y-3 md:hidden">
            {purchases.length > 0 ? (
              purchases.map((p) => {
                const total = parseFloat(p.totalAmountDzd || '0');
                const paid = parseFloat(p.amountPaidDzd || '0');
                const bal = Math.max(0, total - paid);

                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-600">{p.purchaseNumber}</span>
                          <Badge variant={p.receiptStatus === 'received' ? 'success' : 'warning'}>
                            {p.receiptStatus === 'received' ? 'In Stock' : 'Pending Intake'}
                          </Badge>
                        </div>
                        <h4 className="font-extrabold text-slate-900 text-sm mt-1">{p.supplier?.name || 'Supplier'}</h4>
                        <span className="text-[11px] text-slate-400">Date: {formatDate(p.purchaseDate)}</span>
                      </div>

                      <div className="text-right">
                        <div className="font-black text-sm text-slate-900">{formatDZD(p.totalAmountDzd)}</div>
                        <Badge
                          variant={
                            p.paymentStatus === 'paid'
                              ? 'success'
                              : p.paymentStatus === 'partial'
                              ? 'warning'
                              : 'danger'
                          }
                        >
                          {p.paymentStatus}
                        </Badge>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 text-xs space-y-1">
                      {p.items?.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] text-slate-700">
                          <span className="font-medium text-indigo-700">
                            • {it.quantity} {it.purchaseUnit} {it.material?.name || 'Raw Material'}
                          </span>
                          <span className="text-slate-500 font-mono">{formatDZD(it.totalCostDzd || it.lineTotalDzd)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Actions: Add Stock & Modify Payment */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                      {p.receiptStatus === 'pending' ? (
                        <button
                          onClick={() => handleConfirmReceiveStock(p)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition"
                        >
                          <PackageCheck className="h-4 w-4" />
                          <span>Add Purchased Stock to Inventory</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>Stock successfully added to inventory</span>
                        </div>
                      )}

                      <button
                        onClick={() => handleOpenModifyPayment(p)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
                      >
                        <CreditCard className="h-4 w-4" />
                        <span>Modify Payment (Status & Amount)</span>
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                No purchases found.
              </div>
            )}
          </div>

          {/* Desktop Purchased Stock Table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">PO # / Date</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Purchased Raw Materials</th>
                    <th className="py-3 px-4 text-right">Invoice Value</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Balance</th>
                    <th className="py-3 px-4 text-center">Stock Inventory Status</th>
                    <th className="py-3 px-4 text-center">Payment Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {purchases.length > 0 ? (
                    purchases.map((p) => {
                      const totalVal = parseFloat(p.totalAmountDzd || '0');
                      const paidVal = parseFloat(p.amountPaidDzd || '0');
                      const balance = Math.max(0, totalVal - paidVal);

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-xs font-bold text-indigo-600">{p.purchaseNumber}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(p.purchaseDate)}</div>
                            {p.invoiceNumber && <div className="text-[10px] text-slate-500">Inv: {p.invoiceNumber}</div>}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            {p.supplier?.name || 'Supplier'}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="space-y-0.5">
                              {p.items?.map((it, idx) => (
                                <div key={idx} className="text-[11px] text-slate-700">
                                  • <strong className="text-indigo-700">{it.quantity} {it.purchaseUnit}</strong> {it.material?.name || 'Material'}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                            {formatDZD(p.totalAmountDzd)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-emerald-600">
                            {formatDZD(p.amountPaidDzd)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-rose-600">
                            {formatDZD(balance)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <Badge variant={p.receiptStatus === 'received' ? 'success' : 'warning'}>
                              {p.receiptStatus === 'received' ? 'Added to Inventory' : 'Pending Intake'}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <Badge
                              variant={
                                p.paymentStatus === 'paid'
                                  ? 'success'
                                  : p.paymentStatus === 'partial'
                                  ? 'warning'
                                  : 'danger'
                              }
                            >
                              {p.paymentStatus}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {/* Option to Add Purchased Stock to Inventory */}
                              {p.receiptStatus === 'pending' ? (
                                <button
                                  onClick={() => handleConfirmReceiveStock(p)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-2xs transition"
                                  title="Add purchased raw materials into inventory stock balances"
                                >
                                  <PackageCheck className="h-3.5 w-3.5" />
                                  <span>Add to Inventory</span>
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                  <CheckCircle2 className="h-3 w-3" /> In Stock
                                </span>
                              )}

                              {/* Option to Modify Payment of Purchase Invoice */}
                              <button
                                onClick={() => handleOpenModifyPayment(p)}
                                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 shadow-2xs"
                                title="Modify payment status (paid, unpaid, partial) and amount paid"
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                <span>Modify Payment</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No purchase invoices recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Stock Movements Ledger */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="all">All Movement Types</option>
                <option value="opening">Opening Balances</option>
                <option value="purchase">Purchase Intake</option>
                <option value="production_use">Production Usage</option>
                <option value="adjustment_in">Manual Addition (+)</option>
                <option value="adjustment_out">Manual Deduction (-)</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Date / Time</th>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Quantity Change</th>
                    <th className="py-3 px-4">Effectué par / Operator</th>
                    <th className="py-3 px-4 text-right">Balance After</th>
                    <th className="py-3 px-4">Reference / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredMovements.length > 0 ? (
                    filteredMovements.map((mv) => {
                      const qtyIn = parseFloat(mv.quantityIn || '0');
                      const qtyOut = parseFloat(mv.quantityOut || '0');
                      const isAddition = qtyIn > 0;
                      const displayQty = isAddition ? `+${mv.quantityIn}` : `-${mv.quantityOut}`;
                      const operatorName = mv.userName || 'Abdallah (Owner)';

                      return (
                        <tr key={mv.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-4 font-mono text-slate-500">
                            {formatDate(mv.timestamp)}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            {mv.material?.name || 'Material'}
                          </td>
                          <td className="py-2.5 px-4">
                            <Badge
                              variant={
                                mv.movementType === 'purchase_receipt'
                                  ? 'success'
                                  : mv.movementType === 'production_consumption'
                                  ? 'warning'
                                  : 'neutral'
                              }
                            >
                              {mv.movementType.replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right font-bold ${
                              isAddition ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {displayQty} {mv.unit}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 font-black text-indigo-700 text-[10px]">
                                {operatorName[0].toUpperCase()}
                              </span>
                              <div>
                                <div className="text-xs font-semibold text-slate-900">{operatorName}</div>
                                {mv.referenceType && (
                                  <div className="text-[10px] text-slate-400 capitalize">
                                    Ref: {mv.referenceType.replace(/_/g, ' ')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-500">
                            {mv.referenceType ? `${mv.referenceType}` : 'Ledger'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 italic max-w-xs truncate">
                            {mv.notes || '—'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No stock ledger records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modify Purchase Payment Modal */}
      <Modal
        isOpen={!!selectedPurchaseForPayment}
        onClose={() => setSelectedPurchaseForPayment(null)}
        title={`Modify Purchase Payment: ${selectedPurchaseForPayment?.purchaseNumber || ''}`}
        maxWidth="md"
      >
        {selectedPurchaseForPayment && (
          <form onSubmit={handleSubmitModifyPayment} className="space-y-4">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex justify-between items-center text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Supplier</span>
                <strong className="text-slate-800 text-sm">{selectedPurchaseForPayment.supplier?.name}</strong>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Invoice Value</span>
                <span className="text-indigo-600 font-black text-sm">{formatDZD(selectedPurchaseForPayment.totalAmountDzd)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Status *</label>
              <select
                value={paymentForm.paymentStatus}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setPaymentForm((prev) => ({
                    ...prev,
                    paymentStatus: val,
                    amountPaidDzd:
                      val === 'paid'
                        ? selectedPurchaseForPayment.totalAmountDzd
                        : val === 'unpaid'
                        ? '0'
                        : prev.amountPaidDzd,
                  }));
                }}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-bold"
              >
                <option value="unpaid">Unpaid (Full Liability Pending)</option>
                <option value="partial">Partial Payment</option>
                <option value="paid">Fully Paid (Settled)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-700">Amount Paid (DZD) *</label>
                <button
                  type="button"
                  onClick={() =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      paymentStatus: 'paid',
                      amountPaidDzd: selectedPurchaseForPayment.totalAmountDzd,
                    }))
                  }
                  className="text-[10px] font-bold text-indigo-600 hover:underline"
                >
                  Pay 100% Full Amount
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                required
                value={paymentForm.amountPaidDzd}
                onChange={(e) => setPaymentForm({ ...paymentForm, amountPaidDzd: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentForm.paymentMethod}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              >
                <option value="cash">Cash (Espèces)</option>
                <option value="bank_transfer">Bank Transfer (Virement Bancaire)</option>
                <option value="cheque">Cheque (Chèque Bancaire)</option>
                <option value="baridimob">BaridiMob / CCP</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Notes / Reference</label>
              <textarea
                rows={2}
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                placeholder="e.g. Paid in cash at workshop upon raw bag delivery"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedPurchaseForPayment(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
              >
                Save Payment Modification
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Material Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Raw Material / Stock Item"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              >
                <option value="blank_plastic">Blank Plastic Bags</option>
                <option value="blank_carton">Blank Carton Bags</option>
                <option value="blank_tnt">Blank TNT Bags</option>
                <option value="ink">Printing Inks</option>
                <option value="diluent">Diluent / Thinner</option>
                <option value="retarder">Retarder Chemical</option>
                <option value="consumable">Other Consumables</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Material Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="e.g. Blank White Plastic Bag 25x35"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Notes techniques</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="ex: 12g ou 20g/pièce selon fournisseur, poignée découpée, transparent..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Seuil d'alerte stock bas (Reorder Threshold)</label>
            <input
              type="number"
              value={formData.reorderThreshold}
              onChange={(e) => setFormData({ ...formData, reorderThreshold: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              placeholder="300"
            />
          </div>

          <div className="rounded-xl bg-blue-50/80 border border-blue-200 p-3 text-xs text-blue-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-blue-800">
              <span>💡 Arrivages & Spécifications Fournisseurs</span>
            </div>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Le coût d'achat unitaire, le poids ou conversion par pièce (ex: 12g ou 20g par pièce selon chaque fournisseur) et les quantités en stock sont enregistrés directement lors de la réception des bons d'achat et des factures fournisseurs.
            </p>
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
              Save Material
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Material Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Material: ${selectedMaterial?.name || ''} (${selectedMaterial?.code || ''})`}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Code / Reference *</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              >
                <option value="blank_plastic">Blank Plastic Bags</option>
                <option value="blank_carton">Blank Carton Bags</option>
                <option value="blank_tnt">Blank TNT Bags</option>
                <option value="ink">Printing Inks</option>
                <option value="diluent">Diluent / Thinner</option>
                <option value="retarder">Retarder Chemical</option>
                <option value="consumable">Other Consumables</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Material Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold"
              placeholder="e.g. Blank White Plastic Bag 25x35"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Technical Notes</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="e.g. 50 microns thickness, glossy surface"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tracking Mode</label>
              <select
                value={formData.trackingMode}
                onChange={(e) => setFormData({ ...formData, trackingMode: e.target.value as any })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              >
                <option value="dual_kg_units">Dual Tracking (Purchased Kg / Stocked Pieces)</option>
                <option value="single_unit">Single Unit</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pieces per Kg</label>
              <input
                type="number"
                step="0.01"
                value={formData.piecesPerKg}
                onChange={(e) => setFormData({ ...formData, piecesPerKg: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
                placeholder="70"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Stock Unit</label>
              <input
                type="text"
                value={formData.stockUnit}
                onChange={(e) => setFormData({ ...formData, stockUnit: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                placeholder="piece, kg, liter"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Unit</label>
              <input
                type="text"
                value={formData.purchaseUnit}
                onChange={(e) => setFormData({ ...formData, purchaseUnit: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                placeholder="kg, piece, liter"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Prix par Kg (DZD/kg) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.unitCostDzd}
                onChange={(e) => setFormData({ ...formData, unitCostDzd: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono font-bold"
                placeholder="ex: 440"
              />
              {parseFloat(formData.piecesPerKg || '0') > 0 && parseFloat(formData.unitCostDzd || '0') > 0 && (
                <span className="text-[10px] font-semibold text-indigo-600 block mt-1">
                  ≈ {(parseFloat(formData.unitCostDzd) / parseFloat(formData.piecesPerKg)).toFixed(2)} DA / pièce
                </span>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reorder Alert Level</label>
              <input
                type="number"
                value={formData.reorderThreshold}
                onChange={(e) => setFormData({ ...formData, reorderThreshold: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Stock (Kg)</label>
              <input
                type="number"
                step="0.01"
                value={formData.openingStockKg}
                onChange={(e) => setFormData({ ...formData, openingStockKg: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Stock (Pieces)</label>
              <input
                type="number"
                value={formData.openingStockPieces}
                onChange={(e) => setFormData({ ...formData, openingStockPieces: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Material Catalog Status</label>
            <select
              value={formData.isActive ? 'active' : 'archived'}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
            >
              <option value="active">Active (Available for production & purchases)</option>
              <option value="archived">Archived / Inactive</option>
            </select>
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
              Update Material
            </button>
          </div>
        </form>
      </Modal>

      {/* Manual Stock Adjustment Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Manual Stock Physical Adjustment"
        maxWidth="md"
      >
        <form onSubmit={handleSubmitAdjust} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Material</label>
            <select
              value={adjustData.materialId}
              onChange={(e) => setAdjustData({ ...adjustData, materialId: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.currentStock} {m.stockUnit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Adjustment Type</label>
              <select
                value={adjustData.adjustmentType}
                onChange={(e) =>
                  setAdjustData({
                    ...adjustData,
                    adjustmentType: e.target.value as 'adjustment_in' | 'adjustment_out',
                  })
                }
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              >
                <option value="adjustment_in">Adjustment In (+ Addition)</option>
                <option value="adjustment_out">Adjustment Out (- Deduction)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                step="0.01"
                required
                value={adjustData.quantity}
                onChange={(e) => setAdjustData({ ...adjustData, quantity: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Audit Notes *</label>
            <textarea
              required
              rows={2}
              value={adjustData.notes}
              onChange={(e) => setAdjustData({ ...adjustData, notes: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="e.g. Found 50 extra bags in warehouse shelf B during physical count"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
            >
              Confirm Adjustment
            </button>
          </div>
        </form>
      </Modal>

      {/* Receive Purchased Stock Modal (Direct Stock Intake without window.confirm) */}
      <Modal
        isOpen={!!receiveStockTarget}
        onClose={() => setReceiveStockTarget(null)}
        title={`Add Purchased Stock to Inventory: ${receiveStockTarget?.purchaseNumber || ''}`}
        maxWidth="md"
      >
        {receiveStockTarget && (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 space-y-1">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <PackageCheck className="h-4 w-4 text-emerald-600" />
                <span>Verify Warehouse Stock Intake</span>
              </div>
              <p className="text-[11px] text-emerald-700">
                Adding this invoice to inventory will update raw material quantities in the warehouse ledger and compute updated weighted costs.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Supplier:</span>
                <strong className="text-slate-900 font-bold">{receiveStockTarget.supplier?.name || 'Supplier'}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Purchase Date:</span>
                <span className="font-mono text-slate-800">{formatDate(receiveStockTarget.purchaseDate)}</span>
              </div>
              {receiveStockTarget.invoiceNumber && (
                <div className="flex justify-between items-center text-slate-600">
                  <span>Supplier Invoice #:</span>
                  <span className="font-mono font-bold text-slate-900">{receiveStockTarget.invoiceNumber}</span>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Raw Materials to Add to Stock:
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {receiveStockTarget.items && receiveStockTarget.items.length > 0 ? (
                  receiveStockTarget.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          {it.material?.name || 'Raw Material'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {it.material?.code || ''} • Unit Cost: {formatDZD(it.unitCostDzd)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-sm text-emerald-700">
                          +{it.quantity} {it.purchaseUnit}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                    Standard purchase reception
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setReceiveStockTarget(null)}
                disabled={isReceivingStock}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReceiveStock}
                disabled={isReceivingStock}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs disabled:opacity-50"
              >
                <PackageCheck className="h-4 w-4" />
                <span>{isReceivingStock ? 'Adding to Inventory...' : 'Confirm & Add to Inventory'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Single Material Confirmation Modal (Clean in-app dialog, never blocked) */}
      <Modal
        isOpen={!!materialToDelete}
        onClose={() => {
          if (!isDeletingMaterial) setMaterialToDelete(null);
        }}
        title="Supprimer la matière du catalogue"
        maxWidth="md"
      >
        {materialToDelete && (
          <div className="space-y-4">
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-900 space-y-1">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>Confirmation de suppression</span>
              </div>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                Êtes-vous sûr de vouloir supprimer cet élément du catalogue des matières ? Cette action est entièrement réversible via le système d'Annulation (Undo).
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Désignation:</span>
                <strong className="text-slate-900 font-bold">{materialToDelete.name}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Code article:</span>
                <span className="font-mono text-indigo-600 font-bold">{materialToDelete.code}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Catégorie:</span>
                <span className="text-slate-800">{categoryLabels[materialToDelete.category] || materialToDelete.category}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Stock enregistré:</span>
                <strong className="font-mono text-slate-900 font-black">{materialToDelete.currentStock} {materialToDelete.stockUnit}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Coût unitaire:</span>
                <span className="font-semibold text-slate-800">{formatDZD(materialToDelete.unitCostDzd)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setMaterialToDelete(null)}
                disabled={isDeletingMaterial}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMaterial}
                disabled={isDeletingMaterial}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-xs disabled:opacity-50 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{isDeletingMaterial ? 'Suppression en cours...' : 'Supprimer définitivement'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete All Materials Confirmation Modal */}
      <Modal
        isOpen={isDeleteAllModalOpen}
        onClose={() => {
          if (!isDeletingAllMaterials) setIsDeleteAllModalOpen(false);
        }}
        title="Supprimer TOUT le catalogue des matières"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-900 space-y-1">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>Avertissement : Suppression collective</span>
            </div>
            <p className="text-[11px] text-rose-700 leading-relaxed">
              Vous êtes sur le point de supprimer <strong>{materials.length} matière(s)</strong> du catalogue.
              Toutes les données pourront être restaurées grâce au système d'Annulation (Undo).
            </p>
          </div>

          <p className="text-xs text-slate-600">
            Voulez-vous vraiment effacer l'ensemble du catalogue des matières ?
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsDeleteAllModalOpen(false)}
              disabled={isDeletingAllMaterials}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteAll}
              disabled={isDeletingAllMaterials}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-xs disabled:opacity-50 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{isDeletingAllMaterials ? 'Suppression en cours...' : `Supprimer tout (${materials.length})`}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
