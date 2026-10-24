import { EntityManager } from '@mikro-orm/core';
import { ParticipantSquad } from '../../Entities/ParticipantSquad/participantSquad.entity.js';
import { Participant } from '../../Entities/Participant/participant.entity.js';
import { PlayerClause } from '../../Entities/PlayerClause/playerClause.entity.js';
import { gameTransaction, cancelPlayerOffers } from './gameEconomy.service.js';
import { assertSquadAndClausesUnlockedByLeague } from './matchdaySquadLock.service.js';
import { GameRuleError, entityId, normalizeSquad, ownedIds } from '../domain/game-rules.js';

export async function saveSquad(em: EntityManager, input: any, actor: { id: number; type: string }, id?: number, remove = false) {
  const existing = id ? await em.fork().findOneOrFail(ParticipantSquad, { id }, { populate: ['participant'] }) : null;
  const participantId = entityId(existing?.participant ?? input.participant);
  const originalParticipant = await em.fork().findOneOrFail(Participant, { id: participantId });
  return gameTransaction(em, entityId(originalParticipant.tournament), 'squad_edit', async (tx, tournament) => {
    const participant = await tx.findOneOrFail(Participant, { id: participantId });
    if (actor.type !== 'SUPERADMIN' && entityId(participant.user) !== actor.id) throw new GameRuleError('No es tu plantel', 403);
    const squad = id ? await tx.findOneOrFail(ParticipantSquad, { id }) : null;
    if (input.participant !== undefined && entityId(input.participant) !== participantId) throw new GameRuleError('No se puede cambiar el dueño de un plantel', 400);
    await assertSquadAndClausesUnlockedByLeague(tx, entityId(tournament.league), undefined, { allowSquadChangesDuringMatchday: tournament.allowSquadChangesDuringMatchday });
    if (remove && squad) {
      for (const playerId of ownedIds(squad)) await cancelPlayerOffers(tx, tournament.id!, playerId);
      for (const clause of await tx.find(PlayerClause, { ownerParticipant: participant })) tx.remove(clause);
      tx.remove(squad); return null;
    }
    const normalized = normalizeSquad({ ...squad, ...input }, input.startingSlots);
    if (squad && actor.type !== 'SUPERADMIN') {
      const before = ownedIds(squad), after = ownedIds(normalized);
      if (before.length !== after.length || after.some(playerId => !before.includes(playerId))) throw new GameRuleError('Solo podés alinear jugadores de tu propiedad', 403);
    }
    if (squad) { Object.assign(squad, normalized, { formation: input.formation ?? squad.formation }); return squad; }
    if (actor.type !== 'SUPERADMIN') throw new GameRuleError('El plantel se crea al ingresar al torneo', 403);
    return tx.create(ParticipantSquad, { ...input, ...normalized, participant, createdAt: new Date(), updatedAt: new Date() } as any);
  });
}
