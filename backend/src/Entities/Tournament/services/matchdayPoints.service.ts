import { EntityManager } from '@mikro-orm/core';
import { League } from '../../League/league.entity.js';
import { Matchday } from '../../Matchday/matchday.entity.js';
import { Participant } from '../../Participant/participant.entity.js';
import { PlayerPerformance } from '../../PlayerPerformance/playerPerformance.entity.js';
import { PlayerPointsBreakdown } from '../../PlayerPointsBreakdown/playerPointsBreakdown.entity.js';
import { ParticipantMatchdayPoints } from '../../ParticipantMatchdayPoints/participantMatchdayPoints.entity.js';
import { MatchdayLineup } from '../../MatchdayLineup/matchdayLineup.entity.js';
import { frozenLineupFor } from '../../../shared/services/historicalLineup.service.js';
import { scoreHistoricalLineups, type FrozenLineup, type PerformanceInput } from '../../../shared/domain/lineup-history.js';

const idOf = (value: any): number => Number(value?.id ?? value);
const frozen = (lineup: MatchdayLineup): FrozenLineup => ({
  ...lineup, captainRealPlayerId: lineup.captainRealPlayerId ?? null,
});

/** Rebuild the whole date from frozen lineups, also when a single postponed match is corrected. */
export async function recalculateMatchdayPoints(em: EntityManager, league: League, matchday: Matchday) {
  const participants = (await em.find(Participant, { tournament: { league, initialDrawState: { $ne: 'waiting' } } }, { orderBy: { id: 'asc' } }))
    .filter(p => !p.retiredAt || new Date(p.retiredAt).getTime() > new Date(matchday.startDate).getTime());
  const participantIds = participants.map((participant) => participant.id!);
  if (!participantIds.length) return { processedParticipants: 0, upsertedBreakdowns: 0 };
  const performances = await em.find(PlayerPerformance, { matchday, league }, { populate: ['realPlayer', 'match'] });
  const inputs: PerformanceInput[] = performances.map((performance) => ({
    id: performance.id!, realPlayerId: idOf(performance.realPlayer), matchId: performance.match ? idOf(performance.match) : null,
    kickoffAt: new Date(performance.match?.startDateTime ?? matchday.startDate), points: Number(performance.pointsObtained),
  }));
  const performanceById = new Map(performances.map((performance) => [performance.id!, performance]));
  const existing = await em.find(PlayerPointsBreakdown, { participant: { $in: participantIds }, matchday });
  const existingByKey = new Map(existing.map((row) => [`${idOf(row.participant)}:${idOf(row.realPlayer)}`, row]));
  const touched = new Set<string>();
  const datePoints = new Map<number, number>();
  let upsertedBreakdowns = 0;

  // Resolve every historical state before changing any previously published contribution.
  const scores = new Map<number, ReturnType<typeof scoreHistoricalLineups>>();
  for (const participant of participants) {
    const dateLineup = await frozenLineupFor(em, participant, matchday);
    const matchLineups = new Map<number, FrozenLineup>();
    if (dateLineup.allowChangesDuringMatchday) {
      for (const performance of performances) {
        if (performance.match && !matchLineups.has(performance.match.id!)) {
          const lineup = await frozenLineupFor(em, participant, matchday, performance.match);
          matchLineups.set(performance.match.id!, frozen(lineup));
        }
      }
    }
    scores.set(participant.id!, scoreHistoricalLineups(frozen(dateLineup), matchLineups, inputs));
  }
  for (const participant of participants) {
    let total = 0;
    for (const [realPlayerId, score] of scores.get(participant.id!)!) {
      const key = `${participant.id}:${realPlayerId}`;
      let row = existingByKey.get(key);
      const performance = performanceById.get(score.contributions[0].performanceId)!;
      if (!row) row = em.create(PlayerPointsBreakdown, { participant, matchday, realPlayer: realPlayerId,
        createdAt: new Date(), updatedAt: new Date(),
        contributedPoints: score.points, playerPerformance: performance, performanceContributions: score.contributions });
      else {
        row.contributedPoints = score.points;
        row.playerPerformance = performance;
        row.performanceContributions = score.contributions;
      }
      touched.add(key);
      total += score.points;
      upsertedBreakdowns++;
    }
    datePoints.set(participant.id!, Math.round(total * 1000) / 1000);
  }
  for (const [key, row] of existingByKey) if (!touched.has(key)) em.remove(row);

  const priorTotals = await em.find(ParticipantMatchdayPoints, { participant: { $in: participantIds }, matchday });
  const totalsByParticipant = new Map(priorTotals.map((row) => [idOf(row.participant), row]));
  for (const participant of participants) {
    let row = totalsByParticipant.get(participant.id!);
    if (!row) row = em.create(ParticipantMatchdayPoints, { participant, matchday,
      createdAt: new Date(), updatedAt: new Date(),
      matchdayPoints: datePoints.get(participant.id!) ?? 0, calculationDate: new Date() });
    else { row.matchdayPoints = datePoints.get(participant.id!) ?? 0; row.calculationDate = new Date(); }
  }
  await em.flush();
  const allPoints = await em.find(ParticipantMatchdayPoints, { participant: { $in: participantIds } });
  const allByParticipant = new Map<number, number>();
  for (const row of allPoints) allByParticipant.set(idOf(row.participant), (allByParticipant.get(idOf(row.participant)) ?? 0) + Number(row.matchdayPoints));
  for (const participant of participants) participant.totalScore = Math.round((allByParticipant.get(participant.id!) ?? 0) * 1000) / 1000;
  await em.flush();
  return { processedParticipants: participants.length, upsertedBreakdowns };
}
