import { MarketOrigin } from './domain-enums.types';
export interface matchdayMarketPatchI {
  id: number;
  tournament?: number;
  matchday?: number;
  dependantPlayer?: number;
  minimumPrice?: number;
  origin?: MarketOrigin;
  sellerParticipant?: number;
  creationDate?: Date;
}
