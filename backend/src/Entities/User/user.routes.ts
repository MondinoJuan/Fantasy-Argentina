import { Router } from "express";
import { sanitizeUserInput, findAll, findOne, add, update, remove } from "./user.controler.js";

export const UserRouter = Router();

UserRouter.get('/', findAll);
UserRouter.get('/:id', findOne);
UserRouter.post('/', sanitizeUserInput, add);
UserRouter.put('/:id', sanitizeUserInput, update);
UserRouter.patch('/:id', sanitizeUserInput, update);
UserRouter.delete('/:id', remove);