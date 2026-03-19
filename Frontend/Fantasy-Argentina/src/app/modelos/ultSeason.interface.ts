import { leagueI } from './league.interface';

export interface ultSeasonI {
  id?: number;
  idEnApi: number;
  league: leagueI | number;
  desc: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
