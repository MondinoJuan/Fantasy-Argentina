import { Request, Response, NextFunction } from 'express';
import { UserRepository } from './user.repository.js';
import { User } from './user.entity.js';

const repository = new UserRepository();

function sanitizeUserInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeUserInput = {
        username: req.body.username,
        password: req.body.password,
        mail: req.body.mail,
    };
    // more checks
    // ----------------------------------------------------------------------------------------------------------------------------------------
    
    // ----------------------------------------------------------------------------------------------------------------------------------------    

    Object.keys(req.body.sanitizeUserInput).forEach(key => {
        if (req.body.sanitizeUserInput[key] === undefined) {
            delete req.body.sanitizeUserInput[key];
        }
    });
    next();
}

async function findAll(req: Request, res: Response) {
  const users = await repository.findAll()
  return res.json({ data: users ?? [] })
}

async function findOne(req: Request<{ id: string }>, res: Response) {
  const user = await repository.findOne({ id: req.params.id })
  if (!user) return res.status(404).send({ error: 'User not found' })
  return res.json({ data: user })
}

async function add(req: Request, res: Response) {
  const input = req.body.sanitizeUserInput

  const newUser = new User(
    input.username,
    input.password,
    input.mail,
    input.registrationDate
  )

  const created = await repository.add(newUser)
  return res.status(201).send({ message: 'User created', data: created })
}

async function update(req: Request<{ id: string }>, res: Response) {
  const updated = await repository.update(req.params.id, req.body.sanitizeUserInput)
  if (!updated) return res.status(404).send({ error: 'User not found' })
  return res.status(200).json({ message: 'User updated', data: updated })
}

async function remove(req: Request<{ id: string }>, res: Response) {
  const deleted = await repository.delete({ id: req.params.id })
  if (!deleted) return res.status(404).send({ error: 'User not found' })
  return res.status(200).send({ message: 'User deleted successfully', data: deleted })
}


export { sanitizeUserInput, findAll, findOne, add, update, remove };