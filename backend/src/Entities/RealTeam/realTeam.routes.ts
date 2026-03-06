import { Router } from 'express';
import { sanitizeRealTeamInput, findAll, findByIdEnApi, findOne, add, update, remove, syncByLeagueIdEnApi } from './realTeam.controler.js';

export const RealTeamRouter = Router();

RealTeamRouter.get('/', findAll);
RealTeamRouter.get('/by-id-en-api/:idEnApi', findByIdEnApi);
RealTeamRouter.post('/sync/by-league-id-en-api', syncByLeagueIdEnApi);
RealTeamRouter.get('/:id', findOne);
RealTeamRouter.post('/', sanitizeRealTeamInput, add);
RealTeamRouter.put('/:id', sanitizeRealTeamInput, update);
RealTeamRouter.patch('/:id', sanitizeRealTeamInput, update);
RealTeamRouter.delete('/:id', remove);
