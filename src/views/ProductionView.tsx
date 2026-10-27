import React, { useEffect, useState } from 'react';
import { api } from '../services/api.ts';
import { ProductionRecord, Order, Material, ProductionLog } from '../types/erp.ts';
import { formatDZD, formatDate, exportToCSV } from '../utils/format.ts';
import { Badge } from '../components/common/Badge.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Factory,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  FlaskConical,
  AlertTriangle,
  Download,
  Boxes,
  Edit3,
  Trash2,
  History,
  RotateCcw,
  Check,
  X,
  AlertCircle,
  FileText,
  User,
} from 'lucide-react';

export const ProductionView: React.FC = () => {
  const { token, profile } = useAuth();
  const [productionList, setProductionList] = useState<ProductionRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Toast / Feedback banner with optional undo
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    undoOpId?: string;
  } | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState<boolean>(false);

  // Active items for modals
  const [editingProduction, setEditingProduction] = useState<ProductionRecord | null>(null);
  const [deletingProduction, setDeletingProduction] = useState<ProductionRecord | null>(null);
  const [viewingLogsProduction, setViewingLogsProduction] = useState<ProductionRecord | null>(null);
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  // Form State for Add
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [workerName, setWorkerName] = useState<string>(profile?.fullName || 'Technicien');
  const [notes, setNotes] = useState<string>('');
  const [addModalError, setAddModalError] = useState<string | null>(null);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState<boolean>(false);

  // Consumption Lines for Add
  const [consumptionLines, setConsumptionLines] = useState<
    Array<{
      materialId: string;
      quantityUsed: string;
      unit: string;
      wasteQuantity: string;
      notes: string;
    }>
  >([]);

  // Form State for Edit
  const [editWorkerName, setEditWorkerName] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('in_progress');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editConsumptionLines, setEditConsumptionLines] = useState<
    Array<{
      materialId: string;
      quantityUsed: string;
      unit: string;
      wasteQuantity: string;
      notes: string;
    }>
  >([]);
  const [editModalError, setEditModalError] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pData, oData, mData] = await Promise.all([
        api.getProduction(),
        api.getOrders(),
        api.getMaterials(),
      ]);
      setProductionList(pData);
      setOrders(oData);
      setMaterials(mData);
    } catch (err) {
      console.error('Failed to load production data:', err);
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

  // Helper to get available stock of a material
  const getMaterialStock = (matId: string): number => {
    const mat = materials.find((m) => m.id === matId);
    return mat && mat.currentStock !== undefined ? mat.currentStock : 0;
  };

  const getMaterialStockUnit = (matId: string): string => {
    const mat = materials.find((m) => m.id === matId);
    return mat ? mat.stockUnit : 'unité';
  };

  const getMaterialName = (matId: string): string => {
    const mat = materials.find((m) => m.id === matId);
    return mat ? mat.name : 'Matière';
  };

  // Check if Add form has any stock validation errors
  const checkAddStockErrors = () => {
    for (const line of consumptionLines) {
      const needed = parseFloat(line.quantityUsed || '0') + parseFloat(line.wasteQuantity || '0');
      if (needed <= 0) continue;
      const stock = getMaterialStock(line.materialId);
      if (needed > stock) {
        return {
          hasError: true,
          materialName: getMaterialName(line.materialId),
          available: stock,
          needed,
          unit: getMaterialStockUnit(line.materialId),
        };
      }
    }
    return { hasError: false };
  };

  // Check if Edit form has any stock validation errors
  const checkEditStockErrors = () => {
    if (!editingProduction) return { hasError: false };
    const oldUsage = editingProduction.usage || [];

    for (const line of editConsumptionLines) {
      const needed = parseFloat(line.quantityUsed || '0') + parseFloat(line.wasteQuantity || '0');
      if (needed <= 0) continue;

      // Add back what this specific production run had deducted previously for this material
      const prevDeducted = oldUsage
        .filter((ou) => ou.materialId === line.materialId)
        .reduce((sum, ou) => sum + parseFloat(ou.quantityUsed || '0') + parseFloat(ou.wasteQuantity || '0'), 0);

      const liveStock = getMaterialStock(line.materialId);
      const availableForEdit = liveStock + prevDeducted;

      if (needed > availableForEdit) {
        return {
          hasError: true,
          materialName: getMaterialName(line.materialId),
          available: availableForEdit,
          needed,
          unit: getMaterialStockUnit(line.materialId),
        };
      }
    }
    return { hasError: false };
  };

  const handleOpenAdd = () => {
    setAddModalError(null);
    const candidateOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
    const firstOrder = candidateOrders.length > 0 ? candidateOrders[0] : orders[0];
    const initialOrderId = firstOrder ? firstOrder.id : '';
    setSelectedOrderId(initialOrderId);

    const firstOrderItems = firstOrder?.items || [];
    const totalOrderPieces = firstOrderItems.reduce((acc, it) => acc + parseFloat(it.quantityPieces || '0'), 0);
    const initialPlanned = totalOrderPieces > 0 ? String(totalOrderPieces) : '1000';

    setWorkerName(profile?.fullName || 'Technicien');
    setNotes('Tirage sérigraphie standard');

    // Auto-populate relevant blank bags, ink, and thinner from materials list if available
    const blankBagMat = materials.find((m) => m.category.startsWith('blank_') && (m.currentStock || 0) > 0) || materials[0];
    const inkMat = materials.find((m) => m.category === 'ink' && (m.currentStock || 0) > 0);
    const diluentMat = materials.find((m) => m.category === 'diluent' && (m.currentStock || 0) > 0);
    const retarderMat = materials.find((m) => m.category === 'retarder' && (m.currentStock || 0) > 0);

    const autoUsage: any[] = [];
    if (blankBagMat) {
      autoUsage.push({
        materialId: blankBagMat.id,
        quantityUsed: initialPlanned,
        unit: blankBagMat.stockUnit,
        wasteQuantity: '15',
        notes: 'Sacs vierges alimentés en machine',
      });
    }
    if (inkMat) {
      autoUsage.push({
        materialId: inkMat.id,
        quantityUsed: '1.5',
        unit: 'kg',
        wasteQuantity: '0.1',
        notes: 'Encre de sérigraphie consommée',
      });
    }
    if (diluentMat) {
      autoUsage.push({
        materialId: diluentMat.id,
        quantityUsed: '0.4',
        unit: 'kg',
        wasteQuantity: '0.05',
        notes: 'Diluant pour ajustement de viscosité',
      });
    }
    if (retarderMat) {
      autoUsage.push({
        materialId: retarderMat.id,
        quantityUsed: '0.2',
        unit: 'kg',
        wasteQuantity: '0',
        notes: 'Retardateur anti-séchage dans l\'écran',
      });
    }

    setConsumptionLines(autoUsage);
    setIsAddModalOpen(true);
  };

  const handleConsumptionChange = (index: number, field: string, value: any) => {
    setAddModalError(null);
    const updated = [...consumptionLines];
    (updated[index] as any)[field] = value;
    if (field === 'materialId') {
      const mat = materials.find((m) => m.id === value);
      if (mat) {
        updated[index].unit = mat.stockUnit;
      }
    }
    setConsumptionLines(updated);
  };

  const handleAddConsumptionLine = () => {
    if (materials.length === 0) return;
    const firstMat = materials[0];
    setConsumptionLines([
      ...consumptionLines,
      {
        materialId: firstMat.id,
        quantityUsed: '1.0',
        unit: firstMat.stockUnit,
        wasteQuantity: '0',
        notes: '',
      },
    ]);
  };

  const handleRemoveConsumptionLine = (index: number) => {
    setConsumptionLines(consumptionLines.filter((_, i) => i !== index));
  };

  const handleSubmitProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddModalError(null);

    if (!selectedOrderId) {
      setAddModalError('Veuillez sélectionner une commande client.');
      return;
    }

    // Front-end Stock Check
    const stockValidation = checkAddStockErrors();
    if (stockValidation.hasError) {
      setAddModalError(
        `Stock insuffisant pour "${stockValidation.materialName}". Stock disponible : ${stockValidation.available} ${stockValidation.unit}, Quantité totale requise : ${stockValidation.needed} ${stockValidation.unit}. Veuillez ajuster les quantités ou réapprovisionner l'inventaire.`
      );
      return;
    }

    // Automatically compute quantities from consumption lines
    const totalQtyUsed = consumptionLines.reduce((acc, l) => acc + parseFloat(l.quantityUsed || '0'), 0);
    const totalWaste = consumptionLines.reduce((acc, l) => acc + parseFloat(l.wasteQuantity || '0'), 0);
    const completed = totalQtyUsed > 0 ? String(totalQtyUsed) : '1000';
    const rejected = totalWaste > 0 ? String(totalWaste) : '0';
    const planned = String(parseFloat(completed) + parseFloat(rejected));

    try {
      setIsSubmittingAdd(true);
      await api.createProduction(
        {
          orderId: selectedOrderId,
          plannedQuantity: planned,
          completedQuantity: completed,
          rejectedQuantity: rejected,
          workerName,
          notes,
          usage: consumptionLines,
        },
        token
      );
      setIsAddModalOpen(false);
      setToastMessage({
        type: 'success',
        text: 'Fiche de production et déduction des matières enregistrées avec succès.',
      });
      setTimeout(() => setToastMessage(null), 6000);
      await loadData();
    } catch (err: any) {
      setAddModalError(err.message || 'Erreur lors de l\'enregistrement de la production.');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (pr: ProductionRecord) => {
    setEditingProduction(pr);
    setEditWorkerName(pr.workerName || '');
    setEditStatus(pr.status || 'in_progress');
    setEditNotes(pr.notes || '');
    setEditModalError(null);

    const existingUsage = (pr.usage || []).map((u) => ({
      materialId: u.materialId,
      quantityUsed: String(u.quantityUsed || '0'),
      unit: u.unit || 'piece',
      wasteQuantity: String(u.wasteQuantity || '0'),
      notes: u.notes || '',
    }));
    setEditConsumptionLines(existingUsage);
    setIsEditModalOpen(true);
  };

  const handleEditConsumptionChange = (index: number, field: string, value: any) => {
    setEditModalError(null);
    const updated = [...editConsumptionLines];
    (updated[index] as any)[field] = value;
    if (field === 'materialId') {
      const mat = materials.find((m) => m.id === value);
      if (mat) {
        updated[index].unit = mat.stockUnit;
      }
    }
    setEditConsumptionLines(updated);
  };

  const handleAddEditConsumptionLine = () => {
    if (materials.length === 0) return;
    const firstMat = materials[0];
    setEditConsumptionLines([
      ...editConsumptionLines,
      {
        materialId: firstMat.id,
        quantityUsed: '1.0',
        unit: firstMat.stockUnit,
        wasteQuantity: '0',
        notes: '',
      },
    ]);
  };

  const handleRemoveEditConsumptionLine = (index: number) => {
    setEditConsumptionLines(editConsumptionLines.filter((_, i) => i !== index));
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduction) return;
    setEditModalError(null);

    // Front-end Stock Check for Edit
    const stockValidation = checkEditStockErrors();
    if (stockValidation.hasError) {
      setEditModalError(
        `Stock insuffisant pour "${stockValidation.materialName}". Stock disponible : ${stockValidation.available?.toFixed(2)} ${stockValidation.unit}, Quantité totale requise : ${stockValidation.needed} ${stockValidation.unit}.`
      );
      return;
    }

    // Automatically compute quantities from consumption lines
    const totalQtyUsed = editConsumptionLines.reduce((acc, l) => acc + parseFloat(l.quantityUsed || '0'), 0);
    const totalWaste = editConsumptionLines.reduce((acc, l) => acc + parseFloat(l.wasteQuantity || '0'), 0);
    const completed = totalQtyUsed > 0 ? String(totalQtyUsed) : '1000';
    const rejected = totalWaste > 0 ? String(totalWaste) : '0';
    const planned = String(parseFloat(completed) + parseFloat(rejected));

    try {
      setIsSubmittingEdit(true);
      await api.updateProduction(
        editingProduction.id,
        {
          plannedQuantity: planned,
          completedQuantity: completed,
          rejectedQuantity: rejected,
          workerName: editWorkerName,
          status: editStatus,
          notes: editNotes,
          usage: editConsumptionLines,
          modifierName: profile?.fullName || 'Technicien',
          modifierRole: profile?.role || 'staff',
        },
        token
      );
      setIsEditModalOpen(false);
      setEditingProduction(null);
      setToastMessage({
        type: 'success',
        text: `Fiche ${editingProduction.productionNumber} mise à jour et stock réajusté avec succès.`,
      });
      setTimeout(() => setToastMessage(null), 6000);
      await loadData();
    } catch (err: any) {
      setEditModalError(err.message || 'Erreur lors de la mise à jour de la fiche.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Open Delete Confirmation Modal
  const handleOpenDelete = (pr: ProductionRecord) => {
    setDeletingProduction(pr);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingProduction) return;
    try {
      setIsDeleting(true);
      const res = await api.deleteProduction(deletingProduction.id, token);
      setIsDeleteModalOpen(false);
      const deletedNumber = deletingProduction.productionNumber;
      setDeletingProduction(null);
      setToastMessage({
        type: 'success',
        text: `Fiche ${deletedNumber} supprimée. Les matières consommées ont été réintégrées au stock de l'atelier.`,
      });
      setTimeout(() => setToastMessage(null), 8000);
      await loadData();
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: err.message || 'Erreur lors de la suppression de la fiche de production.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Quick Undo Handler
  const handleQuickUndo = async () => {
    try {
      await api.executeLatestUndo(token);
      setToastMessage({
        type: 'success',
        text: 'Action annulée avec succès : la fiche de production et le stock ont été restaurés.',
      });
      setTimeout(() => setToastMessage(null), 6000);
      await loadData();
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: err.message || 'Impossible d\'annuler l\'opération.',
      });
    }
  };

  // Open Audit Logs Modal
  const handleOpenLogs = async (pr: ProductionRecord) => {
    setViewingLogsProduction(pr);
    setIsLogsModalOpen(true);
    setLoadingLogs(true);
    try {
      const logs = await api.getProductionLogs(pr.id, token);
      setProductionLogs(logs);
    } catch (err) {
      console.error('Failed to load logs:', err);
      setProductionLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Filtered production list
  const filteredList = productionList.filter((pr) => {
    const q = searchQuery.toLowerCase();
    return (
      pr.productionNumber.toLowerCase().includes(q) ||
      (pr.order?.orderNumber && pr.order.orderNumber.toLowerCase().includes(q)) ||
      (pr.order?.customerName && pr.order.customerName.toLowerCase().includes(q)) ||
      (pr.workerName && pr.workerName.toLowerCase().includes(q)) ||
      (pr.notes && pr.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Toast / Banner */}
      {toastMessage && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border text-xs font-medium shadow-sm transition-all animate-fadeIn ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : toastMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-indigo-50 border-indigo-200 text-indigo-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleQuickUndo}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-[11px] shadow-xs"
              title="Annuler la dernière action"
            >
              <RotateCcw className="h-3 w-3 text-indigo-600" /> Annuler (Undo)
            </button>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Factory className="h-6 w-6 text-indigo-600" />
            Production & Consommation Matières
          </h1>
          <p className="text-sm text-slate-500">
            Suivi des tirages, validation des stocks disponibles, rebuts et historique des modifications
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              exportToCSV(
                'an_printing_production',
                productionList.map((pr) => ({
                  ProductionNumber: pr.productionNumber,
                  OrderNumber: pr.order?.orderNumber,
                  Customer: pr.order?.customerName,
                  Worker: pr.workerName,
                  PlannedQty: pr.plannedQuantity,
                  CompletedQty: pr.completedQuantity,
                  RejectedQty: pr.rejectedQuantity,
                  Date: pr.startDate,
                  Status: pr.status,
                }))
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs transition"
          >
            <Plus className="h-4 w-4" />
            Nouvelle Production & Consommation
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher par N° d'OF, commande, client, technicien..."
          className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
        />
      </div>

      {/* Mobile Production Cards List (Visible on Phone Screens) */}
      <div className="space-y-3 md:hidden">
        {filteredList.length > 0 ? (
          filteredList.map((pr) => (
            <div
              key={pr.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-600">{pr.productionNumber}</span>
                    <Badge variant={pr.status === 'completed' ? 'success' : 'info'}>
                      {pr.status === 'completed' ? 'Terminé' : 'En cours'}
                    </Badge>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mt-1">
                    {pr.order?.orderNumber} • {pr.order?.customerName}
                  </h3>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Opérateur : {pr.workerName || 'Atelier'} • {formatDate(pr.startDate)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Réalisé</span>
                  <div className="font-mono font-bold text-sm text-emerald-600">
                    {pr.completedQuantity} / {pr.plannedQuantity} pcs
                  </div>
                  {parseFloat(pr.rejectedQuantity || '0') > 0 && (
                    <span className="text-[10px] font-semibold text-rose-500">
                      {pr.rejectedQuantity} rebuts
                    </span>
                  )}
                </div>
              </div>

              {/* Material Usage Log */}
              {pr.usage && pr.usage.length > 0 && (
                <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 text-xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Matières Consommées Déduites :
                  </span>
                  {pr.usage.map((u, i) => (
                    <div key={i} className="flex justify-between items-center text-[11px] text-slate-700">
                      <span>• {u.materialName}</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {u.quantityUsed} {u.unit}
                        {parseFloat(u.wasteQuantity || '0') > 0 && (
                          <span className="text-rose-500 font-normal ml-1">
                            (+{u.wasteQuantity} perte)
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Card Action Buttons */}
              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleOpenLogs(pr)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                >
                  <History className="h-3.5 w-3.5 text-slate-500" /> Logs
                </button>
                <button
                  onClick={() => handleOpenEdit(pr)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Modifier
                </button>
                <button
                  onClick={() => handleOpenDelete(pr)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/50 text-[11px] font-semibold text-rose-600 hover:bg-rose-100/50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
            Aucun ordre de fabrication trouvé.
          </div>
        )}
      </div>

      {/* Desktop Production Table (Hidden on Phone Screens) */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">N° OF / Date</th>
                <th className="py-3 px-4">Commande / Client</th>
                <th className="py-3 px-4">Opérateur</th>
                <th className="py-3 px-4 text-right">Prévu (pcs)</th>
                <th className="py-3 px-4 text-right">Terminé (pcs)</th>
                <th className="py-3 px-4 text-right">Rebut / Perte</th>
                <th className="py-3 px-4">Matières Consommées</th>
                <th className="py-3 px-4 text-center">Statut</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredList.length > 0 ? (
                filteredList.map((pr) => (
                  <tr key={pr.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-xs font-bold text-indigo-600">{pr.productionNumber}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(pr.startDate)}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{pr.order?.orderNumber || 'Commande'}</div>
                      <div className="text-[11px] text-slate-500">{pr.order?.customerName}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">{pr.workerName || 'Atelier'}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-600">
                      {pr.plannedQuantity} pcs
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                      {pr.completedQuantity} pcs
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-rose-600">
                      {parseFloat(pr.rejectedQuantity || '0') > 0 ? `${pr.rejectedQuantity} pcs` : '0'}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="space-y-0.5">
                        {pr.usage && pr.usage.length > 0 ? (
                          pr.usage.map((u, i) => (
                            <div key={i} className="text-[11px] text-slate-600 truncate">
                              • <span className="font-semibold text-slate-900">{u.quantityUsed} {u.unit}</span> {u.materialName}
                              {parseFloat(u.wasteQuantity || '0') > 0 && (
                                <span className="text-rose-500 ml-1 font-medium">({u.wasteQuantity} rebut)</span>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">Aucune consommation enregistrée</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge variant={pr.status === 'completed' ? 'success' : 'info'}>
                        {pr.status === 'completed' ? 'Terminé' : 'En cours'}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenLogs(pr)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition"
                          title="Historique & Traçabilité (Logs)"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(pr)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                          title="Modifier la fiche de production"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(pr)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Supprimer la fiche (restaure le stock)"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Aucun ordre de fabrication trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Production Modal (Create) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Créer un Ordre de Fabrication & Consommation Matières"
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmitProduction} className="space-y-4">
          {addModalError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <strong className="font-bold">Attention : </strong>
                <span>{addModalError}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Commande Client Cible *</label>
              <select
                required
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} - {o.customerName} ({o.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Opérateur / Technicien Responsable *</label>
              <input
                type="text"
                required
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Actual Material Consumption Builder with Live Stock Validation */}
          <div className="border rounded-xl border-slate-200 p-3.5 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FlaskConical className="h-4 w-4 text-indigo-600" />
                  Consommation Réelle de Matières Premières & Produits Chimiques
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Les quantités prévues, produites et rebuts sont calculées automatiquement à partir des consommables ci-dessous. Le stock est validé en temps réel.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddConsumptionLine}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter Consommable
              </button>
            </div>

            <div className="space-y-2.5">
              {consumptionLines.map((line, idx) => {
                const stock = getMaterialStock(line.materialId);
                const unit = getMaterialStockUnit(line.materialId);
                const totalNeeded = parseFloat(line.quantityUsed || '0') + parseFloat(line.wasteQuantity || '0');
                const isInsufficient = totalNeeded > stock;

                return (
                  <div
                    key={idx}
                    className={`grid grid-cols-12 gap-2 p-3 rounded-xl border text-xs shadow-xs items-center transition ${
                      isInsufficient
                        ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-300'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="col-span-5">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-slate-500 font-semibold">Matière Première</label>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            stock > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          Stock dispo: {stock} {unit}
                        </span>
                      </div>
                      <select
                        value={line.materialId}
                        onChange={(e) => handleConsumptionChange(idx, 'materialId', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 p-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                      >
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.currentStock} {m.stockUnit} disponibles)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-500 font-semibold block mb-1">
                        Quantité Utilisée ({line.unit})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={line.quantityUsed}
                        onChange={(e) => handleConsumptionChange(idx, 'quantityUsed', e.target.value)}
                        className={`w-full rounded-lg border p-1.5 text-xs font-mono ${
                          isInsufficient ? 'border-rose-400 bg-rose-50/50 text-rose-900 font-bold' : 'border-slate-300'
                        }`}
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-500 font-semibold block mb-1">
                        Perte / Rebut ({line.unit})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={line.wasteQuantity}
                        onChange={(e) => handleConsumptionChange(idx, 'wasteQuantity', e.target.value)}
                        className={`w-full rounded-lg border p-1.5 text-xs font-mono ${
                          isInsufficient ? 'border-rose-400 bg-rose-50/50 text-rose-900 font-bold' : 'border-slate-300'
                        }`}
                      />
                    </div>

                    <div className="col-span-1 text-right pt-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveConsumptionLine(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 text-sm font-bold"
                        title="Retirer cette ligne"
                      >
                        ×
                      </button>
                    </div>

                    {isInsufficient && (
                      <div className="col-span-12 text-[11px] text-rose-700 font-semibold flex items-center gap-1 mt-1 bg-rose-100/70 p-1.5 rounded">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                        <span>
                          Stock insuffisant : {stock} {unit} disponible(s), mais {totalNeeded.toFixed(2)} {unit} requis !
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Paramètres Atelier</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="ex: Maille d'écran 90T, encre séchée sous 28°C..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmittingAdd || checkAddStockErrors().hasError}
              className={`px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs transition flex items-center gap-1.5 ${
                checkAddStockErrors().hasError
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isSubmittingAdd ? (
                'Validation en cours...'
              ) : (
                <>
                  <Check className="h-4 w-4" /> Enregistrer & Déduire le Stock
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Production Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Modifier l'Ordre de Fabrication : ${editingProduction?.productionNumber || ''}`}
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmitEdit} className="space-y-4">
          {editModalError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <strong className="font-bold">Erreur : </strong>
                <span>{editModalError}</span>
              </div>
            </div>
          )}

          {/* Context header */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center text-xs">
            <div>
              <span className="text-slate-400 font-semibold block">Commande Associée :</span>
              <span className="font-bold text-slate-900">
                {editingProduction?.order?.orderNumber} - {editingProduction?.order?.customerName}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block text-right">Date de Lancement :</span>
              <span className="font-mono text-slate-700 font-medium">
                {editingProduction ? formatDate(editingProduction.startDate) : ''}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Opérateur / Technicien *</label>
              <input
                type="text"
                required
                value={editWorkerName}
                onChange={(e) => setEditWorkerName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Statut de la Production *</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              >
                <option value="in_progress">En cours (In Progress)</option>
                <option value="completed">Terminé (Completed)</option>
                <option value="cancelled">Annulé (Cancelled)</option>
              </select>
            </div>
          </div>

          {/* Edit Consumables Builder */}
          <div className="border rounded-xl border-slate-200 p-3.5 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FlaskConical className="h-4 w-4 text-indigo-600" />
                  Matières Consommées (Réajustement automatique du Stock)
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  La modification réintégrera les anciennes déductions et appliquera les nouvelles consommations exactes. Les totaux sont recalculés automatiquement.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddEditConsumptionLine}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter Consommable
              </button>
            </div>

            <div className="space-y-2.5">
              {editConsumptionLines.map((line, idx) => {
                const liveStock = getMaterialStock(line.materialId);
                const unit = getMaterialStockUnit(line.materialId);
                const oldUsage = editingProduction?.usage || [];
                const prevDeducted = oldUsage
                  .filter((ou) => ou.materialId === line.materialId)
                  .reduce((sum, ou) => sum + parseFloat(ou.quantityUsed || '0') + parseFloat(ou.wasteQuantity || '0'), 0);
                const availableForEdit = liveStock + prevDeducted;
                const totalNeeded = parseFloat(line.quantityUsed || '0') + parseFloat(line.wasteQuantity || '0');
                const isInsufficient = totalNeeded > availableForEdit;

                return (
                  <div
                    key={idx}
                    className={`grid grid-cols-12 gap-2 p-3 rounded-xl border text-xs shadow-xs items-center transition ${
                      isInsufficient
                        ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-300'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="col-span-5">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-slate-500 font-semibold">Matière Première</label>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700">
                          Dispo avec réajustement: {availableForEdit.toFixed(2)} {unit}
                        </span>
                      </div>
                      <select
                        value={line.materialId}
                        onChange={(e) => handleEditConsumptionChange(idx, 'materialId', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 p-1.5 text-xs"
                      >
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-500 font-semibold block mb-1">
                        Quantité ({line.unit})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={line.quantityUsed}
                        onChange={(e) => handleEditConsumptionChange(idx, 'quantityUsed', e.target.value)}
                        className={`w-full rounded-lg border p-1.5 text-xs font-mono ${
                          isInsufficient ? 'border-rose-400 bg-rose-50/50 text-rose-900 font-bold' : 'border-slate-300'
                        }`}
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-500 font-semibold block mb-1">
                        Perte ({line.unit})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={line.wasteQuantity}
                        onChange={(e) => handleEditConsumptionChange(idx, 'wasteQuantity', e.target.value)}
                        className={`w-full rounded-lg border p-1.5 text-xs font-mono ${
                          isInsufficient ? 'border-rose-400 bg-rose-50/50 text-rose-900 font-bold' : 'border-slate-300'
                        }`}
                      />
                    </div>

                    <div className="col-span-1 text-right pt-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveEditConsumptionLine(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 text-sm font-bold"
                        title="Retirer cette ligne"
                      >
                        ×
                      </button>
                    </div>

                    {isInsufficient && (
                      <div className="col-span-12 text-[11px] text-rose-700 font-semibold flex items-center gap-1 mt-1 bg-rose-100/70 p-1.5 rounded">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                        <span>
                          Stock insuffisant : disponible {availableForEdit.toFixed(2)} {unit}, requis {totalNeeded.toFixed(2)} {unit} !
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes & Remarques</label>
            <textarea
              rows={2}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmittingEdit || checkEditStockErrors().hasError}
              className={`px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs transition flex items-center gap-1.5 ${
                checkEditStockErrors().hasError
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isSubmittingEdit ? 'Enregistrement...' : 'Mettre à jour la Fiche'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal (In-App, No window.confirm) */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirmer la suppression de la fiche de production"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              Suppression de l'OF {deletingProduction?.productionNumber}
            </div>
            <p className="leading-relaxed">
              Êtes-vous sûr de vouloir supprimer cette fiche de production ?
            </p>
            <div className="p-2.5 rounded-lg bg-white/80 border border-rose-200 text-slate-700 space-y-1">
              <div className="font-semibold text-slate-900 flex items-center gap-1">
                <Boxes className="h-3.5 w-3.5 text-indigo-600" /> Restitution automatique du stock :
              </div>
              <p className="text-[11px] text-slate-600">
                Toutes les matières premières déduites lors de ce tirage (
                <strong className="text-slate-900">
                  {deletingProduction?.usage?.length || 0} article(s)
                </strong>
                ) seront instantanément <strong>recréditées dans le stock disponible</strong> de l'atelier.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-xs transition"
            >
              {isDeleting ? 'Suppression en cours...' : 'Confirmer la Suppression & Restituer le Stock'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Production Audit Logs Modal */}
      <Modal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
        title={`Historique & Traçabilité : ${viewingLogsProduction?.productionNumber || ''}`}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 flex justify-between items-center">
            <div>
              <span className="font-bold">Commande : </span>
              {viewingLogsProduction?.order?.orderNumber} ({viewingLogsProduction?.order?.customerName})
            </div>
            <div className="font-mono text-indigo-700">
              Prévu: {viewingLogsProduction?.plannedQuantity} pcs | Réalisé: {viewingLogsProduction?.completedQuantity} pcs
            </div>
          </div>

          {loadingLogs ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Chargement du journal d'audit...
            </div>
          ) : productionLogs.length > 0 ? (
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {productionLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          log.action === 'Création'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.action === 'Modification'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {log.action}
                      </span>
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-400" />
                        {log.userName || 'Personnel'}
                      </span>
                      {log.userRole && (
                        <span className="text-[10px] text-slate-400">({log.userRole})</span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {formatDate(log.timestamp)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed font-sans">
                    {log.modification}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400 italic">
              Aucun journal d'audit enregistré pour cette fiche de production.
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsLogsModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              Fermer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
