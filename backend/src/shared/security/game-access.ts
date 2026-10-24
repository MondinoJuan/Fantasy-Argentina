/** Authorization policy kept independent of HTTP and persistence for regression tests. */
export interface Actor { id: number; type: 'USER' | 'SUPERADMIN' }
export interface AccessStore {
  get(resource: string, id: number): Promise<any | null>;
  visible(resource: string, id: number, actor: Actor): Promise<boolean>;
  latestSquad(participantId: number): Promise<any | null>;
  translatedValue(leagueId: number, realPlayerId: number): Promise<number | null>;
}

export class AccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function entityId(value: any): number {
  const raw = value && typeof value === 'object' ? value.id : value;
  const id = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) throw new AccessError(400, 'Invalid resource id');
  return id;
}

export function readScope(actor: Actor, resource: string, tournamentId?: unknown): Record<string, any> {
  if (tournamentId !== undefined) {
    const id = entityId(tournamentId);
    const scope = resource === 'tournaments' ? { id }
      : ['participant-squads', 'participant-matchday-points', 'player-points-breakdowns', 'matchday-lineups', 'shieldings'].includes(resource)
        ? { participant: { tournament: id } } : { tournament: id };
    return { $and: [readScope(actor, resource), scope] };
  }
  if (actor.type === 'SUPERADMIN') return {};
  const tournament = { participants: { user: actor.id, retiredAt: null } };
  if (resource === 'tournaments') return tournament;
  if (resource === 'participants') return { tournament };
  if (['participant-squads', 'participant-matchday-points', 'player-points-breakdowns', 'matchday-lineups'].includes(resource)) {
    return { participant: { tournament } };
  }
  if (resource === 'negotiations') return { $or: [{ buyerParticipant: { user: actor.id } }, { sellerParticipant: { user: actor.id } }] };
  if (resource === 'transactions') return { $or: [{ originParticipant: { user: actor.id } }, { destinationParticipant: { user: actor.id } }] };
  if (resource === 'shieldings') return { participant: { user: actor.id } };
  return { tournament };
}

const scopedResources = new Set([
  'tournaments', 'participants', 'participant-squads', 'bids', 'negotiations',
  'dependant-players', 'matchday-markets', 'player-clauses', 'shieldings',
  'transactions', 'participant-matchday-points', 'player-points-breakdowns', 'matchday-lineups',
]);

