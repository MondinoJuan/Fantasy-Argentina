import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { orm } from '../../shared/db/orm.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { PlayerPerformance } from '../PlayerPerformance/playerPerformance.entity.js';
import { GameMatch } from '../GameMatch/gameMatch.entity.js';
import { League } from '../League/league.entity.js';
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
import { getTeamIdsByLeague } from '../RealTeamLeagueParticipation/realTeamLeagueParticipation.service.js';
import { upsertRealPlayerLeagueTranslatedValue } from '../RealPlayerLeagueValue/realPlayerLeagueValue.service.js';
import { RealPlayerLeagueValue } from '../RealPlayerLeagueValue/realPlayerLeagueValue.entity.js';

const em = orm.em;

type UnknownRecord = Record<string, unknown>;
type SyncPlayedResultsJobStatus = 'queued' | 'running' | 'completed' | 'failed';

interface SyncPlayedResultsJobSnapshot {
  jobId: string;
  status: SyncPlayedResultsJobStatus;
  competitionId: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  scannedMatches: number;
  processedMatches: number;
  updatedMatches: number;
  missingPayloadData: number;
  errors: Array<{ gameId: string; message: string }>;
  lastError: string | null;
}

interface SyncPlayedResultsJobState extends SyncPlayedResultsJobSnapshot {
  createdAtDate: Date;
  startedAtDate: Date | null;
  finishedAtDate: Date | null;
}

type BuildFixtureJobStatus = 'queued' | 'running' | 'completed' | 'failed';

interface BuildCompetitionFixtureJobSnapshot {
  jobId: string;
  status: BuildFixtureJobStatus;
  competitionId: number;
  seasonId: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  totalRounds: number;
  totalMatches: number;
  persistStats: unknown | null;
  lastError: string | null;
}

interface BuildCompetitionFixtureJobState extends BuildCompetitionFixtureJobSnapshot {
  createdAtDate: Date;
  startedAtDate: Date | null;
  finishedAtDate: Date | null;
}

const syncPlayedResultsJobs = new Map<string, SyncPlayedResultsJobState>();
const buildCompetitionFixtureJobs = new Map<string, BuildCompetitionFixtureJobState>();
const runningRankingsCompetitions = new Set<number>();
const MAX_SYNC_RESULTS_JOBS_TRACKED = 100;
const MAX_BUILD_FIXTURE_JOBS_TRACKED = 50;
const SYNC_RESULTS_CONCURRENCY = 4;
const rankingsProcessEnabled = (process.env.RANKINGS_PROCESS_ENABLED ?? 'true').toLowerCase() !== 'false';

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

function readPositiveIntEnv(varName: string, fallback: number): number {
  const raw = Number.parseInt(process.env[varName] ?? '', 10);
  if (!Number.isFinite(raw) || raw < 1) {
    return fallback;
  }

  return raw;
}

const RANKINGS_CONCURRENCY = readPositiveIntEnv('RANKINGS_CONCURRENCY', 5);
const RANKINGS_MAX_RATE_LIMIT_ERRORS = readPositiveIntEnv('RANKINGS_MAX_RATE_LIMIT_ERRORS', 5);

