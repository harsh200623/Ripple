import { z } from 'zod';
import {
  analysisStatusSchema,
  changedFileStatusSchema,
  createAnalysisRequestSchema,
  riskLevelSchema,
} from './schemas';

export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type ChangedFileStatus = z.infer<typeof changedFileStatusSchema>;
export type CreateAnalysisRequest = z.infer<typeof createAnalysisRequestSchema>;

/** Success envelope used by every endpoint. */
export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

/** Error envelope. `code` is stable and machine-readable. */
export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface CreateAnalysisResponseData {
  analysisId: string;
  status: AnalysisStatus;
}

export interface PullRequestSummary {
  number: number;
  title: string;
  url: string;
  baseSha: string;
  headSha: string;
}

export interface AnalysisSummary {
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  changedFileCount: number;
  directAffectedCount: number;
  indirectAffectedCount: number;
  warnings: string[];
}

export interface AnalysisStatusResponseData {
  analysisId: string;
  status: AnalysisStatus;
  repository: string | null;
  pullRequest: PullRequestSummary | null;
  summary: AnalysisSummary | null;
  error: { code: string; message: string } | null;
}

export interface ChangedFile {
  filePath: string;
  prStatus: ChangedFileStatus;
}

export interface ChangedFileMetadata {
  filePath: string;
  status: ChangedFileStatus;
  additions: number;
  deletions: number;
}
