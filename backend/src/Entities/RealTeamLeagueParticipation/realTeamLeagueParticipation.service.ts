import { EntityManager } from '@mikro-orm/mysql';
import { League } from '../League/league.entity.js';
import { RealTeam } from '../RealTeam/realTeam.entity.js';
import { RealTeamLeagueParticipation } from './realTeamLeagueParticipation.entity.js';

export async function ensureLeagueParticipation(
  em: EntityManager,
  realTeam: RealTeam,
  league: League,
): Promise<RealTeamLeagueParticipation> {
  const existing = await em.findOne(RealTeamLeagueParticipation, { realTeam, league });
  if (existing) {
    return existing;
  }

  return em.create(RealTeamLeagueParticipation, {
    realTeam,
    league,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function ensureLeagueParticipationsForTeamIds(
  em: EntityManager,
  teamIds: number[],
  league: League,
): Promise<void> {
  for (const teamId of teamIds) {
    const realTeam = await em.findOne(RealTeam, { id: teamId });
    if (!realTeam) continue;
    await ensureLeagueParticipation(em, realTeam, league);
  }
}

export async function getTeamIdsByLeague(
  em: EntityManager,
  leagueId: number,
): Promise<number[]> {
  const participations = await em.find(
    RealTeamLeagueParticipation,
    { league: { id: leagueId } } as any,
    { populate: ['realTeam'], fields: ['realTeam'] as any },
  );

  const participationTeamIds = [...new Set(participations
    .map((participation: any) => Number(participation.realTeam?.id ?? participation.realTeam))
    .filter((id) => Number.isFinite(id)))];

  if (participationTeamIds.length > 0) {
    return participationTeamIds;
  }

  const legacyTeams = await em.find(RealTeam, { league: { id: leagueId } } as any, { fields: ['id'] as any });
  const legacyTeamIds = legacyTeams.map((team: any) => Number(team.id)).filter((id) => Number.isFinite(id));

  if (legacyTeamIds.length === 0) {
    return [];
  }

  const league = await em.findOne(League, { id: leagueId });
  if (!league) {
    return legacyTeamIds;
  }

  await ensureLeagueParticipationsForTeamIds(em, legacyTeamIds, league);
  return legacyTeamIds;
}
