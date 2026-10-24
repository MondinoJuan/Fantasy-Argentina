import { quickSell, retireParticipant } from '../../shared/services/gameCommands.service.js';
import { gameError } from '../../shared/http/game-error.js';
import { gameTransaction, changeMoney, recordInitialBudget } from '../../shared/services/gameEconomy.service.js';
import { GameRuleError, entityId, money } from '../../shared/domain/game-rules.js';
import { Request, Response, NextFunction } from 'express';
import { Participant } from './participant.entity.js';
import { Tournament } from '../Tournament/tournament.entity.js';
import { orm } from '../../shared/db/orm.js';
import { setupParticipantAfterJoin } from '../Tournament/tournament-participation.service.js';
import { readScope, publicParticipant } from '../../shared/security/game-access.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function toInt(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
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
    const items = await em.find(Participant, readScope(req.authUser!, 'participants', req.query.tournamentId), { populate: ['user', 'tournament'] });
    res.status(200).json({ message: 'found all participants', data: items.map((item) => publicParticipant(item, req.authUser!)) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(Participant, { id }, { populate: ['user', 'tournament'] });
    res.status(200).json({ message: 'found participant', data: publicParticipant(item, req.authUser!) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const input = req.body.sanitizeParticipantInput;
    const data = await gameTransaction(orm.em.fork(), entityId(input.tournament), 'participant_join', async (tx, tournament) => {
      const participant = tx.create(Participant, { user: input.user, tournament, bankBudget: money(tournament.initialBudget), reservedMoney: 0,
        availableMoney: tournament.initialBudget, totalScore: 0, joinDate: new Date(), createdAt: new Date(), updatedAt: new Date() });
      await setupParticipantAfterJoin(tournament, participant, tx); await tx.flush(); await recordInitialBudget(tx, participant); return participant;
    });
    res.status(201).json({ message: 'participant created', data });
  } catch (error) { gameError(res, error); }
}
async function update(req: Request, res: Response) {
  try {
    const original = await orm.em.fork().findOneOrFail(Participant, { id: parseId(req.params.id) });
    const data = await gameTransaction(orm.em.fork(), entityId(original.tournament), 'admin_adjustment', async tx => {
      const p = await tx.findOneOrFail(Participant, { id: original.id }); const input = req.body.sanitizeParticipantInput;
      if ((input.tournament !== undefined && entityId(input.tournament) !== entityId(p.tournament)) || (input.user !== undefined && entityId(input.user) !== entityId(p.user))) throw Error('Cannot change participant identity');
      if (input.reservedMoney !== undefined || input.availableMoney !== undefined) throw Error('Reservations are controlled by game commands');
      if (input.bankBudget !== undefined) await changeMoney(tx, p, money(input.bankBudget, true) - p.bankBudget, 0, 'admin_adjustment', undefined, 'participant', String(p.id), req.authUser!.id);
      return p;
    });
    res.status(200).json({ message: 'participant updated', data });
  } catch (error) { gameError(res, error); }
}
async function remove(req: Request, res: Response) {
  const p = await orm.em.fork().findOneOrFail(Participant, { id: parseId(req.params.id) });
  req.body = { userId: entityId(p.user), tournamentId: entityId(p.tournament) }; return leaveTournament(req, res);
}

async function leaveTournament(req: Request, res: Response) {
  try {
    const userId = toInt(req.body?.userId);
    const tournamentId = toInt(req.body?.tournamentId);

    if (!userId || !tournamentId) {
      res.status(400).json({ message: 'userId and tournamentId are required numbers' });
      return;
    }

    const result = await retireParticipant(orm.em.fork(), tournamentId, userId, req.authUser!);

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
    const tournament = await orm.em.fork().findOneOrFail(Tournament, { publicCode: String(req.body.tournamentCode ?? '').trim() });
    const data = await gameTransaction(orm.em.fork(), tournament.id!, 'participant_join', async (tx, game) => {
      const existing = await tx.findOne(Participant, { user: Number(req.body.userId), tournament: game }); if (existing?.retiredAt) throw new GameRuleError('Ya te retiraste de este torneo. No se permite repetir el sorteo inicial.', 409); if (existing) return existing;
      const p = tx.create(Participant, { user: Number(req.body.userId), tournament: game, bankBudget: money(game.initialBudget), reservedMoney: 0,
        availableMoney: game.initialBudget, totalScore: 0, joinDate: new Date(), createdAt: new Date(), updatedAt: new Date() });
      await setupParticipantAfterJoin(game, p, tx); await tx.flush(); await recordInitialBudget(tx, p); return p;
    });
    res.status(201).json({ message: 'participant joined by tournament code', data });
  } catch (error) { gameError(res, error); }
}

async function spendMoney(req: Request, res: Response) {
  try {
    const original = await orm.em.fork().findOneOrFail(Participant, { id: parseId(req.params.id) });
    const data = await gameTransaction(orm.em.fork(), entityId(original.tournament), 'admin_spend', async tx => {
      const p = await tx.findOneOrFail(Participant, { id: original.id });
      await changeMoney(tx, p, -money(req.body.amount), 0, 'admin_adjustment', undefined, 'participant', String(p.id), req.authUser!.id); return p;
    }); res.status(200).json({ message: 'participant money spent', data });
  } catch (error) { gameError(res, error); }
}
async function transferMoney(req: Request, res: Response) {
  try {
    const original = await orm.em.fork().findOneOrFail(Participant, { id: Number(req.body.fromParticipantId) });
    const data = await gameTransaction(orm.em.fork(), entityId(original.tournament), 'admin_transfer', async tx => {
      const fromParticipant = await tx.findOneOrFail(Participant, { id: original.id });
      const toParticipant = await tx.findOneOrFail(Participant, { id: Number(req.body.toParticipantId), tournament: original.tournament });
      if (fromParticipant.id === toParticipant.id) throw Error('Participants must be different');
      const amount = money(req.body.amount);
      await changeMoney(tx, fromParticipant, -amount, 0, 'admin_adjustment', undefined, 'participant', String(toParticipant.id), req.authUser!.id);
      await changeMoney(tx, toParticipant, amount, 0, 'admin_adjustment', undefined, 'participant', String(fromParticipant.id), req.authUser!.id);
      return { fromParticipant, toParticipant, amount };
    }); res.status(200).json({ message: 'participant money transferred', data });
  } catch (error) { gameError(res, error); }
}

async function quickSellRealPlayer(req: Request, res: Response) {
  try { const data = await quickSell(orm.em.fork(), parseId(req.params.id), Number(req.body.realPlayerId ?? req.body.realPlayer), req.authUser!); res.status(200).json({ message: 'real player quick sold', data }); }
  catch (error) { gameError(res, error); }
}

export { sanitizeParticipantInput, findAll, findOne, add, update, remove, joinByTournamentCode, spendMoney, transferMoney, quickSellRealPlayer, leaveTournament };
