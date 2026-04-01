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
import { PlayerPointsBreakdown } from '../PlayerPointsBreakdown/playerPointsBreakdown.entity.js';
import { ParticipantMatchdayPoints } from '../ParticipantMatchdayPoints/participantMatchdayPoints.entity.js';
import { ParticipantSquad } from '../ParticipantSquad/participantSquad.entity.js';
import { MatchdayMarket } from '../MatchdayMarket/matchdayMarket.entity.js';
import { Bid } from '../Bid/bid.entity.js';
import { DependantPlayer } from '../DependantPlayer/dependantPlayer.entity.js';
import { TOURNAMENT_STATUSES, MATCHDAY_STATUSES, MATCH_STATUSES, MARKET_ORIGINS, isEnumValue } from '../../shared/domain-enums.js';
import { setupParticipantAfterJoin } from './tournament-participation.service.js';
import { serverNow } from '../../shared/time/serverClock.js';

const em = orm.em;
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

function sortParticipantsByScoreWithRandomTieBreak(participants: Participant[]): Participant[] {
  const byScore = new Map<number, Participant[]>();

  for (const participant of participants) {
    const score = Number(participant.totalScore ?? 0);
    const bucket = byScore.get(score) ?? [];
    bucket.push(participant);
    byScore.set(score, bucket);
  }

  const scoresDesc = [...byScore.keys()].sort((a, b) => b - a);
  const ranked: Participant[] = [];

  for (const score of scoresDesc) {
    const tied = [...(byScore.get(score) ?? [])];

    while (tied.length > 0) {
      const index = Math.floor(Math.random() * tied.length);
      ranked.push(tied[index]);
      tied.splice(index, 1);
    }
  }

  return ranked;
}

function rewardAmountByPosition(position: number): number {
  const tier = Math.floor((Math.max(1, position) - 1) / 3);
  return 1_000_000 + (tier * 500_000);
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

async function translateLeagueRealPlayersValues(leagueId: number): Promise<void> {
  const realTeams = await em.find(RealTeam, { league: { id: leagueId } } as any, { fields: ['id'] as any });
  const realTeamsIds = realTeams.map((team: any) => Number(team.id)).filter((id) => Number.isFinite(id));

  if (realTeamsIds.length === 0) {
    return;
  }

  const realPlayers = await em.find(RealPlayer, { realTeam: { $in: realTeamsIds } } as any);
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
    const playerValue = typeof player.value === 'number' && Number.isFinite(player.value) ? Number(player.value) : null;

    if (playerValue === null) {
      player.translatedValue = null;
      continue;
    }

    if (maxValue === minValue || playerValue === minValue) {
      player.translatedValue = FIXED_TRANSLATED_MIN;
      continue;
    }

    const normalized = (playerValue - minValue) / (maxValue - minValue);
    const translated = FIXED_TRANSLATED_MIN + (normalized * (FIXED_TRANSLATED_MAX - FIXED_TRANSLATED_MIN));
    const clamped = Math.max(FIXED_TRANSLATED_MIN, Math.min(FIXED_TRANSLATED_MAX, translated));
    player.translatedValue = Number.isFinite(clamped) ? clamped : FIXED_TRANSLATED_MIN;
  }
}

