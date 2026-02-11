import { Request, Response, NextFunction } from 'express';
import { NegotiationRepository } from './negotiation.repository.js';
import { Negotiation } from './negotiation.entity.js';

const repository = new NegotiationRepository();

function sanitizeNegotiationInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeNegotiationInput = {
        tournamentId: req.body.tournamentId,
    sellerParticipantId: req.body.sellerParticipantId,
    buyerParticipantId: req.body.buyerParticipantId,
    realPlayerId: req.body.realPlayerId,
    agreedAmount: req.body.agreedAmount,
    status: req.body.status,
    creationDate: req.body.creationDate,
    publicationDate: req.body.publicationDate,
    effectiveDate: req.body.effectiveDate,
    rejectionDate: req.body.rejectionDate,
    };

    Object.keys(req.body.sanitizeNegotiationInput).forEach(key => {
        if (req.body.sanitizeNegotiationInput[key] === undefined) {
            delete req.body.sanitizeNegotiationInput[key];
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
        return res.status(404).send({ error: 'Negotiation not found' });
    }
    return res.json({ data: item });
}

function add(req: Request, res: Response) {
    const input = req.body.sanitizeNegotiationInput;
    const newItem = new Negotiation(
        input.tournamentId,
    input.sellerParticipantId,
    input.buyerParticipantId,
    input.realPlayerId,
    input.agreedAmount,
    input.status,
    input.creationDate,
    input.publicationDate,
    input.effectiveDate,
    input.rejectionDate,
    );
    const item = repository.add(newItem);
    return res.status(201).send({ message: 'Negotiation created', data: item });
}

function update(req: Request, res: Response) {
    req.body.sanitizeNegotiationInput.id = req.params.id;
    const item = repository.update(String(req.params.id), req.body.sanitizeNegotiationInput);
    if (!item) {
        return res.status(404).send({ error: 'Negotiation not found' });
    } else {
        return res.status(200).json({ message: 'Negotiation updated', data: item });
    }
}

function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'Negotiation not found' });
    } else {
        return res.status(200).send({ message: 'Negotiation deleted successfully' });
    }
}

export { sanitizeNegotiationInput, findAll, findOne, add, update, remove };
