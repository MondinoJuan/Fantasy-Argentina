import { Router } from 'express';
import { sanitizeMatchInput, findAll, findOne, add, update, remove } from './match.controler.js';

export const MatchRouter = Router();

MatchRouter.get('/', findAll);
MatchRouter.get('/:id', findOne);
MatchRouter.post('/', sanitizeMatchInput, add);
MatchRouter.put('/:id', sanitizeMatchInput, update);
MatchRouter.patch('/:id', sanitizeMatchInput, update);
MatchRouter.delete('/:id', remove);
