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
  allowSquadChangesDuringMatchday?: boolean;
  allowClauseExecutionDuringMatchday?: boolean;
  sportId?: number;
  competitionId?: number;
}
