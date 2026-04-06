import { orm } from '../shared/db/orm.js';
import { Tournament } from '../Entities/Tournament/tournament.entity.js';
import { Matchday } from '../Entities/Matchday/matchday.entity.js';
import { MatchdayAutomationJob } from '../Entities/MatchdayAutomationJob/matchdayAutomationJob.entity.js';
import { GameMatch } from '../Entities/GameMatch/gameMatch.entity.js';
import { League } from '../Entities/League/league.entity.js';
import { processRankingsForCompetition, syncPlayedMatchesResultsForCompetition } from '../Entities/ExternalApi/externalApi.controler.js';
import { settleMarketAndRefreshByLeague, sumEndOfMatchdayPoints, translateLeagueRealPlayersValues } from '../Entities/Tournament/tournament.controler.js';
import type { Request, Response } from 'express';

let schedulerStarted = false;
let processing = false;
let seeding = false;

const seedIntervalMs = Number.parseInt(process.env.MATCHDAY_AUTOMATION_SEED_INTERVAL_MS ?? '', 10) || (10 * 60 * 1000);
const processIntervalMs = Number.parseInt(process.env.MATCHDAY_AUTOMATION_PROCESS_INTERVAL_MS ?? '', 10) || (60 * 1000);
const enabled = (process.env.MATCHDAY_AUTOMATION_ENABLED ?? 'true').toLowerCase() !== 'false';

function createIdempotencyKey(prefix: string, ids: Array<number | null | undefined>): string {
  return `${prefix}:${ids.map((value) => Number.isFinite(value as number) ? Number(value) : 'na').join(':')}`;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + (hours * 60 * 60 * 1000));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + (days * 24 * 60 * 60 * 1000));
}

async function invokeController(handler: (req: Request, res: Response) => Promise<void>, body: Record<string, unknown>) {
  let statusCode = 200;
  let jsonPayload: any;

  const req = { body, params: {}, query: {} } as Request;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: any) {
      jsonPayload = payload;
      return this;
    },
  } as unknown as Response;

  await handler(req, res);

  if (statusCode >= 400) {
    throw new Error(jsonPayload?.message ?? `controller error with status ${statusCode}`);
  }

  return jsonPayload;
}

async function ensureJob(params: {
  league: League;
  matchday?: Matchday | null;
  gameMatch?: GameMatch | null;
  step: 'matchday_closure' | 'postponed_recheck' | 'postponed_match_sum';
  runAt: Date;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
}) {
  const localEm = orm.em.fork();
  const existing = await localEm.findOne(MatchdayAutomationJob, { idempotencyKey: params.idempotencyKey });
  if (existing) {
    return existing;
  }

  const job = localEm.create(MatchdayAutomationJob, {
    league: params.league,
    matchday: params.matchday ?? null,
    gameMatch: params.gameMatch ?? null,
    step: params.step,
    runAt: params.runAt,
    status: 'pending',
    attempts: 0,
    idempotencyKey: params.idempotencyKey,
    payload: params.payload ?? null,
  } as any);

  await localEm.flush();
  return job;
}

async function seedJobs() {
  if (!enabled || seeding) {
    return;
  }

  seeding = true;
  try {
    const localEm = orm.em.fork();
    const now = new Date();

    const tournaments = await localEm.find(Tournament, {}, { populate: ['league'] });
    const leagueMap = new Map<number, League>();
    for (const tournament of tournaments) {
      const leagueId = Number(tournament.league?.id ?? 0);
      if (Number.isFinite(leagueId) && leagueId > 0) {
        leagueMap.set(leagueId, tournament.league as League);
      }
    }

    for (const league of leagueMap.values()) {
      const matchdays = await localEm.find(Matchday, { league }, { populate: ['league'], orderBy: { matchdayNumber: 'asc' } });

      for (const matchday of matchdays) {
        if (matchday.autoUpdateAt && matchday.autoUpdateAt.getTime() <= now.getTime()) {
          await ensureJob({
            league,
            matchday,
            step: 'matchday_closure',
            runAt: matchday.autoUpdateAt,
            idempotencyKey: createIdempotencyKey('closure', [league.id, matchday.id]),
            payload: {
              leagueId: league.id,
              matchdayNumber: matchday.matchdayNumber,
              season: matchday.season,
            },
          });
        }

        const postponedCount = await localEm.count(GameMatch, {
          matchday,
          status: 'postponed',
        } as any);

        if (postponedCount > 0) {
          if (!matchday.nextPostponedCheckAt) {
            matchday.nextPostponedCheckAt = addDays(now, 7);
          }

          if (matchday.nextPostponedCheckAt.getTime() <= now.getTime()) {
            const weekBucket = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
            await ensureJob({
              league,
              matchday,
              step: 'postponed_recheck',
              runAt: now,
              idempotencyKey: `postponed-recheck:${matchday.id}:${weekBucket}`,
              payload: {
                leagueId: league.id,
                matchdayId: matchday.id,
              },
            });
            matchday.nextPostponedCheckAt = addDays(now, 7);
          }
        } else {
          matchday.nextPostponedCheckAt = null;
        }
      }
    }

    await localEm.flush();
  } catch (error: any) {
    console.error('[matchday-automation][seed] error:', error?.message ?? error);
  } finally {
    seeding = false;
  }
}

