export interface addBidI {
  matchdayMarket: number;
  participant: number;
  offeredAmount: number;
  status: string;
  bidDate: Date;
  cancellationDate?: Date;
}
