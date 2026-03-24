import { MatchStatus } from './domain-enums.types';
export interface gameMatchI {
  id?: number;
  matchday: number;
  league: number;
  externalApiId: string;
  homeTeam: string;
  awayTeam: string;
  startDateTime: Date;
  status: MatchStatus;
}
