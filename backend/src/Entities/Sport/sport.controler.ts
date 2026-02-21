import { Request, Response, NextFunction } from 'express';
import { Sport } from './sport.entity.js';
import { orm } from '../../shared/db/orm.js';

const em = orm.em;

function parseId(idParam: string | string[] | undefined) {
  const rawId = Array.isArray(idParam) ? idParam[0] : idParam;
  return Number.parseInt(rawId ?? '', 10);
}

function sanitizeSportInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizeSportInput = {
    idEnApi: req.body.idEnApi,
    descripcion: req.body.descripcion,
    cupoTitular: req.body.cupoTitular,
    cupoSuplente: req.body.cupoSuplente,
  };

  Object.keys(req.body.sanitizeSportInput).forEach((key) => {
    if (req.body.sanitizeSportInput[key] === undefined) {
      delete req.body.sanitizeSportInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const items = await em.find(Sport, {});
    res.status(200).json({ message: 'found all sports', data: items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findByIdEnApi(req: Request, res: Response) {
  try {
    const idEnApi = parseId(req.params.idEnApi);

    if (!Number.isFinite(idEnApi)) {
      res.status(400).json({ message: 'idEnApi must be a valid number' });
      return;
    }

    const item = await em.findOneOrFail(Sport, { idEnApi });
    res.status(200).json({ message: 'found sport by idEnApi', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = await em.findOneOrFail(Sport, { id });
    res.status(200).json({ message: 'found sport', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const item = em.create(Sport, req.body.sanitizeSportInput);
    await em.flush();
    res.status(201).json({ message: 'sport created', data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const itemToUpdate = await em.getReference(Sport, id);
    em.assign(itemToUpdate, req.body.sanitizeSportInput);
    await em.flush();
    res.status(200).json({ message: 'sport updated', data: itemToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const item = em.getReference(Sport, id);
    em.remove(item);
    await em.flush();
    res.status(200).json({ message: 'sport deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeSportInput, findAll, findByIdEnApi, findOne, add, update, remove };
