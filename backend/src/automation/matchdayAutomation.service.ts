import { evolveLeaguePrices } from '../shared/services/playerPrices.service.js';
import { randomUUID } from 'node:crypto';
import { LockMode } from '@mikro-orm/core';
import { orm } from '../shared/db/orm.js';
import { Tournament } from '../Entities/Tournament/tournament.entity.js';
import { Participant } from '../Entities/Participant/participant.entity.js';
import { Matchday } from '../Entities/Matchday/matchday.entity.js';
import { MatchdayAutomationJob, type MatchdayAutomationJobStep } from '../Entities/MatchdayAutomationJob/matchdayAutomationJob.entity.js';
import { GameMatch } from '../Entities/GameMatch/gameMatch.entity.js';
import { League } from '../Entities/League/league.entity.js';
import { fetchMatchRatingsForAutomation, syncPlayedMatchesResultsForCompetition } from '../Entities/ExternalApi/externalApi.controler.js';
import { captureDueLineups } from '../shared/services/historicalLineup.service.js';
import { recalculateMatchdayPoints } from '../Entities/Tournament/services/matchdayPoints.service.js';
import { commitLeagueClosure } from './leagueClosure.service.js';
import { closureTime, hoursAfter } from './closure-policy.js';

let schedulerStarted = false;
let processing = false;
let seeding = false;
const enabled = (process.env.MATCHDAY_AUTOMATION_ENABLED ?? 'true').toLowerCase() !== 'false';
const seedIntervalMs = Math.max(60_000, Number(process.env.MATCHDAY_AUTOMATION_SEED_INTERVAL_MS) || 600_000);
const processIntervalMs = Math.max(10_000, Number(process.env.MATCHDAY_AUTOMATION_PROCESS_INTERVAL_MS) || 60_000);
const later = (minutes: number) => new Date(Date.now() + minutes * 60_000);
const timingPolicy = 'kickoff-plus-5h-v2';
const idOf = (v: any): number => Number(v?.id ?? v);

async function ensureJob(league: League, matchday: Matchday, step: MatchdayAutomationJobStep, runAt: Date, key: string, match?: GameMatch) {
  const em = orm.em.fork();
  const existing = await em.findOne(MatchdayAutomationJob, { idempotencyKey: key });
  const payload = { timingPolicy, plannedAt: runAt.toISOString(), ...(match ? { kickoff: match.startDateTime.toISOString() } : {}) };
  if (existing) {
    // Upgrade old schedules and follow fixture edits, without erasing a four-hour live-game retry.
    if (step === 'matchday_closure' && ['pending', 'failed'].includes(existing.status)
      && (existing.payload?.timingPolicy !== timingPolicy || existing.payload?.plannedAt !== payload.plannedAt)) {
      await em.nativeUpdate(MatchdayAutomationJob, { id: existing.id, status: existing.status }, { status: 'pending', runAt, payload });
    }
    return;
  }
  em.create(MatchdayAutomationJob, { league, matchday, gameMatch: match ?? null, step, runAt,
    idempotencyKey: key, status: 'pending', attempts: 0, createdAt: new Date(), updatedAt: new Date(),
    payload });
  try { await em.flush(); }
  catch (error) {
    // Two workers may seed simultaneously; the unique key decides the winner.
    if (!await orm.em.fork().findOne(MatchdayAutomationJob, { idempotencyKey: key })) throw error;
  }
}

/** The persistent flag survives a change from postponed back to scheduled/finalizado. */
async function trackPending(leagueId: number, classifyDateId?: number) {
  const em = orm.em.fork();
  const matches = await em.find(GameMatch, { league: leagueId }, { populate: ['matchday', 'league'] });
  const now = new Date();
  for (const match of matches) {
    const unplayed = match.status === 'postponed' || (match.matchday.id === classifyDateId && match.status === 'scheduled'
      && hoursAfter(match.startDateTime, 5) <= now);
    if (unplayed && !match.pendingRecovery && !match.recoveryCompletedAt) {
      match.pendingRecovery = true; match.pendingOriginalStart = new Date(match.startDateTime);
    }
  }
  await em.flush();
  for (const match of matches) {
    if (!match.pendingRecovery || match.status === 'cancelled' || match.status === 'postponed') continue;
    const rescheduled = match.pendingOriginalStart && match.startDateTime.getTime() !== match.pendingOriginalStart.getTime();
    if (rescheduled || ['finalizado', 'in_progress'].includes(match.status)) {
      await ensureJob(match.league, match.matchday, 'postponed_match_sum', hoursAfter(match.startDateTime, 5),
        'recovery:' + match.id + ':' + match.startDateTime.getTime(), match);
    }
  }
}

