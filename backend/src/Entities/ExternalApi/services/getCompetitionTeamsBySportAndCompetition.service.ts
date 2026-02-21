import { getSportsApiProApiKeys, requestSportsApiPro } from '../../../integrations/sportsapipro/sportsapipro.client.js';

type UnknownRecord = Record<string, unknown>;

interface CompetitionTeamsResult {
  competitionId: number;
  competitionName: string | null;
  countryName: string | null;
  seasonNum: number | null;
  stageNum: number | null;
  teams: Array<{ id: number; name: string | null }>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

async function getCompetitionMeta(sportId: number, competitionId: number): Promise<UnknownRecord> {
  const payload = (await requestSportsApiPro('/competitions', { sports: sportId })) as UnknownRecord;
  const competitions = asArray(payload.competitions);

  const competition = competitions.find((item) => {
    const record = asRecord(item);
    return toInt(record.id) === competitionId;
  });

  if (!competition) {
    throw new Error(`No encontré competitionId=${competitionId} en /competitions para sportId=${sportId}`);
  }

  return asRecord(competition);
}

function findCountryNameByCompetition(node: unknown, competitionId: number): string | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findCountryNameByCompetition(item, competitionId);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (!node || typeof node !== 'object') {
    return null;
  }

  const record = node as UnknownRecord;
  const competitions = asArray(record.competitions);

  if (competitions.some((item) => toInt(asRecord(item).id) === competitionId)) {
    return asString(record.name) ?? asString(record.countryName);
  }

  for (const value of Object.values(record)) {
    const found = findCountryNameByCompetition(value, competitionId);
    if (found) {
      return found;
    }
  }

  return null;
}

async function searchCountries(sportId: number, competitionId: number): Promise<string | null> {
  const candidates: Array<{ path: string; query: Record<string, string | number> }> = [
    { path: '/countries', query: { sports: sportId } },
    { path: '/countries', query: {} },
  ];

  for (const candidate of candidates) {
    try {
      const payload = (await requestSportsApiPro(candidate.path, candidate.query)) as UnknownRecord;
      const country = findCountryNameByCompetition(payload, competitionId);
      if (country) {
        return country;
      }
    } catch {
      // continue with next candidate
    }
  }

  return null;
}

function extractTeamsFromStandingsPayload(payload: UnknownRecord): Array<{ id: number; name: string | null }> {
  const standings = asArray(payload.standings);
  const teams: Array<{ id: number; name: string | null }> = [];
  const seen = new Set<number>();

  for (const item of standings) {
    const standingItem = asRecord(item);
    const rows = asArray(standingItem.rows);

    if (rows.length > 0) {
      for (const row of rows) {
        const competitor = asRecord(asRecord(row).competitor);
        const id = toInt(competitor.id);

        if (id !== null && !seen.has(id)) {
          teams.push({
            id,
            name: typeof competitor.name === 'string' ? competitor.name : null,
          });
          seen.add(id);
        }
      }
      continue;
    }

    const competitor = asRecord(standingItem.competitor);
    const id = toInt(competitor.id);

    if (id !== null && !seen.has(id)) {
      teams.push({
        id,
        name: typeof competitor.name === 'string' ? competitor.name : null,
      });
      seen.add(id);
    }
  }

  return teams;
}

async function getStandingsPayloadWithFallback(
  competitionId: number,
  seasonNum: number | null,
  stageNum: number | null,
): Promise<UnknownRecord> {
  const firstQuery: Record<string, number> = { competitions: competitionId };

  if (typeof seasonNum === 'number') {
    firstQuery.seasonNum = seasonNum;
  }

  if (typeof stageNum === 'number') {
    firstQuery.stageNum = stageNum;
  }

  try {
    return (await requestSportsApiPro('/standings', firstQuery)) as UnknownRecord;
  } catch {
    return (await requestSportsApiPro('/standings', { competitions: competitionId })) as UnknownRecord;
  }
}

export async function getCompetitionTeamsBySportAndCompetitionService(
  sportId: number,
  competitionId: number,
): Promise<CompetitionTeamsResult> {
  getSportsApiProApiKeys();

  const competition = await getCompetitionMeta(sportId, competitionId);
  const seasonNum = toInt(competition.currentSeasonNum);
  const stageNum = toInt(competition.currentStageNum);

  const standingsPayload = await getStandingsPayloadWithFallback(competitionId, seasonNum, stageNum);
  const teams = extractTeamsFromStandingsPayload(standingsPayload);

  const countryName =
    asString(competition.countryName) ??
    asString(asRecord(competition.country).name) ??
    (await searchCountries(sportId, competitionId));

  return {
    competitionId,
    competitionName: typeof competition.name === 'string' ? competition.name : null,
    countryName,
    seasonNum,
    stageNum,
    teams,
  };
}
