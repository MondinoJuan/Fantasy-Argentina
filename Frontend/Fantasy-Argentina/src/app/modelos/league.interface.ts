export interface leagueI {
  id?: number;
  name: string;
  country: string;
  sport: string;
  idEnApi: number;
  kncokoutStage?: boolean;
  limiteMin?: number | null;
  limiteMax?: number | null;
}
