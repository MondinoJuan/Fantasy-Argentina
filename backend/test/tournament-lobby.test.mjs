import test from 'node:test';
import assert from 'node:assert/strict';
import { aliases, gameStore } from './helpers/game-store.mjs';
import { moduleUrl, dataUrl } from './helpers/load-ts-module.mjs';
aliases.set(new URL('../src/shared/db/orm.js', import.meta.url).href, dataUrl('export const orm = {};'));
aliases.set(new URL('../src/Entities/RealTeamLeagueParticipation/realTeamLeagueParticipation.service.js', import.meta.url).href,
  dataUrl('export async function getTeamIdsByLeague() { return [1]; }'));
const { startTournament } = await import(moduleUrl(new URL('../src/shared/services/tournamentStart.service.ts', import.meta.url), aliases));
const { setupParticipantAfterJoin } = await import(moduleUrl(new URL('../src/Entities/Tournament/tournament-participation.service.ts', import.meta.url), aliases));
const { gameTransaction } = await import(moduleUrl(new URL('../src/shared/services/gameEconomy.service.ts', import.meta.url), aliases));
const actor = id => ({ id, type: 'USER' });
function lobby() {
  const db = gameStore();
  db.tournament.creatorUserId = 1; db.tournament.initialDrawState = 'waiting'; db.tournament.status = 'active';
  for (const name of ['ParticipantSquad', 'MatchdayMarket', 'DependantPlayer', 'RealPlayer', 'RealPlayerLeagueValue']) db.tables.get(name).splice(0);
  db.date.matchdayNumber = 1; db.date.status = 'scheduled'; db.date.season = '2026';
  db.em.persist = () => {};
  let id = 0;
  // Leave sufficient capacity for a late entry even if all nine market picks hit one position.
  for (const [position, count] of Object.entries({ forward: 18, midfielder: 28, defender: 28, goalkeeper: 16 })) {
    for (let i = 0; i < count; i++) {
      const player = db.add('RealPlayer', { id: ++id, active: true, position, realTeam: 1 });
      db.add('PlayerPerformance', { realPlayer: player, league: db.league, pointsObtained: 5 + i % 5 * .5 });
      db.add('PlayerPerformance', { realPlayer: player, league: db.league, pointsObtained: 7 - i % 5 * .5 });
    }
  }
  return db;
}
const squadIds = db => db.tables.get('ParticipantSquad').flatMap(s => s.startingRealPlayersIds);
const marketIds = db => db.tables.get('MatchdayMarket').flatMap(m => m.dependantPlayerIds)
  .map(id => db.tables.get('DependantPlayer').find(d => d.id === id).realPlayer.id);

