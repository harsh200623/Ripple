# 6. Frontend specification

## Goal

The frontend should answer the core product question quickly and clearly:

> Which files changed, which other files may be affected, and why?

The interface should help reviewers form a decision without making them inspect the entire codebase manually.

## User flows

### Primary flow

1. User opens the app and sees a clear PR submission form.
2. User pastes a supported GitHub pull request URL.
3. The system validates input and begins analysis.
4. The user sees progress while the backend fetches PR metadata and repository data.
5. When complete, the page shows summary, graph, files, and warnings.
6. User inspects a file or node and reads the impact rationale.

## Core screens

### 1. Intake screen

Purpose:

- accept a GitHub PR URL
- validate the value early
- explain supported input and expected workflow

Required elements:

- input field for PR URL
- submit button
- validation message area
- supporting text describing what analysis will do

### 2. Loading screen

Purpose:

- communicate processing status
- show that the system is working and not stuck

Required elements:

- queued or running state indicator
- status text explaining repository retrieval and analysis progress
- optional retry or cancel action where appropriate

### 3. Results dashboard

Purpose:

- summarize the PR and impact result
- allow detailed inspection of the graph and affected files

Required sections:

- PR metadata and repository context
- risk summary with score and factor breakdown
- graph visualization
- affected-file list
- warnings panel
- file detail panel

## Information hierarchy

1. PR and repository context
2. Risk summary and factor explanation
3. Changed-file and affected-file counts
4. Graph and node selection state
5. File details and path-by-path rationale
6. Warnings or partial-analysis notices

## Graph behavior

Ripple should use a graph UI that supports inspection and explanation, not just visual complexity.

Required behavior:

- node = one file
- edge = importer -> imported file
- changed files are visually distinguished from affected files
- direct and indirect impact use distinct visual states
- unaffected files remain visible but visually neutral
- selecting a node reveals file path, status, and impact reasons
- basic zoom, pan, and fit-to-view functionality are provided

Suggested colors:

| Status | Suggested treatment |
|---|---|
| Changed | red |
| Directly affected | orange |
| Indirectly affected | yellow |
| Unaffected | neutral gray |

Color should never be the only signal. Use labels, icons, and text status as well.

## File detail panel

When a user selects a file, the UI should show:

- normalized file path,
- file classification,
- impact depth,
- reason or reasons for inclusion,
- related dependency path if available,
- and warnings associated with that file or analysis.

The detail panel should help the user answer: “Why is this file included in the result?”

## Loading, empty, and error states

### Initial state

- Show a simple prompt and supported example usage.

### Processing state

- Disable duplicate submissions while a job is running.
- Poll the status endpoint until completion or failure.
- Show informative progress text.

### Error state

- Show safe, user-friendly messages.
- Offer retry for recoverable failures.
- Do not show token, stack trace, or internal implementation details.

### Empty graph state

- Display a clear message when no supported files were found.
- Explain that the result may be incomplete and show warnings.

### Partial analysis state

- Clearly label the result as partial or incomplete.
- Show warnings rather than a misleading perfect result.

## Accessibility and quality expectations

- keyboard navigation for major controls,
- visible focus states,
- semantic headings and labels,
- contrast-safe color combinations,
- and responsive layout support for smaller screens.

## Frontend/backend contract

The frontend must use the API schema defined in [05-api-and-database.md](./05-api-and-database.md). It should:

- submit only the PR URL,
- receive an analysis ID and poll for status,
- request graph and affected-file data once analysis is complete,
- and render the backend's risk result without recalculating the authoritative score.

## Design constraints

- Prefer readability and clarity over ornamental visuals.
- Keep the UI focused on review and understanding impact, not repository management or unrelated features.
- Make the explanations discoverable without requiring a long user journey.
- Use a consistent design system with reusable cards, panel layouts, and badge states.

## Success criteria for the interface

The frontend is successful when a user can:

- submit a valid PR URL,
- see progress without ambiguity,
- inspect the impacted file set,
- understand why files are classified as affected,
- and make a confident review decision based on the dashboard information.
