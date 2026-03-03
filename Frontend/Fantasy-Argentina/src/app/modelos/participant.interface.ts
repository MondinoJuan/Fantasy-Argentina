import { tournamentI } from './tournament.interface';
import { userI } from './user.interface';

export interface participantI {
  id?: number;
  user: number | userI;
  tournament: number | tournamentI;
  bankBudget: number;
  reservedMoney: number;
  availableMoney: number;
  totalScore: number;
  joinDate: Date;
}
