import React, { useEffect } from 'react';
import { useUndo } from '../../context/UndoContext.tsx';
import { RotateCcw, X, AlertCircle } from 'lucide-react';

export const UndoToast: React.FC = () => {
  const { activeToast, dismissToast, undoOperation } = useUndo();

  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      dismissToast();
    }, 9000); // 9 seconds visible
    return () => clearTimeout(timer);
  }, [activeToast]);

  if (!activeToast) return null;

  return (
    <aside
      aria-label="Notification d'annulation"
      className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-50 max-w-sm w-full animate-bounce-in shadow-2xl"
    >
      <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 shadow-indigo-500/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 shrink-0 border border-amber-500/30">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
              Opération Enregistrée
            </div>
            <div className="text-xs text-slate-200 truncate font-medium">
              {activeToast.description}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => undoOperation(activeToast.operationId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            title="Annuler cette action immédiatement (Ctrl+Z)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Annuler</span>
          </button>
          <button
            type="button"
            onClick={dismissToast}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
