import { Request, Response, NextFunction } from 'express';
import { RealTeam } from './realTeam.entity.js';
import { orm } from '../../shared/db/orm.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeRealTeamInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeRealTeamInput = {
        name: req.body.name,
    leagueId: req.body.leagueId,
    externalApiId: req.body.externalApiId,
    };

  Object.keys(req.body.sanitizeRealTeamInput).forEach((key) => {
    if (req.body.sanitizeRealTeamInput[key] === undefined) {
      delete req.body.sanitizeRealTeamInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(RealTeam, {});
    res.status(200).json({ message: 'found all real teams', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(RealTeam, { id });
    res.status(200).json({ message: 'found real team', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(RealTeam, req.body.sanitizeRealTeamInput);
    await em.flush();
    res.status(201).json({ message: 'real team created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(RealTeam, id);
    em.assign(itemToUpdate, req.body.sanitizeRealTeamInput);
    await em.flush();
    res.status(200).json({ message: 'real team updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(RealTeam, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'real team deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeRealTeamInput, findAll, findOne, add, update, remove };
