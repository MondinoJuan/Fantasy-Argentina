import { Request, Response, NextFunction } from 'express';
import { Negotiation } from './negotiation.entity.js';
import { orm } from '../../shared/db/orm.js';
import { NEGOTIATION_STATUSES, isEnumValue } from '../../shared/domain-enums.js';
import { ParticipantSquad } from '../ParticipantSquad/participantSquad.entity.js';
import { PlayerClause } from '../PlayerClause/playerClause.entity.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeNegotiationInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeNegotiationInput = {
        tournament: req.body.tournament ?? req.body.tournamentId,
    sellerParticipant: req.body.sellerParticipant ?? req.body.sellerParticipantId,
    buyerParticipant: req.body.buyerParticipant ?? req.body.buyerParticipantId,
    dependantPlayer: req.body.dependantPlayer ?? req.body.dependantPlayerId,
    agreedAmount: req.body.agreedAmount,
    status: req.body.status,
    publicationDate: req.body.publicationDate,
    effectiveDate: req.body.effectiveDate,
    rejectionDate: req.body.rejectionDate,
    };

  Object.keys(req.body.sanitizeNegotiationInput).forEach((key) => {
    if (req.body.sanitizeNegotiationInput[key] === undefined) {
      delete req.body.sanitizeNegotiationInput[key];
    }
  });
  next();
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

  if (squads.length === 0) {
    return null;
  }

  const active = squads.find((squad) => !squad.releaseDate);
  return active ?? squads[0];
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(Negotiation, {}, { populate: ['tournament', 'sellerParticipant.user', 'buyerParticipant.user', 'dependantPlayer'] });
    res.status(200).json({ message: 'found all negotiations', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(Negotiation, { id }, { populate: ['tournament', 'sellerParticipant.user', 'buyerParticipant.user', 'dependantPlayer'] });
    res.status(200).json({ message: 'found negotiation', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    if (req.body.sanitizeNegotiationInput.status !== undefined && !isEnumValue(NEGOTIATION_STATUSES, req.body.sanitizeNegotiationInput.status)) {
      res.status(400).json({ message: `status must be one of: ${NEGOTIATION_STATUSES.join(', ')}` });
      return;
    }

    const item = em.create(Negotiation, req.body.sanitizeNegotiationInput);
    await em.flush();
    res.status(201).json({ message: 'negotiation created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    if (req.body.sanitizeNegotiationInput.status !== undefined && !isEnumValue(NEGOTIATION_STATUSES, req.body.sanitizeNegotiationInput.status)) {
      res.status(400).json({ message: `status must be one of: ${NEGOTIATION_STATUSES.join(', ')}` });
      return;
    }

    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(Negotiation, id);
    em.assign(itemToUpdate, req.body.sanitizeNegotiationInput);
    await em.flush();
    res.status(200).json({ message: 'negotiation updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function accept(req: Request, res: Response) {
  try {
    const negotiationId = parseId(req.params.id);

    if (!Number.isFinite(negotiationId) || negotiationId <= 0) {
      res.status(400).json({ message: 'negotiation id must be a valid positive integer' });
      return;
    }

    const result = await em.transactional(async (transactionalEm) => {
      const negotiation = await transactionalEm.findOne(
        Negotiation,
        { id: negotiationId },
        { populate: ['tournament', 'sellerParticipant', 'buyerParticipant', 'dependantPlayer', 'dependantPlayer.realPlayer'] },
      );

      if (!negotiation) {
        throw new Error('negotiation not found');
      }

      const currentStatus = String(negotiation.status ?? '').trim().toLocaleLowerCase();
      if (currentStatus === 'accepted' || currentStatus === 'acepted') {
        throw new Error('negotiation already accepted');
      }

      if (currentStatus !== 'active' && currentStatus !== 'countered') {
        throw new Error('negotiation is not active');
      }

      const sellerParticipant = negotiation.sellerParticipant;
      const buyerParticipant = negotiation.buyerParticipant;
      const sellerParticipantId = Number((sellerParticipant as any)?.id ?? 0);
      const buyerParticipantId = Number((buyerParticipant as any)?.id ?? 0);
      const tournamentId = Number((negotiation.tournament as any)?.id ?? 0);
      const realPlayerId = Number((negotiation.dependantPlayer as any)?.realPlayer?.id ?? 0);
      const amount = Number(negotiation.agreedAmount ?? 0);

      if (!tournamentId || !realPlayerId || !sellerParticipantId || !buyerParticipantId) {
        throw new Error('negotiation has invalid tournament or real player');
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('negotiation agreedAmount must be greater than zero');
      }

      const sellerSquad = await getLatestParticipantSquad(sellerParticipantId, transactionalEm);
      const buyerSquad = await getLatestParticipantSquad(buyerParticipantId, transactionalEm);

      if (!sellerSquad || !buyerSquad) {
        throw new Error('participant squad not found');
      }

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

      const allTournamentParticipants = await transactionalEm.find(
        ParticipantSquad,
        { participant: { tournament: tournamentId } as any },
        { populate: ['participant'] },
      );

      const duplicateOwners = allTournamentParticipants.filter((squad) => {
        const participantId = Number((squad.participant as any)?.id ?? 0);
        if (participantId === sellerParticipantId || participantId === buyerParticipantId) {
          return false;
        }
        const starting = normalizeIdCollection(squad.startingRealPlayersIds);
        const substitutes = normalizeIdCollection(squad.substitutesRealPlayersIds);
        return starting.includes(realPlayerId) || substitutes.includes(realPlayerId);
      });

      if (duplicateOwners.length > 0) {
        throw new Error('real player is duplicated in another participant squad');
      }

      if (Number(buyerParticipant.availableMoney ?? 0) < amount || Number(buyerParticipant.bankBudget ?? 0) < amount) {
        throw new Error('buyer has insufficient funds');
      }

      sellerSquad.startingRealPlayersIds = sellerStarting.filter((id) => id !== realPlayerId);
      sellerSquad.substitutesRealPlayersIds = sellerSubs.filter((id) => id !== realPlayerId);

      buyerSquad.substitutesRealPlayersIds = buyerSubs.includes(realPlayerId)
        ? buyerSubs
        : [...buyerSubs, realPlayerId];

      buyerParticipant.availableMoney = Number(buyerParticipant.availableMoney ?? 0) - amount;
      buyerParticipant.bankBudget = Number(buyerParticipant.bankBudget ?? 0) - amount;
      sellerParticipant.availableMoney = Number(sellerParticipant.availableMoney ?? 0) + amount;
      sellerParticipant.bankBudget = Number(sellerParticipant.bankBudget ?? 0) + amount;

      const playerClause = await transactionalEm.findOne(
        PlayerClause,
        { tournament: tournamentId, dependantPlayer: negotiation.dependantPlayer },
      );

      if (playerClause) {
        playerClause.ownerParticipant = buyerParticipant;
        playerClause.updateDate = new Date();
      }

      negotiation.status = 'accepted';
      negotiation.effectiveDate = new Date();

      await transactionalEm.flush();

      return negotiation;
    });

    res.status(200).json({ message: 'negotiation accepted', data: result });
  } catch (error: any) {
    if (
      error.message === 'negotiation not found'
      || error.message === 'participant squad not found'
    ) {
      res.status(404).json({ message: error.message });
      return;
    }

    if (
      error.message === 'negotiation already accepted'
      || error.message === 'negotiation is not active'
      || error.message === 'negotiation has invalid tournament or real player'
      || error.message === 'negotiation agreedAmount must be greater than zero'
      || error.message === 'seller does not own this real player'
      || error.message === 'buyer already owns this real player'
      || error.message === 'real player is duplicated in another participant squad'
      || error.message === 'buyer has insufficient funds'
    ) {
      res.status(400).json({ message: error.message });
      return;
    }

    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(Negotiation, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'negotiation deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeNegotiationInput, findAll, findOne, add, update, remove, accept };
