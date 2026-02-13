import { Request, Response, NextFunction } from 'express';
import { ParticipantSquad } from './participantSquad.entity.js';
import { orm } from '../../shared/db/orm.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeParticipantSquadInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeParticipantSquadInput = {
        participant: req.body.participant ?? req.body.participantId,
    realPlayer: req.body.realPlayer ?? req.body.realPlayerId,
    releaseDate: req.body.releaseDate,
    purchasePrice: req.body.purchasePrice,
    acquisitionType: req.body.acquisitionType,
    };

  Object.keys(req.body.sanitizeParticipantSquadInput).forEach((key) => {
    if (req.body.sanitizeParticipantSquadInput[key] === undefined) {
      delete req.body.sanitizeParticipantSquadInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(ParticipantSquad, {}, { populate: ['participant', 'realPlayer'] });
    res.status(200).json({ message: 'found all participant squads', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(ParticipantSquad, { id }, { populate: ['participant', 'realPlayer'] });
    res.status(200).json({ message: 'found participant squad', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(ParticipantSquad, req.body.sanitizeParticipantSquadInput);
    await em.flush();
    res.status(201).json({ message: 'participant squad created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(ParticipantSquad, id);
    em.assign(itemToUpdate, req.body.sanitizeParticipantSquadInput);
    await em.flush();
    res.status(200).json({ message: 'participant squad updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(ParticipantSquad, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'participant squad deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeParticipantSquadInput, findAll, findOne, add, update, remove };
