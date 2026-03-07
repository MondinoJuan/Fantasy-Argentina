import { MatchStatus } from './domain-enums.types';
export interface matchPatchI {
  id: number;
  matchday?: number;
  externalApiId?: string;
  homeTeam?: string;
  awayTeam?: string;
  startDateTime?: Date;
  status?: MatchStatus;
}
