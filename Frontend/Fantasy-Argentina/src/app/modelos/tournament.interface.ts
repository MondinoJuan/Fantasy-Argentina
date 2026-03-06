import { leagueI } from './league.interface';

export interface tournamentI {
  id?: number;
  name: string;
  league: number | leagueI;
  sport: string;
  creationDate: Date;
  initialBudget: number;
  squadSize: number;
  status: string;
  publicCode?: string;
  clauseEnableDate?: Date;
}
