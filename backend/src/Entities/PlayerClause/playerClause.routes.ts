import { Router } from 'express';
import { sanitizePlayerClauseInput, findAll, findOne, add, update, remove } from './playerClause.controler.js';

export const PlayerClauseRouter = Router();

PlayerClauseRouter.get('/', findAll);
PlayerClauseRouter.get('/:id', findOne);
PlayerClauseRouter.post('/', sanitizePlayerClauseInput, add);
PlayerClauseRouter.put('/:id', sanitizePlayerClauseInput, update);
PlayerClauseRouter.patch('/:id', sanitizePlayerClauseInput, update);
PlayerClauseRouter.delete('/:id', remove);