async function executeClosureJob(job: MatchdayAutomationJob) {
  const leagueId = Number((job.league as any)?.id ?? job.league);
  const matchday = job.matchday as Matchday | null;
  if (!Number.isFinite(leagueId) || leagueId <= 0 || !matchday) {
    throw new Error('invalid closure job league/matchday');
  }

  const competitionId = Number((job.league as any)?.idEnApi ?? 0);
  if (Number.isFinite(competitionId) && competitionId > 0) {
    await syncPlayedMatchesResultsForCompetition(competitionId);
    await processRankingsForCompetition(competitionId);
  }

  await invokeController(sumEndOfMatchdayPoints as any, {
    leagueId,
    matchdayNumber: matchday.matchdayNumber,
    season: matchday.season,
  });

  await invokeController(settleMarketAndRefreshByLeague as any, { leagueId });
  await translateLeagueRealPlayersValues(leagueId);

  const localEm = orm.em.fork();
  const freshMatchday = await localEm.findOne(Matchday, { id: matchday.id });
  if (freshMatchday) {
    freshMatchday.status = 'completed';
    await localEm.flush();
  }
}

async function executePostponedRecheckJob(job: MatchdayAutomationJob) {
  const localEm = orm.em.fork();
  const matchdayId = Number((job.matchday as any)?.id ?? job.matchday);
  if (!Number.isFinite(matchdayId) || matchdayId <= 0) {
    throw new Error('invalid postponed_recheck matchday');
  }

  const matchday = await localEm.findOne(Matchday, { id: matchdayId }, { populate: ['league'] });
  if (!matchday) {
    return;
  }

  const postponedMatches = await localEm.find(GameMatch, { matchday, status: 'postponed' } as any);

  for (const postponed of postponedMatches) {
    const candidate = await localEm.findOne(GameMatch, {
      matchday,
      homeTeam: postponed.homeTeam,
      awayTeam: postponed.awayTeam,
      id: { $ne: postponed.id },
      status: { $in: ['scheduled', 'in_progress', 'finalizado'] },
    } as any, { orderBy: { startDateTime: 'desc' } });

    if (!candidate) {
      continue;
    }

    const runAt = addHours(candidate.startDateTime, 8);

    await ensureJob({
      league: matchday.league as League,
      matchday,
      gameMatch: candidate,
      step: 'postponed_match_sum',
      runAt: runAt.getTime() <= Date.now() ? new Date() : runAt,
      idempotencyKey: createIdempotencyKey('postponed-match-sum', [matchday.league.id, matchday.id, candidate.id]),
      payload: {
        leagueId: matchday.league.id,
        matchdayNumber: matchday.matchdayNumber,
        season: matchday.season,
        gameMatchId: candidate.id,
      },
    });
  }

  matchday.nextPostponedCheckAt = addDays(new Date(), 7);
  await localEm.flush();
}

async function executePostponedMatchSumJob(job: MatchdayAutomationJob) {
  const matchday = job.matchday as Matchday | null;
  const gameMatch = job.gameMatch as GameMatch | null;
  const leagueId = Number((job.league as any)?.id ?? job.league);

  if (!matchday || !gameMatch || !Number.isFinite(leagueId) || leagueId <= 0) {
    throw new Error('invalid postponed_match_sum payload');
  }

  await invokeController(sumEndOfMatchdayPoints as any, {
    leagueId,
    matchdayNumber: matchday.matchdayNumber,
    season: matchday.season,
    gameMatchId: gameMatch.id,
  });
}

async function processDueJobs() {
  if (!enabled || processing) {
    return;
  }

  processing = true;
  try {
    const localEm = orm.em.fork();
    const now = new Date();

    const jobs = await localEm.find(MatchdayAutomationJob, {
      status: 'pending',
      runAt: { $lte: now },
    } as any, {
      populate: ['league', 'matchday', 'gameMatch'],
      orderBy: { runAt: 'asc' },
      limit: 20,
    });

    for (const job of jobs) {
      job.status = 'running';
      job.startedAt = new Date();
      job.attempts = Number(job.attempts ?? 0) + 1;
      job.lastError = null;
      await localEm.flush();

      try {
        if (job.step === 'matchday_closure') {
          await executeClosureJob(job);
        } else if (job.step === 'postponed_recheck') {
          await executePostponedRecheckJob(job);
        } else if (job.step === 'postponed_match_sum') {
          await executePostponedMatchSumJob(job);
        }

        job.status = 'completed';
        job.finishedAt = new Date();
        await localEm.flush();
      } catch (error: any) {
        job.status = 'failed';
        job.lastError = error?.message ?? 'unknown automation failure';
        job.finishedAt = new Date();
        await localEm.flush();
      }
    }
  } catch (error: any) {
    console.error('[matchday-automation][process] error:', error?.message ?? error);
  } finally {
    processing = false;
  }
}

export function startMatchdayAutomationScheduler() {
  if (schedulerStarted || !enabled) {
    return;
  }

  schedulerStarted = true;
  console.log(`[matchday-automation] scheduler started (seed=${seedIntervalMs}ms process=${processIntervalMs}ms)`);

  void seedJobs();
  void processDueJobs();

  setInterval(() => {
    void seedJobs();
  }, seedIntervalMs);

  setInterval(() => {
    void processDueJobs();
  }, processIntervalMs);
}
