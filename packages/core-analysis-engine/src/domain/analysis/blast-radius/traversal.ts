import { DependencyGraph } from '../graph/dependency-graph.js';

export interface TraversalResult {
  changedFiles: string[];
  directAffected: string[];
  indirectAffected: string[];
  unaffected: string[];
  impactDepth: Map<string, number>;
  reasons: Map<string, string[]>;
  dependencyChains: Map<string, string[]>;
  maxImpactDepth: number;
}

export interface TraversalOptions {
  maxDepth?: number;
}

/**
 * Performs reverse graph traversal (BFS) from changed files to determine
 * the blast radius (direct and indirect affected dependents).
 *
 * Traversal semantics:
 * - Edges point: importer -> importedTarget
 * - Reverse dependents: incoming neighbors of target
 * - Cycle-safe via visited set
 * - Changed files are kept separate from affected files
 */
export function calculateBlastRadius(
  graph: DependencyGraph,
  changedFiles: string[],
  options?: TraversalOptions
): TraversalResult {
  const maxDepth = options?.maxDepth ?? 50;

  const changedSet = new Set(changedFiles);
  const directAffected = new Set<string>();
  const indirectAffected = new Set<string>();
  const impactDepth = new Map<string, number>();
  const reasons = new Map<string, string[]>();
  const dependencyChains = new Map<string, string[]>();

  // Queue holds: { file, depth, chain }
  interface QueueItem {
    file: string;
    depth: number;
    chain: string[];
  }

  const queue: QueueItem[] = [];
  const visited = new Set<string>();

  // Seed BFS queue with all changed files that exist in the graph
  for (const changedFile of changedFiles) {
    if (graph.hasNode(changedFile)) {
      graph.setNodeStatus(changedFile, 'changed');
      impactDepth.set(changedFile, 0);
      reasons.set(changedFile, ['Directly modified in PR']);
      dependencyChains.set(changedFile, [changedFile]);
      queue.push({ file: changedFile, depth: 0, chain: [changedFile] });
      visited.add(changedFile);
    }
  }

  let maxImpactDepth = 0;

  // BFS reverse traversal
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentFile = current.file;
    const currentDepth = current.depth;
    const currentChain = current.chain;

    if (currentDepth >= maxDepth) {
      continue;
    }

    // Get all files that import currentFile (incoming neighbors)
    const importers = graph.getDirectDependents(currentFile);

    for (const importer of importers) {
      // Changed files themselves must never be classified as affected files
      if (changedSet.has(importer)) {
        // Record relationship if a changed file imports another changed file
        const existingReasons = reasons.get(importer) || ['Directly modified in PR'];
        const reasonText = `Imports changed file ${currentFile}`;
        if (!existingReasons.includes(reasonText)) {
          existingReasons.push(reasonText);
          reasons.set(importer, existingReasons);
        }
        continue;
      }

      const nextDepth = currentDepth + 1;
      const nextChain = [...currentChain, importer];

      if (!visited.has(importer)) {
        visited.add(importer);
        impactDepth.set(importer, nextDepth);
        dependencyChains.set(importer, nextChain);

        if (nextDepth > maxImpactDepth) {
          maxImpactDepth = nextDepth;
        }

        if (nextDepth === 1) {
          directAffected.add(importer);
          graph.setNodeStatus(importer, 'direct_affected');
          reasons.set(importer, [`Directly imports ${currentFile}`]);
        } else {
          indirectAffected.add(importer);
          graph.setNodeStatus(importer, 'indirect_affected');
          reasons.set(importer, [
            `Transitively affected: imported via ${currentFile} (root change: ${currentChain[0]})`,
          ]);
        }

        queue.push({
          file: importer,
          depth: nextDepth,
          chain: nextChain,
        });
      } else {
        // Already visited: check if shorter path or additional reason should be appended
        const currentRecordedDepth = impactDepth.get(importer) ?? Infinity;
        if (nextDepth < currentRecordedDepth) {
          impactDepth.set(importer, nextDepth);
          dependencyChains.set(importer, nextChain);
          if (nextDepth === 1) {
            indirectAffected.delete(importer);
            directAffected.add(importer);
            graph.setNodeStatus(importer, 'direct_affected');
          }
        }

        const existingReasons = reasons.get(importer) || [];
        const additionalReason =
          nextDepth === 1
            ? `Directly imports ${currentFile}`
            : `Also imports ${currentFile}`;
        if (!existingReasons.includes(additionalReason)) {
          existingReasons.push(additionalReason);
          reasons.set(importer, existingReasons);
        }
      }
    }
  }

  // Identify unaffected files
  const unaffected: string[] = [];
  for (const node of graph.getAllNodes()) {
    if (
      !changedSet.has(node.filePath) &&
      !directAffected.has(node.filePath) &&
      !indirectAffected.has(node.filePath)
    ) {
      unaffected.push(node.filePath);
      graph.setNodeStatus(node.filePath, 'unaffected');
    }
  }

  return {
    changedFiles: Array.from(changedSet),
    directAffected: Array.from(directAffected),
    indirectAffected: Array.from(indirectAffected),
    unaffected,
    impactDepth,
    reasons,
    dependencyChains,
    maxImpactDepth,
  };
}
