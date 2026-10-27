import express, { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { db } from '../db/index.ts';
import {
  profiles,
  materials,
  customers,
  suppliers,
  purchases,
  purchaseItems,
  orders,
  orderItems,
  productionRecords,
  productionUsage,
  stockMovements,
  payments,
  paymentAllocations,
  expenseCategories,
  expenses,
  settings,
  orderLogs,
  purchaseLogs,
  productionLogs,
  undoOperations,
} from '../db/schema.ts';
import { eq, desc, and, gte, lte, sql, inArray } from 'drizzle-orm';
import { requireAuth, requireOwner, requireOwnerOrAdmin, requireOrderManagerOrAdmin, requireInventoryManagerOrAdmin, AuthRequest } from '../middleware/auth.ts';

// Normalize permissions according to business rules:
// "when i give someone access to order and inventory and purchases you give them the standerd commercial access"
export function normalizePermissions(perms: string[]): string[] {
  if (!Array.isArray(perms)) return ['orders', 'customers', 'inactive_clients'];
  if (perms.includes('all')) return ['all'];
  const set = new Set(perms);
  if (set.has('orders') && set.has('inventory') && set.has('purchases')) {
    set.add('customers');
    set.add('inactive_clients');
  }
  return Array.from(set);
}

export const apiApp = express();
apiApp.use(express.json());

// Track database modification timestamp for real-time synchronization across all accounts
export let lastDataMutationTimestamp = Date.now();
export function notifyDataMutation() {
  lastDataMutationTimestamp = Date.now();
}

// -------------------------------------------------------------
// Real-time Live Synchronization Hub (SSE - Server-Sent Events)
// Similar to Google Sheets live multi-user collaboration
// -------------------------------------------------------------
interface SSEClient {
  id: string;
  res: Response;
  connectedAt: number;
}

const sseClients = new Set<SSEClient>();

export function broadcastRealtimeEvent(event: {
  type: string;
  entity?: string;
  data?: any;
  timestamp?: number;
}) {
  lastDataMutationTimestamp = Date.now();
  const payload = JSON.stringify({
    ...event,
    timestamp: event.timestamp || lastDataMutationTimestamp,
  });

  for (const client of sseClients) {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Server-Sent Events endpoint for instant live sync without page refreshes
apiApp.get('/api/sync/events', (req: Request, res: Response) => {
  // Set headers for SSE streaming
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Initial handshake
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now(), lastModified: lastDataMutationTimestamp })}\n\n`);

  const client: SSEClient = {
    id: `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    res,
    connectedAt: Date.now(),
  };
  sseClients.add(client);

  req.on('close', () => {
    sseClients.delete(client);
  });
});

// Periodic heartbeat every 20s to keep HTTP connections alive across mobile networks & firewalls
const heartbeatInterval = setInterval(() => {
  for (const client of sseClients) {
    try {
      client.res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}, 20000);
if (heartbeatInterval && typeof heartbeatInterval.unref === 'function') {
  heartbeatInterval.unref();
}

// Auto-bump mutation timestamp on any successful POST, PUT, PATCH, DELETE and broadcast
apiApp.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        lastDataMutationTimestamp = Date.now();
        const pathParts = req.path.split('/');
        const entity = pathParts[2] || 'general';
        broadcastRealtimeEvent({
          type: 'DB_MUTATION',
          entity,
          timestamp: lastDataMutationTimestamp,
        });
      }
    });
  }
  next();
});

// Live Sync status polling endpoint (fast fallback)
apiApp.get('/api/sync/status', (req: Request, res: Response) => {
  res.json({
    lastModified: lastDataMutationTimestamp,
    timestamp: Date.now(),
    connectedClients: sseClients.size,
  });
});

// Helper to generate unique IDs
const genId = () => crypto.randomUUID();
const todayStr = () => new Date().toISOString().split('T')[0];

export const OWNER_EMAIL = 'abdallahcrypto036@gmail.com';
export const OWNER_PASS = 'abdou2003';

// Ensure the unique owner account is seeded and strictly enforced
export async function ensureOwnerAccount() {
  try {
    const existing = await db.select().from(profiles).where(eq(profiles.email, OWNER_EMAIL)).limit(1);
    if (existing.length === 0) {
      await db.insert(profiles).values({
        id: 'owner-abdallah',
        email: OWNER_EMAIL,
        fullName: 'Abdallah (Owner)',
        role: 'owner',
        phone: '+213 555 00 00 00',
        password: OWNER_PASS,
        permissions: JSON.stringify(['all']),
        isActive: true,
      });
      console.log('Seeded primary owner account:', OWNER_EMAIL);
    } else {
      await db
        .update(profiles)
        .set({
          fullName: existing[0].fullName || 'Abdallah (Owner)',
          role: 'owner',
          password: OWNER_PASS,
          isActive: true,
          permissions: JSON.stringify(['all']),
        })
        .where(eq(profiles.email, OWNER_EMAIL));
    }
  } catch (err) {
    console.warn('Error in ensureOwnerAccount:', err);
  }
}

// Ensure undo_operations table exists in database
export async function ensureUndoOperationsTable() {
  // Table schema is managed via Drizzle ORM and Cloud SQL UpdateSchema
  return;
}

// Automatically delete undo operations older than 24 hours
export async function cleanupOldUndoOperations() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.delete(undoOperations).where(lte(undoOperations.timestamp, cutoff));
  } catch (err) {
    console.warn('cleanupOldUndoOperations notice:', err);
  }
}

// Run cleanup periodically every hour
const undoCleanupInterval = setInterval(() => {
  cleanupOldUndoOperations();
}, 3600000);
if (undoCleanupInterval && typeof undoCleanupInterval.unref === 'function') {
  undoCleanupInterval.unref();
}

// Ensure production_logs table exists in database
export async function ensureProductionLogsTable() {
  // Schema is managed by Drizzle ORM and Cloud SQL UpdateSchema
  return;
}

// Live stock lookup map: calculates authoritative stock from stockMovements
export async function getMaterialsStockMap(): Promise<Map<string, { currentStock: number; stockUnit: string; name: string; trackingMode: string }>> {
  const matList = await db.select().from(materials);
  const movements = await db.select().from(stockMovements);
  const movementsMap = new Map<string, number>();

  movements.forEach((mv) => {
    const qtyIn = parseFloat(mv.quantityIn || '0');
    const qtyOut = parseFloat(mv.quantityOut || '0');
    const prev = movementsMap.get(mv.materialId) ?? 0;
    movementsMap.set(mv.materialId, prev + (qtyIn - qtyOut));
  });

  const stockMap = new Map<string, { currentStock: number; stockUnit: string; name: string; trackingMode: string }>();
  matList.forEach((m) => {
    let currentStock = 0;
    if (movementsMap.has(m.id)) {
      currentStock = Math.max(0, movementsMap.get(m.id)!);
    } else {
      currentStock = m.trackingMode === 'kg' ? parseFloat(m.openingStockKg || '0') : parseFloat(m.openingStockPieces || '0');
    }
    stockMap.set(m.id, { currentStock, stockUnit: m.stockUnit, name: m.name, trackingMode: m.trackingMode });
  });

  return stockMap;
}

// Recalculate weighted average price per Kg for a material when new stock is added
// Formula: Prix Kg = (Montant Facture old stock + Montant Facture new stock) / (Quantity new stock (kg) + Quantity old stock (kg))
export async function recalculateWeightedAverageUnitCost(
  materialId: string,
  incomingQty: number,
  incomingUnit: string,
  incomingUnitCostDzd: number,
  incomingKg?: number,
  incomingTotalCostDzd?: number
) {
  try {
    const currentMat = await db.select().from(materials).where(eq(materials.id, materialId)).limit(1);
    if (!currentMat.length) return;

    const mat = currentMat[0];
    const oldPricePerKg = parseFloat(mat.unitCostDzd || '0');
    const piecesPerKg = parseFloat(mat.piecesPerKg || '0');

    // 1. Quantity new stock (kg)
    let quantityNewStockKg = 0;
    if (incomingKg !== undefined && incomingKg > 0) {
      quantityNewStockKg = incomingKg;
    } else if (incomingUnit === 'kg' || ['ink', 'diluent', 'retarder'].includes(mat.category) || mat.trackingMode === 'kg') {
      quantityNewStockKg = incomingQty;
    } else if (piecesPerKg > 0) {
      quantityNewStockKg = incomingQty / piecesPerKg;
    } else {
      quantityNewStockKg = incomingQty;
    }

    if (quantityNewStockKg <= 0) return;

    // 2. Montant Facture new stock (DZD)
    let montantFactureNewStock = 0;
    if (incomingTotalCostDzd !== undefined && incomingTotalCostDzd > 0) {
      montantFactureNewStock = incomingTotalCostDzd;
    } else if (incomingUnitCostDzd > 0) {
      if (incomingUnit === 'piece' && piecesPerKg > 0) {
        montantFactureNewStock = incomingQty * incomingUnitCostDzd;
      } else {
        montantFactureNewStock = quantityNewStockKg * incomingUnitCostDzd;
      }
    }

    if (montantFactureNewStock <= 0) return;

    // 3. Quantity old stock (kg)
    const movements = await db.select().from(stockMovements).where(eq(stockMovements.materialId, materialId));
    let totalDbUnits = 0;
    movements.forEach((m) => {
      totalDbUnits += parseFloat(m.quantityIn || '0') - parseFloat(m.quantityOut || '0');
    });

    let totalDbKg = 0;
    if (['ink', 'diluent', 'retarder'].includes(mat.category) || mat.trackingMode === 'kg' || mat.stockUnit === 'kg') {
      totalDbKg = Math.max(0, totalDbUnits);
    } else if (piecesPerKg > 0) {
      totalDbKg = Math.max(0, totalDbUnits) / piecesPerKg;
    } else {
      totalDbKg = Math.max(0, totalDbUnits);
    }

    // Quantity old stock (kg) before addition
    const quantityOldStockKg = Math.max(0, totalDbKg - quantityNewStockKg);

    // 4. Montant Facture old stock (DZD)
    const montantFactureOldStock = quantityOldStockKg * oldPricePerKg;

    // 5. Apply User Formula:
    // Prix Kg = (Montant Facture old stock + Montant Facture new stock) / (Quantity new stock (kg) + Quantity old stock (kg))
    let prixKg = 0;
    const totalKg = quantityOldStockKg + quantityNewStockKg;

    if (quantityOldStockKg > 0 && oldPricePerKg > 0) {
      prixKg = (montantFactureOldStock + montantFactureNewStock) / totalKg;
    } else {
      prixKg = montantFactureNewStock / quantityNewStockKg;
    }

    const finalPricePerKg = Number(prixKg.toFixed(2));
    if (finalPricePerKg > 0) {
      await db.update(materials).set({ unitCostDzd: String(finalPricePerKg) }).where(eq(materials.id, materialId));
    }
  } catch (err) {
    console.warn('Error in recalculateWeightedAverageUnitCost:', err);
  }
}

// Record an operation in the 10-operation undo stack
export async function recordUndoOperation({
  actionType,
  entityType,
  entityId,
  description,
  snapshot,
  req,
  performedBy,
  performedByRole,
}: {
  actionType: 'delete' | 'update' | 'bulk_delete';
  entityType: string;
  entityId: string;
  description: string;
  snapshot: any;
  req?: AuthRequest;
  performedBy?: string;
  performedByRole?: string;
}) {
  try {
    await ensureUndoOperationsTable();
    const opId = genId();
    const effectivePerformedBy =
      performedBy ||
      req?.user?.name ||
      (req?.user?.email ? req.user.email.split('@')[0] : 'Abdallah');
    const effectiveRole = performedByRole || req?.userRole || 'owner';

    await db.insert(undoOperations).values({
      id: opId,
      actionType,
      entityType,
      entityId,
      description,
      snapshot: typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot),
      performedBy: effectivePerformedBy,
      performedByRole: effectiveRole,
      isUndone: false,
    });

    // Retain up to 100 operations in the undo history
    const all = await db
      .select({ id: undoOperations.id })
      .from(undoOperations)
      .orderBy(desc(undoOperations.timestamp));

    if (all.length > 100) {
      const excess = all.slice(100);
      for (const item of excess) {
        await db.delete(undoOperations).where(eq(undoOperations.id, item.id));
      }
    }

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'UNDO_RECORDED',
      entity: entityType,
      data: { id: opId, description, actionType },
    });

    return opId;
  } catch (err) {
    console.error('Failed to record undo operation:', err);
  }
}

// Initialize owner account, undo table, and production logs on startup
ensureOwnerAccount();
ensureUndoOperationsTable();
ensureProductionLogsTable();

// Health Check
apiApp.get('/api/health', async (req: Request, res: Response) => {
  await ensureOwnerAccount();
  await ensureUndoOperationsTable();
  await ensureProductionLogsTable();
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Helper to resolve a valid profile ID in PostgreSQL or null to prevent foreign key errors
export async function resolveValidProfileId(uid?: string): Promise<string | null> {
  if (uid && uid.trim()) {
    const existing = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, uid.trim())).limit(1);
    if (existing.length > 0) return existing[0].id;
  }
  const first = await db.select({ id: profiles.id }).from(profiles).limit(1);
  return first.length > 0 ? first[0].id : null;
}

// -------------------------------------------------------------
// 1. Auth & Profiles
// -------------------------------------------------------------
// Public Signup / Access Request (Commerciale only)
apiApp.post('/api/auth/signup-request', async (req: Request, res: Response) => {
  try {
    const { email, fullName, password, phone, role, notes } = req.body;
    if (!email || !fullName) {
      return res.status(400).json({ error: 'Email and full name are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === OWNER_EMAIL) {
      return res.status(400).json({ error: 'This email is reserved for the workshop owner.' });
    }

    const existing = await db.select().from(profiles).where(eq(profiles.email, cleanEmail)).limit(1);
    if (existing.length > 0) {
      if (existing[0].isActive) {
        return res.status(400).json({ error: 'An account with this email already exists. You can log in directly with your password.' });
      } else {
        return res.status(400).json({ error: 'Your signup request is already pending administrator approval. Please contact Abdallah to activate your account.' });
      }
    }

    const newId = `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const validRoles = ['owner', 'admin', 'commerciale'];
    const requestedRole = role && validRoles.includes(role) ? role : 'commerciale';
    const defaultPerms = requestedRole === 'owner' || requestedRole === 'admin'
      ? ['all']
      : ['orders', 'customers', 'inactive_clients'];

    const newProfile = await db
      .insert(profiles)
      .values({
        id: newId,
        email: cleanEmail,
        fullName: fullName.trim(),
        role: requestedRole,
        phone: phone ? String(phone).trim() : '',
        password: password ? String(password).trim() : 'an1234',
        permissions: JSON.stringify(defaultPerms),
        notes: notes ? String(notes).trim() : '',
        isActive: false, // Pending owner approval
      })
      .returning();

    // Broadcast instant real-time notification to all connected clients (especially owner)
    broadcastRealtimeEvent({
      type: 'NEW_COMMERCIAL_REQUEST',
      entity: 'team',
      data: {
        id: newProfile[0].id,
        email: newProfile[0].email,
        fullName: newProfile[0].fullName,
        role: newProfile[0].role,
        phone: newProfile[0].phone,
        notes: newProfile[0].notes,
        createdAt: newProfile[0].createdAt,
      },
      timestamp: Date.now(),
    });

    res.status(201).json({
      success: true,
      message: 'Signup request submitted successfully! Your account will be activated by the owner (Abdallah).',
      user: {
        id: newProfile[0].id,
        email: newProfile[0].email,
        fullName: newProfile[0].fullName,
        role: newProfile[0].role,
        phone: newProfile[0].phone,
        notes: newProfile[0].notes,
        isActive: false,
      },
    });
  } catch (error: any) {
    console.error('Failed to submit signup request:', error);
    res.status(500).json({ error: 'Failed to process signup request. Please try again.' });
  }
});

// Public Login with Specific Credentials (set by admin or registered)
apiApp.post('/api/auth/login-credentials', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = String(password).trim();

    // Check Owner Credentials
    if (cleanEmail === OWNER_EMAIL) {
      if (cleanPassword !== OWNER_PASS) {
        return res.status(401).json({ error: 'Invalid owner password.' });
      }

      await ensureOwnerAccount();
      const ownerUser = await db.select().from(profiles).where(eq(profiles.email, OWNER_EMAIL)).limit(1);
      const user = ownerUser[0];

      return res.json({
        token: `custom-${user.id}`,
        profile: {
          ...user,
          role: 'owner',
          permissions: ['all'],
        },
      });
    }

    // Check Commerciale / Staff Credentials
    const existing = await db.select().from(profiles).where(eq(profiles.email, cleanEmail)).limit(1);

    if (existing.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials. User does not exist.' });
    }

    const user = existing[0];
    if (user.password && user.password !== cleanPassword) {
      return res.status(401).json({ error: 'Invalid password. Please check your credentials or contact Abdallah.' });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'Your account is pending administrator approval. Please contact the workshop owner (Abdallah) to activate your access.',
        isPending: true,
      });
    }

    // Determine effective role and permissions
    const effectiveRole = (user.role as 'owner' | 'admin' | 'commerciale') || 'commerciale';
    let userPerms: string[] = [];
    try {
      userPerms = JSON.parse(user.permissions || '[]');
    } catch {
      userPerms = [];
    }

    if (effectiveRole === 'owner') {
      userPerms = ['all'];
    } else if (effectiveRole === 'admin') {
      userPerms = userPerms.length > 0 ? userPerms : ['all'];
    } else {
      // Commerciale / Staff: retain their assigned permissions (e.g. orders, inventory, purchases)
      if (userPerms.length === 0) {
        userPerms = ['orders', 'customers', 'inactive_clients'];
      }
    }

    // Return custom authorization token
    res.json({
      token: `custom-${user.id}`,
      profile: {
        ...user,
        role: effectiveRole,
        permissions: userPerms,
      },
    });
  } catch (error: any) {
    console.error('Failed to login with credentials:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

apiApp.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    let profile = await db.select().from(profiles).where(eq(profiles.id, req.user!.uid)).limit(1);
    if (!profile.length && req.user?.email) {
      profile = await db.select().from(profiles).where(eq(profiles.email, req.user.email.trim().toLowerCase())).limit(1);
    }
    if (!profile.length) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    const user = profile[0];
    let userPerms: string[] = [];
    try {
      userPerms = JSON.parse(user.permissions || '[]');
    } catch {
      userPerms = [];
    }
    if (user.role === 'owner') {
      userPerms = ['all'];
    } else if (user.role === 'admin') {
      userPerms = userPerms.length > 0 ? userPerms : ['all'];
    } else if (userPerms.length === 0) {
      userPerms = ['orders', 'customers', 'inactive_clients'];
    }
    res.json({
      ...user,
      permissions: userPerms,
    });
  } catch (error: any) {
    console.error('Failed to get profile:', error);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

apiApp.put('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { fullName, phone } = req.body;
    const updated = await db
      .update(profiles)
      .set({
        fullName: fullName || '',
        phone: phone || '',
      })
      .where(eq(profiles.id, req.user!.uid))
      .returning();
    res.json(updated[0]);
  } catch (error: any) {
    console.error('Failed to update profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

apiApp.get('/api/team', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const team = await db.select().from(profiles).orderBy(desc(profiles.createdAt));
    const sanitized = team.map((m) => {
      let parsedPerms: string[] = [];
      try {
        parsedPerms = JSON.parse(m.permissions || '[]');
      } catch {
        parsedPerms = [];
      }
      return {
        ...m,
        permissions: parsedPerms,
      };
    });
    res.json(sanitized);
  } catch (error: any) {
    console.error('Failed to fetch team:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

apiApp.post('/api/team', requireAuth, requireOwnerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { email, fullName, role, phone, password, permissions } = req.body;
    if (!email || !fullName) {
      return res.status(400).json({ error: 'Email and full name are required' });
    }
    const existing = await db.select().from(profiles).where(eq(profiles.email, email.trim().toLowerCase())).limit(1);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'A user credential with this email already exists' });
    }

    const newId = `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const validRoles = ['owner', 'admin', 'commerciale'];
    let assignedRole = role && validRoles.includes(role) ? role : (email.trim().toLowerCase() === OWNER_EMAIL ? 'owner' : 'commerciale');
    if (assignedRole === 'owner' && req.userRole !== 'owner') {
      assignedRole = 'admin'; // Only an owner can assign the owner role
    }
    const rawPerms = permissions 
      ? (Array.isArray(permissions) ? permissions : [permissions])
      : (assignedRole === 'owner' || assignedRole === 'admin'
          ? ['all']
          : ['orders', 'customers', 'inactive_clients']);
    const finalPerms = normalizePermissions(rawPerms);

    const created = await db
      .insert(profiles)
      .values({
        id: newId,
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        role: assignedRole,
        phone: phone || '',
        password: password || 'pass123',
        permissions: JSON.stringify(finalPerms),
        isActive: true,
      })
      .returning();

    let savedPerms: string[] = [];
    try {
      savedPerms = JSON.parse(created[0].permissions || '[]');
    } catch {
      savedPerms = finalPerms;
    }

    res.status(201).json({
      ...created[0],
      permissions: savedPerms,
    });
  } catch (error: any) {
    console.error('Failed to create team credentials:', error);
    res.status(500).json({ error: error.message || 'Failed to create team user credentials' });
  }
});

apiApp.put('/api/team/:id', requireAuth, requireOwnerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { email, fullName, role, phone, password, permissions, isActive } = req.body;
    const updates: any = {};
    if (email !== undefined) updates.email = email.trim().toLowerCase();
    if (fullName !== undefined) updates.fullName = fullName.trim();
    if (role !== undefined) {
      const validRoles = ['owner', 'admin', 'commerciale'];
      if (validRoles.includes(role)) {
        updates.role = role;
      }
    }
    if (phone !== undefined) updates.phone = phone;
    if (password !== undefined) updates.password = password;
    if (permissions !== undefined) {
      const pList = Array.isArray(permissions) ? permissions : [permissions];
      updates.permissions = JSON.stringify(normalizePermissions(pList));
    }
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    const updated = await db
      .update(profiles)
      .set(updates)
      .where(eq(profiles.id, req.params.id))
      .returning();

    if (!updated.length) {
      return res.status(404).json({ error: 'User credentials not found' });
    }

    let parsedPerms: string[] = [];
    try {
      parsedPerms = JSON.parse(updated[0].permissions || '[]');
    } catch {
      parsedPerms = [];
    }

    res.json({
      ...updated[0],
      permissions: parsedPerms,
    });
  } catch (error: any) {
    console.error('Failed to update user credentials:', error);
    res.status(500).json({ error: 'Failed to update user credentials' });
  }
});

// Pending team join requests (submitted from mobile / web)
apiApp.get('/api/team/pending', requireAuth, requireOwnerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const pending = await db
      .select()
      .from(profiles)
      .where(eq(profiles.isActive, false))
      .orderBy(desc(profiles.createdAt));
    res.json(pending);
  } catch (error: any) {
    console.error('Failed to fetch pending requests:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

apiApp.patch('/api/team/:id/approve', requireAuth, requireOwnerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { role, permissions } = req.body;
    const validRoles = ['owner', 'admin', 'commerciale'];
    const assignedRole = role && validRoles.includes(role) ? role : 'commerciale';
    const rawPerms = permissions 
      ? (Array.isArray(permissions) ? permissions : [permissions])
      : (assignedRole === 'owner' || assignedRole === 'admin'
          ? ['all']
          : ['orders', 'customers', 'inactive_clients']);
    const finalPerms = normalizePermissions(rawPerms);

    const updates: any = {
      isActive: true,
      role: assignedRole,
      permissions: JSON.stringify(finalPerms),
    };

    const updated = await db
      .update(profiles)
      .set(updates)
      .where(eq(profiles.id, req.params.id))
      .returning();

    if (!updated.length) {
      return res.status(404).json({ error: 'User credentials not found' });
    }

    let parsedPerms: string[] = [];
    try {
      parsedPerms = JSON.parse(updated[0].permissions || '[]');
    } catch {
      parsedPerms = finalPerms;
    }

    res.json({
      ...updated[0],
      permissions: parsedPerms,
    });
  } catch (error: any) {
    console.error('Failed to approve user:', error);
    res.status(500).json({ error: 'Failed to approve user account' });
  }
});

