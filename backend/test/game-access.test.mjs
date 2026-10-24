import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const sourceUrl = new URL('../src/shared/security/game-access.ts', import.meta.url);
const source = readFileSync(sourceUrl, 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { authorizeGameRequest, publicBid, publicParticipant, profileUpdate, readScope } =
  await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const alice = { id: 1, type: 'USER' };
const bob = { id: 2, type: 'USER' };
const outsider = { id: 3, type: 'USER' };
const admin = { id: 4, type: 'SUPERADMIN' };

test('tournament collection filters intersect authorization instead of replacing it, without altering sports catalogs', () => {
  assert.deepEqual(readScope(alice, 'bids', '100'), { $and: [readScope(alice, 'bids'), { tournament: 100 }] });
  assert.deepEqual(readScope(alice, 'participant-squads', 100), { $and: [readScope(alice, 'participant-squads'), { participant: { tournament: 100 } }] });
  assert.deepEqual(readScope(alice, 'transactions', 100).$and[0], readScope(alice, 'transactions'));
  for (const bad of ['abc', '0', '-1', ['100'], { id: 'x' }]) assert.throws(() => readScope(alice, 'bids', bad));
});

function fixture() {
  const data = {
    participants: {
      11: { id: 11, user: { id: 1, username: 'Alice', password: 'secret', mail: 'private' }, tournament: { id: 100 } },
      22: { id: 22, user: { id: 2, username: 'Bob' }, tournament: { id: 100 } },
      33: { id: 33, user: { id: 3 }, tournament: { id: 200 } },
    },
    tournaments: { 100: { id: 100, league: { id: 5 } }, 200: { id: 200, league: { id: 6 } } },
    'participant-squads': {
      111: { id: 111, participant: { id: 11 }, startingRealPlayersIds: [501], substitutesRealPlayersIds: [502] },
      222: { id: 222, participant: { id: 22 }, startingRealPlayersIds: [503], substitutesRealPlayersIds: [] },
    },
    'dependant-players': {
      601: { id: 601, tournament: { id: 100 }, realPlayer: { id: 501 } },
      603: { id: 603, tournament: { id: 100 }, realPlayer: { id: 503 } },
      604: { id: 604, tournament: { id: 100 }, realPlayer: { id: 504 } },
    },
    'matchday-markets': { 700: { id: 700, tournament: { id: 100 }, dependantPlayerIds: [604] } },
    bids: { 800: { id: 800, participant: { id: 11 }, tournament: { id: 100 }, realPlayer: { id: 504 }, matchdayMarket: { id: 700 }, offeredAmount: 10 } },
    negotiations: { 900: { id: 900, tournament: { id: 100 }, buyerParticipant: { id: 11 }, sellerParticipant: { id: 22 }, dependantPlayer: { id: 603 }, status: 'active' } },
    'player-clauses': { 950: { id: 950, ownerParticipant: { id: 22 }, dependantPlayer: { id: 603 }, tournament: { id: 100 } } },
  };
  const store = {
    get: async (resource, id) => data[resource]?.[id] ?? null,
    visible: async (resource, id, actor) => {
      const item = data[resource]?.[id];
      if (!item) return false;
      const tournamentId = resource === 'tournaments' ? id : item.tournament?.id;
      return Object.values(data.participants).some((p) => p.user.id === actor.id && p.tournament.id === tournamentId);
    },
    latestSquad: async (id) => Object.values(data['participant-squads']).find((s) => s.participant.id === id) ?? null,
    translatedValue: async () => 2_000_000,
  };
  return { data, store, run: (actor, method, path, body) => authorizeGameRequest(store, actor, method, path, body) };
}

test('only the tournament creator can request the initial start; client body cannot override it', async () => {
  const { store, data } = fixture();
  data.tournaments[100].creatorUserId = 1;
  assert.deepEqual(await authorizeGameRequest(store, alice, 'POST', '/tournaments/100/start', { creatorUserId: 2 }), {});
  await assert.rejects(authorizeGameRequest(store, bob, 'POST', '/tournaments/100/start'), { status: 403 });
  await assert.rejects(authorizeGameRequest(store, outsider, 'POST', '/tournaments/100/start'), { status: 403 });
});

test('participant views expose lifecycle flags needed to show only active lobby members without disclosing rival reserves', () => {
  const row = { id: 22, user: { id: 2 }, tournament: { id: 100 }, retiredAt: new Date('2026-01-01'), playingSince: new Date('2025-01-01'), reservedMoney: 123 };
  const result = publicParticipant(row, alice);
  assert.equal(result.retiredAt, row.retiredAt);
  assert.equal(result.playingSince, row.playingSince);
  assert.equal(result.reservedMoney, undefined);
});
const forbidden = { status: 403 };

test('authorization policy type-checks independently of database dependencies', () => {
  const program = ts.createProgram([sourceUrl.pathname.replace(/^\/([A-Za-z]:)/, '$1')], {
    noEmit: true, strict: true, target: ts.ScriptTarget.ES2022, types: [], skipLibCheck: true,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => process.cwd(), getCanonicalFileName: (f) => f, getNewLine: () => '\n',
  }));
});

