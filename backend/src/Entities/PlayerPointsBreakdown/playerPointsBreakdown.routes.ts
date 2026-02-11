import { Router } from 'express';
import { sanitizePlayerPointsBreakdownInput, findAll, findOne, add, update, remove } from './playerPointsBreakdown.controler.js';

export const PlayerPointsBreakdownRouter = Router();

PlayerPointsBreakdownRouter.get('/', findAll);
PlayerPointsBreakdownRouter.get('/:id', findOne);
PlayerPointsBreakdownRouter.post('/', sanitizePlayerPointsBreakdownInput, add);
PlayerPointsBreakdownRouter.put('/:id', sanitizePlayerPointsBreakdownInput, update);
PlayerPointsBreakdownRouter.patch('/:id', sanitizePlayerPointsBreakdownInput, update);
PlayerPointsBreakdownRouter.delete('/:id', remove);
