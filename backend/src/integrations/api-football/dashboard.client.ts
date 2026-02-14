import https from 'node:https';

interface ApiFootballResponse<T> {
  response?: T;
  paging?: {
    current?: number;
    total?: number;
  };
}

type UnknownRecord = Record<string, unknown>;

export interface DashboardLeague {
  id: string;
  name: string;
  country: string;
}

export interface DashboardTeam {
  id: string;
  name: string;
}

export interface DashboardPlayer {
  id: string;
  name: string;
  position: string;
}

export interface DashboardPlayerRating {
  playerId: string;
  fixtureId: string;
  rating: number | null;
  playerName?: string;
  teamName?: string;
}

function getDashboardConfig() {
  const baseUrl = process.env.DASHBOARD_BASE_URL;
  const apiKey = process.env.DASHBOARD_API_KEY;

  if (!baseUrl) {
    throw new Error('Missing DASHBOARD_BASE_URL environment variable');
  }

  if (!apiKey) {
    throw new Error('Missing DASHBOARD_API_KEY environment variable');
  }

  return { baseUrl, apiKey };
}

function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (response) => {
        const chunks: Uint8Array[] = [];

        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');

          if (!response.statusCode || response.statusCode >= 400) {
            return reject(new Error(`API-Football request failed (${response.statusCode ?? 'unknown'})`));
          }

          try {
            resolve(JSON.parse(raw) as unknown);
          } catch {
            reject(new Error('Could not parse API-Football response as JSON'));
          }
        });
      })
      .on('error', reject);
  });
}

async function getApiFootball<T>(path: string, query: Record<string, string | number> = {}): Promise<ApiFootballResponse<T>> {
  const { baseUrl, apiKey } = getDashboardConfig();
  const url = new URL(path, baseUrl);

  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const payload = await getJson(url.toString(), {
    'x-apisports-key': apiKey,
  });

  return payload as ApiFootballResponse<T>;
}

function asRecord(item: unknown): UnknownRecord {
  return typeof item === 'object' && item !== null ? (item as UnknownRecord) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function fetchLeaguesFromDashboard(): Promise<DashboardLeague[]> {
  const payload = await getApiFootball<unknown[]>('/leagues');

  return (payload.response ?? []).map((node) => {
    const item = asRecord(node);
    const league = asRecord(item.league);
    const country = asRecord(item.country);

    return {
      id: String(league.id ?? ''),
      name: asString(league.name),
      country: asString(country.name) || 'Unknown',
    };
  }).filter((league) => league.id && league.name);
}

export async function fetchSeasonsFromDashboard(): Promise<number[]> {
  const payload = await getApiFootball<number[]>('/leagues/seasons');
  return (payload.response ?? []).filter((season): season is number => Number.isInteger(season));
}

export async function fetchTeamsFromDashboard(leagueId: number, season: number): Promise<DashboardTeam[]> {
  const payload = await getApiFootball<unknown[]>('/teams', { league: leagueId, season });

  return (payload.response ?? []).map((node) => {
    const teamNode = asRecord(asRecord(node).team);

    return {
      id: String(teamNode.id ?? ''),
      name: asString(teamNode.name),
    };
  }).filter((team) => team.id && team.name);
}

export async function fetchPlayersFromDashboard(teamId: number, season: number): Promise<DashboardPlayer[]> {
  const players = new Map<string, DashboardPlayer>();
  let page = 1;
  let totalPages = 1;

  do {
    const payload = await getApiFootball<unknown[]>('/players', { team: teamId, season, page });
    const entries = payload.response ?? [];

    for (const entry of entries) {
      const item = asRecord(entry);
      const playerNode = asRecord(item.player);
      const statistics = Array.isArray(item.statistics) ? item.statistics : [];
      const firstStat = statistics.length > 0 ? asRecord(statistics[0]) : {};
      const games = asRecord(firstStat.games);

      const id = String(playerNode.id ?? '');
      const name = asString(playerNode.name);
      const position = asString(games.position) || 'Unknown';

      if (id && name && !players.has(id)) {
        players.set(id, { id, name, position });
      }
    }

    totalPages = payload.paging?.total ?? 1;
    page += 1;
  } while (page <= totalPages && page <= 20);

  return [...players.values()];
}

export async function fetchPlayerRatingFromDashboard(fixtureId: number, playerId: number): Promise<DashboardPlayerRating | null> {
  const payload = await getApiFootball<unknown[]>('/fixtures/players', { fixture: fixtureId });

  for (const teamEntry of payload.response ?? []) {
    const teamNode = asRecord(teamEntry);
    const team = asRecord(teamNode.team);
    const players = Array.isArray(teamNode.players) ? teamNode.players : [];

    for (const playerEntry of players) {
      const playerObj = asRecord(playerEntry);
      const player = asRecord(playerObj.player);

      if (Number(player.id) !== playerId) {
        continue;
      }

      const statistics = Array.isArray(playerObj.statistics) ? playerObj.statistics : [];
      const firstStat = statistics.length > 0 ? asRecord(statistics[0]) : {};
      const games = asRecord(firstStat.games);
      const rawRating = asString(games.rating);

      return {
        fixtureId: String(fixtureId),
        playerId: String(playerId),
        rating: rawRating ? Number(rawRating) : null,
        playerName: asString(player.name),
        teamName: asString(team.name),
      };
    }
  }

  return null;
}
