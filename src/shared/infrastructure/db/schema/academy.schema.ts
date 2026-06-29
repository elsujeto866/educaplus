/**
 * Academy schema — academies + memberships tables with deny-by-default RLS.
 *
 * Both tables carry a `pgPolicy('tenant_isolation')` that restricts reads
 * and writes to the current tenant (set via `set_config('app.current_tenant_id', ..., true)`
 * inside `withTenant`). When the setting is unset `current_setting(..., true)` returns NULL,
 * so the USING clause evaluates to FALSE for every row — zero rows returned.
 *
 * `.enableRLS()` emits `ENABLE ROW LEVEL SECURITY` in the generated migration.
 * `FORCE ROW LEVEL SECURITY` (owner subjugation) is handled in drizzle/0001_rls.sql
 * because drizzle-kit does not emit FORCE RLS.
 */

import { sql } from 'drizzle-orm';
import {
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
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
