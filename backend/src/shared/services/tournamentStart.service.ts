import { EntityManager } from '@mikro-orm/core';
import { Participant } from '../../Entities/Participant/participant.entity.js';
import { drawTournamentInitialSquads } from '../../Entities/Tournament/tournament-participation.service.js';
import { GameRuleError, entityId } from '../domain/game-rules.js';
import { gameTransaction } from './gameEconomy.service.js';

export async function startTournament(em: EntityManager, tournamentId: number, actor: { id: number; type: string }) {
  return gameTransaction(em, tournamentId, 'initial_assignment', async (tx, tournament) => {
    if (actor.type !== 'SUPERADMIN' && (tournament.creatorUserId !== actor.id
      || !await tx.findOne(Participant, { tournament, user: actor.id, retiredAt: null }))) {
      throw new GameRuleError('Solo el creador puede arrancar el torneo', 403);
    }
    if (tournament.initialDrawState !== 'waiting') return { alreadyStarted: true, summary: tournament.initialDrawSummary ?? null };
    if (['finished', 'archived'].includes(tournament.status)) throw new GameRuleError('Este torneo no puede iniciarse');
    const participants = await tx.find(Participant, { tournament, retiredAt: null }, { orderBy: { id: 'asc' } });
    const summary = await drawTournamentInitialSquads(tournament, participants, tx);
    tournament.initialDrawCompletedAt = new Date();
    for (const participant of participants) participant.playingSince = tournament.initialDrawCompletedAt;
    tournament.initialDrawSummary = summary;
    tournament.initialDrawState = 'completed';
    tournament.status = 'active';
    return { alreadyStarted: false, tournamentId: entityId(tournament), summary };
  });
}
