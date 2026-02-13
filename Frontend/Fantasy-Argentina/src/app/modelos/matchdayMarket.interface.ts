export interface matchdayMarketI {
  id?: number;
  tournament: number;
  matchday: number;
  realPlayer: number;
  minimumPrice: number;
  origin: string;
  sellerParticipant?: number;
  creationDate: Date;
}
