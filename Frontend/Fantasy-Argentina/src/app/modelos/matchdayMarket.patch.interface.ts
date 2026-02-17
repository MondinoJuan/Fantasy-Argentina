export interface matchdayMarketPatchI {
  id: number;
  tournament?: number;
  matchday?: number;
  dependantPlayer?: number;
  minimumPrice?: number;
  origin?: string;
  sellerParticipant?: number;
  creationDate?: Date;
}
