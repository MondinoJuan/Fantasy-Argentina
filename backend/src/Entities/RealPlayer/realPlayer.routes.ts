import { Router } from 'express';
import { sanitizeRealPlayerInput, findAll, findByIdEnApi, findOne, add, update, remove, syncByLeagueIdEnApi, syncTeamSquadByTeamIdEnApi } from './realPlayer.controler.js';

export const RealPlayerRouter = Router();

RealPlayerRouter.get('/', findAll);
RealPlayerRouter.get('/by-id-en-api/:idEnApi', findByIdEnApi);
RealPlayerRouter.post('/sync/by-league-id-en-api', syncByLeagueIdEnApi);
RealPlayerRouter.post('/sync/team-squad', syncTeamSquadByTeamIdEnApi);
RealPlayerRouter.get('/:id', findOne);
RealPlayerRouter.post('/', sanitizeRealPlayerInput, add);
RealPlayerRouter.put('/:id', sanitizeRealPlayerInput, update);
RealPlayerRouter.patch('/:id', sanitizeRealPlayerInput, update);
RealPlayerRouter.delete('/:id', remove);
