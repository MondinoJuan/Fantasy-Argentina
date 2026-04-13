import { Request, Response, NextFunction } from 'express';
import { RealTeam } from './realTeam.entity.js';
import { orm } from '../../shared/db/orm.js';
import { League } from '../League/league.entity.js';
import { requestSportsApiPro } from '../../integrations/sportsapipro/sportsapipro.client.js';
import { ensureLeagueParticipation } from '../RealTeamLeagueParticipation/realTeamLeagueParticipation.service.js';

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
    await ensureLeagueParticipation(em, item, item.league as League);
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
    if (req.body.sanitizeRealTeamInput.league !== undefined) {
      await ensureLeagueParticipation(em, itemToUpdate, itemToUpdate.league as League);
    }
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



type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseSeasonId(payload: UnknownRecord): number {
  const seasonsNode = payload.seasons ?? payload.data ?? payload;
  const seasons = asArray(seasonsNode).map((item) => asRecord(item));

  if (!Array.isArray(seasonsNode) || seasons.length === 0) {
    throw new Error('No pude interpretar la respuesta de seasons.');
  }

  for (const season of seasons) {
    if (season.current === true || season.active === true) {
      const id = Number.parseInt(String(season.id ?? ''), 10);
      if (Number.isFinite(id)) return id;
    }
  }

  const fallbackId = Number.parseInt(String(seasons[0]?.id ?? ''), 10);
  if (Number.isFinite(fallbackId)) return fallbackId;

  throw new Error('No encontré un seasonId válido.');
}

function extractUniqueTeams(rawData: UnknownRecord): Array<{ teamId: number; name: string }> {
  const tournamentTeamEvents = asRecord(asRecord(rawData.data).tournamentTeamEvents);
  if (Object.keys(tournamentTeamEvents).length === 0) {
    throw new Error("No encontré data['tournamentTeamEvents'].");
  }

  const teams = new Map<number, string>();

  for (const teamsBlockRaw of Object.values(tournamentTeamEvents)) {
    const teamsBlock = asRecord(teamsBlockRaw);

    for (const [teamIdStr, eventsRaw] of Object.entries(teamsBlock)) {
      const expectedTeamId = Number.parseInt(String(teamIdStr), 10);
      if (!Number.isFinite(expectedTeamId)) continue;

      const events = asArray(eventsRaw).map((event) => asRecord(event));

      for (const event of events) {
        const home = asRecord(event.homeTeam);
        const away = asRecord(event.awayTeam);

        const homeId = Number.parseInt(String(home.id ?? ''), 10);
        const awayId = Number.parseInt(String(away.id ?? ''), 10);

        if (homeId === expectedTeamId) {
          const name = String(home.name ?? home.shortName ?? '').trim();
          if (name) teams.set(expectedTeamId, name);
          break;
        }

        if (awayId === expectedTeamId) {
          const name = String(away.name ?? away.shortName ?? '').trim();
          if (name) teams.set(expectedTeamId, name);
          break;
        }
      }
    }
  }

  return [...teams.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([teamId, name]) => ({ teamId, name }))
    .filter((team) => Boolean(team.name));
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

    const seasonsPayload = asRecord(await requestSportsApiPro(`/api/tournaments/${leagueIdEnApi}/seasons`));
    const seasonId = parseSeasonId(seasonsPayload);

    const rawTeamEvents = asRecord(await requestSportsApiPro(
      `/api/tournament/${leagueIdEnApi}/season/${seasonId}/team-events`,
      { type: 'total' },
    ));
    const teams = extractUniqueTeams(rawTeamEvents);

    let created = 0;
    let updated = 0;

    for (const team of teams) {
      const idEnApi = team.teamId;
      const name = team.name;
      const existing = await em.findOne(RealTeam, { idEnApi });
      if (existing) {
        existing.name = name;
        await ensureLeagueParticipation(em, existing, league);
        updated += 1;
        continue;
      }

      const createdTeam = em.create(RealTeam, { idEnApi, name, league } as any);
      await ensureLeagueParticipation(em, createdTeam, league);
      created += 1;
    }

    await em.flush();
    res.status(200).json({
      message: 'real teams synced by league',
      data: {
        success: true,
        tournamentId: leagueIdEnApi,
        seasonId,
        totalTeams: teams.length,
        teams,
        created,
        updated,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
export { sanitizeRealTeamInput, findAll, findByIdEnApi, findOne, add, update, remove, syncByLeagueIdEnApi };
