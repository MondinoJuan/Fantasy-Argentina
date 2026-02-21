import { fetchPlayersByTeamIdFromSportsApiPro } from '../../../integrations/sportsapipro/sportsapipro.client.js';

export async function getSportsApiProPlayersByTeamService(teamId: number) {
  return fetchPlayersByTeamIdFromSportsApiPro(teamId);
}
