import { Request, Response, NextFunction } from 'express';
import { Participant } from './participant.entity.js';
import { Tournament } from '../Tournament/tournament.entity.js';
import { orm } from '../../shared/db/orm.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
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

    // TODO(TORNEO-JOIN): cuando un participant se une por idTournament, acá debe llamarse
    // una función que asigne aleatoriamente una cantidad de jugadores igual al cupoTitular del deporte.
    // TODO(TORNEO-JOIN): en este mismo punto también debe llamarse otra función que tome
    // 4 jugadores al azar de la BdD para agregarlos al market de la fecha vigente.

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

    await em.flush();
    res.status(201).json({ message: 'participant joined by tournament code', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
export { sanitizeParticipantInput, findAll, findOne, add, update, remove, joinByTournamentCode };
