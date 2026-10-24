import { startTournament } from '../../shared/services/tournamentStart.service.js';
import { gameError } from '../../shared/http/game-error.js';
import { LockMode, EntityManager } from '@mikro-orm/core';
import { reconcileOwnership, recordInitialBudget } from '../../shared/services/gameEconomy.service.js';
import { money } from '../../shared/domain/game-rules.js';
import { RealPlayerLeagueValue } from '../RealPlayerLeagueValue/realPlayerLeagueValue.entity.js';
import { Request, Response, NextFunction } from 'express';
import { writeFile, readFile } from 'node:fs/promises';
import { Tournament } from './tournament.entity.js';
import { orm } from '../../shared/db/orm.js';
import { Participant } from '../Participant/participant.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { League } from '../League/league.entity.js';
import { RealTeam } from '../RealTeam/realTeam.entity.js';
import { GameMatch } from '../GameMatch/gameMatch.entity.js';
import { getCompetitionTeamsBySportAndCompetitionService } from '../ExternalApi/services/index.js';
import { requestSportsApiPro } from '../../integrations/sportsapipro/sportsapipro.client.js';
import { PlayerPerformance } from '../PlayerPerformance/playerPerformance.entity.js';
import { ParticipantMatchdayPoints } from '../ParticipantMatchdayPoints/participantMatchdayPoints.entity.js';
import { MatchdayAutomationJob } from '../MatchdayAutomationJob/matchdayAutomationJob.entity.js';
import { TOURNAMENT_STATUSES, MATCHDAY_STATUSES, MATCH_STATUSES, MARKET_ORIGINS, isEnumValue } from '../../shared/domain-enums.js';
import { setupParticipantAfterJoin } from './tournament-participation.service.js';
import { serverNow } from '../../shared/time/serverClock.js';
import { getTeamIdsByLeague } from '../RealTeamLeagueParticipation/realTeamLeagueParticipation.service.js';
import { upsertRealPlayerLeagueTranslatedValue } from '../RealPlayerLeagueValue/realPlayerLeagueValue.service.js';
import { readScope } from '../../shared/security/game-access.js';
import { recalculateMatchdayPoints } from './services/matchdayPoints.service.js';
import { runLeagueMatchdayClosure } from '../../automation/matchdayAutomation.service.js';
import { LineupHistoryError } from '../../shared/domain/lineup-history.js';

const em = orm.em;
const idOfMatch = (value: any) => Number(value?.id ?? value);
const POSTPONED_MATCHES_PATH = 'src/Entities/Tournament/data/postponedMatches.json';
const FIXED_TRANSLATED_MIN = 1_000_000;
const FIXED_TRANSLATED_MAX = 7_000_000;
const DEFAULT_INITIAL_BUDGET = 20_000_000;


function generateTournamentPublicCodeCandidate(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';

  for (let index = 0; index < 8; index += 1) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return `T-${token}`;
}

async function generateUniqueTournamentPublicCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = generateTournamentPublicCodeCandidate();
    const existing = await em.findOne(Tournament, { publicCode: candidate });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error('could not generate unique tournament public code');
}

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeTournamentInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeTournamentInput = {
    name: req.body.name,
    league: req.body.league ?? req.body.leagueId,
    sport: req.body.sport,
    sportId: req.body.sportId,
    competitionId: req.body.competitionId,
    initialBudget: req.body.initialBudget,
    squadSize: req.body.squadSize,
    status: req.body.status,
    clauseWaitDays: toInt(req.body.clauseWaitDays),
    allowSquadChangesDuringMatchday: toBoolean(req.body.allowSquadChangesDuringMatchday),
    allowClauseExecutionDuringMatchday: toBoolean(req.body.allowClauseExecutionDuringMatchday),
    creatorUserId: req.body.creatorUserId,
  };

  Object.keys(req.body.sanitizeTournamentInput).forEach((key) => {
    if (req.body.sanitizeTournamentInput[key] === undefined) {
      delete req.body.sanitizeTournamentInput[key];
    }
  });
  next();
}

type UnknownRecord = Record<string, unknown>;

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}


function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  return null;
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function pickRandom<T>(values: T[], limit: number): T[] {
  const clone = [...values];
  const selected: T[] = [];

  while (clone.length > 0 && selected.length < limit) {
    const index = Math.floor(Math.random() * clone.length);
    selected.push(clone[index]);
    clone.splice(index, 1);
  }

  return selected;
}

