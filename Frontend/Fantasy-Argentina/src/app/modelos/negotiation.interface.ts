import { NegotiationStatus } from './domain-enums.types';
export interface negotiationI {
  id?: number;
  tournament: number;
  sellerParticipant: number;
  buyerParticipant: number;
  dependantPlayer: number;
  agreedAmount: number;
  status: NegotiationStatus;
  creationDate: Date;
  publicationDate?: Date;
  effectiveDate?: Date;
  rejectionDate?: Date;
}
