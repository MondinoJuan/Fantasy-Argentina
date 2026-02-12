import { Request, Response, NextFunction } from 'express';
import { Participant } from './participant.entity.js';
import { orm } from '../../shared/db/orm.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeParticipantInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeParticipantInput = {
        userId: req.body.userId,
    tournamentId: req.body.tournamentId,
    bankBudget: req.body.bankBudget,
    reservedMoney: req.body.reservedMoney,
    availableMoney: req.body.availableMoney,
    totalScore: req.body.totalScore,
    };

  Object.keys(req.body.sanitizeParticipantInput).forEach((key) => {
    if (req.body.sanitizeParticipantInput[key] === undefined) {
      delete req.body.sanitizeParticipantInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(Participant, {});
    res.status(200).json({ message: 'found all participants', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(Participant, { id });
    res.status(200).json({ message: 'found participant', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(Participant, req.body.sanitizeParticipantInput);
    await em.flush();
    res.status(201).json({ message: 'participant created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(Participant, id);
    em.assign(itemToUpdate, req.body.sanitizeParticipantInput);
    await em.flush();
    res.status(200).json({ message: 'participant updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(Participant, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'participant deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeParticipantInput, findAll, findOne, add, update, remove };
