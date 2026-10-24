import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleUrl, dataUrl } from './helpers/load-ts-module.mjs';

const policy = await import(moduleUrl(new URL('../src/automation/closure-policy.ts', import.meta.url)));
const { closureTime, dateRewards, compareBids, randomSelection, sportsMatchStatus, hoursAfter } = policy;
const time = new Date('2020-10-10T20:00:00Z');
test('closure is planned five hours after kickoff without requiring a final timestamp', () => {
  assert.equal(closureTime([{ status: 'scheduled', startDateTime: time }]).getTime(), hoursAfter(time, 5).getTime());
  assert.equal(closureTime([{ status: 'finalizado', startDateTime: time, finishedAt: hoursAfter(time, 2) }]).getTime(), hoursAfter(time, 5).getTime());
  assert.equal(closureTime([]), null);
});
test('rescheduled pending games do not delay the regular round closure', () => {
  const matches = [{ status: 'finalizado', startDateTime: time },
    { status: 'scheduled', startDateTime: hoursAfter(time, 240), pendingRecovery: true, pendingOriginalStart: time }];
  assert.equal(closureTime(matches).getTime(), hoursAfter(time, 5).getTime());
});
test('entirely postponed rounds retain their original round boundary plus five hours', () => {
  assert.equal(closureTime([{ status: 'postponed', startDateTime: hoursAfter(time, 240), pendingOriginalStart: time }]).getTime(), hoursAfter(time, 5).getTime());
});
test('a score does not imply a finished match; suspended matches stay pending', () => {
  for (const [status, expected] of [['live', 'in_progress'], ['Halftime', 'in_progress'], ['Ended', 'finalizado'], ['FT', 'finalizado'],
    ['finalizado', 'finalizado'], ['Suspended', 'postponed'], ['postponed', 'postponed'], ['Cancelled', 'cancelled'], ['notstarted', 'scheduled']]) {
    assert.equal(sportsMatchStatus(status), expected);
  }
});
test('economic tiers and ties use the date standings, with equal prizes for equal points', () => {
  const rewards = dateRewards([10, 9, 8, 8, 7, 6, 5].map((points, i) => ({ id: i + 1, points })));
  assert.deepEqual(rewards.map(r => r.rank), [1, 2, 3, 3, 5, 6, 7]);
  assert.deepEqual(rewards.map(r => r.amount), [1e6, 1e6, 1e6, 1e6, 1.5e6, 1.5e6, 2e6]);
});
test('bid ties resolve deterministically and markets draw without duplicates', () => {
  const bids = [{ id: 2, offeredAmount: 20, bidDate: time }, { id: 1, offeredAmount: 20, bidDate: time },
    { id: 3, offeredAmount: 10, bidDate: hoursAfter(time, -1) }];
  assert.deepEqual(bids.sort(compareBids).map(b => b.id), [1, 2, 3]);
  assert.deepEqual(randomSelection([1, 2, 3, 4], 3, () => 0), [1, 2, 3]);
});

const names = ['League', 'Matchday', 'Tournament', 'Participant', 'ParticipantSquad', 'MatchdayMarket', 'Bid', 'DependantPlayer', 'RealPlayer', 'ParticipantMatchdayPoints', 'GameMatch', 'MatchdayAutomationJob', 'PlayerOwnership', 'OwnershipMovement', 'Transaction', 'Negotiation', 'PlayerClause'];
const classesUrl = dataUrl(names.map(n => `export class ${n} {}`).join('\n'));
const classes = await import(classesUrl);
const aliases = new Map([['@mikro-orm/core', dataUrl("export const LockMode = { PESSIMISTIC_WRITE: 'write' }; export const FlushMode = { COMMIT: 'commit' };")], ['node:crypto', dataUrl("let n=0; export function randomUUID() { return 'test-' + ++n; }")]]);
for (const n of names) aliases.set(new URL(`../src/Entities/${n}/${n[0].toLowerCase() + n.slice(1)}.entity.js`, import.meta.url).href, classesUrl);
aliases.set(new URL('../src/Entities/RealTeamLeagueParticipation/realTeamLeagueParticipation.service.js', import.meta.url).href,
  dataUrl('export async function getTeamIdsByLeague() { return [1]; }'));
