import { MarketOrigin } from './domain-enums.types';
export interface addMatchdayMarketI {
  tournament: number;
  matchday: number;
  dependantPlayerIds: number[];
  minimumPrice: number;
  origin: MarketOrigin;
  sellerParticipant?: number;
  creationDate: Date;
}
