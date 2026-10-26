export type UserRole = 'owner' | 'admin' | 'commerciale';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  password?: string;
  permissions?: string[];
  notes?: string;
  isActive: boolean;
  createdAt?: string;
}

export type MaterialCategory =
  | 'blank_plastic'
  | 'blank_carton'
  | 'blank_tnt'
  | 'ink'
  | 'diluent'
  | 'retarder'
  | 'consumable';

export type TrackingMode = 'units' | 'kg' | 'dual_kg_units';

export interface Material {
  id: string;
  code: string;
  name: string;
  category: MaterialCategory;
  description: string;
  trackingMode: TrackingMode;
  purchaseUnit: string;
  stockUnit: string;
  piecesPerKg: string; // conversion factor
  reorderThreshold: string;
  unitCostDzd: string;
  openingStockKg: string;
  openingStockPieces: string;
  isActive: boolean;
  currentStock?: number;
  stockPieces?: number;
  stockKg?: number;
  isLowStock?: boolean;
}

export type MovementType =
  | 'opening_balance'
  | 'purchase_receipt'
  | 'production_consumption'
  | 'production_waste'
  | 'customer_return'
  | 'supplier_return'
  | 'adjustment_in'
  | 'adjustment_out';

export interface StockMovement {
  id: string;
  timestamp: string;
  materialId: string;
  movementType: MovementType;
  quantityIn: string;
  quantityOut: string;
  quantityChange?: string;
  balanceAfter?: string;
  movementDate?: string;
  unit: string;
  referenceType?: string;
  referenceId?: string;
  unitCostDzd: string;
  userId?: string;
  userName?: string;
  notes?: string;
  material?: Material;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  shopName: string;
  phone: string;
  address: string;
  category: string; // 'clothing' | 'jewelry' | 'cosmetics' | 'shoes' | custom
  contactChannel?: 'whatsapp' | 'messenger' | 'phone' | 'phone_call' | 'tiktok' | 'tiktok_dm' | 'instagram' | 'instagram_dm' | 'walk_in' | string;
  messengerLink?: string;
  tiktokHandle?: string;
  instagramHandle?: string;
  openingBalanceDzd: string;
  creditLimitDzd: string;
  notes: string;
  isActive: boolean;
  totalSales?: number;
  totalPayments?: number;
  outstandingBalance?: number;
  orderCount?: number;
  lastOrderDate?: string | null;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  address: string;
  openingBalanceDzd: string;
  notes: string;
  isActive: boolean;
  totalPurchases?: number;
  totalPayments?: number;
  outstandingBalance?: number;
  purchaseCount?: number;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  materialId: string;
  quantity: string;
  purchaseUnit: string;
  receivedKg?: string;
  receivedPieces?: string;
  unitCostDzd: string;
  totalCostDzd: string;
  lineTotalDzd?: string;
  material?: Material;
}

export interface PurchaseLog {
  id: string;
  purchaseId: string;
  userId?: string;
  userName: string;
  userRole?: string;
  action: string;
  modification: string;
  timestamp: string;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  invoiceNumber: string;
  purchaseDate: string;
  subtotalDzd: string;
  freightCostDzd: string;
  totalAmountDzd: string;
  amountPaidDzd: string;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  receiptStatus: 'pending' | 'received';
  notes: string;
  createdBy?: string;
  createdByName?: string;
  createdByRole?: string;
  updatedAt?: string;
  createdAt?: string;
  supplier?: Supplier;
  items?: PurchaseItem[];
  logs?: PurchaseLog[];
}

export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'confirmed_phone'
  | 'in_production'
  | 'ready_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  id?: string;
  orderId?: string;
  bagType: 'plastic' | 'carton' | 'tnt' | 'custom';
  size: string;
  bagColor: string;
  printColors: string;
  designNotes: string;
  artworkUrl?: string;
  quantityPieces: string;
  unitPriceDzd: string;
  lineTotalDzd: string;
}

