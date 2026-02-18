import https from 'node:https';

type UnknownRecord = Record<string, unknown>;

export interface ExternalLeague {
  id: number;
  name: string;
  country: string;
}

const ALLOWED_LEAGUE_IDS = new Set([47, 112, 87, 55, 53, 54]);

export interface SportsApiProLeagueDetail {
  id: number;
  name: string;
  country?: string;
  logo?: string;
  raw: UnknownRecord;
}

class SportsApiProHttpError extends Error {
  statusCode: number | null;
  retryAfterSeconds: number | null;

  constructor(message: string, statusCode: number | null, retryAfterSeconds: number | null) {
    super(message);
    this.name = 'SportsApiProHttpError';
    this.statusCode = statusCode;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function getSportsApiProConfig() {
  const baseUrl = process.env.SPORTSAPIPRO_BASE_URL;
  const apiKeys = [
    process.env.SPORTSAPIPRO_API_KEY1,
    process.env.SPORTSAPIPRO_API_KEY2,
    process.env.SPORTSAPIPRO_API_KEY3,
  ].filter((key): key is string => typeof key === 'string' && key.trim().length > 0);

  if (apiKeys.length === 0) {
    throw new Error('Missing SPORTSAPIPRO_API_KEY1 environment variable');
  }

  if (!baseUrl) {
    throw new Error('Missing SPORTSAPIPRO_BASE_URL environment variable');
  }

  return { apiKeys, baseUrl };
}

function parseRetryAfterHeader(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // API-EXTERNA: llamada HTTP al proveedor SportsApiPro.
    https
      .get(url, { headers }, (response) => {
        const chunks: Uint8Array[] = [];

        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');

          if (!response.statusCode || response.statusCode >= 400) {
            const statusCode = response.statusCode ?? null;
            const retryAfterSeconds = parseRetryAfterHeader(response.headers['retry-after']?.toString());
            return reject(
              new SportsApiProHttpError(
                `SportsApiPro request failed (${statusCode ?? 'unknown'})`,
                statusCode,
                retryAfterSeconds,
              ),
            );
          }

          try {
            resolve(JSON.parse(raw) as unknown);
          } catch {
            reject(new Error('Could not parse SportsApiPro response as JSON'));
          }
        });
      })
      .on('error', reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldFallbackToNextKey(error: unknown): error is SportsApiProHttpError {
  return error instanceof SportsApiProHttpError && error.statusCode === 429;
}

async function getSportsApiPro(path: string, query: Record<string, string | number> = {}) {
  const { apiKeys, baseUrl } = getSportsApiProConfig();
  const url = new URL(path, baseUrl);

  Object.entries(query).forEach(([queryKey, value]) => {
    url.searchParams.set(queryKey, String(value));
  });

  let lastError: unknown;

  for (let index = 0; index < apiKeys.length; index += 1) {
    const apiKey = apiKeys[index];

    try {
      // API-EXTERNA: request genérico al proveedor SportsApiPro.
      return await getJson(url.toString(), {
        Authorization: `Bearer ${apiKey}`,
        'x-api-key': apiKey,
        Accept: 'application/json',
      });
    } catch (error) {
      lastError = error;

      if (!shouldFallbackToNextKey(error) || index === apiKeys.length - 1) {
        throw error;
      }

      if (error.retryAfterSeconds && error.retryAfterSeconds > 0) {
        await sleep(error.retryAfterSeconds * 1000);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unknown SportsApiPro error');
}

function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function findArrayDeep(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'object' || value === null) {
    return [];
  }

  for (const nested of Object.values(value as UnknownRecord)) {
    const result = findArrayDeep(nested);
    if (result.length > 0) {
      return result;
    }
  }

  return [];
}

function findLeagueName(node: UnknownRecord): string {
  return (
    asString(node.league_name) ||
    asString(node.leagueName) ||
    asString(node.name) ||
    asString(node.title)
  );
}

function mapLeagueDetail(node: UnknownRecord): SportsApiProLeagueDetail | null {
  const rawId = node.league_id ?? node.id ?? node.leagueId;
  const id = Number.parseInt(String(rawId ?? '').trim(), 10);
  const name = findLeagueName(node);

  if (Number.isNaN(id) || !name) {
    return null;
  }

  return {
    id,
    name,
    country: asString(node.country_name) || asString(node.country),
    logo: asString(node.logo) || asString(node.league_logo),
    raw: node,
  };
}

export async function fetchLeaguesFromSportsApiPro(): Promise<ExternalLeague[]> {
  const details = await fetchAllowedLeagueDetailsFromSportsApiPro();

  return details.map((league) => ({
    id: league.id,
    name: league.name,
    country: league.country ?? 'Unknown',
  }));
}

export async function fetchPlayerByIdFromSportsApiPro(playerId: number) {
  return getSportsApiPro('/football-get-list-player', { playerid: playerId });
}

export async function fetchPlayersByTeamIdFromSportsApiPro(teamId: number) {
  return getSportsApiPro('/football-get-list-player', { teamid: teamId });
}

export async function fetchTeamsByLeagueIdFromSportsApiPro(leagueId: number) {
  return getSportsApiPro('/football-get-list-all-team', { leagueid: leagueId });
}

export async function fetchTeamDetailByTeamIdFromSportsApiPro(teamId: number) {
  return getSportsApiPro('/football-league-team', { teamid: teamId });
}

export async function fetchAllowedLeagueDetailsFromSportsApiPro(): Promise<SportsApiProLeagueDetail[]> {
  const requests = [...ALLOWED_LEAGUE_IDS].map((leagueId) =>
    getSportsApiPro('/football-get-league-detail', { leagueid: leagueId })
      .then((payload) => ({ leagueId, payload }))
      .catch(() => ({ leagueId, payload: null })),
  );

  const results = await Promise.all(requests);
  const leagues = new Map<number, SportsApiProLeagueDetail>();

  for (const result of results) {
    if (!result.payload) {
      continue;
    }

    const candidates = findArrayDeep(result.payload);
    const mapped = candidates
      .map((item) => mapLeagueDetail(asRecord(item)))
      .filter((item): item is SportsApiProLeagueDetail => item !== null);

    if (mapped.length === 0) {
      leagues.set(result.leagueId, {
        id: result.leagueId,
        name: `League ${result.leagueId}`,
        raw: asRecord(result.payload),
      });
      continue;
    }

    for (const league of mapped) {
      leagues.set(league.id, league);
    }
  }

  return [...leagues.values()];
}
