import { readFile } from 'node:fs/promises';
import { getSportsApiProApiKeys, requestSportsApiPro } from '../../../integrations/sportsapipro/sportsapipro.client.js';

type UnknownRecord = Record<string, unknown>;

type PagingCursor = {
  aftergame: number;
  direction: number;
};

export interface TeamSeed {
  id: number;
  name?: string;
}

export interface FixtureSeedConfig {
  competitionId: number;
  seasonNum: number;
  stageNum: number;
  teams: TeamSeed[];
}

export interface FixtureEventRef {
  gameId: number;
  competitionId: number;
  seasonNum: number;
  stageNum: number;
  homeCompetitorId: number | null;
  awayCompetitorId: number | null;
  startTime: string | null;
  statusGroup: number | null;
  statusText: string | null;
  source: 'fixtures' | 'results';
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

function getHomeAwayIds(game: UnknownRecord): [number | null, number | null] {
  const home = asRecord(game.homeCompetitor).id ?? game.homeCompetitorId;
  const away = asRecord(game.awayCompetitor).id ?? game.awayCompetitorId;

  return [toInt(home), toInt(away)];
}

function parseCursorFromPagingPath(pagingPath: unknown): PagingCursor | null {
  if (typeof pagingPath !== 'string' || pagingPath.trim().length === 0) {
    return null;
  }

  try {
    const url = new URL(`https://dummy.local${pagingPath}`);
    const aftergame = toInt(url.searchParams.get('aftergame'));
    const direction = toInt(url.searchParams.get('direction'));

    if (aftergame === null || direction === null) {
      return null;
    }

    return { aftergame, direction };
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNewCursors(
  payload: UnknownRecord,
  endpoint: 'fixtures' | 'results',
  seen: Set<string>,
): PagingCursor[] {
  const paging = asRecord(payload.paging);
  const cursors = [parseCursorFromPagingPath(paging.previousPage), parseCursorFromPagingPath(paging.nextPage)].filter(
    (cursor): cursor is PagingCursor => cursor !== null,
  );

  const out: PagingCursor[] = [];

  for (const cursor of cursors) {
    const key = `${endpoint}:${cursor.aftergame}:${cursor.direction}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(cursor);
  }

  return out;
}

function shouldIncludeGame(game: UnknownRecord, config: FixtureSeedConfig): boolean {
  return (
    toInt(game.competitionId) === config.competitionId &&
    toInt(game.seasonNum) === config.seasonNum &&
    toInt(game.stageNum) === config.stageNum
  );
}

function toEventRef(game: UnknownRecord, source: 'fixtures' | 'results'): FixtureEventRef | null {
  const gameId = toInt(game.id);
  if (gameId === null) {
    return null;
  }

  const [homeCompetitorId, awayCompetitorId] = getHomeAwayIds(game);

  return {
    gameId,
    competitionId: toInt(game.competitionId) ?? -1,
    seasonNum: toInt(game.seasonNum) ?? -1,
    stageNum: toInt(game.stageNum) ?? -1,
    homeCompetitorId,
    awayCompetitorId,
    startTime: typeof game.startTime === 'string' ? game.startTime : null,
    statusGroup: toInt(game.statusGroup),
    statusText: typeof game.statusText === 'string' ? game.statusText : null,
    source,
  };
}

function matchupIdFromEventRef(ref: FixtureEventRef): string {
  if (typeof ref.homeCompetitorId !== 'number' || typeof ref.awayCompetitorId !== 'number') {
    throw new Error(`No se pudo armar matchupId para gameId=${ref.gameId} (home/away faltan).`);
  }

  return `${ref.homeCompetitorId}-${ref.awayCompetitorId}-${ref.competitionId}`;
}

function formatDateHour(iso: unknown): string | null {
  if (typeof iso !== 'string' || iso.trim().length === 0) {
    return null;
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const y = parsed.getUTCFullYear();
  const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const d = String(parsed.getUTCDate()).padStart(2, '0');
  const h = String(parsed.getUTCHours()).padStart(2, '0');

  return `${y}-${m}-${d} ${h}:00`;
}

async function fetchAndIngestTeam(
  teamId: number,
  config: FixtureSeedConfig,
  games: Map<number, FixtureEventRef>,
  seenCursors: Set<string>,
  maxPagesPerTeam: number,
  sleepMsBetweenRequests: number,
): Promise<number> {
  let added = 0;

  const ingestPayload = (payload: UnknownRecord, source: 'fixtures' | 'results') => {
    for (const gameUnknown of asArray(payload.games)) {
      const game = asRecord(gameUnknown);

      if (!shouldIncludeGame(game, config)) {
        continue;
      }

      const mapped = toEventRef(game, source);
      if (!mapped || games.has(mapped.gameId)) {
        continue;
      }

      games.set(mapped.gameId, mapped);
      added += 1;
    }
  };

  for (const endpoint of ['fixtures', 'results'] as const) {
    const endpointPath = endpoint === 'fixtures' ? '/games/fixtures' : '/games/results';
    const firstPayload = (await requestSportsApiPro(endpointPath, { competitors: teamId })) as UnknownRecord;
    ingestPayload(firstPayload, endpoint);

    const queue = getNewCursors(firstPayload, endpoint, seenCursors);
    let pages = 1;

    while (queue.length > 0 && pages < maxPagesPerTeam) {
      const cursor = queue.shift()!;

      if (sleepMsBetweenRequests > 0) {
        await sleep(sleepMsBetweenRequests);
      }

      const payload = (await requestSportsApiPro(endpointPath, {
        competitors: teamId,
        ...cursor,
      })) as UnknownRecord;

      ingestPayload(payload, endpoint);
      queue.push(...getNewCursors(payload, endpoint, seenCursors));
      pages += 1;
    }
  }

  return added;
}

export async function readFixtureSeedConfigFromJson(path: string): Promise<FixtureSeedConfig> {
  const raw = await readFile(path, 'utf-8');
  const parsed = JSON.parse(raw) as UnknownRecord;

  const competitionId = toInt(parsed.competitionId);
  const seasonNum = toInt(parsed.seasonNum);
  const stageNum = toInt(parsed.stageNum);

  if (competitionId === null || seasonNum === null || stageNum === null) {
    throw new Error('El JSON debe incluir competitionId, seasonNum y stageNum numéricos.');
  }

  const teams = asArray(parsed.teams)
    .map((teamUnknown) => asRecord(teamUnknown))
    .map((team): TeamSeed | null => {
      const id = toInt(team.id);
      if (id === null) {
        return null;
      }

      return {
        id,
        name: typeof team.name === 'string' ? team.name : undefined,
      };
    })
    .filter((team): team is TeamSeed => team !== null);

  if (teams.length === 0) {
    throw new Error('El JSON debe incluir teams con al menos un elemento válido.');
  }

  return {
    competitionId,
    seasonNum,
    stageNum,
    teams,
  };
}

export async function collectFixtureEventRefsFromTeamsService(
  config: FixtureSeedConfig,
  options: {
    maxPagesPerTeam?: number;
    sleepMsBetweenRequests?: number;
  } = {},
) {
  getSportsApiProApiKeys();

  const maxPagesPerTeam = options.maxPagesPerTeam ?? 80;
  const sleepMsBetweenRequests = options.sleepMsBetweenRequests ?? 200;

  const teamIds = [...new Set(config.teams.map((team) => team.id))];
  const expectedPerTeam = Math.max(1, teamIds.length - 1);

  const games = new Map<number, FixtureEventRef>();
  const seenCursors = new Set<string>();

  function countGamesForTeam(teamId: number): number {
    let count = 0;

    for (const game of games.values()) {
      if (game.homeCompetitorId === teamId || game.awayCompetitorId === teamId) {
        count += 1;
      }
    }

    return count;
  }

  let consultedTeams = 0;
  let skippedTeams = 0;

  for (const teamId of teamIds) {
    const covered = countGamesForTeam(teamId);
    if (covered >= expectedPerTeam) {
      skippedTeams += 1;
      continue;
    }

    consultedTeams += 1;
    await fetchAndIngestTeam(teamId, config, games, seenCursors, maxPagesPerTeam, sleepMsBetweenRequests);
  }

  const eventRefs = [...games.values()].sort((a, b) => {
    const ta = a.startTime ? new Date(a.startTime).getTime() : 0;
    const tb = b.startTime ? new Date(b.startTime).getTime() : 0;
    return ta - tb;
  });

  return {
    competitionId: config.competitionId,
    seasonNum: config.seasonNum,
    stageNum: config.stageNum,
    stats: {
      teamsTotal: teamIds.length,
      expectedPerTeam,
      consultedTeams,
      skippedTeams,
      eventsCollected: eventRefs.length,
    },
    eventIds: eventRefs.map((eventRef) => eventRef.gameId),
    eventRefs,
  };
}

export async function buildFixtureFromEventRefsService(
  eventRefs: FixtureEventRef[],
  options: {
    sleepMsBetweenRequests?: number;
  } = {},
) {
  getSportsApiProApiKeys();

  const sleepMsBetweenRequests = options.sleepMsBetweenRequests ?? 0;
  const fixture = [] as UnknownRecord[];

  for (const eventRef of eventRefs) {
    const matchupId = matchupIdFromEventRef(eventRef);

    if (sleepMsBetweenRequests > 0) {
      await sleep(sleepMsBetweenRequests);
    }

    const detail = (await requestSportsApiPro('/game', {
      gameId: eventRef.gameId,
      matchupId,
    })) as UnknownRecord;

    const game = asRecord(detail.game);
    const home = asRecord(game.homeCompetitor);
    const away = asRecord(game.awayCompetitor);

    const homeScore = toInt(home.score);
    const awayScore = toInt(away.score);

    fixture.push({
      gameId: eventRef.gameId,
      matchupId,
      competitionId: eventRef.competitionId,
      seasonNum: eventRef.seasonNum,
      stageNum: eventRef.stageNum,
      statusGroup: toInt(game.statusGroup),
      statusText: typeof game.statusText === 'string' ? game.statusText : null,
      startTime: typeof game.startTime === 'string' ? game.startTime : eventRef.startTime,
      startDateHour: formatDateHour(game.startTime ?? eventRef.startTime),
      home: {
        id: toInt(home.id),
        name: typeof home.name === 'string' ? home.name : null,
        score: homeScore,
      },
      away: {
        id: toInt(away.id),
        name: typeof away.name === 'string' ? away.name : null,
        score: awayScore,
      },
      result: homeScore !== null && awayScore !== null ? `${homeScore}-${awayScore}` : null,
      source: eventRef.source,
    });
  }

  return {
    totalEvents: fixture.length,
    fixture,
  };
}
