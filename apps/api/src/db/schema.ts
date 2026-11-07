import { sql } from 'drizzle-orm';
import {
  bigserial,
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Logical model per docs/05-api-and-database.md. Naming follows snake_case.
 * CHECK constraints live in drizzle/0001_add_checks.sql (hand-written).
 */

export const repositories = pgTable(
  'repositories',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    owner: varchar('owner', { length: 39 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    fullName: varchar('full_name', { length: 141 }).notNull(),
    htmlUrl: text('html_url').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('repositories_full_name_uq').on(t.fullName)],
);

export const pullRequests = pgTable(
  'pull_requests',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    repositoryId: bigint('repository_id', { mode: 'number' })
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    prNumber: integer('pr_number').notNull(),
    title: text('title').notNull(),
    htmlUrl: text('html_url').notNull(),
    baseSha: varchar('base_sha', { length: 40 }).notNull(),
    headSha: varchar('head_sha', { length: 40 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('pull_requests_repo_number_head_uq').on(t.repositoryId, t.prNumber, t.headSha),
    index('pull_requests_head_sha_idx').on(t.headSha),
  ],
);

export const analyses = pgTable(
  'analyses',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    pullRequestId: bigint('pull_request_id', { mode: 'number' })
      .notNull()
      .references(() => pullRequests.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 16 }).notNull().default('queued'),
    riskScore: integer('risk_score'),
    riskLevel: varchar('risk_level', { length: 16 }),
    queueJobId: text('queue_job_id'),
    errorCode: varchar('error_code', { length: 64 }),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('analyses_pull_request_id_idx').on(t.pullRequestId),
    index('analyses_status_idx').on(t.status),
  ],
);

export const analysisResults = pgTable('analysis_results', {
  analysisId: varchar('analysis_id', { length: 64 })
    .primaryKey()
    .references(() => analyses.id, { onDelete: 'cascade' }),
  graphData: jsonb('graph_data').notNull().default(sql`'{}'::jsonb`),
  changedFiles: jsonb('changed_files').notNull().default(sql`'[]'::jsonb`),
  affectedFiles: jsonb('affected_files').notNull().default(sql`'[]'::jsonb`),
  riskBreakdown: jsonb('risk_breakdown').notNull().default(sql`'{}'::jsonb`),
  warnings: jsonb('warnings').notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
