import { TournamentStatus } from './domain-enums.types';
export interface addTournamentI {
  name: string;
  league: number;
  sport: string;
  creationDate: Date;
  initialBudget: number;
  squadSize: number;
  status: TournamentStatus;
  publicCode?: string;
  clauseEnableDate?: Date;
  clauseWaitDays?: number;
  creatorUserId?: number;
  sportId?: number;
  competitionId?: number;
}
