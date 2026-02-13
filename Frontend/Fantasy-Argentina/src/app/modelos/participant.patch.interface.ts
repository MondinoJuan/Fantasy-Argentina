export interface participantPatchI {
  id: number;
  user?: number;
  tournament?: number;
  bankBudget?: number;
  reservedMoney?: number;
  availableMoney?: number;
  totalScore?: number;
  joinDate?: Date;
}
