import { MarketOrigin } from './domain-enums.types';
export interface matchdayMarketI {
  id?: number;
  tournament: number;
  matchday: number;
  dependantPlayer: number;
  minimumPrice: number;
  origin: MarketOrigin;
  sellerParticipant?: number;
  creationDate: Date;
}
