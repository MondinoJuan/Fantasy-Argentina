import {
  getSportsApiProApiKeys,
  requestSportsApiPro,
} from '../../../integrations/sportsapipro/sportsapipro.client.js';

type UnknownRecord = Record<string, any>;

interface SelectionDebug {
  pickedStrategy: string;
  [key: string]: unknown;
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function isoToDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getHomeAwayIds(game: UnknownRecord): [number | null, number | null] {
  const home = game.homeCompetitor?.id ?? game.homeCompetitorId;
  const away = game.awayCompetitor?.id ?? game.awayCompetitorId;
  return [typeof home === 'number' ? home : null, typeof away === 'number' ? away : null];
}

function matchupIdFromGame(game: UnknownRecord, competitionId: number): string {
  const [homeId, awayId] = getHomeAwayIds(game);

  if (typeof homeId !== 'number' || typeof awayId !== 'number') {
    throw new Error('No se pudo armar matchupId: faltan home/away ids en el game.');
  }

  return `${homeId}-${awayId}-${competitionId}`;
}

async function getCompetitionMeta(sportId: number, competitionId: number): Promise<UnknownRecord> {
  const data = (await requestSportsApiPro('/competitions', { sports: sportId })) as UnknownRecord;
  const competitions = asArray(data.competitions);
  const matched = competitions.find((competition) => String(competition?.id) === String(competitionId));

  if (!matched) {
    throw new Error(`No encontré competitionId=${competitionId} en /competitions`);
  }

  return matched;
}

async function getTeamIdsFromStandings(
  competitionId: number,
  seasonNum: number,
  stageNum: number | null,
): Promise<number[]> {
  const params: Record<string, number> = { competitions: competitionId, seasonNum };
  if (typeof stageNum === 'number') {
    params.stageNum = stageNum;
  }

  const data = (await requestSportsApiPro('/standings', params)) as UnknownRecord;
  const standings = asArray(data.standings);
  const teamIds: number[] = [];

  for (const table of standings) {
    for (const row of asArray(table?.rows)) {
      const id = row?.competitor?.id;
      if (typeof id === 'number') {
        teamIds.push(id);
      }
    }
  }

  return [...new Set(teamIds)];
}

async function getAllSeasonGames(
  competitionId: number,
  seasonNum: number,
  stageNum: number | null,
): Promise<UnknownRecord[]> {
  const out: UnknownRecord[] = [];

  for (let page = 1; page <= 250; page += 1) {
    const params: Record<string, number> = {
      competitions: competitionId,
      seasonNum,
      page,
      pageSize: 100,
    };

    if (typeof stageNum === 'number') {
      params.stageNum = stageNum;
    }

    const data = (await requestSportsApiPro('/games/season-results', params)) as UnknownRecord;
    const games = asArray(data.games);

    if (games.length === 0) {
      break;
    }

    out.push(...games);
  }

  return out;
}

function selectLastGamesUnique(teamIds: number[], seasonGames: UnknownRecord[]): [UnknownRecord[], SelectionDebug] {
  const ended = seasonGames
    .filter((game) => game?.statusGroup === 4)
    .map((game) => ({ dt: isoToDate(game?.startTime), game }))
    .filter((entry) => entry.dt !== null) as { dt: Date; game: UnknownRecord }[];

  if (ended.length === 0) {
    throw new Error('No hay partidos finalizados (statusGroup==4) con startTime parseable.');
  }

  ended.sort((a, b) => a.dt.getTime() - b.dt.getTime());

  const latestByTeam = new Map<number, { dt: Date; game: UnknownRecord }>();
  for (const entry of ended) {
    const [homeId, awayId] = getHomeAwayIds(entry.game);
    for (const teamId of [homeId, awayId]) {
      if (typeof teamId !== 'number') {
        continue;
      }
      const prev = latestByTeam.get(teamId);
      if (!prev || entry.dt > prev.dt) {
        latestByTeam.set(teamId, entry);
      }
    }
  }

  const uniqByGameId = new Map<number, UnknownRecord>();
  for (const value of latestByTeam.values()) {
    const gameId = value.game?.id;
    if (typeof gameId === 'number') {
      uniqByGameId.set(gameId, value.game);
    }
  }

  const games = [...uniqByGameId.values()].sort((a, b) => {
    const da = isoToDate(a.startTime)?.getTime() ?? 0;
    const db = isoToDate(b.startTime)?.getTime() ?? 0;
    return da - db;
  });

  return [
    games,
    {
      pickedStrategy: 'per_team_latest_game',
      teamCount: teamIds.length,
      targetGames: Math.max(1, Math.floor(teamIds.length / 2)),
      pickedCount: games.length,
    },
  ];
}

function selectLastCompleteRoundGames(
  teamIds: number[],
  seasonGames: UnknownRecord[],
): [UnknownRecord[], SelectionDebug] {
  const teamSet = new Set(teamIds);
  const byRound = new Map<number, UnknownRecord[]>();

  for (const game of seasonGames) {
    const roundNum = game?.roundNum;
    if (typeof roundNum !== 'number') {
      continue;
    }
    const list = byRound.get(roundNum) ?? [];
    list.push(game);
    byRound.set(roundNum, list);
  }

  let best:
    | {
        roundNum: number;
        games: UnknownRecord[];
        coverageTeams: number;
      }
    | undefined;

  for (const [roundNum, games] of byRound.entries()) {
    if (!games.every((game) => game?.statusGroup === 4)) {
      continue;
    }

    const teamsInRound = new Set<number>();
    for (const game of games) {
      const [homeId, awayId] = getHomeAwayIds(game);
      if (typeof homeId === 'number') {
        teamsInRound.add(homeId);
      }
      if (typeof awayId === 'number') {
        teamsInRound.add(awayId);
      }
    }

    const coverageTeams = [...teamsInRound].filter((id) => teamSet.has(id)).length;

    if (!best || coverageTeams > best.coverageTeams || (coverageTeams === best.coverageTeams && roundNum > best.roundNum)) {
      best = { roundNum, games, coverageTeams };
    }
  }

  if (!best) {
    return [[], { pickedStrategy: 'none', reason: 'No hay roundNum completo.' }];
  }

  const uniqueByGameId = new Map<number, UnknownRecord>();
  for (const game of best.games) {
    const gameId = game?.id;
    if (typeof gameId === 'number') {
      uniqueByGameId.set(gameId, game);
    }
  }

  return [
    [...uniqueByGameId.values()],
    {
      pickedStrategy: 'last_complete_round',
      pickedRoundNum: best.roundNum,
      coverageTeams: best.coverageTeams,
      gamesUnique: uniqueByGameId.size,
      targetGames: Math.floor(teamIds.length / 2),
    },
  ];
}

function collectLineupLikeNodes(obj: any): UnknownRecord[] {
  const found: UnknownRecord[] = [];

  function walk(node: any) {
    if (Array.isArray(node)) {
      for (const child of node) {
        walk(child);
      }
      return;
    }

    if (!node || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node.members) && ('formation' in node || 'hasFieldPositions' in node || 'status' in node)) {
      found.push(node);
    }

    for (const value of Object.values(node)) {
      walk(value);
    }
  }

