import { requestSportsApiPro } from '../../../integrations/sportsapipro/sportsapipro.client.js';

type UnknownRecord = Record<string, unknown>;

export interface AthleteBasicResult {
  id: number;
  name: string;
  position: string | null;
  club: {
    id: number | null;
    name: string | null;
  };
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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

export async function getPlayersByAthleteIdService(
  athleteId: number,
  options: {
    fullDetails?: boolean;
    topBookmaker?: number;
  } = {},
): Promise<AthleteBasicResult> {
  if (!Number.isFinite(athleteId) || athleteId <= 0) {
    throw new Error('athleteId debe ser un entero positivo.');
  }

  const query: Record<string, string | number> = {
    athletes: athleteId,
    fullDetails: String(options.fullDetails ?? false),
  };

  if (typeof options.topBookmaker === 'number' && Number.isFinite(options.topBookmaker)) {
    query.topBookmaker = Math.trunc(options.topBookmaker);
  }

  const payload = (await requestSportsApiPro('/athletes', query)) as UnknownRecord;
  const athletes = asArray(payload.athletes).map(asRecord);

  if (athletes.length === 0) {
    throw new Error(`No encontré 'athletes' en la respuesta para athleteId=${athleteId}`);
  }

  const athlete = athletes[0];
  const resolvedAthleteId = toInt(athlete.id) ?? athleteId;
  const rawName = athlete.name;

  if (typeof rawName !== 'string' || rawName.trim().length === 0) {
    throw new Error("No vino el nombre del atleta (field 'name').");
  }

  const position = asRecord(athlete.position);
  const positionName = typeof position.name === 'string' && position.name.trim().length > 0 ? position.name.trim() : null;

  const clubFromAthlete = asRecord(athlete.club);
  const clubId = toInt(athlete.clubId ?? clubFromAthlete.id);
  let clubName = typeof clubFromAthlete.name === 'string' && clubFromAthlete.name.trim().length > 0
    ? clubFromAthlete.name.trim()
    : null;

  if (clubName === null && clubId !== null) {
    for (const competitorUnknown of asArray(payload.competitors)) {
      const competitor = asRecord(competitorUnknown);
      if (toInt(competitor.id) !== clubId) {
        continue;
      }

      if (typeof competitor.name === 'string' && competitor.name.trim().length > 0) {
        clubName = competitor.name.trim();
      }
      break;
    }
  }

  return {
    id: resolvedAthleteId,
    name: rawName.trim(),
    position: positionName,
    club: {
      id: clubId,
      name: clubName,
    },
  };
}
