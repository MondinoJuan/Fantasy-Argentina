import { BidStatus } from './domain-enums.types';
export interface bidI {
  id?: number;
  matchdayMarket: number;
  participant: number;
  realPlayer: number;
  offeredAmount: number;
  status: BidStatus;
  bidDate: Date;
  cancellationDate?: Date;
}
