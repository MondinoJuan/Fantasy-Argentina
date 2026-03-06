export interface addTournamentI {
  name: string;
  league: number;
  sport: string;
  creationDate: Date;
  initialBudget: number;
  squadSize: number;
  status: string;
  publicCode?: string;
  clauseEnableDate?: Date;
  creatorUserId?: number;
  sportId?: number;
  competitionId?: number;
}
