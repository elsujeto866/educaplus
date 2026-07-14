/**
 * Academy schema — academies + memberships + join_requests tables with
 * deny-by-default RLS.
 *
 * academies/memberships/join_requests all carry a `pgPolicy('tenant_isolation')`
 * that restricts reads and writes to the current tenant (set via
 * `set_config('app.current_tenant_id', ..., true)` inside `withTenant`). When
 * the setting is unset `current_setting(..., true)` returns NULL, so the
 * USING clause evaluates to FALSE for every row — zero rows returned.
 *
 * join_requests ALSO needs a second, role-scoped policy (`public_insert`,
 * TO academy_public) so an unauthenticated visitor can create a pending
 * request without ever holding tenant context. That policy — plus the
 * `academy_public` role, its grants, and academies' `public_read` policy —
 * is hand-written in drizzle/0011_join_requests_rls.sql because drizzle-kit
 * does not emit roles, extra policies, or FORCE RLS (see design D1).
 *
 * `.enableRLS()` emits `ENABLE ROW LEVEL SECURITY` in the generated migration.
 * `FORCE ROW LEVEL SECURITY` (owner subjugation) is handled in drizzle/0001_rls.sql
 * (academies/memberships) and drizzle/0011_join_requests_rls.sql (join_requests)
 * because drizzle-kit does not emit FORCE RLS.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// academies
// ---------------------------------------------------------------------------

export const academies = pgTable(
  'academies',
  {
    /** Clerk org_id — the stable tenant identifier and the RLS set_config value. */
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** URL slug — unique across the platform. */
    slug: text('slug').notNull().unique(),
    /** Arbitrary per-academy JSON settings. */
    settings: jsonb('settings'),
    /**
     * Whether the academy is publicly discoverable at /a/[slug] and accepts
     * join requests from unauthenticated visitors. Default true keeps MVP
     * discoverable (design D1 open question — product may tighten later).
     * Gates the `academy_public` role's `public_read`/`public_insert`
     * policies (drizzle/0011_join_requests_rls.sql), never the app_user
     * tenant_isolation policy below.
     */
    isPublic: boolean('is_public').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.id} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.id} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// memberships
// ---------------------------------------------------------------------------

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** FK to academies — the tenant discriminator column. */
    academyId: text('academy_id')
      .notNull()
      .references(() => academies.id, { onDelete: 'cascade' }),
    clerkUserId: text('clerk_user_id').notNull(),
    role: text('role', { enum: ['admin', 'instructor', 'student'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.academyId, t.clerkUserId),
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// join_requests
// ---------------------------------------------------------------------------

export const joinRequests = pgTable(
  'join_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** FK to academies — the tenant discriminator column. */
    academyId: text('academy_id')
      .notNull()
      .references(() => academies.id, { onDelete: 'cascade' }),
    /** Normalized (lowercase + trim) at the domain boundary before persisting. */
    email: text('email').notNull(),
    /** Inline enum, matches the simulator schema convention (no pgEnum). */
    status: text('status', { enum: ['pending', 'approved', 'rejected'] })
      .notNull()
      .default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Set on approve/reject. */
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    /** Admin clerk_user_id who approved/rejected. */
    resolvedBy: text('resolved_by'),
    /** Set by reconciliation (Phase 4) when the matching membership appears. */
    fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
    /** Link to the membership created when the request was fulfilled. */
    membershipId: uuid('membership_id').references(() => memberships.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    // Partial unique index: only ONE pending request per (academy, email).
    // Resolved requests (approved/rejected) do not block a fresh resubmission.
    uniqueIndex('join_requests_one_pending_idx')
      .on(t.academyId, t.email)
      .where(sql`${t.status} = 'pending'`),
    // Admin queue lookup: pending requests for an academy, oldest first.
    index('join_requests_academy_status_created_idx').on(t.academyId, t.status, t.createdAt),
    // Reconciliation lookup: match webhook email to an approved request.
    index('join_requests_academy_email_idx').on(t.academyId, t.email),
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();
