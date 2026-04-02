import { EntityManager } from '@mikro-orm/core';
import { orm } from '../../shared/db/orm.js';
import { MATCHDAY_STATUSES, MARKET_ORIGINS, PARTICIPANT_FORMATIONS, PLAYER_POSITIONS, SQUAD_ACQUISITION_TYPES, type ParticipantFormation, type PlayerPosition } from '../../shared/domain-enums.js';
import { DependantPlayer } from '../DependantPlayer/dependantPlayer.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { MatchdayMarket } from '../MatchdayMarket/matchdayMarket.entity.js';
import { Participant } from '../Participant/participant.entity.js';
import { ParticipantSquad } from '../ParticipantSquad/participantSquad.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
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

async function getOrCreateCurrentMatchday(tournament: Tournament, entityManager: EntityManager): Promise<Matchday> {
  const current = await entityManager.findOne(Matchday, {
    league: tournament.league,
    status: { $in: [MATCHDAY_STATUSES[1], MATCHDAY_STATUSES[2]] },
  }, {
    orderBy: { matchdayNumber: 'asc' },
  });

  if (current) {
    return current;
  }

  const existingFirst = await entityManager.findOne(Matchday, {
    league: tournament.league,
    matchdayNumber: 1,
  });

  if (existingFirst) {
    return existingFirst;
  }

  const matchday = entityManager.create(Matchday, {
    league: tournament.league,
    season: String(new Date().getFullYear()),
    matchdayNumber: 1,
    startDate: new Date(),
    endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    status: MATCHDAY_STATUSES[1],
  } as any);

  entityManager.persist(matchday);
  return matchday;
}

async function getTournamentReservedRealPlayerIds(tournament: Tournament, entityManager: EntityManager): Promise<Set<number>> {
  const dependantPlayers = await entityManager.find(DependantPlayer, { tournament }, { populate: ['realPlayer'] });
  const reservedIds = new Set<number>();

  for (const dependantPlayer of dependantPlayers) {
    const realPlayerId = dependantPlayer.realPlayer.id;

    if (realPlayerId) {
      reservedIds.add(realPlayerId);
    }
  }

  return reservedIds;
}

async function createDependantPlayersForSelection(tournament: Tournament, players: RealPlayer[], entityManager: EntityManager): Promise<number[]> {
  const createdDependantPlayers: DependantPlayer[] = [];

  for (const player of players) {
    const dependantPlayer = entityManager.create(DependantPlayer, {
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

  const availablePlayers = await entityManager.find(RealPlayer, {
    active: true,
    id: { $nin: [...reservedIds] },
    position: { $in: [...PLAYER_POSITIONS] },
    realTeam: {
      league: tournament.league,
    },
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
      throw new Error(`not enough available real players for position ${position} in tournament ${tournament.id ?? 'new'}`);
    }
  }

  const selectedPlayers: RealPlayer[] = [
    ...pickRandom(groupedPlayers.goalkeeper, required.goalkeeper),
    ...pickRandom(groupedPlayers.defender, required.defender),
    ...pickRandom(groupedPlayers.midfielder, required.midfielder),
    ...pickRandom(groupedPlayers.forward, required.forward),
  ];

  const selectedPlayerIds = selectedPlayers
    .map((player) => player.id)
    .filter((id): id is number => typeof id === 'number');

  const dependantIds = await createDependantPlayersForSelection(tournament, selectedPlayers, entityManager);

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

  const matchday = await getOrCreateCurrentMatchday(tournament, entityManager);
  const reservedIds = await getTournamentReservedRealPlayerIds(tournament, entityManager);

  for (const excludedId of excludedRealPlayerIds) {
    reservedIds.add(excludedId);
  }

  const candidates = await entityManager.find(RealPlayer, {
    active: true,
    id: { $nin: [...reservedIds] },
    realTeam: {
      league: tournament.league,
    },
  }, {
    limit: 500,
  });

  if (candidates.length < quantity) {
    throw new Error(`not enough available real players to add ${quantity} players to tournament market ${tournament.id ?? 'new'}`);
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

async function setupParticipantAfterJoin(tournament: Tournament, participant: Participant, entityManager: EntityManager = orm.em): Promise<void> {
  const selectedIds = await assignInitialSquadToParticipant(tournament, participant, entityManager);
  await addMarketPlayersForNewParticipant(tournament, 4, entityManager, selectedIds);
}

export { setupParticipantAfterJoin };
