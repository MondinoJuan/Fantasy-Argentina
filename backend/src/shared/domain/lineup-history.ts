export type Position = 'goalkeeper' | 'defender' | 'midfielder' | 'forward';
export interface SquadState {
  formation: string;
  startingRealPlayersIds: Array<number | null>;
  substitutesRealPlayersIds: number[];
  captainRealPlayerId: number | null;
  playerPositions: Record<string, Position>;
}
export interface Revision {
  id?: number;
  sourceKey: string;
  effectiveAt: Date;
  acquiredAt: Date;
  releasedAt?: Date | null;
  deleted: boolean;
  state: SquadState;
}
export interface FrozenSlot {
  index: number;
  expectedPosition: Position;
  realPlayerId: number | null;
  actualPosition: Position | null;
}
export interface FrozenLineup {
  id?: number;
  scopeKey: string;
  cutoffAt: Date;
  formation: string;
  startingSlots: FrozenSlot[];
  substitutesRealPlayersIds: number[];
  captainRealPlayerId: number | null;
  allowChangesDuringMatchday: boolean;
}
export interface PerformanceInput {
  id: number;
  realPlayerId: number;
  matchId: number | null;
  kickoffAt: Date;
  points: number;
}
export interface PerformanceContribution {
  performanceId: number;
  matchId: number | null;
  lineupId: number;
  scopeKey: string;
  rawPoints: number;
  positionPenalty: number;
  captainMultiplier: number;
  points: number;
}
export class LineupHistoryError extends Error {
  constructor(message: string) { super(message); this.name = 'LineupHistoryError'; }
}
export function expectedPositions(formation: string): Position[] {
  const allowed = ['4-4-2', '4-3-3', '3-4-3', '5-4-1'];
  if (!allowed.includes(formation)) throw new LineupHistoryError(`Unknown formation: ${formation}`);
  const [defenders, midfielders, forwards] = formation.split('-').map(Number);
  // Same order as the pitch: forwards first, goalkeeper last. Empty slots retain their index.
  return [...Array<Position>(forwards).fill('forward'), ...Array<Position>(midfielders).fill('midfielder'),
    ...Array<Position>(defenders).fill('defender'), 'goalkeeper'];
}
export function snapshotState(squad: any, playerPositions: Record<string, Position>): SquadState {
  // MikroORM's original entity data serializes JSON columns during dirty checking.
  const ids = (value: any): any[] => {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? [...parsed] : [];
  };
  const state: SquadState = {
    formation: squad.formation,
    startingRealPlayersIds: ids(squad.startingRealPlayersIds).map(id => id === 0 ? null : id),
    substitutesRealPlayersIds: ids(squad.substitutesRealPlayersIds),
    captainRealPlayerId: squad.captainRealPlayerId ?? null,
    playerPositions: { ...playerPositions },
  };
  expectedPositions(state.formation);
  return state;
}
export function selectRevision(revisions: Revision[], cutoffAt: Date): Revision | null {
  const latestBySource = new Map<string, Revision>();
  for (const revision of revisions) {
    // A save at/after kickoff belongs to the next eligible match/date.
    if (revision.effectiveAt.getTime() >= cutoffAt.getTime()) continue;
    const previous = latestBySource.get(revision.sourceKey);
    if (!previous || revision.effectiveAt > previous.effectiveAt
      || (revision.effectiveAt.getTime() === previous.effectiveAt.getTime() && (revision.id ?? 0) > (previous.id ?? 0))) {
      latestBySource.set(revision.sourceKey, revision);
    }
  }
  const known = [...latestBySource.values()].filter((revision) => !revision.deleted);
  const active = known.filter((revision) => !revision.releasedAt || revision.releasedAt.getTime() >= cutoffAt.getTime());
  return active.sort((a, b) => b.acquiredAt.getTime() - a.acquiredAt.getTime()
    || (b.id ?? 0) - (a.id ?? 0))[0] ?? null;
}
export function freezeState(state: SquadState): Pick<FrozenLineup, 'formation' | 'startingSlots' | 'substitutesRealPlayersIds' | 'captainRealPlayerId'> {
  const positions = expectedPositions(state.formation);
  const ids = [...state.startingRealPlayersIds, ...state.substitutesRealPlayersIds].filter((id): id is number => id !== null);
  if (state.startingRealPlayersIds.length > positions.length || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)
    || new Set(ids).size !== ids.length) throw new LineupHistoryError('Invalid historical squad');
  const startingSlots = positions.map((expectedPosition, index) => {
    const realPlayerId = state.startingRealPlayersIds[index] ?? null;
    return { index, expectedPosition, realPlayerId, actualPosition: realPlayerId ? state.playerPositions[realPlayerId] ?? null : null };
  });
  return {
    formation: state.formation, startingSlots,
    substitutesRealPlayersIds: [...state.substitutesRealPlayersIds],
    captainRealPlayerId: startingSlots.some((slot) => slot.realPlayerId === state.captainRealPlayerId) ? state.captainRealPlayerId : null,
  };
}
export function scoreHistoricalLineups(
  dateLineup: FrozenLineup, matchLineups: Map<number, FrozenLineup>, performances: PerformanceInput[],
): Map<number, { points: number; contributions: PerformanceContribution[] }> {
  const result = new Map<number, { points: number; contributions: PerformanceContribution[] }>();
  const penalizedPlayers = new Set<number>();
  const processed = new Set<number>();
  for (const performance of [...performances].sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime() || a.id - b.id)) {
    if (processed.has(performance.id)) continue;
    processed.add(performance.id);
    const lineup = dateLineup.allowChangesDuringMatchday
      ? performance.matchId === null ? null : matchLineups.get(performance.matchId)
      : dateLineup;
    if (!lineup) throw new LineupHistoryError(`No frozen lineup for performance ${performance.id}`);
    const slot = lineup.startingSlots.find((entry) => entry.realPlayerId === performance.realPlayerId);
    if (!slot) continue;
    if (!slot.actualPosition || !Number.isFinite(performance.points) || !lineup.id) {
      throw new LineupHistoryError(`Incomplete historical data for performance ${performance.id}`);
    }
    const positionPenalty = slot.actualPosition !== slot.expectedPosition && !penalizedPlayers.has(performance.realPlayerId) ? 3 : 0;
    if (positionPenalty) penalizedPlayers.add(performance.realPlayerId);
    const captainMultiplier = lineup.captainRealPlayerId === performance.realPlayerId ? 2 : 1;
    const points = Math.round((performance.points - positionPenalty) * captainMultiplier * 1000) / 1000;
    const row = result.get(performance.realPlayerId) ?? { points: 0, contributions: [] };
    row.points = Math.round((row.points + points) * 1000) / 1000;
    row.contributions.push({ performanceId: performance.id, matchId: performance.matchId, lineupId: lineup.id,
      scopeKey: lineup.scopeKey, rawPoints: performance.points, positionPenalty, captainMultiplier, points });
    result.set(performance.realPlayerId, row);
  }
  return result;
}
