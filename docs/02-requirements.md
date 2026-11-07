# 2. Requirements

## Purpose

This document defines the functional and non-functional requirements for Ripple. It establishes the baseline for implementation quality, acceptance, and ongoing maintenance.

## Product requirements

### Functional requirements

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-01 | Accept a GitHub PR URL | The system accepts a valid GitHub pull request URL and rejects malformed or unsupported values with a clear validation message. |
| FR-02 | Retrieve PR metadata | The backend retrieves repository, PR number, title, and commit references from GitHub when available. |
| FR-03 | Analyze the PR head snapshot | The system runs analysis against the exact head SHA associated with the pull request. |
| FR-04 | Extract local file dependencies | Static imports and local references are extracted from supported TypeScript and JavaScript files. |
| FR-05 | Build a dependency graph | The system constructs a normalized graph of local source-file relationships with a documented edge direction. |
| FR-06 | Classify changed and affected files | Files reported by GitHub and reverse dependents of changed files are classified as changed, direct affected, indirect affected, or unaffected. |
| FR-07 | Explain reverse impact | Each affected file includes a reason or path-based explanation that can be shown in the UI. |
| FR-08 | Calculate risk | The platform returns a numeric risk score, a label, and a factor breakdown for review. |
| FR-09 | Persist analysis state | Analysis status and result data are stored so they remain accessible after the initial request completes. |
| FR-10 | Provide a dashboard | The frontend presents PR summary, graph, warnings, risk, and impacted files in a usable review interface. |
| FR-11 | Handle partial analysis safely | Unsupported files, unresolved imports, or incomplete data produce warnings instead of silently misleading the user. |

### Non-functional requirements

- The system must process analysis asynchronously so the request lifecycle does not block on repo inspection.
- The frontend must handle queued, running, completed, and failed analysis states.
- APIs must return stable, documented responses and safe error payloads.
- Analysis jobs must enforce repository, file, and execution limits to avoid resource exhaustion.
- The system must keep secrets off the client and out of logs and user-visible error payloads.
- Results must be explainable to engineers and reviewers without requiring source-code inspection of the entire repo.
- The platform must degrade gracefully when part of the analysis is incomplete.

## User stories

### User story 1

As a reviewer, I want to paste a PR URL and see files likely affected by the change so that I can assess impact before merge.

Acceptance criteria:

- Given a valid GitHub PR URL, when the user submits it, then the system creates an analysis record and begins processing.
- Given a completed analysis, when the user views the result, then they can see changed files and impacted dependents.

### User story 2

As a maintainer, I want risk to be explainable, so that I can understand the basis for the score and decide whether to request extra validation.

Acceptance criteria:

- Given an analysis result, when the user opens the risk summary, then they can see the score and factors used to calculate it.
- Given incomplete analysis conditions, when the result is shown, then warnings are visible and the score is clearly labeled as partial or limited.

### User story 3

As an engineer onboarding to a codebase, I want the graph to highlight likely dependency paths, so that I can understand the wider effect of a change quickly.

Acceptance criteria:

- Given a graph result, when a user selects a node, then they can view its file path, status, and reason for inclusion.
- Given a changed file, when a user follows the graph, then the system shows direct and transitive dependents.

## MVP scope

### Must-have

- GitHub PR URL validation
- PR metadata retrieval
- Repository checkout at the exact head SHA
- Static dependency graph for TS/JS files
- Reverse traversal for impacted dependents
- Explainable risk score and warnings
- Persistent analysis records and UI dashboard

### Should-have

- Better support for path aliases and monorepo layouts
- More detailed file reason explanations
- More robust result filtering and graph clustering
- Clear performance and retry behavior for large repositories

### Not in scope for initial release

- Runtime tracing and execution-based impact analysis
- GitHub App installation or automatic PR comments
- Native support for non-TS/JS ecosystems
- Advanced security and enterprise governance features
- Historical trend dashboards or team analytics

## Edge cases and risk scenarios

The system must explicitly handle the following situations:

- malformed or unsupported PR URLs,
- missing or partial GitHub metadata,
- large repositories that exceed processing limits,
- deleted or renamed files,
- circular dependencies,
- unresolved local imports,
- unsupported file types,
- partial data due to parsing or network failures,
- and unavailable external services.

These states should not produce silent success or misleading results.

## Acceptance checklist

The feature is ready only when:

- the main submission flow works for a valid public PR,
- impacted files are correctly classified,
- graph direction and traversal semantics are consistent,
- warnings appear for incomplete analysis,
- the risk score has a transparent explanation,
- and results are user-readable without exposing internal implementation data.
