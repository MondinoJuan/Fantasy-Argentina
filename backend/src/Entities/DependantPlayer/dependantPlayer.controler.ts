import { Request, Response } from 'express';
import { orm } from '../../shared/db/orm.js';
import { DependantPlayer } from './dependantPlayer.entity.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(DependantPlayer, {}, { populate: ['tournament', 'realPlayer', 'realPlayer.realTeam'] });
    res.status(200).json({ message: 'found all dependant players', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(DependantPlayer, { id }, { populate: ['tournament', 'realPlayer', 'realPlayer.realTeam'] });
    res.status(200).json({ message: 'found dependant player', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { findAll, findOne };
