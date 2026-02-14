import { Request, Response, NextFunction } from 'express';
import { Tournament } from './tournament.entity.js';
import { orm } from '../../shared/db/orm.js';
import { Participant } from '../Participant/participant.entity.js';
import { Matchday } from '../Matchday/matchday.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { ParticipantSquad } from '../ParticipantSquad/participantSquad.entity.js';
import { MatchdayMarket } from '../MatchdayMarket/matchdayMarket.entity.js';

const em = orm.em;
const DEFAULT_FORMATION = '4-4-2';

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeTournamentInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeTournamentInput = {
    name: req.body.name,
    league: req.body.league ?? req.body.leagueId,
    sport: req.body.sport,
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

async function requestInitialPlayersFromExternalApi(_sport: string, _leagueId: number): Promise<RealPlayer[]> {
  // TODO(API-EXTERNA): acá va la llamada real a API externa para traer 11 titulares aleatorios para el creador.
  return [];
}

function normalizePosition(position: string): string {
  const value = position.toLowerCase();
  if (value.includes('goal')) return 'goalkeeper';
  if (value.includes('def')) return 'defender';
  if (value.includes('mid')) return 'midfielder';
  if (value.includes('for') || value.includes('strik') || value.includes('att')) return 'forward';
  return value;
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

async function bootstrapCreatorTeam(tournament: Tournament, creatorParticipant: Participant): Promise<void> {
  const firstMatchday = em.create(Matchday, {
    league: tournament.league,
    season: String(new Date().getFullYear()),
    matchdayNumber: 1,
    startDate: new Date(),
    endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    status: 'upcoming',
  } as any);
  em.persist(firstMatchday);

  const fromExternalApi = await requestInitialPlayersFromExternalApi(tournament.sport, 0);

  const allPlayers = fromExternalApi.length > 0
    ? fromExternalApi
    : await em.find(RealPlayer, {}, { populate: ['realTeam'] });

  const grouped = {
    goalkeeper: allPlayers.filter((player) => normalizePosition(player.position) === 'goalkeeper'),
    defender: allPlayers.filter((player) => normalizePosition(player.position) === 'defender'),
    midfielder: allPlayers.filter((player) => normalizePosition(player.position) === 'midfielder'),
    forward: allPlayers.filter((player) => normalizePosition(player.position) === 'forward'),
  };

  const squad = [
    ...pickRandom(grouped.goalkeeper, 1),
    ...pickRandom(grouped.defender, 4),
    ...pickRandom(grouped.midfielder, 4),
    ...pickRandom(grouped.forward, 2),
  ];

  for (const player of squad) {
    em.create(ParticipantSquad, {
      participant: creatorParticipant,
      realPlayer: player,
      formation: DEFAULT_FORMATION,
      acquisitionDate: new Date(),
      purchasePrice: player.marketValue ?? null,
      acquisitionType: 'initial_assignment',
    } as any);
  }

  const selectedIds = new Set(squad.map((player) => player.id));
  const marketCandidates = allPlayers.filter((player) => player.id && !selectedIds.has(player.id));

  for (const player of pickRandom(marketCandidates, 3)) {
    em.create(MatchdayMarket, {
      tournament,
      matchday: firstMatchday,
      realPlayer: player,
      minimumPrice: 100,
      origin: 'system_initial_market',
      creationDate: new Date(),
    } as any);
  }
}

async function findAll(req: Request, res: Response) {
  try {
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
    const { creatorUserId, ...tournamentInput } = req.body.sanitizeTournamentInput;
    const item = em.create(Tournament, tournamentInput);

    if (creatorUserId) {
      const creatorParticipant = em.create(Participant, {
        user: creatorUserId,
        tournament: item,
        bankBudget: item.initialBudget,
        reservedMoney: 0,
        availableMoney: item.initialBudget,
        totalScore: 0,
        joinDate: new Date(),
      } as any);

      await bootstrapCreatorTeam(item, creatorParticipant);
    }

    await em.flush();
    res.status(201).json({ message: 'tournament created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message, sqlMessage: error?.sqlMessage, code: error?.code });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(Tournament, id);
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

export { sanitizeTournamentInput, findAll, findOne, add, update, remove };
