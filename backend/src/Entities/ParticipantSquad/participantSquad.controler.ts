import { Request, Response, NextFunction } from 'express';
import { ParticipantSquadRepository } from './participantSquad.repository.js';
import { ParticipantSquad } from './participantSquad.entity.js';

const repository = new ParticipantSquadRepository();

function sanitizeParticipantSquadInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeParticipantSquadInput = {
        participantId: req.body.participantId,
    realPlayerId: req.body.realPlayerId,
    releaseDate: req.body.releaseDate,
    purchasePrice: req.body.purchasePrice,
    acquisitionType: req.body.acquisitionType,
    };

    Object.keys(req.body.sanitizeParticipantSquadInput).forEach(key => {
        if (req.body.sanitizeParticipantSquadInput[key] === undefined) {
            delete req.body.sanitizeParticipantSquadInput[key];
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
        return res.status(404).send({ error: 'ParticipantSquad not found' });
    }
    return res.json({ data: item });
}

async function add(req: Request, res: Response) {
    const input = req.body.sanitizeParticipantSquadInput;
    const newItem = new ParticipantSquad(
        input.participantId,
    input.realPlayerId,
    input.acquisitionDate,
    input.releaseDate,
    input.purchasePrice,
    input.acquisitionType,
    );
    const item = await repository.add(newItem);
    return res.status(201).send({ message: 'ParticipantSquad created', data: item });
}

async function update(req: Request, res: Response) {
    req.body.sanitizeParticipantSquadInput.id = req.params.id;
    const item = await repository.update(String(req.params.id), req.body.sanitizeParticipantSquadInput);
    if (!item) {
        return res.status(404).send({ error: 'ParticipantSquad not found' });
    } else {
        return res.status(200).json({ message: 'ParticipantSquad updated', data: item });
    }
}

async function remove(req: Request<{id: string}>, res: Response) {
    const id = req.params.id;
    const item = await repository.delete({ id });
    if (!item) {
        return res.status(404).send({ error: 'ParticipantSquad not found' });
    } else {
        return res.status(200).send({ message: 'ParticipantSquad deleted successfully' });
    }
}

export { sanitizeParticipantSquadInput, findAll, findOne, add, update, remove };