apiApp.delete('/api/team/:id', requireAuth, requireOwnerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (req.params.id === req.user?.uid) {
      return res.status(400).json({ error: 'Cannot delete the active account' });
    }
    const target = await db.select().from(profiles).where(eq(profiles.id, req.params.id)).limit(1);
    if (target.length > 0 && target[0].role === 'owner' && req.userRole !== 'owner') {
      return res.status(403).json({ error: 'Only a primary owner can remove another owner account' });
    }
    await db.delete(profiles).where(eq(profiles.id, req.params.id));
    res.json({ success: true, message: 'User credentials removed successfully' });
  } catch (error: any) {
    console.error('Failed to remove user credentials:', error);
    res.status(500).json({ error: 'Failed to remove user credentials' });
  }
});

apiApp.patch('/api/team/:id/role', requireAuth, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.body;
    const validRoles = ['owner', 'admin', 'commerciale'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Supported roles are owner, admin, and commerciale.' });
    }
    const target = await db.select().from(profiles).where(eq(profiles.id, req.params.id)).limit(1);
    if (!target.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    const updated = await db
      .update(profiles)
      .set({ role })
      .where(eq(profiles.id, req.params.id))
      .returning();
    res.json(updated[0]);
  } catch (error: any) {
    console.error('Failed to update role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// -------------------------------------------------------------
// 2. Settings & Initial Seeder
// -------------------------------------------------------------
apiApp.get('/api/settings', async (req: Request, res: Response) => {
  try {
    const list = await db.select().from(settings);
    const map: Record<string, string> = {};
    list.forEach((item) => {
      map[item.key] = item.value;
    });
    res.json(map);
  } catch (error: any) {
    console.error('Failed to load settings:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

apiApp.post('/api/settings', requireAuth, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Missing key or value' });
    }
    const result = await db
      .insert(settings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: String(value), updatedAt: new Date() },
      })
      .returning();
    res.json(result[0]);
  } catch (error: any) {
    console.error('Failed to save setting:', error);
    res.status(500).json({ error: 'Failed to save setting' });
  }
});

// Download complete database instance as Excel file with separate worksheets for each table
apiApp.get('/api/database/export-excel', requireAuth, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    const [
      allOrders,
      allOrderItems,
      allCustomers,
      allMaterials,
      allStockMovements,
      allPurchases,
      allPurchaseItems,
      allSuppliers,
      allPayments,
      allExpenses,
      allProfiles,
      allSettings,
      allOrderLogs,
      allProductionRecords,
      allProductionUsage,
      allExpenseCategories,
    ] = await Promise.all([
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(orderItems),
      db.select().from(customers).orderBy(desc(customers.createdAt)),
      db.select().from(materials).orderBy(desc(materials.createdAt)),
      db.select().from(stockMovements).orderBy(desc(stockMovements.timestamp)),
      db.select().from(purchases).orderBy(desc(purchases.createdAt)),
      db.select().from(purchaseItems),
      db.select().from(suppliers).orderBy(desc(suppliers.createdAt)),
      db.select().from(payments).orderBy(desc(payments.createdAt)),
      db.select().from(expenses).orderBy(desc(expenses.createdAt)),
      db.select().from(profiles).orderBy(desc(profiles.createdAt)),
      db.select().from(settings),
      db.select().from(orderLogs).orderBy(desc(orderLogs.timestamp)),
      db.select().from(productionRecords).orderBy(desc(productionRecords.createdAt)),
      db.select().from(productionUsage),
      db.select().from(expenseCategories),
    ]);

    const wb = XLSX.utils.book_new();

    const tablesToExport = [
      { name: 'Orders', data: allOrders },
      { name: 'Order_Items', data: allOrderItems },
      { name: 'Customers', data: allCustomers },
      { name: 'Inventory_Materials', data: allMaterials },
      { name: 'Stock_Movements', data: allStockMovements },
      { name: 'Purchases', data: allPurchases },
      { name: 'Purchase_Items', data: allPurchaseItems },
      { name: 'Suppliers', data: allSuppliers },
      { name: 'Payments', data: allPayments },
      { name: 'Expenses', data: allExpenses },
      { name: 'Expense_Categories', data: allExpenseCategories },
      { name: 'Production_Runs', data: allProductionRecords },
      { name: 'Production_Usage', data: allProductionUsage },
      {
        name: 'Users_Profiles',
        data: allProfiles.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          email: p.email,
          role: p.role,
          phone: p.phone,
          isActive: p.isActive,
          createdAt: p.createdAt,
        })),
      },
      { name: 'System_Settings', data: allSettings },
      { name: 'Order_Audit_Logs', data: allOrderLogs },
    ];

    tablesToExport.forEach((table) => {
      const rows = table.data.length > 0 ? table.data : [{ notice: 'No records in table' }];
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, table.name.slice(0, 31));
    });

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const dateStr = new Date().toISOString().split('T')[0];

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="an_printing_database_instance_${dateStr}.xlsx"`
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.send(buffer);
  } catch (error: any) {
    console.error('Failed to export database instance to Excel:', error);
    res.status(500).json({ error: 'Failed to export database instance to Excel' });
  }
});

// JSON Dump endpoint for programmatic backup
apiApp.get('/api/database/dump-json', requireAuth, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    const [
      allOrders,
      allOrderItems,
      allCustomers,
      allMaterials,
      allStockMovements,
      allPurchases,
      allSuppliers,
      allPayments,
      allExpenses,
      allProfiles,
      allSettings,
    ] = await Promise.all([
      db.select().from(orders),
      db.select().from(orderItems),
      db.select().from(customers),
      db.select().from(materials),
      db.select().from(stockMovements),
      db.select().from(purchases),
      db.select().from(suppliers),
      db.select().from(payments),
      db.select().from(expenses),
      db.select().from(profiles),
      db.select().from(settings),
    ]);

    res.json({
      exportedAt: new Date().toISOString(),
      workshop: 'An Printing (Algeria)',
      database: {
        orders: allOrders,
        orderItems: allOrderItems,
        customers: allCustomers,
        materials: allMaterials,
        stockMovements: allStockMovements,
        purchases: allPurchases,
        suppliers: allSuppliers,
        payments: allPayments,
        expenses: allExpenses,
        profiles: allProfiles.map((p) => ({ ...p, password: '***' })),
        settings: allSettings,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to dump database json' });
  }
});

apiApp.post('/api/seed', async (req: Request, res: Response) => {
  try {
    // 1. Seed Expense Categories
    const existingCats = await db.select().from(expenseCategories);
    if (existingCats.length === 0) {
      const defaultCategories = [
        'Rent',
        'Electricity',
        'Water',
        'Transport & Delivery',
        'Salaries & Wages',
        'Equipment Maintenance',
        'Phone & Internet',
        'Office Supplies',
        'Bank Fees',
        'Other Operating Expenses',
      ];
      for (const name of defaultCategories) {
        await db.insert(expenseCategories).values({
          id: genId(),
          name,
          isSystem: true,
        }).onConflictDoNothing();
      }
    }

    // 2. Seed Settings
    const defaultSettings = [
      { key: 'company_name', value: 'An Printing' },
      { key: 'currency', value: 'DZD' },
      { key: 'phone', value: '+213 555 12 34 56' },
      { key: 'address', value: 'Zone Industrielle, Algiers, Algeria' },
      { key: 'tax_number', value: 'NIF-0998877665544' },
      { key: 'commercial_register', value: 'RC-16/00-12345B20' },
    ];
    for (const s of defaultSettings) {
      await db.insert(settings).values(s).onConflictDoNothing();
    }

    // 3. Seed Sample Materials if empty
    const existingMaterials = await db.select().from(materials);
    if (existingMaterials.length === 0) {
      const sampleMaterials = [
        {
          id: genId(),
          code: 'MAT-PLAS-2535',
          name: 'Blank Plastic Bags 25×35 White (HDPE)',
          category: 'blank_plastic',
          description: 'White high-density polyethylene blank bags with die-cut handles',
          trackingMode: 'dual_kg_units',
          purchaseUnit: 'kg',
          stockUnit: 'piece',
          piecesPerKg: '72.00', // Measured conversion: 72 bags per kg
          reorderThreshold: '500.00',
          unitCostDzd: '6.50',
          openingStockKg: '100.00',
          openingStockPieces: '7200.00',
          isActive: true,
        },
        {
          id: genId(),
          code: 'MAT-PLAS-3040',
          name: 'Blank Plastic Bags 30×40 Transparent',
          category: 'blank_plastic',
          description: 'Transparent standard gauge plastic bags',
          trackingMode: 'dual_kg_units',
          purchaseUnit: 'kg',
          stockUnit: 'piece',
          piecesPerKg: '50.00', // 50 bags per kg
          reorderThreshold: '300.00',
          unitCostDzd: '9.20',
          openingStockKg: '60.00',
          openingStockPieces: '3000.00',
          isActive: true,
        },
        {
          id: genId(),
          code: 'MAT-CART-KRAFT',
          name: 'Blank Kraft Carton Bags 26×32 with Twisted Handle',
          category: 'blank_carton',
          description: 'Brown kraft carton gift & retail bags',
          trackingMode: 'units',
          purchaseUnit: 'piece',
          stockUnit: 'piece',
          piecesPerKg: '0',
          reorderThreshold: '200.00',
          unitCostDzd: '35.00',
          openingStockKg: '0',
          openingStockPieces: '1200.00',
          isActive: true,
        },
        {
          id: genId(),
          code: 'MAT-TNT-3540',
          name: 'Blank TNT Non-Woven Bags 35×40 Black',
          category: 'blank_tnt',
          description: 'Black ultrasonic welded reusable non-woven bags',
          trackingMode: 'units',
          purchaseUnit: 'piece',
          stockUnit: 'piece',
          piecesPerKg: '0',
          reorderThreshold: '200.00',
          unitCostDzd: '28.00',
          openingStockKg: '0',
          openingStockPieces: '800.00',
          isActive: true,
        },
        {
          id: genId(),
          code: 'INK-BLK-01',
          name: 'Printing Ink - Jet Black Poly Screen',
          category: 'ink',
          description: 'High-adhesion solvent-based screen ink for plastic and TNT',
          trackingMode: 'kg',
          purchaseUnit: 'kg',
          stockUnit: 'kg',
          piecesPerKg: '0',
          reorderThreshold: '10.00',
          unitCostDzd: '1850.00',
          openingStockKg: '25.00',
          openingStockPieces: '0',
          isActive: true,
        },
        {
          id: genId(),
          code: 'INK-GOLD-01',
          name: 'Printing Ink - Metallic Gold Premium',
          category: 'ink',
          description: 'Solvent ink with metallic pigment for luxury boutique bags',
          trackingMode: 'kg',
          purchaseUnit: 'kg',
          stockUnit: 'kg',
          piecesPerKg: '0',
          reorderThreshold: '5.00',
          unitCostDzd: '3200.00',
          openingStockKg: '12.00',
          openingStockPieces: '0',
          isActive: true,
        },
        {
          id: genId(),
          code: 'CHEM-DIL-01',
          name: 'Diluent / Thinner (Solvent 100)',
          category: 'diluent',
          description: 'High purity ink viscosity thinner',
          trackingMode: 'kg',
          purchaseUnit: 'kg',
          stockUnit: 'kg',
          piecesPerKg: '0',
          reorderThreshold: '15.00',
          unitCostDzd: '650.00',
          openingStockKg: '40.00',
          openingStockPieces: '0',
          isActive: true,
        },
        {
          id: genId(),
          code: 'CHEM-RET-01',
          name: 'Retarder Chemical Slow-Dry',
          category: 'retarder',
          description: 'Prevents screen clogging in warm workshop conditions',
          trackingMode: 'kg',
          purchaseUnit: 'kg',
          stockUnit: 'kg',
          piecesPerKg: '0',
          reorderThreshold: '5.00',
          unitCostDzd: '920.00',
          openingStockKg: '15.00',
          openingStockPieces: '0',
          isActive: true,
        },
      ];

      for (const mat of sampleMaterials) {
        await db.insert(materials).values(mat);
        // Record opening balance movement
        const qtyIn = mat.trackingMode === 'kg' ? parseFloat(mat.openingStockKg) : parseFloat(mat.openingStockPieces);
        if (qtyIn > 0) {
          await db.insert(stockMovements).values({
            id: genId(),
            materialId: mat.id,
            movementType: 'opening_balance',
            quantityIn: String(qtyIn),
            quantityOut: '0',
            unit: mat.stockUnit,
            referenceType: 'manual',
            referenceId: 'OPENING',
            unitCostDzd: mat.unitCostDzd,
            userId: (req as AuthRequest).user?.uid || 'system',
            userName: 'System Init',
            notes: 'Initial inventory opening stock balance',
          });
        }
      }
    }

    // 4. Seed Sample Customers if empty
    const existingCust = await db.select().from(customers);
    if (existingCust.length === 0) {
      await db.insert(customers).values([
        {
          id: genId(),
          code: 'CUST-0001',
          name: 'Karim Boukhalfa',
          shopName: 'Boutique Elegance Alger',
          phone: '0550 11 22 33',
          address: 'Didouche Mourad, Algiers',
          category: 'retail',
          openingBalanceDzd: '0',
          creditLimitDzd: '100000',
          notes: 'Regular boutique client for gold printed bags',
          isActive: true,
        },
        {
          id: genId(),
          code: 'CUST-0002',
          name: 'Sofiane Benali',
          shopName: 'Supermarché Le Printemps',
          phone: '0661 44 55 66',
          address: 'Bab Ezzouar, Algiers',
          category: 'wholesale',
          openingBalanceDzd: '15000.00',
          creditLimitDzd: '250000',
          notes: 'High volume plastic bags with barcode and logo',
          isActive: true,
        },
      ]);
    }

    // 5. Seed Sample Suppliers if empty
    const existingSupp = await db.select().from(suppliers);
    if (existingSupp.length === 0) {
      await db.insert(suppliers).values([
        {
          id: genId(),
          code: 'SUPP-0001',
          name: 'Plastique du Nord SARL',
          contactPerson: 'Mourad Hadj',
          phone: '023 88 99 00',
          address: 'Zone Industrielle Oued Smar, Algiers',
          openingBalanceDzd: '0',
          notes: 'Primary supplier of blank HDPE and LDPE plastic bags by kg',
          isActive: true,
        },
        {
          id: genId(),
          code: 'SUPP-0002',
          name: 'Chimie & Sérigraphie Maghreb',
          contactPerson: 'Amine Ziane',
          phone: '025 44 33 22',
          address: 'Blida, Algeria',
          openingBalanceDzd: '0',
          notes: 'Supplier of premium inks, retarders, and solvents',
          isActive: true,
        },
      ]);
    }

    res.json({ success: true, message: 'Database initialized successfully with default records' });
  } catch (error: any) {
    console.error('Failed to seed database:', error);
    res.status(500).json({ error: 'Failed to seed initial data' });
  }
});

// -------------------------------------------------------------
// 3. Materials & Inventory
// -------------------------------------------------------------
apiApp.get('/api/materials', async (req: Request, res: Response) => {
  try {
    const list = await db.select().from(materials).orderBy(materials.category, materials.name);

    // Compute live stock from the stock movements ledger for each material
    const movements = await db.select().from(stockMovements);
    const stockMap: Record<string, { currentStock: number; lastUnit: string }> = {};

    movements.forEach((m) => {
      if (!stockMap[m.materialId]) {
        stockMap[m.materialId] = { currentStock: 0, lastUnit: m.unit };
      }
      const qtyIn = parseFloat(m.quantityIn || '0');
      const qtyOut = parseFloat(m.quantityOut || '0');
      stockMap[m.materialId].currentStock += qtyIn - qtyOut;
    });

    const enriched = list.map((m) => {
      const live = stockMap[m.id];
      const currentStock = live ? Math.max(0, live.currentStock) : (m.trackingMode === 'kg' ? parseFloat(m.openingStockKg || '0') : parseFloat(m.openingStockPieces || '0'));
      const piecesPerKg = parseFloat(m.piecesPerKg || '0');

      // If dual tracking, compute counterpart quantity
      let stockPieces = currentStock;
      let stockKg = 0;
      if (m.trackingMode === 'dual_kg_units') {
        if (m.stockUnit === 'piece' && piecesPerKg > 0) {
          stockPieces = currentStock;
          stockKg = currentStock / piecesPerKg;
        } else if (m.stockUnit === 'kg' && piecesPerKg > 0) {
          stockKg = currentStock;
          stockPieces = currentStock * piecesPerKg;
        }
      } else if (m.trackingMode === 'kg') {
        stockKg = currentStock;
        stockPieces = 0;
      }

      return {
        ...m,
        currentStock,
        stockPieces: Math.round(stockPieces),
        stockKg: Number(stockKg.toFixed(2)),
        isLowStock: currentStock <= parseFloat(m.reorderThreshold || '0'),
      };
    });

    res.json(enriched);
  } catch (error: any) {
    console.error('Failed to fetch materials:', error);
    res.status(500).json({ error: 'Failed to retrieve materials' });
  }
});

apiApp.post('/api/materials', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      code,
      name,
      category,
      description,
      trackingMode,
      purchaseUnit,
      stockUnit,
      piecesPerKg,
      reorderThreshold,
      unitCostDzd,
      openingStockKg,
      openingStockPieces,
    } = req.body;

    if (!code || !name || !category) {
      return res.status(400).json({ error: 'Code, name, and category are required' });
    }

    const id = genId();
    const created = await db
      .insert(materials)
      .values({
        id,
        code,
        name,
        category,
        description: description || '',
        trackingMode: trackingMode || 'units',
        purchaseUnit: purchaseUnit || 'kg',
        stockUnit: stockUnit || 'piece',
        piecesPerKg: piecesPerKg ? String(piecesPerKg) : '0',
        reorderThreshold: reorderThreshold ? String(reorderThreshold) : '0',
        unitCostDzd: unitCostDzd ? String(unitCostDzd) : '0',
        openingStockKg: openingStockKg ? String(openingStockKg) : '0',
        openingStockPieces: openingStockPieces ? String(openingStockPieces) : '0',
        isActive: true,
      })
      .returning();

    // Create opening stock movement if initial stock provided
    const initPieces = parseFloat(openingStockPieces || '0');
    const initKg = parseFloat(openingStockKg || '0');
    const initQty = stockUnit === 'kg' ? initKg : initPieces;

    if (initQty > 0) {
      await db.insert(stockMovements).values({
        id: genId(),
        materialId: id,
        movementType: 'opening_balance',
        quantityIn: String(initQty),
        quantityOut: '0',
        unit: stockUnit || 'piece',
        referenceType: 'manual',
        referenceId: 'OPENING',
        unitCostDzd: unitCostDzd ? String(unitCostDzd) : '0',
        userId: req.user?.uid || '',
        userName: req.user?.name || 'Owner',
        notes: 'Initial opening stock balance',
      });
    }

    res.status(201).json(created[0]);
  } catch (error: any) {
    console.error('Failed to create material:', error);
    res.status(500).json({ error: error.message || 'Failed to create material' });
  }
});

apiApp.put('/api/materials/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      category,
      description,
      trackingMode,
      purchaseUnit,
      stockUnit,
      piecesPerKg,
      reorderThreshold,
      unitCostDzd,
      openingStockKg,
      openingStockPieces,
      isActive,
      modifierName,
      modifierRole,
    } = req.body;

    const current = await db.select().from(materials).where(eq(materials.id, req.params.id)).limit(1);
    if (!current.length) return res.status(404).json({ error: 'Matière introuvable' });

    const prev = current[0];
    const effectiveName = modifierName || req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Staff');

    // Save snapshot in 10-operation undo stack before applying updates
    await recordUndoOperation({
      actionType: 'update',
      entityType: 'material',
      entityId: req.params.id,
      description: `Modification matière ${prev.name} (${prev.code})`,
      snapshot: prev,
      req,
    });

    const updated = await db
      .update(materials)
      .set({
        code: req.body.code ? String(req.body.code).trim() : prev.code,
        name: name !== undefined ? name : prev.name,
        category: category !== undefined ? category : prev.category,
        description: description !== undefined ? description : prev.description,
        trackingMode: trackingMode !== undefined ? trackingMode : prev.trackingMode,
        purchaseUnit: purchaseUnit !== undefined ? purchaseUnit : prev.purchaseUnit,
        stockUnit: stockUnit !== undefined ? stockUnit : prev.stockUnit,
        piecesPerKg: piecesPerKg !== undefined ? String(piecesPerKg) : prev.piecesPerKg,
        reorderThreshold: reorderThreshold !== undefined ? String(reorderThreshold) : prev.reorderThreshold,
        unitCostDzd: unitCostDzd !== undefined ? String(unitCostDzd) : prev.unitCostDzd,
        openingStockKg: openingStockKg !== undefined ? String(openingStockKg) : prev.openingStockKg,
        openingStockPieces: openingStockPieces !== undefined ? String(openingStockPieces) : prev.openingStockPieces,
        isActive: isActive !== undefined ? isActive : prev.isActive,
      })
      .where(eq(materials.id, req.params.id))
      .returning();

    // If opening stock was updated directly in material edit modal, record an adjustment stock movement with the modifier's identity
    if (openingStockPieces !== undefined && String(openingStockPieces) !== String(prev.openingStockPieces)) {
      const oldQty = parseFloat(prev.openingStockPieces || '0');
      const newQty = parseFloat(String(openingStockPieces) || '0');
      const diff = newQty - oldQty;
      if (Math.abs(diff) > 0.001) {
        const isAddition = diff > 0;
        await db.insert(stockMovements).values({
          id: genId(),
          materialId: req.params.id,
          movementType: isAddition ? 'adjustment_in' : 'adjustment_out',
          quantityIn: isAddition ? String(Math.abs(diff)) : '0',
          quantityOut: isAddition ? '0' : String(Math.abs(diff)),
          unit: stockUnit || 'piece',
          referenceType: 'material_stock_edit',
          referenceId: prev.code,
          unitCostDzd: unitCostDzd ? String(unitCostDzd) : prev.unitCostDzd,
          userId: await resolveValidProfileId(req.user?.uid),
          userName: effectiveName,
          notes: `Modification directe du stock initial par ${effectiveName} (${isAddition ? '+' : '-'}${Math.abs(diff)} ${stockUnit || 'piece'})`,
        });
      }
    }

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'MATERIAL_UPDATED',
      entity: 'materials',
      data: updated[0],
    });

    res.json(updated[0]);
  } catch (error: any) {
    console.error('Failed to update material:', error);
    res.status(500).json({ error: 'Failed to update material' });
  }
});

// Delete a single material (with undo snapshot)
// Delete a single material (with undo snapshot and cascading dependencies)
apiApp.delete('/api/materials/:id', requireAuth, requireInventoryManagerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const current = await db.select().from(materials).where(eq(materials.id, req.params.id)).limit(1);
    if (!current.length) return res.status(404).json({ error: 'Matière introuvable' });

    const mat = current[0];
    const relatedMovements = await db.select().from(stockMovements).where(eq(stockMovements.materialId, req.params.id));
    const relatedPurchaseItems = await db.select().from(purchaseItems).where(eq(purchaseItems.materialId, req.params.id));
    const relatedProductionUsage = await db.select().from(productionUsage).where(eq(productionUsage.materialId, req.params.id));

    // Record complete snapshot in undo stack
    await recordUndoOperation({
      actionType: 'delete',
      entityType: 'material',
      entityId: req.params.id,
      description: `Suppression matière ${mat.name} (${mat.code})`,
      snapshot: {
        material: mat,
        movements: relatedMovements,
        purchaseItems: relatedPurchaseItems,
        productionUsage: relatedProductionUsage,
      },
      req,
    });

    // Delete cascading dependencies in order to avoid FK constraint errors
    if (relatedProductionUsage.length > 0) {
      await db.delete(productionUsage).where(eq(productionUsage.materialId, req.params.id));
    }
    if (relatedPurchaseItems.length > 0) {
      await db.delete(purchaseItems).where(eq(purchaseItems.materialId, req.params.id));
    }
    await db.delete(stockMovements).where(eq(stockMovements.materialId, req.params.id));
    await db.delete(materials).where(eq(materials.id, req.params.id));

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'MATERIAL_DELETED',
      entity: 'materials',
      data: { id: req.params.id, code: mat.code, name: mat.name },
    });

    res.json({ success: true, message: `Matière "${mat.name}" supprimée avec succès (Annulation possible)` });
  } catch (error: any) {
    console.error('Failed to delete material:', error);
    res.status(500).json({ error: error.message || 'Failed to delete material' });
  }
});

// Delete all materials in bulk (with undo snapshot)
apiApp.delete('/api/materials/all', requireAuth, requireInventoryManagerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const allMats = await db.select().from(materials);
    const allMovs = await db.select().from(stockMovements);
    const allPI = await db.select().from(purchaseItems);
    const allPU = await db.select().from(productionUsage);

    await recordUndoOperation({
      actionType: 'bulk_delete',
      entityType: 'materials',
      entityId: 'all',
      description: `Suppression de toutes les matières du catalogue (${allMats.length} article(s))`,
      snapshot: {
        materials: allMats,
        movements: allMovs,
        purchaseItems: allPI,
        productionUsage: allPU,
      },
      req,
    });

    await db.delete(productionUsage);
    await db.delete(purchaseItems);
    await db.delete(stockMovements);
    await db.delete(materials);

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'MATERIALS_BULK_DELETED',
      entity: 'materials',
      data: { count: allMats.length },
    });

    res.json({ success: true, count: allMats.length, message: `${allMats.length} matière(s) supprimée(s) avec succès (Annulation possible)` });
  } catch (error: any) {
    console.error('Failed to delete all materials:', error);
    res.status(500).json({ error: error.message || 'Failed to delete all materials' });
  }
});

// Stock Movements Ledger
apiApp.get('/api/stock-movements', async (req: Request, res: Response) => {
  try {
    const { materialId, movementType } = req.query;
    let query = db.select().from(stockMovements);

    const conditions = [];
    if (materialId) {
      conditions.push(eq(stockMovements.materialId, String(materialId)));
    }
    if (movementType) {
      conditions.push(eq(stockMovements.movementType, String(movementType)));
    }

    const list = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(stockMovements.timestamp))
      : await query.orderBy(desc(stockMovements.timestamp));

    // Attach material info
    const matList = await db.select().from(materials);
    const matMap = new Map(matList.map((m) => [m.id, m]));

    const enriched = list.map((m) => ({
      ...m,
      material: matMap.get(m.materialId) || null,
    }));

    res.json(enriched);
  } catch (error: any) {
    console.error('Failed to fetch stock movements:', error);
    res.status(500).json({ error: 'Failed to retrieve stock ledger' });
  }
});

apiApp.post('/api/stock-movements/adjust', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { materialId, adjustmentType, quantity, unit, unitCostDzd, notes, modifierName } = req.body;
    if (!materialId || !quantity || !adjustmentType) {
      return res.status(400).json({ error: 'Missing required adjustment parameters' });
    }

    const qty = Math.abs(parseFloat(quantity));
    const isIncrease = adjustmentType === 'adjustment_in';
    const effectiveName = modifierName || req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Workshop Operator');

    const movement = await db
      .insert(stockMovements)
      .values({
        id: genId(),
        materialId,
        movementType: isIncrease ? 'adjustment_in' : 'adjustment_out',
        quantityIn: isIncrease ? String(qty) : '0',
        quantityOut: isIncrease ? '0' : String(qty),
        unit: unit || 'piece',
        referenceType: 'adjustment',
        referenceId: `ADJ-${Date.now().toString().slice(-6)}`,
        unitCostDzd: unitCostDzd ? String(unitCostDzd) : '0',
        userId: await resolveValidProfileId(req.user?.uid),
        userName: effectiveName,
      })
      .returning();

    // Recalculate weighted average price per Kg on manual stock addition if cost is provided
    if (isIncrease && unitCostDzd && parseFloat(unitCostDzd) > 0) {
      await recalculateWeightedAverageUnitCost(
        materialId,
        qty,
        unit || 'piece',
        parseFloat(unitCostDzd)
      );
    }

    // Record in undo stack so stock adjustment can be reverted
    await recordUndoOperation({
      actionType: 'delete',
      entityType: 'stock_movement',
      entityId: movement[0].id,
      description: `Ajustement de stock manuel (${isIncrease ? '+' : '-'}${qty} ${unit || 'piece'})`,
      snapshot: movement[0],
      req,
    });

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'STOCK_ADJUSTED',
      entity: 'stock_movements',
      data: movement[0],
    });

    res.status(201).json(movement[0]);
  } catch (error: any) {
    console.error('Failed to adjust stock:', error);
    res.status(500).json({ error: 'Failed to record stock adjustment' });
  }
});

// -------------------------------------------------------------
// 4. Suppliers & Purchases
// -------------------------------------------------------------
apiApp.get('/api/suppliers', async (req: Request, res: Response) => {
  try {
    const list = await db.select().from(suppliers).orderBy(suppliers.name);
    const purchaseList = await db.select().from(purchases);
    const paymentList = await db.select().from(payments).where(eq(payments.paymentType, 'supplier_payment'));

    const enriched = list.map((s) => {
      const sPurchases = purchaseList.filter((p) => p.supplierId === s.id);
      const sPayments = paymentList.filter((p) => p.supplierId === s.id);

      const totalPurchases = sPurchases.reduce((acc, p) => acc + parseFloat(p.totalAmountDzd || '0'), 0);
      const totalPayments = sPayments.reduce((acc, p) => acc + parseFloat(p.amountDzd || '0'), 0);
      const opening = parseFloat(s.openingBalanceDzd || '0');
      const outstandingBalance = opening + totalPurchases - totalPayments;

      return {
        ...s,
        totalPurchases,
        totalPayments,
        outstandingBalance: Number(outstandingBalance.toFixed(2)),
        purchaseCount: sPurchases.length,
      };
    });

    res.json(enriched);
  } catch (error: any) {
    console.error('Failed to fetch suppliers:', error);
    res.status(500).json({ error: 'Failed to retrieve suppliers' });
  }
});

apiApp.post('/api/suppliers', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { code, name, contactPerson, phone, address, openingBalanceDzd, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    const autoCode = code || `SUPP-${Date.now().toString().slice(-4)}`;
    const created = await db
      .insert(suppliers)
      .values({
        id: genId(),
        code: autoCode,
        name,
        contactPerson: contactPerson || '',
        phone: phone || '',
        address: address || '',
        openingBalanceDzd: openingBalanceDzd ? String(openingBalanceDzd) : '0',
        notes: notes || '',
        isActive: true,
      })
      .returning();

    res.status(201).json(created[0]);
  } catch (error: any) {
    console.error('Failed to create supplier:', error);
    res.status(500).json({ error: error.message || 'Failed to create supplier' });
  }
});

apiApp.put('/api/suppliers/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, contactPerson, phone, address, notes, isActive, openingBalanceDzd } = req.body;
    const current = await db.select().from(suppliers).where(eq(suppliers.id, req.params.id)).limit(1);
    if (!current.length) return res.status(404).json({ error: 'Fournisseur introuvable' });

    const prev = current[0];

    // Record snapshot in 10-operation undo stack before applying updates
    await recordUndoOperation({
      actionType: 'update',
      entityType: 'supplier',
      entityId: req.params.id,
      description: `Modification fournisseur ${prev.name} (${prev.code})`,
      snapshot: prev,
      req,
    });

    const updatePayload: any = {
      name: name ?? prev.name,
      contactPerson: contactPerson ?? prev.contactPerson,
      phone: phone ?? prev.phone,
      address: address ?? prev.address,
      notes: notes ?? prev.notes,
      isActive: isActive !== undefined ? isActive : prev.isActive,
    };

    if (openingBalanceDzd !== undefined) {
      updatePayload.openingBalanceDzd = String(openingBalanceDzd);
    }

    const updated = await db
      .update(suppliers)
      .set(updatePayload)
      .where(eq(suppliers.id, req.params.id))
      .returning();

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'SUPPLIER_UPDATED',
      entity: 'suppliers',
      data: updated[0],
    });

    res.json(updated[0]);
  } catch (error: any) {
    console.error('Failed to update supplier:', error);
    res.status(500).json({ error: error.message || 'Failed to update supplier' });
  }
});

apiApp.delete('/api/suppliers/:id', requireAuth, requireOwnerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const current = await db.select().from(suppliers).where(eq(suppliers.id, req.params.id)).limit(1);
    if (!current.length) return res.status(404).json({ error: 'Fournisseur introuvable' });

    const supp = current[0];
    const relatedPurchases = await db.select({ id: purchases.id }).from(purchases).where(eq(purchases.supplierId, req.params.id));
    const relatedPayments = await db.select({ id: payments.id }).from(payments).where(eq(payments.supplierId, req.params.id));

    // Record in undo stack
    await recordUndoOperation({
      actionType: 'delete',
      entityType: 'supplier',
      entityId: req.params.id,
      description: `Suppression fournisseur ${supp.name} (${supp.code})`,
      snapshot: {
        supplier: supp,
        detachedPurchaseIds: relatedPurchases.map(p => p.id),
        detachedPaymentIds: relatedPayments.map(p => p.id),
      },
      req,
    });

    // Detach references to prevent foreign key constraint violations
    if (relatedPayments.length > 0) {
      await db.update(payments).set({ supplierId: null }).where(eq(payments.supplierId, req.params.id));
    }
    if (relatedPurchases.length > 0) {
      await db.update(purchases).set({ supplierId: null }).where(eq(purchases.supplierId, req.params.id));
    }

    await db.delete(suppliers).where(eq(suppliers.id, req.params.id));

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'SUPPLIER_DELETED',
      entity: 'suppliers',
      data: { id: req.params.id, name: supp.name, code: supp.code },
    });

    res.json({ success: true, message: `Fournisseur "${supp.name}" supprimé avec succès (Annulation possible)` });
  } catch (error: any) {
    console.error('Failed to delete supplier:', error);
    res.status(500).json({ error: error.message || 'Failed to delete supplier' });
  }
});

// Delete all suppliers in bulk (with undo snapshot)
apiApp.delete('/api/suppliers/all', requireAuth, requireOwnerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const allSupps = await db.select().from(suppliers);
    const allPurchases = await db.select({ id: purchases.id, supplierId: purchases.supplierId }).from(purchases).where(sql`supplier_id IS NOT NULL`);
    const allPayments = await db.select({ id: payments.id, supplierId: payments.supplierId }).from(payments).where(sql`supplier_id IS NOT NULL`);

    await recordUndoOperation({
      actionType: 'bulk_delete',
      entityType: 'suppliers',
      entityId: 'all',
      description: `Suppression de tous les fournisseurs (${allSupps.length} fournisseur(s))`,
      snapshot: {
        suppliers: allSupps,
        detachedPurchases: allPurchases.map(p => ({ purchaseId: p.id, supplierId: p.supplierId })),
        detachedPayments: allPayments.map(p => ({ paymentId: p.id, supplierId: p.supplierId })),
      },
      req,
    });

    // Detach all foreign key references so deletion succeeds cleanly without FK errors
    await db.update(payments).set({ supplierId: null }).where(sql`supplier_id IS NOT NULL`);
    await db.update(purchases).set({ supplierId: null }).where(sql`supplier_id IS NOT NULL`);

    await db.delete(suppliers);

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'SUPPLIERS_BULK_DELETED',
      entity: 'suppliers',
      data: { count: allSupps.length },
    });

    res.json({ success: true, count: allSupps.length, message: `${allSupps.length} fournisseur(s) supprimé(s) avec succès (Annulation possible)` });
  } catch (error: any) {
    console.error('Failed to delete all suppliers:', error);
    res.status(500).json({ error: error.message || 'Failed to delete all suppliers' });
  }
});

apiApp.get('/api/suppliers/:id/statement', async (req: Request, res: Response) => {
  try {
    const supplier = await db.select().from(suppliers).where(eq(suppliers.id, req.params.id)).limit(1);
    if (!supplier.length) return res.status(404).json({ error: 'Supplier not found' });

    const suppPurchases = await db.select().from(purchases).where(eq(purchases.supplierId, req.params.id));
    const suppPayments = await db
      .select()
      .from(payments)
      .where(and(eq(payments.supplierId, req.params.id), eq(payments.paymentType, 'supplier_payment')));

    // Build timeline
    const timeline: any[] = [];
    let runningBalance = parseFloat(supplier[0].openingBalanceDzd || '0');

    timeline.push({
      date: supplier[0].createdAt?.toISOString().split('T')[0] || todayStr(),
      type: 'opening_balance',
      reference: 'Opening Balance',
      debit: runningBalance,
      credit: 0,
      balance: runningBalance,
      notes: 'Initial account balance',
    });

    const entries = [
      ...suppPurchases.map((p) => ({
        date: p.purchaseDate,
        type: 'purchase_invoice',
        reference: p.purchaseNumber,
        amount: parseFloat(p.totalAmountDzd || '0'),
        notes: p.notes || `Invoice ${p.invoiceNumber || ''}`,
        raw: p,
      })),
      ...suppPayments.map((pay) => ({
        date: pay.paymentDate,
        type: 'payment',
        reference: pay.paymentNumber,
        amount: -parseFloat(pay.amountDzd || '0'),
        notes: pay.notes || `Method: ${pay.paymentMethod}`,
        raw: pay,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    entries.forEach((e) => {
      if (e.type === 'purchase_invoice') {
        runningBalance += e.amount;
        timeline.push({
          date: e.date,
          type: e.type,
          reference: e.reference,
          debit: e.amount,
          credit: 0,
          balance: Number(runningBalance.toFixed(2)),
          notes: e.notes,
        });
      } else {
        const credit = Math.abs(e.amount);
        runningBalance -= credit;
        timeline.push({
          date: e.date,
          type: e.type,
          reference: e.reference,
          debit: 0,
          credit,
          balance: Number(runningBalance.toFixed(2)),
          notes: e.notes,
        });
      }
    });

    res.json({
      supplier: supplier[0],
      currentBalance: Number(runningBalance.toFixed(2)),
      timeline,
    });
  } catch (error: any) {
    console.error('Failed to get supplier statement:', error);
    res.status(500).json({ error: 'Failed to generate supplier statement' });
  }
});

// Purchases
apiApp.get('/api/purchases', async (req: Request, res: Response) => {
  try {
    const list = await db.select().from(purchases).orderBy(desc(purchases.createdAt));
    const items = await db.select().from(purchaseItems);
    const suppList = await db.select().from(suppliers);
    const matList = await db.select().from(materials);
    const logsList = await db.select().from(purchaseLogs).orderBy(desc(purchaseLogs.timestamp));

    const suppMap = new Map(suppList.map((s) => [s.id, s]));
    const matMap = new Map(matList.map((m) => [m.id, m]));
    const logsMap = new Map<string, any[]>();
    for (const log of logsList) {
      if (!logsMap.has(log.purchaseId)) logsMap.set(log.purchaseId, []);
      logsMap.get(log.purchaseId)!.push(log);
    }

    const enriched = list.map((p) => {
      const pItems = items
        .filter((it) => it.purchaseId === p.id)
        .map((it) => ({
          ...it,
          material: matMap.get(it.materialId) || null,
        }));
      return {
        ...p,
        supplier: suppMap.get(p.supplierId || '') || null,
        items: pItems,
        logs: logsMap.get(p.id) || [],
      };
    });

    res.json(enriched);
  } catch (error: any) {
    console.error('Failed to fetch purchases:', error);
    res.status(500).json({ error: 'Failed to retrieve purchases' });
  }
});

apiApp.get('/api/purchases/:id/logs', async (req: Request, res: Response) => {
  try {
    const logs = await db
      .select()
      .from(purchaseLogs)
      .where(eq(purchaseLogs.purchaseId, req.params.id))
      .orderBy(desc(purchaseLogs.timestamp));
    res.json(logs);
  } catch (error: any) {
    console.error('Failed to fetch purchase logs:', error);
    res.status(500).json({ error: 'Failed to retrieve purchase audit logs' });
  }
});

apiApp.post('/api/purchases', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { supplierId, invoiceNumber, purchaseDate, freightCostDzd, items, notes, creatorName, creatorRole } = req.body;
    if (!supplierId || !items || !items.length) {
      return res.status(400).json({ error: 'Supplier and at least one item are required' });
    }

    const pId = genId();
    const purchaseCount = (await db.select({ count: sql<number>`count(*)` }).from(purchases))[0]?.count || 0;
    const purchaseNumber = `PO-${new Date().getFullYear()}-${String(Number(purchaseCount) + 1).padStart(4, '0')}`;

    let subtotal = 0;
    const itemsToInsert = items.map((it: any) => {
      const qty = parseFloat(it.quantity || '0');
      const unitCost = parseFloat(it.unitCostDzd || '0');
      const totalCost = qty * unitCost;
      subtotal += totalCost;

      return {
        id: genId(),
        purchaseId: pId,
        materialId: it.materialId,
        quantity: String(qty),
        purchaseUnit: it.purchaseUnit || 'kg',
        receivedKg: it.receivedKg ? String(it.receivedKg) : String(qty),
        receivedPieces: it.receivedPieces ? String(it.receivedPieces) : '0',
        unitCostDzd: String(unitCost),
        totalCostDzd: String(totalCost),
      };
    });

    const freight = parseFloat(freightCostDzd || '0');
    const totalAmount = subtotal + freight;

    const effectiveCreatorName = creatorName || req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Staff');
    const effectiveCreatorRole = creatorRole || req.userRole || 'owner';

    const newPurchase = await db
      .insert(purchases)
      .values({
        id: pId,
        purchaseNumber,
        supplierId,
        invoiceNumber: invoiceNumber || '',
        purchaseDate: purchaseDate || todayStr(),
        subtotalDzd: String(subtotal),
        freightCostDzd: String(freight),
        totalAmountDzd: String(totalAmount),
        amountPaidDzd: '0',
        paymentStatus: 'unpaid',
        receiptStatus: 'pending',
        notes: notes || '',
        createdBy: req.user?.uid || '',
        createdByName: effectiveCreatorName,
        createdByRole: effectiveCreatorRole,
      })
      .returning();

    for (const item of itemsToInsert) {
      await db.insert(purchaseItems).values(item);
    }

    // Record creation in purchase audit logs
    const supp = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
    const suppName = supp.length > 0 ? supp[0].name : supplierId;

    await db.insert(purchaseLogs).values({
      id: genId(),
      purchaseId: pId,
      userId: req.user?.uid || '',
      userName: effectiveCreatorName,
      userRole: effectiveCreatorRole,
      action: 'Création',
      modification: `Bon de commande fournisseur créé (${purchaseNumber}) avec ${itemsToInsert.length} article(s) pour ${totalAmount.toLocaleString()} DZD. Fournisseur: ${suppName}. Réf Facture: ${invoiceNumber || 'Non renseigné'}.`,
    });

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'PURCHASE_CREATED',
      entity: 'purchases',
      data: newPurchase[0],
    });

    res.status(201).json(newPurchase[0]);
  } catch (error: any) {
    console.error('Failed to create purchase:', error);
    res.status(500).json({ error: error.message || 'Failed to create purchase' });
  }
});

// Update Purchase Invoice & Record Audit Log
apiApp.put('/api/purchases/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      supplierId,
      invoiceNumber,
      purchaseDate,
      freightCostDzd,
      notes,
      items,
      paymentStatus,
      amountPaidDzd,
      modifierName,
      modifierRole,
      modificationDetails,
    } = req.body;

    const current = await db.select().from(purchases).where(eq(purchases.id, req.params.id)).limit(1);
    if (!current.length) {
      return res.status(404).json({ error: 'Bon de commande fournisseur introuvable' });
    }

    const prev = current[0];
    const oldItems = await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, req.params.id));

    // Record snapshot in 10-operation undo stack before applying updates
    await recordUndoOperation({
      actionType: 'update',
      entityType: 'purchase',
      entityId: req.params.id,
      description: `Modification facture/bon d'achat ${prev.purchaseNumber}`,
      snapshot: {
        purchase: prev,
        items: oldItems,
      },
      req,
    });

    const changes: string[] = [];
    const updates: any = {
      updatedAt: new Date(),
    };

    // Track Supplier changes
    if (supplierId !== undefined && supplierId !== prev.supplierId) {
      const prevSupp = await db.select().from(suppliers).where(eq(suppliers.id, prev.supplierId || '')).limit(1);
      const newSupp = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
      const prevName = prevSupp.length ? prevSupp[0].name : 'Ancien';
      const newName = newSupp.length ? newSupp[0].name : 'Nouveau';
      updates.supplierId = supplierId;
      changes.push(`Fournisseur changé : "${prevName}" → "${newName}"`);
    }

    // Track Invoice Number changes
    if (invoiceNumber !== undefined && invoiceNumber !== prev.invoiceNumber) {
      updates.invoiceNumber = invoiceNumber;
      changes.push(`N° Facture changé : "${prev.invoiceNumber || 'N/A'}" → "${invoiceNumber || 'N/A'}"`);
    }

    // Track Purchase Date changes
    if (purchaseDate !== undefined && purchaseDate !== prev.purchaseDate) {
      updates.purchaseDate = purchaseDate;
      changes.push(`Date d'achat modifiée : "${prev.purchaseDate}" → "${purchaseDate}"`);
    }

    // Track Notes changes
    if (notes !== undefined && notes !== prev.notes) {
      updates.notes = notes;
      changes.push(`Notes/remarques mises à jour`);
    }

    // Track Payment Status / Amount Paid
    if (paymentStatus !== undefined && paymentStatus !== prev.paymentStatus) {
      updates.paymentStatus = paymentStatus;
      changes.push(`Statut de paiement modifié : "${prev.paymentStatus}" → "${paymentStatus}"`);
    }
    if (amountPaidDzd !== undefined && String(amountPaidDzd) !== String(prev.amountPaidDzd)) {
      updates.amountPaidDzd = String(amountPaidDzd);
      changes.push(`Montant payé modifié : ${prev.amountPaidDzd} DZD → ${amountPaidDzd} DZD`);
    }

    // Track Items & Recalculate Totals
    let newSubtotal = parseFloat(prev.subtotalDzd || '0');
    let newFreight = freightCostDzd !== undefined ? parseFloat(freightCostDzd || '0') : parseFloat(prev.freightCostDzd || '0');

    if (freightCostDzd !== undefined && String(freightCostDzd) !== String(prev.freightCostDzd)) {
      updates.freightCostDzd = String(newFreight);
      changes.push(`Frais de transport modifiés : ${prev.freightCostDzd} DZD → ${newFreight} DZD`);
    }

    if (items && Array.isArray(items)) {
      newSubtotal = 0;
      const oldItems = await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, req.params.id));
      const matList = await db.select().from(materials);
      const matMap = new Map(matList.map((m) => [m.id, m]));

      const newItemsToInsert = items.map((it: any) => {
        const qty = parseFloat(it.quantity || '0');
        const unitCost = parseFloat(it.unitCostDzd || '0');
        const totalCost = qty * unitCost;
        newSubtotal += totalCost;

        return {
          id: it.id || genId(),
          purchaseId: req.params.id,
          materialId: it.materialId,
          quantity: String(qty),
          purchaseUnit: it.purchaseUnit || 'kg',
          receivedKg: it.receivedKg ? String(it.receivedKg) : String(qty),
          receivedPieces: it.receivedPieces ? String(it.receivedPieces) : '0',
          unitCostDzd: String(unitCost),
          totalCostDzd: String(totalCost),
        };
      });

      // If already received in warehouse stock, handle stock delta adjustment!
      if (prev.receiptStatus === 'received') {
        const validUserId = await resolveValidProfileId(req.user?.uid);
        const effectiveName = modifierName || req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Staff');

        // Map old quantities per material
        const oldQtyMap = new Map<string, number>();
        for (const oi of oldItems) {
          oldQtyMap.set(oi.materialId, (oldQtyMap.get(oi.materialId) || 0) + parseFloat(oi.quantity || '0'));
        }

        // Map new quantities per material
        const newQtyMap = new Map<string, number>();
        for (const ni of newItemsToInsert) {
          newQtyMap.set(ni.materialId, (newQtyMap.get(ni.materialId) || 0) + parseFloat(ni.quantity || '0'));
        }

        const allMatIds = new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]);
        for (const mId of allMatIds) {
          const oldQ = oldQtyMap.get(mId) || 0;
          const newQ = newQtyMap.get(mId) || 0;
          const diff = newQ - oldQ;
          const mat = matMap.get(mId);

          if (Math.abs(diff) > 0.001 && mat) {
            const isIncrease = diff > 0;
            const absDiff = Math.abs(diff);

            await db.insert(stockMovements).values({
              id: genId(),
              materialId: mId,
              movementType: isIncrease ? 'adjustment_in' : 'adjustment_out',
              quantityIn: isIncrease ? String(absDiff) : '0',
              quantityOut: isIncrease ? '0' : String(absDiff),
              unit: mat.stockUnit || 'piece',
              referenceType: 'purchase_modification',
              referenceId: prev.purchaseNumber,
              unitCostDzd: mat.unitCostDzd || '0',
              userId: validUserId,
              userName: effectiveName,
              notes: `Ajustement suite modification bon d'achat ${prev.purchaseNumber}: ${isIncrease ? '+' : '-'}${absDiff} ${mat.stockUnit} (${effectiveName})`,
            });
            changes.push(`Ajustement stock de ${mat.name} : ${isIncrease ? '+' : ''}${diff} ${mat.stockUnit}`);
          }
        }
      }

      // Replace items
      await db.delete(purchaseItems).where(eq(purchaseItems.purchaseId, req.params.id));
      for (const item of newItemsToInsert) {
        await db.insert(purchaseItems).values(item);
      }

      // If purchase invoice was already received in inventory stock, recalculate weighted average price per Kg (including freight transport cost allocation)!
      if (prev.receiptStatus === 'received') {
        for (const item of newItemsToInsert) {
          const recKg = parseFloat(item.receivedKg || (item.purchaseUnit === 'kg' ? item.quantity : '0'));
          const incomingPricePerKg = parseFloat(item.unitCostDzd || '0');
          const itemBaseTotal = parseFloat(item.totalCostDzd || '0') || (parseFloat(item.quantity) * incomingPricePerKg);
          let itemFreightShare = 0;
          if (newFreight > 0 && newSubtotal > 0) {
            itemFreightShare = (itemBaseTotal / newSubtotal) * newFreight;
          }
          const itemLandedTotalCost = itemBaseTotal + itemFreightShare;

          await recalculateWeightedAverageUnitCost(
            item.materialId,
            parseFloat(item.quantity || '0'),
            item.purchaseUnit || 'kg',
            incomingPricePerKg,
            recKg,
            itemLandedTotalCost
          );
        }
      }

      updates.subtotalDzd = String(newSubtotal);
      changes.push(`Articles modifiés (${newItemsToInsert.length} ligne(s))`);
    }

    const newTotalAmount = newSubtotal + newFreight;
    if (newTotalAmount !== parseFloat(prev.totalAmountDzd || '0')) {
      updates.totalAmountDzd = String(newTotalAmount);
      changes.push(`Montant total ajusté : ${prev.totalAmountDzd} DZD → ${newTotalAmount} DZD`);
    }

    const updated = await db
      .update(purchases)
      .set(updates)
      .where(eq(purchases.id, req.params.id))
      .returning();

    // Log the modification in purchaseLogs
    const effectiveName = modifierName || req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Staff');
    const effectiveRole = modifierRole || req.userRole || 'owner';

    const logDetails = modificationDetails
      ? `${modificationDetails} — Détails: ${changes.join(', ') || 'Mise à jour générale'}`
      : changes.length > 0
      ? changes.join('; ')
      : 'Informations du bon d\'achat mises à jour';

    await db.insert(purchaseLogs).values({
      id: genId(),
      purchaseId: req.params.id,
      userId: req.user?.uid || '',
      userName: effectiveName,
      userRole: effectiveRole,
      action: 'Modification',
      modification: logDetails,
    });

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'PURCHASE_UPDATED',
      entity: 'purchases',
      data: updated[0],
    });

    res.json(updated[0]);
  } catch (error: any) {
    console.error('Failed to update purchase invoice:', error);
    res.status(500).json({ error: error.message || 'Failed to update purchase invoice' });
  }
});

