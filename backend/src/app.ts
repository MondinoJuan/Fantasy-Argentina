import 'reflect-metadata';
import express from 'express';
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
import { GameMatchRouter } from './Entities/GameMatch/gameMatch.routes.js';
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
import { AuthRouter } from './Entities/Auth/auth.routes.js';
import "dotenv/config";
import { requireAuth } from './shared/http/auth.middleware.js';
import { serverNow, serverNowMs } from './shared/time/serverClock.js';

function getAllowedCorsOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS ?? '';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function securityHeadersMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const allowedOrigins = getAllowedCorsOrigins();
  const requestOrigin = req.headers.origin;

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-XSS-Protection', '0');

  if ((process.env.NODE_ENV ?? 'development') === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }

  return next();
}

const requestRateByIp = new Map<string, { hits: number; windowStart: number }>();

function getRateLimitConfig() {
  const windowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '', 10);
  const maxRequests = Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '', 10);

  return {
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 15 * 60 * 1000,
    maxRequests: Number.isFinite(maxRequests) && maxRequests > 0 ? maxRequests : 500,
  };
}

function rateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const { windowMs, maxRequests } = getRateLimitConfig();
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const now = serverNowMs();
  const entry = requestRateByIp.get(ip);

  if (!entry || now - entry.windowStart >= windowMs) {
    requestRateByIp.set(ip, { hits: 1, windowStart: now });
    return next();
  }

  entry.hits += 1;
  if (entry.hits > maxRequests) {
    return res.status(429).json({ message: 'Rate limit exceeded. Try again later.' });
  }

  return next();
}



const mutationRateByActor = new Map<string, { hits: number; windowStart: number }>();

function getMutationRateLimitConfig() {
  const windowMs = Number.parseInt(process.env.MUTATION_RATE_LIMIT_WINDOW_MS ?? '', 10);
  const maxRequests = Number.parseInt(process.env.MUTATION_RATE_LIMIT_MAX_REQUESTS ?? '', 10);

  return {
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60_000,
    maxRequests: Number.isFinite(maxRequests) && maxRequests > 0 ? maxRequests : 90,
  };
}

function mutationRateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const { windowMs, maxRequests } = getMutationRateLimitConfig();
  const actor = String(req.authUser?.id ?? req.ip ?? req.socket.remoteAddress ?? 'unknown');
  const now = serverNowMs();
  const entry = mutationRateByActor.get(actor);

  if (!entry || now - entry.windowStart >= windowMs) {
    mutationRateByActor.set(actor, { hits: 1, windowStart: now });
    return next();
  }

  entry.hits += 1;
  if (entry.hits > maxRequests) {
    return res.status(429).json({ message: 'Too many mutation requests. Slow down and retry.' });
  }

  return next();
}

function requestTimeoutMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const timeoutMsRaw = Number.parseInt(process.env.REQUEST_TIMEOUT_MS ?? '', 10);
  const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 15_000;

  res.setTimeout(timeoutMs, () => {
    if (!res.headersSent) {
      res.status(503).json({ message: 'Request timeout exceeded. Please retry.' });
    }
  });

  next();
}

const app = express();
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? '256kb' }));
app.use(securityHeadersMiddleware);
app.use(requestTimeoutMiddleware);
app.use(rateLimitMiddleware);
app.set('trust proxy', 1);

// luego del middleware base
app.use((req, res, next) => {
    RequestContext.create(orm.em, next);
});
// previo a las rutas y middleware de negocio

app.use('/api/auth', AuthRouter)
app.use('/api', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/users') {
    return next();
  }

  return requireAuth(req, res, next);
});
app.use('/api', mutationRateLimitMiddleware);
app.get('/api/time/now', (_req, res) => {
  const now = serverNow();
  return res.status(200).json({
    message: 'server time',
    data: {
      now: now.toISOString(),
      nowMs: now.getTime(),
    },
  });
});
app.use('/api/users', UserRouter)
app.use('/api/tournaments', TournamentRouter)
app.use('/api/leagues', LeagueRouter)
app.use('/api/participants', ParticipantRouter)
app.use('/api/real-players', RealPlayerRouter)
app.use('/api/real-teams', RealTeamRouter)
app.use('/api/dependant-players', DependantPlayerRouter)
app.use('/api/participant-squads', ParticipantSquadRouter)
app.use('/api/matchdays', MatchdayRouter)
app.use('/api/matches', GameMatchRouter)
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

if ((process.env.DB_SYNC_SCHEMA ?? 'false').toLowerCase() === 'true') {
  await syncSchema();
}
// TODO(deploy): en producción usar migraciones y NO activar DB_SYNC_SCHEMA.
/*
app.listen(3000, '0.0.0.0', () => {
    console.log('Server is running on http://localhost:3000');
});
*/

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Listening on http://${HOST}:${PORT}`);
});
