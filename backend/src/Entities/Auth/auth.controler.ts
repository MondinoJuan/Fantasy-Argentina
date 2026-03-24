import { Request, Response } from 'express';
import { orm } from '../../shared/db/orm.js';
import { User } from '../User/user.entity.js';
import { verifyPassword } from '../../shared/security/password.js';
import { createAuthToken } from '../../shared/security/token.js';

const em = orm.em;

function sanitizeUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    mail: user.mail,
    registrationDate: user.registrationDate,
    type: user.type,
  };
}

export async function login(req: Request, res: Response) {
  const mail = typeof req.body?.mail === 'string' ? req.body.mail.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!mail || !password) {
    return res.status(400).json({ message: 'mail and password are required' });
  }

  try {
    const user = await em.findOne(User, { mail });
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ message: 'Invalid credentials' });
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
