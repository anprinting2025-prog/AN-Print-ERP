import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Factory,
  Boxes,
  Menu,
  Truck,
  Users,
  Building2,
  CreditCard,
  Receipt,
  BarChart3,
  Settings,
  X,
  Printer,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { NavTab } from '../Sidebar.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { PWAInstallButton } from '../common/PWAInstallButton.tsx';

interface MobileBottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingOrdersCount?: number;
  lowStockCount?: number;
  isSimulator?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  pendingOrdersCount = 0,
  lowStockCount = 0,
  isSimulator = false,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { profile } = useAuth();
  const isOwner = profile?.role === 'owner';
  const isAdmin = profile?.role === 'admin';
  const isOwnerOrAdmin = isOwner || isAdmin;
  const userPerms = Array.isArray(profile?.permissions) ? profile.permissions : [];

  const candidateTabs: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }> = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'orders',
      label: 'Orders',
      icon: ShoppingBag,
      badge: pendingOrdersCount,
      badgeColor: 'bg-indigo-600',
    },
    { id: 'production', label: 'Production', icon: Factory },
    {
      id: 'inventory',
      label: 'Stock',
      icon: Boxes,
      badge: lowStockCount,
      badgeColor: 'bg-rose-600',
    },
    { id: 'purchases', label: 'Purchases', icon: Truck },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'inactive_clients', label: 'Follow-up', icon: UserCheck },
  ];

  // Dynamic mobile tabs: Owners and Admins get standard primary tabs.
  // Other users get the tabs corresponding to their granted permissions (orders, stock, purchases, etc.)
  const activeTabsList = isOwnerOrAdmin || userPerms.includes('all')
    ? [
        candidateTabs[0], // Overview
        candidateTabs[1], // Orders
        candidateTabs[2], // Production
        candidateTabs[3], // Stock
      ]
    : candidateTabs.filter((t) => userPerms.includes(t.id)).slice(0, 4);

  // If no matching tabs found (e.g. initial login), show Orders at least
  if (activeTabsList.length === 0) {
    activeTabsList.push(candidateTabs[1]);
  }

  const allMoreItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    ownerOnly?: boolean;
    desc: string;
  }> = [
    { id: 'inventory', label: 'Inventory & Stock', icon: Boxes, desc: 'Stock movements & raw materials' },
    { id: 'purchases', label: 'Purchases & Supplies', icon: Truck, desc: 'Raw bags & ink purchase invoices' },
    { id: 'customers', label: 'Customers CRM', icon: Users, desc: 'Boutiques, debts & statements' },
    { id: 'inactive_clients', label: 'Client Follow-up', icon: UserCheck, desc: 'Delayed and inactive client tracking' },
    { id: 'suppliers', label: 'Suppliers Directory', icon: Building2, desc: 'Material vendors & liabilities' },
    { id: 'payments', label: 'Payments & Debts', icon: CreditCard, desc: 'Cash receipts & settled invoices' },
    { id: 'expenses', label: 'Operating Expenses', icon: Receipt, desc: 'Electricity, rent & overheads' },
    { id: 'reports', label: 'Financial Reports', icon: BarChart3, desc: 'P&L estimates & stock valuation' },
    { id: 'settings', label: 'Settings & Team', icon: Settings, ownerOnly: true, desc: 'Workshop profile & roles' },
  ];

  const moreItems = isOwnerOrAdmin || userPerms.includes('all')
    ? allMoreItems
    : allMoreItems.filter((it) => userPerms.includes(it.id));

  return (
    <>
      {/* Mobile Drawer Sheet for "More" options */}
      {isMoreOpen && (
        <div className={`fixed inset-0 z-50 flex flex-col justify-end ${isSimulator ? 'block' : 'lg:hidden'}`}>
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMoreOpen(false)}
          />

          <div className="relative z-10 w-full rounded-t-3xl bg-white p-5 shadow-2xl border-t border-slate-200 max-h-[85vh] overflow-y-auto">
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-xs">
                  <Printer className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">An Printing ERP</h3>
                  <p className="text-[11px] text-slate-500">Workshop Modules Menu</p>
                </div>
              </div>

              <button
                onClick={() => setIsMoreOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Install Banner inside mobile sheet if available */}
            <div className="pt-3 pb-2">
              <PWAInstallButton />
            </div>

            {/* Grid of secondary modules */}
            <div className="mt-2 divide-y divide-slate-100">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                const isDisabled = item.ownerOnly && !isOwner;

                return (
                  <button
                    key={item.id}
                    disabled={isDisabled}
                    onClick={() => {
                      if (!isDisabled) {
                        onSelectTab(item.id);
                        setIsMoreOpen(false);
                      }
                    }}
                    className={`flex w-full items-center justify-between py-3 px-2 rounded-xl text-left transition ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : isDisabled
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold">{item.label}</div>
                        <div className="text-[10px] text-slate-400">{item.desc}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-400">
                      {item.ownerOnly && !isOwner && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                          Owner
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-40 flex h-16 w-full items-center justify-around border-t border-slate-200 bg-white/95 backdrop-blur-md px-2 shadow-lg ${
          isSimulator ? 'block' : 'lg:hidden'
        } safe-area-bottom`}
      >
        {activeTabsList.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => {
                onSelectTab(tab.id);
                setIsMoreOpen(false);
              }}
              className={`relative flex flex-col items-center justify-center py-1 px-3 text-[10px] font-bold transition ${
                isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <div
                className={`relative flex h-8 w-8 items-center justify-center rounded-xl transition ${
                  isActive ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500'
                }`}
              >
                <Icon className="h-5 w-5" />
                {tab.badge && tab.badge > 0 ? (
                  <span
                    className={`absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-extrabold text-white ring-2 ring-white ${tab.badgeColor}`}
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                ) : null}
              </div>
              <span className="mt-0.5">{tab.label}</span>
            </button>
          );
        })}

        {/* More / Menu Button - Owner Only */}
        {isOwner && (
          <button
            onClick={() => setIsMoreOpen(true)}
            className={`flex flex-col items-center justify-center py-1 px-3 text-[10px] font-bold transition ${
              isMoreOpen || moreItems.some((m) => m.id === currentTab)
                ? 'text-indigo-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                isMoreOpen || moreItems.some((m) => m.id === currentTab)
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-slate-500'
              }`}
            >
              <Menu className="h-5 w-5" />
            </div>
            <span className="mt-0.5">More</span>
          </button>
        )}
      </nav>
    </>
  );
};
