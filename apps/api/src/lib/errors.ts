import { AppError, ERROR_CODES, SAFE_MESSAGES, type ErrorCode } from '@ripple/shared';

export { AppError, ERROR_CODES, SAFE_MESSAGES };
export type { ErrorCode };

/** Builds a safe AppError from a code using the shared message catalog. */
export function appError(code: ErrorCode, httpStatus: number, options?: { cause?: unknown }): AppError {
  return new AppError(code, SAFE_MESSAGES[code], httpStatus, options);
}
