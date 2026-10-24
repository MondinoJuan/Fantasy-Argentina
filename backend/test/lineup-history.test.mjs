import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleUrl, dataUrl } from './helpers/load-ts-module.mjs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const domainUrl = moduleUrl(new URL('../src/shared/domain/lineup-history.ts', import.meta.url));
const { freezeState, snapshotState, selectRevision, scoreHistoricalLineups } = await import(domainUrl);
const classesUrl = dataUrl(`
  export class Participant {} export class ParticipantSquad {} export class SquadRevision {}
  export class MatchdayLineup {} export class PlayerPerformance {} export class PlayerPointsBreakdown {}
  export class ParticipantMatchdayPoints {} export class RealPlayer {} export class Tournament {}
  export class League {} export class Matchday {} export class GameMatch {}
`);
const coreUrl = dataUrl(`
  export const FlushMode = { COMMIT: 'commit' };
  export const LockMode = { PESSIMISTIC_WRITE: 'write' };
  export const ChangeSetType = { CREATE: 'create', UPDATE: 'update', DELETE: 'delete', DELETE_EARLY: 'delete_early' };
`);
const aliases = new Map([['@mikro-orm/core', coreUrl]]);
for (const [directory, filename] of [
  ['Participant', 'participant'], ['ParticipantSquad', 'participantSquad'], ['SquadRevision', 'squadRevision'],
  ['MatchdayLineup', 'matchdayLineup'], ['PlayerPerformance', 'playerPerformance'], ['PlayerPointsBreakdown', 'playerPointsBreakdown'],
  ['ParticipantMatchdayPoints', 'participantMatchdayPoints'], ['RealPlayer', 'realPlayer'], ['Tournament', 'tournament'],
  ['League', 'league'], ['Matchday', 'matchday'], ['GameMatch', 'gameMatch'],
]) aliases.set(new URL(`../src/Entities/${directory}/${filename}.entity.js`, import.meta.url).href, classesUrl);
const { SquadHistorySubscriber } = await import(moduleUrl(new URL('../src/shared/services/squadHistory.subscriber.ts', import.meta.url), aliases));
const { frozenLineupFor } = await import(moduleUrl(new URL('../src/shared/services/historicalLineup.service.ts', import.meta.url), aliases));
const { recalculateMatchdayPoints } = await import(moduleUrl(new URL('../src/Entities/Tournament/services/matchdayPoints.service.ts', import.meta.url), aliases));
const entities = await import(classesUrl);
const make = (name, data) => Object.assign(new entities[name](), data);
const t = (value) => new Date(`2020-10-${value}Z`);
const state = (id = 1, captain = null) => ({ formation: '4-4-2', startingRealPlayersIds: [id],
  substitutesRealPlayersIds: [], captainRealPlayerId: captain, playerPositions: { [id]: 'forward' } });
const revision = (date, data = state(), extra = {}) => ({ id: 1, sourceKey: 'initial',
  effectiveAt: t(date), acquiredAt: t('01T10:00:00'), releasedAt: null, deleted: false, state: data, ...extra });
const lineup = (data = state(), extra = {}) => ({ id: 20, scopeKey: '11:4:date', cutoffAt: t('10T15:00:00'),
  allowChangesDuringMatchday: false, ...freezeState(data), ...extra });
const performance = (id, playerId, matchId, points, day = '10T16:00:00') => ({ id, realPlayerId: playerId,
  matchId, points, kickoffAt: t(day) });