function deny(): never { throw new AccessError(403, 'Forbidden'); }
function select(body: any, keys: string[]) {
  return Object.fromEntries(keys.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
}
function field(body: any, key: string): any { return body[key] ?? body[`${key}Id`]; }
function bindUser(body: any, key: string, actor: Actor) {
  if (body[key] !== undefined && entityId(body[key]) !== actor.id) deny();
  body[key] = actor.id;
}

/** Return a trusted request body. Never forward arbitrary client-controlled identities/states. */
export async function authorizeGameRequest(
  store: AccessStore, actor: Actor, method: string, path: string, rawBody: any = {},
): Promise<any> {
  const body = rawBody ?? {};
  // Express routes are case-insensitive by default; the policy must match that behavior.
  const [resource, idPart, action] = path.toLowerCase().split('/').filter(Boolean);
  if (actor.type === 'SUPERADMIN' || resource === 'users' || resource === 'time') return body;
  if (resource === 'external') deny(); // Includes GET endpoints that consume provider quota.

  async function get(kind: string, rawId: any) {
    const item = await store.get(kind, entityId(rawId));
    if (!item) throw new AccessError(404, 'Resource not found');
    return item;
  }
  async function ownParticipant(rawId: any) {
    const participant = await get('participants', rawId);
    if (entityId(participant.user) !== actor.id) deny();
    if (participant.retiredAt) deny();
    return participant;
  }
  async function ownedPlayer(participant: any, dependant: any) {
    if (entityId(participant.tournament) !== entityId(dependant.tournament)) deny();
    const squad = await store.latestSquad(entityId(participant));
    const owned = [...(squad?.startingRealPlayersIds ?? []), ...(squad?.substitutesRealPlayersIds ?? [])];
    if (!owned.includes(entityId(dependant.realPlayer))) deny();
  }

  if (method === 'GET' || method === 'HEAD') {
    if (resource === 'bids' && idPart === 'tournament') {
      if (!await store.visible('tournaments', entityId(action), actor)) deny();
    } else if (scopedResources.has(resource) && idPart
      && !(resource === 'tournaments' && ['by-public-code', 'matchday-automation-schedule'].includes(idPart))) {
      if (!await store.visible(resource, entityId(idPart), actor)) deny();
    }
    return body;
  }

  if (resource === 'tournaments' && method === 'POST' && !idPart) {
    bindUser(body, 'creatorUserId', actor);
    return select(body, ['creatorUserId', 'name', 'league', 'leagueId', 'sport', 'sportId', 'competitionId',
      'initialBudget', 'squadSize', 'status', 'clauseWaitDays', 'allowSquadChangesDuringMatchday', 'allowClauseExecutionDuringMatchday']);
  }
  if (resource === 'tournaments' && method === 'POST' && action === 'start') {
    const tournament = await get(resource, idPart);
    if (tournament.creatorUserId !== actor.id || !await store.visible(resource, entityId(idPart), actor)) deny();
    return {};
  }
  if (resource === 'participants') {
    if (method === 'POST' && ['join-by-code', 'leave-tournament'].includes(idPart)) {
      bindUser(body, 'userId', actor);
      return select(body, idPart === 'join-by-code' ? ['userId', 'tournamentCode'] : ['userId', 'tournamentId']);
    }
    if (method === 'POST' && action === 'quick-sell-player') {
      await ownParticipant(idPart);
      return select(body, ['realPlayer', 'realPlayerId']);
    }
    deny(); // Raw balances, points, membership, spending and transfers are administrative.
  }
  if (resource === 'participant-squads' && ['PATCH', 'PUT'].includes(method) && idPart && !action) {
    const squad = await get(resource, idPart);
    await ownParticipant(squad.participant);
    const allowed = new Set([...squad.startingRealPlayersIds, ...squad.substitutesRealPlayersIds].filter(id => id > 0));
    const starting = Array.isArray(body.startingSlots) ? body.startingSlots.map((slot: any) => slot.realPlayerId ?? 0) : body.startingRealPlayersIds ?? squad.startingRealPlayersIds;
    const substitutes = body.substitutesRealPlayersIds ?? squad.substitutesRealPlayersIds;
    if (!Array.isArray(starting) || !Array.isArray(substitutes)) throw new AccessError(400, 'Invalid squad');
    const ids = [...starting, ...substitutes].filter(id => id !== 0 && id !== null).map(entityId);
    if (ids.some((id) => !allowed.has(id)) || new Set(ids).size !== ids.length || ids.length !== allowed.size) deny();
    return { ...select(body, ['formation', 'captainRealPlayerId', 'startingSlots']), startingRealPlayersIds: starting, substitutesRealPlayersIds: substitutes };
  }
  if (resource === 'bids') {
    const existing = idPart ? await get(resource, idPart) : null;
    const participant = await ownParticipant(existing?.participant ?? field(body, 'participant'));
    if (existing && method === 'DELETE') return {};
    if (!['POST', 'PATCH', 'PUT'].includes(method) || action) deny();
    if (existing) {
      for (const key of ['participant', 'tournament', 'realPlayer', 'matchdayMarket']) {
        if (field(body, key) !== undefined && entityId(field(body, key)) !== entityId(existing[key])) deny();
      }
    }
    const tournamentId = entityId(existing?.tournament ?? field(body, 'tournament'));
    const realPlayerId = entityId(existing?.realPlayer ?? field(body, 'realPlayer'));
    const market = await get('matchday-markets', existing?.matchdayMarket ?? field(body, 'matchdayMarket'));
    if (entityId(participant.tournament) !== tournamentId || entityId(market.tournament) !== tournamentId) deny();
    let inMarket = false;
    for (const dependantId of market.dependantPlayerIds ?? []) {
      const dependant = await get('dependant-players', dependantId);
      if (entityId(dependant.tournament) === tournamentId && entityId(dependant.realPlayer) === realPlayerId) inMarket = true;
    }
    if (!inMarket) deny();
    const amount = body.offeredAmount ?? existing?.offeredAmount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) throw new AccessError(400, 'Invalid offered amount');
    if (body.status !== undefined && body.status !== 'active' && !(body.status === 'cancelled' && amount === 0)) deny();
    return { participant: entityId(participant), tournament: tournamentId, realPlayer: realPlayerId,
      matchdayMarket: entityId(market), offeredAmount: amount, status: amount === 0 ? 'cancelled' : 'active',
      cancellationDate: amount === 0 ? new Date() : null };
  }
  if (resource === 'negotiations') {
    if (method === 'POST' && !idPart) {
      const buyer = await ownParticipant(field(body, 'buyerParticipant'));
      const seller = await get('participants', field(body, 'sellerParticipant'));
      const dependant = await get('dependant-players', field(body, 'dependantPlayer'));
      const tournamentId = entityId(field(body, 'tournament'));
      if (entityId(buyer) === entityId(seller) || entityId(buyer.tournament) !== tournamentId || entityId(seller.tournament) !== tournamentId) deny();
      await ownedPlayer(seller, dependant);
      if (typeof body.agreedAmount !== 'number' || !Number.isFinite(body.agreedAmount) || body.agreedAmount <= 0) throw new AccessError(400, 'Invalid agreed amount');
      return { tournament: tournamentId, buyerParticipant: entityId(buyer), sellerParticipant: entityId(seller),
        dependantPlayer: entityId(dependant), agreedAmount: body.agreedAmount, status: 'active', publicationDate: new Date() };
    }
    const negotiation = await get(resource, idPart);
    const buyer = await get('participants', negotiation.buyerParticipant);
    const seller = await get('participants', negotiation.sellerParticipant);
    const isBuyer = entityId(buyer.user) === actor.id;
    const isSeller = entityId(seller.user) === actor.id;
    const responder = negotiation.status === 'active' ? isSeller : negotiation.status === 'countered' ? isBuyer : false;
    if (!isBuyer && !isSeller) deny();
    if (!['active', 'countered'].includes(negotiation.status)) deny();
    if (method === 'POST' && action === 'accept') { if (!responder) deny(); return {}; }
    if (method === 'DELETE' && !action) { if (!isBuyer && !responder) deny(); return {}; }
    if (['PATCH', 'PUT'].includes(method) && !action) {
      for (const key of ['tournament', 'buyerParticipant', 'sellerParticipant', 'dependantPlayer']) {
        if (field(body, key) !== undefined && entityId(field(body, key)) !== entityId(negotiation[key])) deny();
      }
      if (!responder && !isBuyer) deny();
      if (typeof body.agreedAmount !== 'number' || !Number.isFinite(body.agreedAmount) || body.agreedAmount <= 0) throw new AccessError(400, 'Invalid agreed amount');
      const status = isSeller ? 'countered' : 'active';
      if (body.status !== undefined && body.status !== status) deny();
      return { agreedAmount: body.agreedAmount, status, publicationDate: new Date() };
    }
    deny();
  }
  if (resource === 'player-clauses') {
    if (method === 'POST' && action === 'apply-shielding') {
      const clause = await get(resource, idPart);
      const owner = await ownParticipant(clause.ownerParticipant);
      if (entityId(field(body, 'participant')) !== entityId(owner)) deny();
      const dependant = await get('dependant-players', clause.dependantPlayer);
      await ownedPlayer(owner, dependant);
      return { participantId: entityId(owner), amount: body.amount };
    }
    if (method === 'POST' && idPart === 'execute-purchase') {
      const buyer = await ownParticipant(field(body, 'buyerParticipant'));
      if (entityId(buyer.tournament) !== entityId(field(body, 'tournament'))) deny();
      const tournament = await get('tournaments', buyer.tournament);
      if (tournament.clauseEnableDate && new Date(tournament.clauseEnableDate).getTime() > Date.now()) {
        throw new AccessError(403, 'Clauses are not enabled yet for this tournament');
      }
      return select(body, ['tournament', 'tournamentId', 'dependantPlayer', 'dependantPlayerId', 'buyerParticipant', 'buyerParticipantId', 'sellerParticipant', 'sellerParticipantId']);
    }
    if (method === 'POST' && !idPart) {
      const owner = await ownParticipant(field(body, 'ownerParticipant'));
      const dependant = await get('dependant-players', field(body, 'dependantPlayer'));
      if (entityId(field(body, 'tournament')) !== entityId(owner.tournament)) deny();
      await ownedPlayer(owner, dependant);
      const tournament = await get('tournaments', owner.tournament);
      const value = await store.translatedValue(entityId(tournament.league), entityId(dependant.realPlayer));
      if (value === null || !Number.isFinite(value) || value < 0) throw new AccessError(409, 'Player valuation unavailable');
      return { tournament: entityId(tournament), dependantPlayer: entityId(dependant), ownerParticipant: entityId(owner),
        baseClause: Math.ceil(value) + 3_000_000, additionalShieldingClause: 0, totalClause: Math.ceil(value) + 3_000_000 };
    }
    deny();
  }
  deny(); // New mutation endpoints require an explicit policy.
}

