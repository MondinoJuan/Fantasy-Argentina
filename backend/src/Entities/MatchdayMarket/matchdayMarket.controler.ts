import { Request, Response, NextFunction } from 'express';
import { MatchdayMarketRepository } from './matchdayMarket.repository.js';
import { MatchdayMarket } from './matchdayMarket.entity.js';

const repository = new MatchdayMarketRepository();

function sanitizeMatchdayMarketInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeMatchdayMarketInput = {
        tournamentId: req.body.tournamentId,
    matchdayId: req.body.matchdayId,
    realPlayerId: req.body.realPlayerId,
    minimumPrice: req.body.minimumPrice,
    origin: req.body.origin,
    sellerParticipantId: req.body.sellerParticipantId,
    creationDate: req.body.creationDate,
    };

    Object.keys(req.body.sanitizeMatchdayMarketInput).forEach(key => {
        if (req.body.sanitizeMatchdayMarketInput[key] === undefined) {
            delete req.body.sanitizeMatchdayMarketInput[key];
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
        return res.status(404).send({ error: 'MatchdayMarket not found' });
    }
    return res.json({ data: item });
}

function add(req: Request, res: Response) {
    const input = req.body.sanitizeMatchdayMarketInput;
    const newItem = new MatchdayMarket(
        input.tournamentId,
    input.matchdayId,
    input.realPlayerId,
    input.minimumPrice,
    input.origin,
    input.sellerParticipantId,
    input.creationDate,
    );
    const item = repository.add(newItem);
    return res.status(201).send({ message: 'MatchdayMarket created', data: item });
}

function update(req: Request, res: Response) {
    req.body.sanitizeMatchdayMarketInput.id = req.params.id;
    const item = repository.update(String(req.params.id), req.body.sanitizeMatchdayMarketInput);
    if (!item) {
        return res.status(404).send({ error: 'MatchdayMarket not found' });
    } else {
        return res.status(200).json({ message: 'MatchdayMarket updated', data: item });
    }
}

function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'MatchdayMarket not found' });
    } else {
        return res.status(200).send({ message: 'MatchdayMarket deleted successfully' });
    }
}

export { sanitizeMatchdayMarketInput, findAll, findOne, add, update, remove };
