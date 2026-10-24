import { moduleUrl, dataUrl } from './load-ts-module.mjs';

const names = ['League', 'Tournament', 'Participant', 'ParticipantSquad', 'RealPlayer', 'RealPlayerLeagueValue', 'Matchday', 'GameMatch',
  'PlayerPerformance', 'MatchdayMarket', 'Bid', 'Negotiation', 'DependantPlayer', 'PlayerClause', 'Shielding', 'PlayerOwnership', 'OwnershipMovement', 'Transaction'];
const classesUrl = dataUrl(names.map(name => `export class ${name} {}`).join('\n'));
const classes = await import(classesUrl);
export const aliases = new Map([
  ['@mikro-orm/core', dataUrl("export const LockMode = { PESSIMISTIC_WRITE: 'write' }; export const FlushMode = { COMMIT: 'commit' };")],
  ['node:crypto', dataUrl("export { randomUUID } from 'node:crypto';")],
]);
for (const name of names) aliases.set(new URL(`../../src/Entities/${name}/${name[0].toLowerCase() + name.slice(1)}.entity.js`, import.meta.url).href, classesUrl);
export async function service(name) { return import(moduleUrl(new URL(`../../src/shared/services/${name}.service.ts`, import.meta.url), aliases)); }
export const idOf = value => value?.id ?? value;
function matches(row, query) {
  return Object.entries(query).every(([key, expected]) => {
    if (key === '$or') return expected.some(q => matches(row, q));
    if (key === '$and') return expected.every(q => matches(row, q));
    const actual = row?.[key];
    if (expected == null) return actual == null;
    if (expected instanceof Date) return actual instanceof Date && actual.getTime() === expected.getTime();
    if (typeof expected === 'object') {
      if ('$in' in expected) return expected.$in.map(idOf).includes(idOf(actual));
      if ('$nin' in expected) return !expected.$nin.map(idOf).includes(idOf(actual));
      if ('$ne' in expected) return expected.$ne == null ? actual != null : idOf(actual) !== idOf(expected.$ne);
      if ('$gt' in expected) return actual > expected.$gt;
      if ('$lte' in expected) return actual <= expected.$lte;
      if (expected.constructor.name !== 'Object') return idOf(actual) === idOf(expected);
      return matches(actual, expected);
    }
    return idOf(actual) === expected;
  });
}
function snapshot(value) {
  if (value instanceof Date) return new Date(value);
  if (Array.isArray(value)) return value.map(snapshot);
  if (value && value.constructor.name === 'Object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, snapshot(v)]));
  return value;
}
const relations = { league: 'League', tournament: 'Tournament', participant: 'Participant', owner: 'Participant', buyerParticipant: 'Participant', sellerParticipant: 'Participant',
  ownerParticipant: 'Participant', previousOwner: 'Participant', nextOwner: 'Participant', realPlayer: 'RealPlayer', dependantPlayer: 'DependantPlayer',
  match: 'GameMatch', matchday: 'Matchday', matchdayMarket: 'MatchdayMarket', ownership: 'PlayerOwnership', playerClause: 'PlayerClause' };

/** MySQL boundary substitute. Serializes transactions, restores all objects on rollback, resolves FK identities. */
export function gameStore() {
  const tables = new Map(names.map(name => [name, []]));
  let nextId = 100;
  let transactionTail = Promise.resolve();
  const db = { tables, locks: [], failNextFlush: false };
  db.add = (name, data) => {
    const defaults = name === 'ParticipantSquad' ? { formation: '4-4-2', startingRealPlayersIds: [], substitutesRealPlayersIds: [], captainRealPlayerId: null, releaseDate: null }
      : name === 'Negotiation' ? { reservedAmount: 0 } : {};
    const props = { ...defaults, ...data };
    for (const [field, type] of Object.entries(relations)) if (typeof props[field] === 'number') props[field] = tables.get(type).find(row => row.id === props[field]) ?? props[field];
    const entity = Object.assign(new classes[name](), { id: nextId++, ...props });
    tables.get(name).push(entity); return entity;
  };
  const em = db.em = {
    fork() { return this; },
    async find(cls, query = {}, options = {}) {
      if (options.lockMode) db.locks.push(cls.name);
      const rows = tables.get(cls.name).filter(row => matches(row, query));
      if (options.orderBy?.id) rows.sort((a, b) => options.orderBy.id === 'desc' ? b.id - a.id : a.id - b.id);
      return rows;
    },
    async findOne(cls, query, options) { return (await this.find(cls, query, options))[0] ?? null; },
    async findOneOrFail(cls, query, options) {
      const row = await this.findOne(cls, query, options);
      if (!row) { const e = Error(`${cls.name} not found`); e.name = 'NotFoundError'; throw e; }
      return row;
    },
    async refresh() {},
    async flush() { if (db.failNextFlush) { db.failNextFlush = false; throw Error('simulated database flush failure'); } },
    create(cls, data) { return db.add(cls.name, data); },
    remove(entity) { const rows = tables.get(entity.constructor.name); rows.splice(rows.indexOf(entity), 1); },
    async transactional(work) {
      const previous = transactionTail;
      let release; transactionTail = new Promise(resolve => { release = resolve; });
      await previous;
      const lists = new Map([...tables].map(([key, rows]) => [key, [...rows]]));
      const originals = new Map([...tables.values()].flat().map(row => [row, Object.fromEntries(Object.entries(row).map(([key, value]) => [key, snapshot(value)]))]));
      try { return await work(this); }
      catch (error) {
        for (const [row, props] of originals) { for (const key of Object.keys(row)) delete row[key]; Object.assign(row, props); }
        for (const [key, rows] of lists) tables.set(key, rows);
        throw error;
      } finally { release(); }
    },
  };
  const league = db.add('League', { id: 1 });
  const tournament = db.add('Tournament', { id: 1, league, initialBudget: 20e6, allowSquadChangesDuringMatchday: false, allowClauseExecutionDuringMatchday: false });
  const date = db.add('Matchday', { id: 1, league, startDate: new Date(Date.now() + 86_400_000), autoUpdateAt: new Date(Date.now() + 172_800_000) });
  const members = [1, 2, 3].map(id => db.add('Participant', { id, tournament, user: id, bankBudget: 20e6, reservedMoney: 0, availableMoney: 20e6 }));
  const squads = members.map(p => db.add('ParticipantSquad', { id: p.id, participant: p, startingRealPlayersIds: [p.id] }));
  for (const id of [1, 2, 3, 10, 11, 12]) {
    db.add('RealPlayer', { id, position: 'forward', active: true });
    db.add('RealPlayerLeagueValue', { realPlayer: id, league, translatedValue: 1e6 });
  }
  const dependant = db.add('DependantPlayer', { id: 1, tournament, realPlayer: 1 });
  const marketPlayer = db.add('DependantPlayer', { id: 10, tournament, realPlayer: 10 });
  const market = db.add('MatchdayMarket', { id: 1, tournament, matchday: date, dependantPlayerIds: [marketPlayer.id], minimumPrice: 100, closedAt: null });
  return Object.assign(db, { league, tournament, date, members, squads, dependant, market });
}
