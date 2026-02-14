import { Router } from 'express';
import { sanitizeLeagueInput, findAll, findOne, add, update, remove, syncFromSportmonks } from './league.controler.js';

export const LeagueRouter = Router();

LeagueRouter.get('/', findAll);
LeagueRouter.post('/sync/sportmonks', syncFromSportmonks);
LeagueRouter.get('/:id', findOne);
LeagueRouter.post('/', sanitizeLeagueInput, add);
LeagueRouter.put('/:id', sanitizeLeagueInput, update);
LeagueRouter.patch('/:id', sanitizeLeagueInput, update);
LeagueRouter.delete('/:id', remove);
