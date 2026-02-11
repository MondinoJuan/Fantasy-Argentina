import { Router } from 'express';
import { sanitizeParticipantMatchdayPointsInput, findAll, findOne, add, update, remove } from './participantMatchdayPoints.controler.js';

export const ParticipantMatchdayPointsRouter = Router();

ParticipantMatchdayPointsRouter.get('/', findAll);
ParticipantMatchdayPointsRouter.get('/:id', findOne);
ParticipantMatchdayPointsRouter.post('/', sanitizeParticipantMatchdayPointsInput, add);
ParticipantMatchdayPointsRouter.put('/:id', sanitizeParticipantMatchdayPointsInput, update);
ParticipantMatchdayPointsRouter.patch('/:id', sanitizeParticipantMatchdayPointsInput, update);
ParticipantMatchdayPointsRouter.delete('/:id', remove);
