import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleUrl } from './helpers/load-ts-module.mjs';
import { gameStore, service } from './helpers/game-store.mjs';

const rules = await import(moduleUrl(new URL('../src/shared/domain/game-rules.ts', import.meta.url)));
const { writeBid, writeNegotiation, quickSell, buyClause, shieldPlayer, retireParticipant } = await service('gameCommands');
const { saveSquad } = await service('squadCommands');
const { initializeGameIntegrity } = await service('gameEconomy');
const actor = id => ({ id, type: 'USER' });
const admin = { id: 99, type: 'SUPERADMIN' };
const bid = (participant = 2, amount = 2e6) => ({ tournament: 1, participant, matchdayMarket: 1, realPlayer: 10, offeredAmount: amount });
const offer = (buyerParticipant = 2, amount = 3e6) => ({ tournament: 1, buyerParticipant, sellerParticipant: 1, dependantPlayer: 1, agreedAmount: amount });
const balance = p => [p.bankBudget, p.reservedMoney, p.availableMoney];
const count = (db, name) => db.tables.get(name).length;

test('retirement preserves participants, squads, offers and ledger while releasing players and reserves', async () => {
  const db = gameStore();
  const offer = await writeBid(db.em, bid(2), actor(2));
  const before = db.squads[1];
  await retireParticipant(db.em, 1, 2, actor(2));
  assert.ok(db.members[1].retiredAt instanceof Date);
  assert.ok(before.releaseDate instanceof Date);
  assert.equal(count(db, 'Participant'), 3);
  assert.equal(count(db, 'ParticipantSquad'), 3);
  assert.equal(offer.status, 'cancelled');
  assert.equal(db.members[1].reservedMoney, 0);
  assert.ok(count(db, 'Transaction') >= 2);
  assert.equal(db.tables.get('PlayerOwnership').find(p => p.realPlayer.id === 2).owner, null);
  await assert.rejects(writeBid(db.em, bid(2), actor(2)));
  await assert.rejects(retireParticipant(db.em, 1, 1, actor(3)));
  assert.equal(db.members[0].retiredAt, undefined);
});

