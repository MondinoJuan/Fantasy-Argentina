export interface addGameMatchI {
  matchday: number;
  league: number;
  externalApiId: string;
  homeTeam: string;
  awayTeam: string;
  startDateTime: Date;
  status: string;
}
