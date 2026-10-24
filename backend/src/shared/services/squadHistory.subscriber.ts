import { ChangeSetType, FlushMode, type EventSubscriber, type FlushEventArgs } from '@mikro-orm/core';
import { ParticipantSquad } from '../../Entities/ParticipantSquad/participantSquad.entity.js';
import { Participant } from '../../Entities/Participant/participant.entity.js';
import { RealPlayer } from '../../Entities/RealPlayer/realPlayer.entity.js';
import { SquadRevision } from '../../Entities/SquadRevision/squadRevision.entity.js';
import { MatchdayLineup } from '../../Entities/MatchdayLineup/matchdayLineup.entity.js';
import { LineupHistoryError, snapshotState, type Position } from '../domain/lineup-history.js';

export function sourceKeyForSquad(squad: { historySourceKey: string }): string {
  if (!squad.historySourceKey) throw new LineupHistoryError('Squad history migration has not been applied');
  return squad.historySourceKey;
}

/** onFlush also sees market/negotiation/clause transfers, not just HTTP lineup saves. */
export class SquadHistorySubscriber implements EventSubscriber {
  async onFlush({ em, uow }: FlushEventArgs): Promise<void> {
    const changes = [...uow.getChangeSets()];
    for (const change of changes) {
      if ((change.entity instanceof SquadRevision || change.entity instanceof MatchdayLineup)
        && change.type !== ChangeSetType.CREATE) {
        throw new LineupHistoryError('Historical lineup records are immutable');
      }
    }
    const squadChanges: Array<{ entity: ParticipantSquad; type: ChangeSetType; originalEntity?: any }> = changes
      .filter((change) => change.entity instanceof ParticipantSquad)
      .map((change) => ({ entity: change.entity as ParticipantSquad, type: change.type, originalEntity: change.originalEntity }));
    const positionChanges = changes.filter((change) => change.entity instanceof RealPlayer
      && change.type === ChangeSetType.UPDATE && change.payload.position !== undefined);
    const changedPositions = new Set(positionChanges.map((change) => change.entity.id));
    const positionOverrides = Object.fromEntries(positionChanges.map((change) => [String(change.entity.id), change.payload.position as Position]));
    if (changedPositions.size) {
      // A position correction before kickoff must affect future lineups, without rewriting past ones.
      const activeSquads = await em.find(ParticipantSquad, { releaseDate: null }, { flushMode: FlushMode.COMMIT });
      const alreadyRecorded = new Set(squadChanges.map((change) => change.entity));
      for (const squad of activeSquads) {
        if (!alreadyRecorded.has(squad) && [...squad.startingRealPlayersIds, ...squad.substitutesRealPlayersIds].some((id) => changedPositions.has(id))) {
          squadChanges.push({ entity: squad, type: ChangeSetType.UPDATE, originalEntity: uow.getOriginalEntityData(squad) });
        }
      }
    }
    if (!squadChanges.length) return;
    const playerIds = new Set<number>();
    for (const change of squadChanges) {
      for (const raw of [change.entity, change.type === ChangeSetType.CREATE ? undefined : change.originalEntity ?? uow.getOriginalEntityData(change.entity)]) {
        if (!raw) continue;
        const state = snapshotState(raw, {});
        for (const id of [...state.startingRealPlayersIds, ...state.substitutesRealPlayersIds]) {
          if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) playerIds.add(id);
        }
      }
    }
    const players = playerIds.size ? await em.find(RealPlayer, { id: { $in: [...playerIds] } }, { flushMode: FlushMode.COMMIT }) : [];
    const positions: Record<string, Position> = { ...Object.fromEntries(players.map((player) => [String(player.id), player.position])), ...positionOverrides };
    const now = new Date();
    for (const change of squadChanges) {
      const squad = change.entity as ParticipantSquad;
      const original = (change.type === ChangeSetType.CREATE ? undefined : change.originalEntity ?? uow.getOriginalEntityData(squad)) as any;
      const participant = squad.participant;
      const sourceKey = sourceKeyForSquad(squad);
      const addRevision = (input: Record<string, unknown>) => {
        const revision = em.create(SquadRevision, input as any);
        uow.computeChangeSet(revision);
      };
      if (original) {
        const originalParticipantId = Number(original.participant?.id ?? original.participant);
        const originalKey = sourceKeyForSquad(original);
        const recorded = await em.findOne(SquadRevision, { participant: originalParticipantId, sourceKey: originalKey }, { flushMode: FlushMode.COMMIT });
        if (!recorded) {
          // Player positions were not historically recorded. Never backdate this first observation.
          const effectiveAt = now;
          addRevision({ participant: em.getReference(Participant, originalParticipantId), sourceKey: originalKey,
            effectiveAt, acquiredAt: new Date(original.acquisitionDate), releasedAt: original.releaseDate ?? null,
            deleted: false, legacyBaseline: true, state: snapshotState(original, positions) });
        }
        if (originalParticipantId !== participant.id || originalKey !== sourceKey) {
          addRevision({ participant: em.getReference(Participant, originalParticipantId), sourceKey: originalKey,
            effectiveAt: now, acquiredAt: new Date(original.acquisitionDate), releasedAt: now,
            deleted: true, state: snapshotState(original, positions) });
        }
      }
      addRevision({ participant, sourceKey, effectiveAt: now, acquiredAt: squad.acquisitionDate,
        releasedAt: squad.releaseDate ?? null, deleted: change.type === ChangeSetType.DELETE || change.type === ChangeSetType.DELETE_EARLY,
        state: snapshotState(squad, positions) });
    }
  }
}
