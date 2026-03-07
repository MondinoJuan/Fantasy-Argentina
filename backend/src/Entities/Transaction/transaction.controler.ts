import { Request, Response, NextFunction } from 'express';
import { Transaction } from './transaction.entity.js';
import { orm } from '../../shared/db/orm.js';
import { TRANSACTION_TYPES, isEnumValue } from '../../shared/domain-enums.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeTransactionInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeTransactionInput = {
        originParticipant: req.body.originParticipant ?? req.body.originParticipantId,
    destinationParticipant: req.body.destinationParticipant ?? req.body.destinationParticipantId,
    tournament: req.body.tournament ?? req.body.tournamentId,
    type: req.body.type,
    amount: req.body.amount,
    referenceTable: req.body.referenceTable,
    referenceId: req.body.referenceId,
    publicationDate: req.body.publicationDate,
    effectiveDate: req.body.effectiveDate,
    };

  Object.keys(req.body.sanitizeTransactionInput).forEach((key) => {
    if (req.body.sanitizeTransactionInput[key] === undefined) {
      delete req.body.sanitizeTransactionInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(Transaction, {}, { populate: ['originParticipant', 'destinationParticipant', 'tournament'] });
    res.status(200).json({ message: 'found all transactions', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(Transaction, { id }, { populate: ['originParticipant', 'destinationParticipant', 'tournament'] });
    res.status(200).json({ message: 'found transaction', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    if (req.body.sanitizeTransactionInput.type !== undefined && !isEnumValue(TRANSACTION_TYPES, req.body.sanitizeTransactionInput.type)) {
      res.status(400).json({ message: `type must be one of: ${TRANSACTION_TYPES.join(', ')}` });
      return;
    }

    const item = em.create(Transaction, req.body.sanitizeTransactionInput);
    await em.flush();
    res.status(201).json({ message: 'transaction created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    if (req.body.sanitizeTransactionInput.type !== undefined && !isEnumValue(TRANSACTION_TYPES, req.body.sanitizeTransactionInput.type)) {
      res.status(400).json({ message: `type must be one of: ${TRANSACTION_TYPES.join(', ')}` });
      return;
    }

    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(Transaction, id);
    em.assign(itemToUpdate, req.body.sanitizeTransactionInput);
    await em.flush();
    res.status(200).json({ message: 'transaction updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(Transaction, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'transaction deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeTransactionInput, findAll, findOne, add, update, remove };