test('a user cannot promote their profile; an admin can administer roles', () => {
  assert.throws(() => profileUpdate({ type: 'SUPERADMIN' }, alice), forbidden);
  assert.deepEqual(profileUpdate({ username: 'A', superadminCode: 'injected' }, alice), { username: 'A' });
  assert.deepEqual(profileUpdate({ type: 'SUPERADMIN' }, admin), { type: 'SUPERADMIN' });
});

test('bid responses contain own amount, but no rival amount or nested secrets', () => {
  const bid = { ...fixture().data.bids[800], participant: fixture().data.participants[11] };
  assert.equal(publicBid(bid, alice).offeredAmount, 10);
  const rival = publicBid(bid, bob);
  assert.equal('offeredAmount' in rival, false);
  assert.equal('bidDate' in rival, false);
  assert.deepEqual(rival.participant, { id: 11 });
  assert.equal(publicBid(bid, admin).offeredAmount, 10);
});

test('participant responses protect aggregate reserves and user credentials', () => {
  const participant = { ...fixture().data.participants[11], bankBudget: 100, reservedMoney: 10, availableMoney: 90 };
  assert.equal(publicParticipant(participant, alice).availableMoney, 90);
  const rival = publicParticipant(participant, bob);
  assert.equal(rival.bankBudget, 100);
  assert.equal('availableMoney' in rival, false);
  assert.equal('reservedMoney' in rival, false);
  assert.deepEqual(rival.user, { id: 1, username: 'Alice' });
});

test('creating/joining/leaving cannot impersonate another user', async () => {
  const { run } = fixture();
  await assert.rejects(run(alice, 'POST', '/tournaments', { creatorUserId: 2 }), forbidden);
  await assert.rejects(run(alice, 'POST', '/participants/join-by-code', { userId: 2 }), forbidden);
  await assert.rejects(run(alice, 'POST', '/participants/leave-tournament', { userId: 2, tournamentId: 100 }), forbidden);
  assert.deepEqual(await run(alice, 'POST', '/participants/join-by-code', { tournamentCode: 'T-ABC', bankBudget: 999 }), { userId: 1, tournamentCode: 'T-ABC' });
});

test('existing tournament configuration is accepted on creation', async () => {
  const { run } = fixture();
  const result = await run(alice, 'POST', '/tournaments', { name: 'Amigos', clauseWaitDays: 7, allowSquadChangesDuringMatchday: true, allowClauseExecutionDuringMatchday: false });
  assert.equal(result.creatorUserId, 1);
  assert.equal(result.allowSquadChangesDuringMatchday, true);
  assert.equal(result.clauseWaitDays, 7);
});

