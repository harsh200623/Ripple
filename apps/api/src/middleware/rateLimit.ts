import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '@ripple/shared';
import { appError } from '../lib/errors';

interface Bucket {
  count: number;
  windowStart: number;
}

/**
 * In-memory fixed-window limiter keyed by client IP. Suitable for a single
 * instance; a multi-instance deployment needs a shared store (documented limitation).
 */
export function rateLimit(options: { windowMs: number; max: number; now?: () => number }) {
  const buckets = new Map<string, Bucket>();
  const now = options.now ?? Date.now;

  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = req.ip ?? 'unknown';
    const current = now();
    const bucket = buckets.get(key);

    if (!bucket || current - bucket.windowStart >= options.windowMs) {
      buckets.set(key, { count: 1, windowStart: current });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      next(appError(ERROR_CODES.RATE_LIMITED, 429));
      return;
    }
    next();
  };
}