// Delete Purchase Invoice & Revert Stock If Received (with Undo)
apiApp.delete('/api/purchases/:id', requireAuth, requireOwnerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const current = await db.select().from(purchases).where(eq(purchases.id, req.params.id)).limit(1);
    if (!current.length) {
      return res.status(404).json({ error: 'Bon de commande fournisseur introuvable' });
    }

    const purchase = current[0];
    const items = await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, req.params.id));
    const logs = await db.select().from(purchaseLogs).where(eq(purchaseLogs.purchaseId, req.params.id));
    const allocations = await db.select().from(paymentAllocations).where(eq(paymentAllocations.purchaseId, req.params.id));

    // Record in 10-operation undo stack before deletion
    await recordUndoOperation({
      actionType: 'delete',
      entityType: 'purchase',
      entityId: req.params.id,
      description: `Suppression bon d'achat ${purchase.purchaseNumber}`,
      snapshot: {
        purchase,
        items,
        logs,
        allocations,
      },
      req,
    });

    const effectiveName = req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Admin');
    const validUserId = await resolveValidProfileId(req.user?.uid);

    // If stock was already received in inventory, revert the stock intake!
    if (purchase.receiptStatus === 'received') {
      const matList = await db.select().from(materials);
      const matMap = new Map(matList.map((m) => [m.id, m]));

      for (const it of items) {
        const mat = matMap.get(it.materialId);
        const qty = parseFloat(it.quantity || '0');
        if (mat && qty > 0) {
          await db.insert(stockMovements).values({
            id: genId(),
            materialId: it.materialId,
            movementType: 'supplier_return',
            quantityIn: '0',
            quantityOut: String(qty),
            unit: mat.stockUnit || it.purchaseUnit || 'piece',
            referenceType: 'purchase_deletion',
            referenceId: purchase.purchaseNumber,
            unitCostDzd: it.unitCostDzd || '0',
            userId: validUserId,
            userName: effectiveName,
            notes: `Annulation entrée stock suite suppression du bon d'achat ${purchase.purchaseNumber} par ${effectiveName}`,
          });
        }
      }
    }

    // Crucial: Delete payment allocations referencing this purchase to prevent Foreign Key constraint violation
    await db.delete(paymentAllocations).where(eq(paymentAllocations.purchaseId, req.params.id));

    // Delete purchase items & logs & purchase
    await db.delete(purchaseItems).where(eq(purchaseItems.purchaseId, req.params.id));
    await db.delete(purchaseLogs).where(eq(purchaseLogs.purchaseId, req.params.id));
    await db.delete(purchases).where(eq(purchases.id, req.params.id));

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'PURCHASE_DELETED',
      entity: 'purchases',
      data: { id: req.params.id, purchaseNumber: purchase.purchaseNumber },
    });

    res.json({ success: true, message: `Bon d'achat ${purchase.purchaseNumber} supprimé avec succès (Annulation possible)` });
  } catch (error: any) {
    console.error('Failed to delete purchase invoice:', error);
    res.status(500).json({ error: error.message || 'Failed to delete purchase invoice' });
  }
});

