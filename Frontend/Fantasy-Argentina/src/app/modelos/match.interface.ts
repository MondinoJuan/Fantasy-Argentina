export interface matchI {
  id?: number;
  matchday: number;
  externalApiId: string;
  homeTeam: string;
  awayTeam: string;
  startDateTime: Date;
  status: string;
}