test('non-admin cannot write raw balances, scores, catalog data, jobs or unknown endpoints', async () => {
  for (const [method, path] of [['PATCH', '/participants/11'], ['POST', '/participants'], ['POST', '/participants/transfer-money'],
    ['POST', '/participants/11/spend-money'], ['PATCH', '/tournaments/100'], ['DELETE', '/matches/1'],
    ['POST', '/player-performances'], ['POST', '/transactions'], ['POST', '/shieldings'],
    ['POST', '/tournaments/settle-market-and-refresh-by-league'], ['POST', '/matchday-lineups'], ['POST', '/new-unsafe-endpoint']]) {
    await assert.rejects(fixture().run(alice, method, path, { bankBudget: 999, totalScore: 999 }), forbidden, path);
  }
});

test('provider endpoints require an admin, including GET endpoints', async () => {
  await assert.rejects(fixture().run(alice, 'GET', '/external/sportsapipro/player'), forbidden);
  assert.deepEqual(await fixture().run(admin, 'POST', '/external/sportsapipro/fixture/build', { competitionId: 1 }), { competitionId: 1 });
  assert.deepEqual(await fixture().run(alice, 'GET', '/real-players'), {});
});

test('members can read their tournament; outsiders and malformed IDs are rejected', async () => {
  const { run } = fixture();
  await run(alice, 'GET', '/tournaments/100');
  await assert.rejects(run(outsider, 'GET', '/tournaments/100'), forbidden);
  await assert.rejects(run(outsider, 'GET', '/bids/tournament/100/real-player/504'), forbidden);
  await assert.rejects(run(outsider, 'GET', '/tournaments/100garbage'), { status: 400 });
  await assert.rejects(run(outsider, 'GET', '/TOURNAMENTS/100'), forbidden);
  await assert.rejects(run(outsider, 'GET', '/BIDS/800'), forbidden);
});

test('collection filters limit private records to memberships or negotiation parties', () => {
  assert.deepEqual(readScope(alice, 'tournaments'), { participants: { user: 1, retiredAt: null } });
  assert.deepEqual(readScope(alice, 'negotiations'), { $or: [{ buyerParticipant: { user: 1 } }, { sellerParticipant: { user: 1 } }] });
  assert.deepEqual(readScope(admin, 'bids'), {});
  assert.deepEqual(readScope(alice, 'matchday-lineups'), { participant: { tournament: { participants: { user: 1, retiredAt: null } } } });
});

test('only the owner can quick-sell or rearrange an existing squad', async () => {
  const { run } = fixture();
  await assert.rejects(run(alice, 'POST', '/participants/22/quick-sell-player', { realPlayerId: 503 }), forbidden);
  await assert.rejects(run(alice, 'PATCH', '/participant-squads/222', {}), forbidden);
  await assert.rejects(run(alice, 'PATCH', '/participant-squads/111', { startingRealPlayersIds: [503], substitutesRealPlayersIds: [502] }), forbidden);
  const result = await run(alice, 'PATCH', '/participant-squads/111', { participant: 22, startingRealPlayersIds: [502], substitutesRealPlayersIds: [501] });
  assert.deepEqual(result.startingRealPlayersIds, [502]);
  assert.equal('participant' in result, false);
});

test('bids cannot impersonate a rival or change their identity', async () => {
  const { run } = fixture();
  await assert.rejects(run(bob, 'PATCH', '/bids/800', { offeredAmount: 20 }), forbidden);
  await assert.rejects(run(alice, 'PATCH', '/bids/800', { participant: 22, offeredAmount: 20 }), forbidden);
  const result = await run(alice, 'PATCH', '/bids/800', { offeredAmount: 20 });
  assert.equal(result.participant, 11);
  assert.equal(result.offeredAmount, 20);
});

test('bids reject fabricated wins, negative amounts, cross-tournament or off-market players', async () => {
  const { run } = fixture();
  const bid = { participant: 11, tournament: 100, realPlayer: 504, matchdayMarket: 700, offeredAmount: 10 };
  await assert.rejects(run(alice, 'POST', '/bids', { ...bid, status: 'won' }), forbidden);
  await assert.rejects(run(alice, 'POST', '/bids', { ...bid, offeredAmount: -100 }), { status: 400 });
  await assert.rejects(run(alice, 'POST', '/bids', { ...bid, tournament: 200 }), forbidden);
  await assert.rejects(run(alice, 'POST', '/bids', { ...bid, realPlayer: 503 }), forbidden);
});

