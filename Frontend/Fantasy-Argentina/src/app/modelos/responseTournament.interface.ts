import { tournamentI } from './tournament.interface';

export interface responseTournamentI {
  data: tournamentI;
  message: string;
  fixtureStats?: {
    teamsTotal?: number;
    expectedPerTeam?: number;
    consultedTeams?: number;
    skippedTeams?: number;
    eventsCollected?: number;
  };
  postponedMatches?: number;
}
