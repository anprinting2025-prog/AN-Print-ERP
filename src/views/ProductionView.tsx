import React, { useEffect, useState } from 'react';
import { api } from '../services/api.ts';
import { ProductionRecord, Order, Material } from '../types/erp.ts';
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
} from 'lucide-react';

export const ProductionView: React.FC = () => {
  const { token, profile } = useAuth();
  const [productionList, setProductionList] = useState<ProductionRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedProduction, setSelectedProduction] = useState<ProductionRecord | null>(null);

  // Form State
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [plannedQty, setPlannedQty] = useState<string>('1000');
  const [completedQty, setCompletedQty] = useState<string>('1000');
  const [rejectedQty, setRejectedQty] = useState<string>('20');
  const [workerName, setWorkerName] = useState<string>(profile?.fullName || 'Workshop Technician');
  const [notes, setNotes] = useState<string>('');

  // Consumption Lines
  const [consumptionLines, setConsumptionLines] = useState<
    Array<{
      materialId: string;
      quantityUsed: string;
      unit: string;
      wasteQuantity: string;
      notes: string;
    }>
  >([]);

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

  const handleOpenAdd = () => {
    const candidateOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
    const firstOrder = candidateOrders.length > 0 ? candidateOrders[0] : orders[0];
    const initialOrderId = firstOrder ? firstOrder.id : '';
    setSelectedOrderId(initialOrderId);

    const firstOrderItems = firstOrder?.items || [];
    const totalOrderPieces = firstOrderItems.reduce((acc, it) => acc + parseFloat(it.quantityPieces || '0'), 0);
    const initialPlanned = totalOrderPieces > 0 ? String(totalOrderPieces) : '1000';

    setPlannedQty(initialPlanned);
    setCompletedQty(initialPlanned);
    setRejectedQty('15');
    setWorkerName(profile?.fullName || 'Technician');
    setNotes('Standard screen printing run');

    // Auto-populate relevant blank bags, ink, and thinner from materials list
    const blankBagMat = materials.find((m) => m.category.startsWith('blank_')) || materials[0];
    const inkMat = materials.find((m) => m.category === 'ink');
    const diluentMat = materials.find((m) => m.category === 'diluent');
    const retarderMat = materials.find((m) => m.category === 'retarder');

    const autoUsage: any[] = [];
    if (blankBagMat) {
      autoUsage.push({
        materialId: blankBagMat.id,
        quantityUsed: initialPlanned,
        unit: blankBagMat.stockUnit,
        wasteQuantity: '15',
        notes: 'Blank bags fed into printing machine',
      });
    }
    if (inkMat) {
      autoUsage.push({
        materialId: inkMat.id,
        quantityUsed: '1.5',
        unit: 'kg',
        wasteQuantity: '0.1',
        notes: 'Screen ink consumed',
      });
    }
    if (diluentMat) {
      autoUsage.push({
        materialId: diluentMat.id,
        quantityUsed: '0.4',
        unit: 'kg',
        wasteQuantity: '0.05',
        notes: 'Solvent thinner added to maintain ink viscosity',
      });
    }
    if (retarderMat) {
      autoUsage.push({
        materialId: retarderMat.id,
        quantityUsed: '0.2',
        unit: 'kg',
        wasteQuantity: '0',
        notes: 'Retarder to prevent screen clogging',
      });
    }

    setConsumptionLines(autoUsage);
    setIsAddModalOpen(true);
  };

  const handleConsumptionChange = (index: number, field: string, value: any) => {
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
    if (!selectedOrderId) {
      alert('Please select an order for production.');
      return;
    }

    try {
      await api.createProduction(
        {
          orderId: selectedOrderId,
          plannedQuantity: plannedQty,
          completedQuantity: completedQty,
          rejectedQuantity: rejectedQty,
          workerName,
          notes,
          usage: consumptionLines,
        },
        token
      );
      setIsAddModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error recording production');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Production & Material Consumption</h1>
          <p className="text-sm text-slate-500">
            Log printing batches, completed & rejected bag counts, ink, thinner, and retarder chemical usage
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
            Log Production & Consumption
          </button>
        </div>
      </div>

      {/* Mobile Production Cards List (Visible on Phone Screens) */}
      <div className="space-y-3 md:hidden">
        {productionList.length > 0 ? (
          productionList.map((pr) => (
            <div
              key={pr.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-600">{pr.productionNumber}</span>
                    <Badge variant={pr.status === 'completed' ? 'success' : 'info'}>
                      {pr.status === 'completed' ? 'Completed' : 'In Progress'}
                    </Badge>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mt-1">
                    {pr.order?.orderNumber} • {pr.order?.customerName}
                  </h3>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Technician: {pr.workerName || 'Staff'} • {formatDate(pr.startDate)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">Completed</span>
                  <div className="font-mono font-bold text-sm text-emerald-600">
                    {pr.completedQuantity} / {pr.plannedQuantity} pcs
                  </div>
                  {parseFloat(pr.rejectedQuantity || '0') > 0 && (
                    <span className="text-[10px] font-semibold text-rose-500">
                      {pr.rejectedQuantity} rejects
                    </span>
                  )}
                </div>
              </div>

              {/* Material Usage Log */}
              {pr.usage && pr.usage.length > 0 && (
                <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 text-xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Materials Consumed:
                  </span>
                  {pr.usage.map((u, i) => (
                    <div key={i} className="flex justify-between items-center text-[11px] text-slate-700">
                      <span>• {u.materialName}</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {u.quantityUsed} {u.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
            No production jobs logged yet.
          </div>
        )}
      </div>

      {/* Desktop Production Table (Hidden on Phone Screens) */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Production # / Date</th>
                <th className="py-3 px-4">Order / Customer</th>
                <th className="py-3 px-4">Technician</th>
                <th className="py-3 px-4 text-right">Planned (pcs)</th>
                <th className="py-3 px-4 text-right">Completed (pcs)</th>
                <th className="py-3 px-4 text-right">Rejected / Waste</th>
                <th className="py-3 px-4">Materials Consumed</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {productionList.length > 0 ? (
                productionList.map((pr) => (
                  <tr key={pr.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-xs font-bold text-indigo-600">{pr.productionNumber}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(pr.startDate)}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{pr.order?.orderNumber || 'Order'}</div>
                      <div className="text-[11px] text-slate-500">{pr.order?.customerName}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">{pr.workerName || 'Staff'}</td>
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
                                <span className="text-rose-500 ml-1">({u.wasteQuantity} waste)</span>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">No usage recorded</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge variant={pr.status === 'completed' ? 'success' : 'info'}>
                        {pr.status === 'completed' ? 'Completed' : 'In Progress'}
                      </Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No production jobs logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Production Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Log Printing Production & Actual Material Consumption"
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmitProduction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Printing Order *</label>
              <select
                required
                value={selectedOrderId}
                onChange={(e) => {
                  setSelectedOrderId(e.target.value);
                  const ord = orders.find((o) => o.id === e.target.value);
                  if (ord) {
                    const totalPieces = ord.items?.reduce(
                      (acc, it) => acc + parseFloat(it.quantityPieces || '0'),
                      0
                    );
                    if (totalPieces) {
                      setPlannedQty(String(totalPieces));
                      setCompletedQty(String(totalPieces));
                    }
                  }
                }}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} - {o.customerName} ({o.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Technician / Responsible Worker *</label>
              <input
                type="text"
                required
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Planned Quantity (pcs) *</label>
              <input
                type="number"
                required
                value={plannedQty}
                onChange={(e) => setPlannedQty(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Actual Completed (pcs) *</label>
              <input
                type="number"
                required
                value={completedQty}
                onChange={(e) => setCompletedQty(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Rejected / Defective Bags (pcs)</label>
              <input
                type="number"
                value={rejectedQty}
                onChange={(e) => setRejectedQty(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>
          </div>

          {/* Actual Material Consumption Builder */}
          <div className="border rounded-lg border-slate-200 p-3 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800">Actual Workshop Material Consumption</span>
                <p className="text-[11px] text-slate-500">
                  Entered manually by the technician. Exact stock movements are recorded automatically in the ledger.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddConsumptionLine}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Consumable
              </button>
            </div>

            <div className="space-y-2">
              {consumptionLines.map((line, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 p-2.5 rounded-lg bg-white border border-slate-200 text-xs shadow-xs items-center"
                >
                  <div className="col-span-5">
                    <label className="text-[10px] text-slate-400 block mb-0.5">Material Consumed</label>
                    <select
                      value={line.materialId}
                      onChange={(e) => handleConsumptionChange(idx, 'materialId', e.target.value)}
                      className="w-full rounded border border-slate-300 p-1.5 text-xs"
                    >
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.stockUnit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-3">
                    <label className="text-[10px] text-slate-400 block mb-0.5">
                      Quantity Used ({line.unit})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={line.quantityUsed}
                      onChange={(e) => handleConsumptionChange(idx, 'quantityUsed', e.target.value)}
                      className="w-full rounded border border-slate-300 p-1.5 text-xs font-mono"
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="text-[10px] text-slate-400 block mb-0.5">
                      Waste / Spill ({line.unit})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={line.wasteQuantity}
                      onChange={(e) => handleConsumptionChange(idx, 'wasteQuantity', e.target.value)}
                      className="w-full rounded border border-slate-300 p-1.5 text-xs font-mono"
                    />
                  </div>

                  <div className="col-span-1 text-right pt-3">
                    <button
                      type="button"
                      onClick={() => handleRemoveConsumptionLine(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Production Run Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              placeholder="e.g. Screen mesh 90T used, ink dried quickly with ambient 28°C"
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
              Record Production & Deduct Stock
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
