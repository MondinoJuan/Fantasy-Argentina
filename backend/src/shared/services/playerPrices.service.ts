import { EntityManager, LockMode } from '@mikro-orm/core';
import { League } from '../../Entities/League/league.entity.js';
import { PlayerPerformance } from '../../Entities/PlayerPerformance/playerPerformance.entity.js';
import { RealPlayerLeagueValue } from '../../Entities/RealPlayerLeagueValue/realPlayerLeagueValue.entity.js';
import { priceHistory } from '../domain/player-prices.js';

/** Local database only. League lock serializes manual refreshes, closures and recoveries. */
export async function evolveLeaguePrices(em: EntityManager, leagueId: number) {
  return em.transactional(async tx => {
    const league = await tx.findOneOrFail(League, { id: leagueId }, { lockMode: LockMode.PESSIMISTIC_WRITE });
    const min = Number(league.limiteMin ?? 1_000_000), max = Number(league.limiteMax ?? 7_000_000);
    const rows = await tx.find(RealPlayerLeagueValue, { league });
    const ratings = await tx.find(PlayerPerformance, { league, match: { status: 'finalizado' } }, { populate: ['match'] });
    const byPlayer = new Map<number, typeof ratings>();
    for (const rating of ratings) {
      const id = Number((rating.realPlayer as any)?.id ?? rating.realPlayer);
      const list = byPlayer.get(id) ?? [];
      list.push(rating); byPlayer.set(id, list);
    }
    let updatedPlayers = 0;
    for (const row of rows) {
      const playerId = Number((row.realPlayer as any)?.id ?? row.realPlayer);
      const inputs = (byPlayer.get(playerId) ?? []).filter(r => r.match?.startDateTime
        && new Date(r.match.startDateTime).getTime() >= new Date(row.evolutionStartedAt).getTime())
        .map(r => ({ id: r.match!.id!, kickoff: new Date(r.match!.startDateTime).getTime(), score: Number(r.pointsObtained) }));
      if (!inputs.length || !Number.isFinite(row.translatedValue)) continue;
      const base = row.evolutionBase ?? row.translatedValue!;
      const history = priceHistory(base, inputs, min, max);
      if (JSON.stringify(history) === JSON.stringify(row.evolutionHistory)) continue;
      row.evolutionBase = base;
      row.evolutionHistory = history;
      row.translatedValue = history[history.length - 1]?.after ?? base;
      updatedPlayers++;
    }
    await tx.flush();
    return { leagueId, updatedPlayers };
  });
}
