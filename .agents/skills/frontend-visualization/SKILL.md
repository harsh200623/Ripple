---
name: frontend-visualization
description: "Implement or improve Ripple's PR submission, analysis progress, impact dashboard, dependency visualization, risk summary, affected-file details, warnings, responsive behavior, or accessibility."
---

# Frontend visualization

Use for frontend workflows and visualizations. Follow [docs/06-frontend-specification.md](../../../docs/06-frontend-specification.md), [docs/05-api-and-database.md](../../../docs/05-api-and-database.md), and [.agents/rules/frontend.md](../../rules/frontend.md). Inspect the actual frontend stack and existing components before choosing libraries or patterns.

## Product behavior

- The central question is which files changed, which other files may be affected, and why.
- The UI submits the PR URL, receives an analysis ID, polls status, then loads graph and affected-file data.
- Documented lifecycle statuses are `queued`, `running`, `completed`, and `failed`.
- Display the backend's authoritative risk score and factors; do not recalculate them in the client.
- Graph edges mean importer -> imported file.
- Warnings and partial-analysis limitations must be visible.

## Implementation procedure

1. Inspect existing routes, components, API client, state/query patterns, styling system, and tests.
2. Confirm endpoint and response shapes in [docs/05-api-and-database.md](../../../docs/05-api-and-database.md).
3. Centralize HTTP calls in the project's existing API layer. Handle server responses safely and consistently.
4. Keep presentation focused: PR context, risk summary and factors, impact counts, graph, affected-file list, file details, and warnings.
5. Make selected-file details explain classification, impact depth, and reasons. Keep graph and list selection synchronized where both are available.
6. Provide explicit initial, loading, error, empty, completed, and partial-analysis states.
7. Do not rely on color alone to communicate changed/direct/indirect/unaffected status. Provide readable labels and accessible controls.
8. Keep layout usable on small screens and avoid freezing the page on large graphs. Use limits or filtering only when clearly communicated.
9. Add tests for key user flows, input validation, status handling, empty/error states, and any nontrivial visualization logic.
10. Run available relevant tests, type checks, and linting. Do not assume a framework-specific command without checking the repository.

## Security and accessibility

- Never put server secrets in client code or browser storage.
- Never render untrusted server or repository strings as HTML.
- Use semantic controls, visible keyboard focus, accessible labels, and clear status announcements.
- Keep warnings and score limitations understandable without requiring users to infer meaning from the graph.

## Completion checklist

- [ ] UI behavior matches the API and frontend docs.
- [ ] The graph preserves importer-to-imported direction.
- [ ] Risk values are displayed, not recomputed.
- [ ] Loading, error, empty, success, and partial states are covered.
- [ ] Visualization is accessible and responsive.
