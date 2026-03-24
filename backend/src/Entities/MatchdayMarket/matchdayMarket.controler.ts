import { Request, Response, NextFunction } from 'express';
import { MatchdayMarket } from './matchdayMarket.entity.js';
import { orm } from '../../shared/db/orm.js';
import { MARKET_ORIGINS, isEnumValue } from '../../shared/domain-enums.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function normalizeDependantPlayerIds(value: unknown, fallbackValue: unknown): number[] | undefined {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number.parseInt(String(item), 10))
      .filter((item) => Number.isFinite(item) && item > 0);
  }

  const single = Number.parseInt(String(fallbackValue ?? ''), 10);
  if (Number.isFinite(single) && single > 0) {
    return [single];
  }

  return undefined;
}

function sanitizeMatchdayMarketInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeMatchdayMarketInput = {
    tournament: req.body.tournament ?? req.body.tournamentId,
    matchday: req.body.matchday ?? req.body.matchdayId,
    dependantPlayerIds: normalizeDependantPlayerIds(req.body.dependantPlayerIds, req.body.dependantPlayer ?? req.body.dependantPlayerId),
    minimumPrice: req.body.minimumPrice,
    origin: req.body.origin,
    sellerParticipant: req.body.sellerParticipant ?? req.body.sellerParticipantId,
  };

  Object.keys(req.body.sanitizeMatchdayMarketInput).forEach((key) => {
    if (req.body.sanitizeMatchdayMarketInput[key] === undefined) {
      delete req.body.sanitizeMatchdayMarketInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(MatchdayMarket, {}, { populate: ['tournament', 'matchday', 'sellerParticipant'] });
    res.status(200).json({ message: 'found all matchday markets', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(MatchdayMarket, { id }, { populate: ['tournament', 'matchday', 'sellerParticipant'] });
    res.status(200).json({ message: 'found matchday market', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    if (req.body.sanitizeMatchdayMarketInput.origin !== undefined && !isEnumValue(MARKET_ORIGINS, req.body.sanitizeMatchdayMarketInput.origin)) {
      res.status(400).json({ message: `origin must be one of: ${MARKET_ORIGINS.join(', ')}` });
      return;
    }

    const item = em.create(MatchdayMarket, req.body.sanitizeMatchdayMarketInput);
    await em.flush();
    res.status(201).json({ message: 'matchday market created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    if (req.body.sanitizeMatchdayMarketInput.origin !== undefined && !isEnumValue(MARKET_ORIGINS, req.body.sanitizeMatchdayMarketInput.origin)) {
      res.status(400).json({ message: `origin must be one of: ${MARKET_ORIGINS.join(', ')}` });
      return;
    }

    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(MatchdayMarket, id);
    em.assign(itemToUpdate, req.body.sanitizeMatchdayMarketInput);
    await em.flush();
    res.status(200).json({ message: 'matchday market updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(MatchdayMarket, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'matchday market deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeMatchdayMarketInput, findAll, findOne, add, update, remove };
