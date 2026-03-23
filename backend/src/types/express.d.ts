import type { AuthenticatedUser } from '../shared/http/auth.middleware.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export {};