// Delete all purchases / invoices in bulk (with undo snapshot)
apiApp.delete('/api/purchases/all', requireAuth, requireOwnerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const allPurchases = await db.select().from(purchases);
    const allItems = await db.select().from(purchaseItems);
    const allLogs = await db.select().from(purchaseLogs);
    const allAllocations = await db.select().from(paymentAllocations).where(sql`purchase_id IS NOT NULL`);

    // Group items and logs per purchase for clean undo
    const purchasesWithDetails = allPurchases.map((p) => ({
      purchase: p,
      items: allItems.filter((it) => it.purchaseId === p.id),
      logs: allLogs.filter((l) => l.purchaseId === p.id),
    }));

    await recordUndoOperation({
      actionType: 'bulk_delete',
      entityType: 'purchases',
      entityId: 'all',
      description: `Suppression de toutes les factures et bons d'achat (${allPurchases.length} bon(s))`,
      snapshot: {
        purchases: purchasesWithDetails,
        allocations: allAllocations,
      },
      req,
    });

    const effectiveName = req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Admin');
    const validUserId = await resolveValidProfileId(req.user?.uid);
    const matList = await db.select().from(materials);
    const matMap = new Map(matList.map((m) => [m.id, m]));

    // Revert received stock for all received purchases
    for (const p of allPurchases) {
      if (p.receiptStatus === 'received') {
        const pItems = allItems.filter((it) => it.purchaseId === p.id);
        for (const it of pItems) {
          const mat = matMap.get(it.materialId);
          const qty = parseFloat(it.quantity || '0');
          if (mat && qty > 0) {
            await db.insert(stockMovements).values({
              id: genId(),
              materialId: it.materialId,
              movementType: 'supplier_return',
              quantityIn: '0',
              quantityOut: String(qty),
              unit: mat.stockUnit || it.purchaseUnit || 'piece',
              referenceType: 'purchase_deletion',
              referenceId: p.purchaseNumber,
              unitCostDzd: it.unitCostDzd || '0',
              userId: validUserId,
              userName: effectiveName,
              notes: `Annulation entrée stock suite suppression en masse des factures (${p.purchaseNumber}) par ${effectiveName}`,
            });
          }
        }
      }
    }

    // Delete payment allocations referencing purchases to prevent FK constraint violations
    await db.delete(paymentAllocations).where(sql`purchase_id IS NOT NULL`);

    // Delete purchase items, logs, and purchases
    await db.delete(purchaseItems);
    await db.delete(purchaseLogs);
    await db.delete(purchases);

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'PURCHASES_BULK_DELETED',
      entity: 'purchases',
      data: { count: allPurchases.length },
    });

    res.json({
      success: true,
      count: allPurchases.length,
      message: `${allPurchases.length} facture(s) et bon(s) d'achat supprimé(s) avec succès (Annulation possible)`,
    });
  } catch (error: any) {
    console.error('Failed to delete all purchases:', error);
    res.status(500).json({ error: error.message || 'Failed to delete all purchases' });
  }
});

// Mark Purchase as Received -> Exactly Once Stock Receipt
apiApp.post('/api/purchases/:id/receive', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const purchase = await db.select().from(purchases).where(eq(purchases.id, req.params.id)).limit(1);
    if (!purchase.length) return res.status(404).json({ error: 'Purchase not found' });

    if (purchase[0].receiptStatus === 'received') {
      return res.status(400).json({ error: 'This purchase has already been received. Duplicate receipt prevented.' });
    }

    const items = await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, req.params.id));
    const matList = await db.select().from(materials);
    const matMap = new Map(matList.map((m) => [m.id, m]));

    const validUserId = await resolveValidProfileId(req.user?.uid);
    const validUserName = req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Staff');

    const freightCost = parseFloat(purchase[0].freightCostDzd || '0');
    const subtotalCost = parseFloat(purchase[0].subtotalDzd || '0');

    for (const item of items) {
      const mat = matMap.get(item.materialId);
      if (!mat) continue;

      let qtyIn = parseFloat(item.quantity);
      let stockUnit = mat.stockUnit;

      // Handle dual tracking: kg vs pieces conversion
      if (mat.trackingMode === 'dual_kg_units') {
        const receivedPieces = parseFloat(item.receivedPieces || '0');
        const receivedKg = parseFloat(item.receivedKg || '0');
        const conversion = parseFloat(mat.piecesPerKg || '0');

        if (stockUnit === 'piece') {
          if (receivedPieces > 0) {
            qtyIn = receivedPieces;
          } else if (conversion > 0) {
            qtyIn = (receivedKg > 0 ? receivedKg : qtyIn) * conversion;
          }
        } else {
          qtyIn = receivedKg > 0 ? receivedKg : qtyIn;
        }
      }

      // Calculate item total cost including allocated freight transport cost
      const itemBaseTotal = parseFloat(item.totalCostDzd || '0') || (parseFloat(item.quantity) * parseFloat(item.unitCostDzd || '0'));
      let itemFreightShare = 0;
      if (freightCost > 0 && subtotalCost > 0) {
        itemFreightShare = (itemBaseTotal / subtotalCost) * freightCost;
      }
      const itemLandedTotalCost = itemBaseTotal + itemFreightShare;

      // Record exact stock movement
      await db.insert(stockMovements).values({
        id: genId(),
        materialId: item.materialId,
        movementType: 'purchase_receipt',
        quantityIn: String(qtyIn),
        quantityOut: '0',
        unit: stockUnit,
        referenceType: 'purchase',
        referenceId: purchase[0].purchaseNumber,
        unitCostDzd: item.unitCostDzd,
        userId: validUserId,
        userName: validUserName,
        notes: `Purchase Receipt for ${purchase[0].purchaseNumber} (${item.quantity} ${item.purchaseUnit})${itemFreightShare > 0 ? ` + ${itemFreightShare.toFixed(2)} DZD transport` : ''}`,
      });

      // Update conversion factor if dual receipt pieces and kg provided
      const recPcs = parseFloat(item.receivedPieces || '0');
      const recKg = parseFloat(item.receivedKg || (item.purchaseUnit === 'kg' ? item.quantity : '0'));
      if (recPcs > 0 && recKg > 0) {
        await db
          .update(materials)
          .set({ piecesPerKg: (recPcs / recKg).toFixed(2) })
          .where(eq(materials.id, item.materialId));
      }

      // Recalculate weighted average price per Kg on new stock intake (using total landed cost including transport)
      const incomingPricePerKg = parseFloat(item.unitCostDzd || '0');
      await recalculateWeightedAverageUnitCost(
        item.materialId,
        parseFloat(item.quantity || '0'),
        item.purchaseUnit || 'kg',
        incomingPricePerKg,
        recKg,
        itemLandedTotalCost
      );
    }

    // Update purchase receipt status
    const updated = await db
      .update(purchases)
      .set({ receiptStatus: 'received' })
      .where(eq(purchases.id, req.params.id))
      .returning();

    // Log the stock receipt in purchaseLogs
    await db.insert(purchaseLogs).values({
      id: genId(),
      purchaseId: req.params.id,
      userId: req.user?.uid || '',
      userName: validUserName,
      userRole: req.userRole || 'staff',
      action: 'Réception Stock',
      modification: `Marchandises vérifiées et ajoutées au stock de l'atelier par ${validUserName}.`,
    });

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'PURCHASE_RECEIVED',
      entity: 'purchases',
      data: updated[0],
    });

    res.json(updated[0]);
  } catch (error: any) {
    console.error('Failed to receive purchase:', error);
    res.status(500).json({ error: 'Failed to process purchase receipt' });
  }
});

// Update Purchase Invoice Payment Status & Amount Paid
apiApp.patch('/api/purchases/:id/payment', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { paymentStatus, amountPaidDzd, notes, paymentMethod, modifierName } = req.body;
    const validStatuses = ['unpaid', 'partial', 'paid'];
    if (paymentStatus && !validStatuses.includes(paymentStatus)) {
      return res.status(400).json({ error: 'Invalid payment status. Must be unpaid, partial, or paid' });
    }

    const current = await db.select().from(purchases).where(eq(purchases.id, req.params.id)).limit(1);
    if (!current.length) {
      return res.status(404).json({ error: 'Purchase invoice not found' });
    }

    const total = parseFloat(current[0].totalAmountDzd || '0');
    let newPaid = amountPaidDzd !== undefined ? String(amountPaidDzd) : current[0].amountPaidDzd;
    let newStatus = paymentStatus || current[0].paymentStatus;

    if (paymentStatus === 'paid' && amountPaidDzd === undefined) {
      newPaid = String(total);
    } else if (paymentStatus === 'unpaid' && amountPaidDzd === undefined) {
      newPaid = '0';
    }

    const updated = await db
      .update(purchases)
      .set({
        paymentStatus: newStatus as 'unpaid' | 'partial' | 'paid',
        amountPaidDzd: newPaid,
        notes: notes !== undefined ? notes : current[0].notes,
      })
      .where(eq(purchases.id, req.params.id))
      .returning();

    // If marked paid or partial and paymentMethod provided, record a supplier payment entry in payments table if requested
    if (paymentMethod && parseFloat(newPaid) > 0) {
      await db.insert(payments).values({
        id: genId(),
        paymentNumber: `PAY-SUPP-${Date.now().toString().slice(-4)}`,
        paymentDate: todayStr(),
        paymentType: 'supplier_payment',
        supplierId: current[0].supplierId,
        partyName: 'Supplier Payment',
        amountDzd: newPaid,
        paymentMethod: paymentMethod || 'cash',
        referenceNumber: current[0].purchaseNumber,
        notes: `Payment for Purchase Invoice ${current[0].invoiceNumber || current[0].purchaseNumber}`,
        recordedBy: req.user?.uid || '',
      });
    }

    const effectiveName = modifierName || req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Staff');
    await db.insert(purchaseLogs).values({
      id: genId(),
      purchaseId: req.params.id,
      userId: req.user?.uid || '',
      userName: effectiveName,
      userRole: req.userRole || 'owner',
      action: 'Paiement',
      modification: `Paiement mis à jour : Statut "${newStatus}", Montant payé ${newPaid} DZD. Par: ${effectiveName}`,
    });

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'PURCHASE_UPDATED',
      entity: 'purchases',
      data: updated[0],
    });

    res.json(updated[0]);
  } catch (error: any) {
    console.error('Failed to update purchase invoice payment:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

// -------------------------------------------------------------
// 5. Customers & Orders
// -------------------------------------------------------------
apiApp.get('/api/customers', async (req: Request, res: Response) => {
  try {
    const list = await db.select().from(customers).orderBy(customers.name);
    const orderList = await db.select().from(orders);
    const paymentList = await db.select().from(payments).where(eq(payments.paymentType, 'customer_receipt'));

    const enriched = list.map((c) => {
      const cOrders = orderList.filter((o) => o.customerId === c.id);
      const cPayments = paymentList.filter((p) => p.customerId === c.id);

      const totalSales = cOrders.reduce((acc, o) => acc + parseFloat(o.totalAmountDzd || '0'), 0);
      const totalPayments = cPayments.reduce((acc, p) => acc + parseFloat(p.amountDzd || '0'), 0);
      const opening = parseFloat(c.openingBalanceDzd || '0');
      const outstandingBalance = opening + totalSales - totalPayments;

      const lastOrder = cOrders.sort((a, b) => b.orderDate.localeCompare(a.orderDate))[0];

      return {
        ...c,
        totalSales,
        totalPayments,
        outstandingBalance: Number(outstandingBalance.toFixed(2)),
        orderCount: cOrders.length,
        lastOrderDate: lastOrder ? lastOrder.orderDate : null,
      };
    });

    res.json(enriched);
  } catch (error: any) {
    console.error('Failed to fetch customers:', error);
    res.status(500).json({ error: 'Failed to retrieve customers' });
  }
});

apiApp.post('/api/customers', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      code,
      name,
      shopName,
      phone,
      address,
      category,
      contactChannel,
      messengerLink,
      tiktokHandle,
      instagramHandle,
      openingBalanceDzd,
      creditLimitDzd,
      notes,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const autoCode = code || `CUST-${Date.now().toString().slice(-4)}`;
    const created = await db
      .insert(customers)
      .values({
        id: genId(),
        code: autoCode,
        name,
        shopName: shopName || '',
        phone: phone || '',
        address: address || '',
        category: category || 'clothing',
        contactChannel: contactChannel || 'whatsapp',
        messengerLink: messengerLink || '',
        tiktokHandle: tiktokHandle || '',
        instagramHandle: instagramHandle || '',
        openingBalanceDzd: openingBalanceDzd ? String(openingBalanceDzd) : '0',
        creditLimitDzd: creditLimitDzd ? String(creditLimitDzd) : '0',
        notes: notes || '',
        isActive: true,
      })
      .returning();

    res.status(201).json(created[0]);
  } catch (error: any) {
    console.error('Failed to create customer:', error);
    res.status(500).json({ error: error.message || 'Failed to create customer' });
  }
});

