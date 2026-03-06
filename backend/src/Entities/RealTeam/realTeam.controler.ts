import { Request, Response, NextFunction } from 'express';
import { RealTeam } from './realTeam.entity.js';
import { orm } from '../../shared/db/orm.js';
import { League } from '../League/league.entity.js';
import { getSportsApiProTeamsByLeagueService } from '../ExternalApi/services/index.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeRealTeamInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeRealTeamInput = {
        name: req.body.name,
    league: req.body.league ?? req.body.leagueId,
    idEnApi: req.body.idEnApi,
    };

  Object.keys(req.body.sanitizeRealTeamInput).forEach((key) => {
    if (req.body.sanitizeRealTeamInput[key] === undefined) {
      delete req.body.sanitizeRealTeamInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(RealTeam, {}, { populate: ['league'] });
    res.status(200).json({ message: 'found all real teams', data: items });
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

    const item = await em.findOneOrFail(RealTeam, { idEnApi }, { populate: ['league'] });
    res.status(200).json({ message: 'found real team by idEnApi', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(RealTeam, { id }, { populate: ['league'] });
    res.status(200).json({ message: 'found real team', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(RealTeam, req.body.sanitizeRealTeamInput);
    await em.flush();
    res.status(201).json({ message: 'real team created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(RealTeam, id);
    em.assign(itemToUpdate, req.body.sanitizeRealTeamInput);
    await em.flush();
    res.status(200).json({ message: 'real team updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(RealTeam, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'real team deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}



function extractTeamRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const candidates = ['result', 'data', 'teams', 'response'];
  for (const key of candidates) {
    if (Array.isArray((payload as any)[key])) return (payload as any)[key];
  }

  for (const value of Object.values(payload)) {
    const nested = extractTeamRows(value);
    if (nested.length) return nested;
  }

  return [];
}

async function syncByLeagueIdEnApi(req: Request, res: Response) {
  try {
    const leagueIdEnApi = Number.parseInt(String(req.body?.leagueIdEnApi ?? ''), 10);
    if (!Number.isFinite(leagueIdEnApi)) {
      res.status(400).json({ message: 'leagueIdEnApi is required number' });
      return;
    }

    const league = await em.findOne(League, { idEnApi: leagueIdEnApi });
    if (!league) {
      res.status(404).json({ message: 'league not found locally. Sync league first.' });
      return;
    }

    const payload = await getSportsApiProTeamsByLeagueService(leagueIdEnApi);
    const rows = extractTeamRows(payload);

    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const idEnApi = Number.parseInt(String(row?.team_id ?? row?.id ?? row?.teamId ?? ''), 10);
      if (!Number.isFinite(idEnApi)) continue;

      const name = String(row?.team_name ?? row?.name ?? row?.teamName ?? `Team ${idEnApi}`);
      const existing = await em.findOne(RealTeam, { idEnApi });
      if (existing) {
        existing.name = name;
        existing.league = league;
        updated += 1;
        continue;
      }

      em.create(RealTeam, { idEnApi, name, league } as any);
      created += 1;
    }

    await em.flush();
    res.status(200).json({ message: 'real teams synced by league', data: { rows: rows.length, created, updated } });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
export { sanitizeRealTeamInput, findAll, findByIdEnApi, findOne, add, update, remove, syncByLeagueIdEnApi };
