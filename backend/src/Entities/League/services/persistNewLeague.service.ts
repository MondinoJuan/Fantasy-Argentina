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

function normalizeCountryInput(country: string): string {
  const trimmed = country.trim().toLowerCase();
  const noDiacritics = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return noDiacritics.replace(/\s+/g, '-');
}

async function getLeagueFromCountryLeagues(country: string, competitionId: number): Promise<UnknownRecord> {
  const payload = asRecord(await requestSportsApiPro('/leagues', {
    country: normalizeCountryInput(country),
    refresh: 'true',
  }));
  const leagues = asArray(asRecord(payload.country).leagues).map((item) => asRecord(item));
  const matched = leagues.find((item) => Number.parseInt(String(item.id ?? ''), 10) === competitionId);

  if (!matched) {
    throw new Error('No se encontró la competición.');
  }

  return matched;
}

export async function persistNewLeagueService(competitionId: number, country = 'argentina') {
  const external = await getLeagueFromCountryLeagues(country, competitionId);

  let league = await em.findOne(League, { idEnApi: competitionId });
  const externalName = String(external.name ?? `League ${competitionId}`).trim();
  const externalCountry = String(country ?? 'Unknown').trim();
  const normalizedSport = '1';

  if (!league) {
    league = em.create(League, {
      name: externalName || `League ${competitionId}`,
      country: externalCountry || 'Unknown',
      sport: normalizedSport,
      idEnApi: competitionId,
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
