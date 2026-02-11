import { Router } from 'express';
import { sanitizeShieldingInput, findAll, findOne, add, update, remove } from './shielding.controler.js';

export const ShieldingRouter = Router();

ShieldingRouter.get('/', findAll);
ShieldingRouter.get('/:id', findOne);
ShieldingRouter.post('/', sanitizeShieldingInput, add);
ShieldingRouter.put('/:id', sanitizeShieldingInput, update);
ShieldingRouter.patch('/:id', sanitizeShieldingInput, update);
ShieldingRouter.delete('/:id', remove);
