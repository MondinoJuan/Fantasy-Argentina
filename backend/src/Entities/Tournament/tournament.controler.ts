import { Request, Response, NextFunction } from 'express';
import { writeFile, readFile } from 'node:fs/promises';
import { Tournament } from './tournament.entity.js';
import { orm } from '../../shared/db/orm.js';
import { Participant } from '../Participant/participant.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { League } from '../League/league.entity.js';
import { RealTeam } from '../RealTeam/realTeam.entity.js';
import { Match } from '../Match/match.entity.js';
import { getCompetitionTeamsBySportAndCompetitionService } from '../ExternalApi/services/index.js';
import { requestSportsApiPro } from '../../integrations/sportsapipro/sportsapipro.client.js';
import { PlayerPerformance } from '../PlayerPerformance/playerPerformance.entity.js';
import { TOURNAMENT_STATUSES, MATCHDAY_STATUSES, MATCH_STATUSES, isEnumValue } from '../../shared/domain-enums.js';
import { setupParticipantAfterJoin } from './tournament-participation.service.js';

const em = orm.em;
const POSTPONED_MATCHES_PATH = 'src/Entities/Tournament/data/postponedMatches.json';


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
    creationDate: req.body.creationDate,
    initialBudget: req.body.initialBudget,
    squadSize: req.body.squadSize,
    status: req.body.status,
    clauseEnableDate: req.body.clauseEnableDate,
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
      seasonNum: competitionData.seasonNum,
    } as any);
  } else {
    league.name = competitionData.competitionName ?? league.name;
    league.country = competitionData.countryName ?? league.country;
    league.sport = sportName ?? league.sport;
    league.seasonNum = competitionData.seasonNum;
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
}

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

      const existing = await em.findOne(Match, { externalApiId: String(gameId) });
      if (!existing) {
        em.create(Match, {
          matchday,
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

    const match = await em.findOne(Match, { externalApiId: String(gameId) }, { populate: ['matchday'] });
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

      let performance = await em.findOne(PlayerPerformance, { realPlayer, matchday: match.matchday });

      if (!performance) {
        performance = em.create(PlayerPerformance, {
          realPlayer,
          matchday: match.matchday,
          pointsObtained: ranking,
          played: true,
          updateDate: new Date(),
        } as any);
      } else {
        performance.pointsObtained = ranking;
        performance.played = true;
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

export { sanitizeTournamentInput, findAll, findOne, add, update, remove, syncPostponedMatches, syncPostponedMatchesAndPersistPlayerRatings };
