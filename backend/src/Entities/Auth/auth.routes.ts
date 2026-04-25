import { Router } from 'express';
import { login, loginWithGoogle, me, verifyEmail } from './auth.controler.js';
import { requireAuth } from '../../shared/http/auth.middleware.js';

export const AuthRouter = Router();

AuthRouter.post('/login', login);
AuthRouter.post('/google', loginWithGoogle);
AuthRouter.post('/verify-email', verifyEmail);
AuthRouter.get('/me', requireAuth, me);
