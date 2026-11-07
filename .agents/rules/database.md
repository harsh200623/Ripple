# Database Rules

Mandatory for schema, migration, persistence, and query code.

## 1. Schema governance
- Update the schema documentation before changing database structure.
- Apply schema changes through migration tooling or approved DB workflow.
- Do not edit previously applied migrations.
- Keep each migration focused on one logical change.

## 2. Naming conventions
- Use consistent naming for tables, columns, indexes, and constraints.
- Prefer readable snake_case names for database objects.
- Use descriptive names for foreign keys and related associations.
- Keep timestamps explicit and consistent across the system.

## 3. Data integrity
- Declare constraints in the database, not only in application code.
- Use primary keys, foreign keys, uniqueness constraints, and checks where needed.
- Avoid nullable fields unless there is a clear and explicit reason.
- Enforce invariants in the database whenever correctness matters.

## 4. Types and storage choices
- Choose the smallest correct data type for the use case.
- Use timestamp-with-timezone for time values unless a specific reason says otherwise.
- Use JSONB only for flexible, non-primary-query data.
- Store only values required for the product; avoid storing raw secrets or source content unless it is explicitly required.

## 5. Queries and performance
- Use parameterized queries rather than interpolating user input into SQL.
- Select only the columns required for the current use case.
- Avoid N+1 queries and repeated per-row writes in loops.
- Add indexes only where they are justified by actual access patterns.
- Prefer batching for large inserts or updates.

## 6. Transactions
- Use transactions for multi-step writes where consistency matters.
- Keep transactions short and avoid external network calls inside them.
- Retry safe operations when transient failures are expected.
- Ensure failed writes do not leave the database in a partially updated state.

## 7. Data policy and retention
- Store only operationally necessary data.
- Do not store tokens, credentials, source code, or sensitive user content unless there is an explicit, justified reason.
- Define retention or cleanup policies for temporary, derived, or stale data.
- Treat data privacy and security as part of the schema design.

## 8. Testing and validation
- Test migration behavior and integrity constraints.
- Verify rollback, uniqueness, cascade behavior, and invalid-data rejection.
- Use realistic database-backed tests for persistence logic when practical.
- Validate query behavior with representative volume and edge cases.

## 9. Quality gates
- Run the relevant migration and test checks before completion.
- Ensure schema changes are compatible with the documented API and application behavior.
- Keep database changes reviewable and explainable.

## 10. Forbidden
- Editing already applied migration files.
- Manually modifying schema outside the approved migration process.
- Storing secrets or user-sensitive data without explicit policy and consent.
- Building SQL from raw user input.
- Large, unbounded writes without batching or validation.
- Unnecessary indexes or speculative schema complexity.
