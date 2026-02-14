export interface addTournamentI {
  name: string;
  league: number;
  sport: string;
  creationDate: Date;
  initialBudget: number;
  squadSize: number;
  status: string;
  clauseEnableDate?: Date;
  creatorUserId?: number;
}
