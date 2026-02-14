import { Router } from 'express';
import { sanitizeLeagueInput, findAll, findOne, add, update, remove, syncFromRapidApi } from './league.controler.js';

export const LeagueRouter = Router();

LeagueRouter.get('/', findAll);
LeagueRouter.post('/sync/rapidapi', syncFromRapidApi);
LeagueRouter.get('/:id', findOne);
LeagueRouter.post('/', sanitizeLeagueInput, add);
LeagueRouter.put('/:id', sanitizeLeagueInput, update);
LeagueRouter.patch('/:id', sanitizeLeagueInput, update);
LeagueRouter.delete('/:id', remove);
