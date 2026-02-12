import { Request, Response, NextFunction } from 'express';
import { PlayerClause } from './playerClause.entity.js';
import { orm } from '../../shared/db/orm.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizePlayerClauseInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizePlayerClauseInput = {
        tournamentId: req.body.tournamentId,
    realPlayerId: req.body.realPlayerId,
    ownerParticipantId: req.body.ownerParticipantId,
    baseClause: req.body.baseClause,
    additionalShieldingClause: req.body.additionalShieldingClause,
    totalClause: req.body.totalClause,
    };

  Object.keys(req.body.sanitizePlayerClauseInput).forEach((key) => {
    if (req.body.sanitizePlayerClauseInput[key] === undefined) {
      delete req.body.sanitizePlayerClauseInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(PlayerClause, {});
    res.status(200).json({ message: 'found all player clauses', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(PlayerClause, { id });
    res.status(200).json({ message: 'found player clause', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(PlayerClause, req.body.sanitizePlayerClauseInput);
    await em.flush();
    res.status(201).json({ message: 'player clause created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(PlayerClause, id);
    em.assign(itemToUpdate, req.body.sanitizePlayerClauseInput);
    await em.flush();
    res.status(200).json({ message: 'player clause updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(PlayerClause, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'player clause deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizePlayerClauseInput, findAll, findOne, add, update, remove };
