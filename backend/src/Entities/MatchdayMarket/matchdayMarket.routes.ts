import { Router } from 'express';
import { sanitizeMatchdayMarketInput, findAll, findOne, add, update, remove } from './matchdayMarket.controler.js';

export const MatchdayMarketRouter = Router();

MatchdayMarketRouter.get('/', findAll);
MatchdayMarketRouter.get('/:id', findOne);
MatchdayMarketRouter.post('/', sanitizeMatchdayMarketInput, add);
MatchdayMarketRouter.put('/:id', sanitizeMatchdayMarketInput, update);
MatchdayMarketRouter.patch('/:id', sanitizeMatchdayMarketInput, update);
MatchdayMarketRouter.delete('/:id', remove);
