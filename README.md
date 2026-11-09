# Ripple

Ripple is a pull-request impact analysis platform for engineering teams. It inspects a GitHub pull request, resolves static local code dependencies, identifies files that may be affected by the change, and presents the result in a clear, explainable dashboard.

The tool is designed to improve merge safety and review confidence by making impact and blast radius visible before code is approved or shipped.

## Project purpose

Ripple answers a practical engineering question:

> When a pull request changes a file, which other files could be affected, and why?

It is intended to support maintainers, reviewers, and engineers in understanding the likely cost and risk of a change before merge.

## Documentation

The project documentation is in [docs/](./docs/README.md). It includes:

- product overview,
- requirements,
- architecture,
- dependency analysis,
- API and database contracts,
- and frontend specification.

## Production-grade approach

Ripple is designed to be more than a demo. The project assumes:

- explicit requirements and acceptance criteria,
- clear API and persistence contracts,
- asynchronous analysis jobs,
- explainable scoring and warnings,
- production-safe handling of secrets and partial analysis,
- and maintainable documentation for the full system lifecycle.

## Current implementation

The repository includes the asynchronous API and worker, shared API contracts, and the core TypeScript/JavaScript dependency-analysis engine. The API worker runs the engine against a bounded, read-only checkout of the exact PR head snapshot and persists its graph, affected files, risk factors, and warnings.

The analysis is static and heuristic. Unsupported files, unresolved imports, parser limitations, and configured analysis limits are surfaced as warnings rather than treated as proof of runtime breakage.
