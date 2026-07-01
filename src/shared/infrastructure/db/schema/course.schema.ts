/**
 * Course schema — 9 tenant-scoped tables with deny-by-default RLS.
 *
 * Every table carries:
 *   - academy_id FK → academies (cascade delete) — the RLS discriminator.
 *   - pgPolicy('tenant_isolation') that restricts reads/writes to the current
 *     tenant set via set_config('app.current_tenant_id', …, true). When the
 *     setting is unset, current_setting(…, true) returns NULL → USING evaluates
 *     to FALSE for every row → 0 rows returned (deny-by-default).
 *   - .enableRLS() emits ENABLE ROW LEVEL SECURITY in the generated migration.
 *   - FORCE ROW LEVEL SECURITY is applied in drizzle/0002_course_rls.sql (manual).
 *
 * Circular FK:
 *   course_modules.assessment_id → assessments(id)   [nullable, set null on delete]
 *   assessments.module_id        → course_modules(id) [not null, cascade on delete]
 * Both references use the lazy (): AnyPgColumn => … form required by Drizzle for
 * forward/circular references. drizzle-kit emits both as ALTER TABLE ADD CONSTRAINT,
 * so table creation order is irrelevant for FK resolution.
 *
 * Lesson Class-Table-Inheritance (CTI):
 *   base row in `lessons` + ONE companion row in either `lesson_video_assets`
 *   (type='video') or `lesson_text_contents` (type='text').
 */

import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
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
// courses
// ---------------------------------------------------------------------------

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Tenant discriminator — RLS policy key. */
    academyId: text('academy_id')
      .notNull()
      .references(() => academies.id, { onDelete: 'cascade' }),
    /** URL slug — unique within the academy. */
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
    /** Display order within the academy course catalog. */
    position: integer('position').notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.academyId, t.slug),
    index('courses_academy_id_position_idx').on(t.academyId, t.position),
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// course_modules
// ---------------------------------------------------------------------------
// assessment_id uses a lazy reference ((): AnyPgColumn => assessments.id)
// because assessments is defined below — circular forward reference.

export const courseModules = pgTable(
  'course_modules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    /** Tenant discriminator — duplicated for RLS policy without a JOIN. */
    academyId: text('academy_id')
      .notNull()
      .references(() => academies.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    /** Display order within the course. */
    position: integer('position').notNull().default(0),
    /**
     * Optional 1:1 FK to the assessment for this module.
     * Lazy reference required — assessments is defined after courseModules.
     * ON DELETE SET NULL so deleting an assessment detaches it from the module.
     */
    assessmentId: uuid('assessment_id').references(
      (): AnyPgColumn => assessments.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('course_modules_course_id_position_idx').on(t.courseId, t.position),
    index('course_modules_academy_id_idx').on(t.academyId),
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// assessments
// ---------------------------------------------------------------------------
// module_id uses a lazy reference — even though courseModules is defined above,
// the circular pattern requires both sides to be lazy per Drizzle convention.

export const assessments = pgTable(
  'assessments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * One-to-one FK to the owning module.
     * UNIQUE enforced at column level → one assessment per module.
     * Lazy reference — circular with courseModules.assessmentId.
     */
    moduleId: uuid('module_id')
      .notNull()
      .unique()
      .references((): AnyPgColumn => courseModules.id, { onDelete: 'cascade' }),
    /** Tenant discriminator — duplicated for RLS policy without a JOIN. */
    academyId: text('academy_id')
      .notNull()
      .references(() => academies.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    /** Opaque configuration JSONB — full quiz schema deferred to a later change. */
    config: jsonb('config'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// lessons  (CTI base row)
// ---------------------------------------------------------------------------

export const lessons = pgTable(
  'lessons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => courseModules.id, { onDelete: 'cascade' }),
    /** Tenant discriminator — duplicated for RLS policy without a JOIN. */
    academyId: text('academy_id')
      .notNull()
      .references(() => academies.id, { onDelete: 'cascade' }),
    /** CTI discriminator — determines which companion table has the content. */
    type: text('type', { enum: ['video', 'text'] }).notNull(),
    title: text('title').notNull(),
    /** Display order within the module. */
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('lessons_module_id_position_idx').on(t.moduleId, t.position),
    index('lessons_academy_id_idx').on(t.academyId),
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// lesson_video_assets  (CTI companion — type='video')
// ---------------------------------------------------------------------------

export const lessonVideoAssets = pgTable(
  'lesson_video_assets',
  {
    /** PK is also the FK to lessons — 1:1 companion row. */
    lessonId: uuid('lesson_id')
      .primaryKey()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    /** Tenant discriminator — duplicated for RLS policy without a JOIN. */
    academyId: text('academy_id')
      .notNull()
      .references(() => academies.id, { onDelete: 'cascade' }),
    /** Nullable — filled later by the video-pipeline integration (Cloudflare Stream). */
    cloudflareUid: text('cloudflare_uid'),
    durationSeconds: integer('duration_seconds'),
    thumbnailUrl: text('thumbnail_url'),
    /** Nullable — external video source (YouTube/Vimeo) as an alternative to the Cloudflare pipeline. */
    externalUrl: text('external_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// lesson_text_contents  (CTI companion — type='text')
// ---------------------------------------------------------------------------

export const lessonTextContents = pgTable(
  'lesson_text_contents',
  {
    /** PK is also the FK to lessons — 1:1 companion row. */
    lessonId: uuid('lesson_id')
      .primaryKey()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    /** Tenant discriminator — duplicated for RLS policy without a JOIN. */
    academyId: text('academy_id')
      .notNull()
      .references(() => academies.id, { onDelete: 'cascade' }),
    /**
     * Rich-text body stored as JSONB — avoids a later schema migration when
     * switching from plain text to a structured editor format (TipTap/Slate).
     */
    body: jsonb('body').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// resources  (external links attached to a lesson)
// ---------------------------------------------------------------------------

export const resources = pgTable(
  'resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    /** Tenant discriminator — duplicated for RLS policy without a JOIN. */
    academyId: text('academy_id')
      .notNull()
      .references(() => academies.id, { onDelete: 'cascade' }),
    /** Only 'link' for now — 'file' deferred to the storage-upload change. */
    type: text('type', { enum: ['link'] }).notNull().default('link'),
    title: text('title').notNull(),
    url: text('url').notNull(),
    /** Display order within the lesson. */
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('resources_lesson_id_position_idx').on(t.lessonId, t.position),
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// enrollments
// ---------------------------------------------------------------------------

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    /** Tenant discriminator — duplicated for RLS policy without a JOIN. */
    academyId: text('academy_id')
      .notNull()
      .references(() => academies.id, { onDelete: 'cascade' }),
    /** Opaque Clerk user identifier (not a FK — Clerk is external). */
    clerkUserId: text('clerk_user_id').notNull(),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
    /** Set when all lessons in the course are completed; null until then. */
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    unique().on(t.courseId, t.clerkUserId),
    index('enrollments_academy_id_course_id_idx').on(t.academyId, t.courseId),
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// lesson_progress  (binary completion per enrollment × lesson)
// ---------------------------------------------------------------------------

export const lessonProgress = pgTable(
  'lesson_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    /** Tenant discriminator — duplicated for RLS policy without a JOIN. */
    academyId: text('academy_id')
      .notNull()
      .references(() => academies.id, { onDelete: 'cascade' }),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.enrollmentId, t.lessonId),
    index('lesson_progress_enrollment_id_lesson_id_idx').on(t.enrollmentId, t.lessonId),
    pgPolicy('tenant_isolation', {
      for: 'all',
      to: 'app_user',
      using: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.academyId} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS();
