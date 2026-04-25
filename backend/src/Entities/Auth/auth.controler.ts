import { Request, Response } from 'express';
import { orm } from '../../shared/db/orm.js';
import { User } from '../User/user.entity.js';
import { verifyPassword } from '../../shared/security/password.js';
import { createAuthToken } from '../../shared/security/token.js';
import { GoogleTokenInfo } from './auth.types.js';

const em = orm.em;

function sanitizeUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    mail: user.mail,
    registrationDate: user.registrationDate,
    type: user.type,
    authProvider: user.authProvider,
    isEmailVerified: user.isEmailVerified,
  };
}

async function fetchGoogleTokenInfo(idToken: string): Promise<GoogleTokenInfo | null> {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as GoogleTokenInfo;
  const expectedAudience = process.env.GOOGLE_CLIENT_ID;

  if (expectedAudience && payload.aud !== expectedAudience) {
    return null;
  }

  return payload;
}

export async function login(req: Request, res: Response) {
  const mail = typeof req.body?.mail === 'string' ? req.body.mail.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!mail || !password) {
    return res.status(400).json({ message: 'mail and password are required' });
  }

  try {
    const user = await em.findOne(User, { mail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.authProvider === 'GOOGLE') {
      return res.status(401).json({ message: 'Este usuario debe iniciar sesión con Google.' });
    }

    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({ message: 'Debés verificar tu email antes de iniciar sesión.' });
    }

    if (!user.id) {
      return res.status(500).json({ message: 'User without id in persistence layer' });
    }

    const token = createAuthToken({ userId: user.id, userType: user.type });
    return res.status(200).json({ message: 'login successful', data: { token, user: sanitizeUser(user) } });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function loginWithGoogle(req: Request, res: Response) {
  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';

  if (!idToken) {
    return res.status(400).json({ message: 'idToken is required' });
  }

  try {
    const tokenInfo = await fetchGoogleTokenInfo(idToken);
    const mail = tokenInfo?.email?.trim().toLowerCase() ?? '';
    const emailVerified = tokenInfo?.email_verified === 'true';

    if (!mail || !emailVerified) {
      return res.status(401).json({ message: 'Google token inválido o email no verificado en Google.' });
    }

    const fallbackUsername = mail.split('@')[0] || 'usuario';
    let user = await em.findOne(User, { mail });

    if (!user) {
      user = em.create(User, {
        mail,
        username: tokenInfo?.name?.trim() || fallbackUsername,
        password: 'GOOGLE_LOGIN_ONLY',
        authProvider: 'GOOGLE',
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationSentAt: null,
        registrationDate: new Date(),
        type: 'USER',
      } as any);
      await em.flush();
    } else if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      user.emailVerificationToken = null;
      user.emailVerificationSentAt = null;
      await em.flush();
    }

    if (!user.id) {
      return res.status(500).json({ message: 'User without id in persistence layer' });
    }

    const token = createAuthToken({ userId: user.id, userType: user.type });
    return res.status(200).json({ message: 'google login successful', data: { token, user: sanitizeUser(user) } });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';

  if (!token) {
    return res.status(400).json({ message: 'token is required' });
  }

  try {
    const user = await em.findOne(User, { emailVerificationToken: token });
    if (!user) {
      return res.status(404).json({ message: 'Token de verificación inválido o expirado.' });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationSentAt = null;
    await em.flush();

    return res.status(200).json({ message: 'Email verificado con éxito.' });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function me(req: Request, res: Response) {
  if (!req.authUser) {
    return res.status(401).json({ message: 'Auth required' });
  }

  try {
    const user = await em.findOneOrFail(User, { id: req.authUser.id });
    return res.status(200).json({ message: 'authenticated user', data: sanitizeUser(user) });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
