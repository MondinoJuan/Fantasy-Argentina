import { ParticipantSquad } from '../../Entities/ParticipantSquad/participantSquad.entity.js';
import { EntityManager } from '@mikro-orm/core';
import { Participant } from '../../Entities/Participant/participant.entity.js';
import { Bid } from '../../Entities/Bid/bid.entity.js';
import { Negotiation } from '../../Entities/Negotiation/negotiation.entity.js';
import { MatchdayMarket } from '../../Entities/MatchdayMarket/matchdayMarket.entity.js';
import { GameMatch } from '../../Entities/GameMatch/gameMatch.entity.js';
import { DependantPlayer } from '../../Entities/DependantPlayer/dependantPlayer.entity.js';
import { PlayerOwnership } from '../../Entities/PlayerOwnership/playerOwnership.entity.js';
import { PlayerClause } from '../../Entities/PlayerClause/playerClause.entity.js';
import { Shielding } from '../../Entities/Shielding/shielding.entity.js';
import { closureTime } from '../../automation/closure-policy.js';
import { GameRuleError, entityId, money, ownedIds, receivePlayer, removePlayer } from '../domain/game-rules.js';
import { gameTransaction, changeMoney, activeSquad, cancelNegotiation, cancelPlayerOffers, reconcileOwnership } from './gameEconomy.service.js';
import { getRealPlayerLeagueTranslatedValue } from '../../Entities/RealPlayerLeagueValue/realPlayerLeagueValue.service.js';
import { assertSquadAndClausesUnlockedByLeague } from './matchdaySquadLock.service.js';

type Actor = { id: number; type: string };
function owns(participant: Participant, actor: Actor) {
  if (actor.type !== 'SUPERADMIN' && entityId(participant.user) !== actor.id) throw new GameRuleError('No tenés permiso para esta operación', 403);
}
async function member(em: EntityManager, tournamentId: number, participantId: number) {
  return em.findOneOrFail(Participant, { id: participantId, tournament: tournamentId, retiredAt: null });
}
async function owner(em: EntityManager, tournamentId: number, playerId: number, sellerId: number) {
  const ownership = await em.findOne(PlayerOwnership, { tournament: tournamentId, realPlayer: playerId });
  if (!ownership || entityId(ownership.owner) !== sellerId) throw new GameRuleError('El vendedor ya no es dueño del jugador');
}
async function movePlayer(em: EntityManager, tournamentId: number, playerId: number, sellerId: number, buyerId: number) {
  await owner(em, tournamentId, playerId, sellerId);
  const seller = await activeSquad(em, sellerId), buyer = await activeSquad(em, buyerId);
  if (!ownedIds(seller).includes(playerId)) throw new GameRuleError('El jugador no pertenece al plantel vendedor');
  receivePlayer(buyer, playerId); removePlayer(seller, playerId);
}

