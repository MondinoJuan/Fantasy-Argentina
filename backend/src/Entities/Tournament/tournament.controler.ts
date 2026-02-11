import { Request, Response, NextFunction } from 'express';
import { TournamentRepository } from './tournament.repository.js';
import { Tournament } from './tournament.entity.js';

const repository = new TournamentRepository();

function sanitizeTournamentInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeTournamentInput = {
        name: req.body.name,
    leagueId: req.body.leagueId,
    initialBudget: req.body.initialBudget,
    squadSize: req.body.squadSize,
    status: req.body.status,
    clauseEnableDate: req.body.clauseEnableDate,
    };

    Object.keys(req.body.sanitizeTournamentInput).forEach(key => {
        if (req.body.sanitizeTournamentInput[key] === undefined) {
            delete req.body.sanitizeTournamentInput[key];
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
        return res.status(404).send({ error: 'Tournament not found' });
    }
    return res.json({ data: item });
}

function add(req: Request, res: Response) {
    const input = req.body.sanitizeTournamentInput;
    const newItem = new Tournament(
        input.name,
    input.leagueId,
    input.creationDate,
    input.initialBudget,
    input.squadSize,
    input.status,
    input.clauseEnableDate,
    );
    const item = repository.add(newItem);
    return res.status(201).send({ message: 'Tournament created', data: item });
}

function update(req: Request, res: Response) {
    req.body.sanitizeTournamentInput.id = req.params.id;
    const item = repository.update(String(req.params.id), req.body.sanitizeTournamentInput);
    if (!item) {
        return res.status(404).send({ error: 'Tournament not found' });
    } else {
        return res.status(200).json({ message: 'Tournament updated', data: item });
    }
}

function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'Tournament not found' });
    } else {
        return res.status(200).send({ message: 'Tournament deleted successfully' });
    }
}

export { sanitizeTournamentInput, findAll, findOne, add, update, remove };
