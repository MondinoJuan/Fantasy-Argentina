import { drawInitialSquads } from '../../shared/domain/initial-draw.js';
import { GameRuleError } from '../../shared/domain/game-rules.js';
import { PlayerPerformance } from '../PlayerPerformance/playerPerformance.entity.js';
import { PlayerOwnership } from '../PlayerOwnership/playerOwnership.entity.js';
import { EntityManager } from '@mikro-orm/core';
import { MARKET_ORIGINS, PARTICIPANT_FORMATIONS, PLAYER_POSITIONS, SQUAD_ACQUISITION_TYPES, type ParticipantFormation, type PlayerPosition } from '../../shared/domain-enums.js';
import { DependantPlayer } from '../DependantPlayer/dependantPlayer.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { MatchdayMarket } from '../MatchdayMarket/matchdayMarket.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { ParticipantSquad } from '../ParticipantSquad/participantSquad.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { getTeamIdsByLeague } from '../RealTeamLeagueParticipation/realTeamLeagueParticipation.service.js';
import { Tournament } from './tournament.entity.js';

const DEFAULT_FORMATION: ParticipantFormation = PARTICIPANT_FORMATIONS[0];

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

function getRequiredPlayersByPosition(formation: ParticipantFormation): Record<PlayerPosition, number> {
  const [defendersRaw, midfieldersRaw, forwardsRaw] = formation.split('-').map((chunk) => Number.parseInt(chunk, 10));

  return {
    goalkeeper: 1,
    defender: Number.isFinite(defendersRaw) ? defendersRaw : 4,
    midfielder: Number.isFinite(midfieldersRaw) ? midfieldersRaw : 4,
    forward: Number.isFinite(forwardsRaw) ? forwardsRaw : 2,
  };
}

async function getCurrentMatchday(tournament: Tournament, entityManager: EntityManager): Promise<Matchday> {
  const current = await entityManager.findOne(Matchday, {
    league: tournament.league,
    closureCompletedAt: null, status: { $in: ['scheduled', 'upcoming', 'in_progress', 'postponed'] },
  }, {
    orderBy: { matchdayNumber: 'asc' },
  });

  if (current) {
    return current;
  }

  throw new GameRuleError('No hay una fecha abierta en la liga para publicar el mercado. El inicio o ingreso se revierte.');
}

async function getTournamentReservedRealPlayerIds(tournament: Tournament, entityManager: EntityManager): Promise<Set<number>> {
  const reservedIds = new Set<number>();
  for (const row of await entityManager.find(PlayerOwnership, { tournament, owner: { $ne: null } })) reservedIds.add(Number((row.realPlayer as any)?.id ?? row.realPlayer));
  const markets = await entityManager.find(MatchdayMarket, { tournament, closedAt: null });
  const squads = await entityManager.find(ParticipantSquad, { participant: { tournament }, releaseDate: null });
  for (const squad of squads) for (const id of [...squad.startingRealPlayersIds, ...squad.substitutesRealPlayersIds]) if (id > 0) reservedIds.add(id);
  const ids = markets.flatMap(m => m.dependantPlayerIds);
  if (ids.length) for (const d of await entityManager.find(DependantPlayer, { id: { $in: ids } })) reservedIds.add(Number((d.realPlayer as any)?.id ?? d.realPlayer));
  return reservedIds;
}

async function createDependantPlayersForSelection(tournament: Tournament, players: RealPlayer[], entityManager: EntityManager): Promise<number[]> {
  const createdDependantPlayers: DependantPlayer[] = [];

  for (const player of players) {
    const dependantPlayer = await entityManager.findOne(DependantPlayer, { tournament, realPlayer: player }) ?? entityManager.create(DependantPlayer, {
      tournament,
      realPlayer: player,
      marketValue: 0,
    } as any);

    entityManager.persist(dependantPlayer);
    createdDependantPlayers.push(dependantPlayer);
  }

  if (createdDependantPlayers.length > 0) {
    await entityManager.flush();
  }

  return createdDependantPlayers
    .map((dependantPlayer) => dependantPlayer.id)
    .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0);
}