apiApp.put('/api/customers/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      shopName,
      phone,
      address,
      category,
      contactChannel,
      messengerLink,
      tiktokHandle,
      instagramHandle,
      creditLimitDzd,
      notes,
      isActive,
    } = req.body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (shopName !== undefined) updates.shopName = shopName;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (category !== undefined) updates.category = category;
    if (contactChannel !== undefined) updates.contactChannel = contactChannel;
    if (messengerLink !== undefined) updates.messengerLink = messengerLink;
    if (tiktokHandle !== undefined) updates.tiktokHandle = tiktokHandle;
    if (instagramHandle !== undefined) updates.instagramHandle = instagramHandle;
    if (creditLimitDzd !== undefined) updates.creditLimitDzd = String(creditLimitDzd);
    if (notes !== undefined) updates.notes = notes;
    if (isActive !== undefined) updates.isActive = isActive;

    const updated = await db
      .update(customers)
      .set(updates)
      .where(eq(customers.id, req.params.id))
      .returning();
    res.json(updated[0]);
  } catch (error: any) {
    console.error('Failed to update customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

apiApp.get('/api/customers/:id/statement', async (req: Request, res: Response) => {
  try {
    const customer = await db.select().from(customers).where(eq(customers.id, req.params.id)).limit(1);
    if (!customer.length) return res.status(404).json({ error: 'Customer not found' });

    const custOrders = await db.select().from(orders).where(eq(orders.customerId, req.params.id));
    const custPayments = await db
      .select()
      .from(payments)
      .where(and(eq(payments.customerId, req.params.id), eq(payments.paymentType, 'customer_receipt')));

    const timeline: any[] = [];
    let runningBalance = parseFloat(customer[0].openingBalanceDzd || '0');

    timeline.push({
      date: customer[0].createdAt?.toISOString().split('T')[0] || todayStr(),
      type: 'opening_balance',
      reference: 'Opening Balance',
      debit: runningBalance,
      credit: 0,
      balance: runningBalance,
      notes: 'Initial account balance',
    });

    const entries = [
      ...custOrders.map((o) => ({
        date: o.orderDate,
        type: 'order_invoice',
        reference: o.orderNumber,
        amount: parseFloat(o.totalAmountDzd || '0'),
        notes: o.notes || `Order with status ${o.status}`,
        raw: o,
      })),
      ...custPayments.map((pay) => ({
        date: pay.paymentDate,
        type: 'payment',
        reference: pay.paymentNumber,
        amount: -parseFloat(pay.amountDzd || '0'),
        notes: pay.notes || `Method: ${pay.paymentMethod}`,
        raw: pay,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    entries.forEach((e) => {
      if (e.type === 'order_invoice') {
        runningBalance += e.amount;
        timeline.push({
          date: e.date,
          type: e.type,
          reference: e.reference,
          debit: e.amount,
          credit: 0,
          balance: Number(runningBalance.toFixed(2)),
          notes: e.notes,
        });
      } else {
        const credit = Math.abs(e.amount);
        runningBalance -= credit;
        timeline.push({
          date: e.date,
          type: e.type,
          reference: e.reference,
          debit: 0,
          credit,
          balance: Number(runningBalance.toFixed(2)),
          notes: e.notes,
        });
      }
    });

    res.json({
      customer: customer[0],
      currentBalance: Number(runningBalance.toFixed(2)),
      timeline,
    });
  } catch (error: any) {
    console.error('Failed to get customer statement:', error);
    res.status(500).json({ error: 'Failed to generate customer statement' });
  }
});

// Customer's Orders with full bag size, quantity, unit price, date details
apiApp.get('/api/customers/:id/orders', async (req: Request, res: Response) => {
  try {
    const list = await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, req.params.id))
      .orderBy(desc(orders.orderDate), desc(orders.createdAt));

    const items = await db.select().from(orderItems);
    const enriched = list.map((o) => {
      const oItems = items.filter((it) => it.orderId === o.id);
      const totalQuantity = oItems.reduce((acc, it) => acc + parseFloat(it.quantityPieces || '0'), 0);
      const totalAmt = parseFloat(o.totalAmountDzd || '0');
      const paidAmt = parseFloat(o.amountPaidDzd || '0');
      return {
        ...o,
        items: oItems,
        totalQuantity,
        remainingBalance: Math.max(0, totalAmt - paidAmt),
        isPaid: paidAmt >= totalAmt && totalAmt > 0,
      };
    });

    res.json(enriched);
  } catch (error: any) {
    console.error('Failed to get customer orders:', error);
    res.status(500).json({ error: 'Failed to retrieve customer orders' });
  }
});

// Orders
apiApp.get('/api/orders', async (req: Request, res: Response) => {
  try {
    const list = await db.select().from(orders).orderBy(desc(orders.createdAt));
    const items = await db.select().from(orderItems);
    const custList = await db.select().from(customers);
    const prodList = await db.select().from(productionRecords);
    const allLogs = await db.select().from(orderLogs).orderBy(desc(orderLogs.timestamp));

    const custMap = new Map(custList.map((c) => [c.id, c]));
    const logsMap: Record<string, typeof allLogs> = {};
    allLogs.forEach((l) => {
      if (!logsMap[l.orderId]) logsMap[l.orderId] = [];
      logsMap[l.orderId].push(l);
    });

    const enriched = list.map((o) => {
      const oItems = items.filter((it) => it.orderId === o.id);
      const oProd = prodList.filter((pr) => pr.orderId === o.id);
      const oLogs = logsMap[o.id] || [];

      const totalQuantity = oItems.reduce((acc, it) => acc + parseFloat(it.quantityPieces || '0'), 0);
      const completedQuantity = oProd.reduce((acc, pr) => acc + parseFloat(pr.completedQuantity || '0'), 0);

      const total = parseFloat(o.totalAmountDzd || '0');
      const paid = parseFloat(o.amountPaidDzd || '0');
      const balance = Math.max(0, total - paid);

      return {
        ...o,
        customer: custMap.get(o.customerId || '') || null,
        items: oItems,
        logs: oLogs,
        productionCount: oProd.length,
        totalQuantity,
        completedQuantity,
        remainingBalance: Number(balance.toFixed(2)),
        isPaid: paid >= total && total > 0,
      };
    });

    res.json(enriched);
  } catch (error: any) {
    console.error('Failed to fetch orders:', error);
    res.status(500).json({ error: 'Failed to retrieve orders' });
  }
});

apiApp.post('/api/orders', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      customerId,
      customerName,
      orderDate,
      dueDate,
      channel,
      discountDzd,
      deliveryFeeDzd,
      items,
      notes,
      createdByName: reqCreatorName,
      createdByRole: reqCreatorRole,
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    // Resolve customer name
    let custName = customerName || 'Walk-in Customer';
    if (customerId) {
      const cust = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (cust.length) custName = cust[0].name;
    }

    const orderId = genId();
    const orderCount = (await db.select({ count: sql<number>`count(*)` }).from(orders))[0]?.count || 0;
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(Number(orderCount) + 1).padStart(4, '0')}`;

    let subtotal = 0;
    const itemsToInsert = items.map((it: any) => {
      const qty = parseFloat(it.quantityPieces || '0');
      const price = parseFloat(it.unitPriceDzd || '0');
      const lineTotal = qty * price;
      subtotal += lineTotal;

      return {
        id: genId(),
        orderId,
        bagType: it.bagType || 'plastic',
        size: it.size || '25x35',
        bagColor: it.bagColor || 'White',
        printColors: it.printColors || '1 Color',
        designNotes: it.designNotes || '',
        artworkUrl: it.artworkUrl || '',
        quantityPieces: String(qty),
        unitPriceDzd: String(price),
        lineTotalDzd: String(lineTotal),
      };
    });

    const discount = parseFloat(discountDzd || '0');
    const delivery = parseFloat(deliveryFeeDzd || '0');
    const totalAmount = Math.max(0, subtotal - discount + delivery);

    const effectiveCreatorName = reqCreatorName || req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Workshop Staff');
    const effectiveCreatorRole = reqCreatorRole || req.userRole || 'owner';

    const newOrder = await db
      .insert(orders)
      .values({
        id: orderId,
        orderNumber,
        customerId: customerId || null,
        customerName: custName,
        orderDate: orderDate || todayStr(),
        dueDate: dueDate || '',
        status: 'new',
        channel: channel || 'whatsapp',
        subtotalDzd: String(subtotal),
        discountDzd: String(discount),
        deliveryFeeDzd: String(delivery),
        totalAmountDzd: String(totalAmount),
        amountPaidDzd: '0',
        deliveryDate: '',
        notes: notes || '',
        createdBy: req.user?.uid || 'user-1',
        createdByName: effectiveCreatorName,
        createdByRole: effectiveCreatorRole,
      })
      .returning();

    for (const item of itemsToInsert) {
      await db.insert(orderItems).values(item);
    }

    // Insert Initial Audit Log for Order Creation
    await db.insert(orderLogs).values({
      id: genId(),
      orderId,
      userId: req.user?.uid || '',
      userName: effectiveCreatorName,
      userRole: effectiveCreatorRole,
      action: 'Order Created',
      modification: `Order ${orderNumber} created for "${custName}" with status 'New' (${itemsToInsert.length} item line(s), Total: ${totalAmount} DZD) via ${channel || 'whatsapp'}.`,
    });

    res.status(201).json(newOrder[0]);
  } catch (error: any) {
    console.error('Failed to create order:', error);
    res.status(500).json({ error: error.message || 'Failed to create order' });
  }
});

apiApp.patch('/api/orders/:id/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { status, deliveryDate, modificationNotes, modifierName, modifierRole } = req.body;
    const validStatuses = [
      'new',
      'confirmed',
      'confirmed_phone',
      'in_production',
      'ready_for_delivery',
      'delivered',
      'cancelled',
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid order status' });
    }

    const currentOrder = await db.select().from(orders).where(eq(orders.id, req.params.id)).limit(1);
    if (!currentOrder.length) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const oldStatus = currentOrder[0].status;

    const updates: any = { status };
    if (status === 'delivered') {
      updates.deliveryDate = deliveryDate || todayStr();
    }

    const updated = await db.update(orders).set(updates).where(eq(orders.id, req.params.id)).returning();

    // Log the Status Modification
    const effectiveName = modifierName || req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Staff');
    const effectiveRole = modifierRole || req.userRole || 'staff';

    const statusLabels: Record<string, string> = {
      new: 'New',
      confirmed: 'Confirmed',
      confirmed_phone: 'Confirmed via phone',
      in_production: 'In production',
      ready_for_delivery: 'Ready for Delivery',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    };

    const oldLabel = statusLabels[oldStatus] || oldStatus;
    const newLabel = statusLabels[status] || status;

    // Record undo operation for order status change
    await recordUndoOperation({
      actionType: 'update',
      entityType: 'order',
      entityId: req.params.id,
      description: `Changement de statut commande ${currentOrder[0].orderNumber} ("${oldLabel}" → "${newLabel}")`,
      snapshot: { order: currentOrder[0] },
      req,
    });

    await db.insert(orderLogs).values({
      id: genId(),
      orderId: req.params.id,
      userId: req.user?.uid || '',
      userName: effectiveName,
      userRole: effectiveRole,
      action: 'Status Change',
      modification: `Order status changed from "${oldLabel}" to "${newLabel}"${modificationNotes ? ` - Reason: ${modificationNotes}` : ''}.`,
    });

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'ORDER_STATUS_UPDATED',
      entity: 'orders',
      data: updated[0],
    });

    res.json(updated[0]);
  } catch (error: any) {
    console.error('Failed to update order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Update Order Information & Record Modifications to Audit Log
apiApp.put('/api/orders/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      customerId,
      customerName,
      orderDate,
      dueDate,
      channel,
      status,
      discountDzd,
      deliveryFeeDzd,
      notes,
      items,
      modifierName,
      modifierRole,
      modificationDetails,
    } = req.body;

    const currentOrder = await db.select().from(orders).where(eq(orders.id, req.params.id)).limit(1);
    if (!currentOrder.length) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const prevOrder = currentOrder[0];
    const prevItems = await db.select().from(orderItems).where(eq(orderItems.orderId, req.params.id));
    const effectiveName = modifierName || req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Staff');
    const effectiveRole = modifierRole || req.userRole || 'owner';

    // Record snapshot in 10-operation undo stack before applying updates
    await recordUndoOperation({
      actionType: 'update',
      entityType: 'order',
      entityId: req.params.id,
      description: `Modification commande ${prevOrder.orderNumber} (${prevOrder.customerName})`,
      snapshot: {
        order: prevOrder,
        items: prevItems,
      },
      performedBy: effectiveName,
      performedByRole: effectiveRole,
    });

    const updates: any = {};
    const changes: string[] = [];

    // Customer
    if (customerId !== undefined && customerId !== prevOrder.customerId) {
      updates.customerId = customerId || null;
      let newCustName = customerName || 'Walk-in Customer';
      if (customerId) {
        const cust = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
        if (cust.length) newCustName = cust[0].name;
      }
      updates.customerName = newCustName;
      changes.push(`Client changé en "${newCustName}"`);
    } else if (customerName !== undefined && customerName !== prevOrder.customerName) {
      updates.customerName = customerName;
      changes.push(`Nom client changé en "${customerName}"`);
    }

    // Dates
    if (orderDate !== undefined && orderDate !== prevOrder.orderDate) {
      updates.orderDate = orderDate;
      changes.push(`Date de commande mise à jour (${orderDate})`);
    }
    if (dueDate !== undefined && dueDate !== prevOrder.dueDate) {
      updates.dueDate = dueDate;
      changes.push(`Date d'échéance mise à jour (${dueDate})`);
    }

    // Channel
    if (channel !== undefined && channel !== prevOrder.channel) {
      updates.channel = channel;
      changes.push(`Canal modifié : ${channel}`);
    }

    // Status
    if (status !== undefined && status !== prevOrder.status) {
      updates.status = status;
      changes.push(`Statut changé de '${prevOrder.status}' à '${status}'`);
    }

    // Notes
    if (notes !== undefined && notes !== prevOrder.notes) {
      updates.notes = notes;
      changes.push(`Notes mises à jour`);
    }

    // Handle items and subtotal/total calculations
    let currentSubtotal = parseFloat(prevOrder.subtotalDzd || '0');

    if (items && Array.isArray(items) && items.length > 0) {
      let newSubtotal = 0;
      const itemsToInsert = items.map((it: any) => {
        const qty = parseFloat(it.quantityPieces || '0');
        const price = parseFloat(it.unitPriceDzd || '0');
        const lineTotal = qty * price;
        newSubtotal += lineTotal;
        return {
          id: it.id && String(it.id).startsWith('item-') ? it.id : genId(),
          orderId: req.params.id,
          bagType: it.bagType || 'plastic',
          size: it.size || '25x35',
          bagColor: it.bagColor || 'White',
          printColors: it.printColors || '1 Color',
          designNotes: it.designNotes || '',
          artworkUrl: it.artworkUrl || '',
          quantityPieces: String(qty),
          unitPriceDzd: String(price),
          lineTotalDzd: String(lineTotal),
        };
      });

      // Replace existing items
      await db.delete(orderItems).where(eq(orderItems.orderId, req.params.id));
      for (const item of itemsToInsert) {
        await db.insert(orderItems).values(item);
      }

      currentSubtotal = newSubtotal;
      updates.subtotalDzd = String(newSubtotal);
      changes.push(`Articles modifiés (${itemsToInsert.length} ligne(s), sous-total: ${newSubtotal} DZD)`);
    }

    // Discount & Delivery fee
    const currentDiscount = discountDzd !== undefined ? parseFloat(discountDzd || '0') : parseFloat(prevOrder.discountDzd || '0');
    const currentDelivery = deliveryFeeDzd !== undefined ? parseFloat(deliveryFeeDzd || '0') : parseFloat(prevOrder.deliveryFeeDzd || '0');

    updates.discountDzd = String(currentDiscount);
    updates.deliveryFeeDzd = String(currentDelivery);
    updates.subtotalDzd = String(currentSubtotal);

    if (Math.abs(currentDiscount - parseFloat(prevOrder.discountDzd || '0')) > 0.001) {
      changes.push(`Remise modifiée : ${parseFloat(prevOrder.discountDzd || '0')} -> ${currentDiscount} DZD`);
    }
    if (Math.abs(currentDelivery - parseFloat(prevOrder.deliveryFeeDzd || '0')) > 0.001) {
      changes.push(`Frais de livraison modifiés : ${parseFloat(prevOrder.deliveryFeeDzd || '0')} -> ${currentDelivery} DZD`);
    }

    // Recalculate totalAmount
    const newTotal = Math.max(0, currentSubtotal - currentDiscount + currentDelivery);
    updates.totalAmountDzd = String(newTotal);

    if (Math.abs(newTotal - parseFloat(prevOrder.totalAmountDzd || '0')) > 0.001) {
      changes.push(`Total recalculé : ${parseFloat(prevOrder.totalAmountDzd || '0')} -> ${newTotal} DZD`);
    }

    const updated = await db.update(orders).set(updates).where(eq(orders.id, req.params.id)).returning();

    if (changes.length > 0 || modificationDetails) {
      await db.insert(orderLogs).values({
        id: genId(),
        orderId: req.params.id,
        userId: req.user?.uid || '',
        userName: effectiveName,
        userRole: effectiveRole,
        action: 'Commande Modifiée',
        modification: modificationDetails || changes.join('; '),
      });
    }

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'ORDER_UPDATED',
      entity: 'orders',
      data: {
        id: req.params.id,
        orderNumber: updated[0].orderNumber,
        modifiedBy: effectiveName,
      },
    });

    res.json(updated[0]);
  } catch (error: any) {
    console.error('Failed to update order:', error);
    res.status(500).json({ error: error.message || 'Failed to update order' });
  }
});

// Delete Order (Owner, Admin, or User with Orders Permission)
apiApp.delete('/api/orders/:id', requireAuth, requireOrderManagerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const target = await db.select().from(orders).where(eq(orders.id, req.params.id)).limit(1);
    if (!target.length) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }
    const currentOrder = target[0];
    const orderNum = currentOrder.orderNumber;

    // Fetch related records for undo snapshot before deletion
    const existingItems = await db.select().from(orderItems).where(eq(orderItems.orderId, req.params.id));
    const existingLogs = await db.select().from(orderLogs).where(eq(orderLogs.orderId, req.params.id));
    const existingAllocs = await db.select().from(paymentAllocations).where(eq(paymentAllocations.orderId, req.params.id));
    const relatedProduction = await db.select().from(productionRecords).where(eq(productionRecords.orderId, req.params.id));

    let relatedUsage: any[] = [];
    if (relatedProduction.length > 0) {
      const prodIds = relatedProduction.map((pr) => pr.id);
      relatedUsage = await db.select().from(productionUsage).where(inArray(productionUsage.productionId, prodIds));
    }

    // Save snapshot in 10-operation undo stack before deletion
    await recordUndoOperation({
      actionType: 'delete',
      entityType: 'order',
      entityId: req.params.id,
      description: `Suppression commande ${orderNum} (${currentOrder.customerName})`,
      snapshot: {
        order: currentOrder,
        items: existingItems,
        logs: existingLogs,
        allocations: existingAllocs,
        productionRecords: relatedProduction,
        productionUsage: relatedUsage,
      },
      performedBy: req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Staff'),
      performedByRole: req.userRole || 'owner',
    });

    // 1. Delete payment allocations referencing this order to prevent Foreign Key constraint violation
    await db.delete(paymentAllocations).where(eq(paymentAllocations.orderId, req.params.id));

    // 2. Delete production usage and production records referencing this order
    if (relatedProduction.length > 0) {
      const prodIds = relatedProduction.map((pr) => pr.id);
      await db.delete(productionUsage).where(inArray(productionUsage.productionId, prodIds));
      await db.delete(productionRecords).where(eq(productionRecords.orderId, req.params.id));
    }

    // 3. Delete order items, logs, and the order itself
    await db.delete(orderItems).where(eq(orderItems.orderId, req.params.id));
    await db.delete(orderLogs).where(eq(orderLogs.orderId, req.params.id));
    await db.delete(orders).where(eq(orders.id, req.params.id));

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'ORDER_DELETED',
      entity: 'orders',
      data: { id: req.params.id, orderNumber: orderNum },
    });

    res.json({ success: true, message: `Commande ${orderNum} supprimée avec succès. Vous pouvez l'annuler via Undo.` });
  } catch (error: any) {
    console.error('Failed to delete order:', error);
    res.status(500).json({ error: error.message || 'Failed to delete order' });
  }
});

// Bulk Delete All Orders (Owner & Admin only)
apiApp.delete('/api/orders/all', requireAuth, requireOwnerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const allOrders = await db.select().from(orders);
    const allItems = await db.select().from(orderItems);
    const allLogs = await db.select().from(orderLogs);
    const allAllocs = await db.select().from(paymentAllocations).where(sql`order_id IS NOT NULL`);
    const allProd = await db.select().from(productionRecords);
    const allUsage = await db.select().from(productionUsage);

    if (allOrders.length === 0) {
      return res.json({ success: true, count: 0, message: 'Aucune commande à supprimer.' });
    }

    await recordUndoOperation({
      actionType: 'bulk_delete',
      entityType: 'orders',
      entityId: 'all',
      description: `Suppression de toutes les commandes (${allOrders.length} commande(s))`,
      snapshot: {
        orders: allOrders,
        items: allItems,
        logs: allLogs,
        allocations: allAllocs,
        productionRecords: allProd,
        productionUsage: allUsage,
      },
      performedBy: req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Staff'),
      performedByRole: req.userRole || 'owner',
    });

    await db.delete(paymentAllocations).where(sql`order_id IS NOT NULL`);
    await db.delete(productionUsage);
    await db.delete(productionRecords);
    await db.delete(orderItems);
    await db.delete(orderLogs);
    await db.delete(orders);

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'ORDERS_BULK_DELETED',
      entity: 'orders',
      data: { count: allOrders.length },
    });

    res.json({ success: true, count: allOrders.length, message: `Toutes les commandes (${allOrders.length}) ont été supprimées.` });
  } catch (error: any) {
    console.error('Failed to delete all orders:', error);
    res.status(500).json({ error: error.message || 'Failed to delete all orders' });
  }
});

// -------------------------------------------------------------
// 6. Production & Material Consumption
// -------------------------------------------------------------
apiApp.get('/api/production', async (req: Request, res: Response) => {
  try {
    const list = await db.select().from(productionRecords).orderBy(desc(productionRecords.createdAt));
    const usage = await db.select().from(productionUsage);
    const orderList = await db.select().from(orders);

    const orderMap = new Map(orderList.map((o) => [o.id, o]));

    const enriched = list.map((pr) => ({
      ...pr,
      order: orderMap.get(pr.orderId) || null,
      usage: usage.filter((u) => u.productionId === pr.id),
    }));

    res.json(enriched);
  } catch (error: any) {
    console.error('Failed to fetch production records:', error);
    res.status(500).json({ error: 'Failed to retrieve production records' });
  }
});

// Production Audit Logs
apiApp.get('/api/production/:id/logs', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureProductionLogsTable();
    const logs = await db
      .select()
      .from(productionLogs)
      .where(eq(productionLogs.productionId, req.params.id))
      .orderBy(desc(productionLogs.timestamp));
    res.json(logs);
  } catch (error: any) {
    console.error('Failed to fetch production logs:', error);
    res.status(500).json({ error: 'Failed to retrieve production audit logs' });
  }
});

apiApp.post('/api/production', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, plannedQuantity, completedQuantity, rejectedQuantity, workerName, notes, usage } = req.body;
    if (!orderId || !plannedQuantity) {
      return res.status(400).json({ error: 'Order and planned quantity are required' });
    }

    // 1. Authoritative Stock Availability Check: PREVENT creation if stock < quantity used + waste
    if (usage && Array.isArray(usage) && usage.length > 0) {
      const stockMap = await getMaterialsStockMap();
      for (const u of usage) {
        const qtyUsed = parseFloat(u.quantityUsed || '0');
        const wasteQty = parseFloat(u.wasteQuantity || '0');
        const totalNeeded = qtyUsed + wasteQty;
        if (totalNeeded <= 0) continue;

        const matInfo = stockMap.get(u.materialId);
        const available = matInfo ? matInfo.currentStock : 0;
        const matName = matInfo ? matInfo.name : (u.materialName || 'Matière');
        const unit = matInfo ? matInfo.stockUnit : (u.unit || 'unité');

        if (totalNeeded > available) {
          return res.status(400).json({
            error: `Stock insuffisant pour "${matName}". Stock disponible : ${available} ${unit}, Quantité totale requise : ${totalNeeded} ${unit}. Veuillez approvisionner le stock ou ajuster les quantités.`,
          });
        }
      }
    }

    const prodCount = (await db.select({ count: sql<number>`count(*)` }).from(productionRecords))[0]?.count || 0;
    const productionNumber = `PRD-${new Date().getFullYear()}-${String(Number(prodCount) + 1).padStart(4, '0')}`;
    const prodId = genId();

    const created = await db
      .insert(productionRecords)
      .values({
        id: prodId,
        productionNumber,
        orderId,
        startDate: new Date(),
        plannedQuantity: String(plannedQuantity),
        completedQuantity: completedQuantity ? String(completedQuantity) : '0',
        rejectedQuantity: rejectedQuantity ? String(rejectedQuantity) : '0',
        workerId: req.user?.uid || '',
        workerName: workerName || req.user?.name || 'Production Worker',
        notes: notes || '',
        status: completedQuantity && parseFloat(completedQuantity) > 0 ? 'completed' : 'in_progress',
      })
      .returning();

    const insertedUsage: any[] = [];
    const validUserId = await resolveValidProfileId(req.user?.uid);
    const validUserName = req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Staff');
    const validRole = req.userRole || 'staff';

    // If usage is submitted with completion, record usage and stock movements exactly once
    if (usage && Array.isArray(usage) && usage.length > 0) {
      const matList = await db.select().from(materials);
      const matMap = new Map(matList.map((m) => [m.id, m]));

      for (const u of usage) {
        const mat = matMap.get(u.materialId);
        const qtyUsed = parseFloat(u.quantityUsed || '0');
        const wasteQty = parseFloat(u.wasteQuantity || '0');

        if (qtyUsed <= 0 && wasteQty <= 0) continue;

        const uId = genId();
        const usageRow = {
          id: uId,
          productionId: prodId,
          materialId: u.materialId,
          materialName: mat ? mat.name : (u.materialName || ''),
          quantityUsed: String(qtyUsed),
          unit: u.unit || (mat ? mat.stockUnit : 'kg'),
          wasteQuantity: String(wasteQty),
          notes: u.notes || '',
        };
        await db.insert(productionUsage).values(usageRow);
        insertedUsage.push(usageRow);

        // Deduct from stock movement ledger: Consumption
        if (qtyUsed > 0) {
          await db.insert(stockMovements).values({
            id: genId(),
            materialId: u.materialId,
            movementType: 'production_consumption',
            quantityIn: '0',
            quantityOut: String(qtyUsed),
            unit: u.unit || (mat ? mat.stockUnit : 'kg'),
            referenceType: 'production',
            referenceId: productionNumber,
            unitCostDzd: mat ? mat.unitCostDzd : '0',
            userId: validUserId,
            userName: workerName || req.user?.name || 'Worker',
            notes: `Consumed for order production ${productionNumber}`,
          });
        }

        // Deduct waste if any
        if (wasteQty > 0) {
          await db.insert(stockMovements).values({
            id: genId(),
            materialId: u.materialId,
            movementType: 'production_waste',
            quantityIn: '0',
            quantityOut: String(wasteQty),
            unit: u.unit || (mat ? mat.stockUnit : 'kg'),
            referenceType: 'production',
            referenceId: productionNumber,
            unitCostDzd: mat ? mat.unitCostDzd : '0',
            userId: validUserId,
            userName: workerName || req.user?.name || 'Worker',
            notes: `Waste during production ${productionNumber}`,
          });
        }
      }
    }

    // Automatically update order status to in_production
    await db.update(orders).set({ status: 'in_production' }).where(eq(orders.id, orderId));

    // Audit Log Entry
    try {
      await ensureProductionLogsTable();
      await db.insert(productionLogs).values({
        id: genId(),
        productionId: prodId,
        userId: validUserId,
        userName: validUserName,
        userRole: validRole,
        action: 'Création',
        modification: `Création de l'OF ${productionNumber} (Prévu: ${plannedQuantity}, Produit: ${completedQuantity || 0}, Rebut: ${rejectedQuantity || 0})${insertedUsage.length > 0 ? ` avec ${insertedUsage.length} matière(s) déduite(s) du stock` : ''}`,
      });
    } catch (logErr) {
      console.warn('Production log insert notice:', logErr);
    }

    // Record snapshot in 100-operation Undo Stack
    await recordUndoOperation({
      actionType: 'delete',
      entityType: 'production',
      entityId: prodId,
      description: `Création fiche production ${productionNumber}`,
      snapshot: {
        production: created[0],
        usage: insertedUsage,
      },
      req,
    });

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'PRODUCTION_CREATED',
      entity: 'production',
      data: created[0],
    });

    res.status(201).json(created[0]);
  } catch (error: any) {
    console.error('Failed to create production record:', error);
    res.status(500).json({ error: error.message || 'Failed to create production record' });
  }
});

