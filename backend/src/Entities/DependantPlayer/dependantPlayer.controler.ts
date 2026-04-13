import { Request, Response } from 'express';
import { orm } from '../../shared/db/orm.js';
import { DependantPlayer } from './dependantPlayer.entity.js';
import { getRealPlayerLeagueTranslatedValuesMap } from '../RealPlayerLeagueValue/realPlayerLeagueValue.service.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(DependantPlayer, {}, { populate: ['tournament', 'tournament.league', 'realPlayer', 'realPlayer.realTeam'] });
    const leagueIdByTournamentId = new Map<number, number>();
    for (const item of items) {
      const tournamentId = Number((item.tournament as any)?.id ?? item.tournament);
      const leagueId = Number((item.tournament as any)?.league?.id ?? (item.tournament as any)?.league);
      if (Number.isFinite(tournamentId) && tournamentId > 0 && Number.isFinite(leagueId) && leagueId > 0) {
        leagueIdByTournamentId.set(tournamentId, leagueId);
      }
    }

    const realPlayerIds = [...new Set(items
      .map((item) => Number((item.realPlayer as any)?.id ?? item.realPlayer))
      .filter((id) => Number.isFinite(id) && id > 0))];

    const translatedMapByLeague = new Map<number, Map<number, number | null>>();
    for (const leagueId of new Set(leagueIdByTournamentId.values())) {
      translatedMapByLeague.set(leagueId, await getRealPlayerLeagueTranslatedValuesMap(em as any, leagueId, realPlayerIds));
    }

    for (const item of items) {
      const tournamentId = Number((item.tournament as any)?.id ?? item.tournament);
      const realPlayerId = Number((item.realPlayer as any)?.id ?? item.realPlayer);
      const leagueId = leagueIdByTournamentId.get(tournamentId);
      if (!leagueId || !Number.isFinite(realPlayerId) || realPlayerId <= 0) continue;
      const value = translatedMapByLeague.get(leagueId)?.get(realPlayerId) ?? null;
      (item.realPlayer as any).translatedValue = value;
    }

    res.status(200).json({ message: 'found all dependant players', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(DependantPlayer, { id }, { populate: ['tournament', 'tournament.league', 'realPlayer', 'realPlayer.realTeam'] });
    const leagueId = Number((item.tournament as any)?.league?.id ?? (item.tournament as any)?.league);
    const realPlayerId = Number((item.realPlayer as any)?.id ?? item.realPlayer);
    if (Number.isFinite(leagueId) && leagueId > 0 && Number.isFinite(realPlayerId) && realPlayerId > 0) {
      const translated = await getRealPlayerLeagueTranslatedValuesMap(em as any, leagueId, [realPlayerId]);
      (item.realPlayer as any).translatedValue = translated.get(realPlayerId) ?? null;
    }
    res.status(200).json({ message: 'found dependant player', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { findAll, findOne };
