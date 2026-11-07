# AI Agent Instructions

## Mission

Ripple is a pull-request impact analysis platform that helps reviewers understand which files and systems may be affected by code changes before merge. The goal is to make blast-radius analysis transparent, explainable, and operationally safe.

This repository is expected to be extended and maintained in production-like conditions. Agents must prioritize correctness, security, maintainability, and clear documentation over speed or cleverness.

## Required workflow

1. Start with the documentation relevant to the task. Do not read the entire docs tree unless needed.
2. Inspect the current implementation before changing behavior.
3. Preserve established interfaces and contracts unless the task explicitly requires a documented change.
4. Keep changes focused and reviewable.
5. Update docs when architecture, contracts, assumptions, or product behavior change.
6. Validate using the smallest relevant test, lint, or type-check command available.

## Project standards

- Use TypeScript and current repository conventions.
- Avoid `any` where practical and prefer explicit, typed interfaces.
- Validate external input and handle errors safely.
- Keep the analysis engine independent from Express and React-specific code.
- Treat static analysis as probabilistic impact assessment, not proof of runtime breakage.
- Do not silently hide uncertainty, parser limitations, or unresolved imports.

## Product and engineering principles

- Explainability is a product requirement. If a file is marked as affected, the root cause should be understandable.
- Production-grade software must fail safely, degrade gracefully, and preserve user trust.
- Security and privacy are mandatory: no tokens, secrets, or credentials should be exposed to browser clients or committed to the repository.
- Data retention, permissions, observability, and incident response matter as much as implementation details.
- Keep documentation aligned with the code and with operational reality.

## Documentation contract

When working in this repository, the canonical docs are:

- `docs/README.md` for the index and usage guide
- `docs/01-project-overview.md` for product intent and scope
- `docs/02-requirements.md` for functional and non-functional requirements
- `docs/03-system-architecture.md` for system boundaries and flows
- `docs/04-dependency-analysis.md` for graph logic and impact analysis
- `docs/05-api-and-database.md` for API and persistence contracts
- `docs/06-frontend-specification.md` for user experience and UI expectations

Do not silently change shared contracts described in these documents.

## Working rules

1. Inspect existing code and patterns before creating or changing files.
2. Keep I/O boundaries explicit: backend code should not depend on browser-only structures, and analysis logic should not depend on Express request objects.
3. Use async job execution for long-running analysis workflows.
4. Use safe error handling; surface meaningful, user-facing messages without internal secrets.
5. Do not execute code from untrusted repositories or unreviewed clones without explicit justification.
6. Prefer deterministic, explainable behavior over hidden heuristics.
7. Keep comments narrow and only where they clarify non-obvious decisions.

## Security and privacy

- Never expose GitHub tokens, database credentials, or other secrets to the browser.
- Keep server-side credentials in environment variables or secret stores.
- Validate URLs, payloads, and file inputs before processing.
- Treat repo contents as untrusted input and avoid executing project files or scripts during analysis.
- Keep user-visible errors free of stack traces, internal paths, and secrets.

## Quality gates before finishing

- Confirm the implementation matches the relevant acceptance criteria.
- Run the narrowest relevant validation available.
- Report tests that were not run and why.
- Ensure new behavior is covered by tests or explicit validation, where practical.
- Update documentation when the product contract, algorithm, architecture, or data model changes.
- Avoid unrelated refactors.

## Completion criteria

A task is complete only when all of the following are true:

- the requested change is implemented,
- the behavior is validated,
- relevant docs reflect the current contract,
- and the result is understandable to the next maintainer.
