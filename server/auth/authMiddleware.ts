import { Request, Response, NextFunction } from 'express';
import { userStore } from './userStore.ts';
import { User } from './types.ts';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: User;
      authToken?: string;
    }
  }
}

function parseCookie(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    if (!value) return;
    list[name] = decodeURIComponent(value);
  });
  return list;
}

export function extractAuthToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const cookies = parseCookie(req.headers.cookie);
  if (cookies['retailiq_session']) {
    return cookies['retailiq_session'];
  }
  return null;
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractAuthToken(req);
  if (token) {
    const user = userStore.validateToken(token);
    if (user) {
      req.user = user;
      req.authToken = token;
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractAuthToken(req);
  if (!token) {
    res.status(401).json({
      error: 'unauthenticated',
      message: 'Access denied. Please log in to access this retail intelligence service.'
    });
    return;
  }

  const user = userStore.validateToken(token);
  if (!user) {
    res.status(401).json({
      error: 'invalid_or_expired_session',
      message: 'Your session has expired or is invalid. Please sign in again.'
    });
    return;
  }

  req.user = user;
  req.authToken = token;
  next();
}
