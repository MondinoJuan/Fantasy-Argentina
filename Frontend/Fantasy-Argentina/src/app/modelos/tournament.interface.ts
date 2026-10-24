import { TournamentStatus } from './domain-enums.types';
import { leagueI } from './league.interface';

export interface tournamentI {
  id?: number;
  name: string;
  league: number | leagueI;
  sport: string;
  creationDate: Date;
  initialBudget: number;
  squadSize: number;
  status: TournamentStatus;
  publicCode?: string;
  creatorUserId?: number | null;
  initialDrawState?: 'waiting' | 'completed' | 'legacy';
  initialDrawCompletedAt?: Date | null;
  clauseEnableDate?: Date;
  allowSquadChangesDuringMatchday: boolean;
  allowClauseExecutionDuringMatchday: boolean;
}
