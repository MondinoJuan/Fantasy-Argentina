import { Router } from 'express';
import { sanitizeRealTeamInput, findAll, findOne, add, update, remove } from './realTeam.controler.js';

export const RealTeamRouter = Router();

RealTeamRouter.get('/', findAll);
RealTeamRouter.get('/:id', findOne);
RealTeamRouter.post('/', sanitizeRealTeamInput, add);
RealTeamRouter.put('/:id', sanitizeRealTeamInput, update);
RealTeamRouter.patch('/:id', sanitizeRealTeamInput, update);
RealTeamRouter.delete('/:id', remove);
