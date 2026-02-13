export interface participantMatchdayPointsPatchI {
  id: number;
  participant?: number;
  matchday?: number;
  matchdayPoints?: number;
  accumulatedPoints?: number;
  position?: number;
  calculationDate?: Date;
}
