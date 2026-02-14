import https from 'node:https';

type UnknownRecord = Record<string, unknown>;

export interface ExternalLeague {
  id: string;
  name: string;
  country: string;
}

const ALLOWED_LEAGUE_IDS = new Set([47, 112, 87, 55, 53, 54]);

export interface RapidApiLeagueDetail {
  id: string;
  name: string;
  country?: string;
  logo?: string;
  raw: UnknownRecord;
}

function getRapidApiConfig() {
  const key = process.env.RAPIDAPI_FREEFOOTBALL_KEY;
  const host = process.env.RAPIDAPI_FREEFOOTBALL_HOST ?? 'free-api-live-football-data.p.rapidapi.com';
  const baseUrl = process.env.FOOTBALL_FREEFOOTBALL_API_BASE ?? `https://${host}`;

  if (!key) {
    throw new Error('Missing RAPIDAPI_FREEFOOTBALL_KEY environment variable');
  }

  return { key, host, baseUrl };
}

function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // API-EXTERNA: llamada HTTP a RapidAPI.
    https
      .get(url, { headers }, (response) => {
        const chunks: Uint8Array[] = [];

        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');

          if (!response.statusCode || response.statusCode >= 400) {
            return reject(new Error(`RapidAPI request failed (${response.statusCode ?? 'unknown'})`));
          }

          try {
            resolve(JSON.parse(raw) as unknown);
          } catch {
            reject(new Error('Could not parse RapidAPI response as JSON'));
          }
        });
      })
      .on('error', reject);
  });
}

async function getRapidApi(path: string, query: Record<string, string | number> = {}) {
  const { key, host, baseUrl } = getRapidApiConfig();
  const url = new URL(path, baseUrl);

  Object.entries(query).forEach(([queryKey, value]) => {
    url.searchParams.set(queryKey, String(value));
  });

  // API-EXTERNA: request genérico al proveedor RapidAPI.
  return getJson(url.toString(), {
    'x-rapidapi-key': key,
    'x-rapidapi-host': host,
  });
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

function mapLeagueDetail(node: UnknownRecord): RapidApiLeagueDetail | null {
  const rawId = node.league_id ?? node.id ?? node.leagueId;
  const id = String(rawId ?? '').trim();
  const name = findLeagueName(node);

  if (!id || !name) {
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

export async function fetchLeaguesFromRapidApi(): Promise<ExternalLeague[]> {
  const details = await fetchAllowedLeagueDetailsFromRapidApi();

  return details.map((league) => ({
    id: league.id,
    name: league.name,
    country: league.country ?? 'Unknown',
  }));
}

export async function fetchPlayerByIdFromRapidApi(playerId: number) {
  return getRapidApi('/football-get-list-player', { playerid: playerId });
}

export async function fetchPlayersByTeamIdFromRapidApi(teamId: number) {
  return getRapidApi('/football-get-list-player', { teamid: teamId });
}

export async function fetchTeamsByLeagueIdFromRapidApi(leagueId: number) {
  return getRapidApi('/football-get-list-all-team', { leagueid: leagueId });
}

export async function fetchTeamDetailByTeamIdFromRapidApi(teamId: number) {
  return getRapidApi('/football-league-team', { teamid: teamId });
}

export async function fetchAllowedLeagueDetailsFromRapidApi(): Promise<RapidApiLeagueDetail[]> {
  const requests = [...ALLOWED_LEAGUE_IDS].map((leagueId) =>
    getRapidApi('/football-get-league-detail', { leagueid: leagueId })
      .then((payload) => ({ leagueId, payload }))
      .catch(() => ({ leagueId, payload: null })),
  );

  const results = await Promise.all(requests);
  const leagues = new Map<string, RapidApiLeagueDetail>();

  for (const result of results) {
    if (!result.payload) {
      continue;
    }

    const candidates = findArrayDeep(result.payload);
    const mapped = candidates
      .map((item) => mapLeagueDetail(asRecord(item)))
      .filter((item): item is RapidApiLeagueDetail => item !== null);

    if (mapped.length === 0) {
      leagues.set(String(result.leagueId), {
        id: String(result.leagueId),
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
