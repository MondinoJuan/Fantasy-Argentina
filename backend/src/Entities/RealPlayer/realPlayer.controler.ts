import { Request, Response, NextFunction } from 'express';
import { RealPlayer } from './realPlayer.entity.js';
import { orm } from '../../shared/db/orm.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeRealPlayerInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeRealPlayerInput = {
        externalApiId: req.body.externalApiId,
    name: req.body.name,
    position: req.body.position,
    realTeamId: req.body.realTeamId,
    marketValue: req.body.marketValue,
    active: req.body.active,
    };

  Object.keys(req.body.sanitizeRealPlayerInput).forEach((key) => {
    if (req.body.sanitizeRealPlayerInput[key] === undefined) {
      delete req.body.sanitizeRealPlayerInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(RealPlayer, {});
    res.status(200).json({ message: 'found all real players', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(RealPlayer, { id });
    res.status(200).json({ message: 'found real player', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(RealPlayer, req.body.sanitizeRealPlayerInput);
    await em.flush();
    res.status(201).json({ message: 'real player created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.findOneOrFail(RealPlayer, { id });
    em.assign(itemToUpdate, req.body.sanitizeRealPlayerInput);
    await em.flush();
    res.status(200).json({ message: 'real player updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(RealPlayer, id);
    await em.removeAndFlush(item);
    res.status(200).json({ message: 'real player deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeRealPlayerInput, findAll, findOne, add, update, remove };
