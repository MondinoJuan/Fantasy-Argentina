import { MatchdayStatus } from './domain-enums.types';
export interface matchdayI {
  id?: number;
  league: number;
  season: string;
  matchdayNumber: number;
  startDate: Date;
  endDate: Date;
  status: MatchdayStatus;
}
