import { getSportsApiProApiKeys, requestSportsApiPro } from '../../../integrations/sportsapipro/sportsapipro.client.js';

type UnknownRecord = Record<string, unknown>;

interface CompetitionTeamsResult {
  competitionId: number;
  competitionName: string | null;
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
  // valida disponibilidad de keys y reutiliza rotación automática ante 429.
  getSportsApiProApiKeys();

  const competition = await getCompetitionMeta(sportId, competitionId);
  const seasonNum = toInt(competition.currentSeasonNum);
  const stageNum = toInt(competition.currentStageNum);

  const standingsPayload = await getStandingsPayloadWithFallback(competitionId, seasonNum, stageNum);
  const teams = extractTeamsFromStandingsPayload(standingsPayload);

  return {
    competitionId,
    competitionName: typeof competition.name === 'string' ? competition.name : null,
    seasonNum,
    stageNum,
    teams,
  };
}
