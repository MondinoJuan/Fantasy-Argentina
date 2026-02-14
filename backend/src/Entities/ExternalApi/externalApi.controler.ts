import { Request, Response } from 'express';
import {
  fetchAllowedLeagueDetailsFromRapidApi,
  fetchPlayerByIdFromRapidApi,
  fetchPlayersByTeamIdFromRapidApi,
  fetchTeamDetailByTeamIdFromRapidApi,
  fetchTeamsByLeagueIdFromRapidApi,
} from '../../integrations/rapidapi/rapidapi.client.js';

function parseRequiredNumber(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getRapidApiPlayerById(req: Request, res: Response) {
  const playerId = parseRequiredNumber(req.query.playerId as string | undefined);

  if (!playerId) {
    return res.status(400).json({ message: 'playerId query param is required number' });
  }

  try {
    const data = await fetchPlayerByIdFromRapidApi(playerId);
    return res.status(200).json({ message: 'rapidapi player fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getRapidApiPlayersByTeam(req: Request, res: Response) {
  const teamId = parseRequiredNumber(req.query.teamId as string | undefined);

  if (!teamId) {
    return res.status(400).json({ message: 'teamId query param is required number' });
  }

  try {
    const data = await fetchPlayersByTeamIdFromRapidApi(teamId);
    return res.status(200).json({ message: 'rapidapi team players fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getRapidApiAllowedLeagues(req: Request, res: Response) {
  try {
    const data = await fetchAllowedLeagueDetailsFromRapidApi();
    return res.status(200).json({ message: 'rapidapi allowed leagues fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getRapidApiTeamsByLeague(req: Request, res: Response) {
  const leagueId = parseRequiredNumber(req.query.leagueId as string | undefined);

  if (!leagueId) {
    return res.status(400).json({ message: 'leagueId query param is required number' });
  }

  try {
    const data = await fetchTeamsByLeagueIdFromRapidApi(leagueId);
    return res.status(200).json({ message: 'rapidapi league teams fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getRapidApiTeamDetailByTeam(req: Request, res: Response) {
  const teamId = parseRequiredNumber(req.query.teamId as string | undefined);

  if (!teamId) {
    return res.status(400).json({ message: 'teamId query param is required number' });
  }

  try {
    const data = await fetchTeamDetailByTeamIdFromRapidApi(teamId);
    return res.status(200).json({ message: 'rapidapi team detail fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export {
  getRapidApiPlayerById,
  getRapidApiPlayersByTeam,
  getRapidApiAllowedLeagues,
  getRapidApiTeamsByLeague,
  getRapidApiTeamDetailByTeam,
};
