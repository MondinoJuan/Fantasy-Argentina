import { Request, Response, NextFunction } from 'express';
import { PlayerClause } from './playerClause.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { Shielding } from '../Shielding/shielding.entity.js';
import { DependantPlayer } from '../DependantPlayer/dependantPlayer.entity.js';
import { ParticipantSquad } from '../ParticipantSquad/participantSquad.entity.js';
import { orm } from '../../shared/db/orm.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function toPositiveNumber(value: unknown): number | null {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return null;
  }

  return numberValue;
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeIdCollection(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => Number.parseInt(String(item), 10))
    .filter((item) => Number.isFinite(item) && item > 0);
}

async function getLatestParticipantSquad(participantId: number, entityManager = em): Promise<ParticipantSquad | null> {
  const squads = await entityManager.find(ParticipantSquad, { participant: participantId }, { orderBy: { acquisitionDate: 'desc' } });
  if (squads.length === 0) return null;
  return squads.find((squad) => !squad.releaseDate) ?? squads[0];
}

function sanitizePlayerClauseInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizePlayerClauseInput = {
        tournament: req.body.tournament ?? req.body.tournamentId,
    dependantPlayer: req.body.dependantPlayer ?? req.body.dependantPlayerId,
    ownerParticipant: req.body.ownerParticipant ?? req.body.ownerParticipantId,
    baseClause: req.body.baseClause,
    additionalShieldingClause: req.body.additionalShieldingClause,
    totalClause: req.body.totalClause,
    clauseDisabledUntil: req.body.clauseDisabledUntil,
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
    const items = await em.find(PlayerClause, {}, { populate: ['tournament', 'dependantPlayer', 'ownerParticipant'] });
    res.status(200).json({ message: 'found all player clauses', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(PlayerClause, { id }, { populate: ['tournament', 'dependantPlayer', 'ownerParticipant'] });
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

async function applyShielding(req: Request, res: Response) {
  try {
    const playerClauseId = parseId(req.params.id);
    const participantId = parseId(req.body?.participantId ?? req.body?.participant);
    const amount = toPositiveNumber(req.body?.amount);

    if (!Number.isFinite(playerClauseId) || playerClauseId <= 0 || !Number.isFinite(participantId) || participantId <= 0 || amount === null) {
      res.status(400).json({ message: 'playerClause id, participantId and amount (> 0) are required' });
      return;
    }

    const result = await em.transactional(async (transactionalEm) => {
      const playerClause = await transactionalEm.findOne(PlayerClause, { id: playerClauseId });
      if (!playerClause) {
        throw new Error('player clause not found');
      }

      const participant = await transactionalEm.findOne(Participant, { id: participantId });
      if (!participant) {
        throw new Error('participant not found');
      }

      if (Number(participant.availableMoney ?? 0) < amount || Number(participant.bankBudget ?? 0) < amount) {
        throw new Error('insufficient funds');
      }

      const clauseIncrease = amount * 2;
      const baseClause = Number(playerClause.baseClause ?? 0);
      const additionalShieldingClause = Number(playerClause.additionalShieldingClause ?? 0) + clauseIncrease;

      playerClause.additionalShieldingClause = additionalShieldingClause;
      playerClause.totalClause = baseClause + additionalShieldingClause;

      participant.availableMoney = Number(participant.availableMoney ?? 0) - amount;
      participant.bankBudget = Number(participant.bankBudget ?? 0) - amount;

      const shielding = transactionalEm.create(Shielding, {
        playerClause,
        participant,
        investedAmount: amount,
        clauseIncrease,
        shieldingDate: new Date(),
      } as any);

      await transactionalEm.flush();

      return { playerClause, participant, shielding };
    });

    res.status(200).json({ message: 'shielding applied', data: result });
  } catch (error: any) {
    if (error.message === 'player clause not found' || error.message === 'participant not found') {
      res.status(404).json({ message: error.message });
      return;
    }

    if (error.message === 'insufficient funds') {
      res.status(400).json({ message: error.message });
      return;
    }

    res.status(500).json({ message: error.message });
  }
}

async function executeClausePurchase(req: Request, res: Response) {
  try {
    const tournamentId = toPositiveInt(req.body?.tournamentId ?? req.body?.tournament);
    const dependantPlayerId = toPositiveInt(req.body?.dependantPlayerId ?? req.body?.dependantPlayer);
    const buyerParticipantId = toPositiveInt(req.body?.buyerParticipantId ?? req.body?.buyerParticipant);
    const sellerParticipantId = toPositiveInt(req.body?.sellerParticipantId ?? req.body?.sellerParticipant);

    if (!tournamentId || !dependantPlayerId || !buyerParticipantId || !sellerParticipantId) {
      res.status(400).json({ message: 'tournamentId, dependantPlayerId, buyerParticipantId and sellerParticipantId are required' });
      return;
    }

    if (buyerParticipantId === sellerParticipantId) {
      res.status(400).json({ message: 'buyer and seller must be different participants' });
      return;
    }

    const result = await em.transactional(async (transactionalEm) => {
      const dependantPlayer = await transactionalEm.findOne(
        DependantPlayer,
        { id: dependantPlayerId, tournament: tournamentId },
        { populate: ['realPlayer', 'tournament'] },
      );
      if (!dependantPlayer) {
        throw new Error('dependant player not found');
      }

      const buyerParticipant = await transactionalEm.findOne(Participant, { id: buyerParticipantId, tournament: tournamentId } as any);
      const sellerParticipant = await transactionalEm.findOne(Participant, { id: sellerParticipantId, tournament: tournamentId } as any);
      if (!buyerParticipant || !sellerParticipant) {
        throw new Error('participant not found');
      }

      const sellerSquad = await getLatestParticipantSquad(sellerParticipantId, transactionalEm);
      const buyerSquad = await getLatestParticipantSquad(buyerParticipantId, transactionalEm);
      if (!sellerSquad || !buyerSquad) {
        throw new Error('participant squad not found');
      }

      const realPlayerId = Number((dependantPlayer.realPlayer as any)?.id ?? 0);
      const sellerStarting = normalizeIdCollection(sellerSquad.startingRealPlayersIds);
      const sellerSubs = normalizeIdCollection(sellerSquad.substitutesRealPlayersIds);
      const buyerStarting = normalizeIdCollection(buyerSquad.startingRealPlayersIds);
      const buyerSubs = normalizeIdCollection(buyerSquad.substitutesRealPlayersIds);

      const sellerOwnsPlayer = sellerStarting.includes(realPlayerId) || sellerSubs.includes(realPlayerId);
      if (!sellerOwnsPlayer) {
        throw new Error('seller does not own this real player');
      }

      if (buyerStarting.includes(realPlayerId) || buyerSubs.includes(realPlayerId)) {
        throw new Error('buyer already owns this real player');
      }

      let playerClause = await transactionalEm.findOne(
        PlayerClause,
        { tournament: tournamentId, dependantPlayer: dependantPlayerId },
      );

      if (playerClause && Number((playerClause.ownerParticipant as any)?.id ?? playerClause.ownerParticipant) !== sellerParticipantId) {
        throw new Error('player clause owner does not match seller');
      }

      const now = new Date();
      if (playerClause?.clauseDisabledUntil && playerClause.clauseDisabledUntil.getTime() > now.getTime()) {
        throw new Error(`clause disabled until ${playerClause.clauseDisabledUntil.toISOString()}`);
      }

      const translatedValue = Number((dependantPlayer.realPlayer as any)?.translatedValue ?? 0);
      const fallbackClause = Math.max(0, translatedValue + 3_000_000);
      const amount = playerClause
        ? Number(playerClause.totalClause ?? 0)
        : fallbackClause;

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('invalid clause amount');
      }

      if (Number(buyerParticipant.availableMoney ?? 0) < amount || Number(buyerParticipant.bankBudget ?? 0) < amount) {
        throw new Error('buyer has insufficient funds');
      }

      sellerSquad.startingRealPlayersIds = sellerStarting.filter((id) => id !== realPlayerId);
      sellerSquad.substitutesRealPlayersIds = sellerSubs.filter((id) => id !== realPlayerId);
      if (Number(sellerSquad.captainRealPlayerId ?? 0) === realPlayerId) {
        sellerSquad.captainRealPlayerId = null;
      }

      buyerSquad.substitutesRealPlayersIds = buyerSubs.includes(realPlayerId)
        ? buyerSubs
        : [...buyerSubs, realPlayerId];

      buyerParticipant.availableMoney = Number(buyerParticipant.availableMoney ?? 0) - amount;
      buyerParticipant.bankBudget = Number(buyerParticipant.bankBudget ?? 0) - amount;
      sellerParticipant.availableMoney = Number(sellerParticipant.availableMoney ?? 0) + amount;
      sellerParticipant.bankBudget = Number(sellerParticipant.bankBudget ?? 0) + amount;

      const clauseDisabledUntil = new Date(now.getTime() + 10 * 60 * 1000);

      if (!playerClause) {
        playerClause = transactionalEm.create(PlayerClause, {
          tournament: tournamentId,
          dependantPlayer: dependantPlayerId,
          ownerParticipant: buyerParticipantId,
          baseClause: fallbackClause,
          additionalShieldingClause: 0,
          totalClause: fallbackClause,
          updateDate: now,
          clauseDisabledUntil,
        } as any);
      } else {
        playerClause.ownerParticipant = buyerParticipant;
        playerClause.updateDate = now;
        playerClause.clauseDisabledUntil = clauseDisabledUntil;
      }

      await transactionalEm.flush();

      return {
        amount,
        buyerParticipant,
        sellerParticipant,
        playerClause,
        clauseDisabledUntil,
      };
    });

    res.status(200).json({
      message: 'clause executed successfully',
      data: result,
    });
  } catch (error: any) {
    if (
      error.message === 'dependant player not found'
      || error.message === 'participant not found'
      || error.message === 'participant squad not found'
    ) {
      res.status(404).json({ message: error.message });
      return;
    }

    if (
      error.message === 'buyer and seller must be different participants'
      || error.message === 'seller does not own this real player'
      || error.message === 'buyer already owns this real player'
      || error.message === 'player clause owner does not match seller'
      || error.message === 'invalid clause amount'
      || error.message === 'buyer has insufficient funds'
      || String(error.message ?? '').startsWith('clause disabled until')
    ) {
      res.status(400).json({ message: error.message });
      return;
    }

    res.status(500).json({ message: error.message });
  }
}

export { sanitizePlayerClauseInput, findAll, findOne, add, update, remove, applyShielding, executeClausePurchase };
