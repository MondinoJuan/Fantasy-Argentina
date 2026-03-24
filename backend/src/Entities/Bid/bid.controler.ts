import { Request, Response, NextFunction } from 'express';
import { Bid } from './bid.entity.js';
import { orm } from '../../shared/db/orm.js';
import { BID_STATUSES, isEnumValue } from '../../shared/domain-enums.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeBidInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeBidInput = {
    matchdayMarket: req.body.matchdayMarket ?? req.body.matchdayMarketId,
    participant: req.body.participant ?? req.body.participantId,
    tournament: req.body.tournament ?? req.body.tournamentId,
    realPlayer: req.body.realPlayer ?? req.body.realPlayerId,
    offeredAmount: req.body.offeredAmount,
    status: req.body.status,
    cancellationDate: req.body.cancellationDate,
  };

  Object.keys(req.body.sanitizeBidInput).forEach((key) => {
    if (req.body.sanitizeBidInput[key] === undefined) {
      delete req.body.sanitizeBidInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(Bid, {}, { populate: ['matchdayMarket', 'participant', 'tournament', 'realPlayer'] });
    res.status(200).json({ message: 'found all bids', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findByTournamentAndRealPlayer(req: Request, res: Response) {
  try {
    const tournamentId = parseId(req.params.tournamentId);
    const realPlayerId = parseId(req.params.realPlayerId);

    if (!Number.isFinite(tournamentId) || tournamentId <= 0 || !Number.isFinite(realPlayerId) || realPlayerId <= 0) {
      res.status(400).json({ message: 'tournamentId and realPlayerId must be valid positive integers' });
      return;
    }

    const items = await em.find(
      Bid,
      { tournament: tournamentId, realPlayer: realPlayerId },
      { populate: ['matchdayMarket', 'participant', 'tournament', 'realPlayer'] },
    );

    res.status(200).json({
      message: 'found bids by tournament and real player',
      data: items,
      totalBids: items.length,
      totalParticipants: new Set(items.map((bid) => Number((bid.participant as any)?.id ?? bid.participant))).size,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(Bid, { id }, { populate: ['matchdayMarket', 'participant', 'tournament', 'realPlayer'] });
    res.status(200).json({ message: 'found bid', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    if (req.body.sanitizeBidInput.status !== undefined && !isEnumValue(BID_STATUSES, req.body.sanitizeBidInput.status)) {
      res.status(400).json({ message: `status must be one of: ${BID_STATUSES.join(', ')}` });
      return;
    }

    const existingBid = await em.findOne(Bid, {
      tournament: req.body.sanitizeBidInput.tournament,
      participant: req.body.sanitizeBidInput.participant,
      realPlayer: req.body.sanitizeBidInput.realPlayer,
    });

    if (existingBid) {
      em.assign(existingBid, req.body.sanitizeBidInput);
      await em.flush();
      res.status(200).json({ message: 'bid updated', data: existingBid });
      return;
    }

    const item = em.create(Bid, req.body.sanitizeBidInput);
    await em.flush();
    res.status(201).json({ message: 'bid created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    if (req.body.sanitizeBidInput.status !== undefined && !isEnumValue(BID_STATUSES, req.body.sanitizeBidInput.status)) {
      res.status(400).json({ message: `status must be one of: ${BID_STATUSES.join(', ')}` });
      return;
    }

    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(Bid, id);
    em.assign(itemToUpdate, req.body.sanitizeBidInput);
    await em.flush();
    res.status(200).json({ message: 'bid updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(Bid, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'bid deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeBidInput, findAll, findByTournamentAndRealPlayer, findOne, add, update, remove };
