import { Request, Response, NextFunction } from 'express';
import { Negotiation } from './negotiation.entity.js';
import { orm } from '../../shared/db/orm.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeNegotiationInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeNegotiationInput = {
        tournament: req.body.tournament ?? req.body.tournamentId,
    sellerParticipant: req.body.sellerParticipant ?? req.body.sellerParticipantId,
    buyerParticipant: req.body.buyerParticipant ?? req.body.buyerParticipantId,
    dependantPlayer: req.body.dependantPlayer ?? req.body.dependantPlayerId,
    agreedAmount: req.body.agreedAmount,
    status: req.body.status,
    publicationDate: req.body.publicationDate,
    effectiveDate: req.body.effectiveDate,
    rejectionDate: req.body.rejectionDate,
    };

  Object.keys(req.body.sanitizeNegotiationInput).forEach((key) => {
    if (req.body.sanitizeNegotiationInput[key] === undefined) {
      delete req.body.sanitizeNegotiationInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(Negotiation, {}, { populate: ['tournament', 'sellerParticipant', 'buyerParticipant', 'dependantPlayer'] });
    res.status(200).json({ message: 'found all negotiations', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(Negotiation, { id }, { populate: ['tournament', 'sellerParticipant', 'buyerParticipant', 'dependantPlayer'] });
    res.status(200).json({ message: 'found negotiation', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(Negotiation, req.body.sanitizeNegotiationInput);
    await em.flush();
    res.status(201).json({ message: 'negotiation created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(Negotiation, id);
    em.assign(itemToUpdate, req.body.sanitizeNegotiationInput);
    await em.flush();
    res.status(200).json({ message: 'negotiation updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(Negotiation, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'negotiation deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeNegotiationInput, findAll, findOne, add, update, remove };
