export interface transactionI {
  id?: number;
  originParticipant?: number;
  destinationParticipant?: number;
  tournament: number;
  type: string;
  amount: number;
  referenceTable: string;
  referenceId: string;
  creationDate: Date;
  publicationDate?: Date;
  effectiveDate?: Date;
}
