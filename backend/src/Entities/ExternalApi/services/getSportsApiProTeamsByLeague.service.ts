import { fetchTeamsByLeagueIdFromSportsApiPro } from '../../../integrations/sportsapipro/sportsapipro.client.js';

export async function getSportsApiProTeamsByLeagueService(leagueId: number) {
  return fetchTeamsByLeagueIdFromSportsApiPro(leagueId);
}
