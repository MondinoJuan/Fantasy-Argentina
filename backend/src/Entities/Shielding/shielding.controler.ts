import { Request, Response, NextFunction } from 'express';
import { Shielding } from './shielding.entity.js';
import { orm } from '../../shared/db/orm.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeShieldingInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeShieldingInput = {
        playerClauseId: req.body.playerClauseId,
    participantId: req.body.participantId,
    investedAmount: req.body.investedAmount,
    clauseIncrease: req.body.clauseIncrease,
    };

  Object.keys(req.body.sanitizeShieldingInput).forEach((key) => {
    if (req.body.sanitizeShieldingInput[key] === undefined) {
      delete req.body.sanitizeShieldingInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(Shielding, {});
    res.status(200).json({ message: 'found all shieldings', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(Shielding, { id });
    res.status(200).json({ message: 'found shielding', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(Shielding, req.body.sanitizeShieldingInput);
    await em.flush();
    res.status(201).json({ message: 'shielding created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.findOneOrFail(Shielding, { id });
    em.assign(itemToUpdate, req.body.sanitizeShieldingInput);
    await em.flush();
    res.status(200).json({ message: 'shielding updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(Shielding, id);
    await em.removeAndFlush(item);
    res.status(200).json({ message: 'shielding deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeShieldingInput, findAll, findOne, add, update, remove };
