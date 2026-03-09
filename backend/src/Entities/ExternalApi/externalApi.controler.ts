import { Request, Response } from 'express';
import { orm } from '../../shared/db/orm.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { PlayerPerformance } from '../PlayerPerformance/playerPerformance.entity.js';
import { Match } from '../Match/match.entity.js';
import { League } from '../League/league.entity.js';
import { MATCHDAY_STATUSES, MATCH_STATUSES, isEnumValue } from '../../shared/domain-enums.js';
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

      const existing = await em.findOne(Match, { externalApiId: String(gameId) });
      if (existing) continue;

      em.create(Match, {
        matchday,
        externalApiId: String(gameId),
        homeTeam: String(asRecord(fixtureMatch.home).name ?? 'TBD'),
        awayTeam: String(asRecord(fixtureMatch.away).name ?? 'TBD'),
        startDateTime: new Date(String(fixtureMatch.startTime ?? startDate.toISOString())),
        status: isEnumValue(MATCH_STATUSES, fixtureMatch.statusText) ? fixtureMatch.statusText : MATCH_STATUSES[0],
      } as any);
      createdMatches += 1;
    }
  }

  await em.flush();
  return { createdMatchdays, createdMatches, expectedMatchesPerRound, roundsWithUnexpectedMatchCount };
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
  const sportId = Number.parseInt(String(req.body?.sportId ?? ''), 10);
  const competitionId = Number.parseInt(String(req.body?.competitionId ?? ''), 10);

  if (!Number.isFinite(sportId) || !Number.isFinite(competitionId)) {
    return res.status(400).json({ message: 'sportId and competitionId are required numbers' });
  }

  try {
    const competitionData = await getCompetitionTeamsBySportAndCompetitionService(sportId, competitionId);
    const fixtureRefs = await collectFixtureEventRefsFromTeamsService({
      competitionId,
      seasonNum: competitionData.seasonNum ?? new Date().getUTCFullYear(),
      stageNum: competitionData.stageNum ?? 1,
      teams: competitionData.teams.map((team) => ({ id: team.id, name: team.name ?? undefined })),
    });

    // Evitamos llamar /game por cada evento: usamos directamente lo recolectado en /games/fixtures y /games/results.
    const fixture = fixtureRefs.eventRefs.map((eventRef) => ({
      gameId: eventRef.gameId,
      matchupId: `${eventRef.homeCompetitorId ?? 'na'}-${eventRef.awayCompetitorId ?? 'na'}-${eventRef.competitionId}`,
      competitionId: eventRef.competitionId,
      seasonNum: eventRef.seasonNum,
      stageNum: eventRef.stageNum,
      roundNum: eventRef.roundNum,
      statusGroup: eventRef.statusGroup,
      statusText: eventRef.statusText,
      startTime: eventRef.startTime,
      home: {
        id: eventRef.homeCompetitorId,
        name: eventRef.homeCompetitorName,
        score: eventRef.homeCompetitorScore,
      },
      away: {
        id: eventRef.awayCompetitorId,
        name: eventRef.awayCompetitorName,
        score: eventRef.awayCompetitorScore,
      },
      result: eventRef.homeCompetitorScore !== null && eventRef.awayCompetitorScore !== null
        ? `${eventRef.homeCompetitorScore}-${eventRef.awayCompetitorScore}`
        : null,
      source: eventRef.source,
    }));

    const persistStats = await persistFixtureCompetitionInDb(
      competitionId,
      competitionData.seasonNum ?? new Date().getUTCFullYear(),
      fixture as UnknownRecord[],
      competitionData.teams.length,
    );

    const data = { totalEvents: fixture.length, fixture };
    return res.status(200).json({
      message: 'sportsapipro competition fixture built and persisted',
      data,
      fixtureStats: fixtureRefs.stats,
      persistStats,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getSportsApiProLocalPersistedFixture(req: Request, res: Response) {
  const competitionId = parseRequiredNumber(req.query.competitionId as string | undefined);

  try {
    const matchdaysWhere = competitionId ? { league: { idEnApi: competitionId } } : {};
    const matchesWhere = competitionId ? { matchday: { league: { idEnApi: competitionId } } } : {};

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
        performance = await em.findOne(PlayerPerformance, { realPlayer: realPlayer.id, matchday: matchdayId });
      }

      data.push({
        ...row,
        localPlayerId: realPlayer.id ?? null,
        playerPerformance: performance
          ? {
            id: performance.id,
            pointsObtained: performance.pointsObtained,
            played: performance.played,
            updateDate: performance.updateDate,
            matchdayId,
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
};
