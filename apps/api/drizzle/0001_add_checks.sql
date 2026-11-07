-- Hand-written invariants that drizzle-kit does not generate.
-- Applied after 0000_init.sql. Do not edit once applied; add a new migration instead.

ALTER TABLE "analyses"
  ADD CONSTRAINT "analyses_status_check"
  CHECK ("status" IN ('queued', 'running', 'completed', 'failed'));

ALTER TABLE "analyses"
  ADD CONSTRAINT "analyses_risk_score_range_check"
  CHECK ("risk_score" IS NULL OR ("risk_score" >= 0 AND "risk_score" <= 100));

ALTER TABLE "analyses"
  ADD CONSTRAINT "analyses_risk_level_check"
  CHECK ("risk_level" IS NULL OR "risk_level" IN ('low', 'medium', 'high', 'critical'));

ALTER TABLE "analyses"
  ADD CONSTRAINT "analyses_completed_requires_risk_check"
  CHECK ("status" <> 'completed' OR ("risk_score" IS NOT NULL AND "risk_level" IS NOT NULL));

ALTER TABLE "analyses"
  ADD CONSTRAINT "analyses_failed_requires_error_check"
  CHECK ("status" <> 'failed' OR "error_code" IS NOT NULL);

ALTER TABLE "pull_requests"
  ADD CONSTRAINT "pull_requests_pr_number_positive_check"
  CHECK ("pr_number" > 0);

ALTER TABLE "pull_requests"
  ADD CONSTRAINT "pull_requests_head_sha_format_check"
  CHECK ("head_sha" ~ '^[0-9a-f]{40}$');

ALTER TABLE "pull_requests"
  ADD CONSTRAINT "pull_requests_base_sha_format_check"
  CHECK ("base_sha" ~ '^[0-9a-f]{40}$');
