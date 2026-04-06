import { Request, Response, NextFunction } from 'express';
import { Matchday } from './matchday.entity.js';
import { orm } from '../../shared/db/orm.js';
import { MATCHDAY_STATUSES, isEnumValue } from '../../shared/domain-enums.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeMatchdayInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeMatchdayInput = {
    league: req.body.league ?? req.body.leagueId,
    season: req.body.season,
    matchdayNumber: req.body.matchdayNumber,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    autoUpdateAt: req.body.autoUpdateAt ?? req.body.auto_update_at,
    nextPostponedCheckAt: req.body.nextPostponedCheckAt ?? req.body.next_postponed_check_at,
    status: req.body.status,
  };

  Object.keys(req.body.sanitizeMatchdayInput).forEach((key) => {
    if (req.body.sanitizeMatchdayInput[key] === undefined) {
      delete req.body.sanitizeMatchdayInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(Matchday, {}, { populate: ['league'] });
    res.status(200).json({ message: 'found all matchdays', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(Matchday, { id }, { populate: ['league'] });
    res.status(200).json({ message: 'found matchday', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    if (req.body.sanitizeMatchdayInput.status !== undefined && !isEnumValue(MATCHDAY_STATUSES, req.body.sanitizeMatchdayInput.status)) {
      res.status(400).json({ message: `status must be one of: ${MATCHDAY_STATUSES.join(', ')}` });
      return;
    }

    const item = em.create(Matchday, req.body.sanitizeMatchdayInput);
    await em.flush();
    res.status(201).json({ message: 'matchday created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    if (req.body.sanitizeMatchdayInput.status !== undefined && !isEnumValue(MATCHDAY_STATUSES, req.body.sanitizeMatchdayInput.status)) {
      res.status(400).json({ message: `status must be one of: ${MATCHDAY_STATUSES.join(', ')}` });
      return;
    }

    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(Matchday, id);
    em.assign(itemToUpdate, req.body.sanitizeMatchdayInput);
    await em.flush();
    res.status(200).json({ message: 'matchday updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(Matchday, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'matchday deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeMatchdayInput, findAll, findOne, add, update, remove };
