export interface addMatchdayMarketI {
  tournament: number;
  matchday: number;
  realPlayer: number;
  minimumPrice: number;
  origin: string;
  sellerParticipant?: number;
  creationDate: Date;
}
