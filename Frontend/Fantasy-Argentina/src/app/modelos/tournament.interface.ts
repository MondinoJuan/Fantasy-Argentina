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
  clauseEnableDate?: Date;
  allowSquadChangesDuringMatchday: boolean;
  allowClauseExecutionDuringMatchday: boolean;
}
