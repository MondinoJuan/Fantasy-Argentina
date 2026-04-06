import { MatchdayStatus } from './domain-enums.types';

export interface addMatchdayI {
  league: number;
  season: string;
  matchdayNumber: number;
  startDate: Date;
  endDate: Date;
  autoUpdateAt?: Date | null;
  nextPostponedCheckAt?: Date | null;
  status: MatchdayStatus;
}
