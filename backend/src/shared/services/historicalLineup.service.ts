import { EntityManager, FlushMode, LockMode } from '@mikro-orm/core';
import { MatchdayLineup } from '../../Entities/MatchdayLineup/matchdayLineup.entity.js';
import { SquadRevision } from '../../Entities/SquadRevision/squadRevision.entity.js';
import { ParticipantSquad } from '../../Entities/ParticipantSquad/participantSquad.entity.js';
import { Participant } from '../../Entities/Participant/participant.entity.js';
import { Matchday } from '../../Entities/Matchday/matchday.entity.js';
import { GameMatch } from '../../Entities/GameMatch/gameMatch.entity.js';
import { RealPlayer } from '../../Entities/RealPlayer/realPlayer.entity.js';
import { Tournament } from '../../Entities/Tournament/tournament.entity.js';
import { freezeState, selectRevision, snapshotState, LineupHistoryError, type Revision } from '../domain/lineup-history.js';
import { sourceKeyForSquad } from './squadHistory.subscriber.js';

async function ensureLegacyBaselines(em: EntityManager, participant: Participant): Promise<void> {
  const revisions = await em.find(SquadRevision, { participant }, { flushMode: FlushMode.COMMIT });
  const recordedSources = new Set(revisions.map((revision) => revision.sourceKey));
  const squads = await em.find(ParticipantSquad, { participant }, { flushMode: FlushMode.COMMIT });
  for (const squad of squads) {
    const sourceKey = sourceKeyForSquad(squad);
    if (recordedSources.has(sourceKey)) continue;
    const ids = [...(squad.startingRealPlayersIds ?? []), ...(squad.substitutesRealPlayersIds ?? [])];
    const players = ids.length ? await em.find(RealPlayer, { id: { $in: ids } }, { flushMode: FlushMode.COMMIT }) : [];
    em.create(SquadRevision, {
      participant, sourceKey, effectiveAt: new Date(), acquiredAt: squad.acquisitionDate,
      releasedAt: squad.releaseDate ?? null, deleted: false, legacyBaseline: true,
      createdAt: new Date(), updatedAt: new Date(),
      state: snapshotState(squad, Object.fromEntries(players.map((player) => [String(player.id), player.position]))),
    });
  }
  await em.flush();
}

/** Establish a reliable starting point before the first future kickoff, even with automation disabled. */
export async function initializeSquadHistory(em: EntityManager): Promise<void> {
  const participants = await em.find(Participant, {}, { orderBy: { id: 'asc' } });
  for (const participant of participants) {
    await em.transactional(async (tx) => {
      const managed = await tx.findOneOrFail(Participant, { id: participant.id }, { lockMode: LockMode.PESSIMISTIC_WRITE });
      await ensureLegacyBaselines(tx, managed);
    });
  }
}

/** Caller owns a transaction. A participant lock serializes concurrent snapshot creation. */
export async function frozenLineupFor(
  em: EntityManager, participant: Participant, matchday: Matchday, match: GameMatch | null = null,
): Promise<MatchdayLineup> {
  participant = await em.findOneOrFail(Participant, { id: participant.id }, { lockMode: LockMode.PESSIMISTIC_WRITE });
  const scopeKey = `${participant.id}:${matchday.id}:${match ? `match-${match.id}` : 'date'}`;
  const existing = await em.findOne(MatchdayLineup, { scopeKey });
  if (existing) return existing;
  const dateLineup = match ? await frozenLineupFor(em, participant, matchday) : null;
  if (dateLineup && !dateLineup.allowChangesDuringMatchday) return dateLineup;
  const tournament = await em.findOneOrFail(Tournament, { id: Number((participant.tournament as any)?.id ?? participant.tournament) });
  const allowChangesDuringMatchday = dateLineup?.allowChangesDuringMatchday ?? tournament.allowSquadChangesDuringMatchday;
  const cutoffAt = new Date(match?.startDateTime ?? matchday.startDate);
  if (!Number.isFinite(cutoffAt.getTime()) || cutoffAt.getTime() > Date.now()) {
    throw new LineupHistoryError('Cannot freeze a lineup before its date/match starts');
  }
  await ensureLegacyBaselines(em, participant);
  const revisions = await em.find(SquadRevision, { participant, effectiveAt: { $lt: cutoffAt } }, { orderBy: [{ effectiveAt: 'desc' }, { id: 'desc' }] });
  const revision = selectRevision(revisions as Revision[], cutoffAt) as SquadRevision | null;
  const joinedAfterCutoff = Math.max(new Date(participant.joinDate).getTime(), participant.playingSince ? new Date(participant.playingSince).getTime() : 0,
    tournament.initialDrawCompletedAt ? new Date(tournament.initialDrawCompletedAt).getTime() : 0) >= cutoffAt.getTime()
    || Boolean(participant.retiredAt && new Date(participant.retiredAt).getTime() <= cutoffAt.getTime());
  // Dynamic-date headers freeze the rule; actual scoring snapshots are taken at each kickoff.
  const policyHeader = !match && allowChangesDuringMatchday;
  if (!revision && !revisions.length && !joinedAfterCutoff && !policyHeader) {
    throw new LineupHistoryError(`Missing squad history for participant ${participant.id} before ${cutoffAt.toISOString()}; current squad cannot be used`);
  }
  const state = revision && !joinedAfterCutoff ? freezeState(revision.state) : {
    formation: '4-4-2', startingSlots: [], substitutesRealPlayersIds: [], captainRealPlayerId: null,
  };
  const lineup = em.create(MatchdayLineup, {
    participant, matchday, match, sourceRevision: joinedAfterCutoff ? null : revision,
    createdAt: new Date(), updatedAt: new Date(),
    scopeKey, cutoffAt, allowChangesDuringMatchday, ...state,
  });
  await em.flush();
  return lineup;
}

let capturing = false;
const reportedMissing = new Set<string>();

/** Eager snapshots at deadlines; revision lookup also recovers deadlines missed during downtime. */
export async function captureDueLineups(em: EntityManager, now = new Date()): Promise<void> {
  if (capturing) return;
  capturing = true;
  try {
    const matchdays = await em.find(Matchday, { startDate: { $lte: now }, status: { $nin: ['completed', 'cancelled'] } });
    for (const matchday of matchdays) {
      const participants = await em.find(Participant, { tournament: { league: matchday.league, initialDrawState: { $ne: 'waiting' } } });
      const matches = await em.find(GameMatch, { matchday, startDateTime: { $lte: now }, status: { $in: ['in_progress', 'finalizado'] } });
      for (const participant of participants) {
        try {
          await em.transactional(async (tx) => {
            const date = await frozenLineupFor(tx, participant, matchday);
            if (date.allowChangesDuringMatchday) {
              for (const match of matches) await frozenLineupFor(tx, participant, matchday, match);
            }
          });
        } catch (error) {
          if (!(error instanceof LineupHistoryError)) throw error;
          if (!reportedMissing.has(error.message)) console.warn('[lineup-history]', error.message);
          reportedMissing.add(error.message);
        }
      }
    }
  } finally { capturing = false; }
}
