# Ripple documentation

This folder defines the product contract, architecture, technical standards, and delivery expectations for Ripple. The documents are intended to be used as the shared source of truth for implementation, review, and operational decision-making.

## Document index

| File | Purpose |
|---|---|
| [01-project-overview.md](./01-project-overview.md) | Product vision, market problem, key users, and scope |
| [02-requirements.md](./02-requirements.md) | Functional and non-functional requirements, user stories, and acceptance criteria |
| [03-system-architecture.md](./03-system-architecture.md) | System boundaries, components, and deployment/ops model |
| [04-dependency-analysis.md](./04-dependency-analysis.md) | Graph semantics, dependency resolution, traversal, and risk scoring |
| [05-api-and-database.md](./05-api-and-database.md) | API contracts, persistence model, validation, and data lifecycle |
| [06-frontend-specification.md](./06-frontend-specification.md) | User flows, UI states, dashboard expectations, and UX rules |

The root-level [AGENTS.md](../AGENTS.md) defines the coding and review standards for agents and contributors.

## How to use these documents

1. Start with the overview and requirements before making design changes.
2. Use architecture and API docs to align frontend, backend, and data work.
3. Use dependency analysis to keep the impact model consistent and explainable.
4. Treat frontend docs as a contract for UX and interaction quality.
5. Update documentation when product scope, architectural assumptions, or contracts change.

## Production-grade expectations

These docs are written to support a production-ready engineering workflow, not just a demo. In particular, they assume:

- explicit product requirements and measurable acceptance criteria,
- documented system boundaries and ownership,
- safe API and persistence contracts,
- explainable impact analysis and score breakdown,
- security and privacy guardrails,
- operational readiness across staging and production environments.

## Document ownership

This project should be treated as a shared engineering artifact:

- product and scope decisions live in the overview and requirements docs,
- architecture and API docs define technical boundaries,
- analysis docs define the meaning of impact and risk,
- frontend docs define the UX contract and user-facing trust signals.

## Review process

Before merging changes that affect a shared contract, the following should be reviewed together:

- requirement impact,
- architectural impact,
- data/API compatibility,
- user-facing behavior,
- security and operational risk.

The docs should be concise but explicit. Avoid vague or aspirational language when a requirement can be written in a testable form.
