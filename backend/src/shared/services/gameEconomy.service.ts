import { randomUUID } from 'node:crypto';
import { EntityManager, FlushMode, LockMode } from '@mikro-orm/core';
import { League } from '../../Entities/League/league.entity.js';
import { Tournament } from '../../Entities/Tournament/tournament.entity.js';
import { Participant } from '../../Entities/Participant/participant.entity.js';
import { ParticipantSquad } from '../../Entities/ParticipantSquad/participantSquad.entity.js';
import { RealPlayer } from '../../Entities/RealPlayer/realPlayer.entity.js';
import { Transaction } from '../../Entities/Transaction/transaction.entity.js';
import { PlayerOwnership } from '../../Entities/PlayerOwnership/playerOwnership.entity.js';
import { OwnershipMovement } from '../../Entities/OwnershipMovement/ownershipMovement.entity.js';
import { Bid } from '../../Entities/Bid/bid.entity.js';
import { Negotiation } from '../../Entities/Negotiation/negotiation.entity.js';
import { GameRuleError, balances, entityId, moneyChange, normalizeSquad, ownedIds } from '../domain/game-rules.js';
import type { TransactionType } from '../domain-enums.js';

/** Same lock order everywhere: league, participants by id, then offers/player records. */
export async function lockTournament(em: EntityManager, tournamentId: number) {
  const tournament = await em.findOneOrFail(Tournament, { id: tournamentId }, { populate: ['league'] });
  await em.findOneOrFail(League, { id: entityId(tournament.league) }, { lockMode: LockMode.PESSIMISTIC_WRITE });
  await em.refresh(tournament);
  const participants = await em.find(Participant, { tournament }, { orderBy: { id: 'asc' }, lockMode: LockMode.PESSIMISTIC_WRITE });
  for (const p of participants) balances(p);
  return tournament;
}

export async function gameTransaction<T>(em: EntityManager, tournamentId: number, reason: string,
  work: (tx: EntityManager, tournament: Tournament) => Promise<T>): Promise<T> {
  return em.transactional(async tx => {
    const tournament = await lockTournament(tx, tournamentId);
    await reconcileOwnership(tx, tournament, 'baseline');
    const result = await work(tx, tournament);
    await tx.flush();
    await reconcileOwnership(tx, tournament, reason);
    for (const participant of await tx.find(Participant, { tournament })) balances(participant);
    await verifyReservations(tx, tournament);
    await tx.flush();
    return result;
  });
}

/** Integer game units; reserve changes do not change the bank. No clamping of invalid balances. */
export async function changeMoney(em: EntityManager, participant: Participant, bankDelta: number, reserveDelta: number,
  type: TransactionType, eventKey: string = randomUUID(), referenceTable = 'participant', referenceId = String(participant.id), actorId?: number) {
  const previous = await em.findOne(Transaction, { eventKey });
  if (previous) return false;
  const change = moneyChange(participant, bankDelta, reserveDelta);
  if (bankDelta === 0 && reserveDelta === 0) return false;
  Object.assign(participant, change.after);
  em.create(Transaction, { tournament: participant.tournament,
    originParticipant: bankDelta < 0 || reserveDelta > 0 ? participant : undefined,
    destinationParticipant: bankDelta > 0 || reserveDelta < 0 ? participant : undefined,
    type, amount: Math.abs(bankDelta || reserveDelta), eventKey,
    balanceChange: { ...change, bankDelta, reserveDelta, actorId: actorId ?? null, participantId: participant.id },
    referenceTable, referenceId, creationDate: new Date(), effectiveDate: new Date(),
    createdAt: new Date(), updatedAt: new Date() });
  return true;
}

export async function recordInitialBudget(em: EntityManager, participant: Participant, legacyBaseline = false) {
  const eventKey = `initial-budget:${participant.id}`;
  if (await em.findOne(Transaction, { eventKey })) return;
  em.create(Transaction, { tournament: participant.tournament, destinationParticipant: participant, type: legacyBaseline ? 'admin_adjustment' : 'initial_budget',
    amount: participant.bankBudget, eventKey, balanceChange: { baseline: balances(participant), legacyBaseline, participantId: participant.id },
    referenceTable: 'participant', referenceId: String(participant.id), creationDate: new Date(), effectiveDate: new Date(),
    createdAt: new Date(), updatedAt: new Date() });
}

