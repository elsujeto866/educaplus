/**
 * Simulator schema — 4 tenant-scoped tables with deny-by-default RLS,
 * introduced for the exam-simulator-question-bank change (Slice S1a).
 *
 * Every table carries:
 *   - academy_id FK → academies (cascade delete) — the RLS discriminator,
 *     duplicated (never JOIN-derived) exactly like `course.schema.ts`.
 *   - pgPolicy('tenant_isolation') restricting reads/writes to the current
 *     tenant set via set_config('app.current_tenant_id', …, true).
 *   - .enableRLS() emits ENABLE ROW LEVEL SECURITY in the generated migration.
 *   - FORCE ROW LEVEL SECURITY + GRANT is applied by hand in
 *     drizzle/0007_simulator_rls.sql (drizzle-kit never emits either).
 *
 * question_banks — reusable pool container, owned by an academy.
 * questions — relational rows scoped by bank (NOT embedded JSONB — unlike
 *   `assessments.questions`, this model needs to query/filter by topic and
 *   difficulty, and to be selected into attempt snapshots).
 * simulators — exam RULES bound to exactly one bank (multi-bank deferred).
 *   bankId uses onDelete=CASCADE (matches convention + keeps academy-teardown
 *   cascade working); deleting an in-use bank is blocked at the USE-CASE
 *   level, not via FK restrict, so a restrict FK never breaks academy cascade.
 * simulator_attempts — one row per attempt; frozenQuestions is a FULL
 *   snapshot (self-contained, immune to later bank edits — same JSONB-
 *   snapshot convention as `certificates`/`assessment_attempts`).
 *
 * SECURITY NOTE: frozenQuestions contains correctOptionId. Any read-model
 * exposed to the browser while an attempt is in_progress MUST strip
 * correctOptionId before leaving the server (enforced in a later slice's
 * view-model, not at the schema level).
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { academies } from './academy.schema';

// ---------------------------------------------------------------------------
// question_banks
// ---------------------------------------------------------------------------

export const questionBanks = pgTable(
  'question_banks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Tenant discriminator — RLS policy key. */
    academyId: text('academy_id')
      .notNull()
      .references(() => academies.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('question_banks_academy_id_idx').on(t.academyId),
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// questions
// ---------------------------------------------------------------------------

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bankId: uuid('bank_id')
      .notNull()
      .references(() => questionBanks.id, { onDelete: 'cascade' }),
    /** Tenant discriminator — duplicated for RLS policy without a JOIN. */
    academyId: text('academy_id')
      .notNull()
      .references(() => academies.id, { onDelete: 'cascade' }),
    prompt: text('prompt').notNull(),
    /** QuizOption[] — `{id, label}`, single-answer MCQ baseline. */
    options: jsonb('options').notNull(),
    correctOptionId: text('correct_option_id').notNull(),
    topic: text('topic'),
    difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] }),
    explanation: text('explanation'),
    /** Display order within the bank. */
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('questions_academy_id_bank_id_idx').on(t.academyId, t.bankId),
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// simulators — rules only; borrows from exactly one bank.
// ---------------------------------------------------------------------------