aliases.set(new URL('../src/Entities/Tournament/services/matchdayPoints.service.js', import.meta.url).href,
  dataUrl('export async function recalculateMatchdayPoints(em, league, date) { return globalThis.scoreClosure(em, league, date); }'));
const { commitLeagueClosure } = await import(moduleUrl(new URL('../src/automation/leagueClosure.service.ts', import.meta.url), aliases));
const id = v => v?.id ?? v;
function matches(row, query) {
  return Object.entries(query).every(([key, value]) => {
    if (key === '$or') return value.some(v => matches(row, v));
    if (key === '$and') return value.every(v => matches(row, v));
    const actual = row[key];
    if (value == null) return actual == null;
    if (typeof value === 'object' && !(value instanceof Date)) {
      if ('$in' in value) return value.$in.map(id).includes(id(actual));
      if ('$nin' in value) return !value.$nin.map(id).includes(id(actual));
      if ('$ne' in value) return value.$ne == null ? actual != null : id(actual) !== id(value.$ne);
      if ('$gt' in value) return actual > value.$gt;
      if ('$lte' in value) return actual <= value.$lte;
      if (value.id !== undefined && Object.keys(value).length === 1) return id(actual) === value.id;
      return matches(actual ?? {}, value);
    }
    return id(actual) === id(value);
  });
}

const schedulerAliases = new Map(aliases);
schedulerAliases.set(new URL('../src/shared/services/playerPrices.service.js', import.meta.url).href,
  dataUrl('export async function evolveLeaguePrices() {}'));
schedulerAliases.set('node:crypto', dataUrl("let n=0; export function randomUUID() { return 'claim-' + ++n; }"));
schedulerAliases.set(new URL('../src/shared/db/orm.js', import.meta.url).href,
  dataUrl('export const orm = { get em() { return globalThis.automationEm; } };'));
schedulerAliases.set(new URL('../src/Entities/ExternalApi/externalApi.controler.js', import.meta.url).href,
  dataUrl('export async function fetchMatchRatingsForAutomation(...args) { return globalThis.fetchRatings(...args); } export async function syncPlayedMatchesResultsForCompetition(...args) { return globalThis.syncMatches(...args); }'));
schedulerAliases.set(new URL('../src/shared/services/historicalLineup.service.js', import.meta.url).href,
  dataUrl('export async function captureDueLineups() {}'));
schedulerAliases.set(new URL('../src/automation/leagueClosure.service.js', import.meta.url).href,
  dataUrl('export async function commitLeagueClosure(...args) { return globalThis.commitClosure(...args); }'));
const scheduler = await import(moduleUrl(new URL('../src/automation/matchdayAutomation.service.ts', import.meta.url), schedulerAliases));

