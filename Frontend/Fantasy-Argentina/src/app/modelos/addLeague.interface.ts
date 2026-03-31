export interface addLeagueI {
  name: string;
  country: string;
  sport: string;
  idEnApi: number;
  kncokoutStage?: boolean;
  limiteMin?: number | null;
  limiteMax?: number | null;
}