export async function writeBid(em: EntityManager, input: any, actor: Actor, bidId?: number, cancel = false) {
  const original = bidId ? await em.fork().findOneOrFail(Bid, { id: bidId }) : null;
  const tournamentId = entityId(original?.tournament ?? input.tournament);
  return gameTransaction(em, tournamentId, 'bid', async (tx, tournament) => {
    let bid = bidId ? await tx.findOneOrFail(Bid, { id: bidId }) : await tx.findOne(Bid, {
      matchdayMarket: entityId(input.matchdayMarket), participant: entityId(input.participant), realPlayer: entityId(input.realPlayer),
    });
    const participant = await member(tx, tournamentId, entityId(bid?.participant ?? input.participant)); owns(participant, actor);
    const market = await tx.findOneOrFail(MatchdayMarket, { id: entityId(bid?.matchdayMarket ?? input.matchdayMarket), tournament: tournamentId }, { populate: ['matchday'] });
    if (entityId(market.matchday.league) !== entityId(tournament.league)) throw new GameRuleError('El mercado pertenece a otra liga', 400);
    if (market.closedAt || market.matchday.status === 'cancelled' || market.matchday.closureCompletedAt || ['won', 'lost'].includes(bid?.status ?? '')) throw new GameRuleError('El mercado ya cerró');
    const matches = await tx.find(GameMatch, { matchday: market.matchday });
    const deadline = market.matchday.autoUpdateAt ?? closureTime(matches);
    if (!cancel && deadline && deadline <= new Date()) throw new GameRuleError('Terminó el plazo para ofertar');
    const playerId = entityId(bid?.realPlayer ?? input.realPlayer);
    if (bid) for (const key of ['tournament', 'participant', 'matchdayMarket', 'realPlayer']) {
      if (input[key] !== undefined && entityId(input[key]) !== entityId(bid[key as keyof Bid])) throw new GameRuleError('La identidad de una puja no puede cambiar', 400);
    }
    const amount = cancel ? 0 : money(input.offeredAmount ?? bid?.offeredAmount, true);
    const dependant = await tx.findOne(DependantPlayer, { id: { $in: market.dependantPlayerIds }, tournament: tournamentId, realPlayer: playerId });
    if (!dependant) throw new GameRuleError('El jugador no está publicado en ese mercado', 400);
    if (amount) {
      const currentOwner = await tx.findOne(PlayerOwnership, { tournament: tournamentId, realPlayer: playerId });
      if (currentOwner?.owner && entityId(currentOwner.owner) !== entityId(market.sellerParticipant)) throw new GameRuleError('El jugador ya pertenece a otro plantel');
      if (entityId(currentOwner?.owner) === participant.id) throw new GameRuleError('No podés comprar tu propio jugador');
      const squad = await activeSquad(tx, participant.id!);
      if (squad.substitutesRealPlayersIds.length >= 5 || ownedIds(squad).length >= 16) throw new GameRuleError('El plantel está completo');
      const value = await getRealPlayerLeagueTranslatedValue(tx, entityId(tournament.league), playerId);
      if (value == null) throw new GameRuleError('No está disponible la cotización del jugador');
      if (amount < Math.max(Math.ceil(value), market.minimumPrice)) throw new GameRuleError('La puja no alcanza el precio mínimo', 400);
    }
    const before = bid?.status === 'active' ? Number(bid.offeredAmount) : 0;
    await changeMoney(tx, participant, 0, amount - before, amount >= before ? 'reserve' : 'release', undefined, 'bid', String(bid?.id ?? market.id), actor.id);
    if (!bid) bid = tx.create(Bid, { tournament, participant, matchdayMarket: market, realPlayer: playerId,
      offeredAmount: amount, status: amount ? 'active' : 'cancelled', bidDate: new Date(), createdAt: new Date(), updatedAt: new Date() });
    else {
      if (bid.status !== 'active' && amount) bid.bidDate = new Date();
      bid.offeredAmount = amount; bid.status = amount ? 'active' : 'cancelled';
    }
    bid.lastModifiedAt = new Date(); bid.cancellationDate = amount ? undefined : new Date();
    return bid;
  });
}

