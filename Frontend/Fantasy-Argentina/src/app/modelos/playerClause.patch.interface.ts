export interface playerClausePatchI {
  id: number;
  tournament?: number;
  realPlayer?: number;
  ownerParticipant?: number;
  baseClause?: number;
  additionalShieldingClause?: number;
  totalClause?: number;
  updateDate?: Date;
}