/** Relational unique (tournament, player) is the authoritative current owner; arrays are its validated projection. */
export async function reconcileOwnership(em: EntityManager, tournament: Tournament, reason: string) {
  const squads = await em.find(ParticipantSquad, { participant: { tournament }, releaseDate: null }, {
    populate: ['participant'], flushMode: FlushMode.COMMIT,
  });
  const owners = new Map<number, Participant>();
  const participants = new Set<number>();
  for (const squad of squads) {
    if (participants.has(entityId(squad.participant))) throw new GameRuleError(`Hay dos planteles activos para el participante ${entityId(squad.participant)}`);
    participants.add(entityId(squad.participant));
    try {
      const normalized = normalizeSquad(squad);
      if (squad.startingSlots) {
        const explicit = normalizeSquad(squad, squad.startingSlots);
        if (explicit.startingRealPlayersIds.some((id, index) => id !== normalized.startingRealPlayersIds[index])) throw new GameRuleError('Los puestos no coinciden con la proyección del plantel');
      }
      Object.assign(squad, normalized);
    }
    catch (error: any) { throw new GameRuleError(`Plantel ${squad.id}, participante ${entityId(squad.participant)}: ${error.message}`); }
    for (const playerId of ownedIds(squad)) {
      if (owners.has(playerId)) throw new GameRuleError(`Jugador ${playerId} duplicado en el torneo ${tournament.id}`);
      owners.set(playerId, squad.participant);
    }
  }
  const validPlayers = owners.size ? await em.find(RealPlayer, { id: { $in: [...owners.keys()] } }, { flushMode: FlushMode.COMMIT }) : [];
  if (validPlayers.length !== owners.size) throw new GameRuleError(`El torneo ${tournament.id} contiene jugadores inexistentes`);
  const rows = await em.find(PlayerOwnership, { tournament }, { flushMode: FlushMode.COMMIT });
  const byPlayer = new Map(rows.map(row => [entityId(row.realPlayer), row]));
  for (const playerId of new Set([...owners.keys(), ...byPlayer.keys()])) {
    const owner = owners.get(playerId) ?? null;
    let row = byPlayer.get(playerId);
    if (row && reason === 'baseline' && entityId(row.owner) !== entityId(owner)) throw new GameRuleError(`La propiedad del jugador ${playerId} no coincide con su plantel`);
    if (!row) row = em.create(PlayerOwnership, { tournament, realPlayer: playerId, owner: null, changedAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
    if (entityId(row.owner) === entityId(owner)) continue;
    em.create(OwnershipMovement, { ownership: row, previousOwner: row.owner ?? null, nextOwner: owner,
      reason, occurredAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
    row.owner = owner; row.changedAt = new Date();
  }
}

export async function activeSquad(em: EntityManager, participantId: number) {
  return em.findOneOrFail(ParticipantSquad, { participant: participantId, releaseDate: null });
}

export async function expectedReservations(em: EntityManager, tournament: Tournament) {
  const totals = new Map<number, number>();
  for (const bid of await em.find(Bid, { tournament, status: 'active' })) {
    const id = entityId(bid.participant); totals.set(id, (totals.get(id) ?? 0) + Number(bid.offeredAmount));
  }
  for (const offer of await em.find(Negotiation, { tournament, status: { $in: ['active', 'countered'] } })) {
    const id = entityId(offer.buyerParticipant); totals.set(id, (totals.get(id) ?? 0) + Number(offer.reservedAmount ?? 0));
  }
  return totals;
}
export async function verifyReservations(em: EntityManager, tournament: Tournament) {
  const totals = await expectedReservations(em, tournament);
  for (const participant of await em.find(Participant, { tournament })) {
    balances(participant);
    if (participant.reservedMoney !== (totals.get(participant.id!) ?? 0)) throw new GameRuleError(`La reserva del participante ${participant.id} no coincide con sus ofertas activas`);
  }
}

export async function cancelNegotiation(em: EntityManager, negotiation: Negotiation, status: 'cancelled' | 'rejected' = 'cancelled') {
  if (!['active', 'countered'].includes(negotiation.status)) return;
  const amount = Number(negotiation.reservedAmount ?? 0);
  if (amount) await changeMoney(em, negotiation.buyerParticipant, 0, -amount, 'release', undefined, 'negotiation', String(negotiation.id));
  negotiation.reservedAmount = 0; negotiation.status = status; negotiation.rejectionDate = new Date();
}

export async function cancelPlayerOffers(em: EntityManager, tournamentId: number, realPlayerId: number, exceptNegotiation?: number) {
  for (const bid of await em.find(Bid, { tournament: tournamentId, realPlayer: realPlayerId, status: 'active' }, { populate: ['participant'] })) {
    await changeMoney(em, bid.participant, 0, -Number(bid.offeredAmount), 'release', undefined, 'bid', String(bid.id));
    bid.status = 'cancelled'; bid.cancellationDate = new Date();
  }
  const offers = await em.find(Negotiation, { tournament: tournamentId, dependantPlayer: { realPlayer: realPlayerId }, status: { $in: ['active', 'countered'] } }, { populate: ['buyerParticipant'] });
  for (const offer of offers) if (offer.id !== exceptNegotiation) await cancelNegotiation(em, offer);
}

export async function initializeGameIntegrity(em: EntityManager) {
  const tournaments = await em.find(Tournament, {}, { orderBy: { id: 'asc' } });
  for (const tournament of tournaments) await gameTransaction(em, tournament.id!, 'observed_initial_ownership', async tx => {
    const totals = await expectedReservations(tx, tournament);
    for (const participant of await tx.find(Participant, { tournament })) {
      await recordInitialBudget(tx, participant, true);
      const expected = totals.get(participant.id!) ?? 0;
      await changeMoney(tx, participant, 0, expected - participant.reservedMoney, expected > participant.reservedMoney ? 'reserve' : 'release', undefined, 'integrity_bootstrap', String(participant.id));
    }
    // Legacy offers had no reservation. Preserve affordable offers, cancel the rest with their record intact.
    for (const offer of await tx.find(Negotiation, { tournament, status: 'active', reservedAmount: 0 }, { populate: ['buyerParticipant'], orderBy: { id: 'asc' } })) {
      const amount = Number(offer.agreedAmount);
      if (Number.isSafeInteger(amount) && amount > 0 && offer.buyerParticipant.availableMoney >= amount) {
        await changeMoney(tx, offer.buyerParticipant, 0, amount, 'reserve', undefined, 'negotiation', String(offer.id)); offer.reservedAmount = amount;
      } else await cancelNegotiation(tx, offer);
    }
  });
}