// Update Production Record & Adjust Consumed Stock
apiApp.put('/api/production/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      plannedQuantity,
      completedQuantity,
      rejectedQuantity,
      workerName,
      status,
      notes,
      usage,
      modifierName,
      modifierRole,
    } = req.body;

    const current = await db.select().from(productionRecords).where(eq(productionRecords.id, req.params.id)).limit(1);
    if (!current.length) {
      return res.status(404).json({ error: 'Fiche de production introuvable' });
    }

    const prev = current[0];
    const oldUsage = await db.select().from(productionUsage).where(eq(productionUsage.productionId, req.params.id));
    const effectiveName = modifierName || req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Staff');
    const effectiveRole = modifierRole || req.userRole || 'staff';

    // Stock check for new usage: Available stock = Current Stock in Ledger + previously deducted quantity in this production
    if (usage && Array.isArray(usage) && usage.length > 0) {
      const stockMap = await getMaterialsStockMap();
      for (const u of usage) {
        const qtyUsed = parseFloat(u.quantityUsed || '0');
        const wasteQty = parseFloat(u.wasteQuantity || '0');
        const newTotalNeeded = qtyUsed + wasteQty;
        if (newTotalNeeded <= 0) continue;

        // Sum previous deduction for this material in this specific production record
        const prevUsageForMat = oldUsage
          .filter((ou) => ou.materialId === u.materialId)
          .reduce((sum, ou) => sum + parseFloat(ou.quantityUsed || '0') + parseFloat(ou.wasteQuantity || '0'), 0);

        const matInfo = stockMap.get(u.materialId);
        const liveStock = matInfo ? matInfo.currentStock : 0;
        const availableForUpdate = liveStock + prevUsageForMat;
        const matName = matInfo ? matInfo.name : (u.materialName || 'Matière');
        const unit = matInfo ? matInfo.stockUnit : (u.unit || 'unité');

        if (newTotalNeeded > availableForUpdate) {
          return res.status(400).json({
            error: `Stock insuffisant pour "${matName}". Stock disponible : ${availableForUpdate.toFixed(2)} ${unit}, Quantité requise : ${newTotalNeeded} ${unit}.`,
          });
        }
      }
    }

    // Save snapshot in undo stack
    await recordUndoOperation({
      actionType: 'update',
      entityType: 'production',
      entityId: req.params.id,
      description: `Modification fiche de production ${prev.productionNumber}`,
      snapshot: {
        production: prev,
        usage: oldUsage,
      },
      req,
    });

    const changes: string[] = [];
    const updates: any = {};

    if (plannedQuantity !== undefined && String(plannedQuantity) !== String(prev.plannedQuantity)) {
      updates.plannedQuantity = String(plannedQuantity);
      changes.push(`Quantité prévue : ${prev.plannedQuantity} → ${plannedQuantity}`);
    }
    if (completedQuantity !== undefined && String(completedQuantity) !== String(prev.completedQuantity)) {
      updates.completedQuantity = String(completedQuantity);
      changes.push(`Quantité terminée : ${prev.completedQuantity} → ${completedQuantity}`);
    }
    if (rejectedQuantity !== undefined && String(rejectedQuantity) !== String(prev.rejectedQuantity)) {
      updates.rejectedQuantity = String(rejectedQuantity);
      changes.push(`Quantité rebut : ${prev.rejectedQuantity} → ${rejectedQuantity}`);
    }
    if (workerName !== undefined && workerName !== prev.workerName) {
      updates.workerName = workerName;
      changes.push(`Opérateur : "${prev.workerName || 'N/A'}" → "${workerName}"`);
    }
    if (status !== undefined && status !== prev.status) {
      updates.status = status;
      changes.push(`Statut : "${prev.status}" → "${status}"`);
    }
    if (notes !== undefined && notes !== prev.notes) {
      updates.notes = notes;
      changes.push(`Notes mises à jour`);
    }

    if (Object.keys(updates).length === 0) {
      updates.status = prev.status;
    }

    // Update production record
    const updated = await db
      .update(productionRecords)
      .set(updates)
      .where(eq(productionRecords.id, req.params.id))
      .returning();

    // Reconcile Consumables & Stock Movements if usage was provided
    if (usage && Array.isArray(usage)) {
      // 1. Remove previous stock movements linked to this production run
      await db
        .delete(stockMovements)
        .where(
          and(
            eq(stockMovements.referenceType, 'production'),
            eq(stockMovements.referenceId, prev.productionNumber)
          )
        );

      // 2. Clear old productionUsage rows
      await db.delete(productionUsage).where(eq(productionUsage.productionId, req.params.id));

      // 3. Insert new productionUsage rows and corresponding stock deductions
      const matList = await db.select().from(materials);
      const matMap = new Map(matList.map((m) => [m.id, m]));
      const validUserId = await resolveValidProfileId(req.user?.uid);

      for (const u of usage) {
        const mat = matMap.get(u.materialId);
        const qtyUsed = parseFloat(u.quantityUsed || '0');
        const wasteQty = parseFloat(u.wasteQuantity || '0');
        if (qtyUsed <= 0 && wasteQty <= 0) continue;

        await db.insert(productionUsage).values({
          id: genId(),
          productionId: req.params.id,
          materialId: u.materialId,
          materialName: mat ? mat.name : (u.materialName || ''),
          quantityUsed: String(qtyUsed),
          unit: u.unit || (mat ? mat.stockUnit : 'kg'),
          wasteQuantity: String(wasteQty),
          notes: u.notes || '',
        });

        if (qtyUsed > 0) {
          await db.insert(stockMovements).values({
            id: genId(),
            materialId: u.materialId,
            movementType: 'production_consumption',
            quantityIn: '0',
            quantityOut: String(qtyUsed),
            unit: u.unit || (mat ? mat.stockUnit : 'kg'),
            referenceType: 'production',
            referenceId: prev.productionNumber,
            unitCostDzd: mat ? mat.unitCostDzd : '0',
            userId: validUserId,
            userName: effectiveName,
            notes: `Consumed for order production ${prev.productionNumber} (updated)`,
          });
        }

        if (wasteQty > 0) {
          await db.insert(stockMovements).values({
            id: genId(),
            materialId: u.materialId,
            movementType: 'production_waste',
            quantityIn: '0',
            quantityOut: String(wasteQty),
            unit: u.unit || (mat ? mat.stockUnit : 'kg'),
            referenceType: 'production',
            referenceId: prev.productionNumber,
            unitCostDzd: mat ? mat.unitCostDzd : '0',
            userId: validUserId,
            userName: effectiveName,
            notes: `Waste during production ${prev.productionNumber} (updated)`,
          });
        }
      }
      changes.push(`Consommables matières mis à jour (${usage.length} lignes)`);
    }

    // Insert Audit Log entry
    try {
      await ensureProductionLogsTable();
      await db.insert(productionLogs).values({
        id: genId(),
        productionId: req.params.id,
        userId: await resolveValidProfileId(req.user?.uid),
        userName: effectiveName,
        userRole: effectiveRole,
        action: 'Modification',
        modification: changes.length > 0 ? changes.join(' | ') : 'Mise à jour des informations de production',
      });
    } catch (logErr) {
      console.warn('Production log insert notice:', logErr);
    }

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'PRODUCTION_UPDATED',
      entity: 'production',
      data: updated[0],
    });

    res.json(updated[0]);
  } catch (error: any) {
    console.error('Failed to update production record:', error);
    res.status(500).json({ error: error.message || 'Failed to update production record' });
  }
});

// Delete Production Record with Stock Reversal & Audit Snapshot
apiApp.delete('/api/production/:id', requireAuth, requireInventoryManagerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const current = await db.select().from(productionRecords).where(eq(productionRecords.id, req.params.id)).limit(1);
    if (!current.length) {
      return res.status(404).json({ error: 'Fiche de production introuvable' });
    }

    const prev = current[0];
    const oldUsage = await db.select().from(productionUsage).where(eq(productionUsage.productionId, req.params.id));
    await ensureProductionLogsTable();
    const oldLogs = await db.select().from(productionLogs).where(eq(productionLogs.productionId, req.params.id));

    // Save snapshot in undo stack
    await recordUndoOperation({
      actionType: 'delete',
      entityType: 'production',
      entityId: req.params.id,
      description: `Suppression fiche de production ${prev.productionNumber}`,
      snapshot: {
        production: prev,
        usage: oldUsage,
        logs: oldLogs,
      },
      req,
    });

    // 1. Re-credit inventory: delete stockMovements tied to this production number
    await db
      .delete(stockMovements)
      .where(
        and(
          eq(stockMovements.referenceType, 'production'),
          eq(stockMovements.referenceId, prev.productionNumber)
        )
      );

    // 2. Delete logs, usage, and the production record
    await db.delete(productionLogs).where(eq(productionLogs.productionId, req.params.id));
    await db.delete(productionUsage).where(eq(productionUsage.productionId, req.params.id));
    await db.delete(productionRecords).where(eq(productionRecords.id, req.params.id));

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'PRODUCTION_DELETED',
      entity: 'production',
      data: { id: req.params.id, productionNumber: prev.productionNumber },
    });

    res.json({
      success: true,
      message: `Fiche de production ${prev.productionNumber} supprimée avec succès. Les matières consommées ont été réintégrées au stock.`,
    });
  } catch (error: any) {
    console.error('Failed to delete production record:', error);
    res.status(500).json({ error: error.message || 'Failed to delete production record' });
  }
});

// -------------------------------------------------------------
// 7. Payments & Allocations
// -------------------------------------------------------------
apiApp.get('/api/payments', async (req: Request, res: Response) => {
  try {
    const list = await db.select().from(payments).orderBy(desc(payments.createdAt));
    const allocs = await db.select().from(paymentAllocations);

    const custList = await db.select().from(customers);
    const suppList = await db.select().from(suppliers);
    const custMap = new Map(custList.map((c) => [c.id, c]));
    const suppMap = new Map(suppList.map((s) => [s.id, s]));

    const enriched = list.map((p) => {
      const pAllocs = allocs.filter((a) => a.paymentId === p.id);
      return {
        ...p,
        customer: p.customerId ? custMap.get(p.customerId) : null,
        supplier: p.supplierId ? suppMap.get(p.supplierId) : null,
        allocations: pAllocs,
      };
    });

    res.json(enriched);
  } catch (error: any) {
    console.error('Failed to fetch payments:', error);
    res.status(500).json({ error: 'Failed to retrieve payments' });
  }
});

apiApp.post('/api/payments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      paymentDate,
      paymentType, // 'customer_receipt' | 'supplier_payment'
      customerId,
      supplierId,
      partyName,
      amountDzd,
      paymentMethod,
      referenceNumber,
      orderId, // Optional allocation
      purchaseId, // Optional allocation
      notes,
    } = req.body;

    const amount = parseFloat(amountDzd || '0');
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required' });
    }

    let resolvedParty = partyName || '';
    if (paymentType === 'customer_receipt' && customerId) {
      const cust = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (cust.length) resolvedParty = cust[0].name;
    } else if (paymentType === 'supplier_payment' && supplierId) {
      const supp = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
      if (supp.length) resolvedParty = supp[0].name;
    }

    const payCount = (await db.select({ count: sql<number>`count(*)` }).from(payments))[0]?.count || 0;
    const paymentNumber = `PAY-${new Date().getFullYear()}-${String(Number(payCount) + 1).padStart(4, '0')}`;
    const paymentId = genId();

    const newPayment = await db
      .insert(payments)
      .values({
        id: paymentId,
        paymentNumber,
        paymentDate: paymentDate || todayStr(),
        paymentType,
        customerId: customerId || null,
        supplierId: supplierId || null,
        partyName: resolvedParty,
        amountDzd: String(amount),
        paymentMethod: paymentMethod || 'cash',
        referenceNumber: referenceNumber || '',
        notes: notes || '',
        recordedBy: req.user?.uid || '',
      })
      .returning();

    // Handle Order Allocation
    if (paymentType === 'customer_receipt' && orderId) {
      const targetOrder = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (targetOrder.length) {
        const currentPaid = parseFloat(targetOrder[0].amountPaidDzd || '0');
        const newPaid = currentPaid + amount;
        await db.update(orders).set({ amountPaidDzd: String(newPaid) }).where(eq(orders.id, orderId));

        await db.insert(paymentAllocations).values({
          id: genId(),
          paymentId,
          orderId,
          allocatedAmountDzd: String(amount),
        });
      }
    }

    // Handle Purchase Allocation
    if (paymentType === 'supplier_payment' && purchaseId) {
      const targetPurchase = await db.select().from(purchases).where(eq(purchases.id, purchaseId)).limit(1);
      if (targetPurchase.length) {
        const currentPaid = parseFloat(targetPurchase[0].amountPaidDzd || '0');
        const totalAmount = parseFloat(targetPurchase[0].totalAmountDzd || '0');
        const newPaid = currentPaid + amount;
        const newStatus = newPaid >= totalAmount ? 'paid' : 'partial';

        await db
          .update(purchases)
          .set({
            amountPaidDzd: String(newPaid),
            paymentStatus: newStatus,
          })
          .where(eq(purchases.id, purchaseId));

        await db.insert(paymentAllocations).values({
          id: genId(),
          paymentId,
          purchaseId,
          allocatedAmountDzd: String(amount),
        });
      }
    }

    res.status(201).json(newPayment[0]);
  } catch (error: any) {
    console.error('Failed to record payment:', error);
    res.status(500).json({ error: error.message || 'Failed to record payment' });
  }
});

apiApp.put('/api/payments/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      paymentDate,
      paymentType,
      customerId,
      supplierId,
      partyName,
      amountDzd,
      paymentMethod,
      referenceNumber,
      orderId,
      purchaseId,
      notes,
    } = req.body;

    const existing = await db.select().from(payments).where(eq(payments.id, req.params.id)).limit(1);
    if (!existing.length) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    const prevPayment = existing[0];
    const prevAllocs = await db.select().from(paymentAllocations).where(eq(paymentAllocations.paymentId, req.params.id));

    await recordUndoOperation({
      actionType: 'update',
      entityType: 'payment',
      entityId: req.params.id,
      description: `Modification du paiement ${prevPayment.paymentNumber} (${prevPayment.partyName})`,
      snapshot: {
        payment: prevPayment,
        allocations: prevAllocs,
      },
      req,
    });

    for (const alloc of prevAllocs) {
      const allocAmt = parseFloat(alloc.allocatedAmountDzd || '0');
      if (alloc.orderId) {
        const ord = await db.select().from(orders).where(eq(orders.id, alloc.orderId)).limit(1);
        if (ord.length) {
          const currentPaid = parseFloat(ord[0].amountPaidDzd || '0');
          const newPaid = Math.max(0, currentPaid - allocAmt);
          await db.update(orders).set({ amountPaidDzd: String(newPaid) }).where(eq(orders.id, alloc.orderId));
        }
      }
      if (alloc.purchaseId) {
        const purch = await db.select().from(purchases).where(eq(purchases.id, alloc.purchaseId)).limit(1);
        if (purch.length) {
          const currentPaid = parseFloat(purch[0].amountPaidDzd || '0');
          const totalAmt = parseFloat(purch[0].totalAmountDzd || '0');
          const newPaid = Math.max(0, currentPaid - allocAmt);
          const newStatus = newPaid <= 0 ? 'unpaid' : newPaid < totalAmt ? 'partial' : 'paid';
          await db.update(purchases).set({ amountPaidDzd: String(newPaid), paymentStatus: newStatus }).where(eq(purchases.id, alloc.purchaseId));
        }
      }
    }

    await db.delete(paymentAllocations).where(eq(paymentAllocations.paymentId, req.params.id));

    const effectiveType = paymentType || prevPayment.paymentType;
    let resolvedParty = partyName || prevPayment.partyName;

    if (effectiveType === 'customer_receipt' && customerId) {
      const cust = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (cust.length) resolvedParty = cust[0].name;
    } else if (effectiveType === 'supplier_payment' && supplierId) {
      const supp = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
      if (supp.length) resolvedParty = supp[0].name;
    }

    const amount = amountDzd !== undefined ? parseFloat(amountDzd || '0') : parseFloat(prevPayment.amountDzd || '0');

    const updatedPayment = await db
      .update(payments)
      .set({
        paymentDate: paymentDate || prevPayment.paymentDate,
        paymentType: effectiveType,
        customerId: customerId !== undefined ? (customerId || null) : prevPayment.customerId,
        supplierId: supplierId !== undefined ? (supplierId || null) : prevPayment.supplierId,
        partyName: resolvedParty,
        amountDzd: String(amount),
        paymentMethod: paymentMethod || prevPayment.paymentMethod,
        referenceNumber: referenceNumber !== undefined ? referenceNumber : prevPayment.referenceNumber,
        notes: notes !== undefined ? notes : prevPayment.notes,
      })
      .where(eq(payments.id, req.params.id))
      .returning();

    if (effectiveType === 'customer_receipt' && orderId) {
      const targetOrder = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (targetOrder.length) {
        const currentPaid = parseFloat(targetOrder[0].amountPaidDzd || '0');
        const newPaid = currentPaid + amount;
        await db.update(orders).set({ amountPaidDzd: String(newPaid) }).where(eq(orders.id, orderId));

        await db.insert(paymentAllocations).values({
          id: genId(),
          paymentId: req.params.id,
          orderId,
          allocatedAmountDzd: String(amount),
        });
      }
    }

    if (effectiveType === 'supplier_payment' && purchaseId) {
      const targetPurchase = await db.select().from(purchases).where(eq(purchases.id, purchaseId)).limit(1);
      if (targetPurchase.length) {
        const currentPaid = parseFloat(targetPurchase[0].amountPaidDzd || '0');
        const totalAmount = parseFloat(targetPurchase[0].totalAmountDzd || '0');
        const newPaid = currentPaid + amount;
        const newStatus = newPaid >= totalAmount ? 'paid' : 'partial';

        await db
          .update(purchases)
          .set({
            amountPaidDzd: String(newPaid),
            paymentStatus: newStatus,
          })
          .where(eq(purchases.id, purchaseId));

        await db.insert(paymentAllocations).values({
          id: genId(),
          paymentId: req.params.id,
          purchaseId,
          allocatedAmountDzd: String(amount),
        });
      }
    }

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'PAYMENT_UPDATED',
      entity: 'payments',
      data: updatedPayment[0],
    });

    res.json(updatedPayment[0]);
  } catch (error: any) {
    console.error('Failed to update payment:', error);
    res.status(500).json({ error: error.message || 'Failed to update payment' });
  }
});

apiApp.delete('/api/payments/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await db.select().from(payments).where(eq(payments.id, req.params.id)).limit(1);
    if (!existing.length) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    const targetPayment = existing[0];
    const prevAllocs = await db.select().from(paymentAllocations).where(eq(paymentAllocations.paymentId, req.params.id));

    await recordUndoOperation({
      actionType: 'delete',
      entityType: 'payment',
      entityId: req.params.id,
      description: `Suppression du paiement ${targetPayment.paymentNumber} (${targetPayment.partyName})`,
      snapshot: {
        payment: targetPayment,
        allocations: prevAllocs,
      },
      req,
    });

    for (const alloc of prevAllocs) {
      const allocAmt = parseFloat(alloc.allocatedAmountDzd || '0');
      if (alloc.orderId) {
        const ord = await db.select().from(orders).where(eq(orders.id, alloc.orderId)).limit(1);
        if (ord.length) {
          const currentPaid = parseFloat(ord[0].amountPaidDzd || '0');
          const newPaid = Math.max(0, currentPaid - allocAmt);
          await db.update(orders).set({ amountPaidDzd: String(newPaid) }).where(eq(orders.id, alloc.orderId));
        }
      }
      if (alloc.purchaseId) {
        const purch = await db.select().from(purchases).where(eq(purchases.id, alloc.purchaseId)).limit(1);
        if (purch.length) {
          const currentPaid = parseFloat(purch[0].amountPaidDzd || '0');
          const totalAmt = parseFloat(purch[0].totalAmountDzd || '0');
          const newPaid = Math.max(0, currentPaid - allocAmt);
          const newStatus = newPaid <= 0 ? 'unpaid' : newPaid < totalAmt ? 'partial' : 'paid';
          await db.update(purchases).set({ amountPaidDzd: String(newPaid), paymentStatus: newStatus }).where(eq(purchases.id, alloc.purchaseId));
        }
      }
    }

    await db.delete(paymentAllocations).where(eq(paymentAllocations.paymentId, req.params.id));
    await db.delete(payments).where(eq(payments.id, req.params.id));

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'PAYMENT_DELETED',
      entity: 'payments',
      data: { id: req.params.id, paymentNumber: targetPayment.paymentNumber },
    });

    res.json({ success: true, message: `Paiement ${targetPayment.paymentNumber} supprimé avec succès.` });
  } catch (error: any) {
    console.error('Failed to delete payment:', error);
    res.status(500).json({ error: error.message || 'Failed to delete payment' });
  }
});

// -------------------------------------------------------------
// 8. Expense Categories & Expenses
// -------------------------------------------------------------
apiApp.get('/api/expense-categories', async (req: Request, res: Response) => {
  try {
    const list = await db.select().from(expenseCategories).orderBy(expenseCategories.name);
    res.json(list);
  } catch (error: any) {
    console.error('Failed to fetch expense categories:', error);
    res.status(500).json({ error: 'Failed to retrieve categories' });
  }
});

apiApp.post('/api/expense-categories', requireAuth, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    const created = await db
      .insert(expenseCategories)
      .values({
        id: genId(),
        name,
        isSystem: false,
      })
      .returning();

    res.status(201).json(created[0]);
  } catch (error: any) {
    console.error('Failed to create category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

apiApp.get('/api/expenses', async (req: Request, res: Response) => {
  try {
    const list = await db.select().from(expenses).orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));
    res.json(list);
  } catch (error: any) {
    console.error('Failed to fetch expenses:', error);
    res.status(500).json({ error: 'Failed to retrieve expenses' });
  }
});

apiApp.post('/api/expenses', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { categoryId, description, amountDzd, expenseDate, paymentMethod, paidTo, referenceNumber, isPaid, notes } =
      req.body;

    if (!categoryId || !description || !amountDzd) {
      return res.status(400).json({ error: 'Category, description, and amount are required' });
    }

    const cat = await db.select().from(expenseCategories).where(eq(expenseCategories.id, categoryId)).limit(1);
    const catName = cat.length ? cat[0].name : 'General';

    const expCount = (await db.select({ count: sql<number>`count(*)` }).from(expenses))[0]?.count || 0;
    const expenseNumber = `EXP-${new Date().getFullYear()}-${String(Number(expCount) + 1).padStart(4, '0')}`;

    const created = await db
      .insert(expenses)
      .values({
        id: genId(),
        expenseNumber,
        expenseDate: expenseDate || todayStr(),
        categoryId,
        categoryName: catName,
        description,
        amountDzd: String(amountDzd),
        paymentMethod: paymentMethod || 'cash',
        paidTo: paidTo || '',
        referenceNumber: referenceNumber || '',
        isPaid: isPaid ?? true,
        notes: notes || '',
        recordedBy: req.user?.uid || '',
      })
      .returning();

    res.status(201).json(created[0]);
  } catch (error: any) {
    console.error('Failed to create expense:', error);
    res.status(500).json({ error: error.message || 'Failed to record expense' });
  }
});

apiApp.put('/api/expenses/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { categoryId, description, amountDzd, expenseDate, paymentMethod, paidTo, referenceNumber, isPaid, notes } =
      req.body;

    const current = await db.select().from(expenses).where(eq(expenses.id, req.params.id)).limit(1);
    if (!current.length) return res.status(404).json({ error: 'Dépense introuvable' });

    let catName = current[0].categoryName;
    if (categoryId && categoryId !== current[0].categoryId) {
      const cat = await db.select().from(expenseCategories).where(eq(expenseCategories.id, categoryId)).limit(1);
      if (cat.length) catName = cat[0].name;
    }

    const updated = await db
      .update(expenses)
      .set({
        categoryId: categoryId || current[0].categoryId,
        categoryName: catName,
        description: description !== undefined ? description : current[0].description,
        amountDzd: amountDzd !== undefined ? String(amountDzd) : current[0].amountDzd,
        expenseDate: expenseDate || current[0].expenseDate,
        paymentMethod: paymentMethod || current[0].paymentMethod,
        paidTo: paidTo !== undefined ? paidTo : current[0].paidTo,
        referenceNumber: referenceNumber !== undefined ? referenceNumber : current[0].referenceNumber,
        isPaid: isPaid !== undefined ? isPaid : current[0].isPaid,
        notes: notes !== undefined ? notes : current[0].notes,
      })
      .where(eq(expenses.id, req.params.id))
      .returning();

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'EXPENSE_UPDATED',
      entity: 'expenses',
      data: updated[0],
    });

    res.json(updated[0]);
  } catch (error: any) {
    console.error('Failed to update expense:', error);
    res.status(500).json({ error: error.message || 'Failed to update expense' });
  }
});

