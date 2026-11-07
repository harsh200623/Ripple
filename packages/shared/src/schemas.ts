import { z } from 'zod';
import { parsePrUrl } from './parsePrUrl';

export const createAnalysisRequestSchema = z
  .object({
    pullRequestUrl: z
      .string()
      .min(1)
      .max(2048)
      .refine((value) => parsePrUrl(value) !== null, {
        message: 'Provide a valid GitHub pull request URL.',
      }),
  })
  .strict();

export const analysisIdParamSchema = z
  .object({
    analysisId: z.string().regex(/^analysis_[A-Za-z0-9_-]{8,64}$/),
  })
  .strict();

export const analysisStatusSchema = z.enum(['queued', 'running', 'completed', 'failed']);

export const riskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const changedFileStatusSchema = z.enum(['added', 'modified', 'removed', 'renamed', 'copied', 'changed', 'unchanged']);
