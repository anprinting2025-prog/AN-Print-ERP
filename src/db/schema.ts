import { boolean, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Profiles (Linked to Firebase UID)
export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(), // Firebase Auth UID
  email: text('email').notNull(),
  fullName: text('full_name').notNull().default(''),
  role: text('role').notNull().default('owner'), // 'owner' | 'manager' | 'worker' | 'sales'
  phone: text('phone').default(''),
  password: text('password').default(''),
  permissions: text('permissions').default('[]'),
  notes: text('notes').default(''),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const profilesRelations = relations(profiles, ({ many }) => ({
  purchases: many(purchases),
  orders: many(orders),
  stockMovements: many(stockMovements),
  payments: many(payments),
  expenses: many(expenses),
}));

// 2. Materials
export const materials = pgTable('materials', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'blank_plastic' | 'blank_carton' | 'blank_tnt' | 'ink' | 'diluent' | 'retarder' | 'consumable'
  description: text('description').default(''),
  trackingMode: text('tracking_mode').notNull().default('units'), // 'units' | 'kg' | 'dual_kg_units'
  purchaseUnit: text('purchase_unit').notNull().default('kg'), // 'kg' | 'piece' | 'liter' | 'box'
  stockUnit: text('stock_unit').notNull().default('piece'), // 'kg' | 'piece'
  piecesPerKg: numeric('pieces_per_kg', { precision: 12, scale: 2 }).default('0'), // Configurable conversion
  reorderThreshold: numeric('reorder_threshold', { precision: 12, scale: 2 }).notNull().default('0'),
  unitCostDzd: numeric('unit_cost_dzd', { precision: 15, scale: 2 }).notNull().default('0'), // Weighted average cost
  openingStockKg: numeric('opening_stock_kg', { precision: 12, scale: 2 }).default('0'),
  openingStockPieces: numeric('opening_stock_pieces', { precision: 12, scale: 2 }).default('0'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const materialsRelations = relations(materials, ({ many }) => ({
  purchaseItems: many(purchaseItems),
  productionUsage: many(productionUsage),
  stockMovements: many(stockMovements),
}));

// 3. Customers
export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  shopName: text('shop_name').default(''),
  phone: text('phone').default(''),
  address: text('address').default(''),
  category: text('category').notNull().default('clothing'), // 'clothing' | 'jewelry' | 'cosmetics' | 'shoes' | custom
  contactChannel: text('contact_channel').default('whatsapp'), // 'whatsapp' | 'messenger' | 'phone_call' | 'tiktok_dm' | 'instagram_dm' | 'walk_in'
  messengerLink: text('messenger_link').default(''),
  tiktokHandle: text('tiktok_handle').default(''),
  instagramHandle: text('instagram_handle').default(''),
  openingBalanceDzd: numeric('opening_balance_dzd', { precision: 15, scale: 2 }).notNull().default('0'),
  creditLimitDzd: numeric('credit_limit_dzd', { precision: 15, scale: 2 }).notNull().default('0'),
  notes: text('notes').default(''),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
  payments: many(payments),
}));

// 4. Suppliers
export const suppliers = pgTable('suppliers', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  contactPerson: text('contact_person').default(''),
  phone: text('phone').default(''),
  address: text('address').default(''),
  openingBalanceDzd: numeric('opening_balance_dzd', { precision: 15, scale: 2 }).notNull().default('0'),
  notes: text('notes').default(''),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchases: many(purchases),
  payments: many(payments),
}));

// 5. Purchases
export const purchases = pgTable('purchases', {
  id: text('id').primaryKey(),
  purchaseNumber: text('purchase_number').notNull().unique(),
  supplierId: text('supplier_id').references(() => suppliers.id),
  invoiceNumber: text('invoice_number').default(''),
  purchaseDate: text('purchase_date').notNull(), // YYYY-MM-DD
  subtotalDzd: numeric('subtotal_dzd', { precision: 15, scale: 2 }).notNull().default('0'),
  freightCostDzd: numeric('freight_cost_dzd', { precision: 15, scale: 2 }).notNull().default('0'),
  totalAmountDzd: numeric('total_amount_dzd', { precision: 15, scale: 2 }).notNull().default('0'),
  amountPaidDzd: numeric('amount_paid_dzd', { precision: 15, scale: 2 }).notNull().default('0'),
  paymentStatus: text('payment_status').notNull().default('unpaid'), // 'unpaid' | 'partial' | 'paid'
  receiptStatus: text('receipt_status').notNull().default('pending'), // 'pending' | 'received'
  notes: text('notes').default(''),
  createdBy: text('created_by').references(() => profiles.id),
  createdByName: text('created_by_name').default(''),
  createdByRole: text('created_by_role').default(''),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchases.supplierId],
    references: [suppliers.id],
  }),
  items: many(purchaseItems),
  allocations: many(paymentAllocations),
  logs: many(purchaseLogs),
}));

