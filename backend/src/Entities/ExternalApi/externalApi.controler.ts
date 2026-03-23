import { Request, Response } from 'express';
import { orm } from '../../shared/db/orm.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { PlayerPerformance } from '../PlayerPerformance/playerPerformance.entity.js';
import { Match } from '../Match/match.entity.js';
import { League } from '../League/league.entity.js';
import { Tournament } from '../Tournament/tournament.entity.js';
import { RealTeam } from '../RealTeam/realTeam.entity.js';
import { MATCHDAY_STATUSES, MATCH_STATUSES, isEnumValue } from '../../shared/domain-enums.js';
import { requestSportsApiPro } from '../../integrations/sportsapipro/sportsapipro.client.js';
import {
  buildFixtureFromEventRefsService,
  collectFixtureEventRefsFromTeamsService,
  getCompetitionTeamsBySportAndCompetitionService,
  getLatestMatchdayResultsWithPlayerRatingsService,
  getSportsApiProAllowedLeaguesService,
  getSportsApiProPlayerByIdService,
  getSportsApiProPlayersByTeamService,
  getPlayersByAthleteIdService,
  getSportsApiProTeamDetailByTeamService,
  getSportsApiProTeamsByLeagueService,
} from './services/index.js';

const em = orm.em;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}


function toNullableScore(value: unknown): number | null {
  const parsed = toInt(value);

  // En SportsApiPro, -1 suele representar marcador no disponible / no jugado aún.
  if (parsed === null || parsed < 0) {
    return null;
  }

  return parsed;
}

function toNullableDateFromIsoOrUnix(value: unknown): Date | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const unix = toInt(value);
  if (unix !== null) {
    const fromUnix = new Date(unix * 1000);
    if (!Number.isNaN(fromUnix.getTime())) {
      return fromUnix;
    }
  }

  return null;
}

function normalizeMatchStatusFromApi(statusTypeRaw: unknown, hasValidScore: boolean): typeof MATCH_STATUSES[number] {
  if (hasValidScore) {
    return 'finalizado';
  }

  const statusType = typeof statusTypeRaw === 'string' ? statusTypeRaw.trim().toLowerCase() : '';
  if (!statusType) {
    return 'scheduled';
  }

  if (statusType.includes('finish') || statusType.includes('end')) {
    return 'finalizado';
  }
  if (statusType.includes('progress') || statusType.includes('live') || statusType.includes('half')) {
    return 'in_progress';
  }
  if (statusType.includes('postpon')) {
    return 'postponed';
  }
  if (statusType.includes('cancel')) {
    return 'cancelled';
  }

  return 'scheduled';
}

function extractMatchNodeFromMatchPayload(payload: UnknownRecord): UnknownRecord {
  const direct = asRecord(payload.match);
  if (Object.keys(direct).length > 0) {
    return direct;
  }

  const data = asRecord(payload.data);
  const eventNode = asRecord(data.event);
  return eventNode;
}

function groupFixtureByRound(fixture: UnknownRecord[]): Array<{ roundNum: number; games: UnknownRecord[] }> {
  const byRound = new Map<number, UnknownRecord[]>();

  for (const game of fixture) {
    const roundNum = toInt(game.roundNum);
    if (roundNum === null) {
      continue;
    }

    const current = byRound.get(roundNum) ?? [];
    current.push(game);
    byRound.set(roundNum, current);
  }

  return [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([roundNum, games]) => ({ roundNum, games }));
}

