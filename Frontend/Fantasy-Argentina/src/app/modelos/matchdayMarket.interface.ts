export interface matchdayMarketI {
  id?: number;
  tournament: number;
  matchday: number;
  dependantPlayer: number;
  minimumPrice: number;
  origin: string;
  sellerParticipant?: number;
  creationDate: Date;
}