test('historical lineup domain type-checks without database dependencies', () => {
  const program = ts.createProgram([fileURLToPath(new URL('../src/shared/domain/lineup-history.ts', import.meta.url))], {
    noEmit: true, strict: true, target: ts.ScriptTarget.ES2022, types: [], skipLibCheck: true,
  });
  const errors = ts.getPreEmitDiagnostics(program);
  assert.equal(errors.length, 0, errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
});

test('transfer after cutoff never changes the previous owner’s lineup', () => {
  const before = revision('09T12:00:00');
  const after = revision('11T12:00:00', state(2), { id: 2 });
  assert.deepEqual(selectRevision([after, before], t('10T15:00:00')).state.startingRealPlayersIds, [1]);
  assert.equal(selectRevision([after, before], t('12T15:00:00')).state.startingRealPlayersIds[0], 2);
});

test('history does not extrapolate a current squad backwards', () => {
  assert.equal(selectRevision([revision('11T12:00:00')], t('10T15:00:00')), null);
  assert.equal(selectRevision([revision('10T15:00:00')], t('10T15:00:00')), null);
});

test('historical active squad is selected before later release/deletion', () => {
  const before = revision('09T12:00:00');
  const removed = revision('11T12:00:00', state(), { id: 2, deleted: true });
  assert.equal(selectRevision([before, removed], t('10T15:00:00')).id, 1);
  assert.equal(selectRevision([before, removed], t('12T15:00:00')), null);
});

test('a released squad is not treated as the current lineup after its release', () => {
  const released = revision('09T12:00:00', state(), { releasedAt: t('10T12:00:00') });
  assert.equal(selectRevision([released], t('10T11:00:00')).id, 1);
  assert.equal(selectRevision([released], t('10T15:00:00')), null);
});

test('a snapshot copies slots, captain and real positions without retaining mutable references', () => {
  const original = state(1, 1);
  original.startingRealPlayersIds = [null, 1];
  const frozen = freezeState(original);
  original.playerPositions[1] = 'goalkeeper';
  original.startingRealPlayersIds[1] = 2;
  assert.equal(frozen.startingSlots[0].realPlayerId, null);
  assert.equal(frozen.startingSlots[1].realPlayerId, 1);
  assert.equal(frozen.startingSlots[1].actualPosition, 'forward');
  assert.equal(frozen.captainRealPlayerId, 1);
});

test('MikroORM serialized JSON preimages are decoded before recording', () => {
  const saved = snapshotState({ formation: '4-4-2', startingRealPlayersIds: '[1,2]',
    substitutesRealPlayersIds: '[3]', captainRealPlayerId: 2 }, { 1: 'forward', 2: 'forward' });
  assert.deepEqual(saved.startingRealPlayersIds, [1, 2]);
  assert.deepEqual(saved.substitutesRealPlayersIds, [3]);
});

test('default mode uses the date captain even if a match has a different lineup', () => {
  const result = scoreHistoricalLineups(lineup(state(1, 1)), new Map([[50, lineup(state(2, 2))]]), [performance(100, 1, 50, 7.4)]);
  assert.equal(result.get(1).points, 14.8);
});

test('dynamic mode scores each kickoff lineup and captain, without retroactive points', () => {
  const header = lineup(state(), { allowChangesDuringMatchday: true });
  const matches = new Map([[50, lineup(state(1, 1), { id: 21 })], [51, lineup(state(2), { id: 22 })]]);
  const result = scoreHistoricalLineups(header, matches, [performance(100, 1, 50, 7), performance(101, 2, 51, 8, '11T16:00:00'),
    performance(102, 1, 51, 10, '11T16:00:00'), performance(103, 2, 50, 10)]);
  assert.equal(result.get(1).points, 14);
  assert.equal(result.get(2).points, 8);
});

test('a postponed match uses its frozen kickoff lineup and retains other matches', () => {
  const header = lineup(state(), { allowChangesDuringMatchday: true });
  const matchSnapshots = new Map([[50, lineup(state(1))], [51, lineup(state(1), { id: 21 })]]);
  const initial = performance(100, 1, 50, 7);
  const postponed = performance(101, 1, 51, 8, '16T16:00:00');
  assert.equal(scoreHistoricalLineups(header, matchSnapshots, [initial, postponed]).get(1).points, 15);
  assert.equal(scoreHistoricalLineups(header, matchSnapshots, [initial, { ...postponed, points: 9 }]).get(1).points, 16);
});

test('position penalty remains once per player/date and captain still doubles it', () => {
  const wrongPosition = state(1, 1);
  wrongPosition.playerPositions[1] = 'defender';
  const result = scoreHistoricalLineups(lineup(wrongPosition), new Map(), [performance(100, 1, 50, 7), performance(101, 1, 51, 8)]);
  assert.equal(result.get(1).points, 24); // ((7 + 8) - 3) * 2
  assert.equal(result.get(1).contributions.filter((row) => row.positionPenalty).length, 1);
});

test('dynamic scoring rejects performances with no historical match association', () => {
  assert.throws(() => scoreHistoricalLineups(lineup(state(), { allowChangesDuringMatchday: true }), new Map(),
    [performance(100, 1, null, 7)]), /No frozen lineup/);
});

test('reserves never score, duplicate performance input does not double points', () => {
  const s = state(); s.substitutesRealPlayersIds = [2];
  const p = performance(100, 1, 50, 7);
  const result = scoreHistoricalLineups(lineup(s), new Map(), [p, p, performance(101, 2, 50, 10)]);
  assert.equal(result.get(1).points, 7);
  assert.equal(result.has(2), false);
});

test('onFlush records the preimage plus new state for sales/transfers, in the same unit of work', async () => {
  const startedAt = Date.now();
  const squad = make('ParticipantSquad', { participant: { id: 11 }, historySourceKey: 'squad-11', acquisitionDate: t('01T10:00:00'),
    ...state(2), releaseDate: null });
  const original = { ...squad, participant: 11, updatedAt: t('09T12:00:00'), startingRealPlayersIds: '[1]', substitutesRealPlayersIds: '[]' };
  const records = [];
  await new SquadHistorySubscriber().onFlush({ em: {
    find: async () => [{ id: 1, position: 'forward' }, { id: 2, position: 'forward' }],
    findOne: async () => null, getReference: (_, id) => ({ id }), create: (_, input) => make('SquadRevision', input),
  }, uow: { getChangeSets: () => [{ entity: squad, type: 'update', originalEntity: original }],
    getOriginalEntityData: () => original, computeChangeSet: (record) => records.push(record) } });
  assert.equal(records.length, 2);
  assert.equal(records[0].legacyBaseline, true);
  assert.deepEqual(records[0].state.startingRealPlayersIds, [1]);
  assert.deepEqual(records[1].state.startingRealPlayersIds, [2]);
  assert.ok(records[0].effectiveAt.getTime() >= startedAt);
  assert.ok(records[0].effectiveAt.getTime() <= Date.now());
});

test('historical records cannot be updated through the ORM', async () => {
  for (const type of ['MatchdayLineup', 'SquadRevision']) {
    await assert.rejects(new SquadHistorySubscriber().onFlush({ em: {},
      uow: { getChangeSets: () => [{ entity: make(type, {}), type: 'update' }] } }), /immutable/);
  }
});

test('a new squad records one revision even when the UoW has already prepared its current data', async () => {
  const participant = make('Participant', {}); // The participant PK is assigned by the same flush.
  const squad = make('ParticipantSquad', { participant, historySourceKey: 'new-squad', acquisitionDate: t('01T10:00:00'), ...state() });
  const records = [];
  await new SquadHistorySubscriber().onFlush({ em: {
    find: async () => [{ id: 1, position: 'forward' }],
    findOne: async () => { throw new Error('A new squad must not try to backfill a previous owner'); },
    create: (_, input) => make('SquadRevision', input),
  }, uow: { getChangeSets: () => [{ entity: squad, type: 'create' }],
    getOriginalEntityData: () => ({ ...squad, participant: {} }), computeChangeSet: (row) => records.push(row) } });
  assert.equal(records.length, 1);
  assert.equal(records[0].participant, participant);
  assert.equal(records[0].sourceKey, 'new-squad');
});

test('a corrected real position creates a new squad revision for future kickoffs only', async () => {
  const squad = make('ParticipantSquad', { participant: { id: 11 }, historySourceKey: 'squad-11',
    acquisitionDate: t('01T10:00:00'), ...state(1) });
  const correctedPlayer = make('RealPlayer', { id: 1, position: 'defender' });
  const records = [];
  await new SquadHistorySubscriber().onFlush({ em: {
    find: async (Entity) => Entity.name === 'ParticipantSquad' ? [squad] : [correctedPlayer],
    findOne: async () => ({ id: 1 }), create: (_, input) => make('SquadRevision', input),
  }, uow: { getChangeSets: () => [{ entity: correctedPlayer, type: 'update', payload: { position: 'defender' } }],
    getOriginalEntityData: () => ({ ...squad, participant: 11 }), computeChangeSet: (row) => records.push(row) } });
  assert.equal(records.length, 1);
  assert.equal(records[0].state.playerPositions[1], 'defender');
});

function persistenceFixture(dynamic = false) {
  const participant = make('Participant', { id: 11, tournament: { id: 5 }, joinDate: t('01T10:00:00'), totalScore: 0 });
  const day = make('Matchday', { id: 4, league: { id: 1 }, startDate: t('10T15:00:00') });
  const matchA = make('GameMatch', { id: 50, startDateTime: t('10T16:00:00'), matchday: day });
  const matchB = make('GameMatch', { id: 51, startDateTime: t('11T16:00:00'), matchday: day });
  const data = {
    Participant: [participant], Tournament: [make('Tournament', { id: 5, allowSquadChangesDuringMatchday: dynamic })],
    ParticipantSquad: [], SquadRevision: [make('SquadRevision', { ...revision('09T12:00:00', state(1, 1)), participant })],
    MatchdayLineup: [], PlayerPerformance: [make('PlayerPerformance', { id: 100, realPlayer: { id: 1 }, match: matchA, matchday: day, pointsObtained: 7 }),
      make('PlayerPerformance', { id: 101, realPlayer: { id: 1 }, match: matchB, matchday: day, pointsObtained: 8 })],
    PlayerPointsBreakdown: [], ParticipantMatchdayPoints: [], RealPlayer: [{ id: 1, position: 'forward' }],
  };
  const idOf = (v) => v && typeof v === 'object' ? v.id : v;
  const matches = (row, where) => Object.entries(where).every(([key, value]) => {
    if (key === 'league') return true;
    if (value && '$in' in Object(value)) return value.$in.includes(idOf(row[key]));
    if (value && '$lt' in Object(value)) return row[key] < value.$lt;
    if (value && typeof value === 'object' && !('id' in value)) return true;
    return idOf(row[key]) === idOf(value);
  });
  let nextId = 200;
  const em = {
    find: async (Entity, where = {}) => (data[Entity.name] ?? []).filter((row) => matches(row, where)),
    findOne: async (Entity, where) => (await em.find(Entity, where))[0] ?? null,
    findOneOrFail: async (Entity, where) => { const item = await em.findOne(Entity, where); assert.ok(item, Entity.name); return item; },
    create: (Entity, input) => { const row = Object.assign(new Entity(), { id: nextId++ }, input); (data[Entity.name] ??= []).push(row); return row; },
    remove: (row) => { const table = data[row.constructor.name]; table.splice(table.indexOf(row), 1); },
    flush: async () => {},
  };
  return { em, data, participant, day, matchA, matchB };
}

test('freezing is repeatable and does not replace saved slots after a later transfer or setting change', async () => {
  const { em, data, participant, day } = persistenceFixture();
  const first = await frozenLineupFor(em, participant, day);
  data.SquadRevision.push(make('SquadRevision', { ...revision('12T12:00:00', state(2), { id: 2 }), participant }));
  data.Tournament[0].allowSquadChangesDuringMatchday = true;
  const second = await frozenLineupFor(em, participant, day);
  assert.equal(first.id, second.id);
  assert.equal(second.captainRealPlayerId, 1);
  assert.equal(second.allowChangesDuringMatchday, false);
  assert.equal(data.MatchdayLineup.length, 1);
});

test('missing legacy history fails before altering published points', async () => {
  const { em, data, participant, day } = persistenceFixture();
  data.SquadRevision[0].effectiveAt = t('12T12:00:00');
  data.PlayerPointsBreakdown.push(make('PlayerPointsBreakdown', { id: 7, participant, matchday: day, realPlayer: { id: 1 }, contributedPoints: 99 }));
  await assert.rejects(recalculateMatchdayPoints(em, { id: 1 }, day), /Missing squad history/);
  assert.equal(data.PlayerPointsBreakdown[0].contributedPoints, 99);
});

test('recalculating a correction updates rather than duplicates player/date rows and total score', async () => {
  const { em, data, participant, day } = persistenceFixture();
  await recalculateMatchdayPoints(em, { id: 1 }, day);
  assert.equal(participant.totalScore, 30);
  assert.equal(data.PlayerPointsBreakdown[0].performanceContributions.length, 2);
  const originalRow = data.PlayerPointsBreakdown[0].id;
  data.PlayerPerformance[1].pointsObtained = 9;
  await recalculateMatchdayPoints(em, { id: 1 }, day);
  await recalculateMatchdayPoints(em, { id: 1 }, day);
  assert.equal(data.PlayerPointsBreakdown.length, 1);
  assert.equal(data.PlayerPointsBreakdown[0].id, originalRow);
  assert.equal(participant.totalScore, 32);
  assert.equal(data.ParticipantMatchdayPoints.length, 1);
});

test('dynamic service reads the correct squad revision at each kickoff', async () => {
  const { em, data, participant, day } = persistenceFixture(true);
  data.SquadRevision.push(make('SquadRevision', { ...revision('11T12:00:00', state(2, 2), { id: 2 }), participant }));
  data.PlayerPerformance.push(make('PlayerPerformance', { id: 102, realPlayer: { id: 2 }, match: data.PlayerPerformance[1].match, matchday: day, pointsObtained: 9 }));
  await recalculateMatchdayPoints(em, { id: 1 }, day);
  assert.equal(participant.totalScore, 32); // first match player 1: 7*2; second match player 2: 9*2
  assert.equal(data.MatchdayLineup.length, 3);
  assert.deepEqual(data.PlayerPointsBreakdown.map((row) => row.contributedPoints), [14, 18]);
});

test('joining after a locked date began yields no historical points for that date', async () => {
  const { em, data, participant, day } = persistenceFixture();
  participant.joinDate = t('11T12:00:00');
  await recalculateMatchdayPoints(em, { id: 1 }, day);
  assert.equal(participant.totalScore, 0);
  assert.equal(data.PlayerPointsBreakdown.length, 0);
});

test('a legacy updatedAt never backdates unrecorded historical player positions', async () => {
  const { em, data, participant, day } = persistenceFixture();
  data.SquadRevision = [];
  data.ParticipantSquad = [make('ParticipantSquad', { participant, historySourceKey: 'old-squad',
    acquisitionDate: t('01T10:00:00'), updatedAt: t('01T10:00:00'), ...state(1) })];
  await assert.rejects(recalculateMatchdayPoints(em, { id: 1 }, day), /Missing squad history/);
  assert.ok(data.SquadRevision[0].effectiveAt > day.startDate);
});

test('a late entrant in dynamic mode scores only matches beginning after joining', async () => {
  const { em, data, participant, day } = persistenceFixture(true);
  participant.joinDate = t('11T12:00:00');
  data.SquadRevision[0].effectiveAt = participant.joinDate;
  await recalculateMatchdayPoints(em, { id: 1 }, day);
  assert.equal(participant.totalScore, 16); // Second match only: 8 * captain.
});

test('retirement retains earlier contributions and dynamic lineups stop at retirement', async () => {
  const { em, participant, day } = persistenceFixture(true);
  participant.retiredAt = t('11T12:00:00');
  await recalculateMatchdayPoints(em, { id: 1 }, day);
  assert.equal(participant.totalScore, 14);
  await recalculateMatchdayPoints(em, { id: 1 }, day);
  assert.equal(participant.totalScore, 14);
});

test('a retired participant is excluded from dates beginning after retirement', async () => {
  const { em, data, participant, day } = persistenceFixture();
  participant.retiredAt = t('09T12:00:00');
  await recalculateMatchdayPoints(em, { id: 1 }, day);
  assert.equal(data.ParticipantMatchdayPoints.length, 0);
});

test('lobby registration does not earn pre-start points; dynamic mode starts at subsequent kickoffs', async () => {
  const { em, data, participant, day } = persistenceFixture(true);
  data.Tournament[0].initialDrawCompletedAt = t('11T12:00:00');
  await recalculateMatchdayPoints(em, { id: 1 }, day);
  assert.equal(participant.totalScore, 16);
});

test('starting after a locked date opened does not earn points retroactively for that date', async () => {
  const { em, data, participant, day } = persistenceFixture(false);
  data.Tournament[0].initialDrawCompletedAt = t('11T12:00:00');
  await recalculateMatchdayPoints(em, { id: 1 }, day);
  assert.equal(participant.totalScore, 0);
});

test('a late entrant earns points only after their squad assignment, even if registration was earlier', async () => {
  const { em, participant, day } = persistenceFixture(true);
  participant.playingSince = t('11T12:00:00');
  await recalculateMatchdayPoints(em, { id: 1 }, day);
  assert.equal(participant.totalScore, 16);
});
