import { Router } from 'express';
import { listStats } from '../controllers/statsController.mjs';

export const statsRouter = Router();

statsRouter.get('/', listStats);
