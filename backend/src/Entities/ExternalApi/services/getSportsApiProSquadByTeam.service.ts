import { requestSportsApiPro } from '../../../integrations/sportsapipro/sportsapipro.client.js';

export async function getSportsApiProSquadByTeamService(teamId: number) {
  return requestSportsApiPro('/squads', { competitors: teamId });
}
