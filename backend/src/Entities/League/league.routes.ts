import { Router } from 'express';
import {
  sanitizeLeagueInput,
  findAll,
  findByIdEnApi,
  findOne,
  add,
  update,
  remove,
  syncFromSportsApiPro,
  ensureByNameFromSportsApiPro,
  syncByIdEnApi,
  syncKnockoutStageByLeagueIdEnApi,
} from './league.controler.js';

export const LeagueRouter = Router();

LeagueRouter.get('/', findAll);
LeagueRouter.post('/sync/sportsapipro', syncFromSportsApiPro);
LeagueRouter.post('/ensure/by-name', ensureByNameFromSportsApiPro);
LeagueRouter.post('/sync/by-id-en-api', syncByIdEnApi);
LeagueRouter.post('/sync/knockout-stage/by-league-id-en-api', syncKnockoutStageByLeagueIdEnApi);
LeagueRouter.get('/by-id-en-api/:idEnApi', findByIdEnApi);
LeagueRouter.get('/:id', findOne);
LeagueRouter.post('/', sanitizeLeagueInput, add);
LeagueRouter.put('/:id', sanitizeLeagueInput, update);
LeagueRouter.patch('/:id', sanitizeLeagueInput, update);
LeagueRouter.delete('/:id', remove);

// Compatibilidad temporal mientras se migran consumidores existentes.
LeagueRouter.post('/sync/rapidapi', syncFromSportsApiPro);
