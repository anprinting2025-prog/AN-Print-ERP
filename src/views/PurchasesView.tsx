import React, { useEffect, useState } from 'react';
import { api } from '../services/api.ts';
import { Purchase, Supplier, Material, PurchaseItem, PurchaseLog } from '../types/erp.ts';
import { formatDZD, formatDate, exportToCSV } from '../utils/format.ts';
import { Badge } from '../components/common/Badge.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Truck,
  Plus,
  Search,
  PackageCheck,
  CreditCard,
  FileText,
  Download,
  AlertCircle,
  AlertTriangle,
  Building2,
  Trash2,
  Printer,
  Pencil,
  History,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useUndo } from '../context/UndoContext.tsx';

interface PurchasesViewProps {
  initialTab?: 'purchases' | 'suppliers';
  onNavigateTab?: (tab: 'purchases' | 'suppliers') => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({ initialTab = 'purchases', onNavigateTab }) => {
  const { token, profile } = useAuth();
  const { showUndoToast } = useUndo();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTabSwitch = (tab: 'purchases' | 'suppliers') => {
    setActiveTab(tab);
    if (onNavigateTab) {
      onNavigateTab(tab);
    }
  };

  // Modals
  const [isAddPurchaseModalOpen, setIsAddPurchaseModalOpen] = useState<boolean>(false);
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState<boolean>(false);
  const [isEditSupplierModalOpen, setIsEditSupplierModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editSupplierFormData, setEditSupplierFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    address: '',
    openingBalanceDzd: '0',
    notes: '',
    isActive: true,
  });
  const [isSubmittingEditSupplier, setIsSubmittingEditSupplier] = useState<boolean>(false);
  const [statementData, setStatementData] = useState<any>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState<boolean>(false);
  const [receiveTarget, setReceiveTarget] = useState<Purchase | null>(null);
  const [isReceivingStock, setIsReceivingStock] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit Purchase Invoice State
  const [isEditPurchaseModalOpen, setIsEditPurchaseModalOpen] = useState<boolean>(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [isSubmittingEditPurchase, setIsSubmittingEditPurchase] = useState<boolean>(false);
  const [editPurchaseForm, setEditPurchaseForm] = useState({
    supplierId: '',
    invoiceNumber: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    freightCost: '0',
    notes: '',
    paymentStatus: 'unpaid' as 'unpaid' | 'partial' | 'paid',
    amountPaidDzd: '0',
    modificationReason: '',
    items: [] as Array<{
      id?: string;
      materialId: string;
      quantity: string;
      purchaseUnit: string;
      receivedKg: string;
      receivedPieces: string;
      unitCostDzd: string;
    }>,
  });

  // Delete Purchase State
  const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null);
  const [isDeletingPurchase, setIsDeletingPurchase] = useState<boolean>(false);

  // Delete Supplier Confirmation State
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [isDeletingSupplier, setIsDeletingSupplier] = useState<boolean>(false);

  // Purchase Audit Logs Modal State
  const [selectedPurchaseForLogs, setSelectedPurchaseForLogs] = useState<Purchase | null>(null);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState<boolean>(false);
  const [purchaseLogsLoading, setPurchaseLogsLoading] = useState<boolean>(false);
  const [fetchedLogs, setFetchedLogs] = useState<any[]>([]);

