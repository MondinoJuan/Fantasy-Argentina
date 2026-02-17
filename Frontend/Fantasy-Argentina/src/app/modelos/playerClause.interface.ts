export interface playerClauseI {
  id?: number;
  tournament: number;
  dependantPlayer: number;
  ownerParticipant: number;
  baseClause: number;
  additionalShieldingClause: number;
  totalClause: number;
  updateDate: Date;
}
