import { EntityManager } from '@mikro-orm/core';
import { Matchday } from '../../Entities/Matchday/matchday.entity.js';
import { serverNow } from '../time/serverClock.js';

export type SquadLockWindow = {
  locked: boolean;
  leagueId: number;
  matchdayId: number | null;
  lockStartsAt: Date | null;
  lockEndsAt: Date | null;
  reason: string | null;
};

export class SquadAndClausesLockedError extends Error {
  readonly lockWindow: SquadLockWindow;

  constructor(lockWindow: SquadLockWindow) {
    super(
      lockWindow.lockEndsAt
        ? `squad and clauses are locked until ${lockWindow.lockEndsAt.toISOString()}`
        : 'squad and clauses are locked',
    );
    this.name = 'SquadAndClausesLockedError';
    this.lockWindow = lockWindow;
  }
}

export async function resolveSquadLockWindowByLeague(
  entityManager: EntityManager,
  leagueId: number,
  referenceDate: Date = serverNow(),
): Promise<SquadLockWindow> {
  const matchdays = await entityManager.find(
    Matchday,
    {
      league: { id: leagueId },
      startDate: { $lte: referenceDate },
    } as any,
    {
      orderBy: { startDate: 'desc' } as any,
      limit: 8,
    },
  );

  for (const matchday of matchdays) {
    if (matchday.status === 'completed') {
      continue;
    }

    const lockStartsAt = matchday.startDate ? new Date(matchday.startDate) : null;
    const lockEndsAt = matchday.autoUpdateAt
      ? new Date(matchday.autoUpdateAt)
      : (matchday.endDate ? new Date(matchday.endDate) : null);

    if (!lockStartsAt || !lockEndsAt) {
      continue;
    }

    if (referenceDate.getTime() >= lockStartsAt.getTime() && referenceDate.getTime() < lockEndsAt.getTime()) {
      return {
        locked: true,
        leagueId,
        matchdayId: Number(matchday.id ?? 0) || null,
        lockStartsAt,
        lockEndsAt,
        reason: 'matchday_lock_window',
      };
    }
  }

  return {
    locked: false,
    leagueId,
    matchdayId: null,
    lockStartsAt: null,
    lockEndsAt: null,
    reason: null,
  };
}

export async function assertSquadAndClausesUnlockedByLeague(
  entityManager: EntityManager,
  leagueId: number,
  referenceDate: Date = serverNow(),
): Promise<void> {
  const lockWindow = await resolveSquadLockWindowByLeague(entityManager, leagueId, referenceDate);
  if (lockWindow.locked) {
    throw new SquadAndClausesLockedError(lockWindow);
  }
}