test('money uses exact integer units, rejects non-finite/negative/fractional values and detects inconsistent balances', () => {
  for (const amount of [NaN, Infinity, -1, 0.5, '100', Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => rules.money(amount));
  assert.equal(rules.money(0, true), 0);
  assert.throws(() => rules.balances({ bankBudget: 20, reservedMoney: 10, availableMoney: 20 }));
  assert.deepEqual(rules.moneyChange({ bankBudget: 20, reservedMoney: 5, availableMoney: 15 }, -5, -5).after,
    { bankBudget: 15, reservedMoney: 0, availableMoney: 15 });
});
test('explicit slots preserve holes and reject duplicate slots, duplicates, invalid formations and bench captains', () => {
  const slots = rules.slotNames('4-4-2').map((slotId, i) => ({ slotId, realPlayerId: i === 1 ? 1 : null }));
  const normalized = rules.normalizeSquad({ formation: '4-4-2', substitutesRealPlayersIds: [] }, slots);
  assert.deepEqual(normalized.startingRealPlayersIds.slice(0, 3), [0, 1, 0]);
  assert.equal(normalized.startingSlots[1].slotId, 'f-1');
  assert.throws(() => rules.normalizeSquad({ formation: '4-4-2' }, [...slots.slice(1), slots[1]]));
  assert.throws(() => rules.normalizeSquad({ formation: '4-4-2', startingRealPlayersIds: [1, 1] }));
  assert.throws(() => rules.normalizeSquad({ formation: '9-0-1' }));
  assert.throws(() => rules.normalizeSquad({ formation: '4-4-2', startingRealPlayersIds: [1], substitutesRealPlayersIds: [2], captainRealPlayerId: 2 }));
});

test('bid create/edit/retry/cancel changes only the required reserve and preserves its record', async () => {
  const db = gameStore(), p = db.members[1];
  const row = await writeBid(db.em, bid(), actor(2));
  assert.deepEqual(balance(p), [20e6, 2e6, 18e6]);
  row.bidDate = new Date('2020-01-01');
  await writeBid(db.em, { offeredAmount: 3e6 }, actor(2), row.id);
  assert.deepEqual(balance(p), [20e6, 3e6, 17e6]); assert.equal(row.bidDate.getUTCFullYear(), 2020);
  const events = count(db, 'Transaction');
  await writeBid(db.em, { offeredAmount: 3e6 }, actor(2), row.id);
  assert.equal(count(db, 'Transaction'), events);
  await writeBid(db.em, {}, actor(2), row.id, true);
  await writeBid(db.em, {}, actor(2), row.id, true);
  assert.deepEqual(balance(p), [20e6, 0, 20e6]); assert.equal(row.status, 'cancelled'); assert.equal(count(db, 'Bid'), 1);
  assert.deepEqual(db.locks.slice(0, 2), ['League', 'Participant']);
});
test('bid checks quote, membership, market contents, identity, deadline and available money inside the transaction', async () => {
  for (const input of [bid(2, -1), bid(2, NaN), bid(2, 999999), { ...bid(), realPlayer: 1 }, bid(2, 21e6)]) {
    const db = gameStore(); await assert.rejects(writeBid(db.em, input, actor(2)));
    assert.deepEqual(balance(db.members[1]), [20e6, 0, 20e6]); assert.equal(count(db, 'Bid'), 0);
  }
  const db = gameStore();
  await assert.rejects(writeBid(db.em, bid(2), actor(1)));
  const row = await writeBid(db.em, bid(), actor(2));
  await assert.rejects(writeBid(db.em, { realPlayer: 11, offeredAmount: 4e6 }, actor(2), row.id));
  db.date.autoUpdateAt = new Date(Date.now() - 1000);
  await assert.rejects(writeBid(db.em, bid(3), actor(3)));
});
test('an offer can consume exactly the available budget, but cannot reuse money held for a negotiation', async () => {
  const db = gameStore(); await writeNegotiation(db.em, offer(), actor(2));
  await assert.rejects(writeBid(db.em, bid(2, 18e6), actor(2)));
  await writeBid(db.em, bid(2, 17e6), actor(2));
  assert.deepEqual(balance(db.members[1]), [20e6, 20e6, 0]);
});
test('database failure rolls back reservations, bids, ownership projection and ledger entries together', async () => {
  const db = gameStore(); db.failNextFlush = true;
  await assert.rejects(writeBid(db.em, bid(), actor(2)), /flush failure/);
  assert.deepEqual(balance(db.members[1]), [20e6, 0, 20e6]);
  for (const name of ['Bid', 'Transaction', 'PlayerOwnership', 'OwnershipMovement']) assert.equal(count(db, name), 0);
});
test('new market rounds create independent bids while preserving won bids from previous rounds', async () => {
  const db = gameStore();
  const previous = db.add('MatchdayMarket', { id: 9, tournament: db.tournament, matchday: db.date, dependantPlayerIds: [10], closedAt: new Date() });
  const old = db.add('Bid', { id: 9, tournament: db.tournament, participant: db.members[1], matchdayMarket: previous, realPlayer: 10, status: 'lost', offeredAmount: 2e6 });
  const row = await writeBid(db.em, bid(), actor(2));
  assert.notEqual(row.id, old.id); assert.equal(old.status, 'lost'); assert.equal(count(db, 'Bid'), 2);
});
test('negotiation cancellation releases its whole reservation exactly once without deleting the offer', async () => {
  const db = gameStore(); const row = await writeNegotiation(db.em, offer(), actor(2));
  assert.deepEqual(balance(db.members[1]), [20e6, 3e6, 17e6]);
  await writeNegotiation(db.em, {}, actor(1), row.id, 'cancel');
  await writeNegotiation(db.em, {}, actor(1), row.id, 'cancel');
  assert.deepEqual(balance(db.members[1]), [20e6, 0, 20e6]); assert.equal(row.status, 'rejected'); assert.equal(count(db, 'Negotiation'), 1);
});
test('counteroffer releases the old commitment; only the buyer can commit the new amount', async () => {
  const db = gameStore(); const row = await writeNegotiation(db.em, offer(), actor(2));
  await writeNegotiation(db.em, { agreedAmount: 4e6 }, actor(1), row.id);
  assert.equal(row.status, 'countered'); assert.equal(row.reservedAmount, 0); assert.deepEqual(balance(db.members[1]), [20e6, 0, 20e6]);
  const b = await writeBid(db.em, bid(2, 19e6), actor(2));
  await assert.rejects(writeNegotiation(db.em, {}, actor(2), row.id, 'accept'));
  await writeBid(db.em, {}, actor(2), b.id, true);
  await writeNegotiation(db.em, {}, actor(2), row.id, 'accept');
  assert.deepEqual(balance(db.members[1]), [16e6, 0, 16e6]); assert.deepEqual(balance(db.members[0]), [24e6, 0, 24e6]);
  assert.equal(db.squads[0].startingRealPlayersIds[0], 0); assert.ok(db.squads[1].substitutesRealPlayersIds.includes(1));
});
test('wrong responder cannot accept and two competing purchases produce one owner and one charge', async () => {
  const db = gameStore(); const first = await writeNegotiation(db.em, offer(2), actor(2));
  const second = await writeNegotiation(db.em, offer(3), actor(3));
  await assert.rejects(writeNegotiation(db.em, {}, actor(2), first.id, 'accept'));
  const results = await Promise.allSettled([writeNegotiation(db.em, {}, actor(1), first.id, 'accept'), writeNegotiation(db.em, {}, actor(1), second.id, 'accept')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(first.status, 'accepted'); assert.equal(second.status, 'cancelled');
  assert.deepEqual(balance(db.members[0]), [23e6, 0, 23e6]); assert.deepEqual(balance(db.members[2]), [20e6, 0, 20e6]);
  const holder = db.tables.get('PlayerOwnership').find(row => row.realPlayer.id === 1);
  assert.equal(holder.owner.id, 2);
  await writeNegotiation(db.em, {}, actor(1), first.id, 'accept');
  assert.equal(db.members[0].bankBudget, 23e6);
});
test('quick sale rounds down, refunds all incoming offers, clears the captain and cannot pay twice', async () => {
  const db = gameStore(); db.squads[0].captainRealPlayerId = 1;
  const quote = db.tables.get('RealPlayerLeagueValue').find(row => row.realPlayer.id === 1); quote.translatedValue = 1_000_001;
  const row = await writeNegotiation(db.em, offer(), actor(2));
  const result = await quickSell(db.em, 1, 1, actor(1));
  assert.equal(result.saleValue, 700000); assert.equal(db.members[0].bankBudget, 20_700_000);
  assert.equal(row.status, 'cancelled'); assert.deepEqual(balance(db.members[1]), [20e6, 0, 20e6]);
  assert.equal(db.squads[0].captainRealPlayerId, null);
  await assert.rejects(quickSell(db.em, 1, 1, actor(1)));
  assert.equal(db.members[0].bankBudget, 20_700_000);
});
test('shielding and clause purchase share budget locks, preserve raised prices and enforce cooldown', async () => {
  const db = gameStore(); const clause = db.add('PlayerClause', { id: 1, tournament: db.tournament, dependantPlayer: db.dependant, ownerParticipant: db.members[0], baseClause: 4e6, additionalShieldingClause: 0, totalClause: 4e6 });
  await shieldPlayer(db.em, clause.id, 1, 1e6, actor(1)); assert.equal(clause.totalClause, 6e6);
  const purchase = { tournamentId: 1, dependantPlayerId: 1, buyerParticipantId: 2, sellerParticipantId: 1 };
  await buyClause(db.em, purchase, actor(2));
  assert.equal(clause.totalClause, 6e6); assert.equal(clause.ownerParticipant.id, 2);
  assert.deepEqual(balance(db.members[0]), [25e6, 0, 25e6]); assert.deepEqual(balance(db.members[1]), [14e6, 0, 14e6]);
  await assert.rejects(buyClause(db.em, { ...purchase, buyerParticipantId: 3, sellerParticipantId: 2 }, actor(3)), /cooldown/);
  assert.equal(db.members[2].bankBudget, 20e6);
});
test('clause enable date and the receiving bench limit are checked again in the transaction', async () => {
  const db = gameStore();
  const purchase = { tournamentId: 1, dependantPlayerId: 1, buyerParticipantId: 2, sellerParticipantId: 1 };
  db.tournament.clauseEnableDate = new Date(Date.now() + 86400000);
  await assert.rejects(buyClause(db.em, purchase, actor(2)));
  db.tournament.clauseEnableDate = new Date(0);
  for (const id of [11, 12, 13, 14, 15]) if (!db.tables.get('RealPlayer').some(p => p.id === id)) db.add('RealPlayer', { id });
  db.squads[1].substitutesRealPlayersIds = [11, 12, 13, 14, 15];
  await assert.rejects(buyClause(db.em, purchase, actor(2)), /lugar/);
  assert.deepEqual(balance(db.members[1]), [20e6, 0, 20e6]);
});
test('squad writes persist explicit holes and reject forged ownership, duplicate owners and nonexistent players', async () => {
  const db = gameStore();
  const slots = rules.slotNames('4-4-2').map((slotId, i) => ({ slotId, realPlayerId: i === 1 ? 1 : null }));
  const row = await saveSquad(db.em, { startingSlots: slots }, actor(1), 1);
  assert.deepEqual(row.startingRealPlayersIds.slice(0, 3), [0, 1, 0]); assert.equal(row.startingSlots[1].realPlayerId, 1);
  await assert.rejects(saveSquad(db.em, { startingRealPlayersIds: [2] }, actor(1), 1));
  await assert.rejects(saveSquad(db.em, { startingRealPlayersIds: [1] }, admin, 3), /duplicado/);
  await assert.rejects(saveSquad(db.em, { startingRealPlayersIds: [999] }, admin, 3), /inexistentes/);
  assert.equal(db.squads[2].startingRealPlayersIds[0], 3);
});
test('a delayed closure keeps squad changes locked even after the scheduled time passed', async () => {
  const db = gameStore(); db.date.startDate = new Date(Date.now() - 86400000); db.date.autoUpdateAt = new Date(Date.now() - 1000); db.date.status = 'completed';
  await assert.rejects(saveSquad(db.em, { captainRealPlayerId: 1 }, actor(1), 1), /locked/);
  db.date.closureCompletedAt = new Date();
  await saveSquad(db.em, { captainRealPlayerId: 1 }, actor(1), 1);
  assert.equal(db.squads[0].captainRealPlayerId, 1);
});
test('bootstrap releases orphaned reservations and reserves or cancels legacy offers without inventing past ownership', async () => {
  const db = gameStore(); Object.assign(db.members[1], { availableMoney: 18e6, reservedMoney: 2e6 });
  const first = db.add('Negotiation', { id: 1, tournament: db.tournament, buyerParticipant: db.members[1], sellerParticipant: db.members[0], dependantPlayer: db.dependant, agreedAmount: 3e6, status: 'active', reservedAmount: 0 });
  const second = db.add('Negotiation', { id: 2, tournament: db.tournament, buyerParticipant: db.members[1], sellerParticipant: db.members[0], dependantPlayer: db.dependant, agreedAmount: 19e6, status: 'active', reservedAmount: 0 });
  await initializeGameIntegrity(db.em);
  assert.deepEqual(balance(db.members[1]), [20e6, 3e6, 17e6]); assert.equal(first.reservedAmount, 3e6); assert.equal(second.status, 'cancelled');
  const events = count(db, 'Transaction'); await initializeGameIntegrity(db.em); assert.equal(count(db, 'Transaction'), events);
  assert.ok(db.tables.get('Transaction').some(t => t.referenceTable === 'integrity_bootstrap'));
});
