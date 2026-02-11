import { Request, Response, NextFunction } from 'express';
import { MatchdayRepository } from './matchday.repository.js';
import { Matchday } from './matchday.entity.js';

const repository = new MatchdayRepository();

function sanitizeMatchdayInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeMatchdayInput = {
        leagueId: req.body.leagueId,
    season: req.body.season,
    matchdayNumber: req.body.matchdayNumber,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    status: req.body.status,
    };

    Object.keys(req.body.sanitizeMatchdayInput).forEach(key => {
        if (req.body.sanitizeMatchdayInput[key] === undefined) {
            delete req.body.sanitizeMatchdayInput[key];
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
        return res.status(404).send({ error: 'Matchday not found' });
    }
    return res.json({ data: item });
}

function add(req: Request, res: Response) {
    const input = req.body.sanitizeMatchdayInput;
    const newItem = new Matchday(
        input.leagueId,
    input.season,
    input.matchdayNumber,
    input.startDate,
    input.endDate,
    input.status,
    );
    const item = repository.add(newItem);
    return res.status(201).send({ message: 'Matchday created', data: item });
}

function update(req: Request, res: Response) {
    req.body.sanitizeMatchdayInput.id = req.params.id;
    const item = repository.update(String(req.params.id), req.body.sanitizeMatchdayInput);
    if (!item) {
        return res.status(404).send({ error: 'Matchday not found' });
    } else {
        return res.status(200).json({ message: 'Matchday updated', data: item });
    }
}

function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'Matchday not found' });
    } else {
        return res.status(200).send({ message: 'Matchday deleted successfully' });
    }
}

export { sanitizeMatchdayInput, findAll, findOne, add, update, remove };
