import { TournamentStatus } from './domain-enums.types';
export interface addTournamentI {
  name: string;
  league: number;
  sport: string;
  initialBudget: number;
  squadSize: number;
  status: TournamentStatus;
  publicCode?: string;
  clauseWaitDays?: number;
  creatorUserId?: number;
  sportId?: number;
  competitionId?: number;
}