export async function writeNegotiation(em: EntityManager, input: any, actor: Actor, id?: number, action: 'write' | 'accept' | 'cancel' = 'write') {
  const original = id ? await em.fork().findOneOrFail(Negotiation, { id }) : null;
  const tournamentId = entityId(original?.tournament ?? input.tournament);
  return gameTransaction(em, tournamentId, 'negotiation', async (tx, tournament) => {
    let offer = id ? await tx.findOneOrFail(Negotiation, { id }, { populate: ['dependantPlayer.realPlayer'] }) : null;
    const buyer = await member(tx, tournamentId, entityId(offer?.buyerParticipant ?? input.buyerParticipant));
    const seller = await member(tx, tournamentId, entityId(offer?.sellerParticipant ?? input.sellerParticipant));
    const isBuyer = actor.type === 'SUPERADMIN' || entityId(buyer.user) === actor.id;
    const isSeller = actor.type === 'SUPERADMIN' || entityId(seller.user) === actor.id;
    if (!isBuyer && !isSeller) throw new GameRuleError('No pertenecés a esta negociación', 403);
    if (offer && !['active', 'countered'].includes(offer.status)) {
      if (action === 'accept' && offer.status === 'accepted') return offer;
      if (action === 'cancel') return offer;
      throw new GameRuleError('La negociación ya terminó');
    }
    if (offer && action === 'cancel') { await cancelNegotiation(tx, offer, isSeller && !isBuyer ? 'rejected' : 'cancelled'); return offer; }
    const dependant = offer?.dependantPlayer ?? await tx.findOneOrFail(DependantPlayer, { id: entityId(input.dependantPlayer), tournament: tournamentId }, { populate: ['realPlayer'] });
    if (buyer.id === seller.id || entityId(dependant.tournament) !== tournamentId) throw new GameRuleError('Participantes o jugador inválidos', 400);
    await owner(tx, tournamentId, entityId(dependant.realPlayer), seller.id!);
    if (action === 'accept' && offer) {
      if (!(offer.status === 'active' ? isSeller : isBuyer)) throw new GameRuleError('No es tu turno de responder', 403);
      const amount = money(Number(offer.agreedAmount));
      if (Number(offer.reservedAmount) !== amount) {
        if (offer.status !== 'countered') throw new GameRuleError('La oferta antigua necesita renovarse para reservar sus fondos');
        await changeMoney(tx, buyer, 0, amount, 'reserve', undefined, 'negotiation', String(offer.id), actor.id);
      }
      await movePlayer(tx, tournamentId, entityId(dependant.realPlayer), seller.id!, buyer.id!);
      await changeMoney(tx, buyer, -amount, -amount, 'negotiation_purchase', `negotiation:${offer.id}:purchase`, 'negotiation', String(offer.id), actor.id);
      await changeMoney(tx, seller, amount, 0, 'negotiation_purchase', `negotiation:${offer.id}:sale`, 'negotiation', String(offer.id), actor.id);
      offer.reservedAmount = 0; offer.status = 'accepted'; offer.effectiveDate = new Date();
      await cancelPlayerOffers(tx, tournamentId, entityId(dependant.realPlayer), offer.id);
      const clause = await tx.findOne(PlayerClause, { tournament: tournamentId, dependantPlayer: dependant });
      if (clause) { clause.ownerParticipant = buyer; clause.updateDate = new Date(); }
      return offer;
    }
    if (!offer && !isBuyer) throw new GameRuleError('Solo el comprador puede crear una oferta', 403);
    if (offer && !isBuyer && !(offer.status === 'active' && isSeller)) throw new GameRuleError('No es tu turno de responder', 403);
    if (offer) for (const key of ['tournament', 'buyerParticipant', 'sellerParticipant', 'dependantPlayer']) {
      if (input[key] !== undefined && entityId(input[key]) !== entityId(offer[key as keyof Negotiation])) throw new GameRuleError('La identidad de la negociación no puede cambiar', 400);
    }
    const amount = money(input.agreedAmount);
    const counter = !!offer && isSeller && !isBuyer;
    const reserve = counter ? 0 : amount;
    const reserveDelta = reserve - Number(offer?.reservedAmount ?? 0);
    await changeMoney(tx, buyer, 0, reserveDelta, reserveDelta >= 0 ? 'reserve' : 'release', undefined, 'negotiation', String(offer?.id ?? dependant.id), actor.id);
    if (!offer) offer = tx.create(Negotiation, { tournament, buyerParticipant: buyer, sellerParticipant: seller, dependantPlayer: dependant,
      agreedAmount: amount, reservedAmount: reserve, status: 'active', creationDate: new Date(), createdAt: new Date(), updatedAt: new Date() });
    else { offer.agreedAmount = amount; offer.reservedAmount = reserve; offer.status = counter ? 'countered' : 'active'; }
    offer.publicationDate = new Date();
    return offer;
  });
}

