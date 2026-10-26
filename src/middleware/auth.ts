import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { db } from '../db/index.ts';
import { profiles } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  userRole?: 'owner' | 'admin' | 'commerciale';
  userPermissions?: string[];
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1]?.trim() : null;
  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  // Handle custom credentials token
  if (token.startsWith('custom-')) {
    const profileId = token.replace('custom-', '');
    try {
      const existing = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
      if (existing.length > 0) {
        const p = existing[0];
        req.user = {
          uid: p.id,
          email: p.email,
          name: p.fullName,
          auth_time: Math.floor(Date.now() / 1000),
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400 * 30,
          aud: 'an-printing',
          iss: 'custom-auth',
          sub: p.id,
          firebase: { identities: {}, sign_in_provider: 'custom' },
        } as DecodedIdToken;
        req.userRole = (p.role as 'owner' | 'admin' | 'commerciale') || 'commerciale';
        try {
          req.userPermissions = p.permissions ? (typeof p.permissions === 'string' ? JSON.parse(p.permissions) : p.permissions) : [];
        } catch {
          req.userPermissions = [];
        }
        return next();
      }
    } catch (e) {
      console.warn('Error verifying custom token:', e);
    }
  }

  // Backward compatible demo token for Abdallah owner
  if (token === 'demo-token') {
    const ownerUser = await db.select().from(profiles).where(eq(profiles.email, 'abdallahcrypto036@gmail.com')).limit(1);
    if (ownerUser.length > 0) {
      const p = ownerUser[0];
      req.user = {
        uid: p.id,
        email: p.email,
        name: p.fullName,
        sub: p.id,
      } as any;
      req.userRole = 'owner';
      req.userPermissions = ['all'];
      return next();
    }
  }

  // A Firebase ID token is a JWT with 3 dot-separated segments.
  // Validate format before passing to Firebase Admin to prevent auth/argument-error
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token format' });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    // Check or upsert profile by id OR by email
    let existing = await db.select().from(profiles).where(eq(profiles.id, decodedToken.uid)).limit(1);
    if (existing.length === 0 && decodedToken.email) {
      existing = await db.select().from(profiles).where(eq(profiles.email, decodedToken.email.trim().toLowerCase())).limit(1);
    }

    if (existing.length === 0) {
      const isOwnerEmail = decodedToken.email?.trim().toLowerCase() === 'abdallahcrypto036@gmail.com';
      const initialRole = isOwnerEmail ? 'owner' : 'commerciale';
      const initialPerms = initialRole === 'owner' ? ['all'] : ['orders', 'customers', 'inactive_clients'];

      const newProfiles = await db.insert(profiles).values({
        id: decodedToken.uid,
        email: decodedToken.email ? decodedToken.email.trim().toLowerCase() : '',
        fullName: decodedToken.name || (decodedToken.email ? decodedToken.email.split('@')[0] : 'User'),
        role: initialRole,
        permissions: JSON.stringify(initialPerms),
        isActive: true,
      }).returning();
      req.userRole = newProfiles[0]?.role as any;
      req.user.uid = newProfiles[0]?.id;
      req.userPermissions = initialPerms;
    } else {
      req.userRole = existing[0].role as any;
      req.user.uid = existing[0].id;
      try {
        req.userPermissions = existing[0].permissions ? (typeof existing[0].permissions === 'string' ? JSON.parse(existing[0].permissions) : existing[0].permissions) : [];
      } catch {
        req.userPermissions = [];
      }
    }

    next();
  } catch (error: any) {
    if (error?.code !== 'auth/argument-error' && error?.code !== 'auth/id-token-expired') {
      console.warn('Firebase ID token verification failed:', error?.message || error);
    }
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireOwner = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'owner') {
    return res.status(403).json({ error: 'Forbidden: Owner role required for this action' });
  }
  next();
};

export const requireOwnerOrAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'owner' && req.userRole !== 'admin' && !req.userPermissions?.includes('all')) {
    return res.status(403).json({ error: 'Forbidden: Owner or Admin role required for this action' });
  }
  next();
};

export const requireOrderManagerOrAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (
    req.userRole === 'owner' ||
    req.userRole === 'admin' ||
    req.userPermissions?.includes('orders') ||
    req.userPermissions?.includes('all')
  ) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden: Permission to manage orders required' });
};

export const requireInventoryManagerOrAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (
    req.userRole === 'owner' ||
    req.userRole === 'admin' ||
    req.userPermissions?.includes('all') ||
    req.userPermissions?.includes('inventory') ||
    req.userPermissions?.includes('materials')
  ) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden: Permission to manage inventory and materials required' });
};

