import { writeNegotiation } from '../../shared/services/gameCommands.service.js';
import { gameError } from '../../shared/http/game-error.js';
import { Request, Response, NextFunction } from 'express';
import { Negotiation } from './negotiation.entity.js';
import { orm } from '../../shared/db/orm.js';
import { readScope } from '../../shared/security/game-access.js';

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
    const items = await em.find(Negotiation, readScope(req.authUser!, 'negotiations', req.query.tournamentId), { populate: ['tournament', 'sellerParticipant.user', 'buyerParticipant.user', 'dependantPlayer'] });
    res.status(200).json({ message: 'found all negotiations', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(Negotiation, { id }, { populate: ['tournament', 'sellerParticipant.user', 'buyerParticipant.user', 'dependantPlayer'] });
    res.status(200).json({ message: 'found negotiation', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try { const data = await writeNegotiation(orm.em.fork(), req.body.sanitizeNegotiationInput, req.authUser!); res.status(201).json({ message: 'negotiation created', data }); }
  catch (error) { gameError(res, error); }
}
async function update(req: Request, res: Response) {
  try { const data = await writeNegotiation(orm.em.fork(), req.body.sanitizeNegotiationInput, req.authUser!, parseId(req.params.id)); res.status(200).json({ message: 'negotiation saved', data }); }
  catch (error) { gameError(res, error); }
}
async function accept(req: Request, res: Response) {
  try { const data = await writeNegotiation(orm.em.fork(), {}, req.authUser!, parseId(req.params.id), 'accept'); res.status(200).json({ message: 'negotiation accepted', data }); }
  catch (error) { gameError(res, error); }
}
async function remove(req: Request, res: Response) {
  try { const data = await writeNegotiation(orm.em.fork(), {}, req.authUser!, parseId(req.params.id), 'cancel'); res.status(200).json({ message: 'negotiation cancelled', data }); }
  catch (error) { gameError(res, error); }
}

export { sanitizeNegotiationInput, findAll, findOne, add, update, remove, accept };
