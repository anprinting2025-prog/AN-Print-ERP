import {
  Material,
  StockMovement,
  Customer,
  Supplier,
  Purchase,
  Order,
  ProductionRecord,
  Payment,
  Expense,
  ExpenseCategory,
  DashboardData,
  OrderStatus,
  UserProfile,
  UndoOperation,
  ProductionLog,
} from '../types/erp.ts';

const getHeaders = (token?: string | null) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const effectiveToken =
    token ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('an_printing_token') || localStorage.getItem('token')
      : null);
  if (effectiveToken) {
    headers['Authorization'] = `Bearer ${effectiveToken}`;
  }
  return headers;
};

export const api = {
  // Settings & Seed
  async getSettings(): Promise<Record<string, string>> {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },
  async updateSetting(key: string, value: string, token?: string | null) {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) throw new Error('Failed to save setting');
    return res.json();
  },
  async seedInitialData(token?: string | null) {
    const res = await fetch('/api/seed', {
      method: 'POST',
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to seed initial data');
    return res.json();
  },

  // Public Auth
  async submitSignupRequest(data: {
    email: string;
    fullName: string;
    password?: string;
    role?: string;
    phone?: string;
    notes?: string;
  }) {
    const res = await fetch('/api/auth/signup-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit signup request');
    }
    return res.json();
  },

  async loginWithCredentials(data: { email: string; password: string }) {
    const res = await fetch('/api/auth/login-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to log in with credentials');
    }
    return res.json();
  },

  // Team & User Credentials
  async getTeam(token?: string | null): Promise<UserProfile[]> {
    const res = await fetch('/api/team', { headers: getHeaders(token) });
    if (!res.ok) throw new Error('Failed to fetch team');
    return res.json();
  },
  async getPendingTeam(token?: string | null): Promise<UserProfile[]> {
    const res = await fetch('/api/team/pending', { headers: getHeaders(token) });
    if (!res.ok) throw new Error('Failed to fetch pending requests');
    return res.json();
  },
  async approveTeamMember(id: string, data?: any, token?: string | null) {
    const res = await fetch(`/api/team/${id}/approve`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify(data || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to approve user account');
    }
    return res.json();
  },
  async createTeamMember(data: any, token?: string | null) {
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create user credentials');
    }
    return res.json();
  },
  async updateTeamMember(id: string, data: any, token?: string | null) {
    const res = await fetch(`/api/team/${id}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update user credentials');
    }
    return res.json();
  },
  async deleteTeamMember(id: string, token?: string | null) {
    const res = await fetch(`/api/team/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete user credentials');
    }
    return res.json();
  },
  async updateTeamRole(userId: string, role: string, token?: string | null) {
    const res = await fetch(`/api/team/${userId}/role`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error('Failed to update role');
    return res.json();
  },

  // Materials & Stock
  async getMaterials(): Promise<Material[]> {
    const res = await fetch('/api/materials');
    if (!res.ok) throw new Error('Failed to fetch materials');
    return res.json();
  },
  async createMaterial(data: Partial<Material>, token?: string | null): Promise<Material> {
    const res = await fetch('/api/materials', {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create material');
    }
    return res.json();
  },
  async updateMaterial(id: string, data: Partial<Material>, token?: string | null): Promise<Material> {
    const res = await fetch(`/api/materials/${id}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update material');
    return res.json();
  },
  async deleteMaterial(id: string, token?: string | null): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`/api/materials/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete material');
    }
    return res.json();
  },
  async deleteAllMaterials(token?: string | null): Promise<{ success: boolean; count?: number; message?: string }> {
    const res = await fetch('/api/materials/all', {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete all materials');
    }
    return res.json();
  },
  async getStockMovements(materialId?: string, movementType?: string): Promise<StockMovement[]> {
    const params = new URLSearchParams();
    if (materialId) params.append('materialId', materialId);
    if (movementType) params.append('movementType', movementType);
    const res = await fetch(`/api/stock-movements?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch stock movements');
    return res.json();
  },
  async recordStockAdjustment(
    data: {
      materialId: string;
      adjustmentType: 'adjustment_in' | 'adjustment_out';
      quantity: number;
      unit: string;
      unitCostDzd?: number;
      notes?: string;
      modifierName?: string;
    },
    token?: string | null
  ): Promise<StockMovement> {
    const res = await fetch('/api/stock-movements/adjust', {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to adjust stock');
    }
    return res.json();
  },

  // Suppliers & Purchases
  async getSuppliers(): Promise<Supplier[]> {
    const res = await fetch('/api/suppliers');
    if (!res.ok) throw new Error('Failed to fetch suppliers');
    return res.json();
  },
  async createSupplier(data: Partial<Supplier>, token?: string | null): Promise<Supplier> {
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create supplier');
    }
    return res.json();
  },
  async updateSupplier(id: string, data: Partial<Supplier>, token?: string | null): Promise<Supplier> {
    const res = await fetch(`/api/suppliers/${id}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update supplier');
    }
    return res.json();
  },
  async deleteSupplier(id: string, token?: string | null): Promise<{ success: boolean; softDeleted?: boolean; message?: string }> {
    const res = await fetch(`/api/suppliers/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete supplier');
    }
    return res.json();
  },
  async deleteAllSuppliers(token?: string | null): Promise<{ success: boolean; count?: number; message?: string }> {
    const res = await fetch('/api/suppliers/all', {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete all suppliers');
    }
    return res.json();
  },
  async getSupplierStatement(id: string) {
    const res = await fetch(`/api/suppliers/${id}/statement`);
    if (!res.ok) throw new Error('Failed to fetch statement');
    return res.json();
  },
  async getPurchases(): Promise<Purchase[]> {
    const res = await fetch('/api/purchases');
    if (!res.ok) throw new Error('Failed to fetch purchases');
    return res.json();
  },
  async createPurchase(data: any, token?: string | null): Promise<Purchase> {
    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create purchase');
    }
    return res.json();
  },
  async receivePurchase(id: string, token?: string | null): Promise<Purchase> {
    const res = await fetch(`/api/purchases/${id}/receive`, {
      method: 'POST',
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to receive purchase');
    }
    return res.json();
  },
  async updatePurchase(id: string, data: any, token?: string | null): Promise<Purchase> {
    const res = await fetch(`/api/purchases/${id}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update purchase invoice');
    }
    return res.json();
  },
  async deletePurchase(id: string, token?: string | null): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`/api/purchases/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete purchase invoice');
    }
    return res.json();
  },
  async deleteAllPurchases(token?: string | null): Promise<{ success: boolean; count?: number; message?: string }> {
    const res = await fetch('/api/purchases/all', {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete all purchases');
    }
    return res.json();
  },
  async getPurchaseLogs(id: string): Promise<any[]> {
    const res = await fetch(`/api/purchases/${id}/logs`);
    if (!res.ok) throw new Error('Failed to fetch purchase logs');
    return res.json();
  },
  async updatePurchasePayment(
    id: string,
    data: {
      paymentStatus?: 'unpaid' | 'partial' | 'paid';
      amountPaidDzd?: number | string;
      notes?: string;
      paymentMethod?: string;
      modifierName?: string;
    },
    token?: string | null
  ): Promise<Purchase> {
    const res = await fetch(`/api/purchases/${id}/payment`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update purchase invoice payment');
    }
    return res.json();
  },

  // Customers & Orders
  async getCustomers(): Promise<Customer[]> {
    const res = await fetch('/api/customers');
    if (!res.ok) throw new Error('Failed to fetch customers');
    return res.json();
  },
  async createCustomer(data: Partial<Customer>, token?: string | null): Promise<Customer> {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create customer');
    }
    return res.json();
  },
  async updateCustomer(id: string, data: Partial<Customer>, token?: string | null): Promise<Customer> {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update customer');
    return res.json();
  },
  async getCustomerStatement(id: string) {
    const res = await fetch(`/api/customers/${id}/statement`);
    if (!res.ok) throw new Error('Failed to fetch customer statement');
    return res.json();
  },
  async getCustomerOrders(id: string): Promise<Order[]> {
    const res = await fetch(`/api/customers/${id}/orders`);
    if (!res.ok) throw new Error('Failed to fetch customer orders');
    return res.json();
  },
  async getOrders(): Promise<Order[]> {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },
  async createOrder(data: any, token?: string | null): Promise<Order> {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create order');
    }
    return res.json();
  },
  async updateOrder(id: string, data: any, token?: string | null): Promise<Order> {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update order');
    }
    return res.json();
  },
  async deleteOrder(id: string, token?: string | null): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete order');
    }
    return res.json();
  },
  async deleteAllOrders(token?: string | null): Promise<{ success: boolean; count?: number; message?: string }> {
    const res = await fetch(`/api/orders/all`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete all orders');
    }
    return res.json();
  },
  async updateOrderStatus(
    id: string,
    status: OrderStatus,
    options?: {
      deliveryDate?: string;
      modificationNotes?: string;
      modifierName?: string;
      modifierRole?: string;
    },
    token?: string | null
  ): Promise<Order> {
    const res = await fetch(`/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify({ status, ...options }),
    });
    if (!res.ok) throw new Error('Failed to update order status');
    return res.json();
  },

  // Production
  async getProduction(): Promise<ProductionRecord[]> {
    const res = await fetch('/api/production');
    if (!res.ok) throw new Error('Failed to fetch production records');
    return res.json();
  },
  async createProduction(data: any, token?: string | null): Promise<ProductionRecord> {
    const res = await fetch('/api/production', {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to record production');
    }
    return res.json();
  },
  async updateProduction(id: string, data: any, token?: string | null): Promise<ProductionRecord> {
    const res = await fetch(`/api/production/${id}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update production record');
    }
    return res.json();
  },
  async deleteProduction(id: string, token?: string | null): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`/api/production/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete production record');
    }
    return res.json();
  },
  async getProductionLogs(id: string, token?: string | null): Promise<ProductionLog[]> {
    const res = await fetch(`/api/production/${id}/logs`, {
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch production logs');
    }
    return res.json();
  },

  // Payments
  async getPayments(): Promise<Payment[]> {
    const res = await fetch('/api/payments');
    if (!res.ok) throw new Error('Failed to fetch payments');
    return res.json();
  },
  async recordPayment(data: any, token?: string | null): Promise<Payment> {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to record payment');
    }
    return res.json();
  },

  // Expenses
  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    const res = await fetch('/api/expense-categories');
    if (!res.ok) throw new Error('Failed to fetch expense categories');
    return res.json();
  },
  async createExpenseCategory(name: string, token?: string | null): Promise<ExpenseCategory> {
    const res = await fetch('/api/expense-categories', {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to create category');
    return res.json();
  },
  async getExpenses(): Promise<Expense[]> {
    const res = await fetch('/api/expenses');
    if (!res.ok) throw new Error('Failed to fetch expenses');
    return res.json();
  },
  async createExpense(data: any, token?: string | null): Promise<Expense> {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to record expense');
    }
    return res.json();
  },
  async updateExpense(id: string, data: any, token?: string | null): Promise<Expense> {
    const res = await fetch(`/api/expenses/${id}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update expense');
    }
    return res.json();
  },
  async deleteExpense(id: string, token?: string | null) {
    const res = await fetch(`/api/expenses/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to delete expense');
    return res.json();
  },

  // Analytics & Dashboard
  async getDashboard(startDate?: string, endDate?: string): Promise<DashboardData> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const res = await fetch(`/api/reports/dashboard?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch dashboard data');
    return res.json();
  },

  // Live Sync status polling
  async getSyncStatus(): Promise<{ lastModified: number; timestamp: number }> {
    const res = await fetch('/api/sync/status');
    if (!res.ok) throw new Error('Failed to fetch sync status');
    return res.json();
  },

  // Export full database instance to Excel (.xlsx) containing all tables
  async exportDatabaseExcel(token?: string | null): Promise<void> {
    const res = await fetch('/api/database/export-excel', {
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to download database instance');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `an_printing_database_instance_${dateStr}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Undo System (Rollback latest 10 operations)
  async getUndoHistory(token?: string | null): Promise<UndoOperation[]> {
    const res = await fetch('/api/undo/history', {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to fetch undo history');
    return res.json();
  },
  async executeUndo(id: string, token?: string | null): Promise<{ success: boolean; message: string; operation?: UndoOperation }> {
    const res = await fetch(`/api/undo/${id}`, {
      method: 'POST',
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de l\'annulation de l\'opération');
    }
    return res.json();
  },
  async executeLatestUndo(token?: string | null): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/undo/latest', {
      method: 'POST',
      headers: getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de l\'annulation');
    }
    return res.json();
  },
};