// 5b. Purchase Audit Logs
export const purchaseLogs = pgTable('purchase_logs', {
  id: text('id').primaryKey(),
  purchaseId: text('purchase_id').references(() => purchases.id, { onDelete: 'cascade' }).notNull(),
  userId: text('user_id'),
  userName: text('user_name').notNull().default(''),
  userRole: text('user_role').default(''),
  action: text('action').notNull(),
  modification: text('modification').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const purchaseLogsRelations = relations(purchaseLogs, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseLogs.purchaseId],
    references: [purchases.id],
  }),
}));

// 6. Purchase Items
export const purchaseItems = pgTable('purchase_items', {
  id: text('id').primaryKey(),
  purchaseId: text('purchase_id').references(() => purchases.id, { onDelete: 'cascade' }).notNull(),
  materialId: text('material_id').references(() => materials.id).notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull(),
  purchaseUnit: text('purchase_unit').notNull(),
  receivedKg: numeric('received_kg', { precision: 12, scale: 2 }).default('0'),
  receivedPieces: numeric('received_pieces', { precision: 12, scale: 2 }).default('0'),
  unitCostDzd: numeric('unit_cost_dzd', { precision: 15, scale: 2 }).notNull(),
  totalCostDzd: numeric('total_cost_dzd', { precision: 15, scale: 2 }).notNull(),
});

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseItems.purchaseId],
    references: [purchases.id],
  }),
  material: one(materials, {
    fields: [purchaseItems.materialId],
    references: [materials.id],
  }),
}));

// 7. Orders
export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  customerId: text('customer_id').references(() => customers.id),
  customerName: text('customer_name').notNull(), // Denormalized or walk-in name
  orderDate: text('order_date').notNull(), // YYYY-MM-DD
  dueDate: text('due_date').default(''),
  status: text('status').notNull().default('new'), // 'new' | 'confirmed' | 'confirmed_phone' | 'in_production' | 'ready_for_delivery' | 'delivered' | 'cancelled'
  channel: text('channel').default('whatsapp'), // 'whatsapp' | 'messenger' | 'phone_call' | 'tiktok_dm' | 'instagram_dm' | 'walk_in'
  subtotalDzd: numeric('subtotal_dzd', { precision: 15, scale: 2 }).notNull().default('0'),
  discountDzd: numeric('discount_dzd', { precision: 15, scale: 2 }).notNull().default('0'),
  deliveryFeeDzd: numeric('delivery_fee_dzd', { precision: 15, scale: 2 }).notNull().default('0'),
  totalAmountDzd: numeric('total_amount_dzd', { precision: 15, scale: 2 }).notNull().default('0'),
  amountPaidDzd: numeric('amount_paid_dzd', { precision: 15, scale: 2 }).notNull().default('0'),
  deliveryDate: text('delivery_date').default(''),
  notes: text('notes').default(''),
  createdBy: text('created_by').references(() => profiles.id),
  createdByName: text('created_by_name').default(''),
  createdByRole: text('created_by_role').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
  productionRecords: many(productionRecords),
  allocations: many(paymentAllocations),
  logs: many(orderLogs),
}));

// 8. Order Items
export const orderItems = pgTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  bagType: text('bag_type').notNull(), // 'plastic' | 'carton' | 'tnt' | 'custom'
  size: text('size').notNull(), // e.g. '25x35', '30x40'
  bagColor: text('bag_color').default('White'),
  printColors: text('print_colors').default('1 Color'),
  designNotes: text('design_notes').default(''),
  artworkUrl: text('artwork_url').default(''),
  quantityPieces: numeric('quantity_pieces', { precision: 12, scale: 2 }).notNull(),
  unitPriceDzd: numeric('unit_price_dzd', { precision: 15, scale: 2 }).notNull(),
  lineTotalDzd: numeric('line_total_dzd', { precision: 15, scale: 2 }).notNull(),
});

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

