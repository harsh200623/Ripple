---
name: docs-sync
description: "Keep Ripple's implementation and project documentation consistent after changes to product behavior, API contracts, analysis logic, architecture, data models, or frontend workflows; identify stale or conflicting docs."
---

# Documentation sync

Use after changes to a shared contract or behavior, or when asked whether project docs are accurate. Ripple's documentation is the intended product and engineering contract, while source code shows current implementation.

## Documentation map

| Subject | Source of intent |
|---|---|
| Product purpose and boundaries | [docs/01-project-overview.md](../../../docs/01-project-overview.md) |
| Functional/non-functional requirements | [docs/02-requirements.md](../../../docs/02-requirements.md) |
| Components and system boundaries | [docs/03-system-architecture.md](../../../docs/03-system-architecture.md) |
| Graph semantics, traversal, and score | [docs/04-dependency-analysis.md](../../../docs/04-dependency-analysis.md) |
| API, database, and persistence | [docs/05-api-and-database.md](../../../docs/05-api-and-database.md) |
| UI flow and visualization expectations | [docs/06-frontend-specification.md](../../../docs/06-frontend-specification.md) |

## Procedure

1. Identify the behavior or contract changed and inspect its implementation and tests.
2. Read only the relevant documentation sections and any linked contract.
3. Compare behavior, examples, statuses, field names, edge direction, warnings, and assumptions.
4. Decide whether the code or docs are incorrect based on the user's task and evidence. Do not silently treat an implementation as the intended behavior.
5. Update all directly affected docs in the same change when a lasting contract changes.
6. Keep terminology consistent: documented analysis statuses are `queued`, `running`, `completed`, and `failed`; graph edges are importer -> imported file.
7. If a docs/code mismatch remains unresolved, report it clearly rather than inventing a decision.
8. Check links and examples for consistency. Run documentation checks only if the repository provides them.

## Common synchronization points

- API changes: requirements, API/database contract, frontend API behavior.
- Graph or scoring changes: requirements, dependency analysis, API result shape, frontend explanation.
- Worker lifecycle changes: requirements, architecture, API statuses, frontend polling/states.
- Persistence changes: API/database contract, architecture, any affected API or worker documentation.
- UX changes: frontend specification and requirements when acceptance behavior changes.

## Completion checklist

- [ ] Affected docs reflect the intended behavior.
- [ ] Examples and status/field names agree across documents.
- [ ] No unresolved conflict is hidden.
- [ ] Documentation links and references still point to existing files.
