import { NextFunction, Request, Response } from 'express';
import { orm } from '../../shared/db/orm.js';
import { UltSeason } from './ultSeason.entity.js';
import { League } from '../League/league.entity.js';
import { requestSportsApiPro } from '../../integrations/sportsapipro/sportsapipro.client.js';

const em = orm.em;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeUltSeasonInput(req: Request, _res: Response, next: NextFunction) {
  req.body.sanitizeUltSeasonInput = {
    idEnApi: req.body.idEnApi,
    league: req.body.league,
    desc: req.body.desc,
  };

  Object.keys(req.body.sanitizeUltSeasonInput).forEach((key) => {
    if (req.body.sanitizeUltSeasonInput[key] === undefined) {
      delete req.body.sanitizeUltSeasonInput[key];
    }
  });

  next();
}

async function findAll(_req: Request, res: Response) {
  try {
    const items = await em.find(UltSeason, {}, { populate: ['league'] });
    res.status(200).json({ message: 'found all ult seasons', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(UltSeason, { id }, { populate: ['league'] });
    res.status(200).json({ message: 'found ult season', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(UltSeason, req.body.sanitizeUltSeasonInput);
    await em.flush();
    res.status(201).json({ message: 'ult season created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(UltSeason, id);
    em.assign(itemToUpdate, req.body.sanitizeUltSeasonInput);
    await em.flush();
    res.status(200).json({ message: 'ult season updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(UltSeason, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'ult season deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function syncByLeagueIdEnApi(req: Request, res: Response) {
  try {
    const leagueIdEnApi = Number.parseInt(
      String(req.body?.leagueIdEnApi ?? req.query?.leagueIdEnApi ?? ''),
      10,
    );

    if (!Number.isFinite(leagueIdEnApi)) {
      res.status(400).json({ message: 'leagueIdEnApi is required' });
      return;
    }

    const league = await em.findOne(League, { idEnApi: leagueIdEnApi });
    if (!league || typeof league.id !== 'number') {
      res.status(404).json({ message: `No encontré league local para idEnApi=${leagueIdEnApi}` });
      return;
    }

    const payload = asRecord(await requestSportsApiPro(`/api/tournaments/${leagueIdEnApi}/seasons`));
    const success = payload.success;
    if (success !== true) {
      res.status(502).json({
        message: `La API devolvió success=false. Respuesta: ${JSON.stringify(payload)}`,
      });
      return;
    }

    const tournamentId = Number.parseInt(String(payload.tournamentId ?? ''), 10);
    const seasons = asArray(payload.seasons).map((item) => asRecord(item));
    if (seasons.length === 0) {
      res.status(502).json({ message: 'La respuesta no contiene seasons o la lista está vacía.' });
      return;
    }

    const latest = seasons[0];
    const latestTournamentId = Number.parseInt(String(latest.tournamentId ?? ''), 10);
    if (
      Number.isFinite(tournamentId)
      && Number.isFinite(latestTournamentId)
      && latestTournamentId !== leagueIdEnApi
    ) {
      res.status(502).json({
        message: `El tournamentId de la última season (${latestTournamentId}) no coincide con el ingresado (${leagueIdEnApi}).`,
      });
      return;
    }

    const idEnApi = Number.parseInt(String(latest.id ?? ''), 10);
    const desc = String(latest.year ?? '').trim();

    if (!Number.isFinite(idEnApi) || !desc) {
      res.status(500).json({ message: 'No pude resolver la última season desde SportsApiPro' });
      return;
    }

    let ultSeason = await em.findOne(UltSeason, { league: league.id });

    if (!ultSeason) {
      ultSeason = em.create(UltSeason, {
        idEnApi,
        league,
        desc,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      ultSeason.idEnApi = idEnApi;
      ultSeason.desc = desc;
      ultSeason.league = league;
    }

    await em.flush();

    const resultado = {
      success: true,
      tournamentId: leagueIdEnApi,
      latestSeason: {
        id: idEnApi,
        year: desc,
        tournamentId: Number.isFinite(latestTournamentId) ? latestTournamentId : leagueIdEnApi,
      },
    };

    res.status(201).json({
      message: 'latest season persisted',
      data: {
        league,
        ultSeason,
        result: resultado,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeUltSeasonInput, findAll, findOne, add, update, remove, syncByLeagueIdEnApi };
