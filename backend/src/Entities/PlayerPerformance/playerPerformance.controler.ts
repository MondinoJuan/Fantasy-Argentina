import { Request, Response, NextFunction } from 'express';
import { PlayerPerformanceRepository } from './playerPerformance.repository.js';
import { PlayerPerformance } from './playerPerformance.entity.js';

const repository = new PlayerPerformanceRepository();

function sanitizePlayerPerformanceInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizePlayerPerformanceInput = {
        realPlayerId: req.body.realPlayerId,
    matchdayId: req.body.matchdayId,
    pointsObtained: req.body.pointsObtained,
    played: req.body.played,
    };

    Object.keys(req.body.sanitizePlayerPerformanceInput).forEach(key => {
        if (req.body.sanitizePlayerPerformanceInput[key] === undefined) {
            delete req.body.sanitizePlayerPerformanceInput[key];
        }
    });
    next();
}

async function findAll(req: Request, res: Response) {
    return res.json({ data: await repository.findAll() });
}

async function findOne(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = await repository.findOne({ id });
    if (!item) {
        return res.status(404).send({ error: 'PlayerPerformance not found' });
    }
    return res.json({ data: item });
}

async function add(req: Request, res: Response) {
    const input = req.body.sanitizePlayerPerformanceInput;
    const newItem = new PlayerPerformance(
        input.realPlayerId,
    input.matchdayId,
    input.pointsObtained,
    input.played,
    input.updateDate,
    );
    const item = await repository.add(newItem);
    return res.status(201).send({ message: 'PlayerPerformance created', data: item });
}

async function update(req: Request, res: Response) {
    req.body.sanitizePlayerPerformanceInput.id = req.params.id;
    const item = await repository.update(String(req.params.id), req.body.sanitizePlayerPerformanceInput);
    if (!item) {
        return res.status(404).send({ error: 'PlayerPerformance not found' });
    } else {
        return res.status(200).json({ message: 'PlayerPerformance updated', data: item });
    }
}

async function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = await repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'PlayerPerformance not found' });
    } else {
        return res.status(200).send({ message: 'PlayerPerformance deleted successfully' });
    }
}

export { sanitizePlayerPerformanceInput, findAll, findOne, add, update, remove };
