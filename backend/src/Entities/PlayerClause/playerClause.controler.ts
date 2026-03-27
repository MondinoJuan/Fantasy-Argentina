import { Request, Response, NextFunction } from 'express';
import { PlayerClause } from './playerClause.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { Shielding } from '../Shielding/shielding.entity.js';
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

function sanitizePlayerClauseInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizePlayerClauseInput = {
        tournament: req.body.tournament ?? req.body.tournamentId,
    dependantPlayer: req.body.dependantPlayer ?? req.body.dependantPlayerId,
    ownerParticipant: req.body.ownerParticipant ?? req.body.ownerParticipantId,
    baseClause: req.body.baseClause,
    additionalShieldingClause: req.body.additionalShieldingClause,
    totalClause: req.body.totalClause,
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

export { sanitizePlayerClauseInput, findAll, findOne, add, update, remove, applyShielding };
