---
name: pr-ingestion
description: "Implement or debug Ripple's GitHub pull-request ingestion: validate PR URLs, retrieve PR and changed-file metadata, fetch the exact head snapshot, handle GitHub limits and failures, and clean up temporary checkouts safely."
---

# PR ingestion

Use this workflow for GitHub PR URL parsing, GitHub API integration, changed-file metadata, repository snapshot retrieval, and related cleanup. Follow [system architecture](../../../docs/03-system-architecture.md), [requirements](../../../docs/02-requirements.md), [API and database contract](../../../docs/05-api-and-database.md), and [.agents/rules/backend.md](../../rules/backend.md).

## Contract

- Accept supported GitHub pull-request URLs only; reject arbitrary hosts and clone URLs.
- Retrieve PR metadata and changed-file metadata on the server.
- Analyze the exact head commit SHA, not a moving branch name.
- Normalize metadata for the rest of the system, including the repository, PR number, title, base/head SHAs, and changed-file status.
- Keep credentials server-side. Never return or log tokens.
- Treat repository contents as untrusted data. Do not execute scripts, install dependencies, or load repository code.
- The repository checkout is temporary and must be removed after success or failure.

## Procedure

1. Read the relevant API and architecture contracts before changing behavior.
2. Inspect the existing GitHub client, repository-fetching code, configuration, and tests. Preserve established interfaces unless the contract requires a coordinated change.
3. Validate and normalize the PR URL before making any network or Git call. Enforce the documented GitHub host and pull-request path; reject malformed identifiers and unexpected URL forms.
4. Retrieve PR metadata and the complete changed-file list using the repository's existing GitHub client. Handle pagination, upstream errors, and rate limits explicitly.
5. Use the returned head SHA as the immutable analysis target. Retrieve the corresponding source snapshot without running code from it.
6. Use safe child-process APIs with argument arrays rather than shell-built command strings. Build temporary paths from server-generated identifiers, verify file paths stay inside the checkout, and account for symlinks.
7. Keep normalized ingestion output independent from HTTP response and UI-specific types. Update [API and database](../../../docs/05-api-and-database.md) and shared contracts if public shapes change.
8. Add deterministic tests for valid/invalid URLs, metadata normalization, pagination/error behavior, and cleanup on success and failure. Mock external calls; tests should not require the live GitHub API.
9. Run the narrowest relevant tests and checks available in this repository. Do not assume scripts or tooling exist without checking the package manifests.

## Failure handling

- Map expected GitHub and Git failures to stable, safe application errors.
- Do not return stack traces, credentials, local paths, or raw command output to users.
- Preserve enough structured server-side diagnostics to investigate failures without logging tokens, credentialed URLs, or repository file contents.
- Enforce time and size limits in coordination with the worker and analysis pipeline.
- Do not silently drop changed-file metadata or present an incomplete snapshot as a complete analysis.

## Completion checklist

- [ ] PR URL validation is strict and occurs before external operations.
- [ ] The head SHA and changed-file metadata are preserved.
- [ ] No repository code is executed.
- [ ] Temporary checkout cleanup runs on every exit path.
- [ ] Errors are safe and mapped consistently.
- [ ] Tests cover failure paths without network access.
