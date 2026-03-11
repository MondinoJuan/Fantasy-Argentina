import { MarketOrigin } from './domain-enums.types';
export interface matchdayMarketI {
  id?: number;
  tournament: number;
  matchday: number;
  dependantPlayerIds: number[];
  minimumPrice: number;
  origin: MarketOrigin;
  sellerParticipant?: number;
  creationDate: Date;
}
