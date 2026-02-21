import { Router } from 'express';
import { sanitizeRealPlayerInput, findAll, findByIdEnApi, findOne, add, update, remove } from './realPlayer.controler.js';

export const RealPlayerRouter = Router();

RealPlayerRouter.get('/', findAll);
RealPlayerRouter.get('/by-id-en-api/:idEnApi', findByIdEnApi);
RealPlayerRouter.get('/:id', findOne);
RealPlayerRouter.post('/', sanitizeRealPlayerInput, add);
RealPlayerRouter.put('/:id', sanitizeRealPlayerInput, update);
RealPlayerRouter.patch('/:id', sanitizeRealPlayerInput, update);
RealPlayerRouter.delete('/:id', remove);
