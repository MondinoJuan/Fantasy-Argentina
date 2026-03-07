import { Request, Response, NextFunction } from 'express';
import { RealPlayer } from './realPlayer.entity.js';
import { orm } from '../../shared/db/orm.js';
import { RealTeam } from '../RealTeam/realTeam.entity.js';
import { getSportsApiProPlayersByTeamService } from '../ExternalApi/services/index.js';
import { PLAYER_POSITIONS, isEnumValue } from '../../shared/domain-enums.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeRealPlayerInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeRealPlayerInput = {
        idEnApi: req.body.idEnApi,
    name: req.body.name,
    position: req.body.position,
    realTeam: req.body.realTeam ?? req.body.realTeamId,
    active: req.body.active,
    };

  Object.keys(req.body.sanitizeRealPlayerInput).forEach((key) => {
    if (req.body.sanitizeRealPlayerInput[key] === undefined) {
      delete req.body.sanitizeRealPlayerInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(RealPlayer, {}, { populate: ['realTeam'] });
    res.status(200).json({ message: 'found all real players', data: items });
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

    const item = await em.findOneOrFail(RealPlayer, { idEnApi }, { populate: ['realTeam'] });
    res.status(200).json({ message: 'found real player by idEnApi', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(RealPlayer, { id }, { populate: ['realTeam'] });
    res.status(200).json({ message: 'found real player', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    if (req.body.sanitizeRealPlayerInput.position !== undefined && !isEnumValue(PLAYER_POSITIONS, req.body.sanitizeRealPlayerInput.position)) {
      res.status(400).json({ message: `position must be one of: ${PLAYER_POSITIONS.join(', ')}` });
      return;
    }

    const item = em.create(RealPlayer, req.body.sanitizeRealPlayerInput);
    await em.flush();
    res.status(201).json({ message: 'real player created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(RealPlayer, id);

    if (req.body.sanitizeRealPlayerInput.position !== undefined && !isEnumValue(PLAYER_POSITIONS, req.body.sanitizeRealPlayerInput.position)) {
      res.status(400).json({ message: `position must be one of: ${PLAYER_POSITIONS.join(', ')}` });
      return;
    }

    em.assign(itemToUpdate, req.body.sanitizeRealPlayerInput);
    await em.flush();
    res.status(200).json({ message: 'real player updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(RealPlayer, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'real player deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}



function extractPlayerRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const keys = ['result', 'data', 'players', 'athletes', 'response'];
  for (const key of keys) {
    if (Array.isArray((payload as any)[key])) return (payload as any)[key];
  }

  for (const value of Object.values(payload)) {
    const nested = extractPlayerRows(value);
    if (nested.length) return nested;
  }

  return [];
}

function normalizePosition(positionRaw: unknown): "goalkeeper" | "defender" | "midfielder" | "forward" {
  const value = String(positionRaw ?? '').toLowerCase();
  if (value.includes('goal')) return 'goalkeeper';
  if (value.includes('def')) return 'defender';
  if (value.includes('mid')) return 'midfielder';
  if (value.includes('for') || value.includes('att') || value.includes('strik')) return 'forward';
  return 'midfielder';
}

async function syncPlayersForTeam(team: RealTeam) {
  const payload = await getSportsApiProPlayersByTeamService(team.idEnApi);
  const rows = extractPlayerRows(payload);
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const idEnApi = Number.parseInt(String(row?.player_id ?? row?.athleteId ?? row?.id ?? ''), 10);
    if (!Number.isFinite(idEnApi)) continue;

    const name = String(row?.player_name ?? row?.name ?? row?.athleteName ?? `Player ${idEnApi}`);
    const position = normalizePosition(row?.position ?? row?.position_name ?? row?.positionText);

    const existing = await em.findOne(RealPlayer, { idEnApi });
    if (existing) {
      existing.name = name;
      existing.position = position;
      existing.realTeam = team;
      existing.active = true;
      existing.lastUpdate = new Date();
      updated += 1;
      continue;
    }

    em.create(RealPlayer, { idEnApi, name, position, realTeam: team, active: true, lastUpdate: new Date() } as any);
    created += 1;
  }

  return { rows: rows.length, created, updated };
}

async function syncTeamSquadByTeamIdEnApi(req: Request, res: Response) {
  try {
    const teamIdEnApi = Number.parseInt(String(req.body?.teamIdEnApi ?? ''), 10);
    if (!Number.isFinite(teamIdEnApi)) {
      res.status(400).json({ message: 'teamIdEnApi is required number' });
      return;
    }

    const team = await em.findOne(RealTeam, { idEnApi: teamIdEnApi });
    if (!team) {
      res.status(404).json({ message: 'real team not found locally' });
      return;
    }

    const stats = await syncPlayersForTeam(team);
    await em.flush();
    res.status(200).json({ message: 'team squad synced', data: stats });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function syncByLeagueIdEnApi(req: Request, res: Response) {
  try {
    const leagueIdEnApi = Number.parseInt(String(req.body?.leagueIdEnApi ?? ''), 10);
    if (!Number.isFinite(leagueIdEnApi)) {
      res.status(400).json({ message: 'leagueIdEnApi is required number' });
      return;
    }

    const teams = await em.find(RealTeam, { league: { idEnApi: leagueIdEnApi } });
    if (teams.length === 0) {
      res.status(404).json({ message: 'no local teams found for league. Sync teams first.' });
      return;
    }

    let rows = 0;
    let created = 0;
    let updated = 0;

    for (const team of teams) {
      const teamStats = await syncPlayersForTeam(team);
      rows += teamStats.rows;
      created += teamStats.created;
      updated += teamStats.updated;
    }

    await em.flush();
    res.status(200).json({ message: 'real players synced by league', data: { teams: teams.length, rows, created, updated } });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
export { sanitizeRealPlayerInput, findAll, findByIdEnApi, findOne, add, update, remove, syncByLeagueIdEnApi, syncTeamSquadByTeamIdEnApi };
