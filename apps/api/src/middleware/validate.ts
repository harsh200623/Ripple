import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ERROR_CODES } from '@ripple/shared';
import { appError } from '../lib/errors';

type Source = 'body' | 'params' | 'query';

/** Validates a request section with a shared Zod schema. Unknown keys are rejected by the schema. */
export function validate<T>(schema: ZodType<T>, source: Source) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(appError(ERROR_CODES.INVALID_REQUEST, 400));
      return;
    }
    if (source === 'body') {
      req.body = result.data;
    } else if (source === 'params') {
      req.params = result.data as Request['params'];
    }
    next();
  };
}
