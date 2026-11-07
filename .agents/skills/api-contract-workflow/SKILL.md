---
name: api-contract-workflow
description: "Add or change a Ripple API endpoint, request or response field, status, or error. Use the documented contract-first workflow so backend, persistence, and frontend behavior remain compatible."
---

# API contract workflow

Use for changes to HTTP routes, payloads, status codes, error responses, and API-facing persistence. The source of truth is [docs/05-api-and-database.md](../../../docs/05-api-and-database.md); architecture boundaries are in [docs/03-system-architecture.md](../../../docs/03-system-architecture.md).

## Current API contract

- Base path: `/api/v1`.
- Analysis creation is asynchronous and returns `202 Accepted` with an analysis ID and `queued` status.
- Analysis lifecycle statuses are `queued`, `running`, `completed`, and `failed`.
- The documented endpoints create an analysis, retrieve its status/summary, retrieve its graph, retrieve affected files, and expose a basic health check.
- Success and failure payloads use the documented JSON envelope.
- Graph edges point from the importing file to the imported file.
- The frontend displays the backend's risk score; it must not recompute the authoritative score.

## Procedure

1. Read the relevant endpoint and schema sections in [docs/05-api-and-database.md](../../../docs/05-api-and-database.md), plus the affected requirements and UI contract.
2. Inspect existing routes, middleware, services, schemas, and tests. Confirm actual endpoint conventions and validation libraries from the code rather than assuming them.
3. Agree on the API change first: method/path, request validation, response shape, status codes, error codes, nullability, and compatibility impact.
4. Update the API documentation and any shared schema/types before or together with implementation. Keep API naming and database naming conventions distinct and explicitly mapped.
5. Keep transport handlers thin. Put orchestration in services and keep analysis logic independent of Express and React.
6. Validate all external input at the boundary. Do not trust request types without runtime validation.
7. Return safe, stable errors. Never expose stack traces, SQL, tokens, internal paths, or raw infrastructure details.
8. Add tests for success, validation failures, documented errors, and response-contract shape. Stub GitHub, Git, and other external services.
9. Update the frontend API integration and docs if the contract changes. Run relevant tests, type checks, and lint commands available in this repository.

## Compatibility rules

- Do not silently change a shared response shape or status.
- Preserve existing behavior for clients unless a deliberate versioned or documented change is approved.
- Ensure incomplete or failed analysis is distinguishable from a completed result.
- Do not return database rows directly when an explicit response shape is documented.

## Completion checklist

- [ ] Documentation, validation, implementation, and consumers agree.
- [ ] Status values and edge direction match the project contract.
- [ ] Errors are safe and machine-readable.
- [ ] Tests exercise the endpoint's success and failure paths.
