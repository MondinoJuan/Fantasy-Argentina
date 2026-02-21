import { fetchPlayerByIdFromSportsApiPro } from '../../../integrations/sportsapipro/sportsapipro.client.js';

export async function getSportsApiProPlayerByIdService(playerId: number) {
  return fetchPlayerByIdFromSportsApiPro(playerId);
}
