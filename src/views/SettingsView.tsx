import React, { useEffect, useState } from 'react';
import { api } from '../services/api.ts';
import { UserProfile, UserRole } from '../types/erp.ts';
import { formatDZD, formatDate } from '../utils/format.ts';
import { Badge } from '../components/common/Badge.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Settings,
  Users,
  Shield,
  Database,
  Building,
  Save,
  CheckCircle,
  RefreshCw,
  Sparkles,
  Plus,
  UserPlus,
  Key,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  UserCheck,
  Check,
  AlertCircle,
  FileSpreadsheet,
  Download,
} from 'lucide-react';

const AVAILABLE_PERMISSIONS = [
  { id: 'orders', label: 'Orders & Job Cards', desc: 'Create, confirm, and update bag printing orders' },
  { id: 'inventory', label: 'Inventory & Stock Control', desc: 'Track raw bag & ink stocks, pieces/kg, adjustments' },
  { id: 'purchases', label: 'Purchases & Supplies', desc: 'Create supplier purchase orders and stock receipts' },
  { id: 'customers', label: 'Customer CRM & Boutiques', desc: 'Manage client accounts, debts, and WhatsApp contacts' },
  { id: 'inactive_clients', label: 'Client Follow-up & Relance', desc: 'Track inactive customers and client outreach' },
  { id: 'production', label: 'Workshop Production Execution', desc: 'Start print runs, record consumption, track waste' },
  { id: 'suppliers', label: 'Suppliers Directory & Invoices', desc: 'Raw material vendors, debts, and payments' },
  { id: 'payments', label: 'Payments & Debt Settlements', desc: 'Record cash receipts and client debt balance' },
  { id: 'expenses', label: 'Operating Expenses', desc: 'Track electricity, rent, workshop salaries, overheads' },
  { id: 'reports', label: 'Financial Reports & P&L', desc: 'Revenue, profit & loss, and operational analytics' },
  { id: 'settings', label: 'Admin Settings & Team Management', desc: 'Manage system settings and team credentials' },
];