async function persistFixtureCompetitionInDb(
  competitionId: number,
  seasonNum: number,
  fixtureData: UnknownRecord[],
  totalTeamsInCompetition: number,
) {
  const league = await em.findOne(League, { idEnApi: competitionId });
  if (!league) {
    throw new Error('league must exist locally. Use superadmin sync first.');
  }

  const groupedByRound = groupFixtureByRound(fixtureData);
  let createdMatchdays = 0;
  let createdMatches = 0;
  const roundsWithUnexpectedMatchCount: Array<{ roundNum: number; totalMatches: number; expectedMatches: number }> = [];

  const expectedMatchesPerRound = Math.floor(totalTeamsInCompetition / 2);

  for (const group of groupedByRound) {
    const orderedByStartTime = [...group.games].sort(
      (a, b) => new Date(String(a.startTime ?? '')).getTime() - new Date(String(b.startTime ?? '')).getTime(),
    );

    const firstStart = String(orderedByStartTime[0]?.startTime ?? '');
    const lastStart = String(orderedByStartTime[orderedByStartTime.length - 1]?.startTime ?? '');

    const firstDate = firstStart ? new Date(firstStart) : new Date();
    const lastDate = lastStart ? new Date(lastStart) : firstDate;

    const startDate = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth(), firstDate.getUTCDate(), 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), lastDate.getUTCDate(), 23, 59, 59, 999));

    let matchday = await em.findOne(Matchday, {
      league,
      season: String(seasonNum),
      matchdayNumber: group.roundNum,
    });

    if (!matchday) {
      matchday = em.create(Matchday, {
        league,
        season: String(seasonNum),
        matchdayNumber: group.roundNum,
        startDate,
        endDate,
        status: MATCHDAY_STATUSES[0],
      } as any);
      createdMatchdays += 1;
    } else {
      matchday.startDate = startDate;
      matchday.endDate = endDate;
    }

    if (expectedMatchesPerRound > 0 && group.games.length !== expectedMatchesPerRound) {
      roundsWithUnexpectedMatchCount.push({
        roundNum: group.roundNum,
        totalMatches: group.games.length,
        expectedMatches: expectedMatchesPerRound,
      });
    }

    for (const fixtureMatch of group.games) {
      const gameId = Number.parseInt(String(fixtureMatch.gameId ?? ''), 10);
      if (!Number.isFinite(gameId)) continue;

      const homeScore = toNullableScore(asRecord(fixtureMatch.home).score);
      const awayScore = toNullableScore(asRecord(fixtureMatch.away).score);

      const existing = await em.findOne(Match, { externalApiId: String(gameId) });
      if (existing) {
        existing.matchday = matchday;
        existing.league = league;
        existing.homeTeam = String(asRecord(fixtureMatch.home).name ?? existing.homeTeam ?? 'TBD');
        existing.awayTeam = String(asRecord(fixtureMatch.away).name ?? existing.awayTeam ?? 'TBD');
        existing.startDateTime = new Date(String(fixtureMatch.startTime ?? existing.startDateTime?.toISOString?.() ?? startDate.toISOString()));
        existing.homeScore = homeScore;
        existing.awayScore = awayScore;
        existing.status = homeScore !== null && awayScore !== null
          ? 'finalizado'
          : isEnumValue(MATCH_STATUSES, fixtureMatch.statusText)
            ? fixtureMatch.statusText
            : existing.status;
        continue;
      }

      em.create(Match, {
        matchday,
        league,
        externalApiId: String(gameId),
        homeTeam: String(asRecord(fixtureMatch.home).name ?? 'TBD'),
        awayTeam: String(asRecord(fixtureMatch.away).name ?? 'TBD'),
        startDateTime: new Date(String(fixtureMatch.startTime ?? startDate.toISOString())),
        status: homeScore !== null && awayScore !== null
          ? 'finalizado'
          : isEnumValue(MATCH_STATUSES, fixtureMatch.statusText)
            ? fixtureMatch.statusText
            : MATCH_STATUSES[0],
        homeScore,
        awayScore,
      } as any);
      createdMatches += 1;
    }
  }

  await em.flush();
  return { createdMatchdays, createdMatches, expectedMatchesPerRound, roundsWithUnexpectedMatchCount };
}


