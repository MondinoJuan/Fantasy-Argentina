export interface matchdayMarketPatchI {
  id: number;
  tournament?: number;
  matchday?: number;
  realPlayer?: number;
  minimumPrice?: number;
  origin?: string;
  sellerParticipant?: number;
  creationDate?: Date;
}
