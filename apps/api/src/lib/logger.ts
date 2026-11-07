import pino from 'pino';

/**
 * Structured logger. Redacts credential-bearing fields so tokens cannot leak
 * through request headers or error objects that pass through log calls.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'token',
      'GITHUB_TOKEN',
      'DATABASE_URL',
      '*.token',
      '*.authorization',
      'req.headers.authorization',
      '*.password',
    ],
    censor: '[REDACTED]',
  },
});

export type Logger = typeof logger;
