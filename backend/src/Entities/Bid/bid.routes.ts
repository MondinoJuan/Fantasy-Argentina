import { Router } from 'express';
import { sanitizeBidInput, findAll, findByTournamentAndRealPlayer, findOne, add, update, remove } from './bid.controler.js';

export const BidRouter = Router();

BidRouter.get('/', findAll);
BidRouter.get('/tournament/:tournamentId/real-player/:realPlayerId', findByTournamentAndRealPlayer);
BidRouter.get('/:id', findOne);
BidRouter.post('/', sanitizeBidInput, add);
BidRouter.put('/:id', sanitizeBidInput, update);
BidRouter.patch('/:id', sanitizeBidInput, update);
BidRouter.delete('/:id', remove);
