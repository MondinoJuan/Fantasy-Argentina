import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleUrl } from './helpers/load-ts-module.mjs';
const { drawInitialSquads } = await import(moduleUrl(new URL('../src/shared/domain/initial-draw.ts', import.meta.url)));
const required = { forward: 2, midfielder: 4, defender: 4, goalkeeper: 1 };
function fixture() {
  let id = 0, seed = 17;
  const players = Object.entries(required).flatMap(([position, count]) => Array.from({ length: count * 8 }, () => ({ id: ++id, position })));
  const quality = new Map(players.map((p, i) => [p.id, 4 + i % 7 * .5]));
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  return { players, quality, random };
}
test('one joint draw gives every participant eleven exclusive players, with approximately equal sporting quality', () => {
  const f = fixture();
  const result = drawInitialSquads(f.players, [8, 3, 5, 2], f.quality, f.random);
  assert.equal(result.size, 4);
  const means = [];
  for (const squad of result.values()) {
    assert.equal(squad.length, 11);
    assert.deepEqual(squad.map(p => p.position), Object.entries(required).flatMap(([p, n]) => Array(n).fill(p)));
    means.push(squad.reduce((sum, p) => sum + f.quality.get(p.id), 0) / 11);
  }
  assert.equal(new Set([...result.values()].flat().map(p => p.id)).size, 44);
  assert.ok(Math.max(...means) - Math.min(...means) <= .2);
  assert.equal(f.players.length, 88);
});
test('economic prices and classification positions are not inputs to the initial draw', () => {
  const a = fixture(), b = fixture();
  const first = drawInitialSquads(a.players, [1, 2], a.quality, a.random);
  b.players.forEach(p => { p.translatedValue = p.id % 2 ? 1 : 1e9; p.ranking = p.id; });
  const second = drawInitialSquads(b.players, [1, 2], b.quality, b.random);
  for (const id of [1, 2]) assert.deepEqual(first.get(id).map(p => p.id), second.get(id).map(p => p.id));
});
test('join order gives no priority in a joint draw', () => {
  const a = fixture(), b = fixture();
  const first = drawInitialSquads(a.players, [1, 2, 3], a.quality, a.random);
  const second = drawInitialSquads(b.players, [3, 1, 2], b.quality, b.random);
  for (const id of [1, 2, 3]) assert.deepEqual(first.get(id).map(p => p.id), second.get(id).map(p => p.id));
});
test('missing quality, duplicate participants/players and insufficient positional capacity reject the draw', () => {
  const f = fixture();
  assert.throws(() => drawInitialSquads(f.players, [1, 1], f.quality));
  assert.throws(() => drawInitialSquads([...f.players, f.players[0]], [1, 2], f.quality));
  assert.throws(() => drawInitialSquads(f.players, [1, 2], new Map()));
  assert.throws(() => drawInitialSquads(f.players.filter(p => p.position !== 'goalkeeper'), [1, 2], f.quality));
});
