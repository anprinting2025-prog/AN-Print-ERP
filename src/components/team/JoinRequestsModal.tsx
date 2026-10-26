import React from 'react';
import { useRealtimeSync } from '../../context/RealtimeSyncContext.tsx';
import { Modal } from '../common/Modal.tsx';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Phone,
  Mail,
  FileText,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Smartphone,
  AlertCircle,
} from 'lucide-react';
import { UserProfile } from '../../types/erp.ts';

export const JoinRequestsModal: React.FC = () => {
  const {
    isJoinRequestsModalOpen,
    setIsJoinRequestsModalOpen,
    pendingRequests,
    pendingCount,
    approveRequest,
    rejectRequest,
    refreshPendingRequests,
    isLiveConnected,
  } = useRealtimeSync();

  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const handleApproveWithRole = async (
    user: UserProfile,
    role: 'owner' | 'admin' | 'commerciale',
    withStockAndPurchases = false
  ) => {
    setLoadingId(user.id);
    let perms: string[] = [];
    if (role === 'owner' || role === 'admin') {
      perms = ['orders', 'inventory', 'purchases', 'customers', 'inactive_clients', 'production', 'suppliers', 'payments', 'expenses', 'reports', 'settings'];
    } else if (withStockAndPurchases) {
      // User requirement: "when i give someone access to order and inventory and purchases you give them the standerd commercial access"
      perms = ['orders', 'inventory', 'purchases', 'customers', 'inactive_clients'];
    } else {
      perms = ['orders', 'customers', 'inactive_clients'];
    }
    await approveRequest(user, { role, permissions: perms });
    setLoadingId(null);
  };

  const handleReject = async (user: UserProfile) => {
    setLoadingId(user.id);
    await rejectRequest(user);
    setLoadingId(null);
  };

  const formatPhoneNumber = (rawPhone?: string) => {
    if (!rawPhone) return '';
    const clean = rawPhone.replace(/\s+/g, '');
    if (clean.startsWith('0')) {
      return `213${clean.substring(1)}`;
    }
    return clean.replace('+', '');
  };

  return (
    <Modal
      isOpen={isJoinRequestsModalOpen}
      onClose={() => setIsJoinRequestsModalOpen(false)}
      title=""
      maxWidth="lg"
    >
      <div className="p-1 space-y-5">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shadow-xs">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Demandes d'Adhésion (Équipe &amp; Rôles)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  {pendingCount} en attente
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Validez les demandes en accordant l'accès Commercial, Administrateur d'Atelier ou Copropriétaire
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshPendingRequests()}
              title="Rafraîchir la liste"
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
              <span className={`h-2 w-2 rounded-full ${isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span>{isLiveConnected ? 'Live Sync Actif' : 'Reconnexion...'}</span>
            </div>
          </div>
        </div>

        {/* List of Pending Requests */}
        {pendingRequests.length === 0 ? (
          <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Smartphone className="h-6 w-6" />
            </div>
            <div className="max-w-sm mx-auto">
              <h3 className="text-sm font-bold text-slate-800">Aucune demande en attente pour le moment</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Lorsqu'un collaborateur ouvre le lien de l'application sur son téléphone et soumet une demande, elle apparaîtra ici instantanément en temps réel !
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {pendingRequests.map((reqUser) => {
              const waNumber = formatPhoneNumber(reqUser.phone);
              const isLoading = loadingId === reqUser.id;

              return (
                <div
                  key={reqUser.id}
                  className="rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/50 via-white to-white p-4 shadow-xs hover:border-amber-300 transition space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900">
                          {reqUser.fullName || 'Sans nom'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 capitalize">
                          Rôle demandé : {reqUser.role || 'commerciale'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-200">
                          <Clock className="h-3 w-3" /> En attente de validation
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-600">
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          <a href={`mailto:${reqUser.email}`} className="hover:underline text-indigo-600">
                            {reqUser.email}
                          </a>
                        </span>
                        {reqUser.phone && (
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            <a href={`tel:${reqUser.phone}`} className="hover:underline text-slate-800">
                              {reqUser.phone}
                            </a>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* WhatsApp Quick Chat Button */}
                    {waNumber && (
                      <a
                        href={`https://wa.me/${waNumber}?text=Bonjour%20${encodeURIComponent(reqUser.fullName)}%2C%20concernant%20votre%20demande%20d%27acc%C3%A8s%20pour%20An%20Printing...`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition shrink-0"
                      >
                        <span>Contacter sur WhatsApp</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  {/* Notes & Region / Wilaya */}
                  {reqUser.notes && (
                    <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/70 text-xs text-slate-700 flex items-start gap-2">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-800">Wilaya &amp; Note du candidat : </span>
                        <span>{reqUser.notes}</span>
                      </div>
                    </div>
                  )}

                  {/* Approval Actions with Role & Permission Choices */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500 font-mono">
                      <div>
                        Mot de passe configuré :{' '}
                        <span className="text-slate-800 font-semibold">{reqUser.password || '••••••••'}</span>
                      </div>
                      <span className="text-slate-400 font-sans">Choisissez le rôle à accorder :</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleReject(reqUser)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 text-xs font-bold transition disabled:opacity-50 mr-auto"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Refuser</span>
                      </button>

                      {/* 1. Standard Commercial */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleApproveWithRole(reqUser, 'commerciale', false)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs hover:shadow transition disabled:opacity-50"
                        title="Commandes, Clients, Suivi"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Valider Commercial Standard</span>
                      </button>

                      {/* 2. Commercial + Stock & Purchases (with automatic standard commercial access) */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleApproveWithRole(reqUser, 'commerciale', true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs hover:shadow transition disabled:opacity-50"
                        title="Commandes, Stock, Achats + Accès Commercial Standard"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Valider Commercial (+ Stock &amp; Achats)</span>
                      </button>

                      {/* 3. Workshop Admin */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleApproveWithRole(reqUser, 'admin')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs hover:shadow transition disabled:opacity-50"
                        title="Gestion complète atelier et équipe"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Valider Admin</span>
                      </button>

                      {/* 4. Owner */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleApproveWithRole(reqUser, 'owner')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-2xs hover:shadow transition disabled:opacity-50"
                        title="Propriétaire associé - Master access"
                      >
                        <span>👑 Valider Propriétaire</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Security & Access Notice */}
        <div className="rounded-xl bg-indigo-50/70 border border-indigo-200 p-3 text-xs text-indigo-900 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">Règle de Sécurité &amp; Permissions : </span>
            Vous pouvez attribuer un rôle de <strong>Commercial</strong> (standard ou avec stock &amp; achats), 
            d'<strong>Administrateur</strong> (gestion d'atelier) ou de <strong>Propriétaire</strong>. 
            Accorder l'accès aux Commandes, au Stock et aux Achats inclut automatiquement l'accès commercial standard (Clients et Suivi Client).
          </div>
        </div>
      </div>
    </Modal>
  );
};