  walk(obj);
  return found;
}

function normalizePlayer(player: UnknownRecord) {
  return {
    id: player.id,
    athleteId: player.athleteId,
    name: player.name,
    shortName: player.shortName,
    jerseyNumber: player.jerseyNumber,
    status: player.status,
    statusText: player.statusText,
    position: player.position ?? player.positionText,
    ranking: player.ranking,
    hasHighestRanking: player.hasHighestRanking,
    hasStats: player.hasStats,
  };
}

function extractLineupsAndRankings(gamePayload: UnknownRecord) {
  const gameObj = (gamePayload.game ?? {}) as UnknownRecord;
  const home = (gameObj.homeCompetitor ?? {}) as UnknownRecord;
  const away = (gameObj.awayCompetitor ?? {}) as UnknownRecord;
  const homeId = typeof home.id === 'number' ? home.id : null;
  const awayId = typeof away.id === 'number' ? away.id : null;

  const lineupNodes = collectLineupLikeNodes(gamePayload);

  const teamIdFromNode = (node: UnknownRecord) => {
    if (typeof node.competitorId === 'number') {
      return node.competitorId;
    }
    if (typeof node.teamId === 'number') {
      return node.teamId;
    }
    return null;
  };

  const playersFromNode = (node: UnknownRecord) => asArray(node.members).filter((m) => m && typeof m === 'object').map(normalizePlayer);

  const homeNodes = lineupNodes.filter((node) => homeId !== null && teamIdFromNode(node) === homeId);
  const awayNodes = lineupNodes.filter((node) => awayId !== null && teamIdFromNode(node) === awayId);

  if (homeNodes.length === 0 || awayNodes.length === 0) {
    const sortedByMembers = [...lineupNodes].sort((a, b) => asArray(b.members).length - asArray(a.members).length);
    if (homeNodes.length === 0 && sortedByMembers[0]) {
      homeNodes.push(sortedByMembers[0]);
    }
    if (awayNodes.length === 0 && sortedByMembers[1]) {
      awayNodes.push(sortedByMembers[1]);
    }
  }

  const summarizeNode = (node: UnknownRecord) => ({
    status: node.status,
    formation: node.formation,
    hasFieldPositions: node.hasFieldPositions,
    players: playersFromNode(node),
  });

  return {
    home: {
      competitorId: homeId,
      competitorName: home.name,
      lineups: homeNodes.map(summarizeNode),
    },
    away: {
      competitorId: awayId,
      competitorName: away.name,
      lineups: awayNodes.map(summarizeNode),
    },
    debug: {
      foundLineupNodes: lineupNodes.length,
      homeNodes: homeNodes.length,
      awayNodes: awayNodes.length,
    },
  };
}

