import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().url(),
  GITHUB_TOKEN: z.string().default(''),
  QUEUE_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  ANALYSIS_TIMEOUT_MS: z.coerce.number().int().min(1000).max(3_600_000).default(120_000),
  MAX_CHANGED_FILES: z.coerce.number().int().min(1).max(10_000).default(300),
  MAX_ANALYSIS_FILES: z.coerce.number().int().min(1).max(100_000).default(20_000),
  MAX_REPO_SIZE_MB: z.coerce.number().int().min(1).max(10_000).default(200),
  TEMP_DIR: z.string().min(1).default('/tmp/ripple'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
  WORKER_MODE: z.enum(['inline', 'separate']).default('inline'),
});

export type AppConfig = z.infer<typeof envSchema>;

/** Parses and validates process.env once. Throws with a field-level summary (never values). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid environment configuration. Check: ${fields}`);
  }
  if (result.data.NODE_ENV === 'production' && result.data.GITHUB_TOKEN === '') {
    // Unauthenticated GitHub access is heavily rate-limited; surface it explicitly.
    throw new Error('Invalid environment configuration. GITHUB_TOKEN is required in production.');
  }
  return result.data;
}