async function findAll(req: Request, res: Response) {
  try {
    const userId = Number.parseInt(String(req.query.userId ?? ''), 10);

    if (Number.isFinite(userId)) {
      const participants = await em.find(Participant, { user: userId }, { populate: ['tournament', 'tournament.league'] });
      const items = participants.map((participant) => participant.tournament);
      res.status(200).json({ message: 'found tournaments for user', data: items });
      return;
    }

    const items = await em.find(Tournament, {}, { populate: ['league'] });
    res.status(200).json({ message: 'found all tournaments', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(Tournament, { id }, { populate: ['league'] });
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

    const item = await em.findOne(Tournament, { publicCode }, { populate: ['league'] });

    if (!item) {
      res.status(404).json({ message: 'tournament not found by public code' });
      return;
    }

    res.status(200).json({ message: 'found tournament by public code', data: item });
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

    const item = em.create(Tournament, {
      ...tournamentInput,
      league,
      publicCode,
    });

    const creatorParticipant = em.create(Participant, {
      user: creatorUserId,
      tournament: item,
      bankBudget: item.initialBudget,
      reservedMoney: 0,
      availableMoney: item.initialBudget,
      totalScore: 0,
      joinDate: new Date(),
    } as any);

    await setupParticipantAfterJoin(item, creatorParticipant, em);
    await translateLeagueRealPlayersValues(
      league.id ?? (() => { throw new Error("league.id es undefined"); })()
    );

    const leagueId = Number(league.id);
    if (Number.isFinite(leagueId) && leagueId > 0) {
      await translateLeagueRealPlayersValues(leagueId);
    }

    await em.flush();

    res.status(201).json({
      message: 'tournament created',
      data: item,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message, sqlMessage: error?.sqlMessage, code: error?.code });
  }
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




const FORMATION_SLOT_POSITIONS: Record<string, Array<'goalkeeper' | 'defender' | 'midfielder' | 'forward'>> = {
  '4-4-2': ['forward', 'forward', 'midfielder', 'midfielder', 'midfielder', 'midfielder', 'defender', 'defender', 'defender', 'defender', 'goalkeeper'],
  '4-3-3': ['forward', 'forward', 'forward', 'midfielder', 'midfielder', 'midfielder', 'defender', 'defender', 'defender', 'defender', 'goalkeeper'],
  '3-4-3': ['forward', 'forward', 'forward', 'midfielder', 'midfielder', 'midfielder', 'midfielder', 'defender', 'defender', 'defender', 'goalkeeper'],
  '5-4-1': ['forward', 'midfielder', 'midfielder', 'midfielder', 'midfielder', 'defender', 'defender', 'defender', 'defender', 'defender', 'goalkeeper'],
};

function getExpectedSlotPositions(formationRaw: unknown): Array<'goalkeeper' | 'defender' | 'midfielder' | 'forward'> {
  const formation = String(formationRaw ?? '4-4-2');
  return FORMATION_SLOT_POSITIONS[formation] ?? FORMATION_SLOT_POSITIONS['4-4-2'];
}

async function getLatestParticipantSquad(participant: Participant): Promise<ParticipantSquad | null> {
  const squads = await em.find(ParticipantSquad, { participant }, { orderBy: { acquisitionDate: 'desc' } });

  if (squads.length === 0) {
    return null;
  }

  const active = squads.find((squad) => !squad.releaseDate);
  return active ?? squads[0];
}

function buildPositionMismatchMapFromSquad(
  squad: ParticipantSquad | null,
  playerPositionById: Map<number, RealPlayer['position']>,
): Map<number, boolean> {
  const mismatchMap = new Map<number, boolean>();

  if (!squad) {
    return mismatchMap;
  }

  const expectedSlotPositions = getExpectedSlotPositions(squad.formation);
  const startingIds = (squad.startingRealPlayersIds ?? []).slice(0, expectedSlotPositions.length);

  if (startingIds.length === 0) {
    return mismatchMap;
  }

  startingIds.forEach((realPlayerId, index) => {
    const expected = expectedSlotPositions[index] ?? 'midfielder';
    const actual = playerPositionById.get(realPlayerId);

    if (!actual) {
      return;
    }

    mismatchMap.set(realPlayerId, actual !== expected);
  });

  return mismatchMap;
}

async function sumEndOfMatchdayPoints(req: Request, res: Response) {
  try {
    const leagueId = toInt(req.body?.leagueId);
    const matchdayNumber = toInt(req.body?.matchdayNumber ?? req.body?.nroFecha);
    const matchId = toInt(req.body?.gameMatchId ?? req.body?.matchId ?? req.body?.idMatch);

    if (leagueId === null || matchdayNumber === null) {
      res.status(400).json({ message: 'leagueId and matchdayNumber (or nroFecha) are required numbers' });
      return;
    }

    const league = await em.findOne(League, { id: leagueId });
    if (!league) {
      res.status(404).json({ message: 'league not found' });
      return;
    }

    const matchday = await em.findOne(Matchday, { league, matchdayNumber });
    if (!matchday) {
      res.status(404).json({ message: 'matchday not found for league and matchdayNumber' });
      return;
    }

    const selectedMatch = matchId !== null
      ? await em.findOne(GameMatch, { id: matchId, matchday })
      : null;

    if (matchId !== null && !selectedMatch) {
      res.status(404).json({ message: 'match not found for the selected league/matchday' });
      return;
    }

    let processedParticipants = 0;
    let upsertedBreakdowns = 0;
    const selectedMatchId = selectedMatch?.id ?? null;

    await em.transactional(async (transactionalEm) => {
      const tournaments = await transactionalEm.find(Tournament, { league });
      const tournamentIds = tournaments
        .map((tournament) => Number(tournament.id ?? 0))
        .filter((id) => Number.isFinite(id) && id > 0);

      if (tournamentIds.length === 0) {
        return;
      }

      const participants = await transactionalEm.find(Participant, { tournament: { $in: tournamentIds } });
      const participantIds = participants
        .map((participant) => Number(participant.id ?? 0))
        .filter((id) => Number.isFinite(id) && id > 0);

      processedParticipants = participants.length;

      if (participantIds.length === 0) {
        return;
      }

      const squads = await transactionalEm.find(ParticipantSquad, { participant: { $in: participantIds } }, {
        orderBy: [{ participant: 'asc' }, { acquisitionDate: 'desc' }],
      });

      const latestSquadByParticipantId = new Map<number, ParticipantSquad>();
      for (const squad of squads) {
        const participantId = Number((squad.participant as any)?.id ?? squad.participant);
        if (!Number.isFinite(participantId) || participantId <= 0 || latestSquadByParticipantId.has(participantId)) {
          continue;
        }
        latestSquadByParticipantId.set(participantId, squad);
      }

      const allStartingRealPlayerIds = new Set<number>();
      for (const squad of latestSquadByParticipantId.values()) {
        for (const rawId of squad.startingRealPlayersIds ?? []) {
          const parsed = Number.parseInt(String(rawId), 10);
          if (Number.isFinite(parsed) && parsed > 0) {
            allStartingRealPlayerIds.add(parsed);
          }
        }
      }

      const realPlayers = allStartingRealPlayerIds.size > 0
        ? await transactionalEm.find(RealPlayer, { id: { $in: [...allStartingRealPlayerIds] } })
        : [];
      const playerPositionById = new Map<number, RealPlayer['position']>(
        realPlayers
          .map((player) => [Number(player.id ?? 0), player.position] as const)
          .filter(([id]) => Number.isFinite(id) && id > 0),
      );

      const performances = allStartingRealPlayerIds.size > 0
        ? await transactionalEm.find(PlayerPerformance, {
          matchday,
          league,
          realPlayer: { $in: [...allStartingRealPlayerIds] },
          ...(selectedMatch ? { match: selectedMatch } : {}),
        }, { populate: ['realPlayer'] })
        : [];

      const performancesByRealPlayer = new Map<number, PlayerPerformance[]>();
      for (const performance of performances) {
        const realPlayerId = Number((performance.realPlayer as any)?.id);
        if (!Number.isFinite(realPlayerId) || realPlayerId <= 0) {
          continue;
        }
        const list = performancesByRealPlayer.get(realPlayerId) ?? [];
        list.push(performance);
        performancesByRealPlayer.set(realPlayerId, list);
      }

      for (const entries of performancesByRealPlayer.values()) {
        entries.sort((left, right) => new Date(right.updateDate).getTime() - new Date(left.updateDate).getTime());
      }

      const existingMatchdayBreakdowns = await transactionalEm.find(
        PlayerPointsBreakdown,
        { participant: { $in: participantIds }, matchday },
        { populate: selectedMatch ? ['playerPerformance.match'] : [] },
      );

      const existingByParticipantAndPlayer = new Map<string, PlayerPointsBreakdown>();
      for (const breakdown of existingMatchdayBreakdowns) {
        const participantId = Number((breakdown.participant as any)?.id ?? breakdown.participant);
        const realPlayerId = Number((breakdown.realPlayer as any)?.id ?? breakdown.realPlayer);
        if (!Number.isFinite(participantId) || participantId <= 0 || !Number.isFinite(realPlayerId) || realPlayerId <= 0) {
          continue;
        }
        existingByParticipantAndPlayer.set(`${participantId}:${realPlayerId}`, breakdown);
      }

      if (!selectedMatchId) {
        await transactionalEm.nativeDelete(PlayerPointsBreakdown, { participant: { $in: participantIds }, matchday });
        existingByParticipantAndPlayer.clear();
      } else {
        for (const breakdown of existingMatchdayBreakdowns) {
          if (breakdown.playerPerformance?.match?.id === selectedMatchId) {
            transactionalEm.remove(breakdown);
            const participantId = Number((breakdown.participant as any)?.id ?? breakdown.participant);
            const realPlayerId = Number((breakdown.realPlayer as any)?.id ?? breakdown.realPlayer);
            existingByParticipantAndPlayer.delete(`${participantId}:${realPlayerId}`);
          }
        }
      }

      for (const participant of participants) {
        const participantId = participant.id;
        if (!participantId) {
          continue;
        }
        const participantSquad = latestSquadByParticipantId.get(participantId) ?? null;
        const captainRealPlayerId = Number.parseInt(String(participantSquad?.captainRealPlayerId ?? ''), 10);
        const realPlayerIds = [...new Set((participantSquad?.startingRealPlayersIds ?? [])
          .map((id) => Number.parseInt(String(id), 10))
          .filter((id): id is number => Number.isFinite(id) && id > 0))];

        const mismatchMap = buildPositionMismatchMapFromSquad(participantSquad, playerPositionById);

        for (const realPlayerId of realPlayerIds) {
          const playerPerformances = performancesByRealPlayer.get(realPlayerId) ?? [];
          if (playerPerformances.length === 0) {
            continue;
          }

          const hasPositionMismatch = mismatchMap.get(realPlayerId) === true;
          const rawPoints = playerPerformances.reduce((total, performance) => total + Number(performance.pointsObtained ?? 0), 0);
          const contributedPoints = hasPositionMismatch ? rawPoints - 3 : rawPoints;
          const finalContributedPoints = Number.isFinite(captainRealPlayerId) && captainRealPlayerId > 0 && realPlayerId === captainRealPlayerId
            ? contributedPoints * 2
            : contributedPoints;
          const latestPerformance = playerPerformances[0];

          const key = `${participantId}:${realPlayerId}`;
          let breakdown = existingByParticipantAndPlayer.get(key);

          if (!breakdown) {
            breakdown = transactionalEm.create(PlayerPointsBreakdown, {
              participant,
              matchday,
              realPlayer: realPlayerId,
              contributedPoints: finalContributedPoints,
              playerPerformance: latestPerformance,
            } as any);
            existingByParticipantAndPlayer.set(key, breakdown);
          } else {
            breakdown.contributedPoints = finalContributedPoints;
            breakdown.playerPerformance = latestPerformance;
          }

          upsertedBreakdowns += 1;
        }
      }

      await transactionalEm.flush();

      const refreshedMatchdayBreakdowns = await transactionalEm.find(PlayerPointsBreakdown, { participant: { $in: participantIds }, matchday });
      const matchdayPointsByParticipant = new Map<number, number>();
      for (const breakdown of refreshedMatchdayBreakdowns) {
        const participantId = Number((breakdown.participant as any)?.id ?? breakdown.participant);
        if (!Number.isFinite(participantId) || participantId <= 0) {
          continue;
        }
        matchdayPointsByParticipant.set(participantId, (matchdayPointsByParticipant.get(participantId) ?? 0) + Number(breakdown.contributedPoints ?? 0));
      }

      const existingParticipantMatchdayPoints = await transactionalEm.find(ParticipantMatchdayPoints, {
        participant: { $in: participantIds },
        matchday,
      });

      const participantMatchdayPointsByParticipant = new Map<number, ParticipantMatchdayPoints>();
      for (const item of existingParticipantMatchdayPoints) {
        const participantId = Number((item.participant as any)?.id ?? item.participant);
        if (Number.isFinite(participantId) && participantId > 0) {
          participantMatchdayPointsByParticipant.set(participantId, item);
        }
      }

      for (const participant of participants) {
        const participantId = participant.id;
        if (!participantId) {
          continue;
        }

        const matchdayPoints = Number(matchdayPointsByParticipant.get(participantId) ?? 0);
        let participantMatchdayPoints = participantMatchdayPointsByParticipant.get(participantId);

        if (!participantMatchdayPoints) {
          participantMatchdayPoints = transactionalEm.create(ParticipantMatchdayPoints, {
            participant,
            matchday,
            matchdayPoints,
            calculationDate: new Date(),
          } as any);
          participantMatchdayPointsByParticipant.set(participantId, participantMatchdayPoints);
        } else {
          participantMatchdayPoints.matchdayPoints = matchdayPoints;
          participantMatchdayPoints.calculationDate = new Date();
        }
      }

      const allBreakdowns = await transactionalEm.find(PlayerPointsBreakdown, { participant: { $in: participantIds } });
      const totalByParticipant = new Map<number, number>();
      for (const breakdown of allBreakdowns) {
        const participantId = Number((breakdown.participant as any)?.id ?? breakdown.participant);
        if (!Number.isFinite(participantId) || participantId <= 0) {
          continue;
        }
        totalByParticipant.set(participantId, (totalByParticipant.get(participantId) ?? 0) + Number(breakdown.contributedPoints ?? 0));
      }

      for (const participant of participants) {
        const participantId = participant.id;
        if (!participantId) {
          continue;
        }
        participant.totalScore = Number(totalByParticipant.get(participantId) ?? 0);
      }

      await transactionalEm.flush();
    });

    res.status(200).json({
      message: 'end of matchday points added successfully',
      data: {
        leagueId,
        matchdayNumber,
        matchId: selectedMatch?.id ?? null,
        tournaments: await em.count(Tournament, { league }),
        processedParticipants,
        upsertedBreakdowns,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function settleMarketAndRefreshByLeague(req: Request, res: Response) {
  try {
    const leagueId = toInt(req.body?.leagueId);

    if (leagueId === null) {
      res.status(400).json({ message: 'leagueId is required number' });
      return;
    }

    const league = await em.findOne(League, { id: leagueId });
    if (!league) {
      res.status(404).json({ message: 'league not found' });
      return;
    }

    const now = new Date();

    let tournamentsCount = 0;
    let settledMarkets = 0;
    let processedBids = 0;
    let awardedPlayers = 0;
    let createdMarketEntries = 0;
    let rewardedParticipants = 0;
    let distributedReward = 0;

    await em.transactional(async (transactionalEm) => {
      const tournaments = await transactionalEm.find(Tournament, { league });
      tournamentsCount = tournaments.length;

      for (const tournament of tournaments) {
        const tournamentId = tournament.id;
        if (!tournamentId) {
          continue;
        }

        const participants = await transactionalEm.find(Participant, { tournament });
        const participantIds = participants
          .map((participant) => Number(participant.id ?? 0))
          .filter((id) => Number.isFinite(id) && id > 0);

        const matchday = await transactionalEm.findOne(Matchday, {
          league,
          status: { $in: [MATCHDAY_STATUSES[1], MATCHDAY_STATUSES[2]] },
        }, { orderBy: { matchdayNumber: 'asc' } })
          ?? await transactionalEm.findOne(Matchday, { league, matchdayNumber: 1 })
          ?? transactionalEm.create(Matchday, {
            league,
            season: String(new Date().getFullYear()),
            matchdayNumber: 1,
            startDate: now,
            endDate: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
            status: MATCHDAY_STATUSES[1],
          } as any);

        const currentMarkets = await transactionalEm.find(MatchdayMarket, { tournament }, { populate: ['matchday'] });
        const dependantPlayerIdsFromMarket = [...new Set(currentMarkets.flatMap((market) => (
          Array.isArray(market.dependantPlayerIds)
            ? market.dependantPlayerIds.map((id) => Number.parseInt(String(id), 10)).filter((id) => Number.isFinite(id) && id > 0)
            : []
        )))];

        const dependantPlayers = dependantPlayerIdsFromMarket.length > 0
          ? await transactionalEm.find(DependantPlayer, { id: { $in: dependantPlayerIdsFromMarket } }, { populate: ['realPlayer'] })
          : [];
        const dependantById = new Map<number, DependantPlayer>(dependantPlayers
          .filter((dependantPlayer) => Number.isFinite(dependantPlayer.id))
          .map((dependantPlayer) => [Number(dependantPlayer.id), dependantPlayer]));

        const realPlayerIdsInMarket = [...new Set(dependantPlayers
          .map((dependantPlayer) => Number(dependantPlayer.realPlayer?.id ?? 0))
          .filter((id) => Number.isFinite(id) && id > 0))];

        const bids = realPlayerIdsInMarket.length > 0
          ? await transactionalEm.find(Bid, {
            tournament,
            realPlayer: { $in: realPlayerIdsInMarket },
          }, {
            populate: ['participant'],
            orderBy: [{ realPlayer: 'asc' }, { offeredAmount: 'desc' }, { bidDate: 'asc' }],
          })
          : [];

        const bidsByRealPlayerId = new Map<number, Bid[]>();
        for (const bid of bids) {
          const realPlayerId = Number((bid.realPlayer as any)?.id ?? bid.realPlayer);
          if (!Number.isFinite(realPlayerId) || realPlayerId <= 0) {
            continue;
          }
          const list = bidsByRealPlayerId.get(realPlayerId) ?? [];
          list.push(bid);
          bidsByRealPlayerId.set(realPlayerId, list);
        }

        const squads = participantIds.length > 0
          ? await transactionalEm.find(ParticipantSquad, { participant: { $in: participantIds } }, { orderBy: [{ participant: 'asc' }, { acquisitionDate: 'desc' }] })
          : [];
        const latestSquadByParticipantId = new Map<number, ParticipantSquad>();
        for (const squad of squads) {
          const participantId = Number((squad.participant as any)?.id ?? squad.participant);
          if (!Number.isFinite(participantId) || participantId <= 0 || latestSquadByParticipantId.has(participantId)) {
            continue;
          }
          latestSquadByParticipantId.set(participantId, squad);
        }

        for (const market of currentMarkets) {
          const dependantPlayerIds = Array.isArray(market.dependantPlayerIds)
            ? market.dependantPlayerIds.map((id) => Number.parseInt(String(id), 10)).filter((id) => Number.isFinite(id) && id > 0)
            : [];

          for (const dependantPlayerId of dependantPlayerIds) {
            const dependantPlayer = dependantById.get(dependantPlayerId);
            const realPlayerId = Number(dependantPlayer?.realPlayer?.id ?? 0);
            if (!dependantPlayer || !Number.isFinite(realPlayerId) || realPlayerId <= 0) {
              continue;
            }

            const playerBids = bidsByRealPlayerId.get(realPlayerId) ?? [];
            if (playerBids.length === 0) {
              continue;
            }

            processedBids += playerBids.length;
            const competitiveBids = playerBids.filter((bid) => Number(bid.offeredAmount ?? 0) > 0);

            if (competitiveBids.length === 0) {
              for (const bid of playerBids) {
                const participant = bid.participant as Participant;
                const offeredAmount = Number(bid.offeredAmount ?? 0);
                participant.reservedMoney = Math.max(0, Number(participant.reservedMoney ?? 0) - offeredAmount);
                participant.availableMoney = Number(participant.availableMoney ?? 0) + offeredAmount;
                bid.status = 'lost';
                bid.cancellationDate = now;
              }
              continue;
            }

            const winnerBid = competitiveBids[0];
            const winnerParticipant = winnerBid.participant as Participant;
            const winnerParticipantId = Number(winnerParticipant.id);
            const winnerAmount = Number(winnerBid.offeredAmount ?? 0);

            winnerParticipant.bankBudget = Math.max(0, Number(winnerParticipant.bankBudget ?? 0) - winnerAmount);
            winnerParticipant.reservedMoney = Math.max(0, Number(winnerParticipant.reservedMoney ?? 0) - winnerAmount);

            const latestSquad = latestSquadByParticipantId.get(winnerParticipantId);
            if (latestSquad) {
              const currentSubs = Array.isArray(latestSquad.substitutesRealPlayersIds) ? latestSquad.substitutesRealPlayersIds : [];
              if (!currentSubs.includes(realPlayerId)) {
                latestSquad.substitutesRealPlayersIds = [...currentSubs, realPlayerId];
                awardedPlayers += 1;
              }
            }

            winnerBid.status = 'won';

            for (const lostBid of playerBids) {
              if (lostBid === winnerBid) {
                continue;
              }
              const loser = lostBid.participant as Participant;
              const offeredAmount = Number(lostBid.offeredAmount ?? 0);
              loser.reservedMoney = Math.max(0, Number(loser.reservedMoney ?? 0) - offeredAmount);
              loser.availableMoney = Number(loser.availableMoney ?? 0) + offeredAmount;
              lostBid.status = 'lost';
              lostBid.cancellationDate = now;
            }
          }

          settledMarkets += 1;
          transactionalEm.remove(market);
        }

        const dependantPlayersInTournament = await transactionalEm.find(DependantPlayer, { tournament }, { populate: ['realPlayer'] });
        const reservedRealPlayerIds = new Set<number>(dependantPlayersInTournament
          .map((item) => Number(item.realPlayer?.id ?? 0))
          .filter((id) => Number.isFinite(id) && id > 0));

        const quantityToAdd = participants.length * 4;
        if (quantityToAdd > 0) {
          const candidates = await transactionalEm.find(RealPlayer, {
            active: true,
            id: { $nin: [...reservedRealPlayerIds] },
            realTeam: { league },
          }, { limit: 1000 });

          const chosen = pickRandom(candidates, quantityToAdd);
          const createdDependants = chosen.map((player) => transactionalEm.create(DependantPlayer, {
            tournament,
            realPlayer: player,
            marketValue: 0,
          } as any));

          if (createdDependants.length > 0) {
            transactionalEm.persist(createdDependants);
            await transactionalEm.flush();
          }

          const dependantIds = createdDependants
            .map((dependant) => Number(dependant.id ?? 0))
            .filter((id) => Number.isFinite(id) && id > 0);

          if (dependantIds.length > 0) {
            transactionalEm.create(MatchdayMarket, {
              tournament,
              matchday,
              dependantPlayerIds: dependantIds,
              minimumPrice: 100,
              origin: MARKET_ORIGINS[0],
              creationDate: now,
            } as any);
            createdMarketEntries += 1;
          }
        }

        const rankedParticipants = sortParticipantsByScoreWithRandomTieBreak(participants);
        rankedParticipants.forEach((participant, index) => {
          const position = index + 1;
          const reward = rewardAmountByPosition(position);
          participant.bankBudget = Number(participant.bankBudget ?? 0) + reward;
          participant.availableMoney = Number(participant.availableMoney ?? 0) + reward;
          rewardedParticipants += 1;
          distributedReward += reward;
        });
      }

      await transactionalEm.flush();
    });

    res.status(200).json({
      message: 'markets settled and refreshed successfully',
      data: {
        leagueId,
        tournaments: tournamentsCount,
        settledMarkets,
        processedBids,
        awardedPlayers,
        createdMarketEntries,
        rewardedParticipants,
        distributedReward,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
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

export { sanitizeTournamentInput, findAll, findOne, findOneByPublicCode, add, update, remove, syncPostponedMatches, syncPostponedMatchesAndPersistPlayerRatings, sumEndOfMatchdayPoints, settleMarketAndRefreshByLeague };