// 8b. Order Audit Logs
export const orderLogs = pgTable('order_logs', {
  id: text('id').primaryKey(),
  orderId: text('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  userId: text('user_id'),
  userName: text('user_name').notNull().default(''),
  userRole: text('user_role').default(''),
  action: text('action').notNull(),
  modification: text('modification').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const orderLogsRelations = relations(orderLogs, ({ one }) => ({
  order: one(orders, {
    fields: [orderLogs.orderId],
    references: [orders.id],
  }),
}));

// 9. Production Records
export const productionRecords = pgTable('production_records', {
  id: text('id').primaryKey(),
  productionNumber: text('production_number').notNull().unique(),
  orderId: text('order_id').references(() => orders.id).notNull(),
  startDate: timestamp('start_date').defaultNow(),
  completionDate: timestamp('completion_date'),
  plannedQuantity: numeric('planned_quantity', { precision: 12, scale: 2 }).notNull(),
  completedQuantity: numeric('completed_quantity', { precision: 12, scale: 2 }).notNull().default('0'),
  rejectedQuantity: numeric('rejected_quantity', { precision: 12, scale: 2 }).notNull().default('0'),
  workerId: text('worker_id').references(() => profiles.id),
  workerName: text('worker_name').default(''),
  notes: text('notes').default(''),
  status: text('status').notNull().default('in_progress'), // 'in_progress' | 'completed'
  createdAt: timestamp('created_at').defaultNow(),
});

export const productionRecordsRelations = relations(productionRecords, ({ one, many }) => ({
  order: one(orders, {
    fields: [productionRecords.orderId],
    references: [orders.id],
  }),
  usage: many(productionUsage),
  logs: many(productionLogs),
}));

// 10. Production Usage
export const productionUsage = pgTable('production_usage', {
  id: text('id').primaryKey(),
  productionId: text('production_id').references(() => productionRecords.id, { onDelete: 'cascade' }).notNull(),
  materialId: text('material_id').references(() => materials.id).notNull(),
  materialName: text('material_name').notNull().default(''),
  quantityUsed: numeric('quantity_used', { precision: 12, scale: 2 }).notNull(),
  unit: text('unit').notNull(), // 'kg' | 'piece'
  wasteQuantity: numeric('waste_quantity', { precision: 12, scale: 2 }).default('0'),
  notes: text('notes').default(''),
});

export const productionUsageRelations = relations(productionUsage, ({ one }) => ({
  production: one(productionRecords, {
    fields: [productionUsage.productionId],
    references: [productionRecords.id],
  }),
  material: one(materials, {
    fields: [productionUsage.materialId],
    references: [materials.id],
  }),
}));

// 10b. Production Audit Logs
export const productionLogs = pgTable('production_logs', {
  id: text('id').primaryKey(),
  productionId: text('production_id').references(() => productionRecords.id, { onDelete: 'cascade' }).notNull(),
  userId: text('user_id'),
  userName: text('user_name').notNull().default(''),
  userRole: text('user_role').default(''),
  action: text('action').notNull(),
  modification: text('modification').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const productionLogsRelations = relations(productionLogs, ({ one }) => ({
  production: one(productionRecords, {
    fields: [productionLogs.productionId],
    references: [productionRecords.id],
  }),
}));

// 11. Stock Movement Ledger
export const stockMovements = pgTable('stock_movements', {
  id: text('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow(),
  materialId: text('material_id').references(() => materials.id).notNull(),
  movementType: text('movement_type').notNull(), // 'opening_balance' | 'purchase_receipt' | 'production_consumption' | 'production_waste' | 'customer_return' | 'supplier_return' | 'adjustment_in' | 'adjustment_out'
  quantityIn: numeric('quantity_in', { precision: 12, scale: 2 }).notNull().default('0'),
  quantityOut: numeric('quantity_out', { precision: 12, scale: 2 }).notNull().default('0'),
  unit: text('unit').notNull(),
  referenceType: text('reference_type').default('manual'), // 'purchase' | 'production' | 'order' | 'adjustment' | 'manual'
  referenceId: text('reference_id').default(''),
  unitCostDzd: numeric('unit_cost_dzd', { precision: 15, scale: 2 }).default('0'),
  userId: text('user_id').references(() => profiles.id),
  userName: text('user_name').default(''),
  notes: text('notes').default(''),
});

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  material: one(materials, {
    fields: [stockMovements.materialId],
    references: [materials.id],
  }),
}));

// 12. Payments
export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  paymentNumber: text('payment_number').notNull().unique(),
  paymentDate: text('payment_date').notNull(), // YYYY-MM-DD
  paymentType: text('payment_type').notNull(), // 'customer_receipt' | 'supplier_payment'
  customerId: text('customer_id').references(() => customers.id),
  supplierId: text('supplier_id').references(() => suppliers.id),
  partyName: text('party_name').notNull().default(''),
  amountDzd: numeric('amount_dzd', { precision: 15, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').notNull().default('cash'), // 'cash' | 'bank_transfer' | 'check' | 'other'
  referenceNumber: text('reference_number').default(''),
  notes: text('notes').default(''),
  recordedBy: text('recorded_by').references(() => profiles.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const paymentsRelations = relations(payments, ({ many }) => ({
  allocations: many(paymentAllocations),
}));

// 13. Payment Allocations
export const paymentAllocations = pgTable('payment_allocations', {
  id: text('id').primaryKey(),
  paymentId: text('payment_id').references(() => payments.id, { onDelete: 'cascade' }).notNull(),
  orderId: text('order_id').references(() => orders.id),
  purchaseId: text('purchase_id').references(() => purchases.id),
  allocatedAmountDzd: numeric('allocated_amount_dzd', { precision: 15, scale: 2 }).notNull(),
});

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentAllocations.paymentId],
    references: [payments.id],
  }),
  order: one(orders, {
    fields: [paymentAllocations.orderId],
    references: [orders.id],
  }),
  purchase: one(purchases, {
    fields: [paymentAllocations.purchaseId],
    references: [purchases.id],
  }),
}));

