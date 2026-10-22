import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'railway_roster_luxury_editorial_secret_2026';

export interface AuthenticatedUser {
  id: number;
  username: string;
  name?: string;
  role: string;
  hrms_id?: string;
  pf_number?: string;
  designation?: string;
  phone?: string;
  email?: string;
  [key: string]: any;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser | null;
}

// Auth Middleware: Extract JWT user if present
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    req.user = null;
    return next();
  }
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) req.user = null;
    else req.user = user as AuthenticatedUser;
    next();
  });
}

// Middleware: Enforce Admin Role for Write/Edit Operations
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role || '').toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Permission denied: Administrator privileges required to modify data.' });
  }
  next();
}
