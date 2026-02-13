export interface participantMatchdayPointsI {
  id?: number;
  participant: number;
  matchday: number;
  matchdayPoints: number;
  accumulatedPoints?: number;
  position?: number;
  calculationDate: Date;
}
