---
name: dependency-analysis
description: "Build, modify, test, or debug Ripple's static dependency analysis, graph construction, reverse blast-radius traversal, risk score, classifications, or warnings."
---

# Dependency analysis

Use for the analysis engine, import resolution, dependency graph, changed/affected file classification, impact depth, risk scoring, and analysis warnings. Follow [docs/04-dependency-analysis.md](../../../docs/04-dependency-analysis.md) as the algorithm contract and [docs/02-requirements.md](../../../docs/02-requirements.md) for acceptance expectations.

## Non-negotiable boundaries

- The engine must remain independent of Express, React, and persistence.
- Inputs and outputs should be explicit and typed.
- Analyze repository source statically. Never execute repository code or install its dependencies.
- Report uncertainty and incomplete analysis as warnings; do not invent graph edges or imply certainty.
- Impact scores are heuristics, not proof of bugs or breakage.

## Graph semantics

- A node represents a normalized repository-relative source-file path.
- An edge `A -> B` means file A imports file B.
- Supported extensions are `.ts`, `.tsx`, `.js`, and `.jsx`.
- Exclude generated, vendor, build, and dependency directories described in the analysis spec.
- Resolve statically supported local imports and configured aliases where safely practical. Ignore external package imports.
- Record unresolved local-looking imports as warnings; do not guess their target.

## Blast-radius procedure

1. Read the current algorithm specification and inspect existing implementation and tests.
2. Build the graph from the exact PR head snapshot using the supported static parsing approach.
3. Normalize repository-relative paths consistently with GitHub changed-file paths.
4. Starting from each changed graph node, traverse incoming edges to find importers.
5. Use a visited set to terminate cycles and retain the minimum impact depth.
6. Classify files as `changed`, `direct_affected`, `indirect_affected`, or `unaffected`.
7. Retain changed files missing from the head graph, including deleted files, and attach an incompleteness warning.
8. Preserve reasons, warnings, and per-factor risk data needed to explain the result.

## Risk model

The documented baseline is:

```text
blastRadiusPoints = min(40, (5 * directAffectedCount) + (2 * indirectAffectedCount))
depthPoints       = min(20, 5 * maxImpactDepth)
changeSizePoints  = min(20, 5 * ceil(totalAdditionsAndDeletions / 50))
criticalityPoints = 0, 10, or 20

riskScore = min(100,
  blastRadiusPoints + depthPoints + changeSizePoints + criticalityPoints
)
```

Labels are Low (0-24), Medium (25-49), High (50-74), and Critical (75-100). Return the factor breakdown. If changing this formula, its factors, or thresholds, update [docs/04-dependency-analysis.md](../../../docs/04-dependency-analysis.md), the API contract, and affected UI behavior in the same change.

## Tests and verification

Include deterministic tests for:

- correct import edge direction,
- direct and transitive reverse traversal,
- unaffected files,
- cycles,
- external and unresolved imports,
- deleted or unmatched changed files,
- incomplete analysis warnings,
- stable score within 0-100 and correct labels.

Run the narrowest relevant checks available in the repository. Do not assume tooling or test scripts without checking the current project.

## Completion checklist

- [ ] Graph direction and path normalization match the spec.
- [ ] Cycles terminate and minimum impact depth is retained.
- [ ] Partial analysis and unresolved imports are visible.
- [ ] Score factors and limitations remain explainable.
- [ ] Tests cover key graph and scoring edge cases.
