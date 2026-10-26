import React, { useState, useEffect, useRef } from 'react';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { RealtimeSyncProvider } from './context/RealtimeSyncContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { MobileBottomNav } from './components/mobile/MobileBottomNav.tsx';
import { MobileQuickActionFAB } from './components/mobile/MobileQuickActionFAB.tsx';
import { MobileSimulator } from './components/mobile/MobileSimulator.tsx';
import { MobileHeader } from './components/mobile/MobileHeader.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { InventoryView } from './views/InventoryView.tsx';
import { PurchasesView } from './views/PurchasesView.tsx';
import { OrdersView } from './views/OrdersView.tsx';
import { ProductionView } from './views/ProductionView.tsx';
import { CustomersView } from './views/CustomersView.tsx';
import { PaymentsView } from './views/PaymentsView.tsx';
import { ExpensesView } from './views/ExpensesView.tsx';
import { ReportsView } from './views/ReportsView.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import { InactiveClientsView } from './views/InactiveClientsView.tsx';
import { LoginPage } from './views/LoginPage.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { JoinRequestsModal } from './components/team/JoinRequestsModal.tsx';
import { JoinRequestNotificationToast } from './components/team/JoinRequestNotificationToast.tsx';
import { UndoProvider } from './context/UndoContext.tsx';
import { UndoToast } from './components/common/UndoToast.tsx';
import { UndoHistoryModal } from './components/common/UndoHistoryModal.tsx';
import { api } from './services/api.ts';
import { Printer } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { profile, token, loading, showAuthModal, setShowAuthModal, authModalMode } = useAuth();
  const isOwner = profile?.role === 'owner';
  const isAdmin = profile?.role === 'admin';
  const isOwnerOrAdmin = isOwner || isAdmin;
  const isCommerciale = profile?.role === 'commerciale';
  const userPerms = Array.isArray(profile?.permissions) ? profile.permissions : [];

  const hasPermission = (tab: NavTab) => {
    if (isOwnerOrAdmin) return true;
    if (userPerms.includes('all')) return true;
    return userPerms.includes(tab);
  };

  const defaultTab: NavTab = isOwnerOrAdmin
    ? 'dashboard'
    : userPerms.includes('orders')
    ? 'orders'
    : userPerms.includes('inventory')
    ? 'inventory'
    : userPerms.includes('purchases')
    ? 'purchases'
    : userPerms.includes('customers')
    ? 'customers'
    : 'orders';

  const [currentTab, setCurrentTab] = useState<NavTab>(defaultTab);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isMobileSimulatorOpen, setIsMobileSimulatorOpen] = useState<boolean>(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);

  const lastSyncTimestampRef = useRef<number>(Date.now());

  // Enforce dynamic module permissions
  useEffect(() => {
    if (!profile) return;
    if (!hasPermission(currentTab)) {
      const fallbackTab: NavTab = userPerms.includes('orders')
        ? 'orders'
        : userPerms.includes('inventory')
        ? 'inventory'
        : userPerms.includes('purchases')
        ? 'purchases'
        : userPerms.includes('customers')
        ? 'customers'
        : isOwnerOrAdmin
        ? 'dashboard'
        : 'orders';
      setCurrentTab(fallbackTab);
    }
  }, [profile, currentTab]);

  // Real-time synchronization across all accounts and devices
  useEffect(() => {
    if (!profile) return;

    let isMounted = true;
    const checkSync = async () => {
      try {
        const status = await api.getSyncStatus();
        if (status.lastModified > lastSyncTimestampRef.current) {
          lastSyncTimestampRef.current = status.lastModified;
          window.dispatchEvent(
            new CustomEvent('an_erp_sync', { detail: { lastModified: status.lastModified } })
          );
        }
      } catch (err) {
        // Silently catch network glitches during background sync
      }
    };

    // Polling interval every 6 seconds
    const interval = setInterval(checkSync, 6000);

    // Sync on window focus
    const handleFocus = () => {
      checkSync();
    };
    window.addEventListener('focus', handleFocus);

    // BroadcastChannel for instant local cross-tab sync
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('an_printing_db_sync');
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'DB_MUTATION' && isMounted) {
          window.dispatchEvent(new CustomEvent('an_erp_sync', { detail: ev.data }));
        }
      };
    } catch {
      // BroadcastChannel not available in all browser contexts
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      if (bc) bc.close();
    };
  }, [profile]);

  // Load alert counts (pending orders & low stock)
  useEffect(() => {
    if (!profile) return;

    const checkInitialData = async () => {
      try {
        const [mats, ords] = await Promise.all([
          api.getMaterials().catch(() => []),
          api.getOrders().catch(() => []),
        ]);

        if (mats.length === 0 && profile.role === 'owner') {
          await api.seedInitialData(token).catch(() => {});
          const refreshedMats = await api.getMaterials().catch(() => []);
          setLowStockCount(refreshedMats.filter((m) => m.isLowStock).length);
        } else {
          setLowStockCount(mats.filter((m) => m.isLowStock).length);
        }

        const pending = ords.filter(
          (o) => o.status !== 'delivered' && o.status !== 'cancelled'
        ).length;
        setPendingOrdersCount(pending);
      } catch (e) {
        console.warn('Initial data check:', e);
      }
    };
    checkInitialData();
  }, [token, currentTab, profile]);

  // If loading session, show clean splash screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="h-14 w-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-4 animate-pulse">
          <Printer className="h-7 w-7" />
        </div>
        <div className="text-white font-bold text-lg tracking-tight">An Printing ERP</div>
        <div className="text-slate-400 text-xs mt-1">Chargement du système de gestion d'atelier...</div>
      </div>
    );
  }

  // Requirement 1: When someone visits the link of the app, they face a login page!
  if (!profile) {
    return <LoginPage />;
  }

  const titles: Record<NavTab, string> = {
    dashboard: 'Dashboard & Analytics',
    orders: 'Printing Orders & Job Cards',
    production: 'Production & Material Consumption',
    inventory: 'Inventory & Stock Movements',
    purchases: 'Purchasing & Raw Materials',
    customers: 'Customer CRM & Receivables',
    inactive_clients: 'Client Follow-up & Inactivity',
    suppliers: 'Suppliers & Raw Material Invoices',
    payments: 'Payments & Debt Settlements',
    expenses: 'Operating Expenses',
    reports: 'Financial Reports & P&L',
    settings: 'Settings & Team Roles',
  };

  const renderActiveView = () => {
    // Check permission for active tab
    if (!hasPermission(currentTab)) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="h-12 w-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-3">
            <Printer className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Accès Restreint</h2>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Vous n'avez pas l'autorisation d'accéder à ce module. Veuillez contacter l'administrateur ou propriétaire de l'atelier pour demander l'accès.
          </p>
        </div>
      );
    }

    switch (currentTab) {
      case 'dashboard':
        return <DashboardView onNavigate={(tab) => setCurrentTab(tab)} />;
      case 'inventory':
        return <InventoryView />;
      case 'purchases':
        return <PurchasesView initialTab="purchases" onNavigateTab={(tab) => setCurrentTab(tab)} />;
      case 'suppliers':
        return <PurchasesView initialTab="suppliers" onNavigateTab={(tab) => setCurrentTab(tab)} />;
      case 'orders':
        return <OrdersView />;
      case 'production':
        return <ProductionView />;
      case 'customers':
        return <CustomersView />;
      case 'inactive_clients':
        return <InactiveClientsView onNavigate={(tab) => setCurrentTab(tab)} />;
      case 'payments':
        return <PaymentsView />;
      case 'expenses':
        return <ExpensesView />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <OrdersView />;
    }
  };

  return (
    <>
      {/* Mobile Simulator Modal / Device View Mode (for desktop preview) */}
      {isMobileSimulatorOpen && (
        <MobileSimulator onClose={() => setIsMobileSimulatorOpen(false)}>
          <div className="flex min-h-full flex-col bg-slate-50 text-slate-900 pb-20">
            {/* Dedicated Mobile Header */}
            <MobileHeader
              activeTitle={titles[currentTab] || 'An Printing'}
              lowStockCount={lowStockCount}
              pendingOrdersCount={pendingOrdersCount}
              onOpenLowStock={() => setCurrentTab(isCommerciale ? 'orders' : 'inventory')}
              onOpenPendingOrders={() => setCurrentTab('orders')}
              onToggleDesktopMode={() => setIsMobileSimulatorOpen(false)}
            />

            {/* Mobile View Content */}
            <main className="flex-1 p-3">
              {renderActiveView()}
            </main>

            {/* Mobile Quick Action FAB inside Simulator */}
            <MobileQuickActionFAB
              isSimulator
              onNavigate={(tab) => setCurrentTab(tab)}
            />

            {/* Mobile Bottom Navigation Bar inside Simulator */}
            <MobileBottomNav
              isSimulator
              currentTab={currentTab}
              onSelectTab={(tab) => setCurrentTab(tab)}
              pendingOrdersCount={pendingOrdersCount}
              lowStockCount={lowStockCount}
            />
          </div>
        </MobileSimulator>
      )}

      {/* Standard Responsive Application Layout */}
      <div className="flex min-h-screen bg-slate-50 text-slate-900">
        {/* Desktop & Tablet Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <Navbar
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            activeViewTitle={titles[currentTab] || 'An Printing'}
            onToggleMobilePreview={() => setIsMobileSimulatorOpen(true)}
          />

          {/* Scrollable Container with bottom padding for mobile nav bar */}
          <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 pb-28 lg:pb-8">
            <div className="w-full max-w-full">
              {renderActiveView()}
            </div>
          </main>

          {/* Mobile Quick Action Floating Action Button */}
          <MobileQuickActionFAB onNavigate={(tab) => setCurrentTab(tab)} />

          {/* Mobile Bottom Navigation Bar */}
          <MobileBottomNav
            currentTab={currentTab}
            onSelectTab={(tab) => setCurrentTab(tab)}
            pendingOrdersCount={pendingOrdersCount}
            lowStockCount={lowStockCount}
          />
        </div>
      </div>

      {/* Staff Sign In & First-Time Signup Request Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
      />

      {/* Join Requests Modal (Commercial requests submitted from phone/web) */}
      <JoinRequestsModal />

      {/* Real-time Toast Notification when new request arrives from phone */}
      <JoinRequestNotificationToast />

      {/* Floating Undo Toast for instant rollback */}
      <UndoToast />

      {/* 10-Operation Undo History Modal */}
      <UndoHistoryModal />
    </>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RealtimeSyncProvider>
          <UndoProvider>
            <MainLayout />
          </UndoProvider>
        </RealtimeSyncProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
