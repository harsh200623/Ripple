import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { analysisIdParamSchema, createAnalysisRequestSchema, ERROR_CODES, type CreateAnalysisRequest } from '@ripple/shared';
import type { Db } from './db/client';
import { analysisResults } from './db/schema';
import { appError } from './lib/errors';
import { validate } from './middleware/validate';
import { getAnalysisRecord, getAnalysisResult, type AnalysisService } from './services/analysis';

export interface RouteDeps {
  db: Db;
  analysis: AnalysisService;
  createRateLimiter: () => import('express').RequestHandler;
}

export function createRouter(deps: RouteDeps): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ success: true, data: { status: 'ok' } });
  });

  router.post(
    '/analyses',
    deps.createRateLimiter(),
    validate(createAnalysisRequestSchema, 'body'),
    async (req: Request, res: Response) => {
      const body = req.body as CreateAnalysisRequest;
      const result = await deps.analysis.createAnalysis({ pullRequestUrl: body.pullRequestUrl });
      res.status(202).json({
        success: true,
        data: { analysisId: result.analysisId, status: result.status },
      });
    },
  );

  router.get(
    '/analyses/:analysisId',
    validate(analysisIdParamSchema, 'params'),
    async (req: Request, res: Response) => {
      const { analysisId } = req.params as { analysisId: string };
      const record = await getAnalysisRecord(deps.db, analysisId);
      if (!record) throw appError(ERROR_CODES.ANALYSIS_NOT_FOUND, 404);

      const result = record.status === 'completed' ? await getAnalysisResult(deps.db, analysisId) : null;
      const warnings = result ? (result.warnings as Array<{ message: string }>).map((w) => w.message) : [];
      const changedCount = result ? (result.changedFiles as unknown[]).length : 0;
      const affected = result ? (result.affectedFiles as Array<{ status: string }>) : [];

      res.json({
        success: true,
        data: {
          analysisId: record.id,
          status: record.status,
          repository: record.repository,
          pullRequest: {
            number: record.prNumber,
            title: record.prTitle,
            url: record.prUrl,
            baseSha: record.baseSha,
            headSha: record.headSha,
          },
          summary: result
            ? {
                riskScore: record.riskScore,
                riskLevel: record.riskLevel,
                changedFileCount: changedCount,
                directAffectedCount: affected.filter((f) => f.status === 'direct_affected').length,
                indirectAffectedCount: affected.filter((f) => f.status === 'indirect_affected').length,
                warnings,
              }
            : null,
          error: record.status === 'failed' && record.errorCode
            ? { code: record.errorCode, message: record.errorMessage ?? '' }
            : null,
        },
      });
    },
  );

  router.get(
    '/analyses/:analysisId/graph',
    validate(analysisIdParamSchema, 'params'),
    async (req: Request, res: Response) => {
      const { analysisId } = req.params as { analysisId: string };
      const record = await getAnalysisRecord(deps.db, analysisId);
      if (!record) throw appError(ERROR_CODES.ANALYSIS_NOT_FOUND, 404);
      const result = await deps.db
        .select({ graphData: analysisResults.graphData })
        .from(analysisResults)
        .where(eq(analysisResults.analysisId, analysisId))
        .limit(1);
      if (record.status !== 'completed' || !result[0]) {
        throw appError(ERROR_CODES.ANALYSIS_NOT_FOUND, 404);
      }
      res.json({ success: true, data: result[0].graphData });
    },
  );

  router.get(
    '/analyses/:analysisId/affected-files',
    validate(analysisIdParamSchema, 'params'),
    async (req: Request, res: Response) => {
      const { analysisId } = req.params as { analysisId: string };
      const record = await getAnalysisRecord(deps.db, analysisId);
      if (!record) throw appError(ERROR_CODES.ANALYSIS_NOT_FOUND, 404);
      const result = await deps.db
        .select({ affectedFiles: analysisResults.affectedFiles })
        .from(analysisResults)
        .where(eq(analysisResults.analysisId, analysisId))
        .limit(1);
      if (record.status !== 'completed' || !result[0]) {
        throw appError(ERROR_CODES.ANALYSIS_NOT_FOUND, 404);
      }
      res.json({ success: true, data: result[0].affectedFiles });
    },
  );

  return router;
}
