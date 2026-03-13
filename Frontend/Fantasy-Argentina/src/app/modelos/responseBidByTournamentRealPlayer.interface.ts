import { bidI } from './bid.interface';

export interface responseBidByTournamentRealPlayerI {
  data: Array<bidI>;
  message: string;
  totalBids: number;
  totalParticipants: number;
}
