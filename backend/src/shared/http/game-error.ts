import type { Response } from 'express';
import { GameRuleError } from '../domain/game-rules.js';
import { SquadAndClausesLockedError } from '../services/matchdaySquadLock.service.js';

export function gameError(res: Response, error: any) {
  if (error instanceof GameRuleError) return res.status(error.status).json({ message: error.message });
  if (error instanceof SquadAndClausesLockedError) return res.status(423).json({ message: error.message, data: error.lockWindow });
  if (error?.name === 'NotFoundError') return res.status(404).json({ message: 'Recurso inexistente' });
  console.error('[game-command]', error);
  return res.status(500).json({ message: 'No se pudo completar la operación' });
}
