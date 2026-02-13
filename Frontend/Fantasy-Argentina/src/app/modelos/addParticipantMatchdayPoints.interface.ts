export interface addParticipantMatchdayPointsI {
  participant: number;
  matchday: number;
  matchdayPoints: number;
  accumulatedPoints?: number;
  position?: number;
  calculationDate: Date;
}
