import { NextFunction, Request, Response } from 'express';
import { orm } from '../../shared/db/orm.js';
import { RealTeamLeagueParticipation } from './realTeamLeagueParticipation.entity.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeRealTeamLeagueParticipationInput(req: Request, _res: Response, next: NextFunction) {
  req.body.sanitizeRealTeamLeagueParticipationInput = {
    realTeam: req.body.realTeam ?? req.body.realTeamId,
    league: req.body.league ?? req.body.leagueId,
  };

  Object.keys(req.body.sanitizeRealTeamLeagueParticipationInput).forEach((key) => {
    if (req.body.sanitizeRealTeamLeagueParticipationInput[key] === undefined) {
      delete req.body.sanitizeRealTeamLeagueParticipationInput[key];
    }
  });

  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const leagueId = parseId(req.query.leagueId as string | undefined);
    const realTeamId = parseId(req.query.realTeamId as string | undefined);
    const where: any = {};

    if (Number.isFinite(leagueId)) {
      where.league = { id: leagueId };
    }

    if (Number.isFinite(realTeamId)) {
      where.realTeam = { id: realTeamId };
    }

    const items = await em.find(RealTeamLeagueParticipation, where, { populate: ['league', 'realTeam'] });
    res.status(200).json({ message: 'found all real team league participations', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(RealTeamLeagueParticipation, { id }, { populate: ['league', 'realTeam'] });
    res.status(200).json({ message: 'found real team league participation', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(RealTeamLeagueParticipation, req.body.sanitizeRealTeamLeagueParticipationInput);
    await em.flush();
    res.status(201).json({ message: 'real team league participation created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(RealTeamLeagueParticipation, id);
    em.assign(itemToUpdate, req.body.sanitizeRealTeamLeagueParticipationInput);
    await em.flush();
    res.status(200).json({ message: 'real team league participation updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(RealTeamLeagueParticipation, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'real team league participation deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeRealTeamLeagueParticipationInput, findAll, findOne, add, update, remove };