function isRateLimitError(error: unknown): boolean {
  const message = String((error as any)?.message ?? error ?? '').toLowerCase();
  return message.includes('429') || message.includes('rate limit') || message.includes('too many requests');
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
    const nonPostponed = orderedByStartTime.filter((game) => {
      const status = String(game.statusText ?? '').toLowerCase();
      return !status.includes('postpon');
    });
    const lastNonPostponedStart = String(nonPostponed[nonPostponed.length - 1]?.startTime ?? '');

    const firstDate = firstStart ? new Date(firstStart) : new Date();
    const lastDate = lastStart ? new Date(lastStart) : firstDate;
    const closureAnchor = lastNonPostponedStart
      ? new Date(lastNonPostponedStart)
      : lastDate;
    const autoUpdateAt = new Date(closureAnchor.getTime() + (4 * 60 * 60 * 1000));

    const startDate = new Date(firstDate);
    const endDate = new Date(lastDate);

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
        autoUpdateAt,
        nextPostponedCheckAt: null,
        status: MATCHDAY_STATUSES[0],
      } as any);
      createdMatchdays += 1;
    } else {
      matchday.startDate = startDate;
      matchday.endDate = endDate;
      matchday.autoUpdateAt = autoUpdateAt;
    }

    if (expectedMatchesPerRound > 0 && group.games.length !== expectedMatchesPerRound) {
      roundsWithUnexpectedMatchCount.push({
        roundNum: group.roundNum,
        totalMatches: group.games.length,
        expectedMatches: expectedMatchesPerRound,
      });
    }

    let hasPostponedMatches = false;
    let hasInProgressMatches = false;
    let hasScheduledMatches = false;
    let allMatchesCompleted = group.games.length > 0;
    for (const fixtureMatch of group.games) {
      const gameId = Number.parseInt(String(fixtureMatch.gameId ?? ''), 10);
      if (!Number.isFinite(gameId)) continue;
      const statusText = String(fixtureMatch.statusText ?? '').toLowerCase();
      if (statusText.includes('postpon')) {
        hasPostponedMatches = true;
      }
      if (statusText.includes('progress') || statusText.includes('live')) {
        hasInProgressMatches = true;
      }
      if (statusText.includes('schedul') || statusText.includes('not started') || statusText.includes('ns')) {
        hasScheduledMatches = true;
      }

      const homeScore = toNullableScore(asRecord(fixtureMatch.home).score);
      const awayScore = toNullableScore(asRecord(fixtureMatch.away).score);
      const hasFinalScore = homeScore !== null && awayScore !== null;
      const hasFinalStatus = statusText.includes('final');
      if (!hasFinalScore && !hasFinalStatus) {
        allMatchesCompleted = false;
      }

      const existing = await em.findOne(GameMatch, { externalApiId: String(gameId) });
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

      em.create(GameMatch, {
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

    if (hasPostponedMatches) {
      const fallbackAnchor = matchday.autoUpdateAt ?? new Date(endDate.getTime() + (4 * 60 * 60 * 1000));
      matchday.nextPostponedCheckAt = new Date(fallbackAnchor.getTime() + (7 * 24 * 60 * 60 * 1000));
    } else {
      matchday.nextPostponedCheckAt = null;
    }

    if (allMatchesCompleted) {
      matchday.status = 'completed';
    } else if (hasPostponedMatches) {
      matchday.status = 'postponed';
    } else if (hasInProgressMatches) {
      matchday.status = 'in_progress';
    } else if (hasScheduledMatches) {
      matchday.status = 'scheduled';
    } else {
      matchday.status = MATCHDAY_STATUSES[0];
    }
  }

  await em.flush();
  return { createdMatchdays, createdMatches, expectedMatchesPerRound, roundsWithUnexpectedMatchCount };
}

function shouldSkipRoundFetch(matchday: Matchday | null, now: Date): boolean {
  if (!matchday) return false;
  if (matchday.status !== 'completed') return false;
  if (matchday.nextPostponedCheckAt && matchday.nextPostponedCheckAt.getTime() > now.getTime()) return false;

  const refreshWindowStart = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
  if (matchday.endDate.getTime() >= refreshWindowStart.getTime()) return false;

  return true;
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

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function buildSyncPlayedResultsJobSnapshot(job: SyncPlayedResultsJobState): SyncPlayedResultsJobSnapshot {
  return {
    jobId: job.jobId,
    status: job.status,
    competitionId: job.competitionId,
    createdAt: job.createdAtDate.toISOString(),
    startedAt: job.startedAtDate ? job.startedAtDate.toISOString() : null,
    finishedAt: job.finishedAtDate ? job.finishedAtDate.toISOString() : null,
    scannedMatches: job.scannedMatches,
    processedMatches: job.processedMatches,
    updatedMatches: job.updatedMatches,
    missingPayloadData: job.missingPayloadData,
    errors: [...job.errors],
    lastError: job.lastError,
  };
}

function buildCompetitionFixtureJobSnapshot(job: BuildCompetitionFixtureJobState): BuildCompetitionFixtureJobSnapshot {
  return {
    jobId: job.jobId,
    status: job.status,
    competitionId: job.competitionId,
    seasonId: job.seasonId,
    createdAt: job.createdAtDate.toISOString(),
    startedAt: job.startedAtDate ? job.startedAtDate.toISOString() : null,
    finishedAt: job.finishedAtDate ? job.finishedAtDate.toISOString() : null,
    totalRounds: job.totalRounds,
    totalMatches: job.totalMatches,
    persistStats: job.persistStats,
    lastError: job.lastError,
  };
}

function pruneSyncPlayedResultsJobs(): void {
  if (syncPlayedResultsJobs.size <= MAX_SYNC_RESULTS_JOBS_TRACKED) {
    return;
  }

  const ordered = [...syncPlayedResultsJobs.values()]
    .sort((a, b) => a.createdAtDate.getTime() - b.createdAtDate.getTime());

  while (ordered.length > MAX_SYNC_RESULTS_JOBS_TRACKED) {
    const oldest = ordered.shift();
    if (!oldest) {
      break;
    }
    syncPlayedResultsJobs.delete(oldest.jobId);
  }
}

function pruneBuildCompetitionFixtureJobs(): void {
  if (buildCompetitionFixtureJobs.size <= MAX_BUILD_FIXTURE_JOBS_TRACKED) {
    return;
  }

  const ordered = [...buildCompetitionFixtureJobs.values()]
    .sort((a, b) => a.createdAtDate.getTime() - b.createdAtDate.getTime());

  while (ordered.length > MAX_BUILD_FIXTURE_JOBS_TRACKED) {
    const oldest = ordered.shift();
    if (!oldest) {
      break;
    }
    buildCompetitionFixtureJobs.delete(oldest.jobId);
  }
}

function getRunningSyncPlayedResultsJobByCompetition(competitionId: number): SyncPlayedResultsJobState | null {
  for (const job of syncPlayedResultsJobs.values()) {
    if (job.competitionId === competitionId && (job.status === 'queued' || job.status === 'running')) {
      return job;
    }
  }

  return null;
}

function getRunningBuildCompetitionFixtureJob(
  competitionId: number,
  seasonId: number,
): BuildCompetitionFixtureJobState | null {
  for (const job of buildCompetitionFixtureJobs.values()) {
    if (
      job.competitionId === competitionId
      && job.seasonId === seasonId
      && (job.status === 'queued' || job.status === 'running')
    ) {
      return job;
    }
  }

  return null;
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



async function buildCompetitionFixtureProcess(competitionId: number, seasonId: number) {
  const roundsPayload = asRecord(await requestSportsApiPro(`/api/tournament/${competitionId}/season/${seasonId}/rounds`));
  if (roundsPayload.success !== true) {
    throw new Error(`La API devolvió success=false en rounds. Respuesta: ${JSON.stringify(roundsPayload)}`);
  }

  const league = await em.findOne(League, { idEnApi: competitionId });
  if (!league) {
    throw new Error('league must exist locally. Use superadmin sync first.');
  }

  const roundNumbers = extractRoundNumbers(roundsPayload);
  const roundsSummary: Array<{ round: number; matchCount: number; matches: UnknownRecord[]; skipped?: boolean; error?: string }> = [];
  const roundsFailed: Array<{ round: number; error: string }> = [];
  const roundsWithUnexpectedMatchCount: Array<{ roundNum: number; totalMatches: number; expectedMatches: number }> = [];
  let createdMatchdays = 0;
  let createdMatches = 0;
  let totalRoundsPersisted = 0;
  let totalMatchesPersisted = 0;
  const now = new Date();

  for (const roundNumber of roundNumbers) {
    const existingMatchday = await em.findOne(Matchday, {
      league,
      season: String(seasonId),
      matchdayNumber: roundNumber,
    });

    if (shouldSkipRoundFetch(existingMatchday, now)) {
      roundsSummary.push({ round: roundNumber, matchCount: 0, matches: [], skipped: true });
      continue;
    }

    try {
      const roundPayload = asRecord(
        await requestSportsApiPro(`/api/tournament/${competitionId}/season/${seasonId}/round/${roundNumber}`),
      );
      if (roundPayload.success !== true) {
        throw new Error(`La API devolvió success=false en round=${roundNumber}. Respuesta: ${JSON.stringify(roundPayload)}`);
      }

      const roundFixture = mapV2RoundEventsToFixture(roundNumber, roundPayload);
      const uniqueTeamsInRound = new Set(
        roundFixture.flatMap((match) => {
          const homeTeam = String(asRecord(match.home).name ?? '').trim();
          const awayTeam = String(asRecord(match.away).name ?? '').trim();
          return [homeTeam, awayTeam].filter((team) => team.length > 0);
        }),
      ).size;

      const persistStats = await persistFixtureCompetitionInDb(
        competitionId,
        seasonId,
        roundFixture,
        uniqueTeamsInRound,
      );

      createdMatchdays += Number(persistStats.createdMatchdays ?? 0);
      createdMatches += Number(persistStats.createdMatches ?? 0);
      roundsWithUnexpectedMatchCount.push(...(persistStats.roundsWithUnexpectedMatchCount ?? []));
      totalRoundsPersisted += 1;
      totalMatchesPersisted += roundFixture.length;

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
    } catch (error: any) {
      const errorMessage = error?.message ?? `Error desconocido en round=${roundNumber}`;
      roundsFailed.push({ round: roundNumber, error: errorMessage });
      roundsSummary.push({
        round: roundNumber,
        matchCount: 0,
        matches: [],
        error: errorMessage,
      });
    }
  }

  return {
    data: {
      tournamentId: competitionId,
      seasonId,
      totalRounds: totalRoundsPersisted,
      rounds: roundsSummary,
    },
    persistStats: {
      createdMatchdays,
      createdMatches,
      roundsWithUnexpectedMatchCount,
      roundsFailed,
    },
    totalRounds: totalRoundsPersisted,
    totalMatches: totalMatchesPersisted,
    hasErrors: roundsFailed.length > 0,
  };
}

async function runBuildCompetitionFixtureJob(jobId: string): Promise<void> {
  const job = buildCompetitionFixtureJobs.get(jobId);
  if (!job) {
    return;
  }

  job.status = 'running';
  job.startedAtDate = new Date();

  try {
    const result = await buildCompetitionFixtureProcess(job.competitionId, job.seasonId);
    job.totalRounds = result.totalRounds;
    job.totalMatches = result.totalMatches;
    job.persistStats = result.persistStats;
    job.status = result.hasErrors ? 'failed' : 'completed';
    job.lastError = result.hasErrors
      ? 'Fixture persistido parcialmente. Revisar persistStats.roundsFailed para los rounds con error.'
      : null;
  } catch (error: any) {
    job.status = 'failed';
    job.lastError = error?.message ?? 'Unknown fixture build failure';
  } finally {
    job.finishedAtDate = new Date();
    job.startedAt = job.startedAtDate ? job.startedAtDate.toISOString() : null;
    job.finishedAt = job.finishedAtDate.toISOString();
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

  const existingRunningJob = getRunningBuildCompetitionFixtureJob(competitionId, seasonId);
  if (existingRunningJob) {
    return res.status(409).json({
      message: 'fixture build already running for tournament/season',
      data: buildCompetitionFixtureJobSnapshot(existingRunningJob),
    });
  }

  const createdAt = new Date();
  const job: BuildCompetitionFixtureJobState = {
    jobId: randomUUID(),
    status: 'queued',
    competitionId,
    seasonId,
    createdAt: createdAt.toISOString(),
    startedAt: null,
    finishedAt: null,
    totalRounds: 0,
    totalMatches: 0,
    persistStats: null,
    lastError: null,
    createdAtDate: createdAt,
    startedAtDate: null,
    finishedAtDate: null,
  };

  buildCompetitionFixtureJobs.set(job.jobId, job);
  pruneBuildCompetitionFixtureJobs();
  void runBuildCompetitionFixtureJob(job.jobId);

  return res.status(202).json({
    message: 'fixture build job started',
    data: buildCompetitionFixtureJobSnapshot(job),
  });
}

async function getSportsApiProBuildCompetitionFixtureJob(req: Request, res: Response) {
  const jobId = typeof req.params.jobId === 'string' ? req.params.jobId.trim() : '';
  if (!jobId) {
    return res.status(400).json({ message: 'jobId route param is required' });
  }

  const job = buildCompetitionFixtureJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ message: 'fixture build job not found' });
  }

  return res.status(200).json({
    message: 'fixture build job status',
    data: buildCompetitionFixtureJobSnapshot(job),
  });
}
/*
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
    const matches = await em.find(GameMatch, matchesWhere as any, { populate: ['matchday', 'matchday.league'] });

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
*/

async function getSportsApiProLocalPersistedFixture(req: Request, res: Response) {
  try {
    const competitionId = parseRequiredNumber(
      (Array.isArray(req.query.competitionId) ? req.query.competitionId[0] : req.query.competitionId) as string | undefined
    );

    const leagueId = parseRequiredNumber(
      (Array.isArray(req.query.leagueId) ? req.query.leagueId[0] : req.query.leagueId) as string | undefined
    );

    const matchdaysWhere = leagueId
      ? { league: { id: leagueId } }
      : competitionId
        ? { league: { idEnApi: competitionId } }
        : {};

    const matchesWhere = leagueId
      ? { league: { id: leagueId } }
      : competitionId
        ? { league: { idEnApi: competitionId } }
        : {};

    const matchdays = await em.find(Matchday, matchdaysWhere as any, { populate: ['league'] });
    const matches = await em.find(GameMatch, matchesWhere as any, { populate: ['matchday', 'league'] });

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
    console.error('getSportsApiProLocalPersistedFixture error:', error);
    return res.status(500).json({ message: error.message });
  }
}

async function runSyncPlayedResultsJob(jobId: string): Promise<void> {
  const job = syncPlayedResultsJobs.get(jobId);
  if (!job) {
    return;
  }

  job.status = 'running';
  job.startedAtDate = new Date();

  try {
    const jobEm = orm.em.fork();
    const now = new Date();
    const where = {
      startDateTime: { $lt: now },
      status: { $ne: 'finalizado' },
      matchday: { league: { idEnApi: job.competitionId } },
    };

    const matches = await jobEm.find(GameMatch, where as any, { populate: ['matchday', 'matchday.league'] });
    job.scannedMatches = matches.length;

    const processMatch = async (match: GameMatch) => {
      const gameId = Number.parseInt(String(match.externalApiId ?? ''), 10);

      if (!Number.isFinite(gameId)) {
        job.missingPayloadData += 1;
        job.processedMatches += 1;
        return;
      }

      try {
        const apiPayload = asRecord(await requestSportsApiPro(`/api/match/${gameId}`));
        const apiMatch = extractMatchNodeFromMatchPayload(apiPayload);

        if (Object.keys(apiMatch).length === 0) {
          job.missingPayloadData += 1;
          job.processedMatches += 1;
          return;
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

        job.updatedMatches += 1;
      } catch (error: any) {
        job.errors.push({ gameId: String(match.externalApiId), message: error?.message ?? 'unknown error' });
      } finally {
        job.processedMatches += 1;
      }
    };

    for (let index = 0; index < matches.length; index += SYNC_RESULTS_CONCURRENCY) {
      const chunk = matches.slice(index, index + SYNC_RESULTS_CONCURRENCY);
      await Promise.all(chunk.map((match) => processMatch(match)));
      await jobEm.flush();
    }

    job.status = 'completed';
  } catch (error: any) {
    job.status = 'failed';
    job.lastError = error?.message ?? 'Unknown sync failure';
  } finally {
    job.finishedAtDate = new Date();
    pruneSyncPlayedResultsJobs();
  }
}

async function syncPlayedMatchesResultsForCompetition(competitionId: number): Promise<{
  scannedMatches: number;
  processedMatches: number;
  updatedMatches: number;
  missingPayloadData: number;
  errors: Array<{ gameId: string; message: string }>;
}> {
  const jobEm = orm.em.fork();
  const now = new Date();
  const where = {
    startDateTime: { $lt: now },
    status: { $ne: 'finalizado' },
    matchday: { league: { idEnApi: competitionId } },
  };

  const matches = await jobEm.find(GameMatch, where as any, { populate: ['matchday', 'matchday.league'] });
  const result = {
    scannedMatches: matches.length,
    processedMatches: 0,
    updatedMatches: 0,
    missingPayloadData: 0,
    errors: [] as Array<{ gameId: string; message: string }>,
  };

  const processMatch = async (match: GameMatch) => {
    const gameId = Number.parseInt(String(match.externalApiId ?? ''), 10);

    if (!Number.isFinite(gameId)) {
      result.missingPayloadData += 1;
      result.processedMatches += 1;
      return;
    }

    try {
      const apiPayload = asRecord(await requestSportsApiPro(`/api/match/${gameId}`));
      const apiMatch = extractMatchNodeFromMatchPayload(apiPayload);

      if (Object.keys(apiMatch).length === 0) {
        result.missingPayloadData += 1;
        result.processedMatches += 1;
        return;
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

      result.updatedMatches += 1;
    } catch (error: any) {
      result.errors.push({ gameId: String(match.externalApiId), message: error?.message ?? 'unknown error' });
    } finally {
      result.processedMatches += 1;
    }
  };

  for (let index = 0; index < matches.length; index += SYNC_RESULTS_CONCURRENCY) {
    const chunk = matches.slice(index, index + SYNC_RESULTS_CONCURRENCY);
    await Promise.all(chunk.map((match) => processMatch(match)));
    await jobEm.flush();
  }

  return result;
}

async function postSportsApiProSyncPlayedMatchesResults(req: Request, res: Response) {
  const competitionId = parseOptionalNumber(req.body?.competitionId)
    ?? parseOptionalNumber(Array.isArray(req.query.competitionId) ? req.query.competitionId[0] : req.query.competitionId);

  if (!competitionId || competitionId <= 0) {
    return res.status(400).json({ message: 'competitionId (number > 0) is required' });
  }

  const existingRunningJob = getRunningSyncPlayedResultsJobByCompetition(competitionId);
  if (existingRunningJob) {
    return res.status(409).json({
      message: 'sync already running for competition',
      data: buildSyncPlayedResultsJobSnapshot(existingRunningJob),
    });
  }

  const createdAt = new Date();
  const job: SyncPlayedResultsJobState = {
    jobId: randomUUID(),
    status: 'queued',
    competitionId,
    createdAt: createdAt.toISOString(),
    startedAt: null,
    finishedAt: null,
    scannedMatches: 0,
    processedMatches: 0,
    updatedMatches: 0,
    missingPayloadData: 0,
    errors: [],
    lastError: null,
    createdAtDate: createdAt,
    startedAtDate: null,
    finishedAtDate: null,
  };

  syncPlayedResultsJobs.set(job.jobId, job);
  pruneSyncPlayedResultsJobs();

  void runSyncPlayedResultsJob(job.jobId);

  return res.status(202).json({
    message: 'played matches sync job started',
    data: buildSyncPlayedResultsJobSnapshot(job),
  });
}

async function getSportsApiProSyncPlayedMatchesResultsJob(req: Request, res: Response) {
  const jobId = typeof req.params.jobId === 'string' ? req.params.jobId.trim() : '';
  if (!jobId) {
    return res.status(400).json({ message: 'jobId route param is required' });
  }

  const job = syncPlayedResultsJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ message: 'sync job not found' });
  }

  return res.status(200).json({
    message: 'played matches sync job status',
    data: buildSyncPlayedResultsJobSnapshot(job),
  });
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

async function updateRealPlayerTranslatedValuesByLatestFormForCompetition(competitionId: number, localEm: typeof orm.em) {
  const league = await localEm.findOne(League, { idEnApi: competitionId });
  if (!league) return { skipped: true, reason: 'league not found locally' };
  const limiteMin = typeof league.limiteMin === 'number' && Number.isFinite(league.limiteMin)
    ? Number(league.limiteMin)
    : 1_000_000;
  const limiteMax = typeof league.limiteMax === 'number' && Number.isFinite(league.limiteMax)
    ? Number(league.limiteMax)
    : 7_000_000;
  const range = limiteMax - limiteMin;

  if (!Number.isFinite(range) || range <= 0) {
    return { skipped: true, reason: 'invalid league limits', limiteMin, limiteMax, leagueId: league.id };
  }

  const resolvedLeagueId = Number(league.id);
  if (!Number.isFinite(resolvedLeagueId) || resolvedLeagueId <= 0) {
    return { skipped: true, reason: 'invalid league id' };
  }

  const teamIds = await getTeamIdsByLeague(localEm as any, resolvedLeagueId);

  if (teamIds.length === 0) {
    return { skipped: true, reason: 'no real teams in league', leagueId: league.id };
  }

  const players = await localEm.find(RealPlayer, { realTeam: { $in: teamIds } } as any);

  // ✅ UNA sola query para todas las performances de todos los jugadores
  const playerIds = players.map((p: any) => p.id);
  const allPerformances = await localEm.find(
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
    const currentLeagueTranslatedValue = await localEm.findOne(
      RealPlayerLeagueValue as any,
      { realPlayer: { id: Number((player as any).id) }, league: { id: resolvedLeagueId } } as any,
    );
    const currentLeagueTranslatedValueNumber = Number((currentLeagueTranslatedValue as any)?.translatedValue);
    const valorTradActual =
      Number.isFinite(currentLeagueTranslatedValueNumber)
        ? currentLeagueTranslatedValueNumber
        : limiteMin;

    const pRaw = (valorTradActual - limiteMin) / range;
    const p = clamp(Number.isFinite(pRaw) ? pRaw : 0, 0, 1);
    const notaEsperada = p * 10;
    const desvio = scoreForm - notaEsperada;

    if (desvio === 0) {
      await upsertRealPlayerLeagueTranslatedValue(localEm as any, {
        realPlayer: player,
        league,
        translatedValue: clamp(valorTradActual, limiteMin, limiteMax),
      });
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

    await upsertRealPlayerLeagueTranslatedValue(localEm as any, {
      realPlayer: player,
      league,
      translatedValue: clamp(nuevoValor, limiteMin, limiteMax),
    });
    updatedPlayers += 1;
  }

  await localEm.flush();

  return {
    skipped: false,
    leagueId: league.id,
    limiteMin,
    limiteMax,
    playersInLeague: players.length,
    updatedPlayers,
  };
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const queue = items.map((item, index) => ({ item, index }));
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift()!;
      await fn(next.item, next.index);
    }
  });
  await Promise.all(workers);
}

