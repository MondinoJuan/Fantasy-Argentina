import { Request, Response, NextFunction } from 'express';
import { User } from './user.entity.js';
import { orm } from '../../shared/db/orm.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeUserInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeUserInput = {
        username: req.body.username,
        password: req.body.password,
        mail: req.body.mail,
    };

  Object.keys(req.body.sanitizeUserInput).forEach((key) => {
    if (req.body.sanitizeUserInput[key] === undefined) {
      delete req.body.sanitizeUserInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(User, {});
    res.status(200).json({ message: 'found all users', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(User, { id });
    res.status(200).json({ message: 'found user', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(User, req.body.sanitizeUserInput);
    await em.flush();
    res.status(201).json({ message: 'user created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(User, id);
    em.assign(itemToUpdate, req.body.sanitizeUserInput);
    await em.flush();
    res.status(200).json({ message: 'user updated', data: itemToUpdate });
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
