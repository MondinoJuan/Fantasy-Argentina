import { MatchdayStatus } from './domain-enums.types';
export interface matchdayPatchI {
  id: number;
  league?: number;
  season?: string;
  matchdayNumber?: number;
  startDate?: Date;
  endDate?: Date;
  status?: MatchdayStatus;
}
