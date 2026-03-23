import { Router } from "express";
import { sanitizeUserInput, findAll, findOne, add, update, remove } from "./user.controler.js";
import { requireAuth, requireRole } from "../../shared/http/auth.middleware.js";

export const UserRouter = Router();

UserRouter.get('/', requireAuth, requireRole(['SUPERADMIN']), findAll);
UserRouter.get('/:id', requireAuth, findOne);
UserRouter.post('/', sanitizeUserInput, add);
UserRouter.put('/:id', requireAuth, sanitizeUserInput, update);
UserRouter.patch('/:id', requireAuth, sanitizeUserInput, update);
UserRouter.delete('/:id', requireAuth, requireRole(['SUPERADMIN']), remove);
