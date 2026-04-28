import { Request, Response, NextFunction } from 'express';
import { ParticipantSquad } from './participantSquad.entity.js';
import { orm } from '../../shared/db/orm.js';
import { SQUAD_ACQUISITION_TYPES, isEnumValue } from '../../shared/domain-enums.js';
import { Participant } from '../Participant/participant.entity.js';
import {
  assertSquadAndClausesUnlockedByLeague,
  SquadAndClausesLockedError,
} from '../../shared/services/matchdaySquadLock.service.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function normalizeRealPlayerIds(value: unknown, fallbackValue?: unknown): number[] | undefined {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number.parseInt(String(item), 10))
      .filter((item) => Number.isFinite(item) && item > 0);
  }

  if (value !== undefined && value !== null) {
    const parsed = Number.parseInt(String(value), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return [parsed];
    }
  }

  const single = Number.parseInt(String(fallbackValue ?? ''), 10);
  if (Number.isFinite(single) && single > 0) {
    return [single];
  }

  return undefined;
}

function normalizeOptionalRealPlayerId(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return null;
}

function normalizeCaptainAgainstStarting(input: Record<string, unknown>): string | null {
  const captainRaw = input.captainRealPlayerId;
  if (captainRaw === undefined || captainRaw === null) {
    return null;
  }

  const captainId = Number.parseInt(String(captainRaw), 10);
  if (!Number.isFinite(captainId) || captainId <= 0) {
    return 'captainRealPlayerId must be a valid positive integer or null';
  }

  const startingIdsRaw = input.startingRealPlayersIds;
  if (!Array.isArray(startingIdsRaw)) {
    return null;
  }

  const startingIds = startingIdsRaw
    .map((item) => Number.parseInt(String(item), 10))
    .filter((item) => Number.isFinite(item) && item > 0);

  if (!startingIds.includes(captainId)) {
    input.captainRealPlayerId = null;
  }

  return null;
}

function sanitizeParticipantSquadInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeParticipantSquadInput = {
    participant: req.body.participant ?? req.body.participantId,
    startingRealPlayersIds: normalizeRealPlayerIds(
      req.body.startingRealPlayersIds ?? req.body.starting_real_players_ids ?? req.body.realPlayerIds,
      req.body.realPlayer ?? req.body.realPlayerId,
    ),
    substitutesRealPlayersIds: normalizeRealPlayerIds(
      req.body.substitutesRealPlayersIds ?? req.body.substitutes_real_players_ids,
    ) ?? [],
    captainRealPlayerId: normalizeOptionalRealPlayerId(
      req.body.captainRealPlayerId ?? req.body.captain_real_player_id,
    ),
    formation: req.body.formation,
    releaseDate: req.body.releaseDate,
    purchasePrice: req.body.purchasePrice,
    acquisitionType: req.body.acquisitionType,
  };

  Object.keys(req.body.sanitizeParticipantSquadInput).forEach((key) => {
    if (req.body.sanitizeParticipantSquadInput[key] === undefined) {
      delete req.body.sanitizeParticipantSquadInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(ParticipantSquad, {}, { populate: ['participant'] });
    res.status(200).json({ message: 'found all participant squads', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(ParticipantSquad, { id }, { populate: ['participant'] });
    res.status(200).json({ message: 'found participant squad', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    if (req.body.sanitizeParticipantSquadInput.acquisitionType !== undefined && !isEnumValue(SQUAD_ACQUISITION_TYPES, req.body.sanitizeParticipantSquadInput.acquisitionType)) {
      res.status(400).json({ message: `acquisitionType must be one of: ${SQUAD_ACQUISITION_TYPES.join(', ')}` });
      return;
    }

    const captainValidationError = normalizeCaptainAgainstStarting(req.body.sanitizeParticipantSquadInput);
    if (captainValidationError) {
      res.status(400).json({ message: captainValidationError });
      return;
    }

    const participantId = Number.parseInt(String(req.body.sanitizeParticipantSquadInput.participant ?? ''), 10);
    if (!Number.isFinite(participantId) || participantId <= 0) {
      res.status(400).json({ message: 'participant is required' });
      return;
    }

    const participant = await em.findOne(Participant, { id: participantId }, { populate: ['tournament', 'tournament.league'] });
    if (!participant) {
      res.status(404).json({ message: 'participant not found' });
      return;
    }

    const leagueId = Number((participant.tournament as any)?.league?.id ?? (participant.tournament as any)?.league);
    if (!Number.isFinite(leagueId) || leagueId <= 0) {
      res.status(400).json({ message: 'participant tournament league not found' });
      return;
    }

    await assertSquadAndClausesUnlockedByLeague(em as any, leagueId, undefined, {
      allowSquadChangesDuringMatchday: Boolean((participant.tournament as any)?.allowSquadChangesDuringMatchday),
    });

    const item = em.create(ParticipantSquad, req.body.sanitizeParticipantSquadInput);
    await em.flush();
    res.status(201).json({ message: 'participant squad created', data: item });
  } catch (error: any) {
    if (error instanceof SquadAndClausesLockedError) {
      res.status(423).json({ message: error.message, data: error.lockWindow });
      return;
    }
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    if (req.body.sanitizeParticipantSquadInput.acquisitionType !== undefined && !isEnumValue(SQUAD_ACQUISITION_TYPES, req.body.sanitizeParticipantSquadInput.acquisitionType)) {
      res.status(400).json({ message: `acquisitionType must be one of: ${SQUAD_ACQUISITION_TYPES.join(', ')}` });
      return;
    }

    const id = parseId(req.params.id);
    const itemToUpdate = await em.findOne(
      ParticipantSquad,
      { id },
      { populate: ['participant', 'participant.tournament', 'participant.tournament.league'] },
    );
    if (!itemToUpdate) {
      res.status(404).json({ message: 'participant squad not found' });
      return;
    }

    const mergedForValidation = {
      startingRealPlayersIds: itemToUpdate.startingRealPlayersIds,
      captainRealPlayerId: itemToUpdate.captainRealPlayerId ?? null,
      ...req.body.sanitizeParticipantSquadInput,
    };
    const captainValidationError = normalizeCaptainAgainstStarting(mergedForValidation);
    if (captainValidationError) {
      res.status(400).json({ message: captainValidationError });
      return;
    }
    req.body.sanitizeParticipantSquadInput.captainRealPlayerId = mergedForValidation.captainRealPlayerId;

    const leagueId = Number(((itemToUpdate.participant as any)?.tournament as any)?.league?.id
      ?? ((itemToUpdate.participant as any)?.tournament as any)?.league);
    if (!Number.isFinite(leagueId) || leagueId <= 0) {
      res.status(400).json({ message: 'participant tournament league not found' });
      return;
    }

    await assertSquadAndClausesUnlockedByLeague(em as any, leagueId, undefined, {
      allowSquadChangesDuringMatchday: Boolean(((itemToUpdate.participant as any)?.tournament as any)?.allowSquadChangesDuringMatchday),
    });

    em.assign(itemToUpdate, req.body.sanitizeParticipantSquadInput);
    await em.flush();
    res.status(200).json({ message: 'participant squad updated', data: itemToUpdate });
  } catch (error: any) {
    if (error instanceof SquadAndClausesLockedError) {
      res.status(423).json({ message: error.message, data: error.lockWindow });
      return;
    }
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(ParticipantSquad, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'participant squad deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeParticipantSquadInput, findAll, findOne, add, update, remove };
