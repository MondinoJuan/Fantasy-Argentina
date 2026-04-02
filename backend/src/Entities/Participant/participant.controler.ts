import { Request, Response, NextFunction } from 'express';
import { Participant } from './participant.entity.js';
import { Tournament } from '../Tournament/tournament.entity.js';
import { ParticipantSquad } from '../ParticipantSquad/participantSquad.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { EntityManager } from '@mikro-orm/core';
import { orm } from '../../shared/db/orm.js';
import { setupParticipantAfterJoin } from '../Tournament/tournament-participation.service.js';
import { PlayerPointsBreakdown } from '../PlayerPointsBreakdown/playerPointsBreakdown.entity.js';
import { ParticipantMatchdayPoints } from '../ParticipantMatchdayPoints/participantMatchdayPoints.entity.js';
import { Negotiation } from '../Negotiation/negotiation.entity.js';
import { Bid } from '../Bid/bid.entity.js';
import { MatchdayMarket } from '../MatchdayMarket/matchdayMarket.entity.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function toInt(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getLatestParticipantSquad(participant: Participant, entityManager: EntityManager = em): Promise<ParticipantSquad | null> {
  const squads = await entityManager.find(ParticipantSquad, { participant }, { orderBy: { acquisitionDate: 'desc' } });

  if (squads.length === 0) {
    return null;
  }

  const active = squads.find((squad) => !squad.releaseDate);
  return active ?? squads[0];
}

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function hasMoneyFields(input: Record<string, unknown>): boolean {
  return input.bankBudget !== undefined || input.availableMoney !== undefined || input.reservedMoney !== undefined;
}

function validateParticipantMoneyInvariant(participant: Participant): void {
  const bankBudget = Number(participant.bankBudget ?? 0);
  const availableMoney = Number(participant.availableMoney ?? 0);
  const reservedMoney = Number(participant.reservedMoney ?? 0);

  if (bankBudget < 0 || availableMoney < 0 || reservedMoney < 0) {
    throw new Error('participant money values cannot be negative');
  }

  const left = Math.round((availableMoney + reservedMoney) * 100);
  const right = Math.round(bankBudget * 100);

  if (left !== right) {
    throw new Error('participant money invariant failed: availableMoney + reservedMoney must equal bankBudget');
  }
}

function sanitizeParticipantInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeParticipantInput = {
    user: req.body.user ?? req.body.userId,
    tournament: req.body.tournament ?? req.body.tournamentId,
    bankBudget: req.body.bankBudget,
    reservedMoney: req.body.reservedMoney,
    availableMoney: req.body.availableMoney,
    totalScore: req.body.totalScore,
  };

  Object.keys(req.body.sanitizeParticipantInput).forEach((key) => {
    if (req.body.sanitizeParticipantInput[key] === undefined) {
      delete req.body.sanitizeParticipantInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(Participant, {}, { populate: ['user', 'tournament'] });
    res.status(200).json({ message: 'found all participants', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(Participant, { id }, { populate: ['user', 'tournament'] });
    res.status(200).json({ message: 'found participant', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(Participant, req.body.sanitizeParticipantInput);
    const tournamentId = Number.parseInt(String(req.body.sanitizeParticipantInput.tournament ?? ''), 10);

    if (!Number.isFinite(tournamentId)) {
      res.status(400).json({ message: 'tournament is required' });
      return;
    }

    const tournament = await em.findOne(Tournament, { id: tournamentId });

    if (!tournament) {
      res.status(404).json({ message: 'tournament not found' });
      return;
    }

    await setupParticipantAfterJoin(tournament, item, em);
    await em.flush();
    res.status(201).json({ message: 'participant created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(Participant, id);
    em.assign(itemToUpdate, req.body.sanitizeParticipantInput);
    if (hasMoneyFields(req.body.sanitizeParticipantInput)) {
      validateParticipantMoneyInvariant(itemToUpdate);
    }
    await em.flush();
    res.status(200).json({ message: 'participant updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(Participant, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'participant deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function leaveTournament(req: Request, res: Response) {
  try {
    const userId = toInt(req.body?.userId);
    const tournamentId = toInt(req.body?.tournamentId);

    if (!userId || !tournamentId) {
      res.status(400).json({ message: 'userId and tournamentId are required numbers' });
      return;
    }

    const result = await em.transactional(async (transactionalEm) => {
      const participant = await transactionalEm.findOne(Participant, { user: userId, tournament: tournamentId }, { populate: ['tournament'] });

      if (!participant) {
        throw new Error('participant not found for user and tournament');
      }

      await transactionalEm.nativeUpdate(MatchdayMarket, {
        tournament: tournamentId,
        sellerParticipant: participant.id,
      } as any, {
        sellerParticipant: null,
      } as any);

      await transactionalEm.nativeDelete(ParticipantSquad, { participant: participant.id });
      await transactionalEm.nativeDelete(PlayerPointsBreakdown, { participant: participant.id });
      await transactionalEm.nativeDelete(ParticipantMatchdayPoints, { participant: participant.id });
      await transactionalEm.nativeDelete(Bid, { participant: participant.id });
      await transactionalEm.nativeDelete(Negotiation, {
        $or: [{ sellerParticipant: participant.id }, { buyerParticipant: participant.id }],
        status: { $in: ['active', 'countered'] },
      } as any);
      await transactionalEm.nativeDelete(Participant, { id: participant.id });

      const remainingParticipants = await transactionalEm.count(Participant, { tournament: tournamentId });

      if (remainingParticipants === 0) {
        await transactionalEm.nativeDelete(Tournament, { id: tournamentId });
      }

      return {
        participantId: participant.id,
        tournamentDeleted: remainingParticipants === 0,
      };
    });

    res.status(200).json({
      message: result.tournamentDeleted
        ? 'participant removed and tournament deleted because it had no participants left'
        : 'participant removed from tournament',
      data: result,
    });
  } catch (error: any) {
    const message = error?.message ?? 'could not remove participant from tournament';
    if (message === 'participant not found for user and tournament') {
      res.status(404).json({ message });
      return;
    }
    res.status(500).json({ message });
  }
}



async function joinByTournamentCode(req: Request, res: Response) {
  try {
    const userId = Number.parseInt(String(req.body?.userId ?? ''), 10);
    const tournamentCode = typeof req.body?.tournamentCode === 'string' ? req.body.tournamentCode.trim() : '';

    if (!Number.isFinite(userId) || !tournamentCode) {
      res.status(400).json({ message: 'userId and tournamentCode are required' });
      return;
    }

    const tournament = await em.findOne(Tournament, { publicCode: tournamentCode });

    if (!tournament) {
      res.status(404).json({ message: 'tournament not found by code' });
      return;
    }

    const existing = await em.findOne(Participant, { user: userId, tournament: tournament.id });
    if (existing) {
      res.status(200).json({ message: 'user already joined this tournament', data: existing });
      return;
    }

    const item = em.create(Participant, {
      user: userId,
      tournament: tournament.id,
      bankBudget: tournament.initialBudget,
      reservedMoney: 0,
      availableMoney: tournament.initialBudget,
      totalScore: 0,
      joinDate: new Date(),
    } as any);

    await setupParticipantAfterJoin(tournament, item, em);
    await em.flush();
    res.status(201).json({ message: 'participant joined by tournament code', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function spendMoney(req: Request, res: Response) {
  try {
    const participantId = parseId(req.params.id);
    const amount = toPositiveNumber(req.body?.amount);

    if (!Number.isFinite(participantId) || participantId <= 0 || amount === null) {
      res.status(400).json({ message: 'participant id and amount (> 0) are required' });
      return;
    }

    const participant = await em.findOne(Participant, { id: participantId });
    if (!participant) {
      res.status(404).json({ message: 'participant not found' });
      return;
    }

    if (Number(participant.availableMoney ?? 0) < amount || Number(participant.bankBudget ?? 0) < amount) {
      res.status(400).json({ message: 'insufficient funds' });
      return;
    }

    participant.availableMoney = Number(participant.availableMoney ?? 0) - amount;
    participant.bankBudget = Number(participant.bankBudget ?? 0) - amount;

    validateParticipantMoneyInvariant(participant);
    await em.flush();

    res.status(200).json({ message: 'participant money spent', data: participant });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function transferMoney(req: Request, res: Response) {
  try {
    const fromParticipantId = toInt(req.body?.fromParticipantId);
    const toParticipantId = toInt(req.body?.toParticipantId);
    const amount = toPositiveNumber(req.body?.amount);

    if (!fromParticipantId || !toParticipantId || amount === null) {
      res.status(400).json({ message: 'fromParticipantId, toParticipantId and amount (> 0) are required' });
      return;
    }

    if (fromParticipantId === toParticipantId) {
      res.status(400).json({ message: 'participants must be different' });
      return;
    }

    const fromParticipant = await em.findOne(Participant, { id: fromParticipantId });
    const toParticipant = await em.findOne(Participant, { id: toParticipantId });

    if (!fromParticipant || !toParticipant) {
      res.status(404).json({ message: 'participant not found for transfer' });
      return;
    }

    if (Number(fromParticipant.availableMoney ?? 0) < amount || Number(fromParticipant.bankBudget ?? 0) < amount) {
      res.status(400).json({ message: 'source participant has insufficient funds' });
      return;
    }

    fromParticipant.availableMoney = Number(fromParticipant.availableMoney ?? 0) - amount;
    fromParticipant.bankBudget = Number(fromParticipant.bankBudget ?? 0) - amount;
    toParticipant.availableMoney = Number(toParticipant.availableMoney ?? 0) + amount;
    toParticipant.bankBudget = Number(toParticipant.bankBudget ?? 0) + amount;

    validateParticipantMoneyInvariant(fromParticipant);
    validateParticipantMoneyInvariant(toParticipant);

    await em.flush();
    res.status(200).json({
      message: 'participant money transferred',
      data: {
        fromParticipant,
        toParticipant,
        amount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function quickSellRealPlayer(req: Request, res: Response) {
  try {
    const participantId = parseId(req.params.id);
    const realPlayerId = toInt(req.body?.realPlayerId ?? req.body?.realPlayer);

    if (!Number.isFinite(participantId) || participantId <= 0 || !realPlayerId || realPlayerId <= 0) {
      res.status(400).json({ message: 'participant id and realPlayerId are required' });
      return;
    }

    const result = await em.transactional(async (transactionalEm) => {
      const participant = await transactionalEm.findOne(Participant, { id: participantId });

      if (!participant) {
        throw new Error('participant not found');
      }

      const squad = await getLatestParticipantSquad(participant, transactionalEm);
      if (!squad) {
        throw new Error('participant squad not found');
      }

      const currentStarting = (squad.startingRealPlayersIds ?? []).map((id) => Number.parseInt(String(id), 10)).filter((id) => Number.isFinite(id) && id > 0);
      const currentSubstitutes = (squad.substitutesRealPlayersIds ?? []).map((id) => Number.parseInt(String(id), 10)).filter((id) => Number.isFinite(id) && id > 0);

      const ownsPlayer = currentStarting.includes(realPlayerId) || currentSubstitutes.includes(realPlayerId);
      if (!ownsPlayer) {
        throw new Error('real player is not part of participant squad');
      }

      const realPlayer = await transactionalEm.findOne(RealPlayer, { id: realPlayerId });
      if (!realPlayer) {
        throw new Error('real player not found');
      }

      const saleValue = Number(realPlayer.translatedValue ?? 0) * 0.7;

      if (!Number.isFinite(saleValue) || saleValue <= 0) {
        throw new Error('real player has no translated value for quick sale');
      }

      squad.startingRealPlayersIds = currentStarting.filter((id) => id !== realPlayerId);
      squad.substitutesRealPlayersIds = currentSubstitutes.filter((id) => id !== realPlayerId);
      if (Number(squad.captainRealPlayerId ?? 0) === realPlayerId) {
        squad.captainRealPlayerId = null;
      }

      participant.bankBudget = Number(participant.bankBudget ?? 0) + saleValue;
      participant.availableMoney = Number(participant.availableMoney ?? 0) + saleValue;

      validateParticipantMoneyInvariant(participant);

      await transactionalEm.flush();

      return {
        participant,
        squad,
        realPlayer,
        saleValue,
      };
    });

    res.status(200).json({
      message: 'real player quick sold',
      data: result,
    });
  } catch (error: any) {
    if (
      error.message === 'participant not found'
      || error.message === 'participant squad not found'
      || error.message === 'real player not found'
    ) {
      res.status(404).json({ message: error.message });
      return;
    }

    if (
      error.message === 'real player is not part of participant squad'
      || error.message === 'real player has no translated value for quick sale'
    ) {
      res.status(400).json({ message: error.message });
      return;
    }

    res.status(500).json({ message: error.message });
  }
}

export { sanitizeParticipantInput, findAll, findOne, add, update, remove, joinByTournamentCode, spendMoney, transferMoney, quickSellRealPlayer, leaveTournament };
