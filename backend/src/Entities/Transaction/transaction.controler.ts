import { Request, Response, NextFunction } from 'express';
import { TransactionRepository } from './transaction.repository.js';
import { Transaction } from './transaction.entity.js';

const repository = new TransactionRepository();

function sanitizeTransactionInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeTransactionInput = {
        originParticipantId: req.body.originParticipantId,
    destinationParticipantId: req.body.destinationParticipantId,
    tournamentId: req.body.tournamentId,
    type: req.body.type,
    amount: req.body.amount,
    referenceTable: req.body.referenceTable,
    referenceId: req.body.referenceId,
    publicationDate: req.body.publicationDate,
    effectiveDate: req.body.effectiveDate,
    };

    Object.keys(req.body.sanitizeTransactionInput).forEach(key => {
        if (req.body.sanitizeTransactionInput[key] === undefined) {
            delete req.body.sanitizeTransactionInput[key];
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
        return res.status(404).send({ error: 'Transaction not found' });
    }
    return res.json({ data: item });
}

async function add(req: Request, res: Response) {
    const input = req.body.sanitizeTransactionInput;
    const newItem = new Transaction(
        input.originParticipantId,
    input.destinationParticipantId,
    input.tournamentId,
    input.type,
    input.amount,
    input.referenceTable,
    input.referenceId,
    input.creationDate,
    input.publicationDate,
    input.effectiveDate,
    );
    const item = await repository.add(newItem);
    return res.status(201).send({ message: 'Transaction created', data: item });
}

async function update(req: Request, res: Response) {
    req.body.sanitizeTransactionInput.id = req.params.id;
    const item = await repository.update(String(req.params.id), req.body.sanitizeTransactionInput);
    if (!item) {
        return res.status(404).send({ error: 'Transaction not found' });
    } else {
        return res.status(200).json({ message: 'Transaction updated', data: item });
    }
}

async function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = await repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'Transaction not found' });
    } else {
        return res.status(200).send({ message: 'Transaction deleted successfully' });
    }
}

export { sanitizeTransactionInput, findAll, findOne, add, update, remove };
