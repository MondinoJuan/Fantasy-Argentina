import { Router } from 'express';
import { sanitizeSportInput, findAll, findByIdEnApi, findOne, add, update, remove } from './sport.controler.js';

export const SportRouter = Router();

SportRouter.get('/', findAll);
SportRouter.get('/by-id-en-api/:idEnApi', findByIdEnApi);
SportRouter.get('/:id', findOne);
SportRouter.post('/', sanitizeSportInput, add);
SportRouter.put('/:id', sanitizeSportInput, update);
SportRouter.patch('/:id', sanitizeSportInput, update);
SportRouter.delete('/:id', remove);
