import { fetchAllowedLeagueDetailsFromSportsApiPro } from '../../../integrations/sportsapipro/sportsapipro.client.js';

export async function getSportsApiProAllowedLeaguesService() {
  return fetchAllowedLeagueDetailsFromSportsApiPro();
}
