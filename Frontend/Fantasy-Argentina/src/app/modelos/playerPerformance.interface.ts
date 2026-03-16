export interface playerPerformanceI {
  id?: number;
  realPlayer: number;
  matchday: number;
  league: number;
  match?: number | null;
  pointsObtained: number;
  updateDate: Date;
}
