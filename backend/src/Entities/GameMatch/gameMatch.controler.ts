import { Request, Response, NextFunction } from 'express';
import { GameMatch } from './gameMatch.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { orm } from '../../shared/db/orm.js';
import { MATCH_STATUSES, isEnumValue } from '../../shared/domain-enums.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeGameMatchInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeGameMatchInput = {
    matchday: req.body.matchday ?? req.body.matchdayId,
    league: req.body.league ?? req.body.leagueId,
    externalApiId: req.body.externalApiId,
    homeTeam: req.body.homeTeam,
    awayTeam: req.body.awayTeam,
    startDateTime: req.body.startDateTime,
    status: req.body.status,
  };

  Object.keys(req.body.sanitizeGameMatchInput).forEach((key) => {
    if (req.body.sanitizeGameMatchInput[key] === undefined) {
      delete req.body.sanitizeGameMatchInput[key];
    }
  });
  next();
}


async function ensureLeagueFromMatchday(input: Record<string, any>) {
  if (input.league !== undefined) {
    return;
  }

  const matchdayId = Number.parseInt(String(input.matchday ?? ''), 10);
  if (!Number.isFinite(matchdayId)) {
    return;
  }

  const matchday = await em.findOne(Matchday, { id: matchdayId }, { populate: ['league'] });
  if (matchday?.league) {
    input.league = matchday.league;
  }
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(GameMatch, {}, { populate: ['matchday', 'league'] });
    res.status(200).json({ message: 'found all matchs', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(GameMatch, { id }, { populate: ['matchday', 'league'] });
    res.status(200).json({ message: 'found match', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    if (req.body.sanitizeGameMatchInput.status !== undefined && !isEnumValue(MATCH_STATUSES, req.body.sanitizeGameMatchInput.status)) {
      res.status(400).json({ message: `status must be one of: ${MATCH_STATUSES.join(', ')}` });
      return;
    }

    await ensureLeagueFromMatchday(req.body.sanitizeGameMatchInput);

    const item = em.create(GameMatch, req.body.sanitizeGameMatchInput);
    await em.flush();
    res.status(201).json({ message: 'match created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    if (req.body.sanitizeGameMatchInput.status !== undefined && !isEnumValue(MATCH_STATUSES, req.body.sanitizeGameMatchInput.status)) {
      res.status(400).json({ message: `status must be one of: ${MATCH_STATUSES.join(', ')}` });
      return;
    }

    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(GameMatch, id);

    await ensureLeagueFromMatchday(req.body.sanitizeGameMatchInput);
    em.assign(itemToUpdate, req.body.sanitizeGameMatchInput);
    await em.flush();
    res.status(200).json({ message: 'match updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(GameMatch, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'match deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeGameMatchInput, findAll, findOne, add, update, remove };
