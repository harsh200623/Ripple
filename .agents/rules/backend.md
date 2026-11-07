# Backend Rules

Mandatory for backend code and shared service logic.

## 1. Architecture
- Keep routing, validation, orchestration, business logic, and data access separated.
- Keep request handlers thin; they should validate input, call services, and shape a response.
- Business logic belongs in services or domain modules, not in route files.
- Keep analysis/domain logic pure and reusable outside web transport.
- Do not mix UI concerns, data access, and external API calls in the same layer.

## 2. Input validation
- Validate all incoming params, query data, and body payloads before use.
- Reject unknown or malformed values early.
- Treat every external input as untrusted.
- Use shared schemas and centralized validation when available.

## 3. Error handling
- Use a consistent structured error format across the app.
- Return safe, user-facing errors; do not leak secrets, stack traces, tokens, or internal paths.
- Log detailed internal failures server-side only.
- Convert infrastructure, validation, and domain failures into stable error codes.

## 4. Security
- Never execute code from untrusted repositories, user uploads, or cloned source content.
- Never run shell commands with unsanitized strings.
- Keep secrets in environment variables or secret managers only.
- Do not persist credentials, tokens, or secret-like data in logs, DB rows, or API responses.
- Validate and sanitize all externally supplied paths, URLs, and identifiers.
- Do not expose internal debug information to end users.

## 5. External integrations
- Centralize API clients and adapters for GitHub, database, queue, and other services.
- Apply timeouts and retry policies for external calls.
- Treat upstream outage, rate limits, and partial failures as expected operational conditions.
- Do not make non-idempotent calls blindly on retry.

## 6. Async jobs and long-running work
- Run long-running analysis or processing outside the request lifecycle.
- Make job handlers idempotent or safe to re-run for the same business key.
- Clean up temporary files, directories, and working state in `finally` blocks or equivalent cleanup paths.
- Track status updates and progress milestones consistently.

## 7. Logging and observability
- Use structured logs instead of ad hoc `console.log` output.
- Include request or job identifiers in logs.
- Redact credentials, tokens, authorization headers, and user-sensitive data.
- Log operational milestones, warnings, and failures; avoid logging full request bodies or file contents.

## 8. Persistence and data access
- Keep persistence logic behind clear repository or data-access layers.
- Do not put business logic in database queries.
- Use transactions where consistency matters.
- Write only necessary data; do not store source code, raw secrets, or sensitive user content unless explicitly required.

## 9. Performance and reliability
- Apply resource limits for file count, payload size, and processing time.
- Do not do CPU-heavy or file I/O work inline on the request path if it belongs in a worker.
- Use batching for bulk writes where it improves throughput.
- Fail gracefully under load and surface clear operational errors.

## 10. Testing
- Add tests for new business logic, service behavior, and error conditions.
- Cover both success paths and failure paths.
- Mock external integrations in unit tests; do not depend on network calls in test suites.
- Validate contract compatibility with API consumers when a response shape changes.

## 11. Quality gates
- Run the narrowest relevant typecheck, lint, and tests before completion.
- Do not merge code that breaks existing contracts or leaves unsafe defaults.
- Keep the change focused and reviewable.

## 12. Forbidden
- `any` without justification.
- Shell strings with unsanitized input.
- Secrets in logs or API responses.
- Business logic in controllers or routes.
- Executing repository code or scripts from analyzed content.
- Leaving temp files or clone directories behind after failures.
- New dependencies without a clear reason and documented approval.
