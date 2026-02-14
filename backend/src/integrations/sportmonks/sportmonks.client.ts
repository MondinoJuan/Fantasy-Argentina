import https from 'node:https';

export interface ExternalLeague {
  id: string;
  name: string;
  country: string;
}

interface SportmonksLeagueRaw {
  id?: number | string;
  name?: string;
  country_name?: string;
  country?: {
    name?: string;
  };
}

interface SportmonksLeaguesResponse {
  data?: SportmonksLeagueRaw[];
}

function getSportmonksConfig() {
  const token = process.env.SPORTMONKS_API_TOKEN;
  const baseUrl = process.env.SPORTMONKS_BASE_URL ?? 'https://api.sportmonks.com/v3/football';

  if (!token) {
    throw new Error('Missing SPORTMONKS_API_TOKEN environment variable');
  }

  return { token, baseUrl };
}

function mapLeague(raw: SportmonksLeagueRaw): ExternalLeague | null {
  const id = raw.id !== undefined ? String(raw.id) : '';
  const name = raw.name?.trim() ?? '';
  const country = raw.country_name?.trim() ?? raw.country?.name?.trim() ?? '';

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    country: country || 'Unknown',
  };
}

function getJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        const chunks: Uint8Array[] = [];

        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');

          if (!response.statusCode || response.statusCode >= 400) {
            return reject(new Error(`Sportmonks request failed (${response.statusCode ?? 'unknown'})`));
          }

          try {
            resolve(JSON.parse(raw) as T);
          } catch {
            reject(new Error('Could not parse Sportmonks response as JSON'));
          }
        });
      })
      .on('error', reject);
  });
}

export async function fetchLeaguesFromSportmonks(): Promise<ExternalLeague[]> {
  const { token, baseUrl } = getSportmonksConfig();
  const leaguesUrl = new URL('/leagues', baseUrl);
  leaguesUrl.searchParams.set('api_token', token);

  const payload = await getJson<SportmonksLeaguesResponse>(leaguesUrl.toString());

  return (payload.data ?? [])
    .map(mapLeague)
    .filter((league): league is ExternalLeague => league !== null);
}
