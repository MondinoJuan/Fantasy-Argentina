import { Request, Response, NextFunction } from 'express';
import { League } from './league.entity.js';
import { orm } from '../../shared/db/orm.js';
import { fetchLeaguesFromRapidApi } from '../../integrations/rapidapi/rapidapi.client.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeLeagueInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeLeagueInput = {
        name: req.body.name,
    country: req.body.country,
    externalApiId: req.body.externalApiId,
    };

  Object.keys(req.body.sanitizeLeagueInput).forEach((key) => {
    if (req.body.sanitizeLeagueInput[key] === undefined) {
      delete req.body.sanitizeLeagueInput[key];
    }
  });
  next();
}


async function syncFromRapidApi(req: Request, res: Response) {
  try {
    const externalLeagues = await fetchLeaguesFromRapidApi();
    let created = 0;
    let updated = 0;

    for (const externalLeague of externalLeagues) {
      const existing = await em.findOne(League, { externalApiId: externalLeague.id });

      if (existing) {
        existing.name = externalLeague.name;
        existing.country = externalLeague.country;
        updated += 1;
        continue;
      }

      em.create(League, {
        name: externalLeague.name,
        country: externalLeague.country,
        externalApiId: externalLeague.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      created += 1;
    }

    await em.flush();

    res.status(200).json({
      message: 'leagues synchronized from rapidapi',
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

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(League, {});
    res.status(200).json({ message: 'found all leagues', data: items });
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

export { sanitizeLeagueInput, findAll, findOne, add, update, remove, syncFromRapidApi };