apiApp.delete('/api/expenses/:id', requireAuth, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    await db.delete(expenses).where(eq(expenses.id, req.params.id));
    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'EXPENSE_DELETED',
      entity: 'expenses',
      data: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// -------------------------------------------------------------
// 9. Dashboard & Analytical Reports
// -------------------------------------------------------------
apiApp.get('/api/reports/dashboard', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const allOrders = await db.select().from(orders);
    const allExpenses = await db.select().from(expenses);
    const allPurchases = await db.select().from(purchases);
    const allPayments = await db.select().from(payments);
    const allCustomers = await db.select().from(customers);
    const allSuppliers = await db.select().from(suppliers);
    const allMaterials = await db.select().from(materials);
    const allMovements = await db.select().from(stockMovements);
    const allUsage = await db.select().from(productionUsage);

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Current week Monday
    const dayOfWeek = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    const thisWeekStart = monday.toISOString().split('T')[0];

    // Current month start
    const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // Filtered orders by date range
    let filteredOrders = allOrders;
    let filteredExpenses = allExpenses;
    if (startDate && endDate) {
      filteredOrders = allOrders.filter((o) => o.orderDate >= String(startDate) && o.orderDate <= String(endDate));
      filteredExpenses = allExpenses.filter((e) => e.expenseDate >= String(startDate) && e.expenseDate <= String(endDate));
    }

    // Sales metrics
    const salesToday = allOrders
      .filter((o) => o.orderDate === today && o.status !== 'cancelled')
      .reduce((sum, o) => sum + parseFloat(o.totalAmountDzd || '0'), 0);

    const salesThisWeek = allOrders
      .filter((o) => o.orderDate >= thisWeekStart && o.status !== 'cancelled')
      .reduce((sum, o) => sum + parseFloat(o.totalAmountDzd || '0'), 0);

    const salesThisMonth = allOrders
      .filter((o) => o.orderDate >= thisMonthStart && o.status !== 'cancelled')
      .reduce((sum, o) => sum + parseFloat(o.totalAmountDzd || '0'), 0);

    const totalPeriodSales = filteredOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + parseFloat(o.totalAmountDzd || '0'), 0);

    // Orders by Status
    const ordersByStatus = {
      received: allOrders.filter((o) => o.status === 'new' || o.status === 'confirmed').length,
      inProduction: allOrders.filter((o) => o.status === 'in_production' || o.status === 'ready_for_printing').length,
      ready: allOrders.filter((o) => o.status === 'ready_for_delivery' || o.status === 'quality_check').length,
      delivered: allOrders.filter((o) => o.status === 'delivered').length,
      total: allOrders.length,
    };

    // Customer Outstanding Debts
    const customerReceipts = allPayments.filter((p) => p.paymentType === 'customer_receipt');
    const totalCustomerDebts = allCustomers.reduce((acc, c) => {
      const cOrders = allOrders.filter((o) => o.customerId === c.id && o.status !== 'cancelled');
      const cPays = customerReceipts.filter((p) => p.customerId === c.id);
      const sales = cOrders.reduce((sum, o) => sum + parseFloat(o.totalAmountDzd || '0'), 0);
      const paid = cPays.reduce((sum, p) => sum + parseFloat(p.amountDzd || '0'), 0);
      const opening = parseFloat(c.openingBalanceDzd || '0');
      const balance = opening + sales - paid;
      return acc + (balance > 0 ? balance : 0);
    }, 0);

    // Supplier Outstanding Debts
    const supplierPayments = allPayments.filter((p) => p.paymentType === 'supplier_payment');
    const totalSupplierDebts = allSuppliers.reduce((acc, s) => {
      const sPurchases = allPurchases.filter((p) => p.supplierId === s.id);
      const sPays = supplierPayments.filter((p) => p.supplierId === s.id);
      const purchTotal = sPurchases.reduce((sum, p) => sum + parseFloat(p.totalAmountDzd || '0'), 0);
      const paid = sPays.reduce((sum, p) => sum + parseFloat(p.amountDzd || '0'), 0);
      const opening = parseFloat(s.openingBalanceDzd || '0');
      const balance = opening + purchTotal - paid;
      return acc + (balance > 0 ? balance : 0);
    }, 0);

    // Expenses
    const expensesToday = allExpenses
      .filter((e) => e.expenseDate === today)
      .reduce((sum, e) => sum + parseFloat(e.amountDzd || '0'), 0);

    const expensesThisMonth = allExpenses
      .filter((e) => e.expenseDate >= thisMonthStart)
      .reduce((sum, e) => sum + parseFloat(e.amountDzd || '0'), 0);

    const totalPeriodExpenses = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amountDzd || '0'), 0);

    // Production Cost of Goods Sold (Materials Consumed)
    const matMap = new Map(allMaterials.map((m) => [m.id, m]));
    const totalCostOfMaterialsConsumed = allUsage.reduce((acc, u) => {
      const mat = matMap.get(u.materialId);
      const cost = mat ? parseFloat(mat.unitCostDzd || '0') : 0;
      const qty = parseFloat(u.quantityUsed || '0') + parseFloat(u.wasteQuantity || '0');
      return acc + qty * cost;
    }, 0);

    // Estimated Gross Profit & Net Operating Profit
    const estimatedGrossProfit = Math.max(0, totalPeriodSales - totalCostOfMaterialsConsumed);
    const estimatedNetProfit = estimatedGrossProfit - totalPeriodExpenses;

    // Inventory Valuation & Low Stock
    let totalInventoryValuation = 0;
    const stockMap: Record<string, number> = {};
    allMovements.forEach((m) => {
      if (!stockMap[m.materialId]) stockMap[m.materialId] = 0;
      stockMap[m.materialId] += parseFloat(m.quantityIn || '0') - parseFloat(m.quantityOut || '0');
    });

    const lowStockMaterials: any[] = [];
    allMaterials.forEach((m) => {
      const stock = stockMap[m.id] !== undefined ? Math.max(0, stockMap[m.id]) : parseFloat(m.openingStockPieces || m.openingStockKg || '0');
      const unitCost = parseFloat(m.unitCostDzd || '0');

      let itemValuation = 0;
      const piecesPerKg = parseFloat(m.piecesPerKg || '0');

      if (['ink', 'diluent', 'retarder'].includes(m.category) || m.trackingMode === 'kg' || m.stockUnit === 'kg') {
        itemValuation = stock * unitCost; // stock in kg * price per kg
      } else if (piecesPerKg > 0) {
        const stockWeightKg = stock / piecesPerKg; // weight in kg
        itemValuation = stockWeightKg * unitCost; // Price per Kg * current stock weight in Kg
      } else {
        itemValuation = stock * unitCost;
      }

      totalInventoryValuation += itemValuation;

      if (stock <= parseFloat(m.reorderThreshold || '0')) {
        lowStockMaterials.push({
          ...m,
          currentStock: stock,
        });
      }
    });

    // Monthly chart data (last 6 months)
    const monthlyDataMap: Record<string, { month: string; sales: number; expenses: number; purchases: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      monthlyDataMap[key] = { month: label, sales: 0, expenses: 0, purchases: 0 };
    }

    allOrders.forEach((o) => {
      if (o.status === 'cancelled') return;
      const key = o.orderDate.slice(0, 7);
      if (monthlyDataMap[key]) {
        monthlyDataMap[key].sales += parseFloat(o.totalAmountDzd || '0');
      }
    });

    allExpenses.forEach((e) => {
      const key = e.expenseDate.slice(0, 7);
      if (monthlyDataMap[key]) {
        monthlyDataMap[key].expenses += parseFloat(e.amountDzd || '0');
      }
    });

    allPurchases.forEach((p) => {
      const key = p.purchaseDate.slice(0, 7);
      if (monthlyDataMap[key]) {
        monthlyDataMap[key].purchases += parseFloat(p.totalAmountDzd || '0');
      }
    });

    const monthlyTrends = Object.values(monthlyDataMap);

    // Top Customers by sales
    const custSalesMap: Record<string, { customerId: string; name: string; totalSales: number; orderCount: number }> = {};
    allOrders.forEach((o) => {
      if (o.status === 'cancelled') return;
      const id = o.customerId || 'walk_in';
      if (!custSalesMap[id]) {
        custSalesMap[id] = { customerId: id, name: o.customerName, totalSales: 0, orderCount: 0 };
      }
      custSalesMap[id].totalSales += parseFloat(o.totalAmountDzd || '0');
      custSalesMap[id].orderCount += 1;
    });

    const topCustomers = Object.values(custSalesMap)
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 5);

    // Recent Activity (Orders, Payments, Purchases, Expenses)
    const recentOrders = allOrders.slice(0, 5);
    const recentPayments = allPayments.slice(0, 5);
    const recentPurchases = allPurchases.slice(0, 5);
    const recentExpenses = allExpenses.slice(0, 5);

    res.json({
      sales: {
        today: salesToday,
        thisWeek: salesThisWeek,
        thisMonth: salesThisMonth,
        periodTotal: totalPeriodSales,
      },
      ordersByStatus,
      debts: {
        customerOutstanding: Number(totalCustomerDebts.toFixed(2)),
        supplierOutstanding: Number(totalSupplierDebts.toFixed(2)),
      },
      expenses: {
        today: expensesToday,
        thisMonth: expensesThisMonth,
        periodTotal: totalPeriodExpenses,
      },
      profit: {
        salesRevenue: totalPeriodSales,
        materialsConsumedCost: Number(totalCostOfMaterialsConsumed.toFixed(2)),
        estimatedGrossProfit: Number(estimatedGrossProfit.toFixed(2)),
        operatingExpenses: totalPeriodExpenses,
        estimatedNetProfit: Number(estimatedNetProfit.toFixed(2)),
      },
      inventory: {
        totalValuation: Number(totalInventoryValuation.toFixed(2)),
        lowStockMaterials,
      },
      monthlyTrends,
      topCustomers,
      recent: {
        orders: recentOrders,
        payments: recentPayments,
        purchases: recentPurchases,
        expenses: recentExpenses,
      },
    });
  } catch (error: any) {
    console.error('Failed to compile dashboard reports:', error);
    res.status(500).json({ error: 'Failed to generate dashboard analytics' });
  }
});

// -------------------------------------------------------------
// 17. Global Undo System (Rollback for latest operations)
// -------------------------------------------------------------
apiApp.get('/api/undo/history', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureUndoOperationsTable();
    await cleanupOldUndoOperations();
    const list = await db
      .select()
      .from(undoOperations)
      .orderBy(desc(undoOperations.timestamp))
      .limit(100);
    res.json(list);
  } catch (error: any) {
    console.error('Failed to get undo history:', error);
    res.status(500).json({ error: 'Failed to retrieve undo history' });
  }
});

apiApp.post('/api/undo/:id', requireAuth, requireOwnerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureUndoOperationsTable();
    const target = await db
      .select()
      .from(undoOperations)
      .where(eq(undoOperations.id, req.params.id))
      .limit(1);

    if (!target.length) {
      return res.status(404).json({ error: 'Opération introuvable dans l\'historique d\'annulation.' });
    }

    const op = target[0];
    if (op.isUndone) {
      return res.status(400).json({ error: 'Cette opération a déjà été annulée.' });
    }

    let snap: any = {};
    try {
      snap = JSON.parse(op.snapshot);
    } catch {
      return res.status(500).json({ error: 'Données de restauration invalides ou corrompues.' });
    }

    // 1. Material rollback
    if (op.entityType === 'material') {
      if (op.actionType === 'delete') {
        const mat = snap.material || snap;
        await db.insert(materials).values({
          id: mat.id,
          code: mat.code,
          name: mat.name,
          category: mat.category,
          description: mat.description || '',
          trackingMode: mat.trackingMode || 'units',
          purchaseUnit: mat.purchaseUnit || 'kg',
          stockUnit: mat.stockUnit || 'piece',
          piecesPerKg: mat.piecesPerKg ? String(mat.piecesPerKg) : '0',
          reorderThreshold: mat.reorderThreshold ? String(mat.reorderThreshold) : '0',
          unitCostDzd: mat.unitCostDzd ? String(mat.unitCostDzd) : '0',
          openingStockKg: mat.openingStockKg ? String(mat.openingStockKg) : '0',
          openingStockPieces: mat.openingStockPieces ? String(mat.openingStockPieces) : '0',
          isActive: mat.isActive ?? true,
        }).onConflictDoUpdate({
          target: materials.id,
          set: { isActive: true },
        });

        if (snap.movements && Array.isArray(snap.movements)) {
          for (const mv of snap.movements) {
            await db.insert(stockMovements).values({
              id: mv.id || genId(),
              materialId: mat.id,
              movementType: mv.movementType || 'opening_balance',
              quantityIn: String(mv.quantityIn || '0'),
              quantityOut: String(mv.quantityOut || '0'),
              unit: mv.unit || mat.stockUnit,
              referenceType: mv.referenceType || 'undo_restore',
              referenceId: mv.referenceId || 'RESTORE',
              unitCostDzd: mv.unitCostDzd || mat.unitCostDzd,
              userId: req.user?.uid || '',
              userName: req.user?.name || 'Admin',
              notes: `Restauration suite annulation suppression matière (${mat.name})`,
            }).onConflictDoNothing();
          }
        }

        if (snap.purchaseItems && Array.isArray(snap.purchaseItems)) {
          for (const pi of snap.purchaseItems) {
            await db.insert(purchaseItems).values(pi).onConflictDoNothing();
          }
        }
        if (snap.productionUsage && Array.isArray(snap.productionUsage)) {
          for (const pu of snap.productionUsage) {
            await db.insert(productionUsage).values(pu).onConflictDoNothing();
          }
        }
      } else if (op.actionType === 'update') {
        const mat = snap.material || snap;
        await db.update(materials).set({
          code: mat.code,
          name: mat.name,
          category: mat.category,
          description: mat.description || '',
          trackingMode: mat.trackingMode,
          purchaseUnit: mat.purchaseUnit,
          stockUnit: mat.stockUnit,
          piecesPerKg: mat.piecesPerKg ? String(mat.piecesPerKg) : '0',
          reorderThreshold: mat.reorderThreshold ? String(mat.reorderThreshold) : '0',
          unitCostDzd: mat.unitCostDzd ? String(mat.unitCostDzd) : '0',
          openingStockKg: mat.openingStockKg ? String(mat.openingStockKg) : '0',
          openingStockPieces: mat.openingStockPieces ? String(mat.openingStockPieces) : '0',
          isActive: mat.isActive ?? true,
        }).where(eq(materials.id, mat.id));
      }
    }

    // 2. Materials bulk delete rollback
    else if (op.entityType === 'materials' && op.actionType === 'bulk_delete') {
      const matList = snap.materials || [];
      for (const mat of matList) {
        await db.insert(materials).values({
          id: mat.id,
          code: mat.code,
          name: mat.name,
          category: mat.category,
          description: mat.description || '',
          trackingMode: mat.trackingMode || 'units',
          purchaseUnit: mat.purchaseUnit || 'kg',
          stockUnit: mat.stockUnit || 'piece',
          piecesPerKg: mat.piecesPerKg ? String(mat.piecesPerKg) : '0',
          reorderThreshold: mat.reorderThreshold ? String(mat.reorderThreshold) : '0',
          unitCostDzd: mat.unitCostDzd ? String(mat.unitCostDzd) : '0',
          openingStockKg: mat.openingStockKg ? String(mat.openingStockKg) : '0',
          openingStockPieces: mat.openingStockPieces ? String(mat.openingStockPieces) : '0',
          isActive: mat.isActive ?? true,
        }).onConflictDoUpdate({
          target: materials.id,
          set: { isActive: true },
        });
      }
      if (snap.movements && Array.isArray(snap.movements)) {
        for (const mv of snap.movements) {
          await db.insert(stockMovements).values({
            id: mv.id || genId(),
            materialId: mv.materialId,
            movementType: mv.movementType || 'opening_balance',
            quantityIn: String(mv.quantityIn || '0'),
            quantityOut: String(mv.quantityOut || '0'),
            unit: mv.unit || 'piece',
            referenceType: mv.referenceType || 'undo_restore',
            referenceId: mv.referenceId || 'RESTORE',
            unitCostDzd: mv.unitCostDzd || '0',
            userId: req.user?.uid || '',
            userName: req.user?.name || 'Admin',
            notes: mv.notes || 'Restauration suite annulation suppression en masse des matières',
          }).onConflictDoNothing();
        }
      }
      if (snap.purchaseItems && Array.isArray(snap.purchaseItems)) {
        for (const pi of snap.purchaseItems) {
          await db.insert(purchaseItems).values(pi).onConflictDoNothing();
        }
      }
      if (snap.productionUsage && Array.isArray(snap.productionUsage)) {
        for (const pu of snap.productionUsage) {
          await db.insert(productionUsage).values(pu).onConflictDoNothing();
        }
      }
    }

    // 3. Purchase single rollback
    else if (op.entityType === 'purchase') {
      const p = snap.purchase || snap;
      if (op.actionType === 'delete') {
        await db.insert(purchases).values({
          id: p.id,
          purchaseNumber: p.purchaseNumber,
          supplierId: p.supplierId,
          invoiceNumber: p.invoiceNumber || '',
          purchaseDate: p.purchaseDate,
          subtotalDzd: p.subtotalDzd || '0',
          freightCostDzd: p.freightCostDzd || '0',
          totalAmountDzd: p.totalAmountDzd || '0',
          amountPaidDzd: p.amountPaidDzd || '0',
          paymentStatus: p.paymentStatus || 'unpaid',
          receiptStatus: p.receiptStatus || 'pending',
          notes: p.notes || '',
          createdBy: p.createdBy,
          createdByName: p.createdByName,
          createdByRole: p.createdByRole,
        }).onConflictDoNothing();

        if (snap.items && Array.isArray(snap.items)) {
          for (const it of snap.items) {
            await db.insert(purchaseItems).values({
              id: it.id || genId(),
              purchaseId: p.id,
              materialId: it.materialId,
              quantity: String(it.quantity || '0'),
              purchaseUnit: it.purchaseUnit || 'kg',
              receivedKg: String(it.receivedKg || it.quantity || '0'),
              receivedPieces: String(it.receivedPieces || '0'),
              unitCostDzd: String(it.unitCostDzd || '0'),
              totalCostDzd: String(it.totalCostDzd || '0'),
            }).onConflictDoNothing();
          }
        }

        if (snap.logs && Array.isArray(snap.logs)) {
          for (const l of snap.logs) {
            await db.insert(purchaseLogs).values({
              id: l.id || genId(),
              purchaseId: p.id,
              userId: l.userId || '',
              userName: l.userName || 'System',
              userRole: l.userRole || 'owner',
              action: l.action || 'Restauration',
              modification: l.modification || 'Bon d\'achat restauré',
            }).onConflictDoNothing();
          }
        }

        await db.insert(purchaseLogs).values({
          id: genId(),
          purchaseId: p.id,
          userId: req.user?.uid || '',
          userName: req.user?.name || 'Admin',
          userRole: req.userRole || 'owner',
          action: 'Annulation / Undo',
          modification: `Bon d'achat ${p.purchaseNumber} restauré suite à l'annulation de la suppression`,
        });
      } else if (op.actionType === 'update') {
        await db.update(purchases).set({
          supplierId: p.supplierId,
          invoiceNumber: p.invoiceNumber,
          purchaseDate: p.purchaseDate,
          subtotalDzd: p.subtotalDzd,
          freightCostDzd: p.freightCostDzd,
          totalAmountDzd: p.totalAmountDzd,
          amountPaidDzd: p.amountPaidDzd,
          paymentStatus: p.paymentStatus,
          notes: p.notes,
        }).where(eq(purchases.id, p.id));

        if (snap.items && Array.isArray(snap.items)) {
          await db.delete(purchaseItems).where(eq(purchaseItems.purchaseId, p.id));
          for (const it of snap.items) {
            await db.insert(purchaseItems).values({
              id: it.id || genId(),
              purchaseId: p.id,
              materialId: it.materialId,
              quantity: String(it.quantity || '0'),
              purchaseUnit: it.purchaseUnit || 'kg',
              receivedKg: String(it.receivedKg || it.quantity || '0'),
              receivedPieces: String(it.receivedPieces || '0'),
              unitCostDzd: String(it.unitCostDzd || '0'),
              totalCostDzd: String(it.totalCostDzd || '0'),
            });
          }
        }

        await db.insert(purchaseLogs).values({
          id: genId(),
          purchaseId: p.id,
          userId: req.user?.uid || '',
          userName: req.user?.name || 'Admin',
          userRole: req.userRole || 'owner',
          action: 'Annulation / Undo',
          modification: `Modifications annulées (Revert vers l'état antérieur)`,
        });
      }
    }

    // 4. Purchases bulk delete rollback
    else if (op.entityType === 'purchases' && op.actionType === 'bulk_delete') {
      const pList = snap.purchases || [];
      for (const item of pList) {
        const p = item.purchase || item;
        await db.insert(purchases).values({
          id: p.id,
          purchaseNumber: p.purchaseNumber,
          supplierId: p.supplierId,
          invoiceNumber: p.invoiceNumber || '',
          purchaseDate: p.purchaseDate,
          subtotalDzd: p.subtotalDzd || '0',
          freightCostDzd: p.freightCostDzd || '0',
          totalAmountDzd: p.totalAmountDzd || '0',
          amountPaidDzd: p.amountPaidDzd || '0',
          paymentStatus: p.paymentStatus || 'unpaid',
          receiptStatus: p.receiptStatus || 'pending',
          notes: p.notes || '',
          createdBy: p.createdBy,
          createdByName: p.createdByName,
          createdByRole: p.createdByRole,
        }).onConflictDoNothing();

        if (item.items && Array.isArray(item.items)) {
          for (const it of item.items) {
            await db.insert(purchaseItems).values(it).onConflictDoNothing();
          }
        }

        if (item.logs && Array.isArray(item.logs)) {
          for (const l of item.logs) {
            await db.insert(purchaseLogs).values(l).onConflictDoNothing();
          }
        }
      }
    }

    // 5. Supplier single rollback
    else if (op.entityType === 'supplier') {
      const s = snap.supplier || snap;
      if (op.actionType === 'delete') {
        await db.insert(suppliers).values({
          id: s.id,
          code: s.code,
          name: s.name,
          contactPerson: s.contactPerson || '',
          phone: s.phone || '',
          address: s.address || '',
          openingBalanceDzd: s.openingBalanceDzd || '0',
          notes: s.notes || '',
          isActive: true,
        }).onConflictDoUpdate({
          target: suppliers.id,
          set: { isActive: true },
        });

        if (snap.detachedPurchaseIds && Array.isArray(snap.detachedPurchaseIds)) {
          for (const pid of snap.detachedPurchaseIds) {
            await db.update(purchases).set({ supplierId: s.id }).where(eq(purchases.id, pid));
          }
        }
        if (snap.detachedPaymentIds && Array.isArray(snap.detachedPaymentIds)) {
          for (const payId of snap.detachedPaymentIds) {
            await db.update(payments).set({ supplierId: s.id }).where(eq(payments.id, payId));
          }
        }
      } else if (op.actionType === 'update') {
        await db.update(suppliers).set({
          code: s.code,
          name: s.name,
          contactPerson: s.contactPerson || '',
          phone: s.phone || '',
          address: s.address || '',
          openingBalanceDzd: s.openingBalanceDzd || '0',
          notes: s.notes || '',
          isActive: s.isActive ?? true,
        }).where(eq(suppliers.id, s.id));
      }
    }

    // 6. Suppliers bulk delete rollback
    else if (op.entityType === 'suppliers' && op.actionType === 'bulk_delete') {
      const sList = snap.suppliers || [];
      for (const s of sList) {
        await db.insert(suppliers).values({
          id: s.id,
          code: s.code,
          name: s.name,
          contactPerson: s.contactPerson || '',
          phone: s.phone || '',
          address: s.address || '',
          openingBalanceDzd: s.openingBalanceDzd || '0',
          notes: s.notes || '',
          isActive: true,
        }).onConflictDoUpdate({
          target: suppliers.id,
          set: { isActive: true },
        });
      }

      if (snap.detachedPurchases && Array.isArray(snap.detachedPurchases)) {
        for (const dp of snap.detachedPurchases) {
          if (dp.supplierId) {
            await db.update(purchases).set({ supplierId: dp.supplierId }).where(eq(purchases.id, dp.purchaseId));
          }
        }
      }
      if (snap.detachedPayments && Array.isArray(snap.detachedPayments)) {
        for (const pay of snap.detachedPayments) {
          if (pay.supplierId) {
            await db.update(payments).set({ supplierId: pay.supplierId }).where(eq(payments.id, pay.paymentId));
          }
        }
      }
    }

    // 7. Order single delete or update rollback
    else if (op.entityType === 'order') {
      const o = snap.order;
      if (o) {
        if (op.actionType === 'delete') {
          await db.insert(orders).values({
            id: o.id,
            orderNumber: o.orderNumber,
            customerId: o.customerId || null,
            customerName: o.customerName,
            orderDate: o.orderDate,
            dueDate: o.dueDate || '',
            status: o.status || 'new',
            channel: o.channel || 'whatsapp',
            subtotalDzd: o.subtotalDzd || '0',
            discountDzd: o.discountDzd || '0',
            deliveryFeeDzd: o.deliveryFeeDzd || '0',
            totalAmountDzd: o.totalAmountDzd || '0',
            amountPaidDzd: o.amountPaidDzd || '0',
            deliveryDate: o.deliveryDate || '',
            notes: o.notes || '',
            createdBy: o.createdBy || null,
            createdByName: o.createdByName || '',
            createdByRole: o.createdByRole || '',
            createdAt: o.createdAt ? new Date(o.createdAt) : new Date(),
          }).onConflictDoUpdate({
            target: orders.id,
            set: {
              customerName: o.customerName,
              dueDate: o.dueDate || '',
              status: o.status || 'new',
              channel: o.channel || 'whatsapp',
              subtotalDzd: o.subtotalDzd || '0',
              discountDzd: o.discountDzd || '0',
              deliveryFeeDzd: o.deliveryFeeDzd || '0',
              totalAmountDzd: o.totalAmountDzd || '0',
              amountPaidDzd: o.amountPaidDzd || '0',
              notes: o.notes || '',
            },
          });

          if (snap.items && Array.isArray(snap.items)) {
            for (const item of snap.items) {
              await db.insert(orderItems).values(item).onConflictDoNothing();
            }
          }
          if (snap.logs && Array.isArray(snap.logs)) {
            for (const log of snap.logs) {
              await db.insert(orderLogs).values(log).onConflictDoNothing();
            }
          }
          if (snap.allocations && Array.isArray(snap.allocations)) {
            for (const alloc of snap.allocations) {
              await db.insert(paymentAllocations).values(alloc).onConflictDoNothing();
            }
          }
          if (snap.productionRecords && Array.isArray(snap.productionRecords)) {
            for (const pr of snap.productionRecords) {
              await db.insert(productionRecords).values(pr).onConflictDoNothing();
            }
          }
          if (snap.productionUsage && Array.isArray(snap.productionUsage)) {
            for (const pu of snap.productionUsage) {
              await db.insert(productionUsage).values(pu).onConflictDoNothing();
            }
          }
        } else if (op.actionType === 'update') {
          await db.update(orders).set({
            customerId: o.customerId || null,
            customerName: o.customerName,
            dueDate: o.dueDate || '',
            status: o.status || 'new',
            channel: o.channel || 'whatsapp',
            subtotalDzd: o.subtotalDzd || '0',
            discountDzd: o.discountDzd || '0',
            deliveryFeeDzd: o.deliveryFeeDzd || '0',
            totalAmountDzd: o.totalAmountDzd || '0',
            amountPaidDzd: o.amountPaidDzd || '0',
            notes: o.notes || '',
          }).where(eq(orders.id, o.id));

          if (snap.items && Array.isArray(snap.items)) {
            await db.delete(orderItems).where(eq(orderItems.orderId, o.id));
            for (const item of snap.items) {
              await db.insert(orderItems).values(item);
            }
          }
        }
      }
    }

    // 8. Orders bulk delete rollback
    else if (op.entityType === 'orders' && op.actionType === 'bulk_delete') {
      const oList = snap.orders || [];
      for (const o of oList) {
        await db.insert(orders).values({
          id: o.id,
          orderNumber: o.orderNumber,
          customerId: o.customerId || null,
          customerName: o.customerName,
          orderDate: o.orderDate,
          dueDate: o.dueDate || '',
          status: o.status || 'new',
          channel: o.channel || 'whatsapp',
          subtotalDzd: o.subtotalDzd || '0',
          discountDzd: o.discountDzd || '0',
          deliveryFeeDzd: o.deliveryFeeDzd || '0',
          totalAmountDzd: o.totalAmountDzd || '0',
          amountPaidDzd: o.amountPaidDzd || '0',
          deliveryDate: o.deliveryDate || '',
          notes: o.notes || '',
          createdBy: o.createdBy || null,
          createdByName: o.createdByName || '',
          createdByRole: o.createdByRole || '',
          createdAt: o.createdAt ? new Date(o.createdAt) : new Date(),
        }).onConflictDoNothing();
      }

      if (snap.items && Array.isArray(snap.items)) {
        for (const item of snap.items) {
          await db.insert(orderItems).values(item).onConflictDoNothing();
        }
      }
      if (snap.logs && Array.isArray(snap.logs)) {
        for (const log of snap.logs) {
          await db.insert(orderLogs).values(log).onConflictDoNothing();
        }
      }
      if (snap.allocations && Array.isArray(snap.allocations)) {
        for (const alloc of snap.allocations) {
          await db.insert(paymentAllocations).values(alloc).onConflictDoNothing();
        }
      }
      if (snap.productionRecords && Array.isArray(snap.productionRecords)) {
        for (const pr of snap.productionRecords) {
          await db.insert(productionRecords).values(pr).onConflictDoNothing();
        }
      }
      if (snap.productionUsage && Array.isArray(snap.productionUsage)) {
        for (const pu of snap.productionUsage) {
          await db.insert(productionUsage).values(pu).onConflictDoNothing();
        }
      }
    }

    // 9. Stock movement rollback (revert manual adjustment)
    else if (op.entityType === 'stock_movement') {
      await db.delete(stockMovements).where(eq(stockMovements.id, op.entityId));
    }

    // 10. Production record single delete or update rollback
    else if (op.entityType === 'production') {
      const pr = snap.production;
      if (pr) {
        if (op.actionType === 'delete') {
          await db.insert(productionRecords).values(pr).onConflictDoNothing();
          if (snap.usage && Array.isArray(snap.usage)) {
            for (const u of snap.usage) {
              await db.insert(productionUsage).values(u).onConflictDoNothing();
              const qtyUsed = parseFloat(u.quantityUsed || '0');
              const wasteQty = parseFloat(u.wasteQuantity || '0');
              if (qtyUsed > 0) {
                await db.insert(stockMovements).values({
                  id: genId(),
                  materialId: u.materialId,
                  movementType: 'production_consumption',
                  quantityIn: '0',
                  quantityOut: String(qtyUsed),
                  unit: u.unit || 'piece',
                  referenceType: 'production',
                  referenceId: pr.productionNumber,
                  unitCostDzd: '0',
                  userId: await resolveValidProfileId(req.user?.uid),
                  userName: op.performedBy || 'System',
                  notes: `Restored consumption for ${pr.productionNumber} (Undo)`,
                });
              }
              if (wasteQty > 0) {
                await db.insert(stockMovements).values({
                  id: genId(),
                  materialId: u.materialId,
                  movementType: 'production_waste',
                  quantityIn: '0',
                  quantityOut: String(wasteQty),
                  unit: u.unit || 'piece',
                  referenceType: 'production',
                  referenceId: pr.productionNumber,
                  unitCostDzd: '0',
                  userId: await resolveValidProfileId(req.user?.uid),
                  userName: op.performedBy || 'System',
                  notes: `Restored waste for ${pr.productionNumber} (Undo)`,
                });
              }
            }
          }
          if (snap.logs && Array.isArray(snap.logs)) {
            for (const log of snap.logs) {
              await db.insert(productionLogs).values(log).onConflictDoNothing();
            }
          }
          await db.insert(productionLogs).values({
            id: genId(),
            productionId: pr.id,
            userId: await resolveValidProfileId(req.user?.uid),
            userName: req.user?.name || op.performedBy || 'Staff',
            userRole: req.userRole || op.performedByRole || 'staff',
            action: 'Restauration (Undo)',
            modification: `Restauration de la fiche de production ${pr.productionNumber} après suppression`,
          });
        } else if (op.actionType === 'update') {
          await db.update(productionRecords).set({
            plannedQuantity: pr.plannedQuantity,
            completedQuantity: pr.completedQuantity,
            rejectedQuantity: pr.rejectedQuantity,
            workerName: pr.workerName,
            status: pr.status,
            notes: pr.notes,
          }).where(eq(productionRecords.id, pr.id));

          await db.delete(stockMovements).where(and(eq(stockMovements.referenceType, 'production'), eq(stockMovements.referenceId, pr.productionNumber)));
          await db.delete(productionUsage).where(eq(productionUsage.productionId, pr.id));

          if (snap.usage && Array.isArray(snap.usage)) {
            for (const u of snap.usage) {
              await db.insert(productionUsage).values(u);
              const qtyUsed = parseFloat(u.quantityUsed || '0');
              const wasteQty = parseFloat(u.wasteQuantity || '0');
              if (qtyUsed > 0) {
                await db.insert(stockMovements).values({
                  id: genId(),
                  materialId: u.materialId,
                  movementType: 'production_consumption',
                  quantityIn: '0',
                  quantityOut: String(qtyUsed),
                  unit: u.unit || 'piece',
                  referenceType: 'production',
                  referenceId: pr.productionNumber,
                  unitCostDzd: '0',
                  userId: await resolveValidProfileId(req.user?.uid),
                  userName: op.performedBy || 'Staff',
                  notes: `Reverted consumption for ${pr.productionNumber} (Undo)`,
                });
              }
              if (wasteQty > 0) {
                await db.insert(stockMovements).values({
                  id: genId(),
                  materialId: u.materialId,
                  movementType: 'production_waste',
                  quantityIn: '0',
                  quantityOut: String(wasteQty),
                  unit: u.unit || 'piece',
                  referenceType: 'production',
                  referenceId: pr.productionNumber,
                  unitCostDzd: '0',
                  userId: await resolveValidProfileId(req.user?.uid),
                  userName: op.performedBy || 'Staff',
                  notes: `Reverted waste for ${pr.productionNumber} (Undo)`,
                });
              }
            }
          }

          await db.insert(productionLogs).values({
            id: genId(),
            productionId: pr.id,
            userId: await resolveValidProfileId(req.user?.uid),
            userName: req.user?.name || op.performedBy || 'Staff',
            userRole: req.userRole || op.performedByRole || 'staff',
            action: 'Restauration (Undo)',
            modification: `Rétablissement des valeurs antérieures suite à l'annulation (Undo)`,
          });
        }
      }
    }

    // Mark operation as undone
    await db
      .update(undoOperations)
      .set({ isUndone: true })
      .where(eq(undoOperations.id, op.id));

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'UNDO_EXECUTED',
      entity: op.entityType,
      data: { id: op.id, description: op.description },
    });

    res.json({
      success: true,
      message: `Action annulée avec succès : "${op.description}" a été restaurée.`,
      operation: op,
    });
  } catch (error: any) {
    console.error('Failed to execute undo:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de l\'annulation de l\'opération' });
  }
});

