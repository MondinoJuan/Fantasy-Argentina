import { Request, Response, NextFunction } from 'express';
import { PlayerClauseRepository } from './playerClause.repository.js';
import { PlayerClause } from './playerClause.entity.js';

const repository = new PlayerClauseRepository();

function sanitizePlayerClauseInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizePlayerClauseInput = {
        tournamentId: req.body.tournamentId,
    realPlayerId: req.body.realPlayerId,
    ownerParticipantId: req.body.ownerParticipantId,
    baseClause: req.body.baseClause,
    additionalShieldingClause: req.body.additionalShieldingClause,
    totalClause: req.body.totalClause,
    updateDate: req.body.updateDate,
    };

    Object.keys(req.body.sanitizePlayerClauseInput).forEach(key => {
        if (req.body.sanitizePlayerClauseInput[key] === undefined) {
            delete req.body.sanitizePlayerClauseInput[key];
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
        return res.status(404).send({ error: 'PlayerClause not found' });
    }
    return res.json({ data: item });
}

function add(req: Request, res: Response) {
    const input = req.body.sanitizePlayerClauseInput;
    const newItem = new PlayerClause(
        input.tournamentId,
    input.realPlayerId,
    input.ownerParticipantId,
    input.baseClause,
    input.additionalShieldingClause,
    input.totalClause,
    input.updateDate,
    );
    const item = repository.add(newItem);
    return res.status(201).send({ message: 'PlayerClause created', data: item });
}

function update(req: Request, res: Response) {
    req.body.sanitizePlayerClauseInput.id = req.params.id;
    const item = repository.update(String(req.params.id), req.body.sanitizePlayerClauseInput);
    if (!item) {
        return res.status(404).send({ error: 'PlayerClause not found' });
    } else {
        return res.status(200).json({ message: 'PlayerClause updated', data: item });
    }
}

function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'PlayerClause not found' });
    } else {
        return res.status(200).send({ message: 'PlayerClause deleted successfully' });
    }
}

export { sanitizePlayerClauseInput, findAll, findOne, add, update, remove };
