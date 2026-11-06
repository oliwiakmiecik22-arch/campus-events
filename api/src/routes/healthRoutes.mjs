import { Router } from 'express';
import { getHealth } from '../controllers/healthController.mjs';

export const healthRouter = Router();

healthRouter.get('/', getHealth);
