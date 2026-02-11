import { Request, Response, NextFunction } from 'express';
import { PlayerPointsBreakdownRepository } from './playerPointsBreakdown.repository.js';
import { PlayerPointsBreakdown } from './playerPointsBreakdown.entity.js';

const repository = new PlayerPointsBreakdownRepository();

function sanitizePlayerPointsBreakdownInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizePlayerPointsBreakdownInput = {
        participantId: req.body.participantId,
    matchdayId: req.body.matchdayId,
    realPlayerId: req.body.realPlayerId,
    contributedPoints: req.body.contributedPoints,
    playerPerformanceId: req.body.playerPerformanceId,
    };

    Object.keys(req.body.sanitizePlayerPointsBreakdownInput).forEach(key => {
        if (req.body.sanitizePlayerPointsBreakdownInput[key] === undefined) {
            delete req.body.sanitizePlayerPointsBreakdownInput[key];
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
        return res.status(404).send({ error: 'PlayerPointsBreakdown not found' });
    }
    return res.json({ data: item });
}

function add(req: Request, res: Response) {
    const input = req.body.sanitizePlayerPointsBreakdownInput;
    const newItem = new PlayerPointsBreakdown(
        input.participantId,
    input.matchdayId,
    input.realPlayerId,
    input.contributedPoints,
    input.playerPerformanceId,
    );
    const item = repository.add(newItem);
    return res.status(201).send({ message: 'PlayerPointsBreakdown created', data: item });
}

function update(req: Request, res: Response) {
    req.body.sanitizePlayerPointsBreakdownInput.id = req.params.id;
    const item = repository.update(req.body.sanitizePlayerPointsBreakdownInput);
    if (!item) {
        return res.status(404).send({ error: 'PlayerPointsBreakdown not found' });
    } else {
        return res.status(200).json({ message: 'PlayerPointsBreakdown updated', data: item });
    }
}

function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'PlayerPointsBreakdown not found' });
    } else {
        return res.status(200).send({ message: 'PlayerPointsBreakdown deleted successfully' });
    }
}

export { sanitizePlayerPointsBreakdownInput, findAll, findOne, add, update, remove };
