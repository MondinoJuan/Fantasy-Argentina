import { changeMoney, reconcileOwnership, cancelPlayerOffers, verifyReservations } from '../shared/services/gameEconomy.service.js';
import { ownedIds, receivePlayer, removePlayer } from '../shared/domain/game-rules.js';
import { PlayerClause } from '../Entities/PlayerClause/playerClause.entity.js';
import { EntityManager, LockMode } from '@mikro-orm/core';
import { League } from '../Entities/League/league.entity.js';
import { Matchday } from '../Entities/Matchday/matchday.entity.js';
import { Tournament } from '../Entities/Tournament/tournament.entity.js';
import { Participant } from '../Entities/Participant/participant.entity.js';
import { ParticipantSquad } from '../Entities/ParticipantSquad/participantSquad.entity.js';
import { MatchdayMarket } from '../Entities/MatchdayMarket/matchdayMarket.entity.js';
import { Bid } from '../Entities/Bid/bid.entity.js';
import { DependantPlayer } from '../Entities/DependantPlayer/dependantPlayer.entity.js';
import { RealPlayer } from '../Entities/RealPlayer/realPlayer.entity.js';
import { ParticipantMatchdayPoints } from '../Entities/ParticipantMatchdayPoints/participantMatchdayPoints.entity.js';
import { getTeamIdsByLeague } from '../Entities/RealTeamLeagueParticipation/realTeamLeagueParticipation.service.js';
import { recalculateMatchdayPoints } from '../Entities/Tournament/services/matchdayPoints.service.js';
import { compareBids, dateRewards, randomSelection } from './closure-policy.js';

const idOf = (value: any): number => Number(value?.id ?? value);
const squadIds = (squad: ParticipantSquad) => [...squad.startingRealPlayersIds, ...squad.substitutesRealPlayersIds];

