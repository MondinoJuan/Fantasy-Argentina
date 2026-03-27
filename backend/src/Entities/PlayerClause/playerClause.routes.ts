import { Router } from 'express';
import { sanitizePlayerClauseInput, findAll, findOne, add, update, remove, applyShielding } from './playerClause.controler.js';

export const PlayerClauseRouter = Router();

PlayerClauseRouter.get('/', findAll);
PlayerClauseRouter.post('/:id/apply-shielding', applyShielding);
PlayerClauseRouter.get('/:id', findOne);
PlayerClauseRouter.post('/', sanitizePlayerClauseInput, add);
PlayerClauseRouter.put('/:id', sanitizePlayerClauseInput, update);
PlayerClauseRouter.patch('/:id', sanitizePlayerClauseInput, update);
PlayerClauseRouter.delete('/:id', remove);
