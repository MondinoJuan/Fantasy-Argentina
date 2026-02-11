import { Request, Response, NextFunction } from 'express';
import { MatchRepository } from './match.repository.js';
import { Match } from './match.entity.js';

const repository = new MatchRepository();

function sanitizeMatchInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeMatchInput = {
        matchdayId: req.body.matchdayId,
    externalApiId: req.body.externalApiId,
    homeTeam: req.body.homeTeam,
    awayTeam: req.body.awayTeam,
    startDateTime: req.body.startDateTime,
    status: req.body.status,
    };

    Object.keys(req.body.sanitizeMatchInput).forEach(key => {
        if (req.body.sanitizeMatchInput[key] === undefined) {
            delete req.body.sanitizeMatchInput[key];
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
        return res.status(404).send({ error: 'Match not found' });
    }
    return res.json({ data: item });
}

function add(req: Request, res: Response) {
    const input = req.body.sanitizeMatchInput;
    const newItem = new Match(
        input.matchdayId,
    input.externalApiId,
    input.homeTeam,
    input.awayTeam,
    input.startDateTime,
    input.status,
    );
    const item = repository.add(newItem);
    return res.status(201).send({ message: 'Match created', data: item });
}

function update(req: Request, res: Response) {
    req.body.sanitizeMatchInput.id = req.params.id;
    const item = repository.update(req.body.sanitizeMatchInput);
    if (!item) {
        return res.status(404).send({ error: 'Match not found' });
    } else {
        return res.status(200).json({ message: 'Match updated', data: item });
    }
}

function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'Match not found' });
    } else {
        return res.status(200).send({ message: 'Match deleted successfully' });
    }
}

export { sanitizeMatchInput, findAll, findOne, add, update, remove };
