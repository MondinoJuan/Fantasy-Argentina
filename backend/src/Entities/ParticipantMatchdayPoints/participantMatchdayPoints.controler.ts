import { Request, Response, NextFunction } from 'express';
import { ParticipantMatchdayPoints } from './participantMatchdayPoints.entity.js';
import { orm } from '../../shared/db/orm.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeParticipantMatchdayPointsInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeParticipantMatchdayPointsInput = {
        participantId: req.body.participantId,
    matchdayId: req.body.matchdayId,
    matchdayPoints: req.body.matchdayPoints,
    accumulatedPoints: req.body.accumulatedPoints,
    position: req.body.position,
    calculationDate: req.body.calculationDate,
    };

  Object.keys(req.body.sanitizeParticipantMatchdayPointsInput).forEach((key) => {
    if (req.body.sanitizeParticipantMatchdayPointsInput[key] === undefined) {
      delete req.body.sanitizeParticipantMatchdayPointsInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(ParticipantMatchdayPoints, {});
    res.status(200).json({ message: 'found all participant matchday pointss', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(ParticipantMatchdayPoints, { id });
    res.status(200).json({ message: 'found participant matchday points', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(ParticipantMatchdayPoints, req.body.sanitizeParticipantMatchdayPointsInput);
    await em.flush();
    res.status(201).json({ message: 'participant matchday points created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(ParticipantMatchdayPoints, id);
    em.assign(itemToUpdate, req.body.sanitizeParticipantMatchdayPointsInput);
    await em.flush();
    res.status(200).json({ message: 'participant matchday points updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(ParticipantMatchdayPoints, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'participant matchday points deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeParticipantMatchdayPointsInput, findAll, findOne, add, update, remove };
