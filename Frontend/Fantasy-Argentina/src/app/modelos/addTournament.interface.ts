import { TournamentStatus } from './domain-enums.types';
export interface addTournamentI {
  name: string;
  league: number;
  sport: string;
  creationDate: Date;
  initialBudget: number;
  squadSize: number;
  limiteMin: number;
  limiteMax: number;
  status: TournamentStatus;
  publicCode?: string;
  clauseEnableDate?: Date;
  creatorUserId?: number;
  sportId?: number;
  competitionId?: number;
}