function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toIsoDateFromUnixTimestamp(value: unknown): string | null {
  const seconds = toInt(value);
  if (seconds === null) {
    return null;
  }

  return new Date(seconds * 1000).toISOString();
}
/*
function extractLatestSeasonFromTournamentSeasons(payload: UnknownRecord): UnknownRecord {
  const seasons = asArray(payload.seasons);
  const latest = seasons.length > 0 ? asRecord(seasons[0]) : {};

  if (Object.keys(latest).length === 0) {
    throw new Error('No seasons found for tournament in SportsApiPro');
  }

  return latest;
}
*/
function extractRoundNumbers(payload: UnknownRecord): number[] {
  const roundsRaw = asArray(asRecord(payload.data).rounds);

  if (roundsRaw.length === 0) {
    throw new Error('No pude encontrar el listado de rounds en la respuesta.');
  }

  const extractRoundFromText = (value: string): number | null => {
    const match = value.match(/\d+/);
    if (!match) return null;
    const parsed = Number.parseInt(match[0], 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parseRound = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);

    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized.length === 0) return null;
      if (/^\d+$/.test(normalized)) return Number.parseInt(normalized, 10);
      return extractRoundFromText(normalized);
    }

    if (typeof value === 'object' && value !== null) {
      const node = asRecord(value);
      for (const key of ['round', 'number', 'value', 'name']) {
        const parsed = parseRound(node[key]);
        if (parsed !== null) return parsed;
      }
    }

    return null;
  };

  const rounds = roundsRaw
    .map((item) => parseRound(item))
    .filter((round): round is number => round !== null && round > 0);

  const unique = [...new Set(rounds)].sort((a, b) => a - b);
  if (unique.length === 0) {
    throw new Error('No pude parsear ningún round válido desde la respuesta.');
  }

  return unique;
}

function mapV2RoundEventsToFixture(roundNumber: number, payload: UnknownRecord): UnknownRecord[] {
  const events = asArray(payload.events);

  return events.map((eventNode) => {
    const event = asRecord(eventNode);

    return {
      gameId: event.id,
      roundNum: roundNumber,
      statusText: event.status,
      startTime: toIsoDateFromUnixTimestamp(event.startTimestamp),
      home: {
        name: event.homeTeam,
        score: event.homeScore,
      },
      away: {
        name: event.awayTeam,
        score: event.awayScore,
      },
    } satisfies UnknownRecord;
  });
}