  // Modify Purchase Payment Modal
  const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState<Purchase | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentStatus: 'unpaid' as 'unpaid' | 'partial' | 'paid',
    amountPaidDzd: '0',
    paymentMethod: 'cash',
    notes: '',
  });

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
      alert(err.message || 'Error updating purchase payment');
    }
  };

  // New Purchase Form
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [freightCost, setFreightCost] = useState<string>('0');
  const [purchaseNotes, setPurchaseNotes] = useState<string>('');
  const [items, setItems] = useState<
    Array<{
      materialId: string;
      quantity: string;
      purchaseUnit: string;
      receivedKg: string;
      receivedPieces: string;
      unitCostDzd: string;
    }>
  >([]);

  // New Supplier Form
  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    address: '',
    openingBalanceDzd: '0',
    notes: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [pData, sData, mData] = await Promise.all([
        api.getPurchases(),
        api.getSuppliers(),
        api.getMaterials(),
      ]);
      setPurchases(pData);
      setSuppliers(sData);
      setMaterials(mData);
      if (sData.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(sData[0].id);
      }
    } catch (err) {
      console.error('Failed to load purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddPurchase = () => {
    if (materials.length === 0) {
      alert('Please create raw materials first before adding purchases.');
      return;
    }
    const firstMat = materials[0];
    const defaultPcsPerKg = parseFloat(firstMat.piecesPerKg || '0') > 0 ? parseFloat(firstMat.piecesPerKg) : 50;
    setItems([
      {
        materialId: firstMat.id,
        quantity: '50',
        purchaseUnit: firstMat.purchaseUnit,
        receivedKg: firstMat.purchaseUnit === 'kg' ? '50' : '0',
        receivedPieces: firstMat.trackingMode === 'dual_kg_units' ? String(50 * defaultPcsPerKg) : '0',
        unitCostDzd: parseFloat(firstMat.unitCostDzd || '0') > 0 ? firstMat.unitCostDzd : '7',
      },
    ]);
    setIsAddPurchaseModalOpen(true);
  };

  const handleAddItemLine = () => {
    const firstMat = materials[0];
    const defaultPcsPerKg = parseFloat(firstMat.piecesPerKg || '0') > 0 ? parseFloat(firstMat.piecesPerKg) : 50;
    setItems([
      ...items,
      {
        materialId: firstMat.id,
        quantity: '50',
        purchaseUnit: firstMat.purchaseUnit,
        receivedKg: firstMat.purchaseUnit === 'kg' ? '50' : '0',
        receivedPieces: firstMat.trackingMode === 'dual_kg_units' ? String(50 * defaultPcsPerKg) : '0',
        unitCostDzd: parseFloat(firstMat.unitCostDzd || '0') > 0 ? firstMat.unitCostDzd : '7',
      },
    ]);
  };

  const handleRemoveItemLine = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    const target = updated[index];
    (target as any)[field] = value;

    const mat = materials.find((m) => m.id === target.materialId);

    if (field === 'materialId') {
      const selected = materials.find((m) => m.id === value);
      if (selected) {
        target.purchaseUnit = selected.purchaseUnit;
        if (parseFloat(selected.unitCostDzd || '0') > 0) {
          target.unitCostDzd = selected.unitCostDzd;
        }
        const qty = parseFloat(target.quantity || '0');
        const defaultRate = parseFloat(selected.piecesPerKg || '0') > 0 ? parseFloat(selected.piecesPerKg) : 50;
        if (selected.trackingMode === 'dual_kg_units') {
          target.receivedKg = String(qty);
          target.receivedPieces = String(Math.round(qty * defaultRate));
        }
      }
    }

    if (field === 'quantity') {
      const qty = parseFloat(value || '0');
      if (mat && mat.trackingMode === 'dual_kg_units') {
        const curKg = parseFloat(target.receivedKg || '0');
        const curPcs = parseFloat(target.receivedPieces || '0');
        const effectiveRate = curKg > 0 && curPcs > 0 ? (curPcs / curKg) : (parseFloat(mat.piecesPerKg || '0') > 0 ? parseFloat(mat.piecesPerKg) : 50);
        target.receivedKg = String(qty);
        target.receivedPieces = String(Math.round(qty * effectiveRate));
      }
    }

    if (field === 'supplierPiecesPerKg') {
      const rate = parseFloat(value || '0');
      const qty = parseFloat(target.quantity || '0');
      if (rate > 0 && qty > 0) {
        target.receivedKg = String(qty);
        target.receivedPieces = String(Math.round(qty * rate));
      }
    }

    if (field === 'gramPerPiece') {
      const grams = parseFloat(value || '0');
      const qty = parseFloat(target.quantity || '0');
      if (grams > 0 && qty > 0) {
        const rate = 1000 / grams;
        target.receivedKg = String(qty);
        target.receivedPieces = String(Math.round(qty * rate));
      }
    }

    if (field === 'receivedPieces') {
      target.receivedPieces = value;
      const qty = parseFloat(target.quantity || '0');
      if (qty > 0) {
        target.receivedKg = String(qty);
      }
    }

    setItems(updated);
  };

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createPurchase(
        {
          supplierId: selectedSupplierId,
          invoiceNumber,
          purchaseDate,
          freightCostDzd: freightCost,
          notes: purchaseNotes,
          items,
        },
        token
      );
      setIsAddPurchaseModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error creating purchase invoice');
    }
  };

  const handleConfirmReceive = (purchase: Purchase) => {
    if (purchase.receiptStatus === 'received') return;
    setReceiveTarget(purchase);
  };

  const handleExecuteReceiveStock = async () => {
    if (!receiveTarget) return;
    setIsReceivingStock(true);
    try {
      await api.receivePurchase(receiveTarget.id, token);
      setFeedbackBanner({
        type: 'success',
        message: `Purchased raw materials from ${receiveTarget.purchaseNumber} have been successfully received and added to inventory balances!`,
      });
      setTimeout(() => setFeedbackBanner(null), 6000);
      setReceiveTarget(null);
      await loadData();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: err.message || 'Failed to receive purchase into inventory stock',
      });
    } finally {
      setIsReceivingStock(false);
    }
  };

  const handleSubmitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSupplier(supplierFormData, token);
      setIsAddSupplierModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error creating supplier');
    }
  };

  const handleOpenEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setEditSupplierFormData({
      name: supplier.name || '',
      contactPerson: supplier.contactPerson || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      openingBalanceDzd: String(parseFloat(supplier.openingBalanceDzd || '0')),
      notes: supplier.notes || '',
      isActive: supplier.isActive ?? true,
    });
    setIsEditSupplierModalOpen(true);
  };

  const handleSubmitEditSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;
    try {
      setIsSubmittingEditSupplier(true);
      await api.updateSupplier(
        editingSupplier.id,
        {
          name: editSupplierFormData.name,
          contactPerson: editSupplierFormData.contactPerson,
          phone: editSupplierFormData.phone,
          address: editSupplierFormData.address,
          openingBalanceDzd: editSupplierFormData.openingBalanceDzd,
          notes: editSupplierFormData.notes,
          isActive: editSupplierFormData.isActive,
        },
        token
      );
      showUndoToast(editingSupplier.id, `Fournisseur "${editSupplierFormData.name}" modifié`);
      setIsEditSupplierModalOpen(false);
      setEditingSupplier(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating supplier');
    } finally {
      setIsSubmittingEditSupplier(false);
    }
  };

  const handleDeleteSupplier = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
  };

  const handleConfirmDeleteSupplier = async () => {
    if (!supplierToDelete) return;
    try {
      setIsDeletingSupplier(true);
      const res = await api.deleteSupplier(supplierToDelete.id, token);
      showUndoToast(supplierToDelete.id, `Fournisseur "${supplierToDelete.name}" supprimé`);
      setFeedbackBanner({
        type: 'success',
        message: res.message || `Fournisseur "${supplierToDelete.name}" supprimé. Cliquez sur "Annuler" pour restaurer.`,
      });
      setTimeout(() => setFeedbackBanner(null), 5000);
      setSupplierToDelete(null);
      await loadData();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: err.message || 'Erreur lors de la suppression du fournisseur',
      });
    } finally {
      setIsDeletingSupplier(false);
    }
  };

  const handleDeleteAllSuppliers = async () => {
    if (suppliers.length === 0) return;
    try {
      setLoading(true);
      const res = await api.deleteAllSuppliers(token);
      showUndoToast('all', `Tous les fournisseurs (${res.count || suppliers.length}) supprimés`);
      setFeedbackBanner({
        type: 'success',
        message: `Tous les fournisseurs (${res.count || suppliers.length}) ont été supprimés avec succès. Utilisez "Annuler" pour restaurer.`,
      });
      setTimeout(() => setFeedbackBanner(null), 6000);
      await loadData();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: err.message || 'Erreur lors de la suppression de tous les fournisseurs',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewStatement = async (supplierId: string) => {
    try {
      const data = await api.getSupplierStatement(supplierId);
      setStatementData(data);
      setIsStatementModalOpen(true);
    } catch (err) {
      alert('Failed to load supplier statement');
    }
  };

  // Handlers for Edit Purchase Invoice
  const handleOpenEditPurchase = (p: Purchase) => {
    setEditingPurchase(p);
    setEditPurchaseForm({
      supplierId: p.supplierId || '',
      invoiceNumber: p.invoiceNumber || '',
      purchaseDate: p.purchaseDate || new Date().toISOString().split('T')[0],
      freightCost: String(parseFloat(p.freightCostDzd || '0')),
      notes: p.notes || '',
      paymentStatus: (p.paymentStatus as any) || 'unpaid',
      amountPaidDzd: String(parseFloat(p.amountPaidDzd || '0')),
      modificationReason: '',
      items: (p.items || []).map((it) => ({
        id: it.id,
        materialId: it.materialId,
        quantity: String(parseFloat(it.quantity || '0')),
        purchaseUnit: it.purchaseUnit || 'kg',
        receivedKg: String(parseFloat(it.receivedKg || it.quantity || '0')),
        receivedPieces: String(parseFloat(it.receivedPieces || '0')),
        unitCostDzd: String(parseFloat(it.unitCostDzd || '0')),
      })),
    });
    setIsEditPurchaseModalOpen(true);
  };

  const handleEditItemChange = (index: number, field: string, value: string) => {
    const updated = [...editPurchaseForm.items];
    const target = { ...updated[index], [field]: value };
    updated[index] = target;

    const mat = materials.find((m) => m.id === target.materialId);

    if (field === 'materialId') {
      const selected = materials.find((m) => m.id === value);
      if (selected) {
        target.purchaseUnit = selected.purchaseUnit;
        if (parseFloat(selected.unitCostDzd || '0') > 0) {
          target.unitCostDzd = selected.unitCostDzd;
        }
        const qty = parseFloat(target.quantity || '0');
        const defaultRate = parseFloat(selected.piecesPerKg || '0') > 0 ? parseFloat(selected.piecesPerKg) : 50;
        if (selected.trackingMode === 'dual_kg_units') {
          target.receivedKg = String(qty);
          target.receivedPieces = String(Math.round(qty * defaultRate));
        }
      }
    }

    if (field === 'quantity') {
      const qty = parseFloat(value || '0');
      if (mat && mat.trackingMode === 'dual_kg_units') {
        const curKg = parseFloat(target.receivedKg || '0');
        const curPcs = parseFloat(target.receivedPieces || '0');
        const effectiveRate = curKg > 0 && curPcs > 0 ? (curPcs / curKg) : (parseFloat(mat.piecesPerKg || '0') > 0 ? parseFloat(mat.piecesPerKg) : 50);
        target.receivedKg = String(qty);
        target.receivedPieces = String(Math.round(qty * effectiveRate));
      }
    }

    if (field === 'supplierPiecesPerKg') {
      const rate = parseFloat(value || '0');
      const qty = parseFloat(target.quantity || '0');
      if (rate > 0 && qty > 0) {
        target.receivedKg = String(qty);
        target.receivedPieces = String(Math.round(qty * rate));
      }
    }

    if (field === 'gramPerPiece') {
      const grams = parseFloat(value || '0');
      const qty = parseFloat(target.quantity || '0');
      if (grams > 0 && qty > 0) {
        const rate = 1000 / grams;
        target.receivedKg = String(qty);
        target.receivedPieces = String(Math.round(qty * rate));
      }
    }

    if (field === 'receivedPieces') {
      target.receivedPieces = value;
      const qty = parseFloat(target.quantity || '0');
      if (qty > 0) {
        target.receivedKg = String(qty);
      }
    }

    setEditPurchaseForm({ ...editPurchaseForm, items: updated });
  };

  const handleAddEditItem = () => {
    if (materials.length === 0) {
      alert('Veuillez ajouter des matières premières au préalable.');
      return;
    }
    const firstMat = materials[0];
    const defaultPcsPerKg = parseFloat(firstMat.piecesPerKg || '0') > 0 ? parseFloat(firstMat.piecesPerKg) : 50;
    setEditPurchaseForm({
      ...editPurchaseForm,
      items: [
        ...editPurchaseForm.items,
        {
          materialId: firstMat.id,
          quantity: '50',
          purchaseUnit: firstMat.purchaseUnit,
          receivedKg: firstMat.purchaseUnit === 'kg' ? '50' : '0',
          receivedPieces: firstMat.trackingMode === 'dual_kg_units' ? String(50 * defaultPcsPerKg) : '0',
          unitCostDzd: parseFloat(firstMat.unitCostDzd || '0') > 0 ? firstMat.unitCostDzd : '7',
        },
      ],
    });
  };

  const handleRemoveEditItem = (index: number) => {
    if (editPurchaseForm.items.length <= 1) {
      alert('Un bon de commande fournisseur doit comporter au moins un article.');
      return;
    }
    const updated = editPurchaseForm.items.filter((_, idx) => idx !== index);
    setEditPurchaseForm({ ...editPurchaseForm, items: updated });
  };

  const handleSubmitEditPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurchase) return;
    try {
      setIsSubmittingEditPurchase(true);
      await api.updatePurchase(
        editingPurchase.id,
        {
          supplierId: editPurchaseForm.supplierId,
          invoiceNumber: editPurchaseForm.invoiceNumber,
          purchaseDate: editPurchaseForm.purchaseDate,
          freightCostDzd: editPurchaseForm.freightCost,
          notes: editPurchaseForm.notes,
          paymentStatus: editPurchaseForm.paymentStatus,
          amountPaidDzd: editPurchaseForm.amountPaidDzd,
          items: editPurchaseForm.items,
          modifierName: profile?.fullName || 'Abdallah (Owner)',
          modifierRole: profile?.role || 'owner',
          modificationDetails: editPurchaseForm.modificationReason.trim()
            ? `Motif: ${editPurchaseForm.modificationReason.trim()}`
            : undefined,
        },
        token
      );
      showUndoToast(editingPurchase.id, `Bon d'achat "${editingPurchase.purchaseNumber}" modifié`);
      setIsEditPurchaseModalOpen(false);
      setEditingPurchase(null);
      setFeedbackBanner({
        type: 'success',
        message: `Bon d'achat ${editingPurchase.purchaseNumber} modifié avec succès et consigné dans l'historique d'audit !`,
      });
      setTimeout(() => setFeedbackBanner(null), 5000);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la modification de la facture fournisseur');
    } finally {
      setIsSubmittingEditPurchase(false);
    }
  };

  const handleOpenLogs = async (p: Purchase) => {
    setSelectedPurchaseForLogs(p);
    setIsLogsModalOpen(true);
    setPurchaseLogsLoading(true);
    try {
      const logs = await api.getPurchaseLogs(p.id);
      setFetchedLogs(logs);
    } catch (err) {
      setFetchedLogs(p.logs || []);
    } finally {
      setPurchaseLogsLoading(false);
    }
  };

  const handleConfirmDeletePurchase = async () => {
    if (!purchaseToDelete) return;
    try {
      setIsDeletingPurchase(true);
      const res = await api.deletePurchase(purchaseToDelete.id, token);
      showUndoToast(purchaseToDelete.id, `Bon d'achat "${purchaseToDelete.purchaseNumber}" supprimé`);
      setFeedbackBanner({
        type: 'success',
        message: res.message || `Bon d'achat ${purchaseToDelete.purchaseNumber} supprimé. Cliquez sur "Annuler" pour restaurer.`,
      });
      setTimeout(() => setFeedbackBanner(null), 5000);
      setPurchaseToDelete(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression du bon d\'achat');
    } finally {
      setIsDeletingPurchase(false);
    }
  };

  const handleDeleteAllPurchases = async () => {
    if (purchases.length === 0) return;
    if (!window.confirm(`ATTENTION : Confirmez-vous la suppression de TOUTES les factures & bons d'achat (${purchases.length} document(s)) ? Vos données et stocks associés pourront être restaurés grâce au système d'Annulation (Undo).`)) {
      return;
    }
    try {
      setLoading(true);
      const res = await api.deleteAllPurchases(token);
      showUndoToast('all', `Factures & bons d'achat (${res.count || purchases.length}) supprimés`);
      setFeedbackBanner({
        type: 'success',
        message: `Toutes les factures d'achat (${res.count || purchases.length}) ont été supprimées. Utilisez le bouton "Annuler" pour restaurer.`,
      });
      setTimeout(() => setFeedbackBanner(null), 6000);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression de toutes les factures d\'achat');
    } finally {
      setLoading(false);
    }
  };

  // Calculations for new purchase modal
  const subtotal = items.reduce(
    (sum, it) => sum + parseFloat(it.quantity || '0') * parseFloat(it.unitCostDzd || '0'),
    0
  );
  const total = subtotal + parseFloat(freightCost || '0');

  // Calculations for edit purchase modal
  const editSubtotal = editPurchaseForm.items.reduce(
    (sum, it) => sum + parseFloat(it.quantity || '0') * parseFloat(it.unitCostDzd || '0'),
    0
  );
  const editTotal = editSubtotal + parseFloat(editPurchaseForm.freightCost || '0');

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide shadow-2xs ${
                activeTab === 'purchases'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {activeTab === 'purchases' ? (
                <>
                  <Truck className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Module Achats & Bons de Commande</span>
                </>
              ) : (
                <>
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Module Répertoire Fournisseurs</span>
                </>
              )}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {activeTab === 'purchases' ? 'Purchases & Purchase Invoices' : 'Suppliers Directory & Balances'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mt-0.5">
            {activeTab === 'purchases'
              ? 'Raw material purchases, supplier invoice modifications with full user audit history, stock intake & payment tracking.'
              : 'Directory of suppliers, debts, contact details, opening balances, and account statements.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'suppliers' ? (
            <>
              {(profile?.role === 'owner' || profile?.role === 'admin') && suppliers.length > 0 && (
                <button
                  onClick={handleDeleteAllSuppliers}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 shadow-2xs transition"
                  title="Supprimer tous les fournisseurs (Annulable avec Undo)"
                >
                  <Trash2 className="h-4 w-4 text-rose-600" />
                  Supprimer tout ({suppliers.length})
                </button>
              )}
              <button
                onClick={() => setIsAddSupplierModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm transition"
              >
                <Plus className="h-4 w-4" />
                Nouveau Fournisseur
              </button>
            </>
          ) : (
            <>
              {(profile?.role === 'owner' || profile?.role === 'admin') && purchases.length > 0 && (
                <button
                  onClick={handleDeleteAllPurchases}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 shadow-2xs transition"
                  title="Supprimer toutes les factures et bons d'achat (Annulable avec Undo)"
                >
                  <Trash2 className="h-4 w-4 text-rose-600" />
                  Supprimer tout ({purchases.length})
                </button>
              )}
              <button
                onClick={handleOpenAddPurchase}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm transition"
              >
                <Plus className="h-4 w-4" />
                Nouveau Bon d'Achat
              </button>
            </>
          )}
        </div>
      </div>

      {/* Instant Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`rounded-xl p-3.5 text-xs flex items-center justify-between border ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            {feedbackBanner.type === 'success' ? (
              <PackageCheck className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            onClick={() => setFeedbackBanner(null)}
            className="text-xs font-bold underline opacity-75 hover:opacity-100"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Primary Top Navigation Tabs */}
      <div className="border-b border-slate-200 bg-white px-2 rounded-t-xl">
        <nav className="flex space-x-6">
          <button
            onClick={() => handleTabSwitch('purchases')}
            className={`flex items-center gap-2 border-b-2 py-3 px-2 text-sm font-bold transition ${
              activeTab === 'purchases'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="h-4.5 w-4.5" />
            <span>Factures & Bons d'Achat ({purchases.length})</span>
          </button>

          <button
            onClick={() => handleTabSwitch('suppliers')}
            className={`flex items-center gap-2 border-b-2 py-3 px-2 text-sm font-bold transition ${
              activeTab === 'suppliers'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="h-4.5 w-4.5" />
            <span>Annuaire Fournisseurs ({suppliers.length})</span>
          </button>
        </nav>
      </div>

      {/* Tab 1: Purchases */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
          {/* Mobile Purchases Cards List (Visible on Phone Screens) */}
          <div className="space-y-3 md:hidden">
            {purchases.length > 0 ? (
              purchases.map((p) => {
                const totalVal = parseFloat(p.totalAmountDzd || '0');
                const paidVal = parseFloat(p.amountPaidDzd || '0');
                const balance = Math.max(0, totalVal - paidVal);

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
                            {p.receiptStatus === 'received' ? 'En Stock' : 'En attente'}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm mt-1">{p.supplier?.name || 'Fournisseur'}</h3>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {formatDate(p.purchaseDate)} {p.invoiceNumber && `• Réf: ${p.invoiceNumber}`}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-black text-sm text-slate-900">{formatDZD(p.totalAmountDzd)}</div>
                        {balance > 0 ? (
                          <span className="text-[10px] font-bold text-rose-600">Reste: {formatDZD(balance)}</span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600">Payé intégralement</span>
                        )}
                      </div>
                    </div>

                    {/* Items */}
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 text-xs space-y-1">
                      {p.items?.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] text-slate-700">
                          <span>• {it.quantity} {it.purchaseUnit} {it.material?.name || 'Matière'}</span>
                          <span className="font-mono font-medium">{formatDZD(it.totalCostDzd)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Creator / Modified By Info */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Créé par : <strong className="text-slate-700">{p.createdByName || 'Abdallah (Owner)'}</strong></span>
                      <button
                        type="button"
                        onClick={() => handleOpenLogs(p)}
                        className="inline-flex items-center gap-1 text-indigo-600 font-bold hover:underline"
                      >
                        <History className="h-3 w-3" />
                        <span>Logs ({p.logs?.length || 0})</span>
                      </button>
                    </div>

                    {/* Actions: Edit, Delete, Payment, Receive */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <Badge variant={p.paymentStatus === 'paid' ? 'success' : p.paymentStatus === 'partial' ? 'warning' : 'danger'}>
                          Paiement: {p.paymentStatus}
                        </Badge>

                        {p.receiptStatus === 'pending' ? (
                          <button
                            onClick={() => handleConfirmReceive(p)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 flex items-center gap-1 shadow-xs"
                          >
                            <PackageCheck className="h-3.5 w-3.5" />
                            Réceptionner Stock
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                            ✓ Entré en stock
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          onClick={() => handleOpenEditPurchase(p)}
                          className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-amber-200 bg-amber-50 text-xs font-bold text-amber-800 hover:bg-amber-100 transition shadow-2xs"
                        >
                          <Pencil className="h-3.5 w-3.5 text-amber-600" />
                          <span>Modifier</span>
                        </button>
                        <button
                          onClick={() => handleOpenModifyPayment(p)}
                          className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
                        >
                          <CreditCard className="h-3.5 w-3.5 text-indigo-600" />
                          <span>Paiement</span>
                        </button>
                        <button
                          onClick={() => setPurchaseToDelete(p)}
                          className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shadow-2xs"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                          <span>Supprimer</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                Aucun bon de commande fournisseur enregistré.
              </div>
            )}
          </div>

          {/* Desktop Table (Hidden on Phone Screens) */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">PO # / Date</th>
                    <th className="py-3 px-4">Fournisseur</th>
                    <th className="py-3 px-4">Articles Achetés</th>
                    <th className="py-3 px-4 text-right">Montant Facture</th>
                    <th className="py-3 px-4 text-right">Payé</th>
                    <th className="py-3 px-4 text-right">Solde Dû</th>
                    <th className="py-3 px-4 text-center">Statut Stock</th>
                    <th className="py-3 px-4 text-center">Paiement</th>
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
                            {p.invoiceNumber && (
                              <div className="text-[10px] text-slate-500">Réf: {p.invoiceNumber}</div>
                            )}
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Par: <strong className="text-slate-600">{p.createdByName || 'Abdallah (Owner)'}</strong>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-900">{p.supplier?.name || 'Fournisseur'}</span>
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="space-y-0.5">
                              {p.items && p.items.length > 0 ? (
                                p.items.map((it) => (
                                  <div key={it.id} className="truncate text-[11px] text-slate-600">
                                    • <strong className="text-indigo-700">{it.quantity} {it.purchaseUnit}</strong> {it.material?.name || 'Matière'}
                                  </div>
                                ))
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                            {formatDZD(p.totalAmountDzd)}
                          </td>
                          <td className="py-3.5 px-4 text-right text-emerald-600 font-medium">
                            {formatDZD(p.amountPaidDzd)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-rose-600">
                            {formatDZD(balance)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <Badge variant={p.receiptStatus === 'received' ? 'success' : 'warning'}>
                              {p.receiptStatus === 'received' ? 'En Stock Atelier' : 'En attente entrée'}
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
                              {/* Option: Receive Stock */}
                              {p.receiptStatus === 'pending' ? (
                                <button
                                  onClick={() => handleConfirmReceive(p)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-2xs transition"
                                  title="Ajouter les matières premières reçues au stock"
                                >
                                  <PackageCheck className="h-3 w-3" />
                                  <span>Entrée Stock</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">✓ En Stock</span>
                              )}

                              {/* Option: Edit Purchase Invoice */}
                              <button
                                onClick={() => handleOpenEditPurchase(p)}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 shadow-2xs transition"
                                title="Modifier les articles, fournisseur, montant ou date de ce bon d'achat"
                              >
                                <Pencil className="h-3 w-3 text-amber-600" />
                                <span>Modifier</span>
                              </button>

                              {/* Option: Audit Logs */}
                              <button
                                onClick={() => handleOpenLogs(p)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 shadow-2xs transition"
                                title="Voir qui a créé ou modifié ce bon d'achat et quand"
                              >
                                <History className="h-3 w-3 text-slate-500" />
                                <span>Logs ({p.logs?.length || 0})</span>
                              </button>

                              {/* Option: Payment */}
                              <button
                                onClick={() => handleOpenModifyPayment(p)}
                                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 shadow-2xs transition"
                                title="Modifier le statut de paiement et montant réglé"
                              >
                                <CreditCard className="h-3 w-3 text-indigo-600" />
                                <span>Paiement</span>
                              </button>

                              {/* Option: Delete */}
                              <button
                                onClick={() => setPurchaseToDelete(p)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 shadow-2xs transition"
                                title="Supprimer ce bon d'achat"
                              >
                                <Trash2 className="h-3 w-3 text-rose-600" />
                                <span>Supprimer</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Aucun bon de commande fournisseur enregistré pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Suppliers Directory */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          {/* Mobile Suppliers Cards List */}
          <div className="space-y-3 md:hidden">
            {suppliers.length > 0 ? (
              suppliers.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2.5 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-indigo-600">{s.code}</span>
                      <h3 className="font-bold text-slate-900 text-sm mt-0.5">{s.name}</h3>
                      {s.contactPerson && (
                        <div className="text-xs text-slate-500 mt-0.5">Contact: {s.contactPerson}</div>
                      )}
                      {s.phone && (
                        <div className="text-xs font-mono text-slate-600 mt-0.5">{s.phone}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Dette Fournisseur</div>
                      <div className="font-black text-sm text-rose-600">{formatDZD(s.outstandingBalance)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Total Factures</span>
                      <span className="font-bold text-slate-800">{formatDZD(s.totalPurchases)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Total Paiements</span>
                      <span className="font-bold text-emerald-600">{formatDZD(s.totalPayments)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleViewStatement(s.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <FileText className="h-3.5 w-3.5 text-indigo-600" />
                      Relevé
                    </button>
                    <button
                      onClick={() => handleOpenEditSupplier(s)}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      <Pencil className="h-3.5 w-3.5 text-indigo-600" />
                      Modifier
                    </button>
                    {(profile?.role === 'owner' || profile?.role === 'admin') && (
                      <button
                        onClick={() => handleDeleteSupplier(s)}
                        className="rounded-lg border border-rose-200 bg-rose-50 p-1 text-rose-600 hover:bg-rose-100"
                        title="Supprimer ce fournisseur (Annulable avec Undo)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                Aucun fournisseur enregistré.
              </div>
            )}
          </div>

          {/* Desktop Suppliers Table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Code / Supplier</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Phone / Address</th>
                    <th className="py-3 px-4 text-right">Total Invoices</th>
                    <th className="py-3 px-4 text-right">Total Payments</th>
                    <th className="py-3 px-4 text-right">Outstanding Debt</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {suppliers.length > 0 ? (
                    suppliers.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-mono text-[11px] font-bold text-indigo-600">{s.code}</div>
                          <div className="font-bold text-slate-900 mt-0.5">{s.name}</div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">{s.contactPerson || '—'}</td>
                        <td className="py-3.5 px-4">
                          <div className="text-slate-800">{s.phone || '—'}</div>
                          <div className="text-[11px] text-slate-400">{s.address || '—'}</div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium">
                          {formatDZD(s.totalPurchases)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-emerald-600">
                          {formatDZD(s.totalPayments)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-rose-600">
                          {formatDZD(s.outstandingBalance)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleViewStatement(s.id)}
                              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                              title="Voir le relevé de compte"
                            >
                              <FileText className="h-3 w-3 text-indigo-600" />
                              Relevé
                            </button>
                            <button
                              onClick={() => handleOpenEditSupplier(s)}
                              className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 shadow-xs transition"
                              title="Modifier ce fournisseur"
                            >
                              <Pencil className="h-3 w-3 text-indigo-600" />
                              Modifier
                            </button>
                            {(profile?.role === 'owner' || profile?.role === 'admin') && (
                              <button
                                onClick={() => handleDeleteSupplier(s)}
                                className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                title="Supprimer ce fournisseur"
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
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No suppliers recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* New Purchase Invoice Modal */}
      <Modal
        isOpen={isAddPurchaseModalOpen}
        onClose={() => setIsAddPurchaseModalOpen(false)}
        title="Record Raw Material Purchase Invoice"
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmitPurchase} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Invoice #</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                placeholder="e.g. FACT-2026-90"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Date *</label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>
          </div>

          {/* Item Lines */}
          <div className="border rounded-lg border-slate-200 p-3 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Materials Purchased</span>
              <button
                type="button"
                onClick={handleAddItemLine}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Material Line
              </button>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => {
                const mat = materials.find((m) => m.id === it.materialId);
                const isDual = mat?.trackingMode === 'dual_kg_units';

                return (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 p-2.5 rounded-lg bg-white border border-slate-200 text-xs shadow-xs"
                  >
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <label className="text-[10px] text-slate-400 block mb-0.5">Material</label>
                        <select
                          value={it.materialId}
                          onChange={(e) => handleItemChange(idx, 'materialId', e.target.value)}
                          className="w-full rounded border border-slate-300 p-1.5 text-xs"
                        >
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.purchaseUnit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 block mb-0.5">
                          Quantity ({it.purchaseUnit})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={it.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full rounded border border-slate-300 p-1.5 text-xs font-mono"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 block mb-0.5">Unit Cost (DZD)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={it.unitCostDzd}
                          onChange={(e) => handleItemChange(idx, 'unitCostDzd', e.target.value)}
                          className="w-full rounded border border-slate-300 p-1.5 text-xs font-mono"
                        />
                      </div>

                      <div className="col-span-2 text-right">
                        <label className="text-[10px] text-slate-400 block mb-0.5">Line Total</label>
                        <div className="font-bold text-slate-900 pt-1">
                          {formatDZD(parseFloat(it.quantity || '0') * parseFloat(it.unitCostDzd || '0'))}
                        </div>
                      </div>

                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItemLine(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 mt-3"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {isDual && (
                      <div className="pt-2 border-t border-slate-100 bg-indigo-50/60 p-2.5 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
                            <span>📦 Spécification de livraison fournisseur (Sacs)</span>
                          </span>
                          <span className="text-[10px] text-indigo-700 font-mono">
                            {parseFloat(it.receivedKg || '0') > 0 && parseFloat(it.receivedPieces || '0') > 0 ? (
                              <span>
                                ≈ {(parseFloat(it.receivedPieces) / parseFloat(it.receivedKg)).toFixed(1)} pcs/kg • {(1000 / (parseFloat(it.receivedPieces) / parseFloat(it.receivedKg))).toFixed(1)}g / pièce
                              </span>
                            ) : null}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                              Poids par pièce (ex: 12g ou 20g)
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.1"
                                placeholder="ex: 14.3"
                                value={
                                  parseFloat(it.receivedKg || '0') > 0 && parseFloat(it.receivedPieces || '0') > 0
                                    ? (1000 / (parseFloat(it.receivedPieces) / parseFloat(it.receivedKg))).toFixed(1)
                                    : ''
                                }
                                onChange={(e) => handleItemChange(idx, 'gramPerPiece', e.target.value)}
                                className="w-full rounded border border-slate-300 bg-white p-1 text-xs font-mono font-bold"
                              />
                              <span className="text-[10px] text-slate-500 font-bold">g</span>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                              Rendement (ex: 50 ou 70 pcs/kg)
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.1"
                                placeholder="ex: 70"
                                value={
                                  parseFloat(it.receivedKg || '0') > 0 && parseFloat(it.receivedPieces || '0') > 0
                                    ? (parseFloat(it.receivedPieces) / parseFloat(it.receivedKg)).toFixed(1)
                                    : ''
                                }
                                onChange={(e) => handleItemChange(idx, 'supplierPiecesPerKg', e.target.value)}
                                className="w-full rounded border border-slate-300 bg-white p-1 text-xs font-mono font-bold"
                              />
                              <span className="text-[10px] text-slate-500 font-bold">pcs/kg</span>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                              Total Pièces Reçues en Stock
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="1"
                                placeholder="ex: 3500"
                                value={it.receivedPieces}
                                onChange={(e) => handleItemChange(idx, 'receivedPieces', e.target.value)}
                                className="w-full rounded border border-slate-300 bg-white p-1 text-xs font-mono font-bold text-indigo-700"
                              />
                              <span className="text-[10px] text-slate-500 font-bold">pcs</span>
                            </div>
                          </div>
                        </div>

                        {parseFloat(it.receivedPieces || '0') > 0 && (
                          <div className="text-[10px] text-indigo-800 flex items-center justify-between pt-1 border-t border-indigo-100">
                            <span>
                              Arrivage : <strong>{it.quantity} kg</strong> livrés = <strong>{it.receivedPieces} sacs</strong> ajoutés au stock
                            </span>
                            <span>
                              Coût réel unitaire : <strong>
                                {((parseFloat(it.quantity || '0') * parseFloat(it.unitCostDzd || '0')) / parseFloat(it.receivedPieces)).toFixed(2)} DZD/sac
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Frais de Transport (DZD)</label>
              <input
                type="number"
                step="0.01"
                value={freightCost}
                onChange={(e) => setFreightCost(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono font-bold"
                placeholder="ex: 2000"
              />
              <span className="text-[10px] text-indigo-700 font-medium block mt-1">
                💡 Les frais de transport sont automatiquement répartis et ajoutés au prix unitaire/kg de chaque matière lors de l'entrée en stock.
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-right">
              <span className="text-xs text-slate-500">Total Purchase Liability:</span>
              <div className="text-xl font-black text-indigo-600">{formatDZD(total)}</div>
              <span className="text-[10px] text-slate-400">Subtotal: {formatDZD(subtotal)} + Freight: {formatDZD(freightCost)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={purchaseNotes}
              onChange={(e) => setPurchaseNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="e.g. Delivery received at workshop door by transporteur"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddPurchaseModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
            >
              Create Purchase Invoice
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Supplier Modal */}
      <Modal
        isOpen={isAddSupplierModalOpen}
        onClose={() => setIsAddSupplierModalOpen(false)}
        title="Add Raw Material Supplier"
        maxWidth="md"
      >
        <form onSubmit={handleSubmitSupplier} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Company Name *</label>
            <input
              type="text"
              required
              value={supplierFormData.name}
              onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="e.g. Plastique du Nord SARL"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={supplierFormData.contactPerson}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, contactPerson: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={supplierFormData.phone}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Address / Industrial Zone</label>
            <input
              type="text"
              value={supplierFormData.address}
              onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="e.g. Zone Industrielle Oued Smar, Algiers"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Balance (DZD)</label>
            <input
              type="number"
              step="0.01"
              value={supplierFormData.openingBalanceDzd}
              onChange={(e) => setSupplierFormData({ ...supplierFormData, openingBalanceDzd: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={supplierFormData.notes}
              onChange={(e) => setSupplierFormData({ ...supplierFormData, notes: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddSupplierModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
            >
              Save Supplier
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Supplier Modal */}
      <Modal
        isOpen={isEditSupplierModalOpen}
        onClose={() => {
          setIsEditSupplierModalOpen(false);
          setEditingSupplier(null);
        }}
        title={`Modifier le Fournisseur : ${editingSupplier?.name || ''} (${editingSupplier?.code || ''})`}
        maxWidth="md"
      >
        <form onSubmit={handleSubmitEditSupplier} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nom du Fournisseur / Entreprise *</label>
            <input
              type="text"
              required
              value={editSupplierFormData.name}
              onChange={(e) => setEditSupplierFormData({ ...editSupplierFormData, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold"
              placeholder="ex: SARL PolyBag Plastique"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Principal</label>
              <input
                type="text"
                value={editSupplierFormData.contactPerson}
                onChange={(e) => setEditSupplierFormData({ ...editSupplierFormData, contactPerson: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                placeholder="ex: M. Khaled"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Téléphone</label>
              <input
                type="text"
                value={editSupplierFormData.phone}
                onChange={(e) => setEditSupplierFormData({ ...editSupplierFormData, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
                placeholder="ex: 0550 12 34 56"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Adresse / Zone Industrielle</label>
            <input
              type="text"
              value={editSupplierFormData.address}
              onChange={(e) => setEditSupplierFormData({ ...editSupplierFormData, address: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="ex: Zone Industrielle Oued Smar, Alger"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Solde Initial / Antérieur (DZD)</label>
              <input
                type="number"
                step="0.01"
                value={editSupplierFormData.openingBalanceDzd}
                onChange={(e) => setEditSupplierFormData({ ...editSupplierFormData, openingBalanceDzd: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Statut du Fournisseur</label>
              <select
                value={editSupplierFormData.isActive ? 'active' : 'inactive'}
                onChange={(e) => setEditSupplierFormData({ ...editSupplierFormData, isActive: e.target.value === 'active' })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold"
              >
                <option value="active">Actif (Partenaire en cours)</option>
                <option value="inactive">Inactif / Suspendu</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes &amp; Conditions Commerciales</label>
            <textarea
              rows={2}
              value={editSupplierFormData.notes}
              onChange={(e) => setEditSupplierFormData({ ...editSupplierFormData, notes: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="Conditions de paiement, délais de livraison, remises..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setIsEditSupplierModalOpen(false);
                setEditingSupplier(null);
              }}
              disabled={isSubmittingEditSupplier}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmittingEditSupplier}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmittingEditSupplier ? 'Enregistrement...' : 'Enregistrer les Modifications'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Supplier Account Statement Modal (Printable) */}
      <Modal
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
        title={`Supplier Statement: ${statementData?.supplier?.name || ''}`}
        maxWidth="3xl"
      >
        {statementData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <div>
                <h4 className="font-extrabold text-base text-slate-900">{statementData.supplier.name}</h4>
                <p className="text-xs text-slate-500">Contact: {statementData.supplier.contactPerson} • {statementData.supplier.phone}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500">Current Balance Owed:</span>
                <div className="text-xl font-black text-rose-600">{formatDZD(statementData.currentBalance)}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3 text-right">Invoice (Debit)</th>
                    <th className="py-2.5 px-3 text-right">Payment (Credit)</th>
                    <th className="py-2.5 px-3 text-right">Running Balance</th>
                    <th className="py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {statementData.timeline.map((row: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2 px-3 font-mono text-[11px]">{formatDate(row.date)}</td>
                      <td className="py-2 px-3 font-mono text-indigo-600">{row.reference}</td>
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
                <Printer className="h-4 w-4" /> Print Statement
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

      {/* Receive Stock Confirmation Modal (Zero window.confirm blocking) */}
      <Modal
        isOpen={!!receiveTarget}
        onClose={() => setReceiveTarget(null)}
        title={`Receive Stock into Inventory: ${receiveTarget?.purchaseNumber || ''}`}
        maxWidth="md"
      >
        {receiveTarget && (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 space-y-1">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <PackageCheck className="h-4 w-4 text-emerald-600" />
                <span>Verify Stock Reception</span>
              </div>
              <p className="text-[11px] text-emerald-700">
                This will record verified inventory movements in the raw material ledger and immediately update warehouse stock quantities.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Supplier:</span>
                <strong className="text-slate-900 font-bold">{receiveTarget.supplier?.name || 'Supplier'}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Purchase Date:</span>
                <span className="font-mono text-slate-800">{formatDate(receiveTarget.purchaseDate)}</span>
              </div>
              {receiveTarget.invoiceNumber && (
                <div className="flex justify-between items-center text-slate-600">
                  <span>Supplier Invoice #:</span>
                  <span className="font-mono font-bold text-slate-900">{receiveTarget.invoiceNumber}</span>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Materials to be Added to Inventory:
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {receiveTarget.items && receiveTarget.items.length > 0 ? (
                  receiveTarget.items.map((it, idx) => (
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
                onClick={() => setReceiveTarget(null)}
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
                <span>{isReceivingStock ? 'Adding to Inventory...' : 'Confirm & Add Stock to Inventory'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Purchase Invoice Modal */}
      <Modal
        isOpen={isEditPurchaseModalOpen}
        onClose={() => setIsEditPurchaseModalOpen(false)}
        title={`Modifier la Facture Fournisseur : ${editingPurchase?.purchaseNumber || ''}`}
        maxWidth="2xl"
      >
        {editingPurchase && (
          <form onSubmit={handleSubmitEditPurchase} className="space-y-4">
            {editingPurchase.receiptStatus === 'received' && (
              <div className="rounded-xl p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Attention : Marchandises déjà reçues en stock</strong>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Toute modification des quantités ajustera automatiquement le registre des mouvements de stock et l'inventaire réel de l'atelier pour préserver une comptabilité exacte.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fournisseur</label>
                <select
                  required
                  value={editPurchaseForm.supplierId}
                  onChange={(e) => setEditPurchaseForm({ ...editPurchaseForm, supplierId: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-indigo-500 focus:outline-hidden"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">N° Facture / BL Fournisseur</label>
                <input
                  type="text"
                  placeholder="ex. FACT-2026-894"
                  value={editPurchaseForm.invoiceNumber}
                  onChange={(e) => setEditPurchaseForm({ ...editPurchaseForm, invoiceNumber: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono font-bold focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date d'Achat</label>
                <input
                  type="date"
                  required
                  value={editPurchaseForm.purchaseDate}
                  onChange={(e) => setEditPurchaseForm({ ...editPurchaseForm, purchaseDate: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Line Items Section */}
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Articles & Matières Premières Achetées
                </label>
                <button
                  type="button"
                  onClick={handleAddEditItem}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter une ligne
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {editPurchaseForm.items.map((it, idx) => {
                  const lineTotal = (parseFloat(it.quantity || '0') * parseFloat(it.unitCostDzd || '0')).toFixed(2);
                  const mat = materials.find((m) => m.id === it.materialId);
                  const isDual = mat?.trackingMode === 'dual_kg_units';

                  return (
                    <div
                      key={idx}
                      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-xs"
                    >
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <select
                            value={it.materialId}
                            onChange={(e) => handleEditItemChange(idx, 'materialId', e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-semibold"
                          >
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.purchaseUnit})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              required
                              placeholder="Quantité"
                              value={it.quantity}
                              onChange={(e) => handleEditItemChange(idx, 'quantity', e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold"
                            />
                            <span className="text-[11px] font-bold text-slate-400">{it.purchaseUnit}</span>
                          </div>
                        </div>

                        <div className="col-span-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              placeholder="Prix unit."
                              value={it.unitCostDzd}
                              onChange={(e) => handleEditItemChange(idx, 'unitCostDzd', e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold"
                            />
                            <span className="text-[10px] text-slate-400 font-mono">DZD</span>
                          </div>
                        </div>

                        <div className="col-span-2 flex items-center justify-between">
                          <span className="font-mono font-bold text-[11px] text-slate-900 truncate">
                            {formatDZD(lineTotal)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveEditItem(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded"
                            title="Supprimer la ligne"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {isDual && (
                        <div className="pt-2 border-t border-slate-200/60 bg-indigo-50/50 p-2 rounded-lg space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-indigo-900">
                              📦 Livraison Sacs (Qualité Fournisseur)
                            </span>
                            <span className="text-[10px] text-indigo-700 font-mono">
                              {parseFloat(it.receivedKg || '0') > 0 && parseFloat(it.receivedPieces || '0') > 0 ? (
                                <span>
                                  ≈ {(parseFloat(it.receivedPieces) / parseFloat(it.receivedKg)).toFixed(1)} pcs/kg • {(1000 / (parseFloat(it.receivedPieces) / parseFloat(it.receivedKg))).toFixed(1)}g / sac
                                </span>
                              ) : null}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[9px] font-semibold text-slate-500 block">Poids/pièce</label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  placeholder="14.3"
                                  value={
                                    parseFloat(it.receivedKg || '0') > 0 && parseFloat(it.receivedPieces || '0') > 0
                                      ? (1000 / (parseFloat(it.receivedPieces) / parseFloat(it.receivedKg))).toFixed(1)
                                      : ''
                                  }
                                  onChange={(e) => handleEditItemChange(idx, 'gramPerPiece', e.target.value)}
                                  className="w-full rounded border border-slate-300 bg-white p-1 text-[11px] font-mono font-bold"
                                />
                                <span className="text-[9px] text-slate-400 font-bold">g</span>
                              </div>
                            </div>

                            <div>
                              <label className="text-[9px] font-semibold text-slate-500 block">Rendement</label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  placeholder="70"
                                  value={
                                    parseFloat(it.receivedKg || '0') > 0 && parseFloat(it.receivedPieces || '0') > 0
                                      ? (parseFloat(it.receivedPieces) / parseFloat(it.receivedKg)).toFixed(1)
                                      : ''
                                  }
                                  onChange={(e) => handleEditItemChange(idx, 'supplierPiecesPerKg', e.target.value)}
                                  className="w-full rounded border border-slate-300 bg-white p-1 text-[11px] font-mono font-bold"
                                />
                                <span className="text-[9px] text-slate-400 font-bold">pcs/kg</span>
                              </div>
                            </div>

                            <div>
                              <label className="text-[9px] font-semibold text-slate-500 block">Total Pièces</label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="1"
                                  placeholder="3500"
                                  value={it.receivedPieces}
                                  onChange={(e) => handleEditItemChange(idx, 'receivedPieces', e.target.value)}
                                  className="w-full rounded border border-slate-300 bg-white p-1 text-[11px] font-mono font-bold text-indigo-700"
                                />
                                <span className="text-[9px] text-slate-400 font-bold">pcs</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Freight and Totals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-200 pt-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Frais de transport (DZD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editPurchaseForm.freightCost}
                  onChange={(e) => setEditPurchaseForm({ ...editPurchaseForm, freightCost: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold font-mono"
                />
              </div>

              <div className="flex flex-col justify-center rounded-xl bg-slate-100 p-3 text-right">
                <span className="text-[11px] text-slate-500">Sous-total : {formatDZD(editSubtotal)}</span>
                <span className="text-base font-black text-indigo-700">Total Facture : {formatDZD(editTotal)}</span>
              </div>
            </div>

            {/* Payment status in edit */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Statut de Paiement</label>
                <select
                  value={editPurchaseForm.paymentStatus}
                  onChange={(e) => setEditPurchaseForm({ ...editPurchaseForm, paymentStatus: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold"
                >
                  <option value="unpaid">Non Payé (Unpaid)</option>
                  <option value="partial">Acompte Partiel (Partial)</option>
                  <option value="paid">Payé Intégralement (Paid)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Montant Réglé (DZD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editPurchaseForm.amountPaidDzd}
                  onChange={(e) => setEditPurchaseForm({ ...editPurchaseForm, amountPaidDzd: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold font-mono"
                />
              </div>
            </div>

            {/* Reason for modification (Audit Trail) */}
            <div>
              <label className="block text-xs font-bold text-indigo-900 mb-1">
                Motif de la modification (Consigné dans le journal d'audit)
              </label>
              <input
                type="text"
                placeholder="ex. Rectification du prix matière ou ajustement suite réception réelle..."
                value={editPurchaseForm.modificationReason}
                onChange={(e) => setEditPurchaseForm({ ...editPurchaseForm, modificationReason: e.target.value })}
                className="w-full rounded-xl border border-indigo-200 bg-indigo-50/40 p-2.5 text-xs text-indigo-950 font-medium placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Observations</label>
              <textarea
                rows={2}
                value={editPurchaseForm.notes}
                onChange={(e) => setEditPurchaseForm({ ...editPurchaseForm, notes: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs"
                placeholder="Remarques éventuelles sur la livraison..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsEditPurchaseModalOpen(false)}
                disabled={isSubmittingEditPurchase}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmittingEditPurchase}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition disabled:opacity-50"
              >
                <Pencil className="h-4 w-4" />
                <span>{isSubmittingEditPurchase ? 'Enregistrement...' : 'Enregistrer les Modifications'}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Purchase Invoice Confirmation Modal */}
      <Modal
        isOpen={!!purchaseToDelete}
        onClose={() => setPurchaseToDelete(null)}
        title={`Supprimer le Bon d'Achat : ${purchaseToDelete?.purchaseNumber || ''}`}
        maxWidth="md"
      >
        {purchaseToDelete && (
          <div className="space-y-4">
            <div className="rounded-xl p-3.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>Confirmation de suppression définitive</span>
              </div>
              <p className="text-[11px] text-rose-700">
                Êtes-vous certain de vouloir supprimer le bon de commande <strong className="font-mono">{purchaseToDelete.purchaseNumber}</strong> du fournisseur <strong>{purchaseToDelete.supplier?.name}</strong> pour un montant de <strong>{formatDZD(purchaseToDelete.totalAmountDzd)}</strong> ?
              </p>
            </div>

            {purchaseToDelete.receiptStatus === 'received' && (
              <div className="rounded-xl p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800">
                  <strong>Réversion automatique des stocks :</strong> Comme ce bon d'achat a déjà été réceptionné dans l'atelier, les matières premières associées seront automatiquement retirées du stock pour maintenir l'exactitude de l'inventaire.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setPurchaseToDelete(null)}
                disabled={isDeletingPurchase}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePurchase}
                disabled={isDeletingPurchase}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-sm transition disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isDeletingPurchase ? 'Suppression...' : 'Confirmer la Suppression'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Purchase Audit Logs Modal */}
      <Modal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
        title={`Historique & Journal d'Audit : ${selectedPurchaseForLogs?.purchaseNumber || ''}`}
        maxWidth="lg"
      >
        {selectedPurchaseForLogs && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Fournisseur :</span>
                <span className="font-bold text-slate-900">{selectedPurchaseForLogs.supplier?.name || 'Fournisseur'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Date du bon d'achat :</span>
                <span className="font-mono text-slate-800">{formatDate(selectedPurchaseForLogs.purchaseDate)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Créé initialement par :</span>
                <span className="font-bold text-indigo-700">{selectedPurchaseForLogs.createdByName || 'Abdallah (Owner)'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Modifications & Actions Récentes
              </h4>

              {purchaseLogsLoading ? (
                <div className="p-6 text-center text-xs text-slate-400 animate-pulse">
                  Chargement de l'historique...
                </div>
              ) : fetchedLogs.length > 0 ? (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {fetchedLogs.map((log: any, idx: number) => (
                    <div
                      key={log.id || idx}
                      className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700">
                            {log.action}
                          </span>
                          <span className="font-bold text-slate-900">{log.userName || 'Opérateur'}</span>
                          {log.userRole && (
                            <span className="text-[10px] text-slate-400 capitalize">({log.userRole})</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 bg-slate-50/70 p-2 rounded-lg border border-slate-100 mt-1">
                        {log.modification}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-400">
                  Aucune modification enregistrée pour ce bon d'achat.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsLogsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Supplier Confirmation Modal (Zero window.confirm) */}
      <Modal
        isOpen={!!supplierToDelete}
        onClose={() => setSupplierToDelete(null)}
        title={`Supprimer le Fournisseur : ${supplierToDelete?.name || ''}`}
        maxWidth="md"
      >
        {supplierToDelete && (
          <div className="space-y-4">
            <div className="rounded-xl p-3.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>Confirmation de suppression</span>
              </div>
              <p className="text-[11px] text-rose-700">
                Êtes-vous sûr de vouloir supprimer le fournisseur <strong>{supplierToDelete.name}</strong> ({supplierToDelete.code}) ? Cette opération peut être immédiatement annulée via l'historique d'annulation (Undo).
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                disabled={isDeletingSupplier}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSupplier}
                disabled={isDeletingSupplier}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-sm transition disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isDeletingSupplier ? 'Suppression...' : 'Confirmer la Suppression'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
