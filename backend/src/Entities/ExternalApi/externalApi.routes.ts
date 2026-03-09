import { Router } from 'express';
import {
  getSportsApiProPlayerById,
  getSportsApiProPlayersByTeam,
  getPlayersByAthleteId,
  getSportsApiProAllowedLeagues,
  getSportsApiProTeamsByLeague,
  getSportsApiProTeamDetailByTeam,
  getSportsApiProCompetitionTeams,
  getSportsApiProLatestMatchdayRatings,
  postSportsApiProFixtureEventRefs,
  postSportsApiProFixtureBuild,
  postSportsApiProBuildCompetitionFixture,
  getSportsApiProLocalPersistedFixture,
  getSportsApiProRankingsWithLocalPerformances,
} from './externalApi.controler.js';

export const ExternalApiRouter = Router();

ExternalApiRouter.get('/sportsapipro/player', getSportsApiProPlayerById);
ExternalApiRouter.get('/sportsapipro/team-players', getSportsApiProPlayersByTeam);
ExternalApiRouter.get('/sportsapipro/athlete-basic', getPlayersByAthleteId);
ExternalApiRouter.get('/sportsapipro/leagues', getSportsApiProAllowedLeagues);
ExternalApiRouter.get('/sportsapipro/teams', getSportsApiProTeamsByLeague);
ExternalApiRouter.get('/sportsapipro/team-detail', getSportsApiProTeamDetailByTeam);
ExternalApiRouter.get('/sportsapipro/competition-teams', getSportsApiProCompetitionTeams);
ExternalApiRouter.get('/sportsapipro/latest-matchday-ratings', getSportsApiProLatestMatchdayRatings);
ExternalApiRouter.post('/sportsapipro/fixture/event-refs', postSportsApiProFixtureEventRefs);
ExternalApiRouter.post('/sportsapipro/fixture/build', postSportsApiProFixtureBuild);
ExternalApiRouter.post('/sportsapipro/fixture/build-competition', postSportsApiProBuildCompetitionFixture);
ExternalApiRouter.get('/sportsapipro/fixture/local', getSportsApiProLocalPersistedFixture);
ExternalApiRouter.get('/sportsapipro/rankings/player-performances', getSportsApiProRankingsWithLocalPerformances);

// Compatibilidad temporal mientras se migran consumidores existentes.
ExternalApiRouter.get('/rapidapi/player', getSportsApiProPlayerById);
ExternalApiRouter.get('/rapidapi/team-players', getSportsApiProPlayersByTeam);
ExternalApiRouter.get('/rapidapi/athlete-basic', getPlayersByAthleteId);
ExternalApiRouter.get('/rapidapi/leagues', getSportsApiProAllowedLeagues);
ExternalApiRouter.get('/rapidapi/teams', getSportsApiProTeamsByLeague);
ExternalApiRouter.get('/rapidapi/team-detail', getSportsApiProTeamDetailByTeam);
