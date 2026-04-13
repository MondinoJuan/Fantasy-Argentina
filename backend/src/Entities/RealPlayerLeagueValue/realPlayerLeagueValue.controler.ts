import { Request, Response } from 'express';
import { orm } from '../../shared/db/orm.js';
import { RealPlayerLeagueValue } from './realPlayerLeagueValue.entity.js';

const em = orm.em;

async function findByLeagueId(req: Request, res: Response) {
  try {
    const leagueId = Number.parseInt(String(req.query?.leagueId ?? ''), 10);

    if (!Number.isFinite(leagueId) || leagueId <= 0) {
      res.status(400).json({ message: 'leagueId query param is required and must be a positive number' });
      return;
    }

    const items = await em.find(
      RealPlayerLeagueValue,
      { league: { id: leagueId } } as any,
      { populate: ['realPlayer', 'league'] },
    );

    res.status(200).json({
      message: 'found real player league values by leagueId',
      data: items.map((item) => ({
        id: item.id,
        realPlayerId: Number((item.realPlayer as any)?.id ?? item.realPlayer),
        leagueId: Number((item.league as any)?.id ?? item.league),
        translatedValue: item.translatedValue ?? null,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { findByLeagueId };
