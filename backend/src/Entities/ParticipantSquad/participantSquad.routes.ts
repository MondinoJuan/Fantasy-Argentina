import { Router } from 'express';
import { sanitizeParticipantSquadInput, findAll, findOne, add, update, remove } from './participantSquad.controler.js';

export const ParticipantSquadRouter = Router();

ParticipantSquadRouter.get('/', findAll);
ParticipantSquadRouter.get('/:id', findOne);
ParticipantSquadRouter.post('/', sanitizeParticipantSquadInput, add);
ParticipantSquadRouter.put('/:id', sanitizeParticipantSquadInput, update);
ParticipantSquadRouter.patch('/:id', sanitizeParticipantSquadInput, update);
ParticipantSquadRouter.delete('/:id', remove);
