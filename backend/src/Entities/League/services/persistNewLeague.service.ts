import { orm } from '../../../shared/db/orm.js';
import { League } from '../league.entity.js';
import { getCompetitionTeamsBySportAndCompetitionService } from '../../ExternalApi/services/getCompetitionTeamsBySportAndCompetition.service.js';
import { persistTeamsByIdLeagueService } from '../../RealTeam/services/persistTeamsByIdLeague.service.js';

const em = orm.em;

export async function persistNewLeagueService(sportId: number, competitionId: number) {
  const external = await getCompetitionTeamsBySportAndCompetitionService(sportId, competitionId);

  let league = await em.findOne(League, { idEnApi: competitionId });

  if (!league) {
    league = em.create(League, {
      name: external.competitionName ?? `League ${competitionId}`,
      country: external.countryName ?? 'Unknown',
      sport: String(sportId),
      idEnApi: competitionId,
      seasonNum: external.seasonNum,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    league.name = external.competitionName ?? league.name;
    league.country = external.countryName ?? league.country;
    league.sport = String(sportId);
    league.seasonNum = external.seasonNum;
  }

  await em.flush();

  if (typeof league.id !== 'number') {
    throw new Error('Could not persist league id');
  }

  const teamsSync = await persistTeamsByIdLeagueService(sportId, competitionId, league.id);

  return {
    league,
    teamsSync,
  };
}
