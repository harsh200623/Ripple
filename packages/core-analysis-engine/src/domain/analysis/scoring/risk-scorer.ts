import {
  AnalysisFileResult,
  ChangedFileObject,
  RiskLevel,
  RiskScoreBreakdown,
} from '../types.js';
import { TraversalResult } from '../blast-radius/traversal.js';
import { DependencyGraph } from '../graph/dependency-graph.js';

export const HIGH_CRITICALITY_PATTERNS = [
  /(?:^|\/)(?:auth|security|login|token|session|permission|credential|crypto|payment|billing|checkout)(?:[._\/-]|\.|$)/i,
  /(?:^|\/)api\/v\d+\//i,
];

export const MEDIUM_CRITICALITY_PATTERNS = [
  /(?:^|\/)(?:config|schema|database|db|migration|models|types)(?:[._\/-]|\.|$)/i,
];

export interface ScoreCalculationInput {
  traversal: TraversalResult;
  graph: DependencyGraph;
  changedFileMetadata: Map<string, ChangedFileObject>;
}

export interface ScoreCalculationResult {
  riskScore: number;
  riskLevel: RiskLevel;
  breakdown: RiskScoreBreakdown;
  reasons: string[];
  fileScores: Map<string, number>;
}

export function calculateRiskScore(input: ScoreCalculationInput): ScoreCalculationResult {
  const { traversal, graph, changedFileMetadata } = input;

  const directCount = traversal.directAffected.length;
  const indirectCount = traversal.indirectAffected.length;
  const totalAffected = directCount + indirectCount;
  const maxDepth = traversal.maxImpactDepth;

  const reasons: string[] = [];

  // Match the documented baseline scoring model.
  const rawBlastRadius = directCount * 5 + indirectCount * 2;
  const blastRadiusPoints = Math.min(40, rawBlastRadius);

  if (totalAffected >= 10) {
    reasons.push(`High dependency blast radius: ${totalAffected} files affected (${directCount} direct, ${indirectCount} indirect)`);
  } else if (totalAffected > 0) {
    reasons.push(`${totalAffected} downstream file(s) affected by this change`);
  } else {
    reasons.push('Isolated change: no downstream dependent files identified');
  }

  if (directCount >= 3) {
    reasons.push('Multiple downstream dependencies directly import modified code');
  }

  // 5 points per impact level, capped at 20.
  const depthPoints = Math.min(20, maxDepth * 5);
  if (maxDepth >= 3) {
    reasons.push(`Deep dependency propagation: impact extends ${maxDepth} levels into the codebase`);
  } else if (maxDepth >= 1) {
    reasons.push(`Dependency impact depth: ${maxDepth} level(s)`);
  }

  // Criticality is based on changed paths, not their dependents.
  let criticalityPoints = 0;

  const checkCriticality = (filePath: string): number => {
    for (const pat of HIGH_CRITICALITY_PATTERNS) {
      if (pat.test(filePath)) return 20;
    }
    for (const pat of MEDIUM_CRITICALITY_PATTERNS) {
      if (pat.test(filePath)) return 10;
    }
    return 0;
  };

  for (const file of traversal.changedFiles) {
    criticalityPoints = Math.max(criticalityPoints, checkCriticality(file));
  }

  if (criticalityPoints === 20) {
    reasons.push('Changed files include authentication, security, or other high-criticality paths');
  } else if (criticalityPoints === 10) {
    reasons.push('Changed files include configuration, schema, database, or shared-type paths');
  }

  // 5 points per 50 changed lines, capped at 20.
  let totalLinesChanged = 0;

  for (const meta of changedFileMetadata.values()) {
    totalLinesChanged += (meta.additions ?? 0) + (meta.deletions ?? 0);
  }

  const changeSizePoints = Math.min(20, 5 * Math.ceil(totalLinesChanged / 50));
  if (totalLinesChanged > 0) {
    reasons.push(`Change-size factor: ${totalLinesChanged} lines changed`);
  }

  const total = Math.min(100, blastRadiusPoints + depthPoints + changeSizePoints + criticalityPoints);

  const riskScore = Math.round(total);

  // Map to RiskLevel
  let riskLevel: RiskLevel = 'LOW';
  if (riskScore >= 75) {
    riskLevel = 'CRITICAL';
  } else if (riskScore >= 50) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 25) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  const fileScores = new Map<string, number>();

  for (const changedFile of traversal.changedFiles) {
    const dependentsCount = graph.getDirectDependents(changedFile).length;
    const baseChangedScore = Math.min(98, 70 + dependentsCount * 5 + (checkCriticality(changedFile) > 0 ? 15 : 0));
    fileScores.set(changedFile, baseChangedScore);
  }

  for (const direct of traversal.directAffected) {
    const downstream = graph.getDirectDependents(direct).length;
    const directScore = Math.min(90, 50 + downstream * 5 + (checkCriticality(direct) > 0 ? 10 : 0));
    fileScores.set(direct, directScore);
  }

  for (const indirect of traversal.indirectAffected) {
    const depth = traversal.impactDepth.get(indirect) || 2;
    const indirectScore = Math.max(20, Math.min(65, 45 - depth * 5));
    fileScores.set(indirect, indirectScore);
  }

  for (const unaffected of traversal.unaffected) {
    fileScores.set(unaffected, 0);
  }

  const breakdown: RiskScoreBreakdown = {
    blastRadiusPoints,
    depthPoints,
    criticalityPoints,
    changeSizePoints,
    total: riskScore,
  };

  return {
    riskScore,
    riskLevel,
    breakdown,
    reasons,
    fileScores,
  };
}

/**
 * Builds structured file list for Person 3 dashboard.
 */
export function buildAnalysisFiles(
  traversal: TraversalResult,
  fileScores: Map<string, number>,
  changedFileMetadata: Map<string, ChangedFileObject>
): AnalysisFileResult[] {
  const results: AnalysisFileResult[] = [];

  // Changed files
  for (const changed of traversal.changedFiles) {
    const meta = changedFileMetadata.get(changed);
    results.push({
      path: changed,
      type: 'changed',
      status: 'changed',
      riskScore: fileScores.get(changed) ?? 75,
      impactDepth: 0,
      reasons: traversal.reasons.get(changed) || ['Directly modified in PR'],
      prStatus: meta?.status || 'modified',
    });
  }

  // Direct affected files
  for (const direct of traversal.directAffected) {
    results.push({
      path: direct,
      type: 'affected',
      status: 'direct_affected',
      riskScore: fileScores.get(direct) ?? 60,
      impactDepth: traversal.impactDepth.get(direct) ?? 1,
      reasons: traversal.reasons.get(direct) || ['Directly affected'],
    });
  }

  // Indirect affected files
  for (const indirect of traversal.indirectAffected) {
    results.push({
      path: indirect,
      type: 'affected',
      status: 'indirect_affected',
      riskScore: fileScores.get(indirect) ?? 35,
      impactDepth: traversal.impactDepth.get(indirect) ?? 2,
      reasons: traversal.reasons.get(indirect) || ['Transitively affected'],
    });
  }

  // Unaffected files
  for (const unaffected of traversal.unaffected) {
    results.push({
      path: unaffected,
      type: 'unaffected',
      status: 'unaffected',
      riskScore: 0,
      impactDepth: -1,
      reasons: ['No dependency path to changed files'],
    });
  }

  return results;
}
