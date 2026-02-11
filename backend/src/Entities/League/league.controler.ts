import { Request, Response, NextFunction } from 'express';
import { LeagueRepository } from './league.repository.js';
import { League } from './league.entity.js';

const repository = new LeagueRepository();

function sanitizeLeagueInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeLeagueInput = {
        name: req.body.name,
    country: req.body.country,
    externalApiId: req.body.externalApiId,
    };

    Object.keys(req.body.sanitizeLeagueInput).forEach(key => {
        if (req.body.sanitizeLeagueInput[key] === undefined) {
            delete req.body.sanitizeLeagueInput[key];
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
        return res.status(404).send({ error: 'League not found' });
    }
    return res.json({ data: item });
}

function add(req: Request, res: Response) {
    const input = req.body.sanitizeLeagueInput;
    const newItem = new League(
        input.name,
    input.country,
    input.externalApiId,
    );
    const item = repository.add(newItem);
    return res.status(201).send({ message: 'League created', data: item });
}

function update(req: Request, res: Response) {
    req.body.sanitizeLeagueInput.id = req.params.id;
    const item = repository.update(String(req.params.id), req.body.sanitizeLeagueInput);
    if (!item) {
        return res.status(404).send({ error: 'League not found' });
    } else {
        return res.status(200).json({ message: 'League updated', data: item });
    }
}

function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'League not found' });
    } else {
        return res.status(200).send({ message: 'League deleted successfully' });
    }
}

export { sanitizeLeagueInput, findAll, findOne, add, update, remove };
