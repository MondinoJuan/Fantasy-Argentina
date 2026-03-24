import { Router } from 'express';
import { login, me } from './auth.controler.js';
import { requireAuth } from '../../shared/http/auth.middleware.js';

export const AuthRouter = Router();

AuthRouter.post('/login', login);
AuthRouter.get('/me', requireAuth, me);