async function getSportsApiProRankingsWithLocalPerformances(req: Request, res: Response) {
  const competitionId = parseRequiredNumber(req.body?.competitionId as string | undefined);

  if (!competitionId) {
    return res.status(400).json({ message: 'competitionId body param is required number' });
  }
  if (!rankingsProcessEnabled) {
    return res.status(503).json({
      message: 'rankings process disabled by env (RANKINGS_PROCESS_ENABLED=false)',
      competitionId,
    });
  }

  if (runningRankingsCompetitions.has(competitionId)) {
    return res.status(409).json({
      message: 'rankings process already running for competition',
      competitionId,
    });
  }

  if (runningRankingsCompetitions.has(competitionId)) {
    return res.status(409).json({
      message: 'rankings process already running for competition',
      competitionId,
    });
  }

  // Responde inmediatamente
  res.status(202).json({ message: 'processing started', competitionId });

  // Procesa en background con su propio em forkeado
  void runRankingsProcessWithCompetitionLock(competitionId).catch((err: any) => {
    console.error(`[rankings][competition=${competitionId}] background run failed:`, err?.message ?? err);
  });
}

async function runRankingsProcessWithCompetitionLock(competitionId: number): Promise<void> {
  if (runningRankingsCompetitions.has(competitionId)) {
    return;
  }

  runningRankingsCompetitions.add(competitionId);
  try {
    const forkedEm = orm.em.fork();
    await processRankingsInBackground(competitionId, forkedEm);
  } catch (err: any) {
    console.error('[rankings-background] error:', err?.message ?? err);
    throw err;
  } finally {
    runningRankingsCompetitions.delete(competitionId);
  }
}

