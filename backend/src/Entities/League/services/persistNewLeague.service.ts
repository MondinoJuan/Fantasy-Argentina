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

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function getLeagueFromCountryLeagues(country: string, competitionId: number): Promise<UnknownRecord> {
  const payload = asRecord(await requestSportsApiPro('/api/leagues', {
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

async function getLeagueFromTournamentInfo(competitionId: number): Promise<UnknownRecord> {
  const payload = asRecord(await requestSportsApiPro(`/api/tournament/${competitionId}/info`));
  const data = asRecord(payload.data);
  const uniqueTournament = asRecord(data.uniqueTournament);

  if (Object.keys(uniqueTournament).length === 0) {
    throw new Error('No se encontró la competición.');
  }

  const category = asRecord(uniqueTournament.category);

  return {
    name: asString(uniqueTournament.name),
    country: asString(category.name) || asString(category.slug) || 'international',
  };
}

export async function persistNewLeagueService(
  competitionId: number,
  country?: string | null,
  options?: {
    limiteMin?: number | null;
    limiteMax?: number | null;
    kncokoutStage?: boolean;
    competitionFormat?: 'league_only' | 'knockout_only' | 'mixed';
    hasGroups?: boolean;
    hasTwoLegKnockout?: boolean;
  },
) {
  const normalizedCountry = typeof country === 'string' ? country.trim() : '';
  const hasCountry = normalizedCountry.length > 0;
  const external = hasCountry
    ? await getLeagueFromCountryLeagues(normalizedCountry, competitionId)
    : await getLeagueFromTournamentInfo(competitionId);

  let league = await em.findOne(League, { idEnApi: competitionId });
  const externalName = String(external.name ?? `League ${competitionId}`).trim();
  const externalCountry = hasCountry
    ? normalizedCountry
    : asString(external.country) || 'international';
  const normalizedSport = '1';

  if (!league) {
    league = em.create(League, {
      competitionFormat: options?.competitionFormat ?? 'league_only',
      hasGroups: options?.hasGroups ?? false,
      hasTwoLegKnockout: options?.hasTwoLegKnockout ?? false,
      name: externalName || `League ${competitionId}`,
      country: externalCountry || 'Unknown',
      sport: normalizedSport,
      idEnApi: competitionId,
      knockoutStage: false,
      limiteMin: null,
      limiteMax: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    if (options?.competitionFormat) {
      league.competitionFormat = options.competitionFormat;
    }
    if (typeof options?.hasGroups === 'boolean') {
      league.hasGroups = options.hasGroups;
    }
    if (typeof options?.hasTwoLegKnockout === 'boolean') {
      league.hasTwoLegKnockout = options.hasTwoLegKnockout;
    }
    league.name = externalName || league.name;
    league.country = externalCountry || league.country;
    league.sport = normalizedSport;
  }

  if (typeof options?.kncokoutStage === 'boolean') {
    league.knockoutStage = options.kncokoutStage;
  }

  if (typeof options?.limiteMin === 'number' && Number.isFinite(options.limiteMin)) {
    league.limiteMin = options.limiteMin;
  }

  if (typeof options?.limiteMax === 'number' && Number.isFinite(options.limiteMax)) {
    league.limiteMax = options.limiteMax;
  }

  await em.flush();

  if (typeof league.id !== 'number') {
    throw new Error('Could not persist league id');
  }

  return {
    league,
  };
}