test('joining the lobby assigns no players and publishes no market', async () => {
  const db = lobby();
  for (const p of db.members) await setupParticipantAfterJoin(db.tournament, p, db.em);
  assert.equal(db.tables.get('ParticipantSquad').length, 0);
  assert.equal(db.tables.get('MatchdayMarket').length, 0);
});
test('only the creator starts; one atomic draw assigns eleven each and then 3 market players each', async () => {
  const db = lobby();
  await assert.rejects(startTournament(db.em, 1, actor(2)), /creador/);
  const result = await startTournament(db.em, 1, actor(1));
  assert.equal(result.alreadyStarted, false);
  assert.equal(db.tournament.initialDrawState, 'completed');
  assert.ok(db.tournament.initialDrawCompletedAt instanceof Date);
  assert.ok(db.members.every(p => p.playingSince === db.tournament.initialDrawCompletedAt));
  assert.equal(squadIds(db).length, 33); assert.equal(new Set(squadIds(db)).size, 33);
  assert.equal(marketIds(db).length, 9);
  assert.ok(marketIds(db).every(id => !squadIds(db).includes(id)));
  assert.ok(db.tables.get('ParticipantSquad').every(s => s.startingRealPlayersIds.length === 11 && s.substitutesRealPlayersIds.length === 0));
  assert.deepEqual(Object.values(result.summary.averages), [6, 6, 6]);
  assert.equal(result.summary.criterion, 'stored_rating_mean');
  const before = JSON.stringify([squadIds(db), marketIds(db)]);
  assert.equal((await startTournament(db.em, 1, actor(1))).alreadyStarted, true);
  assert.equal(JSON.stringify([squadIds(db), marketIds(db)]), before);
});
test('concurrent start requests draw once', async () => {
  const db = lobby();
  const results = await Promise.all([startTournament(db.em, 1, actor(1)), startTournament(db.em, 1, actor(1))]);
  assert.equal(results.filter(r => !r.alreadyStarted).length, 1);
  assert.equal(squadIds(db).length, 33); assert.equal(marketIds(db).length, 9);
});
test('insufficient ratings or failed persistence roll back squads, market and start marker', async () => {
  for (const failure of ['ratings', 'flush', 'capacity', 'calendar']) {
    const db = lobby();
    if (failure === 'ratings') db.tables.get('PlayerPerformance').splice(0);
    else if (failure === 'capacity') db.tables.get('RealPlayer').splice(41);
    else if (failure === 'calendar') { db.date.closureCompletedAt = new Date(); db.date.status = 'completed'; }
    else db.failNextFlush = true;
    await assert.rejects(startTournament(db.em, 1, actor(1)));
    assert.equal(db.tournament.initialDrawState, 'waiting');
    assert.equal(db.tournament.initialDrawCompletedAt, undefined);
    assert.equal(squadIds(db).length, 0); assert.equal(marketIds(db).length, 0);
  }
});
test('a late entrant receives eleven free players and adds three to the market without redrawing anybody', async () => {
  const db = lobby(); await startTournament(db.em, 1, actor(1));
  const before = [...squadIds(db)], published = [...marketIds(db)];
  // Late entries do not depend on having ratings for remaining free players.
  db.tables.get('PlayerPerformance').splice(0);
  let late;
  await gameTransaction(db.em, 1, 'participant_join', async tx => {
    late = db.add('Participant', { id: 4, tournament: db.tournament, user: 4, bankBudget: 20e6, reservedMoney: 0, availableMoney: 20e6 });
    await setupParticipantAfterJoin(db.tournament, late, tx);
  });
  const assigned = db.tables.get('ParticipantSquad').find(s => s.participant.id === 4).startingRealPlayersIds;
  assert.equal(assigned.length, 11);
  assert.ok(late.playingSince instanceof Date);
  assert.ok(assigned.every(id => !before.includes(id) && !published.includes(id)));
  assert.deepEqual(squadIds(db).slice(0, 33), before);
  assert.equal(marketIds(db).length, 12);
  await setupParticipantAfterJoin(db.tournament, late, db.em);
  assert.equal(squadIds(db).length, 44); assert.equal(marketIds(db).length, 12);
});
test('legacy tournaments are never redrawn', async () => {
  const db = lobby(); db.tournament.initialDrawState = 'legacy';
  assert.equal((await startTournament(db.em, 1, actor(1))).alreadyStarted, true);
  assert.equal(squadIds(db).length, 0);
});

test('a late entry with insufficient free players rolls back membership without touching current squads or markets', async () => {
  const db = lobby(); await startTournament(db.em, 1, actor(1));
  const before = JSON.stringify([squadIds(db), marketIds(db)]);
  const retained = new Set([...squadIds(db), ...marketIds(db)]);
  db.tables.set('RealPlayer', db.tables.get('RealPlayer').filter(p => retained.has(p.id)));
  await assert.rejects(gameTransaction(db.em, 1, 'participant_join', async tx => {
    const late = db.add('Participant', { id: 4, tournament: db.tournament, user: 4, bankBudget: 20e6, reservedMoney: 0, availableMoney: 20e6 });
    await setupParticipantAfterJoin(db.tournament, late, tx);
  }));
  assert.equal(db.tables.get('Participant').length, 3);
  assert.equal(JSON.stringify([squadIds(db), marketIds(db)]), before);
});

test('late entry handles a database-generated participant id without querying an unpersisted relation', async () => {
  const db = lobby(); await startTournament(db.em, 1, actor(1));
  let late;
  const findOne = db.em.findOne.bind(db.em), flush = db.em.flush.bind(db.em);
  db.em.findOne = async (cls, query, options) => {
    if (cls.name === 'ParticipantSquad' && query.participant === late && !late.id) throw Error('Cannot query unpersisted relation');
    return findOne(cls, query, options);
  };
  db.em.flush = async () => { if (late && !late.id) late.id = 4; await flush(); };
  await gameTransaction(db.em, 1, 'participant_join', async tx => {
    late = db.add('Participant', { id: undefined, user: 4, tournament: db.tournament, bankBudget: 20e6, reservedMoney: 0, availableMoney: 20e6 });
    await setupParticipantAfterJoin(db.tournament, late, tx);
  });
  assert.equal(late.id, 4);
  assert.equal(db.tables.get('ParticipantSquad').find(s => s.participant === late).startingRealPlayersIds.length, 11);
});
