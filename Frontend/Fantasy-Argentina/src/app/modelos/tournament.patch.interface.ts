import { TournamentStatus } from './domain-enums.types';
export interface tournamentPatchI {
  id: number;
  name?: string;
  league?: number;
  sport?: string;
  creationDate?: Date;
  initialBudget?: number;
  squadSize?: number;
  limiteMin?: number;
  limiteMax?: number;
  status?: TournamentStatus;
  clauseEnableDate?: Date;
}
