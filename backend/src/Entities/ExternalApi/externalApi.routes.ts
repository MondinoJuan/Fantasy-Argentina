import { Router } from 'express';
import {
  getDashboardLeagues,
  getDashboardSeasons,
  getDashboardTeams,
  getDashboardPlayers,
  getDashboardPlayerRating,
} from './externalApi.controler.js';

export const ExternalApiRouter = Router();

ExternalApiRouter.get('/dashboard/leagues', getDashboardLeagues);
ExternalApiRouter.get('/dashboard/seasons', getDashboardSeasons);
ExternalApiRouter.get('/dashboard/teams', getDashboardTeams);
ExternalApiRouter.get('/dashboard/players', getDashboardPlayers);
ExternalApiRouter.get('/dashboard/player-rating', getDashboardPlayerRating);