export const simulators = pgTable(
  'simulators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Tenant discriminator — duplicated for RLS policy without a JOIN. */
    academyId: text('academy_id')
      .notNull()
      .references(() => academies.id, { onDelete: 'cascade' }),
    /**
     * Cascade (not restrict) so academy teardown still cascades cleanly.
     * Deleting an in-use bank is blocked at the use-case level instead.
     */
    bankId: uuid('bank_id')
      .notNull()
      .references(() => questionBanks.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    questionCount: integer('question_count').notNull(),
    /** Minimum percentage score (0-100, integer) required to pass. */
    passingScore: integer('passing_score').notNull().default(70),
    timeLimitMinutes: integer('time_limit_minutes').notNull(),
    /** Per-student lifetime cap on attempts for this simulator. */
    attemptLimit: integer('attempt_limit').notNull().default(3),
    selectionStrategy: text('selection_strategy', { enum: ['random'] })
      .notNull()
      .default('random'),
    /** Nullable — flat string[] of topics; null means no topic filter. */
    topicFilter: jsonb('topic_filter'),
    status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
    /**
     * Whether passing this simulator issues a certificate (Slice S6 —
     * spec.md "Certificate on first pass (optional per simulator)"). Default
     * `true` preserves the unconditional-issuance behavior every simulator
     * created before this column existed already had.
     */
    issuesCertificate: boolean('issues_certificate').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('simulators_academy_id_status_idx').on(t.academyId, t.status),
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// simulator_attempts — one row per attempt; snapshot + answers + score +
// timing + status. NO unique on (simulator, user) — multiple attempts are
// allowed up to the simulator's attemptLimit (enforced at the use-case level).
// ---------------------------------------------------------------------------

export const simulatorAttempts = pgTable(
  'simulator_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    simulatorId: uuid('simulator_id')
      .notNull()
      .references(() => simulators.id, { onDelete: 'cascade' }),
    /** Tenant discriminator — duplicated for RLS policy without a JOIN. */
    academyId: text('academy_id')
      .notNull()
      .references(() => academies.id, { onDelete: 'cascade' }),
    /** Opaque Clerk user identifier (not a FK — Clerk is external). */
    clerkUserId: text('clerk_user_id').notNull(),
    status: text('status', { enum: ['in_progress', 'submitted', 'expired'] })
      .notNull()
      .default('in_progress'),
    /**
     * FULL snapshot of the selected questions at StartAttempt time:
     * [{id, prompt, options, correctOptionId}]. Self-contained — immune to
     * later edits/deletes in the source bank. Contains correctOptionId; the
     * in-progress read-model MUST strip it before reaching the browser.
     */
    frozenQuestions: jsonb('frozen_questions').notNull(),
    /** [{questionId, selectedOptionId}] — null until the student answers. */
    answers: jsonb('answers'),
    /** Percentage score (0-100, integer) — null until scored. */
    score: integer('score'),
    passed: boolean('passed'),
    /** Server-authoritative — timer starts here. */
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    /** Server-computed = startedAt + simulator.timeLimitMinutes. */
    deadlineAt: timestamp('deadline_at', { withTimezone: true }).notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('simulator_attempts_academy_simulator_user_idx').on(
      t.academyId,
      t.simulatorId,
      t.clerkUserId,
    ),
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// simulator_certificates — one immutable proof-of-pass row per (simulator,
// user), Slice S5. Issued lazily by IssueSimulatorCertificateUseCase once
// the caller has a passing attempt; never updated after creation
// (first-pass wins). Mirrors `certificates` (course.schema.ts) verbatim.
// ---------------------------------------------------------------------------

export const simulatorCertificates = pgTable(
  'simulator_certificates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    simulatorId: uuid('simulator_id')
      .notNull()
      .references(() => simulators.id, { onDelete: 'cascade' }),
    /** Tenant discriminator — duplicated for RLS policy without a JOIN. */
    academyId: text('academy_id')
      .notNull()
      .references(() => academies.id, { onDelete: 'cascade' }),
    /** Opaque Clerk user identifier (not a FK — Clerk is external). */
    clerkUserId: text('clerk_user_id').notNull(),
    /** Deterministic, human-readable code — see shared/kernel/certificate-code.ts. */
    certificateCode: text('certificate_code').notNull(),
    /** Percentage score (0-100, integer) snapshotted from the passing attempt. */
    score: integer('score').notNull(),
    /** Snapshot of the learner's display name at issuance time. */
    studentName: text('student_name').notNull(),
    /** Snapshot of the simulator title at issuance time. */
    simulatorTitle: text('simulator_title').notNull(),
    /** Snapshot of the academy name at issuance time. */
    academyName: text('academy_name').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.simulatorId, t.clerkUserId),
    unique().on(t.academyId, t.certificateCode),
    index('simulator_certificates_academy_simulator_user_idx').on(
      t.academyId,
      t.simulatorId,
      t.clerkUserId,
    ),
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();