export const SettingsView: React.FC = () => {
  const { token, profile, switchRole } = useAuth();
  const isOwner = profile?.role === 'owner';
  const isAdmin = profile?.role === 'admin';
  const isOwnerOrAdmin = isOwner || isAdmin;

  const [settingsMap, setSettingsMap] = useState<Record<string, string>>({});
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [seedSuccess, setSeedSuccess] = useState<boolean>(false);

  // Form states for Workshop Profile
  const [companyName, setCompanyName] = useState<string>('An Printing');
  const [phone, setPhone] = useState<string>('+213 555 12 34 56');
  const [address, setAddress] = useState<string>('Zone Industrielle, Algiers, Algeria');
  const [taxNumber, setTaxNumber] = useState<string>('NIF-0998877665544');
  const [commercialRegister, setCommercialRegister] = useState<string>('RC-16/00-12345B20');

  // Modals for User Credentials
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState<boolean>(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Database Excel Export & Live Sync States
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<boolean>(false);

  // User credentials form data
  const [teamFilter, setTeamFilter] = useState<'all' | 'owners' | 'admins' | 'commercials' | 'pending'>('all');
  const [userForm, setUserForm] = useState({
    fullName: '',
    email: '',
    role: 'commerciale' as UserRole,
    phone: '',
    password: '',
    permissions: ['orders', 'customers', 'inactive_clients'] as string[],
    isActive: true,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [sData, tData] = await Promise.all([api.getSettings(), api.getTeam(token)]);
      setSettingsMap(sData);
      setTeam(tData);

      if (sData.company_name) setCompanyName(sData.company_name);
      if (sData.phone) setPhone(sData.phone);
      if (sData.address) setAddress(sData.address);
      if (sData.tax_number) setTaxNumber(sData.tax_number);
      if (sData.commercial_register) setCommercialRegister(sData.commercial_register);
    } catch (err) {
      console.error('Failed to load settings:', err);
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
    window.addEventListener('an_team_sync', handleSync);
    return () => {
      window.removeEventListener('an_erp_sync', handleSync);
      window.removeEventListener('an_team_sync', handleSync);
    };
  }, []);

  const handleDownloadExcelDatabase = async () => {
    try {
      setIsExportingExcel(true);
      await api.exportDatabaseExcel(token);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err: any) {
      console.error('Failed to export database instance:', err);
      alert(err.message || 'Error exporting database instance to Excel');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Promise.all([
        api.updateSetting('company_name', companyName, token),
        api.updateSetting('phone', phone, token),
        api.updateSetting('address', address, token),
        api.updateSetting('tax_number', taxNumber, token),
        api.updateSetting('commercial_register', commercialRegister, token),
      ]);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      loadData();
    } catch (err) {
      alert('Failed to save settings');
    }
  };

  // User Credentials Handlers
  const handleOpenAddUser = (defaultRole: UserRole = 'commerciale') => {
    const isElevated = defaultRole === 'owner' || defaultRole === 'admin';
    setUserForm({
      fullName: '',
      email: '',
      role: defaultRole,
      phone: '',
      password: `an${Math.floor(1000 + Math.random() * 9000)}`,
      permissions: isElevated
        ? AVAILABLE_PERMISSIONS.map((p) => p.id)
        : ['orders', 'customers', 'inactive_clients'],
      isActive: true,
    });
    setIsAddUserModalOpen(true);
  };

  const handleOpenEditUser = (user: UserProfile) => {
    setSelectedUser(user);
    setUserForm({
      fullName: user.fullName || '',
      email: user.email || '',
      role: user.role,
      phone: user.phone || '',
      password: user.password || '',
      permissions: Array.isArray(user.permissions) ? user.permissions : ['orders', 'customers', 'inactive_clients'],
      isActive: user.isActive !== undefined ? user.isActive : true,
    });
    setIsEditUserModalOpen(true);
  };

  // Rule: "when i give someone access to order and inventory and purchases you give them the standerd commercial access"
  const togglePermission = (permId: string) => {
    setUserForm((prev) => {
      const exists = prev.permissions.includes(permId);
      let nextPerms = exists
        ? prev.permissions.filter((p) => p !== permId)
        : [...prev.permissions, permId];

      if (
        nextPerms.includes('orders') &&
        nextPerms.includes('inventory') &&
        nextPerms.includes('purchases')
      ) {
        if (!nextPerms.includes('customers')) nextPerms.push('customers');
        if (!nextPerms.includes('inactive_clients')) nextPerms.push('inactive_clients');
      }

      return {
        ...prev,
        permissions: nextPerms,
      };
    });
  };

  const handleSubmitAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createTeamMember(userForm, token);
      setIsAddUserModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error creating user credentials');
    }
  };

  const handleSubmitEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await api.updateTeamMember(selectedUser.id, userForm, token);
      setIsEditUserModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating user credentials');
    }
  };

  const handleApproveUser = async (user: UserProfile, chosenRole?: UserRole) => {
    try {
      const assignedRole = chosenRole || user.role || 'commerciale';
      const assignedPerms = assignedRole === 'owner' || assignedRole === 'admin'
        ? AVAILABLE_PERMISSIONS.map((p) => p.id)
        : ['orders', 'customers', 'inactive_clients'];
      await api.approveTeamMember(user.id, { role: assignedRole, permissions: assignedPerms, isActive: true }, token);
      await loadData();
    } catch (err: any) {
      console.error('Failed to approve user:', err);
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    try {
      await api.deleteTeamMember(user.id, token);
      await loadData();
    } catch (err: any) {
      console.error('Error deleting user:', err);
    }
  };

  const togglePasswordVisibility = (userId: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const handleSeedData = async () => {
    try {
      await api.seedInitialData(token);
      setSeedSuccess(true);
      setTimeout(() => setSeedSuccess(false), 3000);
      await loadData();
    } catch (err: any) {
      console.error('Error seeding database:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Settings & User Credentials</h1>
        <p className="text-sm text-slate-500">
          Administer workshop profile, manage multi-user credentials and permissions, and oversee database setup
        </p>
      </div>

      {/* Role Indicator Banner */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-indigo-600 shrink-0" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-2">
              <span>Rôle de Sécurité Actif :</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black capitalize bg-indigo-600 text-white shadow-2xs">
                {profile?.role === 'owner' ? '👑 Propriétaire / Owner' : profile?.role === 'admin' ? '🛡️ Administrateur / Admin' : '💼 Commerciale'}
              </span>
            </div>
            <p className="text-xs text-indigo-700 mt-0.5">
              {profile?.role === 'owner'
                ? 'Accès Master Propriétaire : Vue intégrale finances, bilans P&L, stocks, achats, exports Excel et administration multi-utilisateurs.'
                : profile?.role === 'admin'
                ? 'Accès Administrateur d’Atelier : Gestion opérationnelle complète (équipes, commandes, stocks, achats et production).'
                : 'Accès Commercial : Commandes, clients et suivi de clientèle. Données financières et bilans masqués.'}
            </p>
          </div>
        </div>

        {isOwner && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-indigo-900">Simuler la vue :</span>
            {(['owner', 'admin', 'commerciale'] as UserRole[]).map((r) => (
              <button
                key={r}
                onClick={() => switchRole(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition ${
                  profile?.role === r
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                }`}
              >
                {r === 'owner' ? '👑 Owner' : r === 'admin' ? '🛡️ Admin' : '💼 Commercial'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 1. Team & User Credentials Management */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Gestion des Utilisateurs &amp; Rôles ({team.length})</h2>
              <p className="text-xs text-slate-500">Ajoutez des administrateurs, copropriétaires et commerciaux avec permissions sur mesure</p>
            </div>
          </div>

          {isOwnerOrAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleOpenAddUser('commerciale')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-100 shadow-2xs transition"
              >
                <UserPlus className="h-4 w-4" /> + Ajouter Commercial
              </button>
              <button
                onClick={() => handleOpenAddUser('admin')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-xs transition"
              >
                <Shield className="h-4 w-4" /> 👑/🛡️ + Ajouter Admin ou Propriétaire
              </button>
            </div>
          )}
        </div>

        {/* Pending Signup Requests Banner */}
        {team.filter((m) => m.isActive === false).length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Demandes d'Adhésion en Attente ({team.filter((m) => m.isActive === false).length})
                </h3>
              </div>
              <span className="text-[11px] text-amber-700">Validez avec le rôle de votre choix (Commercial, Admin ou Propriétaire)</span>
            </div>

            <div className="space-y-2">
              {team
                .filter((m) => m.isActive === false)
                .map((pendingUser) => (
                  <div
                    key={pendingUser.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-amber-200/80 shadow-2xs"
                  >
                    <div>
                      <div className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                        <span>{pendingUser.fullName || 'Nouvel Utilisateur'}</span>
                        <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700 capitalize">
                          Demande : {pendingUser.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {pendingUser.email} {pendingUser.phone && `• ${pendingUser.phone}`}
                      </div>
                      {pendingUser.notes && (
                        <div className="text-[11px] text-amber-900 bg-amber-100/60 rounded px-2 py-0.5 mt-1 font-medium inline-block">
                          Note / Wilaya : {pendingUser.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => handleApproveUser(pendingUser, 'commerciale')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-2xs transition"
                        title="Valider avec Accès Commercial Standard"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Valider Commercial</span>
                      </button>
                      <button
                        onClick={() => handleApproveUser(pendingUser, 'admin')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 shadow-2xs transition"
                        title="Valider avec Rôle Administrateur"
                      >
                        <Shield className="h-3.5 w-3.5" />
                        <span>Valider Admin</span>
                      </button>
                      {isOwner && (
                        <button
                          onClick={() => handleApproveUser(pendingUser, 'owner')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 shadow-2xs transition"
                          title="Valider comme Copropriétaire"
                        >
                          <span>👑 Valider Propriétaire</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEditUser(pendingUser)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Personnaliser
                      </button>
                      <button
                        onClick={() => handleDeleteUser(pendingUser)}
                        className="px-2 py-1.5 rounded-lg border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Role & Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 mr-1">Filtrer l'équipe :</span>
          <button
            type="button"
            onClick={() => setTeamFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition ${
              teamFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tous ({team.length})
          </button>
          <button
            type="button"
            onClick={() => setTeamFilter('owners')}
            className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
              teamFilter === 'owners'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span>👑 Propriétaires</span>
            <span className="text-[10px] opacity-80">({team.filter((m) => m.role === 'owner').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTeamFilter('admins')}
            className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
              teamFilter === 'admins'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            <span>🛡️ Administrateurs</span>
            <span className="text-[10px] opacity-80">({team.filter((m) => m.role === 'admin').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTeamFilter('commercials')}
            className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
              teamFilter === 'commercials'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span>💼 Commerciaux</span>
            <span className="text-[10px] opacity-80">({team.filter((m) => m.role === 'commerciale').length})</span>
          </button>
          {team.filter((m) => m.isActive === false).length > 0 && (
            <button
              type="button"
              onClick={() => setTeamFilter('pending')}
              className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                teamFilter === 'pending'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 animate-pulse'
              }`}
            >
              <span>⏳ En Attente</span>
              <span className="text-[10px] font-black">({team.filter((m) => m.isActive === false).length})</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase">
                <th className="py-2.5 px-3">Membre / Utilisateur</th>
                <th className="py-2.5 px-3">Rôle Système</th>
                <th className="py-2.5 px-3">Identifiants (Mot de passe)</th>
                <th className="py-2.5 px-3">Permissions Actives</th>
                <th className="py-2.5 px-3 text-center">Statut</th>
                {isOwnerOrAdmin && <th className="py-2.5 px-3 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {team
                .filter((m) => {
                  if (teamFilter === 'owners') return m.role === 'owner';
                  if (teamFilter === 'admins') return m.role === 'admin';
                  if (teamFilter === 'commercials') return m.role === 'commerciale';
                  if (teamFilter === 'pending') return m.isActive === false;
                  return true;
                })
                .map((m) => {
                const perms = Array.isArray(m.permissions) ? m.permissions : [];
                const isRevealed = revealedPasswords[m.id];
                const displayPwd = m.password || '••••••••';

                return (
                  <tr key={m.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{m.fullName || 'Utilisateur'}</div>
                      <div className="font-mono text-[11px] text-slate-500">{m.email}</div>
                      {m.phone && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{m.phone}</div>}
                    </td>

                    <td className="py-3 px-3">
                      {m.role === 'owner' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                          👑 Propriétaire
                        </span>
                      ) : m.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs">
                          🛡️ Administrateur
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          💼 Commerciale
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-800 font-semibold">
                          {isRevealed ? displayPwd : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(m.id)}
                          title={isRevealed ? 'Masquer' : 'Afficher'}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded"
                        >
                          {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {m.role === 'owner' || m.role === 'admin' ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded font-black border ${
                            m.role === 'owner' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}>
                            ★ Accès Master Complet
                          </span>
                        ) : perms.length > 0 ? (
                          perms.map((p) => (
                            <span
                              key={p}
                              className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium border border-slate-200 capitalize"
                            >
                              {p}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400">Accès Commercial Standard</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      {m.isActive !== false ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Actif
                        </span>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            En Attente
                          </span>
                          {isOwnerOrAdmin && (
                            <button
                              onClick={() => handleApproveUser(m)}
                              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 shadow-2xs"
                              title="Valider l'accès"
                            >
                              <CheckCircle className="h-2.5 w-2.5" /> Valider
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {isOwnerOrAdmin && (
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditUser(m)}
                            className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            title="Modifier Identifiants & Permissions"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(m)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Supprimer Utilisateur"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Company Information Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Printing Workshop Profile</h2>
          </div>
          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" /> Changes saved
            </span>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Trade Name</label>
              <input
                type="text"
                disabled={!isOwner}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs disabled:bg-slate-100 font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                disabled={!isOwner}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs disabled:bg-slate-100 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Workshop Address & Industrial Zone</label>
            <input
              type="text"
              disabled={!isOwner}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs disabled:bg-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
              <input
                type="text"
                disabled
                value="Dinar Algérien (DZD / DA)"
                className="w-full rounded-lg border border-slate-200 bg-slate-100 p-2 text-xs font-bold text-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fiscal ID (NIF)</label>
              <input
                type="text"
                disabled={!isOwner}
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs disabled:bg-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Trade Register (RC)</label>
              <input
                type="text"
                disabled={!isOwner}
                value={commercialRegister}
                onChange={(e) => setCommercialRegister(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs disabled:bg-slate-100 font-mono"
              />
            </div>
          </div>

          {isOwner && (
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-xs"
              >
                <Save className="h-4 w-4" /> Save Profile Details
              </button>
            </div>
          )}
        </form>
      </div>

      {/* 3. Database Instance Export & Live Multi-Account Sync (User Requirement) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Database Tools & Live Synchronization</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 w-fit">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Multi-User Instance
          </span>
        </div>

        {/* Database Instance Excel (.xlsx) Download Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-emerald-50/80 to-teal-50/80 border border-emerald-200 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
              <h4 className="text-sm font-extrabold text-slate-900">
                Download Complete Database Instance (Excel .xlsx with All Tables)
              </h4>
            </div>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Export all workshop records across <strong>all 14 database tables</strong> (Orders, Order Items, Customers, Inventory Materials, Stock Movements, Purchases, Purchase Items, Suppliers, Payments, Expenses, Production, Settings, and Logs) into an organized multi-sheet Excel spreadsheet.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] font-mono text-emerald-900">
              <span className="bg-white/90 px-2 py-0.5 rounded border border-emerald-200 font-semibold">14 Tables</span>
              <span className="bg-white/90 px-2 py-0.5 rounded border border-emerald-200 font-semibold">14 Dedicated Sheets</span>
              <span className="bg-white/90 px-2 py-0.5 rounded border border-emerald-200 font-semibold">Instant .xlsx Format</span>
            </div>
          </div>

          <button
            onClick={handleDownloadExcelDatabase}
            disabled={isExportingExcel || !isOwner}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-md shadow-emerald-600/20 shrink-0 transition disabled:opacity-50"
          >
            {isExportingExcel ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Exporting Database...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Download Database (.xlsx)</span>
              </>
            )}
          </button>
        </div>

        {exportSuccess && (
          <div className="rounded-lg bg-emerald-50 p-3.5 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center gap-2 shadow-xs">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Database instance successfully exported with all tables into Excel (.xlsx)!</span>
          </div>
        )}

        {/* Live Multi-Account Sync Explanation */}
        <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
              <RefreshCw className="h-4 w-4 text-indigo-600" />
              <span>Real-Time Multi-Account Sync</span>
            </div>
            <p className="text-xs text-indigo-700">
              Any modification (orders, customer follow-ups, statuses, debts) made by any account immediately takes effect across all employee and owner devices without refreshing.
            </p>
          </div>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('an_erp_sync'));
              setSyncFeedback(true);
              setTimeout(() => setSyncFeedback(false), 2000);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-50 shrink-0 transition shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncFeedback ? 'animate-spin' : ''}`} />
            <span>{syncFeedback ? 'Synchronized!' : 'Force Sync Now'}</span>
          </button>
        </div>

        {/* Workshop Data Seeder */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <div>
            <h4 className="text-xs font-bold text-slate-900">Seed Standard Algerian Printing Workshop Data</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Populates standard blank HDPE/LDPE bags, Kraft carton bags, TNT bags, inks, solvents, standard sizes (15×22, 25×35, 30×40), sample clients, and suppliers.
            </p>
          </div>

          <button
            onClick={handleSeedData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-xs shrink-0"
          >
            <Sparkles className="h-4 w-4" /> Seed Workshop Data
          </button>
        </div>

        {seedSuccess && (
          <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Database initialized with standard printing workshop records!
          </div>
        )}
      </div>

      {/* Add User Credentials Modal */}
      <Modal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        title="Add New User Credentials"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitAddUser} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={userForm.fullName}
                onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                placeholder="e.g. Youcef Benali"
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email / Username</label>
              <input
                type="email"
                required
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="e.g. youcef@anprinting.dz"
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">User Role</label>
              <select
                value={userForm.role}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  const newPerms = newRole === 'owner' || newRole === 'admin'
                    ? AVAILABLE_PERMISSIONS.map((p) => p.id)
                    : ['orders', 'customers', 'inactive_clients'];
                  setUserForm({ ...userForm, role: newRole, permissions: newPerms });
                }}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-bold"
              >
                <option value="commerciale">💼 Commerciale (Ventes, Commandes &amp; Clients)</option>
                <option value="admin">🛡️ Admin (Gestionnaire d'Atelier &amp; Équipe)</option>
                <option value="owner">👑 Owner (Propriétaire Associé - Master Access &amp; Finances)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                placeholder="e.g. 0550 12 34 56"
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Login PIN / Password</label>
              <input
                type="text"
                required
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                placeholder="e.g. pass123"
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono font-semibold"
              />
            </div>
          </div>

          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
              <label className="block text-xs font-semibold text-slate-700">Specific Permissions Granted</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-medium">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() =>
                    setUserForm({
                      ...userForm,
                      permissions: ['orders', 'inventory', 'purchases', 'customers', 'inactive_clients'],
                    })
                  }
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                  title="Accès Commercial Standard + Stock & Achats"
                >
                  📦 Commercial + Stock &amp; Achats
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setUserForm({
                      ...userForm,
                      permissions: ['orders', 'customers', 'inactive_clients'],
                    })
                  }
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                >
                  💼 Standard Commercial
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setUserForm({
                      ...userForm,
                      permissions: AVAILABLE_PERMISSIONS.map((p) => p.id),
                    })
                  }
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                >
                  🛡️ Tous les Modules (Admin/Owner)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 max-h-56 overflow-y-auto">
              {AVAILABLE_PERMISSIONS.map((perm) => {
                const checked = userForm.permissions.includes(perm.id);
                return (
                  <label
                    key={perm.id}
                    className="flex items-start gap-2 cursor-pointer p-1.5 rounded hover:bg-slate-100 transition"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(perm.id)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">{perm.label}</div>
                      <div className="text-[10px] text-slate-500 leading-tight">{perm.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200 text-[11px] text-indigo-900 flex items-start gap-2 mt-2">
              <Shield className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Règle Commerciale Automatique : </span>
                Dès que l'accès aux <strong>Commandes</strong>, au <strong>Stock</strong> et aux <strong>Achats</strong> est accordé, l'accès commercial standard (Clients et Suivi Client) est automatiquement inclus.
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddUserModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
            >
              Save Credentials
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Credentials Modal */}
      <Modal
        isOpen={isEditUserModalOpen}
        onClose={() => setIsEditUserModalOpen(false)}
        title="Modify User Credentials & Permissions"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitEditUser} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={userForm.fullName}
                onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email / Username</label>
              <input
                type="email"
                required
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">User Role</label>
              <select
                value={userForm.role}
                disabled={selectedUser?.email === 'abdallahcrypto036@gmail.com' && selectedUser?.id === profile?.id}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  const newPerms = newRole === 'owner' || newRole === 'admin'
                    ? AVAILABLE_PERMISSIONS.map((p) => p.id)
                    : userForm.permissions;
                  setUserForm({ ...userForm, role: newRole, permissions: newPerms });
                }}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-bold disabled:bg-slate-100"
              >
                {selectedUser?.email === 'abdallahcrypto036@gmail.com' && selectedUser?.id === profile?.id ? (
                  <option value="owner">👑 Primary Owner (Abdallah - Master)</option>
                ) : (
                  <>
                    <option value="commerciale">💼 Commerciale (Ventes, Commandes &amp; Clients)</option>
                    <option value="admin">🛡️ Admin (Gestionnaire d'Atelier &amp; Équipe)</option>
                    <option value="owner">👑 Owner (Propriétaire Associé - Master Access &amp; Finances)</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Login PIN / Password</label>
              <input
                type="text"
                required
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono font-semibold"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActiveToggle"
              checked={userForm.isActive}
              onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isActiveToggle" className="text-xs font-bold text-slate-800">
              Account Active &amp; Enabled
            </label>
          </div>

          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
              <label className="block text-xs font-semibold text-slate-700">Specific Permissions Granted</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-medium">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() =>
                    setUserForm({
                      ...userForm,
                      permissions: ['orders', 'inventory', 'purchases', 'customers', 'inactive_clients'],
                    })
                  }
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                  title="Accès Commercial Standard + Stock & Achats"
                >
                  📦 Commercial + Stock &amp; Achats
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setUserForm({
                      ...userForm,
                      permissions: ['orders', 'customers', 'inactive_clients'],
                    })
                  }
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                >
                  💼 Standard Commercial
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setUserForm({
                      ...userForm,
                      permissions: AVAILABLE_PERMISSIONS.map((p) => p.id),
                    })
                  }
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                >
                  🛡️ Tous les Modules (Admin/Owner)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 max-h-56 overflow-y-auto">
              {AVAILABLE_PERMISSIONS.map((perm) => {
                const checked = userForm.permissions.includes(perm.id);
                return (
                  <label
                    key={perm.id}
                    className="flex items-start gap-2 cursor-pointer p-1.5 rounded hover:bg-slate-100 transition"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(perm.id)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">{perm.label}</div>
                      <div className="text-[10px] text-slate-500 leading-tight">{perm.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200 text-[11px] text-indigo-900 flex items-start gap-2 mt-2">
              <Shield className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Règle Commerciale Automatique : </span>
                Dès que l'accès aux <strong>Commandes</strong>, au <strong>Stock</strong> et aux <strong>Achats</strong> est accordé, l'accès commercial standard (Clients et Suivi Client) est automatiquement inclus.
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsEditUserModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
            >
              Update Credentials
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
