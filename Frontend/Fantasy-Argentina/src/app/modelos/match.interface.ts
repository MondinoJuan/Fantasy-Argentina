import { MatchStatus } from './domain-enums.types';
export interface matchI {
  id?: number;
  matchday: number;
  externalApiId: string;
  homeTeam: string;
  awayTeam: string;
  startDateTime: Date;
  status: MatchStatus;
}