function schedulerFixture() {
  const f = fixture();
  f.tables.get('League')[0].idEnApi = 47;
  f.em.fork = () => f.em;
  f.em.nativeUpdate = async (cls, query, changes) => {
    const rows = await f.em.find(cls, query);
    for (const row of rows) Object.assign(row, changes);
    return rows.length;
  };
  globalThis.automationEm = f.em;
  f.apiEvents = [];
  globalThis.fetchRatings = async (...args) => { f.apiEvents.push(['ratings', ...args]); };
  globalThis.syncMatches = async (...args) => { f.apiEvents.push(['status', ...args]); return { errors: [], missingPayloadData: 0 }; };
  globalThis.commitClosure = async () => { f.apiEvents.push(['commit']); f.date.closureCompletedAt = new Date(); return { ok: true }; };
  f.addMatch = data => {
    const m = Object.assign(new classes.GameMatch(), { id: 1, matchday: f.date, league: f.tables.get('League')[0],
      startDateTime: hoursAfter(new Date(), -8), status: 'finalizado', finishedAt: hoursAfter(new Date(), -6), pendingRecovery: false, ...data });
    f.tables.get('GameMatch').push(m); return m;
  };
  return f;
}
test('orchestrator fetches ratings before calling the economic transaction', async () => {
  const f = schedulerFixture(); f.addMatch({});
  assert.equal((await scheduler.runLeagueMatchdayClosure(1)).completed, true);
  assert.deepEqual(f.apiEvents.map(e => e[0]), ['status', 'ratings', 'commit']);
  await scheduler.runLeagueMatchdayClosure(1);
  assert.equal(f.apiEvents.length, 3, 'completed closure does not query or pay again');
});
test('no API calls before kickoff plus five hours, and API errors prevent settlement', async () => {
  const f = schedulerFixture(); const m = f.addMatch({ startDateTime: hoursAfter(new Date(), -3), finishedAt: null });
  assert.equal((await scheduler.runLeagueMatchdayClosure(1)).completed, false);
  assert.deepEqual(f.apiEvents, []);
  m.startDateTime = hoursAfter(new Date(), -8);
  globalThis.fetchRatings = async () => { throw Error('429 API quota'); };
  await assert.rejects(scheduler.runLeagueMatchdayClosure(1), /429/);
  assert.equal(f.date.closureCompletedAt, undefined);
});
test('same postponed match is rescheduled in place for exactly kickoff plus five hours', async () => {
  const f = schedulerFixture(); f.addMatch({});
  const original = hoursAfter(new Date(), -48);
  const newKickoff = hoursAfter(new Date(), 48);
  const pending = f.addMatch({ id: 2, status: 'postponed', startDateTime: original, finishedAt: null });
  globalThis.syncMatches = async () => { pending.status = 'scheduled'; pending.startDateTime = newKickoff; return { errors: [], missingPayloadData: 0 }; };
  await scheduler.runLeagueMatchdayClosure(1);
  assert.equal(pending.pendingRecovery, true);
  assert.equal(pending.pendingOriginalStart.getTime(), original.getTime());
  const job = f.tables.get('MatchdayAutomationJob').find(j => j.step === 'postponed_match_sum');
  assert.equal(job.gameMatch.id, 2);
  assert.equal(job.runAt.getTime(), hoursAfter(newKickoff, 5).getTime());
});
test('seeding is automatic, reads only MySQL, and updates legacy schedules to kickoff plus five hours', async () => {
  const f = schedulerFixture(); const match = f.addMatch({ startDateTime: hoursAfter(new Date(), 24), status: 'scheduled', finishedAt: null });
  const legacy = f.em.create(classes.MatchdayAutomationJob, { league: match.league, matchday: f.date,
    step: 'matchday_closure', status: 'pending', runAt: new Date(), attempts: 0, idempotencyKey: 'closure:1:1' });
  await scheduler.seedMatchdayJobs();
  assert.equal(legacy.runAt.getTime(), hoursAfter(match.startDateTime, 5).getTime());
  assert.deepEqual(f.apiEvents, []);
  assert.equal(f.tables.get('MatchdayAutomationJob').some(j => j.step === 'postponed_recheck'), false);
});
test('retaining an empty tournament for history does not create new league polling jobs', async () => {
  const f = schedulerFixture(); f.addMatch({}); f.tables.set('Participant', []);
  await scheduler.seedMatchdayJobs();
  assert.equal(f.tables.get('MatchdayAutomationJob').length, 0);
  assert.deepEqual(f.apiEvents, []);
});
test('lobbies alone never schedule league polling jobs or consume provider queries', async () => {
  const f = schedulerFixture(); f.addMatch({});
  for (const tournament of f.tables.get('Tournament')) tournament.initialDrawState = 'waiting';
  await scheduler.seedMatchdayJobs();
  assert.equal(f.tables.get('MatchdayAutomationJob').length, 0);
  assert.deepEqual(f.apiEvents, []);
});
test('live match postpones the entire closure by four hours and seeding preserves that retry', async () => {
  const f = schedulerFixture(); const m = f.addMatch({ status: 'in_progress', finishedAt: null });
  await scheduler.seedMatchdayJobs();
  const job = f.tables.get('MatchdayAutomationJob').find(j => j.step === 'matchday_closure');
  const before = Date.now();
  await scheduler.processDueMatchdayJobs();
  assert.equal(job.status, 'pending');
  assert.ok(job.runAt.getTime() >= before + 4 * 3_600_000);
  assert.ok(job.runAt.getTime() <= Date.now() + 4 * 3_600_000);
  assert.deepEqual(f.apiEvents.map(e => e[0]), ['status']);
  const retryAt = job.runAt.getTime();
  await scheduler.seedMatchdayJobs();
  assert.equal(job.runAt.getTime(), retryAt);
  await scheduler.processDueMatchdayJobs();
  assert.equal(f.apiEvents.length, 1, 'no further API polling before the retry');
  assert.equal(m.pendingRecovery, false);
});
test('a finished game needs no additional final-whistle delay', async () => {
  const f = schedulerFixture(); f.addMatch({ startDateTime: hoursAfter(new Date(), -6), finishedAt: null });
  assert.equal((await scheduler.runLeagueMatchdayClosure(1)).completed, true);
  assert.deepEqual(f.apiEvents.map(e => e[0]), ['status', 'ratings', 'commit']);
});
test('live postponed recovery also waits four hours before another query', async () => {
  const f = schedulerFixture(); const m = f.addMatch({ status: 'in_progress', pendingRecovery: true, finishedAt: null });
  const job = f.em.create(classes.MatchdayAutomationJob, { league: m.league, matchday: f.date, gameMatch: m,
    step: 'postponed_match_sum', status: 'pending', runAt: hoursAfter(new Date(), -1), attempts: 0,
    payload: { kickoff: m.startDateTime.toISOString() }, idempotencyKey: 'live-recovery' });
  const before = Date.now();
  await scheduler.processDueMatchdayJobs();
  assert.equal(job.status, 'pending');
  assert.ok(job.runAt.getTime() >= before + 4 * 3_600_000);
  assert.deepEqual(f.apiEvents.map(e => e[0]), ['status']);
});
test('recovery at five hours refreshes ratings and rebuilds scores without another economic closure', async () => {
  const f = schedulerFixture(); f.date.closureCompletedAt = new Date();
  const m = f.addMatch({ pendingRecovery: true, pendingOriginalStart: hoursAfter(new Date(), -48) });
  const job = f.em.create(classes.MatchdayAutomationJob, { league: m.league, matchday: f.date, gameMatch: m,
    step: 'postponed_match_sum', status: 'pending', runAt: hoursAfter(new Date(), -1), attempts: 0,
    payload: { kickoff: m.startDateTime.toISOString() }, idempotencyKey: 'recovery-test' });
  globalThis.scoreClosure = async () => { f.apiEvents.push(['recalculate']); };
  await scheduler.processDueMatchdayJobs();
  assert.equal(job.status, 'completed');
  assert.ok(m.recoveryCompletedAt);
  assert.equal(m.pendingRecovery, false);
  assert.deepEqual(f.apiEvents.map(e => e[0]), ['status', 'ratings', 'recalculate']);
  assert.ok(f.participants.every(p => p.bankBudget === 20e6));
});
test('API errors keep recovery pending with its reservation-free economic state unchanged', async () => {
  const f = schedulerFixture(); const m = f.addMatch({ pendingRecovery: true });
  const job = f.em.create(classes.MatchdayAutomationJob, { league: m.league, matchday: f.date, gameMatch: m,
    step: 'postponed_match_sum', status: 'pending', runAt: hoursAfter(new Date(), -1), attempts: 0,
    payload: { kickoff: m.startDateTime.toISOString() }, idempotencyKey: 'recovery-failure' });
  globalThis.syncMatches = async () => ({ errors: [{ message: '429 quota exceeded' }], missingPayloadData: 0 });
  await scheduler.processDueMatchdayJobs();
  assert.equal(job.status, 'pending');
  assert.match(job.lastError, /429/);
  assert.ok(job.runAt > hoursAfter(new Date(), 23));
  assert.equal(job.leaseToken, null);
  assert.equal(m.recoveryCompletedAt, undefined);
});
test('another postponement retires the old recovery job and schedules the new kickoff', async () => {
  const f = schedulerFixture();
  const m = f.addMatch({ pendingRecovery: true, pendingOriginalStart: hoursAfter(new Date(), -48) });
  const job = f.em.create(classes.MatchdayAutomationJob, { league: m.league, matchday: f.date, gameMatch: m,
    step: 'postponed_match_sum', status: 'pending', runAt: hoursAfter(new Date(), -1), attempts: 0,
    payload: { kickoff: m.startDateTime.toISOString() }, idempotencyKey: 'old-start' });
  const newKickoff = hoursAfter(new Date(), 24);
  globalThis.syncMatches = async () => { m.status = 'scheduled'; m.startDateTime = newKickoff; return { errors: [], missingPayloadData: 0 }; };
  await scheduler.processDueMatchdayJobs();
  assert.equal(job.status, 'completed');
  assert.ok(f.tables.get('MatchdayAutomationJob').some(j => j !== job && j.runAt.getTime() === hoursAfter(newKickoff, 5).getTime()));
  assert.equal(f.apiEvents.some(e => e[0] === 'ratings'), false);
  assert.equal(m.recoveryCompletedAt, undefined);
});
test('an expired worker lease is recovered and a failed atomic claim performs no actions', async () => {
  const f = schedulerFixture(); f.addMatch({});
  const job = f.em.create(classes.MatchdayAutomationJob, { league: f.tables.get('League')[0], matchday: f.date,
    step: 'matchday_closure', status: 'running', runAt: hoursAfter(new Date(), -1), attempts: 1,
    leaseUntil: hoursAfter(new Date(), -1), leaseToken: 'dead-process', idempotencyKey: 'crashed-closure' });
  await scheduler.processDueMatchdayJobs();
  assert.equal(job.status, 'completed');
  assert.equal(job.leaseToken, null);
  assert.equal(job.attempts, 2);
  f.date.closureCompletedAt = null; f.apiEvents.length = 0;
  job.status = 'pending';
  const update = f.em.nativeUpdate.bind(f.em);
  f.em.nativeUpdate = async (cls, query, changes) => changes.leaseToken ? 0 : update(cls, query, changes);
  await scheduler.processDueMatchdayJobs();
  assert.deepEqual(f.apiEvents, []);
});
function fixture({ insufficientPlayers = false, failScore = false, fullSquad = false } = {}) {
  const tables = new Map(names.map(n => [n, []]));
  const add = (name, data) => { const entity = Object.assign(new classes[name](), data); tables.get(name).push(entity); return entity; };
  const league = add('League', { id: 1 });
  const date = add('Matchday', { id: 1, league, season: '2020', matchdayNumber: 1 });
  const next = add('Matchday', { id: 2, league, season: '2020', matchdayNumber: 2 });
  const participants = [];
  for (let t = 1; t <= 2; t++) {
    const tournament = add('Tournament', { id: t, league });
    for (let j = 0; j < 2; j++) {
      const p = add('Participant', { id: participants.length + 1, tournament, bankBudget: 20e6, availableMoney: 20e6, reservedMoney: 0 }); participants.push(p);
      add('RealPlayer', { id: 100 + p.id, active: true, realTeam: 1 });
      add('ParticipantSquad', { id: p.id, participant: p, formation: '4-4-2', startingRealPlayersIds: [100 + p.id],
        substitutesRealPlayersIds: fullSquad && p.id === 1 ? [201, 202, 203, 204, 205] : [], acquisitionDate: time });
    }
  }
  if (fullSquad) for (let i=201; i<=205; i++) add('RealPlayer', { id: i, active: true, realTeam: 1 });
  const player = add('RealPlayer', { id: 10, active: true, realTeam: 1 });
  const d = add('DependantPlayer', { id: 10, tournament: participants[0].tournament, realPlayer: player, marketAppearances: 1 });
  const market = add('MatchdayMarket', { id: 10, tournament: participants[0].tournament, matchday: date, dependantPlayerIds: [d.id] });
  for (const [p, amount] of [[participants[0], 3e6], [participants[1], 2e6]]) {
    p.availableMoney -= amount; p.reservedMoney = amount;
    add('Bid', { id: p.id, participant: p, tournament: p.tournament, matchdayMarket: market, realPlayer: player, offeredAmount: amount, status: 'active', bidDate: time });
  }
  if (!insufficientPlayers) for (let i = 11; i <= 40; i++) add('RealPlayer', { id: i, active: true, realTeam: 1 });
  let counter = 1000;
  const events = [];
  const em = {
    async find(cls, query) { return tables.get(cls.name).filter(r => matches(r, query)); },
    async findOne(cls, query, options) {
      const rows = await this.find(cls, query);
      if (options?.orderBy?.matchdayNumber) rows.sort((a, b) => a.matchdayNumber - b.matchdayNumber);
      return rows[0] ?? null;
    },
    async findOneOrFail(...args) { const value = await this.findOne(...args); if (!value) throw Error('not found ' + args[0].name); return value; },
    async refresh() {}, async flush() {},
    create(cls, data) { if (cls.name === 'MatchdayMarket') events.push('market'); return add(cls.name, { id: counter++, ...data }); },
    remove(entity) { const rows = tables.get(entity.constructor.name); rows.splice(rows.indexOf(entity), 1); },
    async transactional(fn) {
      const originalTables = new Map([...tables].map(([k, v]) => [k, [...v]]));
      const originals = new Map([...tables.values()].flat().map(entity => [entity, Object.fromEntries(Object.entries(entity).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]))]));
      try { return await fn(this); }
      catch (error) {
        for (const [entity, props] of originals) { for (const key of Object.keys(entity)) delete entity[key]; Object.assign(entity, props); }
        for (const [k, rows] of originalTables) tables.set(k, rows);
        throw error;
      }
    },
  };
  globalThis.scoreClosure = async () => {
    events.push('score');
    assert.ok(tables.get('Bid').every(b => b.status !== 'active'), 'bids settle before scoring');
    assert.ok(participants.every(p => p.reservedMoney === 0));
    if (failScore) throw Error('history unavailable');
    for (const p of participants) add('ParticipantMatchdayPoints', { id: p.id, participant: p, matchday: date, matchdayPoints: 10 });
  };
  return { em, tables, participants, date, next, events };
}
test('closure settles bids, scores, creates 3 players/member for every tournament, then pays exactly once', async () => {
  const f = fixture();
  const result = await commitLeagueClosure(f.em, 1);
  assert.equal(result.tournaments, 2); assert.equal(result.awardedPlayers, 1);
  assert.equal(result.createdMarketPlayers, 12); assert.equal(result.distributedReward, 4e6);
  assert.deepEqual(f.events, ['score', 'market', 'market']);
  assert.equal(f.participants[0].bankBudget, 18e6); assert.equal(f.participants[0].availableMoney, 18e6);
  assert.equal(f.participants[1].bankBudget, 21e6); assert.equal(f.participants[1].availableMoney, 21e6);
  const markets = f.tables.get('MatchdayMarket');
  assert.ok(markets.filter(m => !m.closedAt).every(m => m.matchday.id === f.next.id && m.dependantPlayerIds.length === 6));
  assert.ok(markets.some(m => m.closedAt), 'settled market is retained');
  assert.deepEqual(f.tables.get('Bid').map(b => b.status), ['won', 'lost']);
  const ledgerSize = f.tables.get('Transaction').length;
  const boughtAgain = f.tables.get('DependantPlayer').find(d => d.id === markets.filter(m => !m.closedAt)[0].dependantPlayerIds.find(id => id === 10));
  assert.equal(boughtAgain, undefined, 'winner must not reappear in new market');
  const balance = f.participants.map(p => p.bankBudget);
  assert.equal((await commitLeagueClosure(f.em, 1)).alreadyCompleted, true);
  assert.deepEqual(f.participants.map(p => p.bankBudget), balance);
  assert.equal(f.tables.get('Transaction').length, ledgerSize);
});

