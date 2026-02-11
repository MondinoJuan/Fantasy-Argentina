import { Request, Response, NextFunction } from 'express';
import { UserRepository } from './user.repository.js';
import { User } from './user.entity.js';

const repository = new UserRepository();

function sanitizeUserInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeUserInput = {
        username: req.body.username,
        password: req.body.password,
        mail: req.body.mail,
        registrationDate: req.body.registrationDate
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

function findAll(req:Request, res:Response) {
    return res.json({data: repository.findAll()});
}

function findOne(req:Request<{id: string}>, res:Response) {
    const id = req.params.id;
    const user = repository.findOne({id});
    if (!user) {
        return res.status(404).send({ error: 'User not found' });
    }
    return res.json({data: user});
}

function add (req:Request, res:Response) {
    const input = req.body.sanitizeUserInput;
    const newUser = new User(
        input.username, 
        input.password, 
        input.mail,
        input.registrationDate
    );
    const user = repository.add(newUser);
    return res.status(201).send({message: 'User created', data: user});
}

function update(req:Request, res:Response) {
    req.body.sanitizeUserInput.id = req.params.id;
    const user = repository.update(req.body.sanitizeUserInput);
    if (!user) {
        return res.status(404).send({ error: 'User not found' });
    } else {
        return res.status(200).json({message: 'User updated', data: user});
    }
}

function remove(req:Request<{id: string}>, res:Response) {
    const id = req.params.id;
    const user = repository.delete({id});
    if (!user) {
        return res.status(404).send({ error: 'User not found' });
    } else {
        return res.status(200).send({message: 'User deleted successfully'});
    }
}


export { sanitizeUserInput, findAll, findOne, add, update, remove };