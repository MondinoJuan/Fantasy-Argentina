import { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../security/token.js';
import { USER_TYPES, UserType } from '../domain-enums.js';

export interface AuthenticatedUser {
  id: number;
  type: UserType;
}

function parseBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ message: 'Missing Bearer token' });
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  req.authUser = {
    id: payload.userId,
    type: payload.userType,
  };

  return next();
}

export function requireRole(roles: UserType[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ message: 'Auth required' });
    }

    if (!roles.includes(req.authUser.type) || !USER_TYPES.includes(req.authUser.type)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return next();
  };
}
