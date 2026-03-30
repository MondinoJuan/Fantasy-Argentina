import { Request, Response, NextFunction } from 'express';
import { League } from './league.entity.js';
import { orm } from '../../shared/db/orm.js';
import { fetchLeaguesFromSportsApiPro } from '../../integrations/sportsapipro/sportsapipro.client.js';
import { persistNewLeagueService } from './services/persistNewLeague.service.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function sanitizeLeagueInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeLeagueInput = {
    name: req.body.name,
    country: req.body.country,
    sport: req.body.sport,
    idEnApi: req.body.idEnApi,
    limiteMin: toNumber(req.body.limiteMin),
    limiteMax: toNumber(req.body.limiteMax),
  };

  Object.keys(req.body.sanitizeLeagueInput).forEach((key) => {
    if (req.body.sanitizeLeagueInput[key] === undefined) {
      delete req.body.sanitizeLeagueInput[key];
    }
  });
  next();
}


async function syncFromSportsApiPro(req: Request, res: Response) {
  try {
    // API-EXTERNA: sincroniza ligas desde SportsApiPro.
    const externalLeagues = await fetchLeaguesFromSportsApiPro();
    let created = 0;
    let updated = 0;

    for (const externalLeague of externalLeagues) {
      const existing = await em.findOne(League, { idEnApi: externalLeague.id });

      if (existing) {
        existing.name = externalLeague.name;
        existing.country = externalLeague.country;
        if (!existing.sport) {
          existing.sport = 'Football';
        }
        updated += 1;
        continue;
      }

      em.create(League, {
        name: externalLeague.name,
        country: externalLeague.country,
        sport: 'Football',
        idEnApi: externalLeague.id,
        limiteMin: null,
        limiteMax: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      created += 1;
    }

    await em.flush();

    res.status(200).json({
      message: 'leagues synchronized from sportsapipro',
      data: {
        imported: externalLeagues.length,
        created,
        updated,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}


async function ensureByNameFromSportsApiPro(req: Request, res: Response) {
  try {
    const leagueName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

    if (!leagueName) {
      res.status(400).json({ message: 'league name is required' });
      return;
    }

    const existingLeague = await em.findOne(League, { name: leagueName });
    if (existingLeague) {
      res.status(200).json({ message: 'league already exists', data: existingLeague });
      return;
    }

    // API-EXTERNA: buscamos la liga por nombre en SportsApiPro para persistirla localmente.
    // API-EXTERNA: desde esta selección de liga se encadena luego la carga de equipos/jugadores que la conforman.
    const externalLeagues = await fetchLeaguesFromSportsApiPro();
    const matchedLeague = externalLeagues.find((league) => league.name.toLowerCase() === leagueName.toLowerCase());

    if (!matchedLeague) {
      res.status(404).json({ message: `league ${leagueName} not found on external provider` });
      return;
    }

    const createdLeague = em.create(League, {
      name: matchedLeague.name,
      country: matchedLeague.country,
      sport: 'Football',
      idEnApi: matchedLeague.id,
      limiteMin: null,
      limiteMax: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await em.flush();

    res.status(201).json({ message: 'league created from sportsapipro', data: createdLeague });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(League, {});
    res.status(200).json({ message: 'found all leagues', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}


async function findByIdEnApi(req: Request, res: Response) {
  try {
    const idEnApi = parseId(req.params.idEnApi);

    if (!Number.isFinite(idEnApi)) {
      res.status(400).json({ message: 'idEnApi must be a valid number' });
      return;
    }

    const item = await em.findOne(League, { idEnApi });

    if (item) {
      res.status(200).json({ message: 'found league by idEnApi', data: item });
      return;
    }

    const country = String(req.query.country ?? 'argentina').trim();
    if (!country) {
      res.status(400).json({ message: 'country query param is required' });
      return;
    }

    const persisted = await persistNewLeagueService(idEnApi, country);
    res.status(201).json({ message: 'league not found locally, persisted from external provider', data: persisted.league });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(League, { id });
    res.status(200).json({ message: 'found league', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(League, req.body.sanitizeLeagueInput);
    await em.flush();
    res.status(201).json({ message: 'league created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(League, id);
    em.assign(itemToUpdate, req.body.sanitizeLeagueInput);
    await em.flush();
    res.status(200).json({ message: 'league updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(League, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'league deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}



async function syncByIdEnApi(req: Request, res: Response) {
  try {
    const idEnApi = Number.parseInt(String(req.body?.idEnApi ?? ''), 10);
    const rawCountry = typeof req.body?.country === 'string' ? req.body.country.trim() : '';
    const country = rawCountry.length > 0 ? rawCountry : null;
    const limiteMin = toNumber(req.body?.limiteMin);
    const limiteMax = toNumber(req.body?.limiteMax);

    if (!Number.isFinite(idEnApi)) {
      res.status(400).json({ message: 'idEnApi is required' });
      return;
    }

    const item = await persistNewLeagueService(idEnApi, country, { limiteMin, limiteMax });
    await em.flush();
    res.status(201).json({ message: 'league synced from sportsapipro', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
export { sanitizeLeagueInput, findAll, findByIdEnApi, findOne, add, update, remove, syncFromSportsApiPro, ensureByNameFromSportsApiPro, syncByIdEnApi };
