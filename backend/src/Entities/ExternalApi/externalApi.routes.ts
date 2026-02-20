import { Router } from 'express';
import {
  getSportsApiProPlayerById,
  getSportsApiProPlayersByTeam,
  getSportsApiProAllowedLeagues,
  getSportsApiProTeamsByLeague,
  getSportsApiProTeamDetailByTeam,
} from './externalApi.controler.js';

export const ExternalApiRouter = Router();

ExternalApiRouter.get('/sportsapipro/player', getSportsApiProPlayerById);
ExternalApiRouter.get('/sportsapipro/team-players', getSportsApiProPlayersByTeam);
ExternalApiRouter.get('/sportsapipro/leagues', getSportsApiProAllowedLeagues);
ExternalApiRouter.get('/sportsapipro/teams', getSportsApiProTeamsByLeague);
ExternalApiRouter.get('/sportsapipro/team-detail', getSportsApiProTeamDetailByTeam);

// Compatibilidad temporal mientras se migran consumidores existentes.
ExternalApiRouter.get('/rapidapi/player', getSportsApiProPlayerById);
ExternalApiRouter.get('/rapidapi/team-players', getSportsApiProPlayersByTeam);
ExternalApiRouter.get('/rapidapi/leagues', getSportsApiProAllowedLeagues);
ExternalApiRouter.get('/rapidapi/teams', getSportsApiProTeamsByLeague);
ExternalApiRouter.get('/rapidapi/team-detail', getSportsApiProTeamDetailByTeam);
