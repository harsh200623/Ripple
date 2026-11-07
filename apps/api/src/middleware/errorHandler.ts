import type { NextFunction, Request, Response } from 'express';
import { AppError, ERROR_CODES, SAFE_MESSAGES } from '@ripple/shared';
import type { ErrorEnvelope } from '@ripple/shared';
import { logger } from '../lib/logger';

/** Maps any thrown value to the documented error envelope. Never leaks internals. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    const body: ErrorEnvelope = {
      success: false,
      error: { code: err.code, message: err.message },
    };
    res.status(err.httpStatus).json(body);
    return;
  }

  // Malformed JSON bodies surface as SyntaxError from body-parser; treat as a client error.
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.INVALID_REQUEST, message: SAFE_MESSAGES.INVALID_REQUEST },
    } satisfies ErrorEnvelope);
    return;
  }

  logger.error(
    { err: err instanceof Error ? { name: err.name, message: err.message } : String(err), path: req.path, method: req.method },
    'unhandled request error',
  );
  res.status(500).json({
    success: false,
    error: { code: ERROR_CODES.INTERNAL_ERROR, message: SAFE_MESSAGES.INTERNAL_ERROR },
  } satisfies ErrorEnvelope);
}