/** Caller fetched all ratings first. Every economic effect and the completion marker commit together. */
export async function commitLeagueClosure(em: EntityManager, matchdayId: number) {
  return em.transactional(async tx => {
    const date = await tx.findOneOrFail(Matchday, { id: matchdayId }, { populate: ['league'] });
    const league = await tx.findOneOrFail(League, { id: idOf(date.league) }, { lockMode: LockMode.PESSIMISTIC_WRITE });
    await tx.refresh(date, { lockMode: LockMode.PESSIMISTIC_WRITE });
    if (date.closureCompletedAt) return { alreadyCompleted: true, ...date.closureSummary };

    const tournaments = await tx.find(Tournament, { league, initialDrawState: { $ne: 'waiting' } }, { orderBy: { id: 'asc' } });
    const participants = await tx.find(Participant, { tournament: { league, initialDrawState: { $ne: 'waiting' } }, retiredAt: null }, {
      populate: ['tournament'], orderBy: { id: 'asc' }, lockMode: LockMode.PESSIMISTIC_WRITE,
    });
    const squads = await tx.find(ParticipantSquad, { participant: { tournament: { league, initialDrawState: { $ne: 'waiting' } } }, releaseDate: null }, {
      orderBy: [{ acquisitionDate: 'desc' }, { id: 'desc' }],
    });
    const latestSquad = new Map<number, ParticipantSquad>();
    for (const squad of squads) if (!latestSquad.has(idOf(squad.participant))) latestSquad.set(idOf(squad.participant), squad);
    const summary = { tournaments: tournaments.length, processedBids: 0, awardedPlayers: 0,
      createdMarketPlayers: 0, rewardedParticipants: 0, distributedReward: 0, nextMatchdayId: null as number | null };
    const now = new Date();

    for (const tournament of tournaments) await reconcileOwnership(tx, tournament, 'baseline');

    // 2. Settle only open markets for this round (older leftover markets are also drained).
    const markets = await tx.find(MatchdayMarket, { closedAt: null, tournament: { league, initialDrawState: { $ne: 'waiting' } }, matchday: {
      league, season: date.season, matchdayNumber: { $lte: date.matchdayNumber },
    } }, { populate: ['tournament', 'sellerParticipant'] });
    const bids = markets.length ? await tx.find(Bid, { matchdayMarket: { $in: markets.map(m => m.id!) }, status: 'active' }, {
      populate: ['participant', 'realPlayer', 'matchdayMarket'], lockMode: LockMode.PESSIMISTIC_WRITE,
    }) : [];
    for (const bid of bids) {
      const market = markets.find(m => m.id === idOf(bid.matchdayMarket));
      if (!market || idOf(bid.tournament) !== idOf(market.tournament) || idOf(bid.participant.tournament) !== idOf(market.tournament)) throw new Error(`Bid ${bid.id} has inconsistent tournament/participant/market`);
    }
    const processed = new Set<number>();
    for (const market of markets) {
      const dependants = market.dependantPlayerIds.length ? await tx.find(DependantPlayer, {
        id: { $in: market.dependantPlayerIds }, tournament: market.tournament,
      }, { populate: ['realPlayer'] }) : [];
      for (const dependant of dependants) {
        const playerId = idOf(dependant.realPlayer);
        const offers = bids.filter(b => idOf(b.matchdayMarket) === market.id && idOf(b.realPlayer) === playerId && !processed.has(b.id!)).sort(compareBids);
        const owner = participants.find(p => idOf(p.tournament) === idOf(market.tournament) && latestSquad.has(p.id!) && squadIds(latestSquad.get(p.id!)!).includes(playerId));
        const winner = offers.find(b => {
          const squad = latestSquad.get(idOf(b.participant));
          return Number(b.offeredAmount) > 0 && !!squad && ownedIds(squad).length < 16 && squad.substitutesRealPlayersIds.length < 5
            && (!owner || (idOf(market.sellerParticipant) === owner.id && owner.id !== idOf(b.participant)))
            && Number(b.participant.bankBudget) >= Number(b.offeredAmount);
        });
        for (const bid of offers) {
          const p = bid.participant;
          const amount = Number(bid.offeredAmount);
          if (!Number.isFinite(amount) || amount < 0 || Number(p.reservedMoney) < amount) throw new Error(`Invalid bid reserve ${bid.id}`);
          if (bid === winner) {
            await changeMoney(tx, p, -amount, -amount, 'bid_purchase', `bid:${bid.id}:purchase`, 'bid', String(bid.id));
            const squad = latestSquad.get(p.id!)!;
            receivePlayer(squad, playerId);
            if (owner) {
              const sellerSquad = latestSquad.get(owner.id!)!;
              removePlayer(sellerSquad, playerId);
              await changeMoney(tx, owner, amount, 0, 'bid_purchase', `bid:${bid.id}:seller`, 'bid', String(bid.id));
            }
            bid.status = 'won';
            const clause = await tx.findOne(PlayerClause, { tournament: market.tournament, dependantPlayer: dependant });
            if (clause) { clause.ownerParticipant = p; clause.updateDate = now; }
            summary.awardedPlayers++;
          } else {
            await changeMoney(tx, p, 0, -amount, 'release', `bid:${bid.id}:lost`, 'bid', String(bid.id));
            bid.status = 'lost'; bid.cancellationDate = now;
          }
          summary.processedBids++; processed.add(bid.id!);
        }
      }
    }
    // Unmatched stale offers must never leave money reserved forever.
    for (const bid of bids) if (!processed.has(bid.id!)) {
      const amount = Number(bid.offeredAmount);
      if (!Number.isFinite(amount) || amount < 0 || Number(bid.participant.reservedMoney) < amount) throw new Error(`Invalid bid reserve ${bid.id}`);
      await changeMoney(tx, bid.participant, 0, -amount, 'release', `bid:${bid.id}:stale`, 'bid', String(bid.id));
      bid.status = 'lost'; bid.cancellationDate = now; summary.processedBids++;
    }
    for (const bid of bids) if (bid.status === 'won') await cancelPlayerOffers(tx, idOf(bid.tournament), idOf(bid.realPlayer));
    await tx.flush();

    // 3. Score the historical lineups, never the squads changed by the purchases above.
    await recalculateMatchdayPoints(tx, league, date);

    // Archive rather than delete: won/lost bids and their ledger references remain auditable.
    for (const market of markets) market.closedAt = now;
    for (const tournament of tournaments) await reconcileOwnership(tx, tournament, `closure:${date.id}`);
    await tx.flush();

    // 4. Next actual fixture round; do not invent matchdays if the season has finished.
    const laterClosed = await tx.findOne(Matchday, { league, season: date.season, matchdayNumber: { $gt: date.matchdayNumber }, closureCompletedAt: { $ne: null } });
    const next = laterClosed ? null : await tx.findOne(Matchday, { league, season: date.season,
      matchdayNumber: { $gt: date.matchdayNumber }, closureCompletedAt: null, status: { $ne: 'cancelled' },
    }, { orderBy: { matchdayNumber: 'asc' } });
    summary.nextMatchdayId = next?.id ?? null;
    if (next) {
      const teamIds = await getTeamIdsByLeague(tx as any, league.id!);
      for (const tournament of tournaments) {
        const members = participants.filter(p => idOf(p.tournament) === tournament.id);
        const occupied = new Set(members.flatMap(p => latestSquad.has(p.id!) ? squadIds(latestSquad.get(p.id!)!) : []));
        const otherMarkets = await tx.find(MatchdayMarket, { tournament, closedAt: null }, { populate: [] });
        const otherIds = otherMarkets.flatMap(m => m.dependantPlayerIds);
        if (otherIds.length) for (const d of await tx.find(DependantPlayer, { id: { $in: otherIds } })) occupied.add(idOf(d.realPlayer));
        const count = members.length * 3;
        const candidates = count && teamIds.length ? await tx.find(RealPlayer, { active: true,
          realTeam: { $in: teamIds }, ...(occupied.size ? { id: { $nin: [...occupied] } } : {}),
        }) : [];
        if (candidates.length < count) throw new Error(`Not enough free players for tournament ${tournament.id}: need ${count}, found ${candidates.length}`);
        const selected: DependantPlayer[] = [];
        for (const player of randomSelection(candidates, count)) {
          let d = await tx.findOne(DependantPlayer, { tournament, realPlayer: player });
          if (!d) d = tx.create(DependantPlayer, { tournament, realPlayer: player, marketValue: 0, marketAppearances: 0, createdAt: now, updatedAt: now });
          d.marketAppearances = Number(d.marketAppearances) + 1; selected.push(d);
        }
        await tx.flush();
        if (selected.length) tx.create(MatchdayMarket, { tournament, matchday: next, dependantPlayerIds: selected.map(d => d.id!),
          minimumPrice: 100, origin: 'system_matchday_refresh', creationDate: now, createdAt: now, updatedAt: now });
        summary.createdMarketPlayers += selected.length;
      }
    }
    await tx.flush();

    // 5. Award once from this date's standings. Postponed corrections do not repay prizes.
    const points = await tx.find(ParticipantMatchdayPoints, { matchday: date });
    const byParticipant = new Map(points.map(p => [idOf(p.participant), Number(p.matchdayPoints)]));
    for (const tournament of tournaments) {
      const members = participants.filter(p => idOf(p.tournament) === tournament.id);
      const byId = new Map(members.map(p => [p.id!, p]));
      for (const reward of dateRewards(members.map(p => ({ id: p.id!, points: byParticipant.get(p.id!) ?? 0 })))) {
        const participant = byId.get(reward.id)!;
        await changeMoney(tx, participant, reward.amount, 0, 'matchday_reward', `reward:${tournament.id}:${date.id}:${participant.id}`, 'matchday', String(date.id));
        summary.rewardedParticipants++; summary.distributedReward += reward.amount;
      }
    }
    for (const tournament of tournaments) await verifyReservations(tx, tournament);
    date.closureCompletedAt = now; date.status = 'completed'; date.autoUpdateAt = null;
    date.closureSummary = summary;
    await tx.flush();
    return { alreadyCompleted: false, ...summary };
  });
}
