import { orm } from '../../../shared/db/orm.js';
import { RealTeam } from '../realTeam.entity.js';
import { League } from '../../League/league.entity.js';
//import { getCompetitionTeamsBySportAndCompetitionService } from '../../ExternalApi/services/getCompetitionTeamsBySportAndCompetition.service.js';
/*
const em = orm.em;

export async function persistTeamsByIdLeagueService(sportId: number, competitionId: number, leagueId: number) {
  const payload = await getCompetitionTeamsBySportAndCompetitionService(sportId, competitionId);
  const league = await em.findOneOrFail(League, { id: leagueId });

  let created = 0;
  let updated = 0;

  for (const team of payload.teams) {
    const existing = await em.findOne(RealTeam, { idEnApi: team.id }, { populate: ['league'] });

    if (existing) {
      existing.name = team.name ?? `Team ${team.id}`;
      existing.league = league;
      updated += 1;
      continue;
    }

    em.create(RealTeam, {
      name: team.name ?? `Team ${team.id}`,
      idEnApi: team.id,
      league,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    created += 1;
  }

  await em.flush();

  return {
    competitionId,
    leagueId,
    imported: payload.teams.length,
    created,
    updated,
  };
}
*/