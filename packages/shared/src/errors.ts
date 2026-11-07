/**
 * Stable, machine-readable error codes. Clients may branch on these values,
 * so renaming or removing one is a breaking API change.
 */
export const ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_PULL_REQUEST_URL: 'INVALID_PULL_REQUEST_URL',
  ANALYSIS_NOT_FOUND: 'ANALYSIS_NOT_FOUND',
  PULL_REQUEST_NOT_FOUND: 'PULL_REQUEST_NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
  REPOSITORY_TOO_LARGE: 'REPOSITORY_TOO_LARGE',
  TOO_MANY_CHANGED_FILES: 'TOO_MANY_CHANGED_FILES',
  ANALYSIS_TIMEOUT: 'ANALYSIS_TIMEOUT',
  ANALYSIS_FAILED: 'ANALYSIS_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Safe, user-facing error. `message` must never contain secrets, stack traces, or paths. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly exposeMessage: boolean;

  constructor(code: ErrorCode, message: string, httpStatus: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.exposeMessage = true;
  }
}

export const SAFE_MESSAGES: Record<ErrorCode, string> = {
  INVALID_REQUEST: 'The request is invalid.',
  INVALID_PULL_REQUEST_URL: 'Provide a valid GitHub pull request URL.',
  ANALYSIS_NOT_FOUND: 'Analysis not found.',
  PULL_REQUEST_NOT_FOUND: 'The pull request could not be found or is not public.',
  RATE_LIMITED: 'Too many requests. Try again later.',
  UPSTREAM_UNAVAILABLE: 'GitHub is temporarily unavailable. Try again later.',
  REPOSITORY_TOO_LARGE: 'The repository exceeds the configured processing limit.',
  TOO_MANY_CHANGED_FILES: 'The pull request changes more files than the configured limit.',
  ANALYSIS_TIMEOUT: 'The analysis did not finish within the time limit.',
  ANALYSIS_FAILED: 'The analysis could not be completed.',
  INTERNAL_ERROR: 'An unexpected error occurred.',
};
