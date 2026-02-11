import { Request, Response, NextFunction } from 'express';
import { ParticipantRepository } from './participant.repository.js';
import { Participant } from './participant.entity.js';

const repository = new ParticipantRepository();

function sanitizeParticipantInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeParticipantInput = {
        userId: req.body.userId,
    tournamentId: req.body.tournamentId,
    bankBudget: req.body.bankBudget,
    reservedMoney: req.body.reservedMoney,
    availableMoney: req.body.availableMoney,
    totalScore: req.body.totalScore,
    };

    Object.keys(req.body.sanitizeParticipantInput).forEach(key => {
        if (req.body.sanitizeParticipantInput[key] === undefined) {
            delete req.body.sanitizeParticipantInput[key];
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
        return res.status(404).send({ error: 'Participant not found' });
    }
    return res.json({ data: item });
}

function add(req: Request, res: Response) {
    const input = req.body.sanitizeParticipantInput;
    const newItem = new Participant(
        input.userId,
    input.tournamentId,
    input.bankBudget,
    input.reservedMoney,
    input.availableMoney,
    input.totalScore,
    input.joinDate,
    );
    const item = repository.add(newItem);
    return res.status(201).send({ message: 'Participant created', data: item });
}

function update(req: Request, res: Response) {
    req.body.sanitizeParticipantInput.id = req.params.id;
    const item = repository.update(String(req.params.id), req.body.sanitizeParticipantInput);
    if (!item) {
        return res.status(404).send({ error: 'Participant not found' });
    } else {
        return res.status(200).json({ message: 'Participant updated', data: item });
    }
}

function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'Participant not found' });
    } else {
        return res.status(200).send({ message: 'Participant deleted successfully' });
    }
}

export { sanitizeParticipantInput, findAll, findOne, add, update, remove };
