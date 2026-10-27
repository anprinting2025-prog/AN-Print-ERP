import React, { useEffect } from 'react';
import { useUndo } from '../../context/UndoContext.tsx';
import { Modal } from './Modal.tsx';
import { Badge } from './Badge.tsx';
import { RotateCcw, History, Trash2, Edit3, CheckCircle2, User, Clock, RefreshCw } from 'lucide-react';

export const UndoHistoryModal: React.FC = () => {
  const { isUndoModalOpen, setIsUndoModalOpen, history, undoOperation, refreshHistory, loading } = useUndo();

  // Re-fetch fresh history from server whenever the modal opens
  useEffect(() => {
    if (isUndoModalOpen) {
      refreshHistory();
    }
  }, [isUndoModalOpen, refreshHistory]);

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString();
    } catch {
      return ts;
    }
  };

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'delete':
        return <Badge variant="danger">Suppression</Badge>;
      case 'bulk_delete':
        return <Badge variant="danger">Suppression en Masse</Badge>;
      case 'update':
        return <Badge variant="warning">Modification</Badge>;
      default:
        return <Badge variant="neutral">{actionType}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isUndoModalOpen}
      onClose={() => setIsUndoModalOpen(false)}
      title="Historique des Opérations Récentes (Undo / Annulation)"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold shrink-0">
              <History className="h-4 w-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <span>Journal d'annulation & de restauration</span>
                <span className="rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-[10px] font-bold">
                  {history.length} action(s)
                </span>
              </div>
              <div className="text-slate-500 text-[11px]">
                Vous pouvez annuler toute modification ou suppression récente. Raccourci : <kbd className="px-1 py-0.5 bg-slate-200 text-slate-800 rounded font-mono text-[10px]">Ctrl+Z</kbd>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refreshHistory()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs transition disabled:opacity-50"
            title="Rafraîchir l'historique"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Aucune opération récente dans l'historique d'annulation.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {history.map((op, idx) => (
              <div
                key={op.id}
                className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                  op.isUndone ? 'bg-slate-50/50 opacity-60' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5">
                    {op.actionType === 'update' ? (
                      <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                        <Edit3 className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
                        <Trash2 className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-xs">
                        #{idx + 1} {op.description}
                      </span>
                      {getActionBadge(op.actionType)}
                      {op.isUndone && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> Déjà Annulée
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-400" />
                        {op.performedBy || 'Staff'} ({op.performedByRole || 'owner'})
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {formatTime(op.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {!op.isUndone ? (
                    <button
                      type="button"
                      onClick={() => undoOperation(op.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Annuler l'action (Undo)</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium italic">
                      Restaurée
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setIsUndoModalOpen(false)}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  );
};
