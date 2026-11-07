---
name: database-change
description: "Design or change Ripple's PostgreSQL schema, migrations, queries, persistence, constraints, or analysis-result storage while preserving API contracts and data-safety requirements."
---

# Database change

Use for schema, migration, query, transaction, or data-retention changes. Follow the logical model and persistence rules in [docs/05-api-and-database.md](../../../docs/05-api-and-database.md) and the project-specific [.agents/rules/database.md](../../rules/database.md).

## Current data contract

- PostgreSQL stores repository and PR metadata, analysis lifecycle state, and analysis results.
- The `analyses` record is the source of truth for user-visible status.
- Graph/result data is represented as JSONB in the documented MVP model.
- Preserve the exact head SHA used for reproducibility.
- Do not store GitHub tokens, credentials, or full repository source contents.
- Clean up temporary repository checkouts after processing.
- Keep database fields, API shapes, and frontend expectations aligned.

## Procedure

1. Inspect the current schema, migration tool, queries, and tests. Do not assume a particular ORM or migration command unless the repository establishes it.
2. Review [docs/05-api-and-database.md](../../../docs/05-api-and-database.md) and identify effects on API responses, worker state, and retention.
3. Update the documented logical schema and data contract when they change.
4. Create a new migration using the repository's established tooling. Never rewrite a migration that has already been applied.
5. Add database constraints for invariants that must hold regardless of application code. Consider nullability, foreign keys, uniqueness, valid statuses, and score ranges.
6. Use parameterized queries, select only needed columns, and avoid N+1 or unbounded per-row writes.
7. Use transactions for multi-step writes that must remain consistent. Keep transactions short and do not perform network calls inside them.
8. Consider migration compatibility, existing rows, rollback/recovery, query impact, and appropriate indexes.
9. Add or update tests for migrations, constraints, uniqueness, transactional rollback, and persistence behavior using the repository's supported test setup.
10. Run relevant migration and test checks. Do not use destructive database commands without explicit authorization.

## Data safety

- Persist only data needed by product behavior and operations.
- Treat repository metadata and analysis results as potentially sensitive.
- Never store secrets or raw source code in analysis result storage.
- Do not introduce a retention duration or deletion policy without documenting and agreeing on it.
- Do not modify queue-managed tables owned by the job system.

## Completion checklist

- [ ] Schema docs, migrations, queries, and API contracts agree.
- [ ] Existing applied migrations remain unchanged.
- [ ] Constraints protect important invariants.
- [ ] Transactions preserve consistency on failure.
- [ ] Tests cover migration and persistence behavior.
