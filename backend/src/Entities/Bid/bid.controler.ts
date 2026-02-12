import { Request, Response, NextFunction } from 'express';
import { BidRepository } from './bid.repository.js';
import { Bid } from './bid.entity.js';

const repository = new BidRepository();

function sanitizeBidInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeBidInput = {
        matchdayMarketId: req.body.matchdayMarketId,
    participantId: req.body.participantId,
    offeredAmount: req.body.offeredAmount,
    status: req.body.status,
    cancellationDate: req.body.cancellationDate,
    };

    Object.keys(req.body.sanitizeBidInput).forEach(key => {
        if (req.body.sanitizeBidInput[key] === undefined) {
            delete req.body.sanitizeBidInput[key];
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
        return res.status(404).send({ error: 'Bid not found' });
    }
    return res.json({ data: item });
}

async function add(req: Request, res: Response) {
    const input = req.body.sanitizeBidInput;
    const newItem = new Bid(
        input.matchdayMarketId,
    input.participantId,
    input.offeredAmount,
    input.status,
    input.bidDate,
    input.cancellationDate,
    );
    const item = await repository.add(newItem);
    return res.status(201).send({ message: 'Bid created', data: item });
}

async function update(req: Request, res: Response) {
    req.body.sanitizeBidInput.id = req.params.id;
    const item = await repository.update(String(req.params.id), req.body.sanitizeBidInput);
    if (!item) {
        return res.status(404).send({ error: 'Bid not found' });
    } else {
        return res.status(200).json({ message: 'Bid updated', data: item });
    }
}

async function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = await repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'Bid not found' });
    } else {
        return res.status(200).send({ message: 'Bid deleted successfully' });
    }
}

export { sanitizeBidInput, findAll, findOne, add, update, remove };
