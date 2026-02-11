import { Request, Response, NextFunction } from 'express';
import { RealTeamRepository } from './realTeam.repository.js';
import { RealTeam } from './realTeam.entity.js';

const repository = new RealTeamRepository();

function sanitizeRealTeamInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeRealTeamInput = {
        name: req.body.name,
    leagueId: req.body.leagueId,
    externalApiId: req.body.externalApiId,
    };

    Object.keys(req.body.sanitizeRealTeamInput).forEach(key => {
        if (req.body.sanitizeRealTeamInput[key] === undefined) {
            delete req.body.sanitizeRealTeamInput[key];
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
        return res.status(404).send({ error: 'RealTeam not found' });
    }
    return res.json({ data: item });
}

function add(req: Request, res: Response) {
    const input = req.body.sanitizeRealTeamInput;
    const newItem = new RealTeam(
        input.name,
    input.leagueId,
    input.externalApiId,
    );
    const item = repository.add(newItem);
    return res.status(201).send({ message: 'RealTeam created', data: item });
}

function update(req: Request, res: Response) {
    req.body.sanitizeRealTeamInput.id = req.params.id;
    const item = repository.update(req.body.sanitizeRealTeamInput);
    if (!item) {
        return res.status(404).send({ error: 'RealTeam not found' });
    } else {
        return res.status(200).json({ message: 'RealTeam updated', data: item });
    }
}

function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'RealTeam not found' });
    } else {
        return res.status(200).send({ message: 'RealTeam deleted successfully' });
    }
}

export { sanitizeRealTeamInput, findAll, findOne, add, update, remove };
