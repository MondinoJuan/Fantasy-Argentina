import { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../security/token.js';
import { USER_TYPES, UserType } from '../domain-enums.js';
import { orm } from '../db/orm.js';
import { User } from '../../Entities/User/user.entity.js';

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

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ message: 'Missing Bearer token' });
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  // Re-read the role so deleted accounts and revoked privileges cannot use stale tokens.
  const user = await orm.em.findOne(User, { id: payload.userId });
  if (!user || !USER_TYPES.includes(user.type)) return res.status(401).json({ message: 'Invalid session' });
  req.authUser = { id: payload.userId, type: user.type };

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
