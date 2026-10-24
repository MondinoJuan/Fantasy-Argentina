import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleUrl } from './helpers/load-ts-module.mjs';
import { gameStore, service } from './helpers/game-store.mjs';
const { priceHistory } = await import(moduleUrl(new URL('../src/shared/domain/player-prices.ts', import.meta.url)));
const { evolveLeaguePrices } = await service('playerPrices');
const min = 1e6, max = 7e6;

test('price movement follows deviation, including form six and both price boundaries', () => {
  const quote = (base, score) => priceHistory(base, [{ id: 1, kickoff: 1, score }], min, max)[0].after;
  assert.ok(quote(max, 7) < max);
  assert.ok(quote(min, 6) > min);
  assert.equal(quote(max, 10), max);
  assert.equal(quote(min, -5), min);
  assert.ok(quote(2e6, 6) > 2e6);
  assert.throws(() => priceHistory(min, [], max, min));
});

test('ratings replay by kickoff with stable match tie breaker; refreshed old ratings cannot become latest', () => {
  const inputs = [{ id: 2, kickoff: 20, score: 8 }, { id: 1, kickoff: 10, score: 2 }];
  const history = priceHistory(4e6, inputs, min, max);
  assert.deepEqual(history.map(h => h.matchId), [1, 2]);
  assert.deepEqual(priceHistory(4e6, inputs.reverse(), min, max), history);
  const corrected = priceHistory(4e6, [{ id: 1, kickoff: 10, score: 4 }, inputs.find(r => r.id === 2)], min, max);
  assert.notEqual(corrected.at(-1).after, history.at(-1).after);
  assert.ok(corrected.every(h => Number.isSafeInteger(h.after) && h.after >= min && h.after <= max));
});

test('actual price service is idempotent, corrects history, shares league quotes and ignores pre-adoption matches', async () => {
  const db = gameStore(); db.league.limiteMin = min; db.league.limiteMax = max;
  const quote = db.tables.get('RealPlayerLeagueValue')[0];
  quote.evolutionStartedAt = new Date('2026-01-01'); quote.translatedValue = 4e6;
  const old = db.add('GameMatch', { id: 1, startDateTime: new Date('2025-12-01'), status: 'finalizado' });
  const current = db.add('GameMatch', { id: 2, startDateTime: new Date('2026-01-02'), status: 'finalizado' });
  db.add('PlayerPerformance', { realPlayer: 1, league: db.league, match: old, pointsObtained: 10 });
  const rating = db.add('PlayerPerformance', { realPlayer: 1, league: db.league, match: current, pointsObtained: 8 });
  assert.equal((await evolveLeaguePrices(db.em, 1)).updatedPlayers, 1);
  const first = quote.translatedValue;
  assert.equal(quote.evolutionHistory.length, 1);
  assert.equal((await evolveLeaguePrices(db.em, 1)).updatedPlayers, 0);
  assert.equal(quote.translatedValue, first);
  rating.pointsObtained = 3;
  await evolveLeaguePrices(db.em, 1);
  assert.ok(quote.translatedValue < first);
  assert.equal(quote.evolutionHistory[0].before, 4e6);
  assert.ok(db.locks.includes('League'));
});

