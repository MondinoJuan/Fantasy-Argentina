import 'reflect-metadata';
import express, {Request, Response, NextFunction} from 'express';
import { orm, syncSchema } from './shared/db/orm.js';
import { RequestContext } from '@mikro-orm/mysql';
import { UserRouter } from './Entities/User/user.routes.js';
import { TournamentRouter } from './Entities/Tournament/tournament.routes.js';
import { LeagueRouter } from './Entities/League/league.routes.js';
import { ParticipantRouter } from './Entities/Participant/participant.routes.js';
import { RealPlayerRouter } from './Entities/RealPlayer/realPlayer.routes.js';
import { RealTeamRouter } from './Entities/RealTeam/realTeam.routes.js';
import { ParticipantSquadRouter } from './Entities/ParticipantSquad/participantSquad.routes.js';
import { MatchdayRouter } from './Entities/Matchday/matchday.routes.js';
import { MatchRouter } from './Entities/Match/match.routes.js';
import { MatchdayMarketRouter } from './Entities/MatchdayMarket/matchdayMarket.routes.js';
import { BidRouter } from './Entities/Bid/bid.routes.js';
import { PlayerPerformanceRouter } from './Entities/PlayerPerformance/playerPerformance.routes.js';
import { ParticipantMatchdayPointsRouter } from './Entities/ParticipantMatchdayPoints/participantMatchdayPoints.routes.js';
import { PlayerPointsBreakdownRouter } from './Entities/PlayerPointsBreakdown/playerPointsBreakdown.routes.js';
import { PlayerClauseRouter } from './Entities/PlayerClause/playerClause.routes.js';
import { ShieldingRouter } from './Entities/Shielding/shielding.routes.js';
import { TransactionRouter } from './Entities/Transaction/transaction.routes.js';
import { NegotiationRouter } from './Entities/Negotiation/negotiation.routes.js';
import { ExternalApiRouter } from './Entities/ExternalApi/externalApi.routes.js';
import { SportRouter } from './Entities/Sport/sport.routes.js';
import { DependantPlayerRouter } from './Entities/DependantPlayer/dependantPlayer.routes.js';
import { UltSeasonRouter } from './Entities/UltSeason/ultSeason.routes.js';
import "dotenv/config";

const app = express();
app.use(express.json());

// luego del middleware base
app.use((req, res, next) => {
    RequestContext.create(orm.em, next);
});
// previo a las rutas y middleware de negocio

app.use('/api/users', UserRouter)
app.use('/api/tournaments', TournamentRouter)
app.use('/api/leagues', LeagueRouter)
app.use('/api/participants', ParticipantRouter)
app.use('/api/real-players', RealPlayerRouter)
app.use('/api/real-teams', RealTeamRouter)
app.use('/api/dependant-players', DependantPlayerRouter)
app.use('/api/participant-squads', ParticipantSquadRouter)
app.use('/api/matchdays', MatchdayRouter)
app.use('/api/matches', MatchRouter)
app.use('/api/matchday-markets', MatchdayMarketRouter)
app.use('/api/bids', BidRouter)
app.use('/api/player-performances', PlayerPerformanceRouter)
app.use('/api/participant-matchday-points', ParticipantMatchdayPointsRouter)
app.use('/api/player-points-breakdowns', PlayerPointsBreakdownRouter)
app.use('/api/player-clauses', PlayerClauseRouter)
app.use('/api/shieldings', ShieldingRouter)
app.use('/api/transactions', TransactionRouter)
app.use('/api/negotiations', NegotiationRouter)
app.use('/api/external', ExternalApiRouter)
app.use('/api/sports', SportRouter)
app.use('/api/ult-seasons', UltSeasonRouter)

app.use((_, res) => {
    return res.status(404).send({ error: 'Resource not found' });
});

await syncSchema();     // never in production
/*
app.listen(3000, '0.0.0.0', () => {
    console.log('Server is running on http://localhost:3000');
});
*/
const PORT = Number(process.env.PORT ?? 3000);

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Listening on http://127.0.0.1:${PORT}`);
});
