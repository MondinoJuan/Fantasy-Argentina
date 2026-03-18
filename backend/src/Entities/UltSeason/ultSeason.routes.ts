import { Router } from 'express';
import { add, findAll, findOne, remove, sanitizeUltSeasonInput, syncByLeagueIdEnApi, update } from './ultSeason.controler.js';

export const UltSeasonRouter = Router();

UltSeasonRouter.get('/', findAll);
UltSeasonRouter.post('/sync/by-league-id-en-api', syncByLeagueIdEnApi);
UltSeasonRouter.get('/:id', findOne);
UltSeasonRouter.post('/', sanitizeUltSeasonInput, add);
UltSeasonRouter.put('/:id', sanitizeUltSeasonInput, update);
UltSeasonRouter.patch('/:id', sanitizeUltSeasonInput, update);
UltSeasonRouter.delete('/:id', remove);
