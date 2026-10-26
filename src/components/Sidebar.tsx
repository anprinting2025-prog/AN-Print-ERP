import React from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Factory,
  Boxes,
  Truck,
  Users,
  Building2,
  CreditCard,
  Receipt,
  BarChart3,
  Settings,
  X,
  Layers,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useRealtimeSync } from '../context/RealtimeSyncContext.tsx';
import { ThemeToggle } from './common/ThemeToggle.tsx';

export type NavTab =
  | 'dashboard'
  | 'orders'
  | 'production'
  | 'inventory'
  | 'purchases'
  | 'customers'
  | 'inactive_clients'
  | 'suppliers'
  | 'payments'
  | 'expenses'
  | 'reports'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpen,
  onClose,
}) => {
  const { profile } = useAuth();
  const { pendingCount, setIsJoinRequestsModalOpen } = useRealtimeSync();
  const isOwner = profile?.role === 'owner';
  const isAdmin = profile?.role === 'admin';
  const isOwnerOrAdmin = isOwner || isAdmin;
  const userPerms = Array.isArray(profile?.permissions) ? profile.permissions : [];

  const navItems: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; ownerOnly?: boolean; section?: string }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: ShoppingBag, section: 'Operations' },
    { id: 'production', label: 'Production', icon: Factory },
    { id: 'inventory', label: 'Inventory & Stock', icon: Boxes },
    { id: 'purchases', label: 'Purchases', icon: Truck },
    { id: 'customers', label: 'Customers', icon: Users, section: 'Relationships' },
    { id: 'inactive_clients', label: 'Client Follow-up', icon: UserCheck },
    { id: 'suppliers', label: 'Suppliers', icon: Building2 },
    { id: 'payments', label: 'Payments & Debts', icon: CreditCard, section: 'Financials' },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'reports', label: 'Reports & P&L', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings, ownerOnly: true, section: 'Administration' },
  ];

  // Dynamic access:
  // Owners and Admins have full access to navigation.
  // Staff/Commercial users see exactly the modules granted to them (e.g. orders, inventory, purchases, customers, etc.)
  const itemsToDisplay = isOwnerOrAdmin || userPerms.includes('all')
    ? navItems
    : navItems.filter((item) => {
        // If granted permission for this specific tab, show it!
        return userPerms.includes(item.id);
      });

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-0 -translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-6 lg:hidden">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Layers className="h-5 w-5 text-indigo-600" />
            <span>An Printing Navigation</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {itemsToDisplay.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            const isDisabled = (item as any).ownerOnly && !isOwner;

            return (
              <React.Fragment key={item.id}>
                {item.section && (
                  <div className="pt-3 pb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {item.section}
                  </div>
                )}
                <button
                  onClick={() => {
                    if (!isDisabled) {
                      onSelectTab(item.id);
                      onClose();
                    }
                  }}
                  disabled={isDisabled}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                      : isDisabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`h-4.5 w-4.5 ${
                      isActive ? 'text-indigo-600' : isDisabled ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                  {item.id === 'settings' && isOwnerOrAdmin && pendingCount > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black animate-pulse">
                      {pendingCount}
                    </span>
                  )}
                  {(item as any).ownerOnly && !isOwnerOrAdmin && (
                    <span className="ml-auto text-[10px] text-slate-400 font-normal">Admin</span>
                  )}
                </button>
              </React.Fragment>
            );
          })}

          {isOwnerOrAdmin && pendingCount > 0 && (
            <div className="pt-3 px-1">
              <button
                type="button"
                onClick={() => {
                  setIsJoinRequestsModalOpen(true);
                  onClose();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-orange-600 transition"
              >
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  <span>Demandes Commerciales</span>
                </div>
                <span className="px-1.5 py-0.2 rounded-full bg-white text-orange-600 text-[10px] font-black">
                  {pendingCount}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Quick business summary and Theme toggle in footer */}
        <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-3">
          <ThemeToggle showLabel className="w-full justify-center py-2 text-xs" />

          <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span>Workshop Mode</span>
              <span className="font-semibold text-emerald-600">Active</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Plastic • Carton • TNT Bags
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