async function assignInitialSquadToParticipant(tournament: Tournament, participant: Participant, entityManager: EntityManager, formation: ParticipantFormation = DEFAULT_FORMATION): Promise<number[]> {
  const required = getRequiredPlayersByPosition(formation);
  const reservedIds = await getTournamentReservedRealPlayerIds(tournament, entityManager);
  const leagueId = Number((tournament.league as any)?.id ?? tournament.league);
  if (!Number.isFinite(leagueId) || leagueId <= 0) {
    throw new Error(`invalid leagueId for tournament ${tournament.id ?? 'new'}`);
  }
  const teamIds = await getTeamIdsByLeague(entityManager as any, leagueId);
  if (teamIds.length === 0) {
    throw new Error(`no real teams available for league ${leagueId}`);
  }

  const availablePlayers = await entityManager.find(RealPlayer, {
    active: true,
    id: { $nin: [...reservedIds] },
    position: { $in: [...PLAYER_POSITIONS] },
    realTeam: { $in: teamIds },
  });

  const groupedPlayers: Record<PlayerPosition, RealPlayer[]> = {
    goalkeeper: [],
    defender: [],
    midfielder: [],
    forward: [],
  };

  for (const player of availablePlayers) {
    groupedPlayers[player.position].push(player);
  }

  for (const position of PLAYER_POSITIONS) {
    if (groupedPlayers[position].length < required[position]) {
      throw new GameRuleError('No hay suficientes jugadores libres para completar los once titulares');
    }
  }

  const selectedPlayers: RealPlayer[] = [
    ...pickRandom(groupedPlayers.forward, required.forward),
    ...pickRandom(groupedPlayers.midfielder, required.midfielder),
    ...pickRandom(groupedPlayers.defender, required.defender),
    ...pickRandom(groupedPlayers.goalkeeper, required.goalkeeper),
  ];
  return persistInitialSquad(tournament, participant, selectedPlayers, entityManager, formation);
}

async function persistInitialSquad(tournament: Tournament, participant: Participant, selectedPlayers: RealPlayer[], entityManager: EntityManager, formation: ParticipantFormation = DEFAULT_FORMATION): Promise<number[]> {
  const selectedPlayerIds = selectedPlayers
    .map((player) => player.id)
    .filter((id): id is number => typeof id === 'number');

  await createDependantPlayersForSelection(tournament, selectedPlayers, entityManager);

  entityManager.create(ParticipantSquad, {
    participant,
    startingRealPlayersIds: selectedPlayerIds,
    substitutesRealPlayersIds: [],
    formation,
    acquisitionDate: new Date(),
    purchasePrice: 0,
    acquisitionType: SQUAD_ACQUISITION_TYPES[0],
  } as any);

  return selectedPlayerIds;
}

async function addMarketPlayersForNewParticipant(tournament: Tournament, quantity: number, entityManager: EntityManager, excludedRealPlayerIds: number[] = []): Promise<void> {
  if (quantity <= 0) {
    return;
  }

  const matchday = await getCurrentMatchday(tournament, entityManager);
  const reservedIds = await getTournamentReservedRealPlayerIds(tournament, entityManager);
  const leagueId = Number((tournament.league as any)?.id ?? tournament.league);
  if (!Number.isFinite(leagueId) || leagueId <= 0) {
    throw new Error(`invalid leagueId for tournament ${tournament.id ?? 'new'}`);
  }
  const teamIds = await getTeamIdsByLeague(entityManager as any, leagueId);
  if (teamIds.length === 0) {
    throw new Error(`no real teams available for league ${leagueId}`);
  }

  for (const excludedId of excludedRealPlayerIds) {
    reservedIds.add(excludedId);
  }

  const candidates = await entityManager.find(RealPlayer, {
    active: true,
    id: { $nin: [...reservedIds] },
    realTeam: { $in: teamIds },
  });

  if (candidates.length < quantity) {
    throw new GameRuleError('No hay suficientes jugadores libres para completar el mercado');
  }

  const chosenPlayers = pickRandom(candidates, quantity);
  const dependantIds = await createDependantPlayersForSelection(tournament, chosenPlayers, entityManager);

  entityManager.create(MatchdayMarket, {
    tournament,
    matchday,
    dependantPlayerIds: dependantIds,
    minimumPrice: 100,
    origin: MARKET_ORIGINS[0],
    creationDate: new Date(),
  } as any);
}

