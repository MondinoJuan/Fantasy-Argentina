import { Router } from 'express';
import { sanitizeParticipantInput, findAll, findOne, add, update, remove, joinByTournamentCode, spendMoney, transferMoney, quickSellRealPlayer, leaveTournament } from './participant.controler.js';

export const ParticipantRouter = Router();

ParticipantRouter.get('/', findAll);
ParticipantRouter.post('/transfer-money', transferMoney);
ParticipantRouter.post('/leave-tournament', leaveTournament);
ParticipantRouter.post('/:id/quick-sell-player', quickSellRealPlayer);
ParticipantRouter.post('/:id/spend-money', spendMoney);
ParticipantRouter.get('/:id', findOne);
ParticipantRouter.post('/', sanitizeParticipantInput, add);
ParticipantRouter.post('/join-by-code', joinByTournamentCode);
ParticipantRouter.put('/:id', sanitizeParticipantInput, update);
ParticipantRouter.patch('/:id', sanitizeParticipantInput, update);
ParticipantRouter.delete('/:id', remove);
