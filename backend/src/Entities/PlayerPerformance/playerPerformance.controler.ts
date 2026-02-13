import { Request, Response, NextFunction } from 'express';
import { PlayerPerformance } from './playerPerformance.entity.js';
import { orm } from '../../shared/db/orm.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizePlayerPerformanceInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizePlayerPerformanceInput = {
        realPlayer: req.body.realPlayer ?? req.body.realPlayerId,
    matchday: req.body.matchday ?? req.body.matchdayId,
    pointsObtained: req.body.pointsObtained,
    played: req.body.played,
    };

  Object.keys(req.body.sanitizePlayerPerformanceInput).forEach((key) => {
    if (req.body.sanitizePlayerPerformanceInput[key] === undefined) {
      delete req.body.sanitizePlayerPerformanceInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(PlayerPerformance, {}, { populate: ['realPlayer', 'matchday'] });
    res.status(200).json({ message: 'found all player performances', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(PlayerPerformance, { id }, { populate: ['realPlayer', 'matchday'] });
    res.status(200).json({ message: 'found player performance', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(PlayerPerformance, req.body.sanitizePlayerPerformanceInput);
    await em.flush();
    res.status(201).json({ message: 'player performance created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(PlayerPerformance, id);
    em.assign(itemToUpdate, req.body.sanitizePlayerPerformanceInput);
    await em.flush();
    res.status(200).json({ message: 'player performance updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(PlayerPerformance, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'player performance deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizePlayerPerformanceInput, findAll, findOne, add, update, remove };
