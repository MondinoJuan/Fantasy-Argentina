export interface addMatchdayMarketI {
  tournament: number;
  matchday: number;
  dependantPlayer: number;
  minimumPrice: number;
  origin: string;
  sellerParticipant?: number;
  creationDate: Date;
}
