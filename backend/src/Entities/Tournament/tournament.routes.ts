import { Router } from 'express';
import { sanitizeTournamentInput, findAll, findOne, findOneByPublicCode, add, update, remove, syncPostponedMatches, sumEndOfMatchdayPoints, settleMarketAndRefreshByLeague } from './tournament.controler.js';

export const TournamentRouter = Router();

TournamentRouter.get('/', findAll);
TournamentRouter.get('/by-public-code/:publicCode', findOneByPublicCode);
TournamentRouter.get('/:id', findOne);
TournamentRouter.post('/', sanitizeTournamentInput, add);
TournamentRouter.post('/sum-end-of-matchday-points', sumEndOfMatchdayPoints);
TournamentRouter.post('/settle-market-and-refresh-by-league', settleMarketAndRefreshByLeague);
TournamentRouter.post('/:id/sync-postponed', syncPostponedMatches);
TournamentRouter.put('/:id', sanitizeTournamentInput, update);
TournamentRouter.patch('/:id', sanitizeTournamentInput, update);
TournamentRouter.delete('/:id', remove);
