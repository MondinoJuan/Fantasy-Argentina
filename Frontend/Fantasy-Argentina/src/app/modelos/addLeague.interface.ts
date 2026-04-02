export interface addLeagueI {
  name: string;
  country: string;
  sport: string;
  idEnApi: number;
  kncokoutStage?: boolean;
  competitionFormat?: 'league_only' | 'knockout_only' | 'mixed';
  hasGroups?: boolean;
  hasTwoLegKnockout?: boolean;
  limiteMin?: number | null;
  limiteMax?: number | null;
}
