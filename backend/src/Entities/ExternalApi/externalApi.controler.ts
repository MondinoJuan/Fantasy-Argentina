import { Request, Response } from 'express';
import {
  buildFixtureFromEventRefsService,
  collectFixtureEventRefsFromTeamsService,
  getCompetitionTeamsBySportAndCompetitionService,
  getLatestMatchdayResultsWithPlayerRatingsService,
  getSportsApiProAllowedLeaguesService,
  getSportsApiProPlayerByIdService,
  getSportsApiProPlayersByTeamService,
  getSportsApiProTeamDetailByTeamService,
  getSportsApiProTeamsByLeagueService,
} from './services/index.js';

function parseRequiredNumber(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getSportsApiProPlayerById(req: Request, res: Response) {
  const playerId = parseRequiredNumber(req.query.playerId as string | undefined);

  if (!playerId) {
    return res.status(400).json({ message: 'playerId query param is required number' });
  }

  try {
    const data = await getSportsApiProPlayerByIdService(playerId);
    return res.status(200).json({ message: 'sportsapipro player fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getSportsApiProPlayersByTeam(req: Request, res: Response) {
  const teamId = parseRequiredNumber(req.query.teamId as string | undefined);

  if (!teamId) {
    return res.status(400).json({ message: 'teamId query param is required number' });
  }

  try {
    const data = await getSportsApiProPlayersByTeamService(teamId);
    return res.status(200).json({ message: 'sportsapipro team players fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getSportsApiProAllowedLeagues(req: Request, res: Response) {
  try {
    const data = await getSportsApiProAllowedLeaguesService();
    return res.status(200).json({ message: 'sportsapipro allowed leagues fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getSportsApiProTeamsByLeague(req: Request, res: Response) {
  const leagueId = parseRequiredNumber(req.query.leagueId as string | undefined);

  if (!leagueId) {
    return res.status(400).json({ message: 'leagueId query param is required number' });
  }

  try {
    const data = await getSportsApiProTeamsByLeagueService(leagueId);
    return res.status(200).json({ message: 'sportsapipro league teams fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getSportsApiProTeamDetailByTeam(req: Request, res: Response) {
  const teamId = parseRequiredNumber(req.query.teamId as string | undefined);

  if (!teamId) {
    return res.status(400).json({ message: 'teamId query param is required number' });
  }

  try {
    const data = await getSportsApiProTeamDetailByTeamService(teamId);
    return res.status(200).json({ message: 'sportsapipro team detail fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getSportsApiProCompetitionTeams(req: Request, res: Response) {
  const sportId = parseRequiredNumber(req.query.sportId as string | undefined);
  const competitionId = parseRequiredNumber(req.query.competitionId as string | undefined);

  if (!sportId || !competitionId) {
    return res.status(400).json({ message: 'sportId and competitionId query params are required numbers' });
  }

  try {
    const data = await getCompetitionTeamsBySportAndCompetitionService(sportId, competitionId);
    return res.status(200).json({ message: 'sportsapipro competition teams fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function getSportsApiProLatestMatchdayRatings(req: Request, res: Response) {
  const sportId = parseRequiredNumber(req.query.sportId as string | undefined);
  const competitionId = parseRequiredNumber(req.query.competitionId as string | undefined);

  if (!sportId || !competitionId) {
    return res.status(400).json({ message: 'sportId and competitionId query params are required numbers' });
  }

  try {
    const data = await getLatestMatchdayResultsWithPlayerRatingsService(sportId, competitionId);
    return res.status(200).json({ message: 'sportsapipro latest matchday ratings fetched', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function postSportsApiProFixtureEventRefs(req: Request, res: Response) {
  const config = req.body?.config;
  const options = req.body?.options;

  if (!config || typeof config !== 'object') {
    return res.status(400).json({ message: 'config body object is required' });
  }

  try {
    const data = await collectFixtureEventRefsFromTeamsService(config, options);
    return res.status(200).json({ message: 'sportsapipro fixture event refs collected', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

async function postSportsApiProFixtureBuild(req: Request, res: Response) {
  const eventRefs = req.body?.eventRefs;
  const options = req.body?.options;

  if (!Array.isArray(eventRefs)) {
    return res.status(400).json({ message: 'eventRefs body array is required' });
  }

  try {
    const data = await buildFixtureFromEventRefsService(eventRefs, options);
    return res.status(200).json({ message: 'sportsapipro fixture built', data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export {
  getSportsApiProPlayerById,
  getSportsApiProPlayersByTeam,
  getSportsApiProAllowedLeagues,
  getSportsApiProTeamsByLeague,
  getSportsApiProTeamDetailByTeam,
  getSportsApiProCompetitionTeams,
  getSportsApiProLatestMatchdayRatings,
  postSportsApiProFixtureEventRefs,
  postSportsApiProFixtureBuild,
};
