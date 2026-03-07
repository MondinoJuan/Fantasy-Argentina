import { TransactionType } from './domain-enums.types';
export interface transactionI {
  id?: number;
  originParticipant?: number;
  destinationParticipant?: number;
  tournament: number;
  type: TransactionType;
  amount: number;
  referenceTable: string;
  referenceId: string;
  creationDate: Date;
  publicationDate?: Date;
  effectiveDate?: Date;
}
