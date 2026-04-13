import { Router } from 'express';
import {
  sanitizeRealTeamLeagueParticipationInput,
  findAll,
  findOne,
  add,
  update,
  remove,
} from './realTeamLeagueParticipation.controler.js';

export const RealTeamLeagueParticipationRouter = Router();

RealTeamLeagueParticipationRouter.get('/', findAll);
RealTeamLeagueParticipationRouter.get('/:id', findOne);
RealTeamLeagueParticipationRouter.post('/', sanitizeRealTeamLeagueParticipationInput, add);
RealTeamLeagueParticipationRouter.put('/:id', sanitizeRealTeamLeagueParticipationInput, update);
RealTeamLeagueParticipationRouter.patch('/:id', sanitizeRealTeamLeagueParticipationInput, update);
RealTeamLeagueParticipationRouter.delete('/:id', remove);
