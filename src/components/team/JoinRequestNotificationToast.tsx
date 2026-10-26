import React from 'react';
import { useRealtimeSync } from '../../context/RealtimeSyncContext.tsx';
import { Sparkles, CheckCircle, X, Users, Phone, Mail } from 'lucide-react';

export const JoinRequestNotificationToast: React.FC = () => {
  const {
    latestRequestNotification,
    dismissNotification,
    setIsJoinRequestsModalOpen,
    approveRequest,
  } = useRealtimeSync();

  if (!latestRequestNotification) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="rounded-2xl bg-slate-900/95 backdrop-blur-md text-white p-4 shadow-2xl border border-indigo-500/40 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 animate-bounce">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-black tracking-wide text-amber-400 uppercase flex items-center gap-1.5">
                <span>Nouvelle Demande Reçue !</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div className="text-sm font-bold text-white mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>{latestRequestNotification.fullName || 'Nouveau Membre'}</span>
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {latestRequestNotification.role === 'owner' ? '👑 Copropriétaire' : latestRequestNotification.role === 'admin' ? '🛡️ Admin' : '💼 Commercial'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={dismissNotification}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="text-xs text-slate-300 space-y-1 bg-slate-800/80 rounded-xl p-2.5 font-mono">
          <div className="flex items-center gap-1.5">
            <Mail className="h-3 w-3 text-slate-400" />
            <span>{latestRequestNotification.email}</span>
          </div>
          {latestRequestNotification.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3 text-slate-400" />
              <span>{latestRequestNotification.phone}</span>
            </div>
          )}
          {latestRequestNotification.notes && (
            <div className="text-[11px] text-amber-200/90 font-sans italic mt-1">
              "{latestRequestNotification.notes}"
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              dismissNotification();
              setIsJoinRequestsModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition"
          >
            Examiner les détails
          </button>
          <button
            type="button"
            onClick={async () => {
              await approveRequest(latestRequestNotification);
              dismissNotification();
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black transition flex items-center gap-1 shadow-xs"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            <span>Approuver Direct</span>
          </button>
        </div>
      </div>
    </div>
  );
};