export interface OrderLog {
  id: string;
  orderId: string;
  userId?: string;
  userName: string;
  userRole?: string;
  action: string;
  modification: string;
  timestamp: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string | null;
  customerName: string;
  orderDate: string;
  dueDate: string;
  status: OrderStatus;
  channel?: 'whatsapp' | 'messenger' | 'phone_call' | 'tiktok_dm' | 'instagram_dm' | 'walk_in';
  subtotalDzd: string;
  discountDzd: string;
  deliveryFeeDzd: string;
  totalAmountDzd: string;
  amountPaidDzd: string;
  deliveryDate?: string;
  notes: string;
  createdBy?: string;
  createdByName?: string;
  createdByRole?: string;
  createdAt?: string;
  customer?: Customer;
  items?: OrderItem[];
  logs?: OrderLog[];
  productionCount?: number;
  totalQuantity?: number;
  completedQuantity?: number;
  remainingBalance?: number;
  isPaid?: boolean;
}

export interface ProductionUsage {
  id: string;
  productionId: string;
  materialId: string;
  materialName: string;
  quantityUsed: string;
  unit: string;
  wasteQuantity: string;
  notes?: string;
}

export interface ProductionRecord {
  id: string;
  productionNumber: string;
  orderId: string;
  startDate: string;
  completionDate?: string;
  plannedQuantity: string;
  completedQuantity: string;
  rejectedQuantity: string;
  workerId?: string;
  workerName: string;
  notes: string;
  status: 'in_progress' | 'completed';
  createdAt?: string;
  order?: Order;
  usage?: ProductionUsage[];
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  orderId?: string;
  purchaseId?: string;
  allocatedAmountDzd: string;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  paymentType: 'customer_receipt' | 'supplier_payment';
  customerId?: string | null;
  supplierId?: string | null;
  partyName: string;
  amountDzd: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'check' | 'other';
  referenceNumber: string;
  notes: string;
  recordedBy?: string;
  createdAt?: string;
  customer?: Customer;
  supplier?: Supplier;
  allocations?: PaymentAllocation[];
}

export interface ExpenseCategory {
  id: string;
  name: string;
  isSystem: boolean;
}

export interface Expense {
  id: string;
  expenseNumber: string;
  expenseDate: string;
  categoryId: string;
  categoryName: string;
  description: string;
  amountDzd: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'check' | 'other';
  paidTo: string;
  referenceNumber: string;
  isPaid: boolean;
  notes: string;
  recordedBy?: string;
  createdAt?: string;
}

export interface DashboardData {
  sales: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    periodTotal: number;
  };
  ordersByStatus: {
    received: number;
    inProduction: number;
    ready: number;
    delivered: number;
    total: number;
  };
  debts: {
    customerOutstanding: number;
    supplierOutstanding: number;
  };
  expenses: {
    today: number;
    thisMonth: number;
    periodTotal: number;
  };
  profit: {
    salesRevenue: number;
    materialsConsumedCost: number;
    estimatedGrossProfit: number;
    operatingExpenses: number;
    estimatedNetProfit: number;
  };
  inventory: {
    totalValuation: number;
    lowStockMaterials: Material[];
  };
  monthlyTrends: Array<{
    month: string;
    sales: number;
    expenses: number;
    purchases: number;
  }>;
  topCustomers: Array<{
    customerId: string;
    name: string;
    totalSales: number;
    orderCount: number;
  }>;
  recent: {
    orders: Order[];
    payments: Payment[];
    purchases: Purchase[];
    expenses: Expense[];
  };
}

export interface UndoOperation {
  id: string;
  actionType: 'delete' | 'update' | 'bulk_delete';
  entityType: string;
  entityId: string;
  description: string;
  snapshot: string;
  performedBy?: string;
  performedByRole?: string;
  isUndone: boolean;
  timestamp: string;
}
