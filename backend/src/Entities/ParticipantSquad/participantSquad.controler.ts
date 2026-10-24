import { saveSquad } from '../../shared/services/squadCommands.service.js';
import { gameError } from '../../shared/http/game-error.js';
import { Request, Response, NextFunction } from 'express';
import { ParticipantSquad } from './participantSquad.entity.js';
import { orm } from '../../shared/db/orm.js';
import { readScope } from '../../shared/security/game-access.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function normalizeRealPlayerIds(value: unknown, fallbackValue?: unknown): any {
  if (value !== undefined) return value;
  return fallbackValue === undefined ? undefined : [fallbackValue];
}

function sanitizeParticipantSquadInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeParticipantSquadInput = {
    participant: req.body.participant ?? req.body.participantId,
    startingSlots: req.body.startingSlots,
    startingRealPlayersIds: normalizeRealPlayerIds(
      req.body.startingRealPlayersIds ?? req.body.starting_real_players_ids ?? req.body.realPlayerIds,
      req.body.realPlayer ?? req.body.realPlayerId,
    ),
    substitutesRealPlayersIds: normalizeRealPlayerIds(
      req.body.substitutesRealPlayersIds ?? req.body.substitutes_real_players_ids,
    ),
    captainRealPlayerId: req.body.captainRealPlayerId !== undefined ? req.body.captainRealPlayerId : req.body.captain_real_player_id,
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
    const items = await em.find(ParticipantSquad, readScope(req.authUser!, 'participant-squads', req.query.tournamentId), { populate: ['participant'] });
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
  try { const data = await saveSquad(orm.em.fork(), req.body.sanitizeParticipantSquadInput, req.authUser!); res.status(201).json({ message: 'participant squad created', data }); }
  catch (error) { gameError(res, error); }
}
async function update(req: Request, res: Response) {
  try { const data = await saveSquad(orm.em.fork(), req.body.sanitizeParticipantSquadInput, req.authUser!, parseId(req.params.id)); res.status(200).json({ message: 'participant squad updated', data }); }
  catch (error) { gameError(res, error); }
}
async function remove(req: Request, res: Response) {
  try { await saveSquad(orm.em.fork(), {}, req.authUser!, parseId(req.params.id), true); res.status(200).json({ message: 'participant squad deleted' }); }
  catch (error) { gameError(res, error); }
}

export { sanitizeParticipantSquadInput, findAll, findOne, add, update, remove };
