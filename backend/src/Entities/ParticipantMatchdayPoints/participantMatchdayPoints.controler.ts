import { Request, Response, NextFunction } from 'express';
import { ParticipantMatchdayPointsRepository } from './participantMatchdayPoints.repository.js';
import { ParticipantMatchdayPoints } from './participantMatchdayPoints.entity.js';

const repository = new ParticipantMatchdayPointsRepository();

function sanitizeParticipantMatchdayPointsInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeParticipantMatchdayPointsInput = {
        participantId: req.body.participantId,
    matchdayId: req.body.matchdayId,
    matchdayPoints: req.body.matchdayPoints,
    accumulatedPoints: req.body.accumulatedPoints,
    position: req.body.position,
    calculationDate: req.body.calculationDate,
    };

    Object.keys(req.body.sanitizeParticipantMatchdayPointsInput).forEach(key => {
        if (req.body.sanitizeParticipantMatchdayPointsInput[key] === undefined) {
            delete req.body.sanitizeParticipantMatchdayPointsInput[key];
        }
    });
    next();
}

function findAll(req: Request, res: Response) {
    return res.json({ data: repository.findAll() });
}

function findOne(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = repository.findOne({ id });
    if (!item) {
        return res.status(404).send({ error: 'ParticipantMatchdayPoints not found' });
    }
    return res.json({ data: item });
}

function add(req: Request, res: Response) {
    const input = req.body.sanitizeParticipantMatchdayPointsInput;
    const newItem = new ParticipantMatchdayPoints(
        input.participantId,
    input.matchdayId,
    input.matchdayPoints,
    input.accumulatedPoints,
    input.position,
    input.calculationDate,
    );
    const item = repository.add(newItem);
    return res.status(201).send({ message: 'ParticipantMatchdayPoints created', data: item });
}

function update(req: Request, res: Response) {
    req.body.sanitizeParticipantMatchdayPointsInput.id = req.params.id;
    const item = repository.update(String(req.params.id), req.body.sanitizeParticipantMatchdayPointsInput);
    if (!item) {
        return res.status(404).send({ error: 'ParticipantMatchdayPoints not found' });
    } else {
        return res.status(200).json({ message: 'ParticipantMatchdayPoints updated', data: item });
    }
}

function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'ParticipantMatchdayPoints not found' });
    } else {
        return res.status(200).send({ message: 'ParticipantMatchdayPoints deleted successfully' });
    }
}

export { sanitizeParticipantMatchdayPointsInput, findAll, findOne, add, update, remove };
