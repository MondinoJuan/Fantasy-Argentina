export interface negotiationPatchI {
  id: number;
  tournament?: number;
  sellerParticipant?: number;
  buyerParticipant?: number;
  dependantPlayer?: number;
  agreedAmount?: number;
  status?: string;
  creationDate?: Date;
  publicationDate?: Date;
  effectiveDate?: Date;
  rejectionDate?: Date;
}