// Quick Undo Latest Operation
apiApp.post('/api/undo/latest', requireAuth, requireOwnerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureUndoOperationsTable();
    const latest = await db
      .select()
      .from(undoOperations)
      .where(eq(undoOperations.isUndone, false))
      .orderBy(desc(undoOperations.timestamp))
      .limit(1);

    if (!latest.length) {
      return res.status(404).json({ error: 'Aucune opération récente à annuler.' });
    }

    const op = latest[0];
    let snap: any = {};
    try {
      snap = JSON.parse(op.snapshot);
    } catch {
      return res.status(500).json({ error: 'Données de restauration invalides.' });
    }

    // Material rollback
    if (op.entityType === 'material') {
      if (op.actionType === 'delete') {
        const mat = snap.material || snap;
        await db.insert(materials).values(mat).onConflictDoUpdate({
          target: materials.id,
          set: { isActive: true },
        });
      } else if (op.actionType === 'update') {
        const mat = snap.material || snap;
        await db.update(materials).set(mat).where(eq(materials.id, mat.id));
      }
    }
    // Purchase rollback
    else if (op.entityType === 'purchase') {
      const p = snap.purchase || snap;
      if (op.actionType === 'delete') {
        await db.insert(purchases).values(p).onConflictDoNothing();
        if (snap.items && Array.isArray(snap.items)) {
          for (const it of snap.items) {
            await db.insert(purchaseItems).values(it).onConflictDoNothing();
          }
        }
      } else if (op.actionType === 'update') {
        await db.update(purchases).set(p).where(eq(purchases.id, p.id));
      }
    }
    // Supplier rollback
    else if (op.entityType === 'supplier') {
      const s = snap.supplier || snap;
      if (op.actionType === 'delete') {
        await db.insert(suppliers).values(s).onConflictDoUpdate({
          target: suppliers.id,
          set: { isActive: true },
        });
      } else if (op.actionType === 'update') {
        await db.update(suppliers).set(s).where(eq(suppliers.id, s.id));
      }
    }
    // Order rollback
    else if (op.entityType === 'order') {
      const o = snap.order || snap;
      if (op.actionType === 'delete') {
        await db.insert(orders).values({
          id: o.id,
          orderNumber: o.orderNumber,
          customerId: o.customerId || null,
          customerName: o.customerName,
          orderDate: o.orderDate,
          dueDate: o.dueDate || '',
          status: o.status || 'new',
          channel: o.channel || 'whatsapp',
          subtotalDzd: o.subtotalDzd || '0',
          discountDzd: o.discountDzd || '0',
          deliveryFeeDzd: o.deliveryFeeDzd || '0',
          totalAmountDzd: o.totalAmountDzd || '0',
          amountPaidDzd: o.amountPaidDzd || '0',
          deliveryDate: o.deliveryDate || '',
          notes: o.notes || '',
          createdBy: o.createdBy || null,
          createdByName: o.createdByName || '',
          createdByRole: o.createdByRole || '',
          createdAt: o.createdAt ? new Date(o.createdAt) : new Date(),
        }).onConflictDoNothing();

        if (snap.items && Array.isArray(snap.items)) {
          for (const item of snap.items) {
            await db.insert(orderItems).values(item).onConflictDoNothing();
          }
        }
        if (snap.logs && Array.isArray(snap.logs)) {
          for (const log of snap.logs) {
            await db.insert(orderLogs).values(log).onConflictDoNothing();
          }
        }
        if (snap.allocations && Array.isArray(snap.allocations)) {
          for (const alloc of snap.allocations) {
            await db.insert(paymentAllocations).values(alloc).onConflictDoNothing();
          }
        }
        if (snap.productionRecords && Array.isArray(snap.productionRecords)) {
          for (const pr of snap.productionRecords) {
            await db.insert(productionRecords).values(pr).onConflictDoNothing();
          }
        }
        if (snap.productionUsage && Array.isArray(snap.productionUsage)) {
          for (const pu of snap.productionUsage) {
            await db.insert(productionUsage).values(pu).onConflictDoNothing();
          }
        }
      } else if (op.actionType === 'update') {
        await db.update(orders).set({
          customerId: o.customerId || null,
          customerName: o.customerName,
          dueDate: o.dueDate || '',
          status: o.status || 'new',
          channel: o.channel || 'whatsapp',
          subtotalDzd: o.subtotalDzd || '0',
          discountDzd: o.discountDzd || '0',
          deliveryFeeDzd: o.deliveryFeeDzd || '0',
          totalAmountDzd: o.totalAmountDzd || '0',
          amountPaidDzd: o.amountPaidDzd || '0',
          notes: o.notes || '',
        }).where(eq(orders.id, o.id));

        if (snap.items && Array.isArray(snap.items)) {
          await db.delete(orderItems).where(eq(orderItems.orderId, o.id));
          for (const item of snap.items) {
            await db.insert(orderItems).values(item);
          }
        }
      }
    }
    // Orders bulk delete rollback
    else if (op.entityType === 'orders' && op.actionType === 'bulk_delete') {
      const oList = snap.orders || [];
      for (const o of oList) {
        await db.insert(orders).values({
          id: o.id,
          orderNumber: o.orderNumber,
          customerId: o.customerId || null,
          customerName: o.customerName,
          orderDate: o.orderDate,
          dueDate: o.dueDate || '',
          status: o.status || 'new',
          channel: o.channel || 'whatsapp',
          subtotalDzd: o.subtotalDzd || '0',
          discountDzd: o.discountDzd || '0',
          deliveryFeeDzd: o.deliveryFeeDzd || '0',
          totalAmountDzd: o.totalAmountDzd || '0',
          amountPaidDzd: o.amountPaidDzd || '0',
          deliveryDate: o.deliveryDate || '',
          notes: o.notes || '',
          createdBy: o.createdBy || null,
          createdByName: o.createdByName || '',
          createdByRole: o.createdByRole || '',
          createdAt: o.createdAt ? new Date(o.createdAt) : new Date(),
        }).onConflictDoNothing();
      }

      if (snap.items && Array.isArray(snap.items)) {
        for (const item of snap.items) {
          await db.insert(orderItems).values(item).onConflictDoNothing();
        }
      }
      if (snap.logs && Array.isArray(snap.logs)) {
        for (const log of snap.logs) {
          await db.insert(orderLogs).values(log).onConflictDoNothing();
        }
      }
      if (snap.allocations && Array.isArray(snap.allocations)) {
        for (const alloc of snap.allocations) {
          await db.insert(paymentAllocations).values(alloc).onConflictDoNothing();
        }
      }
      if (snap.productionRecords && Array.isArray(snap.productionRecords)) {
        for (const pr of snap.productionRecords) {
          await db.insert(productionRecords).values(pr).onConflictDoNothing();
        }
      }
      if (snap.productionUsage && Array.isArray(snap.productionUsage)) {
        for (const pu of snap.productionUsage) {
          await db.insert(productionUsage).values(pu).onConflictDoNothing();
        }
      }
    }
    // Stock movement rollback
    else if (op.entityType === 'stock_movement') {
      await db.delete(stockMovements).where(eq(stockMovements.id, op.entityId));
    }
    // Production record single delete or update rollback
    else if (op.entityType === 'production') {
      const pr = snap.production;
      if (pr) {
        if (op.actionType === 'delete') {
          await db.insert(productionRecords).values(pr).onConflictDoNothing();
          if (snap.usage && Array.isArray(snap.usage)) {
            for (const u of snap.usage) {
              await db.insert(productionUsage).values(u).onConflictDoNothing();
              const qtyUsed = parseFloat(u.quantityUsed || '0');
              const wasteQty = parseFloat(u.wasteQuantity || '0');
              if (qtyUsed > 0) {
                await db.insert(stockMovements).values({
                  id: genId(),
                  materialId: u.materialId,
                  movementType: 'production_consumption',
                  quantityIn: '0',
                  quantityOut: String(qtyUsed),
                  unit: u.unit || 'piece',
                  referenceType: 'production',
                  referenceId: pr.productionNumber,
                  unitCostDzd: '0',
                  userId: await resolveValidProfileId(req.user?.uid),
                  userName: op.performedBy || 'System',
                  notes: `Restored consumption for ${pr.productionNumber} (Undo)`,
                });
              }
              if (wasteQty > 0) {
                await db.insert(stockMovements).values({
                  id: genId(),
                  materialId: u.materialId,
                  movementType: 'production_waste',
                  quantityIn: '0',
                  quantityOut: String(wasteQty),
                  unit: u.unit || 'piece',
                  referenceType: 'production',
                  referenceId: pr.productionNumber,
                  unitCostDzd: '0',
                  userId: await resolveValidProfileId(req.user?.uid),
                  userName: op.performedBy || 'System',
                  notes: `Restored waste for ${pr.productionNumber} (Undo)`,
                });
              }
            }
          }
          if (snap.logs && Array.isArray(snap.logs)) {
            for (const log of snap.logs) {
              await db.insert(productionLogs).values(log).onConflictDoNothing();
            }
          }
          await db.insert(productionLogs).values({
            id: genId(),
            productionId: pr.id,
            userId: await resolveValidProfileId(req.user?.uid),
            userName: req.user?.name || op.performedBy || 'Staff',
            userRole: req.userRole || op.performedByRole || 'staff',
            action: 'Restauration (Undo)',
            modification: `Restauration de la fiche de production ${pr.productionNumber} après suppression`,
          });
        } else if (op.actionType === 'update') {
          await db.update(productionRecords).set({
            plannedQuantity: pr.plannedQuantity,
            completedQuantity: pr.completedQuantity,
            rejectedQuantity: pr.rejectedQuantity,
            workerName: pr.workerName,
            status: pr.status,
            notes: pr.notes,
          }).where(eq(productionRecords.id, pr.id));

          await db.delete(stockMovements).where(and(eq(stockMovements.referenceType, 'production'), eq(stockMovements.referenceId, pr.productionNumber)));
          await db.delete(productionUsage).where(eq(productionUsage.productionId, pr.id));

          if (snap.usage && Array.isArray(snap.usage)) {
            for (const u of snap.usage) {
              await db.insert(productionUsage).values(u);
              const qtyUsed = parseFloat(u.quantityUsed || '0');
              const wasteQty = parseFloat(u.wasteQuantity || '0');
              if (qtyUsed > 0) {
                await db.insert(stockMovements).values({
                  id: genId(),
                  materialId: u.materialId,
                  movementType: 'production_consumption',
                  quantityIn: '0',
                  quantityOut: String(qtyUsed),
                  unit: u.unit || 'piece',
                  referenceType: 'production',
                  referenceId: pr.productionNumber,
                  unitCostDzd: '0',
                  userId: await resolveValidProfileId(req.user?.uid),
                  userName: op.performedBy || 'Staff',
                  notes: `Reverted consumption for ${pr.productionNumber} (Undo)`,
                });
              }
              if (wasteQty > 0) {
                await db.insert(stockMovements).values({
                  id: genId(),
                  materialId: u.materialId,
                  movementType: 'production_waste',
                  quantityIn: '0',
                  quantityOut: String(wasteQty),
                  unit: u.unit || 'piece',
                  referenceType: 'production',
                  referenceId: pr.productionNumber,
                  unitCostDzd: '0',
                  userId: await resolveValidProfileId(req.user?.uid),
                  userName: op.performedBy || 'Staff',
                  notes: `Reverted waste for ${pr.productionNumber} (Undo)`,
                });
              }
            }
          }

          await db.insert(productionLogs).values({
            id: genId(),
            productionId: pr.id,
            userId: await resolveValidProfileId(req.user?.uid),
            userName: req.user?.name || op.performedBy || 'Staff',
            userRole: req.userRole || op.performedByRole || 'staff',
            action: 'Restauration (Undo)',
            modification: `Rétablissement des valeurs antérieures suite à l'annulation (Undo)`,
          });
        }
      }
    }

    // Mark as undone
    await db
      .update(undoOperations)
      .set({ isUndone: true })
      .where(eq(undoOperations.id, op.id));

    notifyDataMutation();
    broadcastRealtimeEvent({
      type: 'UNDO_EXECUTED',
      entity: op.entityType,
      data: { id: op.id, description: op.description },
    });

    res.json({
      success: true,
      message: `Action annulée avec succès : "${op.description}" a été restaurée.`,
      operation: op,
    });
  } catch (error: any) {
    console.error('Failed to execute latest undo:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de l\'annulation rapide' });
  }
});
