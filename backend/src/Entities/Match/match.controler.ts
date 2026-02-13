import { Request, Response, NextFunction } from 'express';
import { Match } from './match.entity.js';
import { orm } from '../../shared/db/orm.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeMatchInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeMatchInput = {
        matchday: req.body.matchday ?? req.body.matchdayId,
    externalApiId: req.body.externalApiId,
    homeTeam: req.body.homeTeam,
    awayTeam: req.body.awayTeam,
    startDateTime: req.body.startDateTime,
    status: req.body.status,
    };

  Object.keys(req.body.sanitizeMatchInput).forEach((key) => {
    if (req.body.sanitizeMatchInput[key] === undefined) {
      delete req.body.sanitizeMatchInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(Match, {}, { populate: ['matchday'] });
    res.status(200).json({ message: 'found all matchs', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(Match, { id }, { populate: ['matchday'] });
    res.status(200).json({ message: 'found match', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(Match, req.body.sanitizeMatchInput);
    await em.flush();
    res.status(201).json({ message: 'match created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(Match, id);
    em.assign(itemToUpdate, req.body.sanitizeMatchInput);
    await em.flush();
    res.status(200).json({ message: 'match updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(Match, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'match deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeMatchInput, findAll, findOne, add, update, remove };
