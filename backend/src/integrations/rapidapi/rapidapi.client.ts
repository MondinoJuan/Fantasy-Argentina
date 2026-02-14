import https from 'node:https';

export interface ExternalLeague {
  id: string;
  name: string;
  country: string;
}

type UnknownRecord = Record<string, unknown>;

function getRapidApiConfig() {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST;
  const baseUrl = process.env.RAPIDAPI_BASE_URL ?? `https://${host}`;
  const leaguesPath = process.env.RAPIDAPI_LEAGUES_PATH ?? '/tournaments/list';

  if (!key) {
    throw new Error('Missing RAPIDAPI_KEY environment variable');
  }

  if (!host) {
    throw new Error('Missing RAPIDAPI_HOST environment variable');
  }

  return { key, host, baseUrl, leaguesPath };
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

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function mapTournamentNode(item: UnknownRecord): ExternalLeague | null {
  const directId = item.id ?? item.tournamentId;
  const directName = getString(item.name) || getString(item.tournamentName);

  const countryNode = (item.category as UnknownRecord | undefined) ?? (item.country as UnknownRecord | undefined);
  const country = getString(countryNode?.name) || getString(item.countryName) || 'Unknown';

  if (directId !== undefined && directName) {
    return {
      id: String(directId),
      name: directName,
      country,
    };
  }

  const uniqueTournament = item.uniqueTournament as UnknownRecord | undefined;
  const uniqueId = uniqueTournament?.id;
  const uniqueName = getString(uniqueTournament?.name);

  if (uniqueId !== undefined && uniqueName) {
    return {
      id: String(uniqueId),
      name: uniqueName,
      country,
    };
  }

  return null;
}

function extractLeagues(payload: unknown): ExternalLeague[] {
  const source = payload as UnknownRecord;

  const candidates = [
    ...getArray(source.data),
    ...getArray(source.tournaments),
    ...getArray(source.events),
  ];

  const mapped = candidates
    .filter((item): item is UnknownRecord => typeof item === 'object' && item !== null)
    .map(mapTournamentNode)
    .filter((item): item is ExternalLeague => item !== null);

  const dedup = new Map<string, ExternalLeague>();
  for (const league of mapped) {
    if (!dedup.has(league.id)) {
      dedup.set(league.id, league);
    }
  }

  return [...dedup.values()];
}

export async function fetchLeaguesFromRapidApi(): Promise<ExternalLeague[]> {
  const { key, host, baseUrl, leaguesPath } = getRapidApiConfig();
  const url = new URL(leaguesPath, baseUrl);

  const payload = await getJson(url.toString(), {
    'x-rapidapi-key': key,
    'x-rapidapi-host': host,
  });

  return extractLeagues(payload);
}
