import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../services/api.ts';
import { UndoOperation } from '../types/erp.ts';
import { useAuth } from './AuthContext.tsx';

interface UndoToastData {
  id: string;
  operationId: string;
  description: string;
  timestamp: number;
}

interface UndoContextType {
  history: UndoOperation[];
  loading: boolean;
  undoCount: number;
  latestUndoable: UndoOperation | null;
  refreshHistory: () => Promise<void>;
  undoOperation: (id: string) => Promise<boolean>;
  undoLatest: () => Promise<boolean>;
  showUndoToast: (operationId: string, description: string) => void;
  isUndoModalOpen: boolean;
  setIsUndoModalOpen: (open: boolean) => void;
  activeToast: UndoToastData | null;
  dismissToast: () => void;
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

export const UndoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, profile } = useAuth();
  const [history, setHistory] = useState<UndoOperation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isUndoModalOpen, setIsUndoModalOpen] = useState<boolean>(false);
  const [activeToast, setActiveToast] = useState<UndoToastData | null>(null);

  const refreshHistory = useCallback(async () => {
    if (!profile) return;
    try {
      setLoading(true);
      const list = await api.getUndoHistory(token);
      setHistory(list);
    } catch (err) {
      // Background fetch silently fails if offline
    } finally {
      setLoading(false);
    }
  }, [token, profile]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // Listen to cross-tab & SSE sync events
  useEffect(() => {
    const handleSync = () => {
      refreshHistory();
    };
    window.addEventListener('an_erp_sync', handleSync);
    return () => window.removeEventListener('an_erp_sync', handleSync);
  }, [refreshHistory]);

  // Global Keyboard Shortcut: Ctrl+Z / Cmd+Z to Undo latest action
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        // Do not intercept if active element is an input, textarea or contenteditable
        const activeEl = document.activeElement;
        const isInputField =
          activeEl &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            (activeEl as HTMLElement).isContentEditable);

        if (!isInputField && profile) {
          e.preventDefault();
          undoLatest();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [profile, history]);

  // Show Toast
  const showUndoToast = (operationId: string, description: string) => {
    setActiveToast({
      id: `toast-${Date.now()}`,
      operationId,
      description,
      timestamp: Date.now(),
    });
    refreshHistory();
  };

  const dismissToast = () => {
    setActiveToast(null);
  };

  const undoOperation = async (id: string): Promise<boolean> => {
    try {
      const res = await api.executeUndo(id, token);
      dismissToast();
      await refreshHistory();
      window.dispatchEvent(new CustomEvent('an_erp_sync', { detail: { action: 'undo', id } }));
      return res.success;
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'annulation');
      return false;
    }
  };

  const undoLatest = async (): Promise<boolean> => {
    try {
      const res = await api.executeLatestUndo(token);
      dismissToast();
      await refreshHistory();
      window.dispatchEvent(new CustomEvent('an_erp_sync', { detail: { action: 'undo_latest' } }));
      return res.success;
    } catch (err: any) {
      alert(err.message || 'Aucune opération récente à annuler');
      return false;
    }
  };

  const undoCount = history.filter((op) => !op.isUndone).length;
  const latestUndoable = history.find((op) => !op.isUndone) || null;

  return (
    <UndoContext.Provider
      value={{
        history,
        loading,
        undoCount,
        latestUndoable,
        refreshHistory,
        undoOperation,
        undoLatest,
        showUndoToast,
        isUndoModalOpen,
        setIsUndoModalOpen,
        activeToast,
        dismissToast,
      }}
    >
      {children}
    </UndoContext.Provider>
  );
};

export const useUndo = () => {
  const ctx = useContext(UndoContext);
  if (!ctx) {
    throw new Error('useUndo must be used within an UndoProvider');
  }
  return ctx;
};
