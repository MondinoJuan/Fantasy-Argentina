import { Request, Response, NextFunction } from 'express';
import { ShieldingRepository } from './shielding.repository.js';
import { Shielding } from './shielding.entity.js';

const repository = new ShieldingRepository();

function sanitizeShieldingInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeShieldingInput = {
        playerClauseId: req.body.playerClauseId,
    participantId: req.body.participantId,
    investedAmount: req.body.investedAmount,
    clauseIncrease: req.body.clauseIncrease,
    };

    Object.keys(req.body.sanitizeShieldingInput).forEach(key => {
        if (req.body.sanitizeShieldingInput[key] === undefined) {
            delete req.body.sanitizeShieldingInput[key];
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
        return res.status(404).send({ error: 'Shielding not found' });
    }
    return res.json({ data: item });
}

function add(req: Request, res: Response) {
    const input = req.body.sanitizeShieldingInput;
    const newItem = new Shielding(
        input.playerClauseId,
    input.participantId,
    input.investedAmount,
    input.clauseIncrease,
    input.shieldingDate,
    );
    const item = repository.add(newItem);
    return res.status(201).send({ message: 'Shielding created', data: item });
}

function update(req: Request, res: Response) {
    req.body.sanitizeShieldingInput.id = req.params.id;
    const item = repository.update(String(req.params.id), req.body.sanitizeShieldingInput);
    if (!item) {
        return res.status(404).send({ error: 'Shielding not found' });
    } else {
        return res.status(200).json({ message: 'Shielding updated', data: item });
    }
}

function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'Shielding not found' });
    } else {
        return res.status(200).send({ message: 'Shielding deleted successfully' });
    }
}

export { sanitizeShieldingInput, findAll, findOne, add, update, remove };