// 14. Expense Categories
export const expenseCategories = pgTable('expense_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const expenseCategoriesRelations = relations(expenseCategories, ({ many }) => ({
  expenses: many(expenses),
}));

// 15. Expenses
export const expenses = pgTable('expenses', {
  id: text('id').primaryKey(),
  expenseNumber: text('expense_number').notNull().unique(),
  expenseDate: text('expense_date').notNull(), // YYYY-MM-DD
  categoryId: text('category_id').references(() => expenseCategories.id).notNull(),
  categoryName: text('category_name').notNull(),
  description: text('description').notNull(),
  amountDzd: numeric('amount_dzd', { precision: 15, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').notNull().default('cash'), // 'cash' | 'bank_transfer' | 'check' | 'other'
  paidTo: text('paid_to').default(''),
  referenceNumber: text('reference_number').default(''),
  isPaid: boolean('is_paid').notNull().default(true),
  notes: text('notes').default(''),
  recordedBy: text('recorded_by').references(() => profiles.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const expensesRelations = relations(expenses, ({ one }) => ({
  category: one(expenseCategories, {
    fields: [expenses.categoryId],
    references: [expenseCategories.id],
  }),
}));

// 16. Settings
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 17. Undo Operations (Tracks latest 10 mutations for instant rollback)
export const undoOperations = pgTable('undo_operations', {
  id: text('id').primaryKey(),
  actionType: text('action_type').notNull(), // 'delete' | 'update' | 'bulk_delete'
  entityType: text('entity_type').notNull(), // 'material' | 'purchase' | 'supplier' | 'purchases' | 'suppliers' | 'materials' etc.
  entityId: text('entity_id').notNull(),
  description: text('description').notNull(),
  snapshot: text('snapshot').notNull(), // JSON string representing state before mutation
  performedBy: text('performed_by').default(''),
  performedByRole: text('performed_by_role').default(''),
  isUndone: boolean('is_undone').notNull().default(false),
  timestamp: timestamp('timestamp').defaultNow(),
});
