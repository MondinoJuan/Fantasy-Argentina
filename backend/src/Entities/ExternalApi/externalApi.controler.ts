import { Request, Response } from 'express';
import {
  fetchLeaguesFromDashboard,
  fetchSeasonsFromDashboard,
  fetchTeamsFromDashboard,
  fetchPlayersFromDashboard,
  fetchPlayerRatingFromDashboard,
} from '../../integrations/api-football/dashboard.client.js';

function parseRequiredNumber(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getDashboardLeagues(req: Request, res: Response) {
  try {
    // API-EXTERNA: obtiene ligas desde API-Football.
    const data = await fetchLeaguesFromDashboard();
    res.status(200).json({ message: 'dashboard leagues fetched', data });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function getDashboardSeasons(req: Request, res: Response) {
  try {
    // API-EXTERNA: obtiene temporadas desde API-Football.
    const data = await fetchSeasonsFromDashboard();
    res.status(200).json({ message: 'dashboard seasons fetched', data });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function getDashboardTeams(req: Request, res: Response) {
  const leagueId = parseRequiredNumber(req.query.leagueId as string | undefined);
  const season = parseRequiredNumber(req.query.season as string | undefined);

  if (!leagueId || !season) {
    return res.status(400).json({ message: 'leagueId and season query params are required numbers' });
  }

  try {
    // API-EXTERNA: obtiene equipos desde API-Football.
    const data = await fetchTeamsFromDashboard(leagueId, season);
    res.status(200).json({ message: 'dashboard teams fetched', data });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function getDashboardPlayers(req: Request, res: Response) {
  const teamId = parseRequiredNumber(req.query.teamId as string | undefined);
  const season = parseRequiredNumber(req.query.season as string | undefined);

  if (!teamId || !season) {
    return res.status(400).json({ message: 'teamId and season query params are required numbers' });
  }

  try {
    // API-EXTERNA: obtiene jugadores desde API-Football.
    const data = await fetchPlayersFromDashboard(teamId, season);
    res.status(200).json({ message: 'dashboard players fetched', data });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function getDashboardPlayerRating(req: Request, res: Response) {
  const fixtureId = parseRequiredNumber(req.query.fixtureId as string | undefined);
  const playerId = parseRequiredNumber(req.query.playerId as string | undefined);

  if (!fixtureId || !playerId) {
    return res.status(400).json({ message: 'fixtureId and playerId query params are required numbers' });
  }

  try {
    // API-EXTERNA: obtiene rating de jugador desde API-Football.
    const data = await fetchPlayerRatingFromDashboard(fixtureId, playerId);

    if (!data) {
      return res.status(404).json({ message: 'player rating not found for the given fixture and player' });
    }

    res.status(200).json({ message: 'dashboard player rating fetched', data });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export {
  getDashboardLeagues,
  getDashboardSeasons,
  getDashboardTeams,
  getDashboardPlayers,
  getDashboardPlayerRating,
};