function groupFixtureByDate(fixture: UnknownRecord[]): Array<{ key: string; games: UnknownRecord[] }> {
  const byDate = new Map<string, UnknownRecord[]>();

  for (const game of fixture) {
    const startTime = typeof game.startTime === 'string' ? game.startTime : null;
    const parsed = startTime ? new Date(startTime) : new Date();
    const key = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`;

    const current = byDate.get(key) ?? [];
    current.push(game);
    byDate.set(key, current);
  }

  return [...byDate.entries()]
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([key, games]) => ({ key, games }));
}

function findSquadMembers(node: unknown): UnknownRecord[] {
  const found: UnknownRecord[] = [];

  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (!value || typeof value !== 'object') {
      return;
    }

    const record = value as UnknownRecord;

    if (toInt(record.athleteId ?? record.id) !== null) {
      found.push(record);
    }

    for (const nested of Object.values(record)) {
      walk(nested);
    }
  };

  walk(node);
  return found;
}

function normalizeApiPositionToDomain(positionRaw: unknown): 'goalkeeper' | 'defender' | 'midfielder' | 'forward' {
  const position = typeof positionRaw === 'string' ? positionRaw.trim().toLowerCase() : '';

  if (!position) {
    return 'midfielder';
  }

  if (position.includes('goal')) {
    return 'goalkeeper';
  }

  if (position.includes('def') || position.includes('back') || position.includes('center-back') || position.includes('full-back') || position.includes('wing-back')) {
    return 'defender';
  }

  if (position.includes('mid') || position.includes('rm') || position.includes('lm')) {
    return 'midfielder';
  }

  if (position.includes('att') || position.includes('for') || position.includes('strik') || position.includes('second striker') || position.includes('center-forward') || position.includes('right wing') || position.includes('left wing') || position.includes('right-wing') || position.includes('left-wing') || position.includes('winger')) {
    return 'forward';
  }

  return 'midfielder';
}

async function fetchAthleteProfileById(athleteId: number): Promise<{ id: number; name: string; position: 'goalkeeper' | 'defender' | 'midfielder' | 'forward'; }> {
  const payload = (await requestSportsApiPro('/athletes', {
    athletes: athleteId,
    fullDetails: 'true',
  })) as UnknownRecord;

  const athlete = asRecord(asArray(payload.athletes)[0]);
  const resolvedId = toInt(athlete.id) ?? athleteId;
  const name = typeof athlete.name === 'string' && athlete.name.trim().length > 0 ? athlete.name.trim() : `Player ${resolvedId}`;
  const positionName = asRecord(athlete.position).name ?? athlete.positionName ?? athlete.positionText ?? athlete.position;

  return {
    id: resolvedId,
    name,
    position: normalizeApiPositionToDomain(positionName),
  };
}

function isPostponedMatch(game: UnknownRecord): boolean {
  const status = String(game.statusText ?? '').toLowerCase();
  return status.includes('postpon') || status.includes('aplaz');
}
/*
async function ensureLeagueAndSportPersistence(sportId: number, competitionId: number, sportName?: string) {
  const competitionData = await getCompetitionTeamsBySportAndCompetitionService(sportId, competitionId);

  const athleteProfileCache = new Map<number, { id: number; name: string; position: 'goalkeeper' | 'defender' | 'midfielder' | 'forward' }>();

  let league = await em.findOne(League, { idEnApi: competitionId });
  if (!league) {
    league = em.create(League, {
      idEnApi: competitionId,
      name: competitionData.competitionName ?? `Competition ${competitionId}`,
      country: competitionData.countryName ?? 'Unknown',
      sport: sportName ?? `sport-${sportId}`,
    } as any);
  } else {
    league.name = competitionData.competitionName ?? league.name;
    league.country = competitionData.countryName ?? league.country;
    league.sport = sportName ?? league.sport;
  }

  for (const team of competitionData.teams) {
    let realTeam = await em.findOne(RealTeam, { idEnApi: team.id });

    if (!realTeam) {
      realTeam = em.create(RealTeam, {
        idEnApi: team.id,
        name: team.name ?? `Team ${team.id}`,
        league,
      } as any);
    } else {
      realTeam.name = team.name ?? realTeam.name;
      realTeam.league = league;
    }

    const squadPayload = (await requestSportsApiPro('/squads', { competitors: team.id })) as UnknownRecord;
    const members = findSquadMembers(squadPayload);
    const athleteIds = [...new Set(members
      .map((member) => toInt(member.athleteId ?? member.id))
      .filter((id): id is number => id !== null))];

    for (const athleteId of athleteIds) {
      let profile = athleteProfileCache.get(athleteId);

      if (!profile) {
        profile = await fetchAthleteProfileById(athleteId);
        athleteProfileCache.set(athleteId, profile);
      }


      const existing = await em.findOne(RealPlayer, { idEnApi: profile.id });

      if (existing) {
        existing.name = profile.name;
        existing.position = profile.position;
        existing.realTeam = realTeam;
        existing.lastUpdate = new Date();
        continue;
      }

      em.create(RealPlayer, {
        idEnApi: profile.id,
        name: profile.name,
        position: profile.position,
        realTeam,
        active: true,
        lastUpdate: new Date(),
      } as any);
    }
  }

  return { league, competitionData };
}*/
/*
async function persistFixtureAsMatchdaysAndMatches(
  league: League,
  fixtureData: UnknownRecord[],
  seasonNum: number,
  postponedAccumulator: UnknownRecord[],
): Promise<void> {
  const groupedByDate = groupFixtureByDate(fixtureData);

  for (let index = 0; index < groupedByDate.length; index += 1) {
    const group = groupedByDate[index];
    const startDate = new Date(`${group.key}T00:00:00.000Z`);
    const endDate = new Date(`${group.key}T23:59:59.999Z`);

    let matchday = await em.findOne(Matchday, {
      league,
      season: String(seasonNum),
      matchdayNumber: index + 1,
    });

    if (!matchday) {
      matchday = em.create(Matchday, {
        league,
        season: String(seasonNum),
        matchdayNumber: index + 1,
        startDate,
        endDate,
        status: MATCHDAY_STATUSES[0],
      } as any);
    }

    for (const fixtureMatch of group.games) {
      const gameId = toInt(fixtureMatch.gameId);
      if (gameId === null) {
        continue;
      }

      const existing = await em.findOne(GameMatch, { externalApiId: String(gameId) });
      if (existing) {
        existing.matchday = matchday;
        existing.league = league;
      }

      if (!existing) {
        em.create(GameMatch, {
          matchday,
          league,
          externalApiId: String(gameId),
          homeTeam: String(asRecord(fixtureMatch.home).name ?? 'TBD'),
          awayTeam: String(asRecord(fixtureMatch.away).name ?? 'TBD'),
          startDateTime: new Date(String(fixtureMatch.startTime ?? `${group.key}T00:00:00.000Z`)),
          status: isEnumValue(MATCH_STATUSES, fixtureMatch.statusText) ? fixtureMatch.statusText : MATCH_STATUSES[0],
        } as any);
      }

      if (isPostponedMatch(fixtureMatch)) {
        postponedAccumulator.push({
          gameId,
          matchupId: fixtureMatch.matchupId,
          competitionId: fixtureMatch.competitionId,
          seasonNum: fixtureMatch.seasonNum,
          stageNum: fixtureMatch.stageNum,
          startTime: fixtureMatch.startTime,
          statusText: fixtureMatch.statusText,
        });
      }
    }
  }
}
*/
async function syncPostponedMatchesAndPersistPlayerRatings(tournamentId: number): Promise<UnknownRecord[]> {
  let currentRaw = '';

  try {
    currentRaw = await readFile(POSTPONED_MATCHES_PATH, 'utf-8');
  } catch {
    return [];
  }

  const current = JSON.parse(currentRaw) as UnknownRecord;
  const tournaments = asRecord(current.tournaments);
  const pending = asArray(tournaments[String(tournamentId)]);
  const stillPending: UnknownRecord[] = [];

  for (const pendingMatchUnknown of pending) {
    const pendingMatch = asRecord(pendingMatchUnknown);
    const gameId = toInt(pendingMatch.gameId);
    const matchupId = typeof pendingMatch.matchupId === 'string' ? pendingMatch.matchupId : null;

    if (gameId === null || !matchupId) {
      continue;
    }

    const gamePayload = (await requestSportsApiPro('/game', { gameId, matchupId })) as UnknownRecord;
    const game = asRecord(gamePayload.game);

    if (toInt(game.statusGroup) !== 4) {
      stillPending.push(pendingMatch);
      continue;
    }

    const match = await em.findOne(GameMatch, { externalApiId: String(gameId) }, { populate: ['matchday'] });
    if (!match) {
      continue;
    }

    for (const member of findSquadMembers(gamePayload)) {
      const athleteId = toInt(member.athleteId ?? member.id);
      const ranking = toInt(member.ranking);

      if (athleteId === null || ranking === null) {
        continue;
      }

      const realPlayer = await em.findOne(RealPlayer, { idEnApi: athleteId });
      if (!realPlayer) {
        continue;
      }

      let performance = await em.findOne(PlayerPerformance, { realPlayer, matchday: match.matchday, league: match.matchday.league, match });

      if (!performance) {
        performance = em.create(PlayerPerformance, {
          realPlayer,
          matchday: match.matchday,
          pointsObtained: ranking,
          league: match.matchday.league,
          match,
          updateDate: new Date(),
        } as any);
      } else {
        performance.pointsObtained = ranking;
        performance.updateDate = new Date();
      }
    }
  }

  tournaments[String(tournamentId)] = stillPending;
  await writeFile(
    POSTPONED_MATCHES_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), tournaments }, null, 2),
    'utf-8',
  );

  return stillPending;
}

async function translateLeagueRealPlayersValues(leagueId: number, dataEm: EntityManager = em, onlyMissing = false): Promise<void> {
  const league = await dataEm.findOne(League, { id: leagueId });
  if (!league) {
    return;
  }

  const realTeamsIds = await getTeamIdsByLeague(dataEm as any, leagueId);

  if (realTeamsIds.length === 0) {
    return;
  }

  const realPlayers = await dataEm.find(RealPlayer, { realTeam: { $in: realTeamsIds } } as any);
  if (realPlayers.length === 0) {
    return;
  }

  const valuedPlayers = realPlayers.filter((player) => typeof player.value === 'number' && Number.isFinite(player.value));
  if (valuedPlayers.length === 0) {
    return;
  }

  const values = valuedPlayers.map((player) => Number(player.value));
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  for (const player of realPlayers) {
    if (onlyMissing && (await dataEm.findOne(RealPlayerLeagueValue, { realPlayer: player, league }))?.translatedValue != null) continue;
    const playerValue = typeof player.value === 'number' && Number.isFinite(player.value) ? Number(player.value) : null;

    if (playerValue === null) {
      await upsertRealPlayerLeagueTranslatedValue(dataEm as any, {
        realPlayer: player,
        league,
        translatedValue: null,
      });
      continue;
    }

    if (maxValue === minValue || playerValue === minValue) {
      await upsertRealPlayerLeagueTranslatedValue(dataEm as any, {
        realPlayer: player,
        league,
        translatedValue: FIXED_TRANSLATED_MIN,
      });
      continue;
    }

    const normalized = (playerValue - minValue) / (maxValue - minValue);
    const translated = FIXED_TRANSLATED_MIN + (normalized * (FIXED_TRANSLATED_MAX - FIXED_TRANSLATED_MIN));
    const clamped = Math.max(FIXED_TRANSLATED_MIN, Math.min(FIXED_TRANSLATED_MAX, translated));
    await upsertRealPlayerLeagueTranslatedValue(dataEm as any, {
      realPlayer: player,
      league,
      translatedValue: Number.isFinite(clamped) ? clamped : FIXED_TRANSLATED_MIN,
    });
  }
}

async function findAll(req: Request, res: Response) {
  try {
    const userId = req.authUser!.type === 'SUPERADMIN'
      ? Number.parseInt(String(req.query.userId ?? ''), 10) : req.authUser!.id;
    const where = { $and: [readScope(req.authUser!, 'tournaments', req.query.tournamentId),
      Number.isFinite(userId) ? { participants: { user: userId, retiredAt: null } } : {}] };
    const items = await em.find(Tournament, where, { populate: ['league'] });
    res.status(200).json({ message: 'found tournaments for user', data: items });
  } catch (error) { gameError(res, error); }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    let item: Tournament | null = null;

    try {
      item = await em.findOneOrFail(Tournament, { id }, { populate: ['league'] });
    } catch {
      item = await em.findOneOrFail(Tournament, { id });
    }

    res.status(200).json({ message: 'found tournament', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOneByPublicCode(req: Request, res: Response) {
  try {
    const publicCode = typeof req.params.publicCode === 'string' ? req.params.publicCode.trim() : '';

    if (!publicCode) {
      res.status(400).json({ message: 'publicCode is required' });
      return;
    }

    let item: Tournament | null = null;

    try {
      item = await em.findOne(Tournament, { publicCode }, { populate: ['league'] });
    } catch {
      item = await em.findOne(Tournament, { publicCode });
    }

    if (!item) {
      res.status(404).json({ message: 'tournament not found by public code' });
      return;
    }

    res.status(200).json({ message: 'found tournament by public code', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function getMatchdayAutomationSchedule(req: Request, res: Response) {
  try {
    const leagueIdFilter = toInt(req.query?.leagueId);
    const tournaments = await em.find(Tournament, {
      ...readScope(req.authUser!, 'tournaments', req.query.tournamentId),
      ...(leagueIdFilter ? { league: { id: leagueIdFilter } } : {}),
    }, { populate: ['league'] });

    const leagueById = new Map<number, League>();
    for (const tournament of tournaments) {
      const league = tournament.league as League;
      const leagueId = Number(league?.id ?? 0);
      if (Number.isFinite(leagueId) && leagueId > 0) {
        leagueById.set(leagueId, league);
      }
    }

    const leagueIds = [...leagueById.keys()];
    if (leagueIds.length === 0) {
      res.status(200).json({ message: 'no leagues with tournaments found', data: [] });
      return;
    }

    const matchdays = await em.find(Matchday, { league: { $in: leagueIds } } as any, {
      populate: ['league'],
      orderBy: [{ league: 'asc' }, { season: 'desc' }, { matchdayNumber: 'asc' }],
    });

    const matchdayIds = matchdays
      .map((matchday) => Number(matchday.id ?? 0))
      .filter((id) => Number.isFinite(id) && id > 0);

    const jobs = matchdayIds.length > 0
      ? await em.find(MatchdayAutomationJob, {
        matchday: { $in: matchdayIds },
        step: { $in: ['matchday_closure', 'postponed_match_sum', 'postponed_recheck'] },
      } as any, {
        populate: ['matchday'],
        orderBy: [{ runAt: 'desc' }, { id: 'desc' }],
      })
      : [];

    const jobsByMatchday = jobs.reduce((acc, job) => {
      const matchdayId = Number((job.matchday as any)?.id ?? job.matchday ?? 0);
      if (!Number.isFinite(matchdayId) || matchdayId <= 0) {
        return acc;
      }

      const list = acc.get(matchdayId) ?? [];
      list.push(job);
      acc.set(matchdayId, list);
      return acc;
    }, new Map<number, MatchdayAutomationJob[]>());

    const pendingMatches = await em.find(GameMatch, { matchday: { $in: matchdayIds }, pendingRecovery: true }, { populate: ['matchday'] });
    const rows = matchdays.map((matchday) => {
      const matchdayId = Number(matchday.id ?? 0);
      const jobsForMatchday = jobsByMatchday.get(matchdayId) ?? [];

      const latestClosure = jobsForMatchday.find((job) => job.step === 'matchday_closure');
      const latestCompletedClosure = jobsForMatchday.find((job) => job.step === 'matchday_closure' && job.status === 'completed');
      const latestCompletedPostponedSum = jobsForMatchday.find((job) => job.step === 'postponed_match_sum' && job.status === 'completed');

      return {
        leagueId: Number(matchday.league?.id ?? 0),
        leagueName: String((matchday.league as any)?.name ?? '-'),
        season: matchday.season,
        matchdayId,
        matchdayNumber: matchday.matchdayNumber,
        status: matchday.status,
        startDate: matchday.startDate,
        endDate: matchday.endDate,
        closureScheduledAt: matchday.autoUpdateAt ?? null,
        nextWorkerAttemptAt: latestClosure?.status === 'pending' ? latestClosure.runAt : null,
        closureCompletedAt: matchday.closureCompletedAt ?? null,
        closureLastError: latestClosure?.lastError ?? null,
        pendingMatches: pendingMatches.filter(m => m.matchday.id === matchdayId).map(m => ({
          id: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam, status: m.status,
          originalStart: m.pendingOriginalStart, startDateTime: m.startDateTime,
          recoveryScheduledAt: jobsForMatchday.find(j => j.step === 'postponed_match_sum' && idOfMatch(j.gameMatch) === m.id && j.status === 'pending' && (!j.payload?.kickoff || j.payload.kickoff === m.startDateTime.toISOString()))?.runAt ?? null,
        })),
        nextPostponedCheckAt: jobsForMatchday.find(j => j.step === 'postponed_recheck' && j.status === 'pending')?.runAt ?? null,
        closureJobStatus: latestClosure?.status ?? null,
        pointsAndMarketUpdatedAt: latestCompletedClosure?.finishedAt ?? null,
        latestPostponedPointsUpdateAt: latestCompletedPostponedSum?.finishedAt ?? null,
      };
    });

    res.status(200).json({
      message: 'matchday automation schedule',
      data: rows,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const {
      creatorUserId,
      league: rawLeagueId,
      ...tournamentInput
    } = req.body.sanitizeTournamentInput;

    if (!creatorUserId) {
      res.status(400).json({ message: 'creatorUserId is required to create tournament participant' });
      return;
    }

    if (!isEnumValue(TOURNAMENT_STATUSES, tournamentInput.status)) {
      res.status(400).json({ message: `status must be one of: ${TOURNAMENT_STATUSES.join(', ')}` });
      return;
    }

    const requestedBudget = Number(tournamentInput.initialBudget);
    tournamentInput.initialBudget = Number.isFinite(requestedBudget) && requestedBudget > 0
      ? requestedBudget
      : DEFAULT_INITIAL_BUDGET;

    const currentServerNow = serverNow();
    const parsedClauseWaitDays = Number.parseInt(String((tournamentInput as any).clauseWaitDays ?? ''), 10);
    const clauseWaitDays = Number.isFinite(parsedClauseWaitDays) && parsedClauseWaitDays >= 0 ? parsedClauseWaitDays : 14;

    const computedClauseEnableDate = new Date(currentServerNow);
    computedClauseEnableDate.setDate(computedClauseEnableDate.getDate() + clauseWaitDays);

    tournamentInput.creationDate = currentServerNow;
    tournamentInput.clauseEnableDate = computedClauseEnableDate;
    tournamentInput.allowSquadChangesDuringMatchday = Boolean((tournamentInput as any).allowSquadChangesDuringMatchday);
    tournamentInput.allowClauseExecutionDuringMatchday = Boolean((tournamentInput as any).allowClauseExecutionDuringMatchday);

    delete (tournamentInput as any).clauseWaitDays;

    const localLeagueId = toInt(rawLeagueId);

    if (localLeagueId === null) {
      res.status(400).json({ message: 'league is required and must be a local league id' });
      return;
    }

    const league = await em.findOne(League, { id: localLeagueId });

    if (!league) {
      res.status(400).json({ message: 'selected league does not exist locally. Use superadmin sync first.' });
      return;
    }

    const publicCode = await generateUniqueTournamentPublicCode();

    tournamentInput.initialBudget = money(tournamentInput.initialBudget);
    tournamentInput.squadSize = 16;
    const item = await orm.em.fork().transactional(async tx => {
      await tx.findOneOrFail(League, { id: league.id }, { lockMode: LockMode.PESSIMISTIC_WRITE });
      const game = tx.create(Tournament, { ...tournamentInput, league, publicCode, creatorUserId, initialDrawState: 'waiting' });
      const creator = tx.create(Participant, { user: creatorUserId, tournament: game, bankBudget: game.initialBudget, reservedMoney: 0,
        availableMoney: game.initialBudget, totalScore: 0, joinDate: new Date(), createdAt: new Date(), updatedAt: new Date() });
      await translateLeagueRealPlayersValues(league.id!, tx, true);
      await setupParticipantAfterJoin(game, creator, tx);
      await tx.flush(); await reconcileOwnership(tx, game, 'initial_assignment'); await recordInitialBudget(tx, creator); await tx.flush();
      return game;
    });

    res.status(201).json({
      message: 'tournament created',
      data: item,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message, sqlMessage: error?.sqlMessage, code: error?.code });
  }
}


async function start(req: Request, res: Response) {
  try {
    const result = await startTournament(orm.em.fork(), Number(req.params.id), req.authUser!);
    res.status(200).json({ message: result.alreadyStarted ? 'tournament already started' : 'tournament started', data: result });
  } catch (error) { gameError(res, error); }
}

async function syncPostponedMatches(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: 'invalid tournament id' });
      return;
    }

    const pending = await syncPostponedMatchesAndPersistPlayerRatings(id);
    await em.flush();

    res.status(200).json({ message: 'postponed matches sync executed', pending });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}




async function sumEndOfMatchdayPoints(req: Request, res: Response) {
  try {
    const leagueId = toInt(req.body?.leagueId);
    const matchdayNumber = toInt(req.body?.matchdayNumber ?? req.body?.nroFecha);
    const matchId = toInt(req.body?.gameMatchId ?? req.body?.matchId ?? req.body?.idMatch);
    const season = typeof req.body?.season === 'string' && req.body.season.trim().length > 0
      ? req.body.season.trim()
      : null;

    if (leagueId === null || matchdayNumber === null) {
      res.status(400).json({ message: 'leagueId and matchdayNumber (or nroFecha) are required numbers' });
      return;
    }

    const league = await em.findOne(League, { id: leagueId });
    if (!league) {
      res.status(404).json({ message: 'league not found' });
      return;
    }

    const matchdayWhere = season
      ? { league, matchdayNumber, season }
      : { league, matchdayNumber };
    const matchday = await em.findOne(Matchday, matchdayWhere as any, season ? undefined : { orderBy: { startDate: 'desc' } as any });
    if (!matchday) {
      const seasonHint = season ? ` and season=${season}` : '';
      res.status(404).json({ message: `matchday not found for league and matchdayNumber${seasonHint}` });
      return;
    }

    const selectedMatch = matchId !== null
      ? await em.findOne(GameMatch, { id: matchId, matchday })
      : null;

    if (matchId !== null && !selectedMatch) {
      res.status(404).json({ message: 'match not found for the selected league/matchday' });
      return;
    }

    // A postponed correction rebuilds this date from all persisted performances;
    // it must neither replace other matches' contributions nor consult today's squad.
    const { processedParticipants, upsertedBreakdowns } = await em.transactional(
      (tx) => recalculateMatchdayPoints(tx, league, matchday),
    );

    res.status(200).json({
      message: 'end of matchday points added successfully',
      data: {
        leagueId,
        matchdayNumber,
        season: matchday.season,
        matchId: selectedMatch?.id ?? null,
        tournaments: await em.count(Tournament, { league }),
        processedParticipants,
        upsertedBreakdowns,
      },
    });
  } catch (error: any) {
    if (error instanceof LineupHistoryError) {
      res.status(409).json({ message: error.message, code: 'LINEUP_HISTORY_UNAVAILABLE' });
      return;
    }
    res.status(500).json({ message: error.message });
  }
}

async function settleMarketAndRefreshByLeague(req: Request, res: Response) {
  try {
    const leagueId = toInt(req.body?.leagueId);
    const matchdayNumber = toInt(req.body?.matchdayNumber ?? req.body?.nroFecha);
    if (!leagueId || !matchdayNumber || !req.body?.season) {
      res.status(400).json({ message: 'leagueId, matchdayNumber and season are required' }); return;
    }
    const date = await em.findOneOrFail(Matchday, { league: leagueId, matchdayNumber, season: String(req.body.season) });
    const result = await runLeagueMatchdayClosure(date.id!);
    res.status(result.completed ? 200 : 202).json({ message: result.completed ? 'matchday closure completed' : 'waiting for closure time', data: result });
  } catch (error: any) { res.status(500).json({ message: error.message }); }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(Tournament, id);

    if (req.body.sanitizeTournamentInput.status !== undefined && !isEnumValue(TOURNAMENT_STATUSES, req.body.sanitizeTournamentInput.status)) {
      res.status(400).json({ message: `status must be one of: ${TOURNAMENT_STATUSES.join(', ')}` });
      return;
    }

    em.assign(itemToUpdate, req.body.sanitizeTournamentInput);
    await em.flush();
    res.status(200).json({ message: 'tournament updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(Tournament, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'tournament deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeTournamentInput, findAll, findOne, findOneByPublicCode, getMatchdayAutomationSchedule, add, update, remove, start, syncPostponedMatches, syncPostponedMatchesAndPersistPlayerRatings, sumEndOfMatchdayPoints, settleMarketAndRefreshByLeague, translateLeagueRealPlayersValues };