function toNormalizedRanking(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseFloat(value)
      : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed;
}
/*
function extractAthleteRankingRowsFromLineupsPayload(payload: UnknownRecord): Array<{ athleteId: number; ranking: number }> {
  const rankingByAthleteId = new Map<number, number>();
  const data = asRecord(payload.data);

  for (const sideKey of ['home', 'away']) {
    const side = asRecord(data[sideKey]);
    const players = asArray(side.players);

    for (const itemNode of players) {
      const item = asRecord(itemNode);
      const player = asRecord(item.player);
      const statistics = asRecord(item.statistics);

      const athleteId = toInt(player.id);
      if (athleteId === null) {
        continue;
      }

      rankingByAthleteId.set(athleteId, toNormalizedRanking(statistics.rating));
    }
  }

  return [...rankingByAthleteId.entries()].map(([athleteId, ranking]) => ({ athleteId, ranking }));
}
*/
function parseRequiredNumber(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getSportsApiProPlayerById(req: Request, res: Response) {
  const playerId = parseRequiredNumber(req.query.playerId as string | undefined);

  if (!playerId) {
    return res.status(400).json({ message: 'playerId query param is required number' });
  }

  try {
    const data = await getSportsApiProPlayerByIdService(playerId);
    return res.status(200).json({ message: 'sportsapipro player fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getSportsApiProPlayersByTeam(req: Request, res: Response) {
  const teamId = parseRequiredNumber(req.query.teamId as string | undefined);

  if (!teamId) {
    return res.status(400).json({ message: 'teamId query param is required number' });
  }

  try {
    const data = await getSportsApiProPlayersByTeamService(teamId);
    return res.status(200).json({ message: 'sportsapipro team players fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getPlayersByAthleteId(req: Request, res: Response) {
  const athleteId = parseRequiredNumber(req.query.athleteId as string | undefined);

  if (!athleteId) {
    return res.status(400).json({ message: 'athleteId query param is required number' });
  }

  const fullDetailsRaw = Array.isArray(req.query.fullDetails) ? req.query.fullDetails[0] : req.query.fullDetails;
  const fullDetails = typeof fullDetailsRaw === 'string' ? fullDetailsRaw.trim().toLowerCase() === 'true' : false;

  const topBookmakerRaw = Array.isArray(req.query.topBookmaker) ? req.query.topBookmaker[0] : req.query.topBookmaker;
  const topBookmaker = parseRequiredNumber(topBookmakerRaw as string | undefined);

  try {
    const data = await getPlayersByAthleteIdService(athleteId, {
      fullDetails,
      topBookmaker: topBookmaker ?? undefined,
    });
    return res.status(200).json({ message: 'sportsapipro athlete basic fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getSportsApiProAllowedLeagues(req: Request, res: Response) {
  try {
    const data = await getSportsApiProAllowedLeaguesService();
    return res.status(200).json({ message: 'sportsapipro allowed leagues fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getSportsApiProTeamsByLeague(req: Request, res: Response) {
  const leagueId = parseRequiredNumber(req.query.leagueId as string | undefined);

  if (!leagueId) {
    return res.status(400).json({ message: 'leagueId query param is required number' });
  }

  try {
    const data = await getSportsApiProTeamsByLeagueService(leagueId);
    return res.status(200).json({ message: 'sportsapipro league teams fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getSportsApiProTeamDetailByTeam(req: Request, res: Response) {
  const teamId = parseRequiredNumber(req.query.teamId as string | undefined);

  if (!teamId) {
    return res.status(400).json({ message: 'teamId query param is required number' });
  }

  try {
    const data = await getSportsApiProTeamDetailByTeamService(teamId);
    return res.status(200).json({ message: 'sportsapipro team detail fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getSportsApiProCompetitionTeams(req: Request, res: Response) {
  const sportId = parseRequiredNumber(req.query.sportId as string | undefined);
  const competitionId = parseRequiredNumber(req.body.competitionId as string | undefined);

  if (!sportId || !competitionId) {
    return res.status(400).json({ message: 'sportId and competitionId query params are required numbers' });
  }

  try {
    const data = await getCompetitionTeamsBySportAndCompetitionService(sportId, competitionId);
    return res.status(200).json({ message: 'sportsapipro competition teams fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getSportsApiProLatestMatchdayRatings(req: Request, res: Response) {
  const sportId = parseRequiredNumber(req.query.sportId as string | undefined);
  const competitionId = parseRequiredNumber(req.body.competitionId as string | undefined);

  if (!sportId || !competitionId) {
    return res.status(400).json({ message: 'sportId and competitionId query params are required numbers' });
  }

  try {
    const data = await getLatestMatchdayResultsWithPlayerRatingsService(sportId, competitionId);
    return res.status(200).json({ message: 'sportsapipro latest matchday ratings fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function postSportsApiProFixtureEventRefs(req: Request, res: Response) {
  const config = req.body?.config;
  const options = req.body?.options;

  if (!config || typeof config !== 'object') {
    return res.status(400).json({ message: 'config body object is required' });
  }

  try {
    const data = await collectFixtureEventRefsFromTeamsService(config, options);
    return res.status(200).json({ message: 'sportsapipro fixture event refs collected', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function postSportsApiProFixtureBuild(req: Request, res: Response) {
  const eventRefs = req.body?.eventRefs;
  const options = req.body?.options;

  if (!Array.isArray(eventRefs)) {
    return res.status(400).json({ message: 'eventRefs body array is required' });
  }

  try {
    const data = await buildFixtureFromEventRefsService(eventRefs, options);
    return res.status(200).json({ message: 'sportsapipro fixture built', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}



async function postSportsApiProBuildCompetitionFixture(req: Request, res: Response) {
  const competitionId = Number.parseInt(String(req.body?.competitionId ?? ''), 10);
  const seasonId = Number.parseInt(String(req.body?.seasonId ?? ''), 10);

  if (!Number.isFinite(competitionId)) {
    return res.status(400).json({ message: 'competitionId is required number' });
  }
  if (!Number.isFinite(seasonId)) {
    return res.status(400).json({ message: 'seasonId is required number' });
  }

  try {
    const roundsPayload = asRecord(await requestSportsApiPro(`/api/tournament/${competitionId}/season/${seasonId}/rounds`));
    if (roundsPayload.success !== true) {
      return res.status(502).json({ message: `La API devolvió success=false en rounds. Respuesta: ${JSON.stringify(roundsPayload)}` });
    }
    const roundNumbers = extractRoundNumbers(roundsPayload);
    const fixture: UnknownRecord[] = [];
    const roundsSummary: Array<{ round: number; matchCount: number; matches: UnknownRecord[] }> = [];

    for (const roundNumber of roundNumbers) {
      const roundPayload = asRecord(
        await requestSportsApiPro(`/api/tournament/${competitionId}/season/${seasonId}/round/${roundNumber}`),
      );
      if (roundPayload.success !== true) {
        return res.status(502).json({
          message: `La API devolvió success=false en round=${roundNumber}. Respuesta: ${JSON.stringify(roundPayload)}`,
        });
      }
      const roundFixture = mapV2RoundEventsToFixture(roundNumber, roundPayload);
      fixture.push(...roundFixture);
      roundsSummary.push({
        round: roundNumber,
        matchCount: roundFixture.length,
        matches: roundFixture.map((match) => ({
          id: match.gameId,
          homeTeam: asRecord(match.home).name,
          awayTeam: asRecord(match.away).name,
          homeScore: asRecord(match.home).score,
          awayScore: asRecord(match.away).score,
          status: match.statusText,
          startTimestamp: match.startTime,
        })),
      });
    }

    const uniqueTeamsCount = new Set(
      fixture.flatMap((match) => {
        const homeTeam = String(asRecord(match.home).name ?? '').trim();
        const awayTeam = String(asRecord(match.away).name ?? '').trim();
        return [homeTeam, awayTeam].filter((team) => team.length > 0);
      }),
    ).size;

    const persistStats = await persistFixtureCompetitionInDb(
      competitionId,
      seasonId,
      fixture,
      uniqueTeamsCount,
    );

    const data = {
      tournamentId: competitionId,
      seasonId,
      totalRounds: roundsSummary.length,
      rounds: roundsSummary,
    };

    return res.status(200).json({
      message: 'sportsapipro competition fixture built and persisted',
      data,
      persistStats,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getSportsApiProLocalPersistedFixture(req: Request, res: Response) {
  const competitionId = parseRequiredNumber(req.body.competitionId as string | undefined);
  const leagueId = parseRequiredNumber(req.query.leagueId as string | undefined);

  try {
    const matchdaysWhere = leagueId
      ? { league: { id: leagueId } }
      : competitionId
        ? { league: { idEnApi: competitionId } }
        : {};
    const matchesWhere = leagueId
      ? { matchday: { league: { id: leagueId } } }
      : competitionId
        ? { matchday: { league: { idEnApi: competitionId } } }
        : {};

    const matchdays = await em.find(Matchday, matchdaysWhere as any, { populate: ['league'] });
    const matches = await em.find(Match, matchesWhere as any, { populate: ['matchday', 'matchday.league'] });

    const groups = matchdays
      .map((matchday: any) => ({
        matchdayId: matchday.id,
        matchdayNumber: matchday.matchdayNumber,
        season: matchday.season,
        startDate: matchday.startDate,
        endDate: matchday.endDate,
        status: matchday.status,
        league: {
          id: matchday.league?.id,
          idEnApi: matchday.league?.idEnApi,
          name: matchday.league?.name,
        },
        matches: matches
          .filter((match: any) => match.matchday?.id === matchday.id)
          .sort((a: any, b: any) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime())
          .map((match: any) => ({
            id: match.id,
            externalApiId: match.externalApiId,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            startDateTime: match.startDateTime,
            status: match.status,
            homeScore: match.homeScore ?? null,
            awayScore: match.awayScore ?? null,
          })),
      }))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    return res.status(200).json({
      message: 'local persisted fixture recovered',
      data: {
        competitionId: competitionId ?? null,
        totalMatchdays: groups.length,
        totalMatches: matches.length,
        matchdays: groups,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}


async function postSportsApiProSyncPlayedMatchesResults(req: Request, res: Response) {
  const competitionId = parseRequiredNumber(req.body?.competitionId as string | undefined)
    ?? parseRequiredNumber(req.query.competitionId as string | undefined);

  try {
    const now = new Date();
    const where = competitionId
      ? {
        startDateTime: { $lt: now },
        status: { $ne: 'finalizado' },
        matchday: { league: { idEnApi: competitionId } },
      }
      : {
        startDateTime: { $lt: now },
        status: { $ne: 'finalizado' },
      };

    const matches = await em.find(Match, where as any, { populate: ['matchday', 'matchday.league'] });

    let updated = 0;
    let missingPayloadData = 0;
    const errors: Array<{ gameId: string; message: string }> = [];

    for (const match of matches) {
      const gameId = Number.parseInt(String(match.externalApiId ?? ''), 10);

      if (!Number.isFinite(gameId)) {
        missingPayloadData += 1;
        continue;
      }
      try {
        const apiPayload = asRecord(await requestSportsApiPro(`/api/match/${gameId}`));
        const apiMatch = extractMatchNodeFromMatchPayload(apiPayload);

        if (Object.keys(apiMatch).length === 0) {
          missingPayloadData += 1;
          continue;
        }

        const homeTeam = asRecord(apiMatch.homeTeam);
        const awayTeam = asRecord(apiMatch.awayTeam);
        const homeScoreNode = asRecord(apiMatch.homeScore);
        const awayScoreNode = asRecord(apiMatch.awayScore);
        const statusNode = asRecord(apiMatch.status);

        const homeScore = toNullableScore(homeScoreNode.current ?? homeScoreNode.display ?? homeScoreNode.normaltime);
        const awayScore = toNullableScore(awayScoreNode.current ?? awayScoreNode.display ?? awayScoreNode.normaltime);
        const hasValidScore = homeScore !== null && awayScore !== null;

        const resolvedStartDateTime = toNullableDateFromIsoOrUnix(
          apiPayload.startTime
          ?? apiMatch.startTime
          ?? apiMatch.startTimestamp
          ?? apiMatch.currentPeriodStartTimestamp,
        );

        if (typeof homeTeam.name === 'string' && homeTeam.name.trim().length > 0) {
          match.homeTeam = homeTeam.name.trim();
        }
        if (typeof awayTeam.name === 'string' && awayTeam.name.trim().length > 0) {
          match.awayTeam = awayTeam.name.trim();
        }
        if (resolvedStartDateTime) {
          match.startDateTime = resolvedStartDateTime;
        }

        match.homeScore = homeScore;
        match.awayScore = awayScore;
        match.status = normalizeMatchStatusFromApi(statusNode.type ?? statusNode.description ?? statusNode.code, hasValidScore);

        updated += 1;
      } catch (error: any) {
        errors.push({ gameId: String(match.externalApiId), message: error?.message ?? 'unknown error' });
      }
    }

    await em.flush();

    return res.status(200).json({
      message: 'played matches results synced',
      data: {
        competitionId: competitionId ?? null,
        scannedMatches: matches.length,
        updatedMatches: updated,
        missingPayloadData,
        errors,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}


function computeWeightedFormScore(values: number[]): number {
  const weights = [0.5, 0.3, 0.2, 0.1, 0.05];
  const limited = values.slice(0, 5);
  const appliedWeights = weights.slice(0, limited.length);
  const weightSum = appliedWeights.reduce((acc, item) => acc + item, 0);

  if (limited.length === 0 || weightSum <= 0) {
    return 0;
  }

  const weighted = limited.reduce((acc, value, index) => acc + (value * appliedWeights[index]), 0);
  return weighted / weightSum;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function updateRealPlayerTranslatedValuesByLatestFormForCompetition(competitionId: number) {
  const league = await em.findOne(League, { idEnApi: competitionId });
  if (!league) return { skipped: true, reason: 'league not found locally' };

  const tournament = await em.findOne(
    Tournament,
    { league: { id: league.id } } as any,
    { orderBy: { id: 'desc' } as any },
  );
  if (!tournament || typeof tournament.limiteMin !== 'number' || typeof tournament.limiteMax !== 'number') {
    return { skipped: true, reason: 'tournament with limits not found for league', leagueId: league.id };
  }

  const limiteMin = Number(tournament.limiteMin);
  const limiteMax = Number(tournament.limiteMax);
  const range = limiteMax - limiteMin;

  if (!Number.isFinite(range) || range <= 0) {
    return { skipped: true, reason: 'invalid tournament limits', limiteMin, limiteMax, tournamentId: tournament.id };
  }

  const teams = await em.find(RealTeam, { league: { id: league.id } } as any, { fields: ['id'] as any });
  const teamIds = teams.map((team: any) => Number(team.id)).filter((id) => Number.isFinite(id));

  if (teamIds.length === 0) {
    return { skipped: true, reason: 'no real teams in league', leagueId: league.id };
  }

  const players = await em.find(RealPlayer, { realTeam: { $in: teamIds } } as any);

  // ✅ UNA sola query para todas las performances de todos los jugadores
  const playerIds = players.map((p: any) => p.id);
  const allPerformances = await em.find(
    PlayerPerformance,
    { realPlayer: { $in: playerIds }, league: { id: league.id } } as any,
    { orderBy: { updateDate: 'desc' } as any },
  );

  // Agrupar en memoria: Map<playerId, performances[]>
  const performancesByPlayer = new Map<number, typeof allPerformances>();
  for (const perf of allPerformances) {
    const pid = Number((perf as any).realPlayer?.id ?? (perf as any).realPlayer);
    if (!Number.isFinite(pid)) continue;

    const existing = performancesByPlayer.get(pid) ?? [];
    if (existing.length < 5) {
      existing.push(perf);
      performancesByPlayer.set(pid, existing);
    }
  }

  let updatedPlayers = 0;

  for (const player of players) {
    const performances = performancesByPlayer.get(Number((player as any).id)) ?? [];
    const recentScores = performances
      .map((item) => Number(item.pointsObtained))
      .filter((score) => Number.isFinite(score));

    if (recentScores.length === 0) continue;

    const scoreForm = computeWeightedFormScore(recentScores);
    const valorTradActual =
      typeof player.translatedValue === 'number' && Number.isFinite(player.translatedValue)
        ? Number(player.translatedValue)
        : limiteMin;

    const pRaw = (valorTradActual - limiteMin) / range;
    const p = clamp(Number.isFinite(pRaw) ? pRaw : 0, 0, 1);
    const notaEsperada = p * 10;
    const desvio = scoreForm - notaEsperada;

    if (desvio === 0) {
      player.translatedValue = clamp(valorTradActual, limiteMin, limiteMax);
      updatedPlayers += 1;
      continue;
    }

    const k = 0.05;
    const ajuste = k * desvio;

    let nuevoValor = valorTradActual;
    if (scoreForm > 6) {
      nuevoValor = valorTradActual + ajuste * (1 - p) * valorTradActual;
    } else if (scoreForm < 6) {
      nuevoValor = valorTradActual + ajuste * p * valorTradActual;
    }

    player.translatedValue = clamp(nuevoValor, limiteMin, limiteMax);
    updatedPlayers += 1;
  }

  await em.flush();

  return {
    skipped: false,
    leagueId: league.id,
    tournamentId: tournament.id,
    limiteMin,
    limiteMax,
    playersInLeague: players.length,
    updatedPlayers,
  };
}

async function getSportsApiProRankingsWithLocalPerformances(req: Request, res: Response) {
  const competitionId = parseRequiredNumber(req.body?.competitionId as string | undefined);

  if (!competitionId) {
    return res.status(400).json({ message: 'competitionId body param is required number' });
  }

  try {
    const matches = await em.find(
      Match,
      { status: 'finalizado', matchday: { league: { idEnApi: competitionId } } } as any,
      { populate: ['matchday', 'matchday.league'] },
    );

    const finalizedMatchApiIds = matches
      .map((match) => Number.parseInt(String(match.externalApiId ?? ''), 10))
      .filter((id) => Number.isFinite(id));

    let processedMatches = 0;
    let processedPlayers = 0;
    let createdPerformances = 0;
    let updatedPerformances = 0;
    let missingLocalPlayers = 0;
    const errors: Array<{ matchId: number; message: string }> = [];

    for (const match of matches) {
      const apiMatchId = Number.parseInt(String(match.externalApiId ?? ''), 10);
      if (!Number.isFinite(apiMatchId)) {
        continue;
      }

      try {
        const payload = asRecord(await requestSportsApiPro(`/api/match/${apiMatchId}/lineups`));
        if (payload.success !== true) {
          errors.push({ matchId: apiMatchId, message: 'lineups success=false' });
          continue;
        }

        const data = asRecord(payload.data);
        const homePlayers = asArray(asRecord(data.home).players);
        const awayPlayers = asArray(asRecord(data.away).players);
        const allPlayers = [...homePlayers, ...awayPlayers];

        for (const playerNode of allPlayers) {
          const row = asRecord(playerNode);
          if (row.played !== true) {
            continue;
          }

          const player = asRecord(row.player);
          const statistics = asRecord(row.statistics);

          const playerIdEnApi = Number.parseInt(String(player.id ?? ''), 10);
          if (!Number.isFinite(playerIdEnApi)) {
            continue;
          }

          const realPlayer = await em.findOne(RealPlayer, { idEnApi: playerIdEnApi });
          if (!realPlayer) {
            missingLocalPlayers += 1;
            continue;
          }

          const ratingRaw = statistics.rating;
          const rating = typeof ratingRaw === 'number'
            ? ratingRaw
            : Number.parseFloat(String(ratingRaw ?? '0'));
          const normalizedRating = Number.isFinite(rating) ? rating : 0;

          let performance = await em.findOne(PlayerPerformance, {
            realPlayer,
            matchday: match.matchday,
            league: match.matchday.league,
            match,
          });

          if (!performance) {
            performance = em.create(PlayerPerformance, {
              realPlayer,
              matchday: match.matchday,
              league: match.matchday.league,
              match,
              pointsObtained: normalizedRating,
              updateDate: new Date(),
            } as any);
            createdPerformances += 1;
          } else {
            performance.pointsObtained = normalizedRating;
            performance.updateDate = new Date();
            updatedPerformances += 1;
          }

          processedPlayers += 1;
        }

        processedMatches += 1;
      } catch (error: any) {
        errors.push({ matchId: apiMatchId, message: error?.message ?? 'unknown error' });
      }
    }

    await em.flush();
    const translatedValuesUpdate = await updateRealPlayerTranslatedValuesByLatestFormForCompetition(competitionId);

    return res.status(200).json({
      message: 'rankings persisted for finalized matches',
      data: {
        competitionId,
        finalizedMatchIds: finalizedMatchApiIds,
        totalFinalizedMatches: finalizedMatchApiIds.length,
        processedMatches,
        processedPlayers,
        createdPerformances,
        updatedPerformances,
        missingLocalPlayers,
        errors,
      },
      translatedValuesUpdate,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
export {
  getSportsApiProPlayerById,
  getSportsApiProPlayersByTeam,
  getPlayersByAthleteId,
  getSportsApiProAllowedLeagues,
  getSportsApiProTeamsByLeague,
  getSportsApiProTeamDetailByTeam,
  getSportsApiProCompetitionTeams,
  getSportsApiProLatestMatchdayRatings,
  postSportsApiProFixtureEventRefs,
  postSportsApiProFixtureBuild,
  postSportsApiProBuildCompetitionFixture,
  getSportsApiProLocalPersistedFixture,
  getSportsApiProRankingsWithLocalPerformances,
  postSportsApiProSyncPlayedMatchesResults,
};