/** DTO for sealed bids: competitors expose only identity/count metadata, never their amount. */
export function publicBid(bid: any, actor: Actor) {
  const participantId = entityId(bid.participant);
  const ownsBid = bid.participant?.user && entityId(bid.participant.user) === actor.id;
  const result: Record<string, any> = {
    id: bid.id, participant: { id: participantId }, tournament: { id: entityId(bid.tournament) },
    realPlayer: { id: entityId(bid.realPlayer) }, matchdayMarket: { id: entityId(bid.matchdayMarket) }, status: bid.status,
  };
  if (actor.type === 'SUPERADMIN' || ownsBid) {
    result.offeredAmount = bid.offeredAmount;
    result.bidDate = bid.bidDate;
    result.cancellationDate = bid.cancellationDate;
  }
  return result;
}

export function publicParticipant(participant: any, actor: Actor) {
  const result = select(participant, ['id', 'bankBudget', 'reservedMoney', 'availableMoney', 'totalScore', 'joinDate', 'playingSince', 'retiredAt', 'createdAt', 'updatedAt']);
  result.user = { id: entityId(participant.user), username: participant.user?.username };
  result.tournament = { id: entityId(participant.tournament), name: participant.tournament?.name };
  if (actor.type !== 'SUPERADMIN' && entityId(participant.user) !== actor.id) {
    delete result.availableMoney;
    delete result.reservedMoney;
  }
  return result;
}

export function profileUpdate(input: Record<string, any>, actor: Actor) {
  if (actor.type !== 'SUPERADMIN' && input.type !== undefined) deny();
  return select(input, actor.type === 'SUPERADMIN' ? ['username', 'mail', 'password', 'type'] : ['username', 'mail', 'password']);
}
