import { Router } from 'express';
import { sanitizeNegotiationInput, findAll, findOne, add, update, remove, accept } from './negotiation.controler.js';

export const NegotiationRouter = Router();

NegotiationRouter.get('/', findAll);
NegotiationRouter.get('/:id', findOne);
NegotiationRouter.post('/:id/accept', accept);
NegotiationRouter.post('/', sanitizeNegotiationInput, add);
NegotiationRouter.put('/:id', sanitizeNegotiationInput, update);
NegotiationRouter.patch('/:id', sanitizeNegotiationInput, update);
NegotiationRouter.delete('/:id', remove);
