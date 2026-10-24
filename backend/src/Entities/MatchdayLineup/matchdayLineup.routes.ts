import { Router } from 'express';
import { orm } from '../../shared/db/orm.js';
import { MatchdayLineup } from './matchdayLineup.entity.js';
import { readScope } from '../../shared/security/game-access.js';

export const MatchdayLineupRouter = Router();

// Deliberately read-only: neither users nor the administrative CRUD can rewrite a cutoff.
MatchdayLineupRouter.get('/', async (req, res) => {
  const where: Record<string, any> = readScope(req.authUser!, 'matchday-lineups', req.query.tournamentId);
  for (const key of ['matchday', 'participant']) {
    const raw = req.query[`${key}Id`];
    if (raw === undefined) continue;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) <= 0) {
      return res.status(400).json({ message: `Invalid ${key}Id` });
    }
    // Keep the membership condition when a participant filter is supplied.
    if (key === 'participant') where.$and = [...(where.$and ?? []), { participant: Number(raw) }];
    else where[key] = Number(raw);
  }
  const items = await orm.em.find(MatchdayLineup, where, { orderBy: [{ cutoffAt: 'asc' }, { id: 'asc' }] });
  return res.json({ message: 'historical lineups', data: items.map((lineup) => ({
    id: lineup.id, participantId: Number((lineup.participant as any)?.id ?? lineup.participant),
    matchdayId: Number((lineup.matchday as any)?.id ?? lineup.matchday),
    matchId: lineup.match ? Number((lineup.match as any)?.id ?? lineup.match) : null,
    scopeKey: lineup.scopeKey, cutoffAt: lineup.cutoffAt, formation: lineup.formation,
    startingSlots: lineup.startingSlots, substitutesRealPlayersIds: lineup.substitutesRealPlayersIds,
    captainRealPlayerId: lineup.captainRealPlayerId ?? null,
    allowChangesDuringMatchday: lineup.allowChangesDuringMatchday,
  })) });
});
