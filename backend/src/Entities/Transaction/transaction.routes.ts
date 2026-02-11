import { Router } from 'express';
import { sanitizeTransactionInput, findAll, findOne, add, update, remove } from './transaction.controler.js';

export const TransactionRouter = Router();

TransactionRouter.get('/', findAll);
TransactionRouter.get('/:id', findOne);
TransactionRouter.post('/', sanitizeTransactionInput, add);
TransactionRouter.put('/:id', sanitizeTransactionInput, update);
TransactionRouter.patch('/:id', sanitizeTransactionInput, update);
TransactionRouter.delete('/:id', remove);
