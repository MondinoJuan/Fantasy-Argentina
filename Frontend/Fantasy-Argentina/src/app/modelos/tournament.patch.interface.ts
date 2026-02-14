export interface tournamentPatchI {
  id: number;
  name?: string;
  league?: number;
  sport?: string;
  creationDate?: Date;
  initialBudget?: number;
  squadSize?: number;
  status?: string;
  clauseEnableDate?: Date;
}
