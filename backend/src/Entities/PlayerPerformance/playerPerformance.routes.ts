import { Router } from 'express';
import { sanitizePlayerPerformanceInput, findAll, findOne, add, update, remove } from './playerPerformance.controler.js';

export const PlayerPerformanceRouter = Router();

PlayerPerformanceRouter.get('/', findAll);
PlayerPerformanceRouter.get('/:id', findOne);
PlayerPerformanceRouter.post('/', sanitizePlayerPerformanceInput, add);
PlayerPerformanceRouter.put('/:id', sanitizePlayerPerformanceInput, update);
PlayerPerformanceRouter.patch('/:id', sanitizePlayerPerformanceInput, update);
PlayerPerformanceRouter.delete('/:id', remove);
