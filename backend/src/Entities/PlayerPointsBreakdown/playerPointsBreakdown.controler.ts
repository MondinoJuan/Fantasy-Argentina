import { Request, Response, NextFunction } from 'express';
import { PlayerPointsBreakdown } from './playerPointsBreakdown.entity.js';
import { orm } from '../../shared/db/orm.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizePlayerPointsBreakdownInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizePlayerPointsBreakdownInput = {
        participantId: req.body.participantId,
    matchdayId: req.body.matchdayId,
    realPlayerId: req.body.realPlayerId,
    contributedPoints: req.body.contributedPoints,
    playerPerformanceId: req.body.playerPerformanceId,
    };

  Object.keys(req.body.sanitizePlayerPointsBreakdownInput).forEach((key) => {
    if (req.body.sanitizePlayerPointsBreakdownInput[key] === undefined) {
      delete req.body.sanitizePlayerPointsBreakdownInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(PlayerPointsBreakdown, {});
    res.status(200).json({ message: 'found all player points breakdowns', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(PlayerPointsBreakdown, { id });
    res.status(200).json({ message: 'found player points breakdown', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(PlayerPointsBreakdown, req.body.sanitizePlayerPointsBreakdownInput);
    await em.flush();
    res.status(201).json({ message: 'player points breakdown created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.findOneOrFail(PlayerPointsBreakdown, { id });
    em.assign(itemToUpdate, req.body.sanitizePlayerPointsBreakdownInput);
    await em.flush();
    res.status(200).json({ message: 'player points breakdown updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(PlayerPointsBreakdown, id);
    await em.removeAndFlush(item);
    res.status(200).json({ message: 'player points breakdown deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizePlayerPointsBreakdownInput, findAll, findOne, add, update, remove };
