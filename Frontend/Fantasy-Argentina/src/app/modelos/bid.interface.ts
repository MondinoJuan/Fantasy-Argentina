export interface bidI {
  id?: number;
  matchdayMarket: number;
  participant: number;
  offeredAmount: number;
  status: string;
  bidDate: Date;
  cancellationDate?: Date;
}