async function getGameDetail(gameId: number, matchupId: string): Promise<UnknownRecord> {
  return (await requestSportsApiPro('/game', { gameId, matchupId })) as UnknownRecord;
}

export async function getLatestMatchdayResultsWithPlayerRatingsService(sportId: number, competitionId: number) {
  // Garantiza que exista al menos API_KEY1 cargada y que haya rotación disponible con KEY2/KEY3 si hay 429.
  getSportsApiProApiKeys();

  const competition = await getCompetitionMeta(sportId, competitionId);
  const seasonNum = competition.currentSeasonNum;
  const stageNum = typeof competition.currentStageNum === 'number' ? competition.currentStageNum : null;

  if (typeof seasonNum !== 'number') {
    throw new Error(`competitionId=${competitionId} no trae currentSeasonNum`);
  }

  const teamIds = await getTeamIdsFromStandings(competitionId, seasonNum, stageNum);
  if (teamIds.length === 0) {
    throw new Error('No pude obtener equipos desde standings (teamIds vacío).');
  }

  const seasonGames = await getAllSeasonGames(competitionId, seasonNum, stageNum);
  if (seasonGames.length === 0) {
    throw new Error('No pude obtener games de season-results (vacío).');
  }

  let [selectedGames, selectionDebug] = selectLastCompleteRoundGames(teamIds, seasonGames);

  if (selectedGames.length === 0) {
    [selectedGames, selectionDebug] = selectLastGamesUnique(teamIds, seasonGames);
  }

  const output: UnknownRecord[] = [];

  for (const game of selectedGames) {
    const gameId = game?.id;
    if (typeof gameId !== 'number') {
      continue;
    }

    const matchupId = matchupIdFromGame(game, competitionId);
    const detail = await getGameDetail(gameId, matchupId);

    const gameObj = (detail.game ?? {}) as UnknownRecord;
    const home = (gameObj.homeCompetitor ?? {}) as UnknownRecord;
    const away = (gameObj.awayCompetitor ?? {}) as UnknownRecord;

    output.push({
      competition: {
        id: competitionId,
        sportId,
        name: competition.name,
        longName: competition.longName,
        currentSeasonNum: seasonNum,
        currentStageNum: stageNum,
      },
      teamsFromStandings: {
        count: teamIds.length,
        ids: teamIds,
      },
      selectionDebug,
      match: {
        gameId,
        matchupId,
        startTime: gameObj.startTime,
        statusGroup: gameObj.statusGroup,
        statusText: gameObj.statusText,
        roundNum: gameObj.roundNum,
        roundName: gameObj.roundName,
        home: { id: home.id, name: home.name, score: home.score },
        away: { id: away.id, name: away.name, score: away.score },
      },
      lineupsAndPlayerRankings: extractLineupsAndRankings(detail),
      rawPayloadSaved: true,
      _raw: detail,
    });
  }

  return output;
}
