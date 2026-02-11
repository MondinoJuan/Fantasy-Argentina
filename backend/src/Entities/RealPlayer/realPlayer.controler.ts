import { Request, Response, NextFunction } from 'express';
import { RealPlayerRepository } from './realPlayer.repository.js';
import { RealPlayer } from './realPlayer.entity.js';

const repository = new RealPlayerRepository();

function sanitizeRealPlayerInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeRealPlayerInput = {
        externalApiId: req.body.externalApiId,
    name: req.body.name,
    position: req.body.position,
    realTeamId: req.body.realTeamId,
    marketValue: req.body.marketValue,
    active: req.body.active,
    lastUpdate: req.body.lastUpdate,
    };

    Object.keys(req.body.sanitizeRealPlayerInput).forEach(key => {
        if (req.body.sanitizeRealPlayerInput[key] === undefined) {
            delete req.body.sanitizeRealPlayerInput[key];
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
        return res.status(404).send({ error: 'RealPlayer not found' });
    }
    return res.json({ data: item });
}

function add(req: Request, res: Response) {
    const input = req.body.sanitizeRealPlayerInput;
    const newItem = new RealPlayer(
        input.externalApiId,
    input.name,
    input.position,
    input.realTeamId,
    input.marketValue,
    input.active,
    input.lastUpdate,
    );
    const item = repository.add(newItem);
    return res.status(201).send({ message: 'RealPlayer created', data: item });
}

function update(req: Request, res: Response) {
    req.body.sanitizeRealPlayerInput.id = req.params.id;
    const item = repository.update(String(req.params.id), req.body.sanitizeRealPlayerInput);
    if (!item) {
        return res.status(404).send({ error: 'RealPlayer not found' });
    } else {
        return res.status(200).json({ message: 'RealPlayer updated', data: item });
    }
}

function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'RealPlayer not found' });
    } else {
        return res.status(200).send({ message: 'RealPlayer deleted successfully' });
    }
}

export { sanitizeRealPlayerInput, findAll, findOne, add, update, remove };
