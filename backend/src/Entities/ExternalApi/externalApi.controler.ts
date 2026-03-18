import { Request, Response } from 'express';
import { orm } from '../../shared/db/orm.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { PlayerPerformance } from '../PlayerPerformance/playerPerformance.entity.js';
import { Match } from '../Match/match.entity.js';
import { League } from '../League/league.entity.js';
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

function extractLatestSeasonFromTournamentSeasons(payload: UnknownRecord): UnknownRecord {
  const seasons = asArray(payload.seasons);
  const latest = seasons.length > 0 ? asRecord(seasons[0]) : {};

  if (Object.keys(latest).length === 0) {
    throw new Error('No seasons found for tournament in SportsApiPro');
  }

  return latest;
}

function extractRoundNumbers(payload: UnknownRecord): number[] {
  const rounds = asArray(payload.rounds);
  const parsed = rounds
    .map((round) => {
      if (typeof round === 'number') {
        return Math.trunc(round);
      }

      const node = asRecord(round);
      return toInt(node.round ?? node.roundNum ?? node.number ?? node.id ?? node.name);
    })
    .filter((roundNum): roundNum is number => roundNum !== null && roundNum > 0);

  return [...new Set(parsed)].sort((a, b) => a - b);
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
  const competitionId = parseRequiredNumber(req.query.competitionId as string | undefined);

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
  const competitionId = parseRequiredNumber(req.query.competitionId as string | undefined);

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

  if (!Number.isFinite(competitionId)) {
    return res.status(400).json({ message: 'competitionId is required number' });
  }

  try {
    const seasonsPayload = asRecord(await requestSportsApiPro(`/tournaments/${competitionId}/seasons`));
    const latestSeason = extractLatestSeasonFromTournamentSeasons(seasonsPayload);
    const seasonId = toInt(latestSeason.id);

    if (seasonId === null) {
      return res.status(500).json({ message: 'Could not resolve latest season id from SportsApiPro' });
    }

    const roundsPayload = asRecord(await requestSportsApiPro(`/tournament/${competitionId}/season/${seasonId}/rounds`));
    const roundNumbers = extractRoundNumbers(roundsPayload);

    if (roundNumbers.length === 0) {
      return res.status(500).json({ message: 'Could not resolve round numbers from SportsApiPro' });
    }

    const fixture: UnknownRecord[] = [];

    for (const roundNumber of roundNumbers) {
      const roundPayload = asRecord(
        await requestSportsApiPro(`/tournament/${competitionId}/season/${seasonId}/round/${roundNumber}`),
      );

      fixture.push(...mapV2RoundEventsToFixture(roundNumber, roundPayload));
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
      toInt(latestSeason.year) ?? new Date().getUTCFullYear(),
      fixture,
      uniqueTeamsCount,
    );

    const data = {
      tournamentId: competitionId,
      seasonId,
      seasonName: String(latestSeason.name ?? ''),
      seasonYear: String(latestSeason.year ?? ''),
      totalRounds: roundNumbers.length,
      rounds: roundNumbers,
      totalEvents: fixture.length,
      fixture,
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
  const competitionId = parseRequiredNumber(req.query.competitionId as string | undefined);
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
        matchday: { league: { idEnApi: competitionId } },
      }
      : { startDateTime: { $lt: now } };

    const matches = await em.find(Match, where as any, { populate: ['matchday', 'matchday.league'] });

    let updated = 0;
    let skippedWithoutScore = 0;
    let createdPerformances = 0;
    let updatedPerformances = 0;
    let missingLocalPlayers = 0;
    let processedAthleteRankings = 0;
    const errors: Array<{ gameId: string; message: string }> = [];

    for (const match of matches) {
      const gameId = Number.parseInt(String(match.externalApiId ?? ''), 10);

      if (!Number.isFinite(gameId)) {
        skippedWithoutScore += 1;
        continue;
      }
      try {
        // 2 requests por partido: /game para marcador y /match/{id}/lineups para ratings por jugador.
        const gamePayload = (await requestSportsApiPro('/game', { gameId })) as UnknownRecord;
        const game = asRecord(gamePayload.game);
        const home = asRecord(game.homeCompetitor);
        const away = asRecord(game.awayCompetitor);

        const homeScore = toNullableScore(home.score);
        const awayScore = toNullableScore(away.score);

        if (homeScore === null || awayScore === null) {
          match.status = 'scheduled';
          skippedWithoutScore += 1;
          continue;
        }

        match.homeScore = homeScore;
        match.awayScore = awayScore;
        match.status = 'finalizado';

        const lineupsPayload = asRecord(await requestSportsApiPro(`/match/${gameId}/lineups`));
        const rankingRows = extractAthleteRankingRowsFromLineupsPayload(lineupsPayload);
        processedAthleteRankings += rankingRows.length;

        for (const row of rankingRows) {
          const realPlayer = await em.findOne(RealPlayer, { idEnApi: row.athleteId });
          if (!realPlayer) {
            missingLocalPlayers += 1;
            continue;
          }

          let performance = await em.findOne(PlayerPerformance, { realPlayer, matchday: match.matchday, league: match.matchday.league, match });
          if (!performance) {
            performance = em.create(PlayerPerformance, {
              realPlayer,
              matchday: match.matchday,
              pointsObtained: row.ranking,
              league: match.matchday.league,
              match,
              updateDate: new Date(),
            } as any);
            createdPerformances += 1;
          } else {
            performance.pointsObtained = row.ranking;
            performance.updateDate = new Date();
            updatedPerformances += 1;
          }
        }

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
        skippedWithoutScore,
        processedAthleteRankings,
        createdPerformances,
        updatedPerformances,
        missingLocalPlayers,
        errors,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

function extractRankedPlayersFromRatingsPayload(matchResult: any): Array<{ athleteId: number; ranking: number | null; matchDate: string | null; gameId: number | null; }> {
  const lineups = matchResult?.lineupsAndPlayerRankings;
  const matchDate = typeof matchResult?.match?.startTime === 'string' ? matchResult.match.startTime : null;
  const gameId = typeof matchResult?.match?.gameId === 'number' ? matchResult.match.gameId : null;
  const out: Array<{ athleteId: number; ranking: number | null; matchDate: string | null; gameId: number | null; }> = [];

  for (const side of [lineups?.home, lineups?.away]) {
    const sideLineups = Array.isArray(side?.lineups) ? side.lineups : [];
    for (const lineup of sideLineups) {
      const players = Array.isArray(lineup?.players) ? lineup.players : [];
      for (const player of players) {
        const athleteId = Number.parseInt(String(player?.athleteId ?? ''), 10);
        if (!Number.isFinite(athleteId)) continue;

        const ranking = typeof player?.ranking === 'number' ? player.ranking : null;
        out.push({ athleteId, ranking, matchDate, gameId });
      }
    }
  }

  return out;
}

async function getSportsApiProRankingsWithLocalPerformances(req: Request, res: Response) {
  const sportId = parseRequiredNumber(req.query.sportId as string | undefined);
  const competitionId = parseRequiredNumber(req.query.competitionId as string | undefined);

  if (!sportId || !competitionId) {
    return res.status(400).json({ message: 'sportId and competitionId query params are required numbers' });
  }

  try {
    const ratings = await getLatestMatchdayResultsWithPlayerRatingsService(sportId, competitionId);
    const rows = ratings.flatMap((matchResult) => extractRankedPlayersFromRatingsPayload(matchResult));

    const data = [];

    for (const row of rows) {
      const realPlayer = await em.findOne(RealPlayer, { idEnApi: row.athleteId });
      if (!realPlayer) {
        data.push({ ...row, localPlayerId: null, playerPerformance: null, message: 'player not found locally by athleteId' });
        continue;
      }

      const matchDate = row.matchDate ? new Date(row.matchDate) : null;
      let matchdayId: number | null = null;

      if (matchDate) {
        const matchday = await em.findOne(Matchday, {
          league: { idEnApi: competitionId },
          startDate: { $lte: matchDate },
          endDate: { $gte: matchDate },
        });
        matchdayId = matchday?.id ?? null;
      }

      let performance = null;
      if (matchdayId) {
        const localMatch = row.gameId !== null
          ? await em.findOne(Match, { externalApiId: String(row.gameId), matchday: matchdayId })
          : null;

        performance = await em.findOne(PlayerPerformance, {
          realPlayer: realPlayer.id,
          matchday: matchdayId,
          league: { idEnApi: competitionId },
          ...(localMatch ? { match: localMatch.id } : {}),
        });
      }

      data.push({
        ...row,
        localPlayerId: realPlayer.id ?? null,
        playerPerformance: performance
          ? {
            id: performance.id,
            pointsObtained: performance.pointsObtained,
            updateDate: performance.updateDate,
            matchdayId,
            leagueId: performance.league?.id ?? null,
            matchId: performance.match?.id ?? null,
          }
          : null,
      });
    }

    return res.status(200).json({ message: 'sportsapipro rankings mapped to local player performances', data });
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
