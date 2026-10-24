import type { Request, Response, NextFunction } from 'express';
import { orm } from '../db/orm.js';
import { authorizeGameRequest, AccessError, readScope, entityId } from '../security/game-access.js';
import { Tournament } from '../../Entities/Tournament/tournament.entity.js';
import { Participant } from '../../Entities/Participant/participant.entity.js';
import { ParticipantSquad } from '../../Entities/ParticipantSquad/participantSquad.entity.js';
import { Bid } from '../../Entities/Bid/bid.entity.js';
import { Negotiation } from '../../Entities/Negotiation/negotiation.entity.js';
import { DependantPlayer } from '../../Entities/DependantPlayer/dependantPlayer.entity.js';
import { MatchdayMarket } from '../../Entities/MatchdayMarket/matchdayMarket.entity.js';
import { PlayerClause } from '../../Entities/PlayerClause/playerClause.entity.js';
import { Shielding } from '../../Entities/Shielding/shielding.entity.js';
import { Transaction } from '../../Entities/Transaction/transaction.entity.js';
import { ParticipantMatchdayPoints } from '../../Entities/ParticipantMatchdayPoints/participantMatchdayPoints.entity.js';
import { PlayerPointsBreakdown } from '../../Entities/PlayerPointsBreakdown/playerPointsBreakdown.entity.js';
import { RealPlayerLeagueValue } from '../../Entities/RealPlayerLeagueValue/realPlayerLeagueValue.entity.js';
import { MatchdayLineup } from '../../Entities/MatchdayLineup/matchdayLineup.entity.js';

const entities: Record<string, any> = {
  tournaments: Tournament, participants: Participant, 'participant-squads': ParticipantSquad,
  bids: Bid, negotiations: Negotiation, 'dependant-players': DependantPlayer,
  'matchday-markets': MatchdayMarket, 'player-clauses': PlayerClause, shieldings: Shielding,
  transactions: Transaction, 'participant-matchday-points': ParticipantMatchdayPoints,
  'player-points-breakdowns': PlayerPointsBreakdown,
  'matchday-lineups': MatchdayLineup,
};

export async function gameAccessMiddleware(req: Request, res: Response, next: NextFunction) {
  // Registration is the only unauthenticated request forwarded to entity routers.
  if (req.method === 'POST' && req.path === '/users') return next();
  if (!req.authUser) return res.status(401).json({ message: 'Auth required' });
  try {
    if (req.query.tournamentId !== undefined) {
      const id = entityId(req.query.tournamentId);
      const visible = await orm.em.findOne(Tournament, { id, ...readScope(req.authUser, 'tournaments') });
      if (!visible) throw new AccessError(403, 'Forbidden');
    }
    req.body = await authorizeGameRequest({
      get: async (resource, id) => orm.em.findOne(entities[resource], { id }),
      visible: async (resource, id, actor) => Boolean(await orm.em.findOne(entities[resource], { id, ...readScope(actor, resource) })),
      latestSquad: async (participantId) => {
        const squads = await orm.em.find(ParticipantSquad, { participant: participantId }, { orderBy: { acquisitionDate: 'desc' } });
        return squads.find((squad) => !squad.releaseDate) ?? squads[0] ?? null;
      },
      translatedValue: async (leagueId, realPlayerId) => {
        const value = await orm.em.findOne(RealPlayerLeagueValue, { league: leagueId, realPlayer: realPlayerId });
        return value?.translatedValue ?? null;
      },
    }, req.authUser, req.method, req.path, req.body);
    return next();
  } catch (error) {
    if (error instanceof AccessError) return res.status(error.status).json({ message: error.message });
    console.error('[game-access]', error);
    return res.status(500).json({ message: 'Could not verify access' });
  }
}
