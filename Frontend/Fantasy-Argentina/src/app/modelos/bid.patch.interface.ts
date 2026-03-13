import { BidStatus } from './domain-enums.types';
export interface bidPatchI {
  id: number;
  matchdayMarket?: number;
  participant?: number;
  tournament?: number;
  realPlayer?: number;
  offeredAmount?: number;
  status?: BidStatus;
  bidDate?: Date;
  cancellationDate?: Date;
}
