export interface tournamentI {
  id?: number;
  name: string;
  league: number;
  creationDate: Date;
  initialBudget: number;
  squadSize: number;
  status: string;
  clauseEnableDate?: Date;
}