async function synchronize(competitionId: number, ids: number[]) {
  if (!ids.length) return;
  const result = await syncPlayedMatchesResultsForCompetition(competitionId, ids);
  if (result.errors.length || result.missingPayloadData) {
    throw new Error('Match status incomplete: ' + result.errors.map(e => e.message).join('; ') + '; missing=' + result.missingPayloadData);
  }
}

/** Started automatically by app.ts; the administrator endpoint uses the same kickoff-based gate. */
export async function runLeagueMatchdayClosure(matchdayId: number): Promise<{ completed: boolean; retryAt?: Date; data?: unknown }> {
  let em = orm.em.fork();
  let date = await em.findOneOrFail(Matchday, { id: matchdayId }, { populate: ['league'] });
  if (date.closureCompletedAt) return { completed: true, data: date.closureSummary };
  if (!date.league.idEnApi) throw new Error('League has no external competition id');
  // Local scheduling uses no external requests, including when someone presses the admin button early.
  await trackPending(idOf(date.league));
  const initial = await em.find(GameMatch, { matchday: date });
  const plannedAt = closureTime(initial);
  if (!plannedAt) return { completed: false, retryAt: hoursAfter(new Date(), 4) };
  const nextAttemptAt = date.autoUpdateAt && date.autoUpdateAt > plannedAt ? date.autoUpdateAt : plannedAt;
  if (nextAttemptAt > new Date()) return { completed: false, retryAt: nextAttemptAt };
  const matches = await em.find(GameMatch, { league: date.league,
    $or: [{ matchday: date }, { pendingRecovery: true }], status: { $ne: 'cancelled' },
  });
  await synchronize(date.league.idEnApi, matches.map(m => m.id!));
  await trackPending(idOf(date.league), date.id!);
  em = orm.em.fork();
  date = await em.findOneOrFail(Matchday, { id: matchdayId }, { populate: ['league'] });
  const current = await em.find(GameMatch, { matchday: date });
  const due = closureTime(current);
  // The one scheduled status request may reveal a changed kickoff or a game still in progress.
  const retryAt = current.some(m => m.status === 'in_progress') ? hoursAfter(new Date(), 4)
    : due && due > new Date() ? due : null;
  date.autoUpdateAt = retryAt ?? due;
  await em.flush();
  if (retryAt) return { completed: false, retryAt };
  // 1. Fetch every played player's rating in this round. Partial failures prevent economic effects.
  await fetchMatchRatingsForAutomation(date.league.idEnApi!, current.filter(m => m.status === 'finalizado').map(m => m.id!));
  await evolveLeaguePrices(orm.em.fork(), idOf(date.league));
  // 2 -> 3 -> 4 -> 5, committed atomically with a durable completion marker.
  const data = await commitLeagueClosure(orm.em.fork(), date.id!);
  return { completed: true, data };
}

async function recoverMatch(job: MatchdayAutomationJob): Promise<Date | null> {
  let em = orm.em.fork();
  let match = await em.findOneOrFail(GameMatch, { id: idOf(job.gameMatch) }, { populate: ['league', 'matchday'] });
  if (!match.pendingRecovery || match.recoveryCompletedAt || match.status === 'cancelled') return null;
  const plannedAt = hoursAfter(match.startDateTime, 5);
  if (plannedAt > new Date()) return plannedAt;
  await synchronize(match.league.idEnApi!, [match.id!]);
  await trackPending(idOf(match.league));
  em = orm.em.fork();
  match = await em.findOneOrFail(GameMatch, { id: match.id }, { populate: ['league', 'matchday'] });
  // A new kickoff creates a different durable job. The old schedule must not fetch ratings early.
  if (job.payload?.kickoff && match.startDateTime.toISOString() !== job.payload.kickoff) return null;
  const due = hoursAfter(match.startDateTime, 5);
  if (due > new Date()) return due;
  if (match.status !== 'finalizado') return hoursAfter(new Date(), 4);
  await fetchMatchRatingsForAutomation(match.league.idEnApi!, [match.id!]);
  await evolveLeaguePrices(orm.em.fork(), idOf(match.league));
  await em.transactional(async tx => {
    await tx.findOneOrFail(League, { id: idOf(match.league) }, { lockMode: LockMode.PESSIMISTIC_WRITE });
    const fresh = await tx.findOneOrFail(GameMatch, { id: match.id }, { populate: ['matchday', 'league'], lockMode: LockMode.PESSIMISTIC_WRITE });
    if (fresh.recoveryCompletedAt) return;
    // Whole-round rebuild preserves other matches and updates only historical contributions.
    await recalculateMatchdayPoints(tx, fresh.league, fresh.matchday);
    fresh.pendingRecovery = false; fresh.recoveryCompletedAt = new Date();
    await tx.flush();
  });
  return null;
}

