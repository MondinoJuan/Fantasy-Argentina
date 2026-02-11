import { Router } from 'express';
import { sanitizeTournamentInput, findAll, findOne, add, update, remove } from './tournament.controler.js';

export const TournamentRouter = Router();

TournamentRouter.get('/', findAll);
TournamentRouter.get('/:id', findOne);
TournamentRouter.post('/', sanitizeTournamentInput, add);
TournamentRouter.put('/:id', sanitizeTournamentInput, update);
TournamentRouter.patch('/:id', sanitizeTournamentInput, update);
TournamentRouter.delete('/:id', remove);
