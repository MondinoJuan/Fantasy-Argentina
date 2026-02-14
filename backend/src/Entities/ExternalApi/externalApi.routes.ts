import { Router } from 'express';
import {
  getRapidApiPlayerById,
  getRapidApiPlayersByTeam,
  getRapidApiAllowedLeagues,
  getRapidApiTeamsByLeague,
  getRapidApiTeamDetailByTeam,
} from './externalApi.controler.js';

export const ExternalApiRouter = Router();

ExternalApiRouter.get('/rapidapi/player', getRapidApiPlayerById);
ExternalApiRouter.get('/rapidapi/team-players', getRapidApiPlayersByTeam);
ExternalApiRouter.get('/rapidapi/leagues', getRapidApiAllowedLeagues);
ExternalApiRouter.get('/rapidapi/teams', getRapidApiTeamsByLeague);
ExternalApiRouter.get('/rapidapi/team-detail', getRapidApiTeamDetailByTeam);
