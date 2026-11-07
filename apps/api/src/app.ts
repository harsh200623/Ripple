import express, { type Express } from 'express';
import { createRouter, type RouteDeps } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { rateLimit } from './middleware/rateLimit';

export interface AppOptions {
  deps: Omit<RouteDeps, 'createRateLimiter'>;
  rateLimit: { windowMs: number; max: number; now?: () => number };
}

/**
 * Builds the Express app without starting a listener, so tests can drive it with supertest.
 * Body size is capped to keep payload handling bounded.
 */
export function createApp(options: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(express.json({ limit: '16kb', strict: true }));

  const limiter = rateLimit(options.rateLimit);
  app.use('/api/v1', createRouter({ ...options.deps, createRateLimiter: () => limiter }));

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
    });
  });
  app.use(errorHandler);
  return app;
}
