# Frontend Rules

Mandatory for frontend and UI code.

## 1. Architecture
- Keep UI components focused on rendering and user interaction.
- Move business logic, formatting, and state orchestration into hooks or domain utilities.
- Keep the UI layer thin; do not hardcode API or backend rules in JSX.
- Prefer reusable components over one-off ad hoc rendering.

## 2. Data fetching
- Centralize all API calls in a single API layer or client module.
- Do not fetch directly from components or inline `fetch`/HTTP calls across the app.
- Parse and validate server responses consistently before rendering them.
- Use a state-management pattern suitable for the app, but do not duplicate server state in multiple places.

## 3. Validation and user feedback
- Validate user input before submitting requests.
- Show inline errors for bad input instead of failing silently.
- Every async view must handle loading, error, empty, and success states.
- Use friendly, safe copy in error states; do not render raw backend stack traces or insecure output.

## 4. Performance
- Keep components small and focused.
- Memoize expensive calculations and derived data when appropriate.
- Avoid unnecessary re-renders.
- Avoid polling more frequently than necessary; stop polling when the workflow ends.
- Lazy-load heavy UI surfaces when they are not needed immediately.

## 5. Accessibility
- Use semantic HTML and interactive elements with proper labels.
- Provide visible focus states for keyboard navigation.
- Ensure forms, controls, and status updates are understandable by screen readers.
- Do not rely on color alone to communicate meaning.
- Keep text contrast and responsive layouts accessible.

## 6. Styling
- Keep styling consistent and design-system based.
- Prefer reusable tokens and shared patterns over ad hoc inline styling.
- Avoid introducing a second UI kit or design system in the same app.
- Keep large layout logic outside JSX when it can be separated cleanly.

## 7. Security and privacy
- Never expose secrets or internal configuration in the frontend bundle.
- Do not render untrusted HTML or user content as HTML.
- Use safe external links with proper rel attributes when opening new tabs.
- Keep sensitive data out of client state unless explicitly required and safe.

## 8. Graph and dashboard rules
- Keep graph logic separate from rendering logic when possible.
- Represent status clearly in labels, not only in color.
- Show the underlying metric or value alongside visual indicators.
- If the graph is large, apply sensible caps or summarization instead of rendering an unusable giant graph.

## 9. Testing
- Test validation, rendering, and error states.
- Test core utility logic independently when it affects user-facing decisions.
- Cover empty, loading, failure, and success UI states.
- Verify accessibility basics for key flows.

## 10. Quality gates
- Run the smallest relevant typecheck, lint, and tests before completion.
- Fix user-facing regressions before merging.
- Keep the UI understandable and trustworthy even when data is partial or incomplete.

## 11. Forbidden
- `any` without justification.
- `dangerouslySetInnerHTML` for untrusted content.
- Client-side rendering of secrets, tokens, or raw server internals.
- Business logic embedded in JSX.
- Unnecessary global state or duplicate sources of truth.
- Adding new UI dependencies without clear need and approval.
