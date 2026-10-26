import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Menu, Printer, Shield, User, LogOut, LogIn, RefreshCw, Users, RotateCcw } from 'lucide-react';
import { PWAInstallButton } from './common/PWAInstallButton.tsx';
import { ThemeToggle } from './common/ThemeToggle.tsx';
import { useRealtimeSync } from '../context/RealtimeSyncContext.tsx';
import { useUndo } from '../context/UndoContext.tsx';

interface NavbarProps {
  onToggleSidebar: () => void;
  activeViewTitle: string;
  onToggleMobilePreview?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  activeViewTitle,
  onToggleMobilePreview,
}) => {
  const { profile, signOut, openAuthModal } = useAuth();
  const { pendingCount, setIsJoinRequestsModalOpen, isLiveConnected, forceSyncAll } = useRealtimeSync();
  const { undoCount, setIsUndoModalOpen } = useUndo();
  const isOwner = profile?.role === 'owner';
  const isAdmin = profile?.role === 'admin';
  const isOwnerOrAdmin = isOwner || isAdmin;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-6 md:px-8 shadow-xs">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold shadow-xs shrink-0">
            <Printer className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold text-slate-900 tracking-tight text-sm sm:text-base md:text-lg">
                An Printing
              </span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                ERP
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">Algiers, Algeria • Dinar (DZD)</p>
          </div>
        </div>

        <div className="hidden md:flex items-center ml-4 pl-4 lg:ml-6 lg:pl-6 border-l border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">{activeViewTitle}</h2>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Google Sheets-like Live Sync Indicator */}
        <button
          onClick={() => forceSyncAll()}
          title="Synchronisation en direct (comme Google Sheets). Cliquez pour forcer la synchronisation."
          className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition ${
            isLiveConnected
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
              : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
          <span className="font-mono text-[10px]">{isLiveConnected ? 'Live Sync' : 'Syncing...'}</span>
        </button>

        {/* OWNER & ADMIN FEATURE: Demandes en attente */}
        {isOwnerOrAdmin && (
          <button
            onClick={() => setIsJoinRequestsModalOpen(true)}
            title="Consulter et valider les demandes d'accès soumises par smartphone"
            className={`relative inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition shadow-xs ${
              pendingCount > 0
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-600 shadow-amber-500/20 animate-pulse'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Demandes d'Équipe</span>
            <span className="sm:hidden">Demandes</span>
            {pendingCount > 0 ? (
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 text-[10px] font-black rounded-full bg-white text-orange-600">
                {pendingCount}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-normal">0</span>
            )}
          </button>
        )}

        {/* Toggle Mobile Phone Simulator Mode */}
        {onToggleMobilePreview && (
          <button
            onClick={onToggleMobilePreview}
            title="Preview Mobile Smartphone Version"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 shadow-xs transition"
          >
            <span className="text-sm">📱</span>
            <span>Mobile View</span>
          </button>
        )}

        {/* PWA In-App Install Button */}
        <PWAInstallButton compact />

        {/* Global Dark/Light Theme Toggle */}
        <ThemeToggle compact />

        {/* Undo History & Rollback (Latest 10 operations) - Always Visible */}
        <button
          onClick={() => setIsUndoModalOpen(true)}
          title="Historique des 10 dernières opérations — Annuler / Undo (Ctrl+Z)"
          className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold shadow-2xs transition active:scale-95 ${
            undoCount > 0
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 animate-pulse-subtle'
              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          <RotateCcw className={`h-3.5 w-3.5 ${undoCount > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
          <span className="hidden sm:inline">Undo</span>
          <span className={`inline-flex items-center justify-center h-4 min-w-[16px] px-1 text-[10px] font-black rounded-full ${
            undoCount > 0
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          }`}>
            {undoCount}
          </span>
        </button>

        {/* Role badge */}
        <div className={`hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${
          profile?.role === 'owner'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : profile?.role === 'admin'
            ? 'bg-blue-50 border-blue-200 text-blue-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <Shield className="h-3.5 w-3.5" />
          <span>
            {profile?.role === 'owner'
              ? '👑 Propriétaire'
              : profile?.role === 'admin'
              ? '🛡️ Admin'
              : '💼 Commerciale'}
          </span>
        </div>

        {/* User profile / login button */}
        {profile ? (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 pl-1 py-1 pr-2 rounded-lg bg-slate-50 border border-slate-200">
              <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-800 max-w-[130px] truncate leading-tight">
                  {profile?.fullName || profile?.email}
                </div>
                <div className="text-[10px] text-slate-500 capitalize">
                  {profile?.role === 'owner' ? 'Propriétaire' : profile?.role === 'admin' ? 'Administrateur' : 'Commerciale'}
                </div>
              </div>
            </div>

            <button
              onClick={signOut}
              title="Sign Out"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => openAuthModal('signup')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition"
            >
              <span>Sign Up</span>
            </button>
            <button
              onClick={() => openAuthModal('login')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition shadow-xs"
            >
              <LogIn className="h-3.5 w-3.5" /> <span>Sign In</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