test('retired members retain their records but receive no prize and add no new market players', async () => {
  const f = fixture();
  const retired = f.participants[f.participants.length - 1];
  retired.retiredAt = new Date();
  for (const squad of f.tables.get('ParticipantSquad')) if (id(squad.participant) === retired.id) squad.releaseDate = new Date();
  const before = retired.bankBudget;
  const result = await commitLeagueClosure(f.em, 1);
  assert.equal(result.rewardedParticipants, 3);
  assert.equal(result.createdMarketPlayers, 9);
  assert.equal(retired.bankBudget, before);
  assert.equal(f.tables.get('Participant').length, 4);
});

test('league closures leave waiting tournaments, their budgets and markets untouched', async () => {
  const f = fixture();
  const waiting = f.tables.get('Tournament')[1]; waiting.initialDrawState = 'waiting';
  const members = f.participants.filter(p => id(p.tournament) === waiting.id);
  const budgets = members.map(p => p.bankBudget);
  const markets = f.tables.get('MatchdayMarket').filter(m => id(m.tournament) === waiting.id);
  const result = await commitLeagueClosure(f.em, 1);
  assert.equal(result.tournaments, 1); assert.equal(result.rewardedParticipants, 2);
  assert.equal(result.createdMarketPlayers, 6);
  assert.deepEqual(members.map(p => p.bankBudget), budgets);
  assert.ok(markets.every(m => !m.closedAt));
});
test('recovering an old closure after a newer one never renews or replaces the current market', async () => {
  const f = fixture(); f.next.closureCompletedAt = new Date();
  const future = f.em.create(classes.Matchday, { league: f.date.league, season: '2020', matchdayNumber: 3 });
  const open = f.em.create(classes.MatchdayMarket, { tournament: f.participants[0].tournament, matchday: future,
    dependantPlayerIds: [], closedAt: null });
  const result = await commitLeagueClosure(f.em, 1);
  assert.equal(result.createdMarketPlayers, 0);
  assert.equal(result.rewardedParticipants, 4);
  assert.equal(open.closedAt, null);
  assert.ok(f.tables.get('MatchdayMarket').includes(open));
});
test('a full substitutes bench rejects the highest offer and releases its reservation', async () => {
  const f = fixture({ fullSquad: true });
  await commitLeagueClosure(f.em, 1);
  assert.equal(f.participants[0].bankBudget, 21e6);
  assert.equal(f.participants[1].bankBudget, 19e6);
  assert.equal(f.tables.get('ParticipantSquad')[1].substitutesRealPlayersIds.includes(10), true);
});
for (const [label, option] of [['missing historical lineup', { failScore: true }], ['insufficient market pool', { insufficientPlayers: true }]]) {
  test(`failure from ${label} rolls back all economic effects and the completion marker`, async () => {
    const f = fixture(option);
    await assert.rejects(commitLeagueClosure(f.em, 1));
    assert.deepEqual(f.participants.map(p => p.bankBudget), [20e6, 20e6, 20e6, 20e6]);
    assert.deepEqual(f.participants.slice(0, 2).map(p => p.reservedMoney), [3e6, 2e6]);
    assert.equal(f.date.closureCompletedAt, undefined);
    assert.equal(f.tables.get('MatchdayMarket').length, 1);
    assert.ok(f.tables.get('Bid').every(b => b.status === 'active'));
  });
}
