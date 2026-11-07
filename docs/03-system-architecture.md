# 3. System architecture

## Overview

Ripple follows a modular architecture with clear responsibility boundaries between the user interface, API layer, background analysis workflow, and persistence layer. The goal is to keep impact-analysis logic deterministic, testable, and reusable, while still supporting a web-based review experience.

At a high level:

```text
User / Reviewer
       |
       v
React frontend
       |
       v
Express API
       |
       v
PostgreSQL + job queue
       |
       v
Background analysis worker
       |
       +--> GitHub API integration
       +--> Repository checkout / snapshot access
       +--> Static dependency and impact analysis
       +--> Persisted result and warnings
       |
       v
Dashboard and summary API
```

## Design principles

- Separate business logic from web transport concerns.
- Keep analysis inputs explicit and typed.
- Use background workers for expensive PR processing.
- Keep data contracts frontend-neutral and API-neutral.
- Surface incomplete analysis honestly through warnings and risk labels.

## Component responsibilities

| Component | Responsibility | Out of scope |
|---|---|---|
| Frontend | PR submission, polling, graph display, summary, warnings | Accessing secrets or cloning repositories |
| API layer | Validation, orchestration, status retrieval, error handling | Running heavy analysis in the request handler |
| Background worker | Fetch snapshot, parse files, compute graph and impact | Direct user interaction |
| GitHub integration | PR metadata and changed-file retrieval | Browser-side token exposure |
| Repository fetcher | Checkout and sanitize temporary repo snapshots | Executing project scripts |
| Analysis engine | Parse dependencies, traverse graph, compute risk | HTTP or React-specific logic |
| Data layer | Persist job state, analysis result, and metadata | Storing secrets or source-code copies |

## Recommended module boundaries

```text
src/
  app/
    api/
    config/
    middleware/
  domain/
    analysis/
      parser/
      graph/
      blast-radius/
      scoring/
      warnings/
    github/
    repo/
  infra/
    db/
    jobs/
    storage/
  web/
    client/
    dashboard/
```

The analysis domain should be callable from code without depending on Express, React, or request lifecycle context. The API layer should pass explicit inputs and results across boundaries.

## Request lifecycle

1. User submits a PR URL in the frontend.
2. API validates the URL and creates an analysis record.
3. API enqueues an async job for processing.
4. Worker retrieves PR and repo metadata.
5. Worker checks out the exact PR head SHA.
6. Analysis engine builds the dependency graph.
7. Risk calculation and warnings are produced.
8. Result is persisted and made available through status endpoints.
9. Frontend polls for completion and renders the dashboard.

## Job workflow

```text
POST /api/v1/analyses
  -> validate input
  -> create analysis record with status=queued
  -> enqueue worker job

Worker
  -> status=running
  -> fetch PR metadata
  -> fetch repo snapshot
  -> parse source files
  -> build graph
  -> compute affected files and score
  -> persist result JSON
  -> status=completed or failed
```

The persisted analysis record is the source of truth for UI status. Job queues are operational infrastructure, not the primary product contract.

## Integration boundaries

- GitHub integration returns normalized PR metadata and changed-file info.
- Repository access yields a temporary local snapshot for static analysis.
- Analysis engine returns graph data, changed/affected file classifications, warnings, and risk breakdown.
- Persistence stores the result JSON and job metadata.
- API layer translates that data into user-facing success or failure responses.

## Security architecture

- All GitHub access credentials are server-side only.
- Secrets are never exposed to browser clients or stored in front-end state.
- Temporary repository checkouts are cleaned up after processing.
- User-facing responses do not include stack traces, tokens, or internal configuration values.
- Only validated, sanitized PR URLs and payloads are accepted.

## Observability and operational concerns

Production-grade operation requires:

- structured logs for job lifecycle and errors,
- metrics for queue depth, success/failure rates, and processing latency,
- alerting for upstream GitHub or repo-fetch failures,
- and safe degradation when analysis is partial or limited.

## Failure handling

The system should explicitly handle:

- invalid PR input,
- rate limiting from GitHub,
- unavailable repo snapshots,
- parsing failures or unsupported files,
- graph construction limits,
- empty or partial results,
- and any timeouts or worker-level exceptions.

In all cases, the result should be clear, safe, and user-readable.

## Deployment model

Recommended deployment model:

- frontend hosted independently or behind a single app gateway,
- backend API and worker deployed as separate services or workers,
- PostgreSQL for analysis metadata and result persistence,
- queue system for background processing,
- environment-specific configuration for secrets and deployment limits.

This separation makes the analysis engine easier to reuse, test, and evolve without tying it to UI concerns.
