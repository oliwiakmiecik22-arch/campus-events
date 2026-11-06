import express from 'express';
import { errorHandler } from './middleware/errorHandler.mjs';
import { notFound } from './middleware/notFound.mjs';
import { requestLogger } from './middleware/requestLogger.mjs';
import { eventRouter } from './routes/eventRoutes.mjs';
import { healthRouter } from './routes/healthRoutes.mjs';
import { statsRouter } from './routes/statsRoutes.mjs';

export const app = express();

app.use(express.json());
app.use(requestLogger);

app.use('/api/health', healthRouter);
app.use('/api/events', eventRouter);
app.use('/api/stats', statsRouter);

app.use(notFound);
app.use(errorHandler);