export async function quickSell(em: EntityManager, participantId: number, playerId: number, actor: Actor) {
  const original = await em.fork().findOneOrFail(Participant, { id: participantId });
  return gameTransaction(em, entityId(original.tournament), 'quick_sale', async (tx, tournament) => {
    const participant = await member(tx, tournament.id!, participantId); owns(participant, actor);
    await owner(tx, tournament.id!, playerId, participantId);
    const value = await getRealPlayerLeagueTranslatedValue(tx, entityId(tournament.league), playerId);
    const amount = Math.floor(Number(value) * 0.7); money(amount);
    const squad = await activeSquad(tx, participantId); removePlayer(squad, playerId);
    await cancelPlayerOffers(tx, tournament.id!, playerId);
    const clause = await tx.findOne(PlayerClause, { tournament, dependantPlayer: { realPlayer: playerId } });
    if (clause) tx.remove(clause);
    await changeMoney(tx, participant, amount, 0, 'instant_sale', undefined, 'real_player', String(playerId), actor.id);
    return { participant, squad, saleValue: amount };
  });
}

export async function shieldPlayer(em: EntityManager, clauseId: number, participantId: number, amountInput: unknown, actor: Actor) {
  const original = await em.fork().findOneOrFail(PlayerClause, { id: clauseId });
  const amount = money(amountInput);
  return gameTransaction(em, entityId(original.tournament), 'shielding', async (tx, tournament) => {
    const clause = await tx.findOneOrFail(PlayerClause, { id: clauseId }, { populate: ['dependantPlayer'] });
    const participant = await member(tx, tournament.id!, participantId); owns(participant, actor);
    await owner(tx, tournament.id!, entityId(clause.dependantPlayer.realPlayer), participantId);
    if (entityId(clause.ownerParticipant) !== participantId) throw new GameRuleError('Solo el dueño puede blindar', 403);
    await assertSquadAndClausesUnlockedByLeague(tx, entityId(tournament.league), undefined, { allowClauseExecutionDuringMatchday: tournament.allowClauseExecutionDuringMatchday });
    await changeMoney(tx, participant, -amount, 0, 'shielding_investment', undefined, 'player_clause', String(clause.id), actor.id);
    clause.additionalShieldingClause = money(clause.additionalShieldingClause + 2 * amount, true);
    clause.totalClause = money(clause.baseClause + clause.additionalShieldingClause); clause.updateDate = new Date();
    const shielding = tx.create(Shielding, { playerClause: clause, participant, investedAmount: amount, clauseIncrease: 2 * amount,
      shieldingDate: new Date(), createdAt: new Date(), updatedAt: new Date() });
    return { playerClause: clause, participant, shielding };
  });
}