async function processRankingsInBackground(competitionId: number, localEm: typeof orm.em) {
  const tag = `[rankings][competition=${competitionId}]`;
  const startedAt = Date.now();
  console.log(`${tag} ▶ Inicio del proceso`);

  // ─── 1. Buscar partidos finalizados ───────────────────────────────────────
  console.log(`${tag} 🔍 Buscando partidos finalizados en la DB...`);
  const matches = await localEm.find(
    GameMatch,
    { status: 'finalizado', matchday: { league: { idEnApi: competitionId } } } as any,
    { populate: ['matchday', 'matchday.league'] },
  );
  console.log(`${tag} ✅ ${matches.length} partidos encontrados`);

  if (matches.length === 0) {
    console.log(`${tag} ⚠️  Sin partidos para procesar. Finalizando.`);
    return;
  }

  // ─── 2. Precarga: RealPlayers en memoria ─────────────────────────────────
  console.log(`${tag} 🔍 Precargando jugadores reales desde la DB...`);
  const league = await localEm.findOne(League, { idEnApi: competitionId });
  if (!league) throw new Error('League not found');

  const allRealPlayers = await localEm.find(RealPlayer, {} as any);
  const realPlayerByApiId = new Map<number, typeof allRealPlayers[0]>();
  for (const p of allRealPlayers) {
    if ((p as any).idEnApi) realPlayerByApiId.set(Number((p as any).idEnApi), p);
  }
  console.log(`${tag} ✅ ${realPlayerByApiId.size} jugadores cargados en memoria`);

  // ─── 3. Precarga: PlayerPerformances existentes en memoria ───────────────
  console.log(`${tag} 🔍 Precargando performances existentes desde la DB...`);
  const matchIds = matches.map((m) => m.id);
  const allPerformances = await localEm.find(
    PlayerPerformance,
    { match: { $in: matchIds }, league: { id: league.id } } as any,
  );
  const performanceMap = new Map<string, typeof allPerformances[0]>();
  for (const perf of allPerformances) {
    const pid = Number((perf as any).realPlayer?.id ?? (perf as any).realPlayer);
    const mid = Number((perf as any).match?.id ?? (perf as any).match);
    performanceMap.set(`${pid}_${mid}`, perf);
  }
  console.log(`${tag} ✅ ${allPerformances.length} performances existentes cargadas en memoria`);

  // ─── 4. Requests a la API en paralelo (máx 5 simultáneos) ────────────────
  let processedMatches = 0;
  let processedPlayers = 0;
  let createdPerformances = 0;
  let updatedPerformances = 0;
  let missingLocalPlayers = 0;
  let rateLimitErrors = 0;
  let abortedByRateLimit = false;
  const errors: Array<{ matchId: number; message: string }> = [];

  console.log(`${tag} 🌐 Iniciando requests a la API externa (máx ${RANKINGS_CONCURRENCY} en paralelo)...`);

  await runWithConcurrency(matches, RANKINGS_CONCURRENCY, async (match, index) => {
    if (abortedByRateLimit) return;

    const apiMatchId = Number.parseInt(String(match.externalApiId ?? ''), 10);
    if (!Number.isFinite(apiMatchId)) return;

    const matchLabel = `partido ${index + 1}/${matches.length} [apiId=${apiMatchId}]`;
    console.log(`${tag}   → Procesando ${matchLabel} | ${match.homeTeam} vs ${match.awayTeam}`);

    try {
      const payload = asRecord(await requestSportsApiPro(`/api/match/${apiMatchId}/lineups`));
      if (payload.success !== true) {
        console.warn(`${tag}   ⚠️  ${matchLabel}: lineups success=false, se omite`);
        errors.push({ matchId: apiMatchId, message: 'lineups success=false' });
        return;
      }

      const data = asRecord(payload.data);
      const allPlayers = [
        ...asArray(asRecord(data.home).players),
        ...asArray(asRecord(data.away).players),
      ];

      let playersInMatch = 0;

      for (const playerNode of allPlayers) {
        const row = asRecord(playerNode);
        if (row.played !== true) continue;

        const player = asRecord(row.player);
        const statistics = asRecord(row.statistics);

        const playerIdEnApi = Number.parseInt(String(player.id ?? ''), 10);
        if (!Number.isFinite(playerIdEnApi)) continue;

        // Lookup en memoria — sin query a la DB
        const realPlayer = realPlayerByApiId.get(playerIdEnApi);
        if (!realPlayer) {
          missingLocalPlayers += 1;
          continue;
        }

        const ratingRaw = statistics.rating;
        const rating = typeof ratingRaw === 'number'
          ? ratingRaw
          : Number.parseFloat(String(ratingRaw ?? '0'));
        const normalizedRating = Number.isFinite(rating) ? rating : 0;

        const perfKey = `${(realPlayer as any).id}_${match.id}`;
        const performance = performanceMap.get(perfKey);

        if (!performance) {
          localEm.create(PlayerPerformance, {
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
        playersInMatch += 1;
      }

      processedMatches += 1;
      console.log(`${tag}   ✅ ${matchLabel}: ${playersInMatch} jugadores procesados`);
    } catch (error: any) {
      console.error(`${tag}   ❌ ${matchLabel}: ${error?.message ?? 'unknown error'}`);
      errors.push({ matchId: apiMatchId, message: error?.message ?? 'unknown error' });
      if (isRateLimitError(error)) {
        rateLimitErrors += 1;
        if (rateLimitErrors >= RANKINGS_MAX_RATE_LIMIT_ERRORS) {
          abortedByRateLimit = true;
          console.error(
            `${tag} 🛑 Corte preventivo: se alcanzó el límite de errores 429 (${rateLimitErrors}/${RANKINGS_MAX_RATE_LIMIT_ERRORS}).`,
          );
        }
      }
    }
  });

  // ─── 5. Guardar en DB ─────────────────────────────────────────────────────
  console.log(`${tag} 💾 Guardando performances en la DB...`);
  await localEm.flush();
  console.log(`${tag} ✅ Flush completado (created=${createdPerformances}, updated=${updatedPerformances})`);

  // ─── 6. Actualizar valores de jugadores ───────────────────────────────────
  console.log(`${tag} 📊 Actualizando translatedValues de jugadores...`);
  await updateRealPlayerTranslatedValuesByLatestFormForCompetition(competitionId, localEm);
  console.log(`${tag} ✅ TranslatedValues actualizados`);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`${tag} 🏁 Proceso finalizado en ${elapsed}s`, {
    processedMatches,
    processedPlayers,
    createdPerformances,
    updatedPerformances,
    missingLocalPlayers,
    rateLimitErrors,
    abortedByRateLimit,
    errors: errors.length > 0 ? errors : 'ninguno',
  });
}

async function processRankingsForCompetition(competitionId: number): Promise<void> {
  if (!rankingsProcessEnabled) {
    console.log(`[rankings][competition=${competitionId}] ⏸️ Proceso deshabilitado por env (RANKINGS_PROCESS_ENABLED=false)`);
    return;
  }

  if (runningRankingsCompetitions.has(competitionId)) {
    console.log(`[rankings][competition=${competitionId}] ⏭️ Proceso ya en ejecución, se omite trigger duplicado`);
    return;
  }

  await runRankingsProcessWithCompetitionLock(competitionId);
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
  getSportsApiProBuildCompetitionFixtureJob,
  getSportsApiProLocalPersistedFixture,
  getSportsApiProRankingsWithLocalPerformances,
  postSportsApiProSyncPlayedMatchesResults,
  getSportsApiProSyncPlayedMatchesResultsJob,
  syncPlayedMatchesResultsForCompetition,
  processRankingsForCompetition,
};
