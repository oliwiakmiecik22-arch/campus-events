import express from 'express';
import { env } from './config/env.mjs';
import { frontendDistDirectory } from './config/paths.mjs';
import { errorHandler } from './middleware/errorHandler.mjs';
import { notFound } from './middleware/notFound.mjs';
import { requestLogger } from './middleware/requestLogger.mjs';
import { createSpaFallback } from './middleware/spaFallback.mjs';
import { eventRouter } from './routes/eventRoutes.mjs';
import { healthRouter } from './routes/healthRoutes.mjs';
import { statsRouter } from './routes/statsRoutes.mjs';

export function createApp({
  serveFrontend = env.nodeEnv === 'production',
  frontendDirectory = frontendDistDirectory
} = {}) {
  const app = express();

  app.use(express.json());
  app.use(requestLogger);

  app.use('/api/health', healthRouter);
  app.use('/api/events', eventRouter);
  app.use('/api/stats', statsRouter);

  // API misses must stay JSON and must never fall through to the Vue application.
  app.use('/api', notFound);

  if (serveFrontend) {
    app.use(express.static(frontendDirectory));
    app.use(createSpaFallback(frontendDirectory));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