test('negotiations bind the actual buyer and validate seller ownership', async () => {
  const { run } = fixture();
  const offer = { tournament: 100, buyerParticipant: 11, sellerParticipant: 22, dependantPlayer: 603, agreedAmount: 10 };
  await assert.rejects(run(bob, 'POST', '/negotiations', offer), forbidden);
  await assert.rejects(run(alice, 'POST', '/negotiations', { ...offer, dependantPlayer: 601 }), forbidden);
  const result = await run(alice, 'POST', '/negotiations', { ...offer, status: 'accepted' });
  assert.equal(result.status, 'active');
});

test('only the responder accepts an offer, including counteroffers', async () => {
  const { run, data } = fixture();
  await assert.rejects(run(alice, 'POST', '/negotiations/900/accept'), forbidden);
  await assert.rejects(run(outsider, 'POST', '/negotiations/900/accept'), forbidden);
  await run(bob, 'POST', '/negotiations/900/accept');
  data.negotiations[900].status = 'countered';
  await assert.rejects(run(bob, 'POST', '/negotiations/900/accept'), forbidden);
  await run(alice, 'POST', '/negotiations/900/accept');
});

test('negotiation updates cannot fabricate acceptance or swap parties', async () => {
  const { run, data } = fixture();
  await assert.rejects(run(bob, 'PATCH', '/negotiations/900', { agreedAmount: 15, status: 'accepted' }), forbidden);
  await assert.rejects(run(bob, 'PATCH', '/negotiations/900', { agreedAmount: 15, buyerParticipant: 33 }), forbidden);
  assert.equal((await run(bob, 'PATCH', '/negotiations/900', { agreedAmount: 15 })).status, 'countered');
  data.negotiations[900].status = 'accepted';
  await assert.rejects(run(alice, 'DELETE', '/negotiations/900'), forbidden);
});

test('only an owner can create/shield a clause; initial value is server-controlled', async () => {
  const { run } = fixture();
  await assert.rejects(run(alice, 'POST', '/player-clauses/950/apply-shielding', { participantId: 22, amount: 10 }), forbidden);
  await assert.rejects(run(bob, 'POST', '/player-clauses/950/apply-shielding', { participantId: 11, amount: 10 }), forbidden);
  await run(bob, 'POST', '/player-clauses/950/apply-shielding', { participantId: 22, amount: 10 });
  const result = await run(alice, 'POST', '/player-clauses', { tournament: 100, ownerParticipant: 11, dependantPlayer: 601, baseClause: 1, totalClause: 1 });
  assert.equal(result.totalClause, 5_000_000);
  await assert.rejects(run(alice, 'POST', '/player-clauses', { tournament: 100, ownerParticipant: 11, dependantPlayer: 603 }), forbidden);
});

test('clause purchases cannot debit another participant', async () => {
  await assert.rejects(fixture().run(alice, 'POST', '/player-clauses/execute-purchase', {
    tournamentId: 100, buyerParticipantId: 22, sellerParticipantId: 11, dependantPlayerId: 601,
  }), forbidden);
});

test('a player cannot bypass the configured clause activation date', async () => {
  const { run, data } = fixture();
  const purchase = { tournamentId: 100, buyerParticipantId: 11, sellerParticipantId: 22, dependantPlayerId: 603 };
  data.tournaments[100].clauseEnableDate = new Date(Date.now() + 86_400_000);
  await assert.rejects(run(alice, 'POST', '/player-clauses/execute-purchase', purchase), forbidden);
  data.tournaments[100].clauseEnableDate = new Date(Date.now() - 86_400_000);
  await run(alice, 'POST', '/player-clauses/execute-purchase', purchase);
});
