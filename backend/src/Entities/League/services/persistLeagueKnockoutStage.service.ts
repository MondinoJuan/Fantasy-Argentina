import { orm } from '../../../shared/db/orm.js';
import { requestSportsApiPro } from '../../../integrations/sportsapipro/sportsapipro.client.js';
import { League } from '../league.entity.js';
import { UltSeason } from '../../UltSeason/ultSeason.entity.js';
import { Matchday } from '../../Matchday/matchday.entity.js';
import { GameMatch } from '../../GameMatch/gameMatch.entity.js';

const em = orm.em;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNullableScore(value: unknown): number | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return null;
    const direct = Number.parseInt(normalized, 10);
    if (Number.isFinite(direct)) return direct;
    const fromPattern = normalized.match(/-?\d+/);
    if (fromPattern) {
      const parsed = Number.parseInt(fromPattern[0], 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  const parsed = toInt(value);
  return parsed === null ? null : parsed;
}

function toDateFromUnixSeconds(value: unknown): Date | null {
  const seconds = toInt(value);
  if (seconds === null) return null;
  return new Date(seconds * 1000);
}

function toDateFromUnknown(value: unknown): Date | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return toDateFromUnixSeconds(value);
}

async function fetchStartDateFromEvent(eventId: string): Promise<Date | null> {
  try {
    const payload = asRecord(await requestSportsApiPro(`/api/match/${eventId}`));
    const data = asRecord(payload.data);
    const event = asRecord(data.event);
    const matchNode = asRecord(payload.match);
    return (
      toDateFromUnknown(matchNode.startTime)
      ?? toDateFromUnknown(event.startTime)
      ?? toDateFromUnknown(event.startTimestamp)
      ?? toDateFromUnknown(payload.startTime)
      ?? toDateFromUnknown(payload.timestamp)
    );
  } catch {
    return null;
  }
}

export async function persistLeagueKnockoutStageByIdEnApi(leagueIdEnApi: number) {
  const league = await em.findOne(League, { idEnApi: leagueIdEnApi });
  if (!league) {
    throw new Error('league must exist locally. Use superadmin sync first.');
  }

  if (!league.knockoutStage) {
    return {
      skipped: true,
      message: 'La league seleccionada no tiene fase eliminatoria (kncokoutStage=false).',
      league,
    };
  }

  const ultSeason = await em.findOne(UltSeason, { league: league.id });
  if (!ultSeason) {
    throw new Error('ultSeason must exist locally. Use superadmin ultSeason sync first.');
  }

  const payload = asRecord(await requestSportsApiPro(`/api/tournament/${league.idEnApi}/season/${ultSeason.idEnApi}/knockout`));
  const data = asRecord(payload.data);
  const cupTrees = asArray(data.cupTrees).map((item) => asRecord(item));

  const seasonKey = `${ultSeason.idEnApi}-knockout`;
  let createdMatchdays = 0;
  let updatedMatchdays = 0;
  let createdMatches = 0;
  let updatedMatches = 0;

  for (const cupTree of cupTrees) {
    const rounds = asArray(cupTree.rounds).map((item) => asRecord(item));

    for (const round of rounds) {
      const roundOrder = toInt(round.order) ?? 0;
      if (roundOrder <= 0) {
        continue;
      }

      const blocks = asArray(round.blocks).map((item) => asRecord(item));
      const blockStartDates = blocks
        .map((block) => toDateFromUnknown(block.seriesStartDateTimestamp))
        .filter((date): date is Date => date !== null);

      const startDate = blockStartDates.length > 0
        ? new Date(Math.min(...blockStartDates.map((date) => date.getTime())))
        : new Date();
      const endDate = new Date(startDate);
      endDate.setUTCHours(23, 59, 59, 999);

      let matchday = await em.findOne(Matchday, {
        league,
        season: seasonKey,
        matchdayNumber: roundOrder,
      });

      if (!matchday) {
        matchday = em.create(Matchday, {
          league,
          season: seasonKey,
          matchdayNumber: roundOrder,
          startDate,
          endDate,
          autoUpdateAt: new Date(endDate.getTime() + (8 * 60 * 60 * 1000)),
          nextPostponedCheckAt: null,
          status: 'scheduled',
        } as any);
        createdMatchdays += 1;
      } else {
        matchday.startDate = startDate;
        matchday.endDate = endDate;
        matchday.autoUpdateAt = new Date(endDate.getTime() + (8 * 60 * 60 * 1000));
        updatedMatchdays += 1;
      }

      for (const block of blocks) {
        const participants = asArray(block.participants).map((item) => asRecord(item));
        const homeParticipant = asRecord(participants[0]);
        const awayParticipant = asRecord(participants[1]);
        const homeTeam = asRecord(homeParticipant.team);
        const awayTeam = asRecord(awayParticipant.team);

        const events = asArray(block.events)
          .map((event) => String(event ?? '').trim())
          .filter((eventId) => eventId.length > 0);

        const eventIds = events.length > 0 ? events : [String(block.id ?? '').trim()].filter((id) => id.length > 0);

        if (eventIds.length === 0) {
          continue;
        }

        const homeScore = toNullableScore(block.homeTeamScore);
        const awayScore = toNullableScore(block.awayTeamScore);
        const finished = Boolean(block.finished) || (homeScore !== null && awayScore !== null);
        const startDateTimeFromBlock = toDateFromUnknown(block.seriesStartDateTimestamp);

        for (const externalApiId of eventIds) {
          const startDateTime = startDateTimeFromBlock
            ?? await fetchStartDateFromEvent(externalApiId)
            ?? startDate;

          const existing = await em.findOne(GameMatch, { externalApiId });
          if (existing) {
            existing.matchday = matchday;
            existing.league = league;
            existing.homeTeam = asString(homeTeam.name) || existing.homeTeam;
            existing.awayTeam = asString(awayTeam.name) || existing.awayTeam;
            existing.startDateTime = startDateTime;
            existing.homeScore = homeScore;
            existing.awayScore = awayScore;
            existing.status = finished ? 'finalizado' : 'scheduled';
            updatedMatches += 1;
            continue;
          }

          em.create(GameMatch, {
            matchday,
            league,
            externalApiId,
            homeTeam: asString(homeTeam.name) || 'TBD',
            awayTeam: asString(awayTeam.name) || 'TBD',
            startDateTime,
            status: finished ? 'finalizado' : 'scheduled',
            homeScore,
            awayScore,
          } as any);
          createdMatches += 1;
        }
      }
    }
  }

  await em.flush();

  return {
    skipped: false,
    league,
    ultSeason,
    summary: {
      cupTrees: cupTrees.length,
      createdMatchdays,
      updatedMatchdays,
      createdMatches,
      updatedMatches,
      seasonKey,
    },
  };
}
