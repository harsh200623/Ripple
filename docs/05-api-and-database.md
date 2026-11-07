# 5. API and database

## Purpose

This document defines the service interfaces, persistence model, and data contracts used by Ripple. It is the shared agreement between backend services and the frontend review experience.

## API conventions

- Base path: `/api/v1`
- Request and response format: JSON
- Analysis creation is asynchronous
- Supported statuses: `queued`, `running`, `completed`, `failed`
- Secrets and credentials remain server-side only
- Error responses follow a single envelope schema

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/analyses` | Validate PR input and enqueue analysis |
| `GET` | `/api/v1/analyses/:analysisId` | Fetch status, summary, and result metadata |
| `GET` | `/api/v1/analyses/:analysisId/graph` | Retrieve dependency graph |
| `GET` | `/api/v1/analyses/:analysisId/affected-files` | Retrieve per-file impact list |
| `GET` | `/api/v1/health` | Basic service health check |

## Request and response contracts

### Create analysis

Request:

```json
{
  "pullRequestUrl": "https://github.com/owner/repository/pull/123"
}
```

Accepted response:

```json
{
  "success": true,
  "data": {
    "analysisId": "analysis_123",
    "status": "queued"
  }
}
```

Response status: `202 Accepted`

### Analysis status

```json
{
  "success": true,
  "data": {
    "analysisId": "analysis_123",
    "status": "completed",
    "repository": "owner/repository",
    "pullRequest": {
      "number": 123,
      "title": "Add user service",
      "url": "https://github.com/owner/repository/pull/123",
      "baseSha": "abc123",
      "headSha": "def456"
    },
    "summary": {
      "riskScore": 67,
      "riskLevel": "High",
      "changedFileCount": 2,
      "directAffectedCount": 4,
      "indirectAffectedCount": 6,
      "warnings": []
    }
  }
}
```

### Graph response

```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "src/services/user.service.ts",
        "filePath": "src/services/user.service.ts",
        "language": "typescript",
        "status": "changed"
      },
      {
        "id": "src/controllers/user.controller.ts",
        "filePath": "src/controllers/user.controller.ts",
        "language": "typescript",
        "status": "direct_affected"
      }
    ],
    "edges": [
      {
        "source": "src/controllers/user.controller.ts",
        "target": "src/services/user.service.ts",
        "importPath": "../services/user.service"
      }
    ]
  }
}
```

### Affected files response

```json
{
  "success": true,
  "data": [
    {
      "filePath": "src/controllers/user.controller.ts",
      "status": "direct_affected",
      "impactDepth": 1,
      "reasons": [
        "Imports src/services/user.service.ts"
      ],
      "prStatus": "modified"
    }
  ]
}
```

## Error envelope

All error responses should follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PULL_REQUEST_URL",
    "message": "Provide a valid GitHub pull request URL."
  }
}
```

### Recommended HTTP status mapping

| Situation | Status |
|---|---:|
| invalid request | 400 |
| analysis not found | 404 |
| accepted for processing | 202 |
| rate-limited dependency | 429 |
| upstream service unavailable | 502 or 503 |
| unexpected server error | 500 |

The error code should be stable and machine-readable. User-facing messages must not leak credentials or internal stack traces.

## Database model

### `repositories`

| Field | Purpose |
|---|---|
| `id` | primary key |
| `owner` | repo owner or org |
| `name` | repository name |
| `full_name` | `owner/name` |
| `html_url` | repository URL |
| `created_at` | record creation timestamp |

### `pull_requests`

| Field | Purpose |
|---|---|
| `id` | primary key |
| `repository_id` | FK to repositories |
| `pr_number` | GitHub PR number |
| `title` | PR title |
| `html_url` | PR URL |
| `base_sha` | base commit SHA |
| `head_sha` | head commit SHA |
| `created_at` | record creation timestamp |
| `updated_at` | last update timestamp |

### `analyses`

| Field | Purpose |
|---|---|
| `id` | public analysis identifier |
| `pull_request_id` | FK to pull_requests |
| `status` | `queued`, `running`, `completed`, `failed` |
| `risk_score` | integer 0-100, nullable |
| `risk_level` | low/medium/high/critical, nullable |
| `queue_job_id` | optional job reference |
| `error_code` | safe user-facing error code |
| `error_message` | safe user-facing error message |
| `started_at` | analysis start timestamp |
| `completed_at` | analysis end timestamp |
| `created_at` | record creation timestamp |

### `analysis_results`

| Field | Purpose |
|---|---|
| `analysis_id` | FK to analyses |
| `graph_data` | JSONB of nodes and edges |
| `changed_files` | JSONB list of changed file metadata |
| `affected_files` | JSONB list with status, reasons, and depth |
| `risk_breakdown` | JSONB of factor values |
| `warnings` | JSONB list of warnings |
| `created_at` | result creation timestamp |

The queue system may manage its own tables, but the application-level `analyses` record remains the source of truth for UI status.

## Persistence rules

- Store the exact head SHA used for the analysis.
- Keep source repo contents out of PostgreSQL unless specifically relevant to a future feature.
- Preserve output shape consistency between database, API, and UI.
- Do not store tokens or credentials in analysis tables or job payloads.
- Clean temporary checkout directories after completed or failed analysis jobs.
- Track warnings and incomplete-state metadata as first-class result data.

## Security and privacy requirements

- No GitHub tokens in browser code or front-end state.
- No secrets in logs or API responses.
- User-facing messages must be sanitized and stable.
- Access to analysis records should respect application-level auth boundaries.
- Sensitive repository data should be treated as confidential and subject to least privilege.

## Operational considerations

- Use retries with backoff for transient external failures.
- Set timeouts and resource ceilings for repository processing.
- Log analysis lifecycle events with correlation identifiers.
- Surface partial or failed processing results clearly.

## Result integrity

Ripple should ensure that result payloads are:

- deterministic for the same PR head snapshot,
- explainable to reviewers,
- and treated as advisory rather than absolute proof of breakage.
