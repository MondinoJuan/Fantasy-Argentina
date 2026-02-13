export interface addNegotiationI {
  tournament: number;
  sellerParticipant: number;
  buyerParticipant: number;
  realPlayer: number;
  agreedAmount: number;
  status: string;
  creationDate: Date;
  publicationDate?: Date;
  effectiveDate?: Date;
  rejectionDate?: Date;
}
