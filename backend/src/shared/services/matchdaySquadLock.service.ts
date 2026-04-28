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

export type TournamentLockOptions = {
  allowSquadChangesDuringMatchday?: boolean;
  allowClauseExecutionDuringMatchday?: boolean;
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
  const latestStartedMatchday = await entityManager.findOne(
    Matchday,
    {
      league: { id: leagueId },
      startDate: { $lte: referenceDate },
    } as any,
    {
      orderBy: { startDate: 'desc' } as any,
    },
  );

  if (!latestStartedMatchday) {
    return {
      locked: false,
      leagueId,
      matchdayId: null,
      lockStartsAt: null,
      lockEndsAt: null,
      reason: null,
    };
  }

  // Usamos la última fecha que ya comenzó como referencia de bloqueo.
  // Así evitamos bloquear por fechas viejas reprogramadas (ej: fecha 9)
  // y también bloqueamos al llegar el startDate aunque el status aún no haya migrado a in_progress.
  if (latestStartedMatchday.status === 'completed' || latestStartedMatchday.status === 'cancelled') {
    return {
      locked: false,
      leagueId,
      matchdayId: null,
      lockStartsAt: null,
      lockEndsAt: null,
      reason: null,
    };
  }

  const lockStartsAt = latestStartedMatchday.startDate ? new Date(latestStartedMatchday.startDate) : null;
  const lockEndsAt = latestStartedMatchday.autoUpdateAt
    ? new Date(latestStartedMatchday.autoUpdateAt)
    : (latestStartedMatchday.endDate ? new Date(latestStartedMatchday.endDate) : null);

  if (lockStartsAt && lockEndsAt
    && referenceDate.getTime() >= lockStartsAt.getTime()
    && referenceDate.getTime() < lockEndsAt.getTime()) {
    return {
      locked: true,
      leagueId,
      matchdayId: Number(latestStartedMatchday.id ?? 0) || null,
      lockStartsAt,
      lockEndsAt,
      reason: 'matchday_lock_window',
    };
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
  options: TournamentLockOptions = {},
): Promise<void> {
  const shouldBypassLock = Boolean(options.allowSquadChangesDuringMatchday) || Boolean(options.allowClauseExecutionDuringMatchday);
  if (shouldBypassLock) {
    return;
  }

  const lockWindow = await resolveSquadLockWindowByLeague(entityManager, leagueId, referenceDate);
  if (lockWindow.locked) {
    throw new SquadAndClausesLockedError(lockWindow);
  }
}
