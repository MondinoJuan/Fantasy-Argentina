import { Request, Response, NextFunction } from 'express';
import { Bid } from './bid.entity.js';
import { orm } from '../../shared/db/orm.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeBidInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeBidInput = {
        matchdayMarketId: req.body.matchdayMarketId,
    participantId: req.body.participantId,
    offeredAmount: req.body.offeredAmount,
    status: req.body.status,
    cancellationDate: req.body.cancellationDate,
    };

  Object.keys(req.body.sanitizeBidInput).forEach((key) => {
    if (req.body.sanitizeBidInput[key] === undefined) {
      delete req.body.sanitizeBidInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(Bid, {});
    res.status(200).json({ message: 'found all bids', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(Bid, { id });
    res.status(200).json({ message: 'found bid', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(Bid, req.body.sanitizeBidInput);
    await em.flush();
    res.status(201).json({ message: 'bid created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(Bid, id);
    em.assign(itemToUpdate, req.body.sanitizeBidInput);
    await em.flush();
    res.status(200).json({ message: 'bid updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(Bid, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'bid deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeBidInput, findAll, findOne, add, update, remove };
