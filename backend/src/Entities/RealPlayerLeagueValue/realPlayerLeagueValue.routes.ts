import { Router } from 'express';
import { findByLeagueId } from './realPlayerLeagueValue.controler.js';

export const RealPlayerLeagueValueRouter = Router();

// GET /real-player-league-values?leagueId=X
RealPlayerLeagueValueRouter.get('/', findByLeagueId);