async function setupParticipantAfterJoin(tournament: Tournament, participant: Participant, entityManager: EntityManager): Promise<void> {
  // Registering in the lobby never assigns a squad or publishes a market.
  if (tournament.initialDrawState === 'waiting') return;
  if (participant.id && await entityManager.findOne(ParticipantSquad, { participant, acquisitionType: SQUAD_ACQUISITION_TYPES[0] })) return;
  const selectedIds = await assignInitialSquadToParticipant(tournament, participant, entityManager);
  await addMarketPlayersForNewParticipant(tournament, 3, entityManager, selectedIds);
  await entityManager.flush();
  participant.playingSince = new Date();
}

/** Called once inside the league/participant transaction, before the completion marker. */
async function drawTournamentInitialSquads(tournament: Tournament, participants: Participant[], entityManager: EntityManager) {
  if (!participants.length) throw new GameRuleError('No hay participantes para sortear');
  if (await entityManager.findOne(ParticipantSquad, { participant: { tournament } })) throw new GameRuleError('El torneo ya tiene planteles; no se puede repetir el sorteo');
  const teamIds = await getTeamIdsByLeague(entityManager as any, Number((tournament.league as any)?.id ?? tournament.league));
  const reserved = await getTournamentReservedRealPlayerIds(tournament, entityManager);
  const available = await entityManager.find(RealPlayer, { active: true, realTeam: { $in: teamIds }, id: { $nin: [...reserved] }, position: { $in: [...PLAYER_POSITIONS] } });
  if (available.length < participants.length * 14) throw new GameRuleError('Faltan jugadores libres para los once titulares y los tres jugadores de mercado por participante');
  const ratings = await entityManager.find(PlayerPerformance, { league: tournament.league, realPlayer: { $in: available.map(p => p.id!) } });
  const totals = new Map<number, { sum: number; count: number }>();
  for (const rating of ratings) {
    if (!Number.isFinite(rating.pointsObtained)) continue;
    const id = Number((rating.realPlayer as any)?.id ?? rating.realPlayer);
    const entry = totals.get(id) ?? { sum: 0, count: 0 };
    entry.sum += rating.pointsObtained; entry.count++;
    totals.set(id, entry);
  }
  const quality = new Map([...totals].map(([id, data]) => [id, data.sum / data.count]));
  const rated = available.filter(p => quality.has(p.id!));
  const required = getRequiredPlayersByPosition(DEFAULT_FORMATION);
  for (const position of PLAYER_POSITIONS) {
    if (rated.filter(p => p.position === position).length < required[position] * participants.length) {
      throw new GameRuleError('Faltan jugadores con notas deportivas guardadas para completar el sorteo equilibrado. La sala de espera se conserva.');
    }
  }
  const selection = drawInitialSquads(rated as Array<RealPlayer & { id: number }>, participants.map(p => p.id!), quality);
  const averages: Record<string, number> = {};
  // Assign ALL squads before publishing ANY market, avoiding priority by join order.
  for (const participant of participants) {
    const players = selection.get(participant.id!)!;
    await persistInitialSquad(tournament, participant, players, entityManager);
    averages[String(participant.id)] = players.reduce((sum, p) => sum + quality.get(p.id!)!, 0) / 11;
  }
  await entityManager.flush();
  await addMarketPlayersForNewParticipant(tournament, participants.length * 3, entityManager);
  return { criterion: 'stored_rating_mean', participantCount: participants.length, averages,
    qualityByPlayer: Object.fromEntries([...selection.values()].flat().map(p => [p.id!, { mean: quality.get(p.id!)!, ratings: totals.get(p.id!)!.count }])),
    realPlayerIdsByParticipant: Object.fromEntries([...selection].map(([id, players]) => [id, players.map(p => p.id!)])) };
}

export { setupParticipantAfterJoin, drawTournamentInitialSquads };
