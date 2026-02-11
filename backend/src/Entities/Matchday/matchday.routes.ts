import { Router } from 'express';
import { sanitizeMatchdayInput, findAll, findOne, add, update, remove } from './matchday.controler.js';

export const MatchdayRouter = Router();

MatchdayRouter.get('/', findAll);
MatchdayRouter.get('/:id', findOne);
MatchdayRouter.post('/', sanitizeMatchdayInput, add);
MatchdayRouter.put('/:id', sanitizeMatchdayInput, update);
MatchdayRouter.patch('/:id', sanitizeMatchdayInput, update);
MatchdayRouter.delete('/:id', remove);
