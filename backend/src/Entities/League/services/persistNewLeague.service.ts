import { orm } from '../../../shared/db/orm.js';
import { League } from '../league.entity.js';
import { requestSportsApiPro } from '../../../integrations/sportsapipro/sportsapipro.client.js';

const em = orm.em;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function findFirstArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];

  for (const nested of Object.values(value as UnknownRecord)) {
    const found = findFirstArray(nested);
    if (found.length > 0) return found;
  }

  return [];
}

function readCountryFromTournament(row: UnknownRecord): string {
  const category = asRecord(row.category);
  const country = asRecord(category.country);

  return String(
    row.countryName
    ?? row.country
    ?? category.name
    ?? country.name
    ?? '',
  ).trim().toLowerCase();
}

async function getLeagueFromCountryLeagues(country: string, competitionId: number): Promise<UnknownRecord> {
  const payload = asRecord(await requestSportsApiPro('/tournaments', { refresh: 'true' }));
  const tournaments = findFirstArray(payload).map((item) => asRecord(item));

  const matched = tournaments.find((item) => {
    const id = Number.parseInt(String(item.id ?? ''), 10);
    const tournamentCountry = readCountryFromTournament(item);
    return id === competitionId && (!country || tournamentCountry === country);
  });

  if (!matched) {
    throw new Error(`No encontré competitionId=${competitionId} en /tournaments para country=${country}`);
  }

  return matched;
}

export async function persistNewLeagueService(sportId: number, competitionId: number, country = 'argentina') {
  const external = await getLeagueFromCountryLeagues(country, competitionId);

  let league = await em.findOne(League, { idEnApi: competitionId });
  const externalName = String(external.name ?? `League ${competitionId}`).trim();
  const externalCountry = String(
    external.countryName
    ?? external.country
    ?? asRecord(external.category).name
    ?? asRecord(asRecord(external.category).country).name
    ?? country
    ?? 'Unknown',
  ).trim();
  const normalizedSport = String(sportId || 1);

  if (!league) {
    league = em.create(League, {
      name: externalName || `League ${competitionId}`,
      country: externalCountry || 'Unknown',
      sport: normalizedSport,
      idEnApi: competitionId,
      seasonNum: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    league.name = externalName || league.name;
    league.country = externalCountry || league.country;
    league.sport = normalizedSport;
  }

  await em.flush();

  if (typeof league.id !== 'number') {
    throw new Error('Could not persist league id');
  }

  return {
    league,
  };
}
