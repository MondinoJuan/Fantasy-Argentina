import { MatchdayStatus } from './domain-enums.types';
export interface matchdayI {
  id?: number;
  league: number;
  season: string;
  matchdayNumber: number;
  startDate: Date;
  endDate: Date;
  autoUpdateAt?: Date | null;
  nextPostponedCheckAt?: Date | null;
  status: MatchdayStatus;
}
