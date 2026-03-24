import { Router } from 'express';
import { sanitizeGameMatchInput, findAll, findOne, add, update, remove } from './gameMatch.controler.js';

export const GameMatchRouter = Router();

GameMatchRouter.get('/', findAll);
GameMatchRouter.get('/:id', findOne);
GameMatchRouter.post('/', sanitizeGameMatchInput, add);
GameMatchRouter.put('/:id', sanitizeGameMatchInput, update);
GameMatchRouter.patch('/:id', sanitizeGameMatchInput, update);
GameMatchRouter.delete('/:id', remove);
