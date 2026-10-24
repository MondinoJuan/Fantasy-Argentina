import { gameTransaction } from '../../shared/services/gameEconomy.service.js';
import { GameRuleError, entityId } from '../../shared/domain/game-rules.js';
import { PlayerOwnership } from '../PlayerOwnership/playerOwnership.entity.js';
import { buyClause, shieldPlayer } from '../../shared/services/gameCommands.service.js';
import { gameError } from '../../shared/http/game-error.js';
import { Request, Response, NextFunction } from 'express';
import { PlayerClause } from './playerClause.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { DependantPlayer } from '../DependantPlayer/dependantPlayer.entity.js';
import { orm } from '../../shared/db/orm.js';
import { getRealPlayerLeagueTranslatedValue } from '../RealPlayerLeagueValue/realPlayerLeagueValue.service.js';
import { readScope } from '../../shared/security/game-access.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
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
    const items = await em.find(PlayerClause, readScope(req.authUser!, 'player-clauses', req.query.tournamentId), { populate: ['tournament', 'dependantPlayer', 'ownerParticipant'] });
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
    const input = req.body.sanitizePlayerClauseInput;
    const data = await gameTransaction(orm.em.fork(), entityId(input.tournament), 'initial_clause', async (tx, tournament) => {
      const participant = await tx.findOneOrFail(Participant, { id: entityId(input.ownerParticipant), tournament });
      if (req.authUser!.type !== 'SUPERADMIN' && entityId(participant.user) !== req.authUser!.id) throw new GameRuleError('Solo el dueño puede crear la cláusula', 403);
      const dependant = await tx.findOneOrFail(DependantPlayer, { id: entityId(input.dependantPlayer), tournament });
      const held = await tx.findOne(PlayerOwnership, { tournament, realPlayer: dependant.realPlayer, owner: participant });
      if (!held) throw new GameRuleError('El jugador ya no pertenece a este participante');
      const existing = await tx.findOne(PlayerClause, { tournament, dependantPlayer: dependant }); if (existing) return existing;
      const value = await getRealPlayerLeagueTranslatedValue(tx, entityId(tournament.league), entityId(dependant.realPlayer));
      if (value == null) throw new GameRuleError('Cotización no disponible');
      const amount = Math.ceil(value) + 3_000_000;
      return tx.create(PlayerClause, { tournament, dependantPlayer: dependant, ownerParticipant: participant, baseClause: amount,
        additionalShieldingClause: 0, totalClause: amount, updateDate: new Date(), createdAt: new Date(), updatedAt: new Date() });
    }); res.status(201).json({ message: 'player clause created', data });
  } catch (error) { gameError(res, error); }
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
  try { const data = await shieldPlayer(orm.em.fork(), parseId(req.params.id), Number(req.body.participantId ?? req.body.participant), req.body.amount, req.authUser!); res.status(200).json({ message: 'shielding applied', data }); }
  catch (error) { gameError(res, error); }
}
async function executeClausePurchase(req: Request, res: Response) {
  try { const data = await buyClause(orm.em.fork(), req.body, req.authUser!); res.status(200).json({ message: 'clause executed successfully', data }); }
  catch (error) { gameError(res, error); }
}

export { sanitizePlayerClauseInput, findAll, findOne, add, update, remove, applyShielding, executeClausePurchase };
