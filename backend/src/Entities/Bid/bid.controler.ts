import { Request, Response, NextFunction } from 'express';
import { EntityManager, LockMode } from '@mikro-orm/core';
import { Bid } from './bid.entity.js';
import { orm } from '../../shared/db/orm.js';
import { BID_STATUSES, isEnumValue } from '../../shared/domain-enums.js';
import { Participant } from '../Participant/participant.entity.js';

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function resolveParticipantId(participantRaw: unknown): number {
  if (typeof participantRaw === 'number') {
    return participantRaw;
  }

  if (typeof participantRaw === 'string') {
    return Number.parseInt(participantRaw, 10);
  }

  if (participantRaw && typeof participantRaw === 'object' && 'id' in participantRaw) {
    return Number.parseInt(String((participantRaw as { id?: unknown }).id ?? ''), 10);
  }

  return Number.NaN;
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


async function adjustParticipantFundsForBid(entityManager: EntityManager, participantIdRaw: unknown, previousAmountRaw: unknown, nextAmountRaw: unknown) {
  const participantId = resolveParticipantId(participantIdRaw);

  if (!Number.isFinite(participantId) || participantId <= 0) {
    return;
  }

  const previousAmount = Number(previousAmountRaw ?? 0);
  const nextAmount = Number(nextAmountRaw ?? 0);
  const delta = nextAmount - previousAmount;

  if (!Number.isFinite(delta) || delta === 0) {
    return;
  }

  const participant = await entityManager.findOne(Participant, { id: participantId }, { lockMode: LockMode.PESSIMISTIC_WRITE });
  if (!participant) {
    throw new Error('participant not found for bid budget adjustment');
  }

  const availableMoney = Number(participant.availableMoney ?? 0);
  const reservedMoney = Number(participant.reservedMoney ?? 0);

  if (delta > 0 && availableMoney < delta) {
    throw new Error('insufficient available money to increase bid amount');
  }

  participant.availableMoney = Math.max(0, availableMoney - delta);
  participant.reservedMoney = Math.max(0, reservedMoney + delta);
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await orm.em.find(Bid, {}, { populate: ['matchdayMarket', 'participant', 'tournament', 'realPlayer'] });
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

    const items = await orm.em.find(
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
    const item = await orm.em.findOneOrFail(Bid, { id }, { populate: ['matchdayMarket', 'participant', 'tournament', 'realPlayer'] });
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

    const result = await orm.em.transactional(async (transactionalEm) => {
      const existingBid = await transactionalEm.findOne(Bid, {
        tournament: req.body.sanitizeBidInput.tournament,
        participant: req.body.sanitizeBidInput.participant,
        realPlayer: req.body.sanitizeBidInput.realPlayer,
      }, { lockMode: LockMode.PESSIMISTIC_WRITE });

      if (existingBid) {
        const previousAmount = Number(existingBid.offeredAmount ?? 0);
        const nextAmount = Number(req.body.sanitizeBidInput.offeredAmount ?? previousAmount);

        await adjustParticipantFundsForBid(
          transactionalEm,
          req.body.sanitizeBidInput.participant ?? existingBid.participant,
          previousAmount,
          nextAmount,
        );

        transactionalEm.assign(existingBid, req.body.sanitizeBidInput);
        await transactionalEm.flush();
        return { statusCode: 200, message: 'bid updated', data: existingBid };
      }

      await adjustParticipantFundsForBid(
        transactionalEm,
        req.body.sanitizeBidInput.participant,
        0,
        req.body.sanitizeBidInput.offeredAmount,
      );

      const item = transactionalEm.create(Bid, req.body.sanitizeBidInput);
      await transactionalEm.flush();
      return { statusCode: 201, message: 'bid created', data: item };
    });

    res.status(result.statusCode).json({ message: result.message, data: result.data });
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
    const result = await orm.em.transactional(async (transactionalEm) => {
      const itemToUpdate = await transactionalEm.findOneOrFail(Bid, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE });

      const previousAmount = Number(itemToUpdate.offeredAmount ?? 0);
      const nextAmount = Number(req.body.sanitizeBidInput.offeredAmount ?? previousAmount);

      await adjustParticipantFundsForBid(
        transactionalEm,
        req.body.sanitizeBidInput.participant ?? itemToUpdate.participant,
        previousAmount,
        nextAmount,
      );

      transactionalEm.assign(itemToUpdate, req.body.sanitizeBidInput);
      await transactionalEm.flush();
      return itemToUpdate;
    });

    res.status(200).json({ message: 'bid updated', data: result });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = orm.em.getReference(Bid, id);
    orm.em.remove(item);
    await orm.em.flush();
    res.status(200).json({ message: 'bid deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeBidInput, findAll, findByTournamentAndRealPlayer, findOne, add, update, remove };
