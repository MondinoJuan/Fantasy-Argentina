import { Request, Response, NextFunction } from 'express';
import { User } from './user.entity.js';
import { orm } from '../../shared/db/orm.js';
import { USER_TYPES, isEnumValue } from '../../shared/domain-enums.js';
import { hashPassword, isPasswordHashed } from '../../shared/security/password.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeUserInput(req: Request, res: Response, next: NextFunction) {
  const normalizedMail = typeof req.body.mail === 'string' ? req.body.mail.trim().toLowerCase() : req.body.mail;
  req.body.sanitizeUserInput = {
        username: req.body.username,
        password: req.body.password,
        mail: normalizedMail,
        type: req.body.type,
        superadminCode: req.body.superadminCode,
    };

  Object.keys(req.body.sanitizeUserInput).forEach((key) => {
    if (req.body.sanitizeUserInput[key] === undefined) {
      delete req.body.sanitizeUserInput[key];
    }
  });
  next();
}

function resolveUserTypeForCreation(rawType: unknown, rawSuperadminCode: unknown) {
  const requestedType = isEnumValue(USER_TYPES, rawType) ? rawType : 'USER';
  const configuredSuperadminCode = process.env.SUPERADMIN_SIGNUP_CODE;
  const providedCode = typeof rawSuperadminCode === 'string' ? rawSuperadminCode.trim() : '';
  const validSuperadminCode = configuredSuperadminCode !== undefined
    && configuredSuperadminCode.length > 0
    && providedCode.length > 0
    && providedCode === configuredSuperadminCode;

  if (validSuperadminCode) {
    return 'SUPERADMIN' as const;
  }

  return requestedType === 'SUPERADMIN' ? 'USER' as const : requestedType;
}

function sanitizeUserOutput(user: User) {
  return {
    id: user.id,
    username: user.username,
    mail: user.mail,
    registrationDate: user.registrationDate,
    type: user.type,
  };
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(User, {});
    res.status(200).json({ message: 'found all users', data: items.map(sanitizeUserOutput) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    if (!req.authUser) {
      return res.status(401).json({ message: 'Auth required' });
    }

    const id = parseId(req.params.id);
    if (req.authUser.type !== 'SUPERADMIN' && req.authUser.id !== id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const item = await em.findOneOrFail(User, { id });
    res.status(200).json({ message: 'found user', data: sanitizeUserOutput(item) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const userInput = {
      ...req.body.sanitizeUserInput,
      type: resolveUserTypeForCreation(req.body.sanitizeUserInput.type, req.body.sanitizeUserInput.superadminCode),
    };
    delete (userInput as any).superadminCode;

    if (typeof userInput.password === 'string' && !isPasswordHashed(userInput.password)) {
      userInput.password = hashPassword(userInput.password);
    }

    const item = em.create(User, userInput);
    await em.flush();
    res.status(201).json({ message: 'user created', data: sanitizeUserOutput(item) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    if (!req.authUser) {
      return res.status(401).json({ message: 'Auth required' });
    }

    const id = parseId(req.params.id);
    if (req.authUser.type !== 'SUPERADMIN' && req.authUser.id !== id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const itemToUpdate = await em.getReference(User, id);
    const userInput = {
      ...req.body.sanitizeUserInput,
      ...(req.body.sanitizeUserInput.type !== undefined
        ? { type: isEnumValue(USER_TYPES, req.body.sanitizeUserInput.type) ? req.body.sanitizeUserInput.type : 'USER' }
        : {}),
    };

    if (typeof userInput.password === 'string' && !isPasswordHashed(userInput.password)) {
      userInput.password = hashPassword(userInput.password);
    }

    em.assign(itemToUpdate, userInput);
    await em.flush();
    res.status(200).json({ message: 'user updated', data: sanitizeUserOutput(itemToUpdate) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(User, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'user deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeUserInput, findAll, findOne, add, update, remove };
