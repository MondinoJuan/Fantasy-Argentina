import { Router } from 'express';
import { findAll, findOne } from './dependantPlayer.controler.js';

export const DependantPlayerRouter = Router();

DependantPlayerRouter.get('/', findAll);
DependantPlayerRouter.get('/:id', findOne);
