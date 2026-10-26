import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtimeSync } from '../../context/RealtimeSyncContext.tsx';
import { Printer, Shield, AlertTriangle, LogOut, LogIn, Monitor, Users, RotateCcw } from 'lucide-react';
import { PWAInstallButton } from '../common/PWAInstallButton.tsx';
import { ThemeToggle } from '../common/ThemeToggle.tsx';
import { useUndo } from '../../context/UndoContext.tsx';

interface MobileHeaderProps {
  activeTitle: string;
  lowStockCount?: number;
  pendingOrdersCount?: number;
  onOpenLowStock?: () => void;
  onOpenPendingOrders?: () => void;
  onToggleDesktopMode?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  activeTitle,
  lowStockCount = 0,
  pendingOrdersCount = 0,
  onOpenLowStock,
  onOpenPendingOrders,
  onToggleDesktopMode,
}) => {
  const { profile, user, signOut, signInWithGoogle } = useAuth();
  const { pendingCount, setIsJoinRequestsModalOpen } = useRealtimeSync();
  const { undoCount, setIsUndoModalOpen } = useUndo();

  return (
    <header className="sticky top-0 z-30 flex flex-col border-b border-slate-200 bg-white shadow-xs">
      {/* Primary Top Bar */}
      <div className="flex h-14 w-full items-center justify-between px-3">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold shadow-xs shrink-0">
            <Printer className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-slate-900 tracking-tight">An Printing</span>
              <span className="rounded bg-indigo-50 px-1 py-0.2 text-[9px] font-bold text-indigo-700 border border-indigo-200">
                ERP
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">Algiers • Dinar (DZD)</p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5">
          {/* PWA Install */}
          <PWAInstallButton compact />

          {/* Theme Toggle */}
          <ThemeToggle compact />

          {/* Undo Button - Always Visible */}
          <button
            onClick={() => setIsUndoModalOpen(true)}
            title="Historique des opérations — Annuler / Undo"
            className={`flex items-center gap-1 rounded-lg border px-1.5 py-1 text-[11px] font-bold ${
              undoCount > 0
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            <RotateCcw className="h-3 w-3" />
            <span>{undoCount}</span>
          </button>

          {/* Desktop Mode Toggle button (if on larger screen or simulator) */}
          {onToggleDesktopMode && (
            <button
              onClick={onToggleDesktopMode}
              title="Switch to Full Desktop View"
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
            >
              <Monitor className="h-3 w-3 text-indigo-600" />
              <span className="hidden xs:inline">Desktop</span>
            </button>
          )}

          {/* OWNER & ADMIN: Demandes d'équipe button */}
          {(profile?.role === 'owner' || profile?.role === 'admin') && (
            <button
              onClick={() => setIsJoinRequestsModalOpen(true)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                pendingCount > 0
                  ? 'bg-amber-500 text-white border-amber-600 animate-pulse'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <Users className="h-3 w-3" />
              <span>{pendingCount}</span>
            </button>
          )}

          {/* Role Pill */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
            profile?.role === 'owner'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : profile?.role === 'admin'
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            <Shield className="h-3 w-3" />
            <span>{profile?.role === 'owner' ? '👑 Owner' : profile?.role === 'admin' ? '🛡️ Admin' : '💼 Commerciale'}</span>
          </div>

          {/* Auth */}
          {user ? (
            <button
              onClick={signOut}
              title="Sign Out"
              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="rounded-lg bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-indigo-700"
            >
              <LogIn className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Secondary Quick Ticker / Active View Bar */}
      <div className="flex h-9 items-center justify-between border-t border-slate-100 bg-slate-50/80 px-3 text-xs">
        <span className="font-bold text-slate-800 truncate text-[11px] max-w-[170px]">
          {activeTitle}
        </span>

        {/* Quick Alert Badges */}
        <div className="flex items-center gap-1.5">
          {pendingOrdersCount > 0 && (
            <button
              onClick={onOpenPendingOrders}
              className="flex items-center gap-1 rounded-full bg-indigo-100/70 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-200 transition"
            >
              <span>{pendingOrdersCount}</span>
              <span className="font-normal text-[9px]">Orders</span>
            </button>
          )}

          {lowStockCount > 0 && (
            <button
              onClick={onOpenLowStock}
              className="flex items-center gap-1 rounded-full bg-rose-100 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700 hover:bg-rose-200 transition"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              <span>{lowStockCount} Low</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
