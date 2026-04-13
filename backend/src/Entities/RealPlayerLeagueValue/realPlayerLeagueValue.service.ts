import { EntityManager } from '@mikro-orm/core';
import { League } from '../League/league.entity.js';
import { RealPlayer } from '../RealPlayer/realPlayer.entity.js';
import { RealPlayerLeagueValue } from './realPlayerLeagueValue.entity.js';

export async function upsertRealPlayerLeagueTranslatedValue(
  em: EntityManager,
  params: { realPlayer: RealPlayer; league: League; translatedValue: number | null },
): Promise<RealPlayerLeagueValue> {
  const existing = await em.findOne(RealPlayerLeagueValue, {
    realPlayer: params.realPlayer,
    league: params.league,
  });

  if (existing) {
    existing.translatedValue = params.translatedValue;
    return existing;
  }

  return em.create(RealPlayerLeagueValue, {
    realPlayer: params.realPlayer,
    league: params.league,
    translatedValue: params.translatedValue,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function getRealPlayerLeagueTranslatedValuesMap(
  em: EntityManager,
  leagueId: number,
  realPlayerIds: number[],
): Promise<Map<number, number | null>> {
  if (!Array.isArray(realPlayerIds) || realPlayerIds.length === 0) {
    return new Map<number, number | null>();
  }

  const rows = await em.find(
    RealPlayerLeagueValue,
    {
      league: { id: leagueId },
      realPlayer: { $in: realPlayerIds },
    } as any,
    { populate: ['realPlayer'] },
  );

  const out = new Map<number, number | null>();
  for (const row of rows) {
    const realPlayerId = Number((row.realPlayer as any)?.id ?? row.realPlayer);
    if (!Number.isFinite(realPlayerId) || realPlayerId <= 0) continue;
    out.set(realPlayerId, row.translatedValue ?? null);
  }

  return out;
}

export async function getRealPlayerLeagueTranslatedValue(
  em: EntityManager,
  leagueId: number,
  realPlayerId: number,
): Promise<number | null> {
  const row = await em.findOne(
    RealPlayerLeagueValue,
    { league: { id: leagueId }, realPlayer: { id: realPlayerId } } as any,
  );
  return row?.translatedValue ?? null;
}
