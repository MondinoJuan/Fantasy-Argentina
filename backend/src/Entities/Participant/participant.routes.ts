import { Router } from 'express';
import { sanitizeParticipantInput, findAll, findOne, add, update, remove } from './participant.controler.js';

export const ParticipantRouter = Router();

ParticipantRouter.get('/', findAll);
ParticipantRouter.get('/:id', findOne);
ParticipantRouter.post('/', sanitizeParticipantInput, add);
ParticipantRouter.put('/:id', sanitizeParticipantInput, update);
ParticipantRouter.patch('/:id', sanitizeParticipantInput, update);
ParticipantRouter.delete('/:id', remove);
