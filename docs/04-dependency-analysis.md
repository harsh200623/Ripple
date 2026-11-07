# 4. Dependency analysis

## Purpose

This document defines how Ripple interprets code relationships, maps change impact, and explains the output to users. The analysis model must be explicit, consistent, and safe to review.

## Definition of dependency

For Ripple, a dependency is primarily a static relationship between local source files. If file A imports or references file B, then A is considered dependent on B.

Example:

```ts
import { getUser } from "../services/user.service";
```

This implies that the importing file depends on the target file.

The platform does not treat installed package versions as the primary dependency model. Package metadata may be relevant to other product features later, but this system is focused on repository-local code relationships.

## Inputs

The analysis engine operates on the following inputs:

- repository snapshot at the PR head SHA,
- GitHub PR metadata and changed-file list,
- supported TypeScript/JavaScript source files,
- optional TypeScript config metadata for path resolution,
- and warnings or limitations discovered during parsing.

## Outputs

The analysis returns:

- a normalized dependency graph,
- changed file classifications,
- direct and indirect affected files,
- impact depth per file,
- risk score and factor breakdown,
- warnings for incomplete or uncertain results.

## Supported files and exclusions

### Supported file types

- `.ts`
- `.tsx`
- `.js`
- `.jsx`

### Exclusions

The system should skip or ignore generated or vendor directories such as:

- `node_modules/`
- `dist/`, `build/`, `coverage/`
- `.git/`
- `.next/`
- generated bundles and vendored code

### Rules for unresolved or unsupported files

Unsupported files and failed parse attempts must be reported as warnings, not silently dropped. The system should also apply safe limits for file count, repository size, and processing time to prevent resource exhaustion.

## Import extraction and resolution

The analysis engine should parse supported source files and extract static module references that can be resolved to local repository files.

### Resolve these cases

- relative imports
- index-file resolution where supported by TypeScript semantics
- standard extension-based resolution
- supported `tsconfig.json` path aliases when safely loadable

### Ignore these cases

- external npm package imports
- runtime-generated module paths that cannot be reliably resolved
- dynamic imports without static path resolution

If a local-looking import cannot be resolved, the system must log it as a warning and must not guess or invent a graph edge.

## Graph model

Ripple uses a directed file-level graph.

- Node: one normalized source file path
- Edge: importer -> imported file
- Direction: source file imports target file

Example:

```text
src/routes/user.routes.ts -> src/controllers/user.controller.ts
src/controllers/user.controller.ts -> src/services/user.service.ts
src/services/user.service.ts -> src/data/user.repository.ts
```

A minimal node shape:

```ts
interface DependencyNode {
  id: string;
  filePath: string;
  language: "typescript" | "javascript";
  status?: "changed" | "direct_affected" | "indirect_affected" | "unaffected";
}
```

A minimal edge shape:

```ts
interface DependencyEdge {
  source: string;
  target: string;
  importPath: string;
}
```

If the same importer-target pair is encountered multiple times, the graph may consolidate it to a single edge. Package dependencies should never become repository nodes unless a separate feature explicitly requires it.

## Blast-radius traversal

Because edges point from importer to dependency, impacted dependents are found by traversing incoming edges from a changed file.

Example:

```text
src/routes/user.routes.ts
        |
        v
src/controllers/user.controller.ts
        |
        v
src/services/user.service.ts
        |
        v
src/data/user.repository.ts  <-- changed
```

If `src/data/user.repository.ts` is changed, the reverse traversal should reveal:

- direct affected: `src/services/user.service.ts`
- indirect affected: `src/controllers/user.controller.ts`
- indirect affected: `src/routes/user.routes.ts`

Traversal rules:

- use breadth-first or depth-first traversal,
- maintain a visited set,
- prevent infinite loops from cycles,
- record the minimum traversal distance from a changed file,
- and classify files using depth and relationship semantics.

### Classification

- `changed`: file reported by GitHub in the PR
- `direct_affected`: one reverse-dependency hop from a changed file
- `indirect_affected`: two or more reverse-dependency hops from a changed file
- `unaffected`: in the graph but not reachable from the changed set

If a file is deleted or renamed and cannot be matched to a current graph node, it must be retained as a changed-file record with a warning indicating its impact is incomplete.

## Risk scoring model

The risk score is a heuristic impact estimate. It is useful for prioritization and review support, but it is not proof of a bug or production failure.

A transparent baseline score can be derived from the following factors:

```text
blastRadiusPoints = min(40, (5 * directAffectedCount) + (2 * indirectAffectedCount))
depthPoints       = min(20, 5 * maxImpactDepth)
changeSizePoints  = min(20, 5 * ceil(totalAdditionsAndDeletions / 50))
criticalityPoints = 0, 10, or 20

riskScore = min(100,
  blastRadiusPoints + depthPoints + changeSizePoints + criticalityPoints
)
```

### Criticality heuristic

Criticality is a simple path-based heuristic and is not semantic code understanding:

- 0: no sensitive-path match
- 10: medium-risk area (for example config or schema-related paths)
- 20: high-risk area (for example auth, security, permissions, or critical API paths)

The score should be accompanied by its underlying factor values so users can understand why a result is high or low.

### Risk labels

| Score | Label |
|---:|---|
| 0-24 | Low |
| 25-49 | Medium |
| 50-74 | High |
| 75-100 | Critical |

If the analysis is partial, incomplete, or based on a limited graph, the UI must clearly indicate that the score is not fully trustworthy.

## Snapshot and PR semantics

The graph should be generated from the exact PR head snapshot and the GitHub changed-file metadata. This keeps the relationship explicit and explainable.

- Added and modified files are usually matchable to graph nodes.
- Renamed files should preserve both the old and new paths when available.
- Deleted files may not exist in the head snapshot; they must be preserved as weak or incomplete analysis cases.
- Changes to import statements should reflect the current source graph, not claim full before/after semantics.

This is impact analysis, not a complete semantic differencing engine.

## Minimum validation checks

A project test suite should include at least the following correctness checks:

1. relative imports create edges in the correct direction,
2. a changed dependency identifies its direct importer,
3. reverse traversal finds transitive dependents,
4. unrelated files remain unaffected,
5. cyclic dependencies terminate safely,
6. external package imports do not become project nodes,
7. unresolved local imports generate a warning,
8. deleted files remain visible with incomplete-analysis metadata,
9. the risk score stays stable and within the valid range.

## Warning model

Warnings are essential to honest reporting. They should include:

- unresolved imports,
- unsupported file types,
- parser failures,
- missing or partial GitHub metadata,
- deleted or renamed file limitations,
- large-repository mode limits,
- or any partial graph or partial analysis state.

Warnings must be visible to users and must not be hidden as internal-only logs.
