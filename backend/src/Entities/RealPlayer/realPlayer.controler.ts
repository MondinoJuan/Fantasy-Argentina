import { Request, Response, NextFunction } from 'express';
import { RealPlayer } from './realPlayer.entity.js';
import { orm } from '../../shared/db/orm.js';
import { RealTeam } from '../RealTeam/realTeam.entity.js';
import { requestSportsApiPro } from '../../integrations/sportsapipro/sportsapipro.client.js';
import { PLAYER_POSITIONS, isEnumValue } from '../../shared/domain-enums.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function parseOptionalBodyNumber(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeRealPlayerInput(req: Request, res: Response, next: NextFunction) {
  const sanitizedValue = req.body.value === undefined ? undefined : toNumber(req.body.value);
  const sanitizedValueCurrency = req.body.valueCurrency === undefined
    ? undefined
    : normalizeCurrencyCode(req.body.valueCurrency);

  req.body.sanitizeRealPlayerInput = {
    idEnApi: req.body.idEnApi,
    name: req.body.name,
    position: req.body.position,
    realTeam: req.body.realTeam ?? req.body.realTeamId,
    valueCurrency: sanitizedValueCurrency,
    value: sanitizedValue,
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



type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const normalized = value.replace(/[,\s]/g, '');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizePosition(positionRaw: unknown): "goalkeeper" | "defender" | "midfielder" | "forward" {
  const value = String(positionRaw ?? '').trim().toLowerCase();
  if (value === 'gk' || value === 'g') return 'goalkeeper';
  if (value === 'd' || value === 'df') return 'defender';
  if (value === 'm' || value === 'mf') return 'midfielder';
  if (value === 'f' || value === 'fw') return 'forward';
  if (value.includes('goal') || value.includes('keeper') || value.includes('gk')) return 'goalkeeper';
  if (value.includes('def') || value.includes('back')) return 'defender';
  if (value.includes('mid')) return 'midfielder';
  if (value.includes('for') || value.includes('att') || value.includes('strik') || value.includes('wing')) return 'forward';
  return 'midfielder';
}

function readAthleteId(row: UnknownRecord): number | null {
  const player = asRecord(row.player);
  return toInt(
    player.id
    ?? row.id
    ?? row.athleteId
    ?? row.playerId
    ?? row.player_id
    ?? row.athlete_id
    ?? row.player_key,
  );
}

function readPlayerName(row: UnknownRecord, athleteId: number): string {
  const player = asRecord(row.player);
  return String(
    player.name
    ?? row.name
    ?? row.player_name
    ?? row.playerName
    ?? row.athleteName
    ?? row.athlete_name
    ?? `Player ${athleteId}`,
  ).trim();
}

function readPlayerValueCurrency(row: UnknownRecord): string | null {
  const player = asRecord(row.player);
  const marketValue = asRecord(row.marketValue);
  const proposedMarketValueRaw = asRecord(player.proposedMarketValueRaw);
  return normalizeCurrencyCode(
    proposedMarketValueRaw.currency
    ?? player.currency
    ?? player.marketValueCurrency
    ?? player.valueCurrency
    ?? row.valueCurrency
    ?? row.currency
    ?? row.marketValueCurrency
    ?? row.value_currency
    ?? marketValue.currency
    ?? marketValue.currencyCode,
  );
}

function readPlayerValue(row: UnknownRecord): number | null {
  const player = asRecord(row.player);
  const marketValue = asRecord(row.marketValue);
  const proposedMarketValueRaw = asRecord(player.proposedMarketValueRaw);
  return toNumber(
    proposedMarketValueRaw.value
    ?? player.proposedMarketValue
    ?? player.value
    ?? player.marketValue
    ?? row.value
    ?? row.marketValue
    ?? row.market_value
    ?? row.price
    ?? row.marketPrice
    ?? marketValue.value
    ?? marketValue.amount,
  );
}

function readPlayerPosition(row: UnknownRecord): "goalkeeper" | "defender" | "midfielder" | "forward" {
  const player = asRecord(row.player);
  const positionRecord = asRecord(row.position);
  return normalizePosition(
    player.position
    ?? positionRecord.name
    ?? row.position
    ?? row.position_name
    ?? row.positionText
    ?? row.player_type,
  );
}

function extractPlayersRows(payload: unknown): UnknownRecord[] {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const players = Array.isArray(data.players) ? data.players : [];
  return players
    .map((item) => asRecord(item))
    .filter((item) => toInt(readAthleteId(item)) !== null);
}

async function syncPlayersForTeam(team: RealTeam) {
  const payload = await requestSportsApiPro(`/api/teams/${team.idEnApi}/players`);
  const rows = extractPlayersRows(payload);
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const athleteId = readAthleteId(row);
    if (athleteId === null) continue;

    const idEnApi = athleteId;

    const name = readPlayerName(row, athleteId);
    const position = readPlayerPosition(row);
    const valueCurrency = readPlayerValueCurrency(row);
    const value = readPlayerValue(row);

    const existing = await em.findOne(RealPlayer, { idEnApi });
    if (existing) {
      existing.name = name;
      existing.position = position;
      existing.realTeam = team;
      existing.valueCurrency = valueCurrency;
      existing.value = value;
      existing.active = true;
      existing.lastUpdate = new Date();
      updated += 1;
      continue;
    }

    em.create(RealPlayer, {
      idEnApi,
      name,
      position,
      realTeam: team,
      valueCurrency,
      value,
      active: true,
      lastUpdate: new Date(),
    } as any);
    created += 1;
  }

  return { rows: rows.length, created, updated, teamIdEnApi: team.idEnApi, teamName: team.name };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let index = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      out[current] = await mapper(items[current]);
    }
  });

  await Promise.all(workers);
  return out;
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
      const sampleTeams = await em.find(RealTeam, {}, { fields: ['idEnApi', 'name'], limit: 15, orderBy: { id: 'asc' } as any });
      res.status(404).json({
        message: 'real team not found locally',
        hint: 'Verificá que el Team ID en API sea correcto y que el equipo esté sincronizado localmente.',
        sampleLocalTeams: sampleTeams.map((item: any) => ({ idEnApi: item.idEnApi, name: item.name })),
      });
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
    const leagueId = parseOptionalBodyNumber(req.body?.leagueId);
    const leagueIdEnApi = parseOptionalBodyNumber(req.body?.leagueIdEnApi);

    if (leagueId === null && leagueIdEnApi === null) {
      res.status(400).json({ message: 'leagueId or leagueIdEnApi is required number' });
      return;
    }

    const whereClause = leagueId !== null ? { league: { id: leagueId } } : { league: { idEnApi: leagueIdEnApi! } };
    const teams = await em.find(RealTeam, whereClause as any, { populate: ['league'] });

    if (teams.length === 0) {
      res.status(404).json({
        message: 'no local teams found for league. Sync teams first.',
        filters: { leagueId, leagueIdEnApi },
      });
      return;
    }

    const perTeamStats = await mapWithConcurrency(teams, 6, async (team) => syncPlayersForTeam(team));
    const rows = perTeamStats.reduce((acc, item) => acc + item.rows, 0);
    const created = perTeamStats.reduce((acc, item) => acc + item.created, 0);
    const updated = perTeamStats.reduce((acc, item) => acc + item.updated, 0);

    await em.flush();
    res.status(200).json({
      message: 'real players synced by league',
      data: {
        leagueId,
        leagueIdEnApi,
        teams: teams.length,
        rows,
        created,
        updated,
        teamsProcessed: perTeamStats,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
export { sanitizeRealPlayerInput, findAll, findByIdEnApi, findOne, add, update, remove, syncByLeagueIdEnApi, syncTeamSquadByTeamIdEnApi };
