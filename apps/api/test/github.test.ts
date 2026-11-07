import { describe, expect, it } from 'vitest';
import { mapGitHubError } from '../src/services/github';
import { AppError, ERROR_CODES } from '@ripple/shared';

function expectAppError(fn: () => never, code: string, status: number): void {
  try {
    fn();
    throw new Error('expected a throw');
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    expect((error as AppError).httpStatus).toBe(status);
  }
}

describe('mapGitHubError', () => {
  it('maps 404 to PULL_REQUEST_NOT_FOUND', () => {
    expectAppError(() => mapGitHubError({ status: 404 }), ERROR_CODES.PULL_REQUEST_NOT_FOUND, 404);
  });

  it('maps 403 and 429 to RATE_LIMITED', () => {
    expectAppError(() => mapGitHubError({ status: 403 }), ERROR_CODES.RATE_LIMITED, 429);
    expectAppError(() => mapGitHubError({ status: 429 }), ERROR_CODES.RATE_LIMITED, 429);
  });

  it('maps 5xx and unknown failures to UPSTREAM_UNAVAILABLE', () => {
    expectAppError(() => mapGitHubError({ status: 503 }), ERROR_CODES.UPSTREAM_UNAVAILABLE, 502);
    expectAppError(() => mapGitHubError(new Error('socket hang up')), ERROR_CODES.UPSTREAM_UNAVAILABLE, 502);
  });

  it('never exposes the upstream message to users', () => {
    try {
      mapGitHubError({ status: 500, message: 'token ghp_secret leaked' });
    } catch (error) {
      expect((error as AppError).message).not.toContain('ghp_secret');
    }
  });
});
