import { fetchTeamDetailByTeamIdFromSportsApiPro } from '../../../integrations/sportsapipro/sportsapipro.client.js';

export async function getSportsApiProTeamDetailByTeamService(teamId: number) {
  return fetchTeamDetailByTeamIdFromSportsApiPro(teamId);
}