export async function seedMatchdayJobs() {
  if (!enabled || seeding) return;
  seeding = true;
  try {
    const em = orm.em.fork();
    const tournaments = await em.find(Tournament, { initialDrawState: { $ne: 'waiting' } }, { populate: ['league'] });
    const members = tournaments.length ? await em.find(Participant, { tournament: { $in: tournaments.map(t => t.id!) }, retiredAt: null }) : [];
    const activeTournamentIds = new Set(members.map(p => idOf(p.tournament)));
    const leagues = new Map(tournaments.filter(t => activeTournamentIds.has(t.id!)).map(t => [idOf(t.league), t.league]));
    for (const league of leagues.values()) {
      await trackPending(league.id!);
      const dates = await em.find(Matchday, { league, closureCompletedAt: null, status: { $ne: 'cancelled' } }, { orderBy: [{ season: 'asc' }, { matchdayNumber: 'asc' }] });
      for (const date of dates) {
        const matches = await em.find(GameMatch, { matchday: date });
        if (!matches.length) continue;
        const plannedAt = closureTime(matches)!;
        await ensureJob(league, date, 'matchday_closure', plannedAt, 'closure:' + league.id + ':' + date.id);
        const job = await orm.em.fork().findOne(MatchdayAutomationJob, { idempotencyKey: 'closure:' + league.id + ':' + date.id });
        date.autoUpdateAt = job?.runAt ?? plannedAt;
      }
      await em.flush();
    }
  } catch (error: any) { console.error('[matchday-automation][seed]', error?.message ?? error); }
  finally { seeding = false; }
}

export async function processDueMatchdayJobs() {
  if (!enabled || processing) return;
  processing = true;
  try {
    const em = orm.em.fork();
    const now = new Date();
    await captureDueLineups(em, now);
    // Crashed processes leave an expiring lease, never a job stuck in running forever.
    await em.nativeUpdate(MatchdayAutomationJob, { status: 'running', $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: null }] }, { status: 'pending', leaseToken: null });
    const jobs = await em.find(MatchdayAutomationJob, { status: { $in: ['pending', 'failed'] }, runAt: { $lte: now } }, {
      populate: ['league', 'matchday', 'gameMatch'], orderBy: [{ runAt: 'asc' }, { id: 'asc' }], limit: 20,
    });
    for (const job of jobs) {
      const token = randomUUID();
      const claimed = await orm.em.fork().nativeUpdate(MatchdayAutomationJob, { id: job.id, status: job.status, runAt: { $lte: new Date() } }, {
        status: 'running', leaseToken: token, leaseUntil: later(5), startedAt: new Date(), attempts: Number(job.attempts) + 1, lastError: null,
      });
      if (!claimed) continue;
      const owned = { id: job.id, status: 'running' as const, leaseToken: token };
      const heartbeat = setInterval(() => { void orm.em.fork().nativeUpdate(MatchdayAutomationJob, owned, { leaseUntil: later(5) }).catch(console.error); }, 30_000);
      try {
        let retryAt: Date | null = null;
        if (job.step === 'matchday_closure') {
          const result = await runLeagueMatchdayClosure(idOf(job.matchday));
          if (!result.completed) retryAt = result.retryAt ?? later(30);
        } else if (job.step === 'postponed_match_sum') retryAt = await recoverMatch(job);
        // Legacy daily rechecks complete without API calls. Unknown postponements are checked at league closures.

        await orm.em.fork().nativeUpdate(MatchdayAutomationJob, owned, {
          status: retryAt ? 'pending' : 'completed', runAt: retryAt ?? job.runAt,
          finishedAt: retryAt ? null : new Date(), leaseUntil: null, leaseToken: null,
        });
      } catch (error: any) {
        const message = String(error?.message ?? error).slice(0, 4000);
        const rateLimited = /429|rate.?limit|quota|too.?many/i.test(message);
        await orm.em.fork().nativeUpdate(MatchdayAutomationJob, owned, { status: 'pending', runAt: rateLimited ? hoursAfter(new Date(), 24) : later(Math.min(60, 5 * (Number(job.attempts) + 1))),
          lastError: message, leaseUntil: null, leaseToken: null });
        console.error('[matchday-automation][job=' + job.id + ']', message);
      } finally { clearInterval(heartbeat); }
    }
  } catch (error: any) { console.error('[matchday-automation][process]', error?.message ?? error); }
  finally { processing = false; }
}

export function startMatchdayAutomationScheduler() {
  if (schedulerStarted || !enabled) return;
  schedulerStarted = true;
  console.log('[matchday-automation] persistent scheduler started');
  void seedMatchdayJobs().then(() => processDueMatchdayJobs());
  setInterval(() => { void seedMatchdayJobs(); }, seedIntervalMs);
  setInterval(() => { void processDueMatchdayJobs(); }, processIntervalMs);
}
