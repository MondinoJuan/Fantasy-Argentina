import { MarketOrigin } from './domain-enums.types';
export interface addMatchdayMarketI {
  tournament: number;
  matchday: number;
  dependantPlayer: number;
  minimumPrice: number;
  origin: MarketOrigin;
  sellerParticipant?: number;
  creationDate: Date;
}
