import { writeBid } from '../../shared/services/gameCommands.service.js';
import { gameError } from '../../shared/http/game-error.js';
import { Request, Response, NextFunction } from 'express';
import { Bid } from './bid.entity.js';
import { orm } from '../../shared/db/orm.js';
import { readScope, publicBid } from '../../shared/security/game-access.js';

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
    const items = await orm.em.find(Bid, { $and: [readScope(req.authUser!, 'bids', req.query.tournamentId), req.query.includeClosed === 'true' ? {} : { matchdayMarket: { closedAt: null }, status: 'active' }] }, { populate: ['matchdayMarket', 'participant.user', 'tournament', 'realPlayer'] });
    res.status(200).json({ message: 'found all bids', data: items.map((bid) => publicBid(bid, req.authUser!)) });
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

    const items = await orm.em.find(
      Bid,
      { $and: [{ tournament: tournamentId, realPlayer: realPlayerId, ...(req.query.includeClosed === 'true' ? {} : { matchdayMarket: { closedAt: null } }) }, readScope(req.authUser!, 'bids', req.query.tournamentId)] },
      { populate: ['matchdayMarket', 'participant.user', 'tournament', 'realPlayer'] },
    );

    res.status(200).json({
      message: 'found bids by tournament and real player',
      data: items.map((bid) => publicBid(bid, req.authUser!)),
      totalBids: items.filter(bid => bid.status === 'active').length,
      totalParticipants: new Set(items.filter(bid => bid.status === 'active').map((bid) => Number((bid.participant as any)?.id ?? bid.participant))).size,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await orm.em.findOneOrFail(Bid, { id }, { populate: ['matchdayMarket', 'participant.user', 'tournament', 'realPlayer'] });
    res.status(200).json({ message: 'found bid', data: publicBid(item, req.authUser!) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try { const data = await writeBid(orm.em.fork(), req.body.sanitizeBidInput, req.authUser!); res.status(200).json({ message: 'bid saved', data: publicBid(data, req.authUser!) }); }
  catch (error) { gameError(res, error); }
}
async function update(req: Request, res: Response) {
  try { const data = await writeBid(orm.em.fork(), req.body.sanitizeBidInput, req.authUser!, parseId(req.params.id)); res.status(200).json({ message: 'bid saved', data: publicBid(data, req.authUser!) }); }
  catch (error) { gameError(res, error); }
}
async function remove(req: Request, res: Response) {
  try { const data = await writeBid(orm.em.fork(), {}, req.authUser!, parseId(req.params.id), true); res.status(200).json({ message: 'bid cancelled', data: publicBid(data, req.authUser!) }); }
  catch (error) { gameError(res, error); }
}

export { sanitizeBidInput, findAll, findByTournamentAndRealPlayer, findOne, add, update, remove };
