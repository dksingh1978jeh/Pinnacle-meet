import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { adminAuth } from '../lib/firebase-admin.ts';
import { findUserByUid, upsertFirebaseUser } from '../db/repository.ts';

export interface SessionUser {
  id: number;
  uid: string;
  name: string;
  email: string;
  mobile: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  plan: string;
}

export interface AuthRequest extends Request {
  dbUser?: SessionUser;
}

const JWT_SECRET =
  process.env.JWT_SECRET ||
  crypto.createHash('sha256').update('pinnacle-meet-dev-secret-key').digest('hex');

export function signSessionToken(user: SessionUser): string {
  return jwt.sign(
    {
      uid: user.uid,
      email: user.email,
      role: user.role,
      type: 'session',
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function signMeetingToken(payload: {
  meetingCode: string;
  participantUid: string;
  displayName: string;
  role: string;
}): string {
  return jwt.sign(
    {
      ...payload,
      type: 'meeting_access',
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

export function verifyMeetingToken(token: string): {
  meetingCode: string;
  participantUid: string;
  displayName: string;
  role: string;
} | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (decoded.type !== 'meeting_access') return null;
    return {
      meetingCode: String(decoded.meetingCode),
      participantUid: String(decoded.participantUid),
      displayName: String(decoded.displayName),
      role: String(decoded.role),
    };
  } catch {
    return null;
  }
}

export async function resolveUserFromToken(token: string): Promise<SessionUser | null> {
  // 1. Try local JWT session token first
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (decoded && decoded.type === 'session' && decoded.uid) {
      const user = await findUserByUid(String(decoded.uid));
      if (user) return user;
    }
  } catch {
    // Not a local JWT; fall through to Firebase ID Token verification
  }

  // 2. Try Firebase ID Token
  try {
    const decodedFirebase = await adminAuth.verifyIdToken(token);
    const user = await upsertFirebaseUser({
      uid: decodedFirebase.uid,
      email: decodedFirebase.email || `${decodedFirebase.uid}@google.user`,
      name: decodedFirebase.name || decodedFirebase.email?.split('@')[0] || 'Pinnacle User',
      avatarUrl: decodedFirebase.picture || null,
    });
    return user;
  } catch {
    return null;
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7).trim();
  const user = await resolveUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session token' });
    return;
  }

  if (user.status !== 'active') {
    res.status(403).json({
      error: `Account is ${user.status}. Contact your administrator.`,
    });
    return;
  }

  req.dbUser = user;
  next();
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const user = await resolveUserFromToken(token);
    if (user && user.status === 'active') {
      req.dbUser = user;
    }
  }
  next();
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.dbUser || req.dbUser.role !== 'super_admin') {
    res.status(403).json({ error: 'Super Admin privileges required' });
    return;
  }
  next();
};