export async function buyClause(em: EntityManager, input: any, actor: Actor) {
  const tournamentId = entityId(input.tournamentId ?? input.tournament);
  const buyerId = entityId(input.buyerParticipantId ?? input.buyerParticipant), sellerId = entityId(input.sellerParticipantId ?? input.sellerParticipant);
  return gameTransaction(em, tournamentId, 'clause_purchase', async (tx, tournament) => {
    const buyer = await member(tx, tournamentId, buyerId), seller = await member(tx, tournamentId, sellerId); owns(buyer, actor);
    if (buyerId === sellerId) throw new GameRuleError('No podés comprarte tu propio jugador', 400);
    if (tournament.clauseEnableDate && tournament.clauseEnableDate > new Date()) throw new GameRuleError('Las cláusulas todavía no están habilitadas');
    await assertSquadAndClausesUnlockedByLeague(tx, entityId(tournament.league), undefined, { allowClauseExecutionDuringMatchday: tournament.allowClauseExecutionDuringMatchday });
    const dependant = await tx.findOneOrFail(DependantPlayer, { id: entityId(input.dependantPlayerId ?? input.dependantPlayer), tournament: tournamentId });
    let clause = await tx.findOne(PlayerClause, { tournament: tournamentId, dependantPlayer: dependant });
    if (clause?.clauseDisabledUntil && clause.clauseDisabledUntil > new Date()) throw new GameRuleError('La cláusula está en cooldown');
    if (clause && entityId(clause.ownerParticipant) !== sellerId) throw new GameRuleError('El dueño de la cláusula no coincide con el vendedor');
    const value = await getRealPlayerLeagueTranslatedValue(tx, entityId(tournament.league), entityId(dependant.realPlayer));
    if (!clause && value == null) throw new GameRuleError('No está disponible la cotización del jugador');
    const amount = money(clause ? Number(clause.totalClause) : Math.ceil(value!) + 3_000_000);
    await movePlayer(tx, tournamentId, entityId(dependant.realPlayer), sellerId, buyerId);
    await changeMoney(tx, buyer, -amount, 0, 'clause_execution', undefined, 'dependant_player', String(dependant.id), actor.id);
    await changeMoney(tx, seller, amount, 0, 'clause_execution', undefined, 'dependant_player', String(dependant.id), actor.id);
    await cancelPlayerOffers(tx, tournamentId, entityId(dependant.realPlayer));
    const clauseDisabledUntil = new Date(Date.now() + 600_000);
    if (!clause) clause = tx.create(PlayerClause, { tournament, dependantPlayer: dependant, ownerParticipant: buyer, baseClause: amount,
      additionalShieldingClause: 0, totalClause: amount, updateDate: new Date(), clauseDisabledUntil, createdAt: new Date(), updatedAt: new Date() });
    else { clause.ownerParticipant = buyer; clause.updateDate = new Date(); clause.clauseDisabledUntil = clauseDisabledUntil; }
    return { amount, buyerParticipant: buyer, sellerParticipant: seller, playerClause: clause, clauseDisabledUntil };
  });
}

/** Release ownership and offers, retaining all historical records. */
export async function retireParticipant(em: EntityManager, tournamentId: number, userId: number, actor: Actor) {
    return gameTransaction(em, tournamentId, 'participant_leave', async (transactionalEm) => {
      const participant = await transactionalEm.findOne(Participant, { user: userId, tournament: tournamentId, retiredAt: null }, { populate: ['tournament'] });

      if (participant) owns(participant, actor);
      if (!participant) {
        throw new Error('participant not found for user and tournament');
      }

      const squads = await transactionalEm.find(ParticipantSquad, { participant: participant.id, releaseDate: null });
      for (const squad of squads) {
        for (const playerId of [...squad.startingRealPlayersIds, ...squad.substitutesRealPlayersIds].filter(id => id > 0)) await cancelPlayerOffers(transactionalEm, tournamentId, playerId);
        squad.releaseDate = new Date();
      }
      for (const offer of await transactionalEm.find(Negotiation, { $or: [{ sellerParticipant: participant.id }, { buyerParticipant: participant.id }], status: { $in: ['active', 'countered'] } }, { populate: ['buyerParticipant'] })) await cancelNegotiation(transactionalEm, offer);
      for (const bid of await transactionalEm.find(Bid, { participant: participant.id, status: 'active' })) {
        await changeMoney(transactionalEm, participant, 0, -Number(bid.offeredAmount), 'release', undefined, 'bid', String(bid.id)); bid.status = 'cancelled';
      }
      await transactionalEm.flush(); await reconcileOwnership(transactionalEm, participant.tournament, 'participant_leave'); await transactionalEm.flush();
      for (const market of await transactionalEm.find(MatchdayMarket, {
        tournament: tournamentId,
        sellerParticipant: participant.id,
      })) market.sellerParticipant = null;

      // Keep every historical relation. Released squads and refunded offers no longer participate.
      participant.retiredAt = new Date();
      await transactionalEm.flush();

      // Empty tournaments are retained with their closure and economic history.

      return {
        participantId: participant.id,
        tournamentDeleted: false,
      };
    });

}
