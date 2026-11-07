# 1. Project overview

## Product summary

Ripple helps engineering teams understand the likely blast radius of a pull request before it is merged. Given a GitHub pull request URL, the platform inspects code structure, resolves local dependency relationships, identifies files potentially impacted by the change, and displays the result in an explainable dashboard.

This is not a runtime bug detector. It is a decision-support tool for reviewers, maintainers, and teams evaluating risk in a changing codebase.

## Problem statement

In large or unfamiliar repositories, a change may appear small in the diff but have broad downstream impact. Reviewers often see a list of changed files, but not the dependent code paths that could break or require additional validation.

Without a clear view of impact, teams may:

- miss related files during review,
- underestimate cost or risk before merge,
- over-rely on ad hoc manual inspection,
- and ship changes with hidden integration risk.

## Product goal

Ripple's core goal is to help a reviewer answer:

> When these files change in a pull request, which other files may be affected, and why?

## Target users

- Developers reviewing pull requests
- Tech leads assessing change scope
- Engineers onboarding to unfamiliar repositories
- Maintainers prioritizing validation effort before merge

## Core user journeys

1. A user pastes a GitHub pull request URL.
2. The backend retrieves PR metadata and changed-file information.
3. The analysis engine builds a dependency graph for the head snapshot.
4. The system identifies direct and transitive dependents of changed files.
5. The user reviews risk, file classification, and impact rationale.
6. The team decides whether to proceed, request changes, or add validation.

## High-level capabilities

- GitHub PR URL validation and normalization
- Repository snapshot retrieval at the PR head SHA
- Static import extraction and dependency graph construction
- Reverse traversal to identify likely affected files
- Risk scoring with transparent factor breakdown
- Dashboard with summary, graph, warnings, and file details

## Scope

### In scope

- Public GitHub pull request analysis
- TypeScript and JavaScript source support
- Directed dependency graph of local source relationships
- Changed-file and affected-file classification
- Explainable risk scoring and warnings
- Web dashboard for PR review and impact assessment

### Out of scope

- Runtime tracing or execution of repository code
- Full semantic analysis of business logic or runtime behavior
- Native support for every language or framework
- Auto-approval, auto-merge, or code remediation flows
- Enterprise-grade multi-tenancy, billing, or org-level governance for the initial design

## Constraints and assumptions

- The MVP prioritizes public repositories and static code analysis.
- Local imports are resolved statically; runtime-generated module usage is not fully captured.
- Graph construction is based on the PR head snapshot, not a full before/after semantic diff.
- Risk is a heuristic estimate and should be presented as an aid to review, not proof of failure.
- Security-sensitive or secret-bearing infrastructure must remain server-side and must never be exposed to the browser.

## Production-readiness mindset

Ripple should be designed with production reliability in mind:

- safe and validated inputs,
- asynchronous analysis pipelines,
- explainable result data,
- explicit warning paths for partial analysis,
- and clear operational boundaries between UI, backend, worker, and persistence layers.

## Success metrics

The product is successful when:

- users can submit a supported PR URL and receive meaningful impact analysis,
- direct and transitive affected files are clearly identified,
- the scoring and impact reasoning are understandable,
- warnings surface uncertainty instead of masking it,
- and the workflow can be run reliably in a production environment.

## Product boundaries

Ripple does not claim to prove that a change will definitely break production behavior. Its purpose is to make impact more visible and reviewable so engineering teams can make better-informed decisions faster.
