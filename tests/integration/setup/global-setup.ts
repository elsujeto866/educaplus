/**
 * Vitest global-setup for the integration project.
 *
 * Runs once before any integration test file. Steps:
 *   1. Wait for the Postgres container to accept connections.
 *   2. Clean slate — drop all tables so the setup is idempotent across re-runs.
 *      Drop order is child-first to avoid FK violations:
 *        lesson_progress → lesson_video_assets → lesson_text_contents →
 *        resources → assessments → enrollments → lessons → course_modules →
 *        courses → memberships → academies
 *   3. Create app_user role (NOSUPERUSER NOBYPASSRLS) if it does not exist yet.
 *      This must happen BEFORE the 0000 migration because that migration
 *      contains CREATE POLICY … TO "app_user", which requires the role to exist.
 *   4. Apply drizzle migration 0000 (academy tables + ENABLE RLS + policies).
 *   5. Apply manual migration 0001_rls.sql (GRANT, ALTER TABLE … FORCE ROW LEVEL
 *      SECURITY for academy tables, ALTER DEFAULT PRIVILEGES for future tables).
 *   6. Apply drizzle migration 0001_careful_starbolt.sql (course tables + ENABLE
 *      RLS + policies + all FKs including the circular assessment ↔ module pair).
 *   7. Apply manual migration 0002_course_rls.sql (GRANT + FORCE ROW LEVEL
 *      SECURITY for all 9 new course tables).
 *   8. Apply drizzle migration 0002_orange_shiver_man.sql (adds nullable
 *      external_url column to lesson_video_assets — no new RLS needed, the
 *      existing tenant_isolation policy already covers the new column).
 *   9. Apply drizzle migration 0003_final_quiz_authoring.sql (reshapes
 *      assessments to course-scoped typed JSONB questions — drops
 *      course_modules.assessment_id, drops assessments.module_id/config,
 *      adds assessments.course_id (unique, cascade) + questions jsonb.
 *      FORCE ROW LEVEL SECURITY and the tenant_isolation policy on assessments
 *      are unaffected by these column ALTERs — no manual RLS re-assert needed).
 *   9b. Apply drizzle migration 0004_assessment_passing_score.sql (adds
 *      assessments.passing_score integer NOT NULL DEFAULT 70, plus a
 *      defensive ALTER TABLE … FORCE ROW LEVEL SECURITY tail — verified by
 *      the RLS suite).
 *   6f. Apply drizzle migration 0006_certificates.sql (creates certificates
 *      table plus the LOAD-BEARING manual GRANT + FORCE ROW LEVEL SECURITY
 *      tail — verified by the RLS suite).
 *   10. Seed academies org_A / org_B and one membership each (superuser bypasses
 *      RLS here — FORCE RLS applies to the owner but NOT to superusers, so seeds
 *      flow through without tenant context).
 *   11. Seed minimal course/module/lesson/enrollment/progress rows for both orgs
 *      so cross-tenant RLS assertions have rows on both sides to compare against.
 *   12. Seed one certificate per org so certificate-isolation.spec.ts has rows
 *      on both sides to compare against.
 *
 * Returns a teardown function (no-op — the container is torn down externally).
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

const SUPERUSER_URL =
  process.env['TEST_SUPERUSER_URL'] ??
  'postgresql://postgres:postgres@localhost:5433/educaplus_test';

const DRIZZLE_DIR = join(process.cwd(), 'drizzle');

async function waitForDb(url: string, maxAttempts = 30, delayMs = 1000): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    let probe: postgres.Sql | null = null;
    try {
      probe = postgres(url, { max: 1, connect_timeout: 2, onnotice: () => {} });
      await probe`SELECT 1`;
      await probe.end();
      return;
    } catch {
      if (probe) {
        try {
          await probe.end({ timeout: 1 });
        } catch {
          // ignore end errors
        }
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error(`Postgres not ready after ${maxAttempts} attempts at ${url}`);
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  await waitForDb(SUPERUSER_URL);

  const sql = postgres(SUPERUSER_URL, { max: 1, onnotice: () => {} });

  try {
    // 1. Clean slate — child-first drop order to respect FK constraints.
    //    Course tables (10 new) must be dropped before academy tables.
    //    assessment_attempts references assessments — must drop first.
    //    certificates references courses + academies (no children) — drop
    //    first so it never blocks a later CASCADE from courses/academies.
    await sql.unsafe('DROP TABLE IF EXISTS certificates CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS lesson_progress CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS lesson_video_assets CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS lesson_text_contents CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS resources CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS assessment_attempts CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS assessments CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS enrollments CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS lessons CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS course_modules CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS courses CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS memberships CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS academies CASCADE');

    // 2. Create restricted app_user role before migration (policies reference it).
    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
          CREATE ROLE app_user
            LOGIN
            PASSWORD 'changeme_before_prod'
            NOSUPERUSER
            NOBYPASSRLS
            NOCREATEDB
            NOCREATEROLE;
        END IF;
      END
      $$
    `);

    // 3. Apply 0000 migration — academy tables + ENABLE RLS + policies.
    //    Split on Drizzle's statement-breakpoint marker.
    const raw0000 = readFileSync(join(DRIZZLE_DIR, '0000_living_jetstream.sql'), 'utf-8');
    const stmts0000 = raw0000
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of stmts0000) {
      await sql.unsafe(stmt);
    }

    // 4. Apply 0001_rls.sql — GRANT privileges + FORCE ROW LEVEL SECURITY for
    //    academy tables. The DO block inside is idempotent (skips if role exists).
    //    ALTER DEFAULT PRIVILEGES here covers tables created by future migrations.
    const raw0001Rls = readFileSync(join(DRIZZLE_DIR, '0001_rls.sql'), 'utf-8');
    await sql.unsafe(raw0001Rls);

    // 5. Apply 0001_careful_starbolt.sql — course tables + ENABLE RLS + policies +
    //    all FK constraints including the circular assessments ↔ course_modules pair.
    const rawCourse = readFileSync(join(DRIZZLE_DIR, '0001_careful_starbolt.sql'), 'utf-8');
    const stmtsCourse = rawCourse
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of stmtsCourse) {
      await sql.unsafe(stmt);
    }

    // 6. Apply 0002_course_rls.sql — FORCE ROW LEVEL SECURITY + explicit GRANT
    //    for all 9 new course tables.
    const raw0002 = readFileSync(join(DRIZZLE_DIR, '0002_course_rls.sql'), 'utf-8');
    await sql.unsafe(raw0002);

    // 6b. Apply 0002_orange_shiver_man.sql — adds nullable external_url column
    //     to lesson_video_assets. Single ALTER TABLE statement, no RLS change
    //     needed (existing tenant_isolation policy covers the new column).
    const rawExternalUrl = readFileSync(
      join(DRIZZLE_DIR, '0002_orange_shiver_man.sql'),
      'utf-8',
    );
    await sql.unsafe(rawExternalUrl);

    // 6c. Apply 0003_final_quiz_authoring.sql — reshapes assessments to
    //     course-scoped typed JSONB questions. Multiple statements, split on
    //     the statement-breakpoint marker like the 0000/0001 migrations.
    const raw0003 = readFileSync(join(DRIZZLE_DIR, '0003_final_quiz_authoring.sql'), 'utf-8');
    const stmts0003 = raw0003
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of stmts0003) {
      await sql.unsafe(stmt);
    }

    // 6d. Apply 0004_assessment_passing_score.sql — adds
    //     assessments.passing_score + a defensive FORCE ROW LEVEL SECURITY
    //     re-assert. Split on the statement-breakpoint marker.
    const raw0004 = readFileSync(
      join(DRIZZLE_DIR, '0004_assessment_passing_score.sql'),
      'utf-8',
    );
    const stmts0004 = raw0004
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of stmts0004) {
      await sql.unsafe(stmt);
    }

    // 6e. Apply 0005_assessment_attempts.sql — creates assessment_attempts
    //     (fresh CREATE TABLE + ENABLE RLS + policy) plus the LOAD-BEARING
    //     manual GRANT + FORCE ROW LEVEL SECURITY tail (drizzle-kit never
    //     emits FORCE/GRANT — this is a NEW forced table, not a re-assert).
    const raw0005 = readFileSync(
      join(DRIZZLE_DIR, '0005_assessment_attempts.sql'),
      'utf-8',
    );
    const stmts0005 = raw0005
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of stmts0005) {
      await sql.unsafe(stmt);
    }

    // 6f. Apply 0006_certificates.sql — creates certificates (fresh CREATE
    //     TABLE + ENABLE RLS + policy) plus the LOAD-BEARING manual GRANT +
    //     FORCE ROW LEVEL SECURITY tail (drizzle-kit never emits FORCE/GRANT
    //     — this is a NEW forced table, not a re-assert).
    const raw0006 = readFileSync(join(DRIZZLE_DIR, '0006_certificates.sql'), 'utf-8');
    const stmts0006 = raw0006
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of stmts0006) {
      await sql.unsafe(stmt);
    }

    // 7. Seed two academies and one membership each.
    //    Superuser bypasses RLS (FORCE RLS subjects owner but NOT superuser),
    //    so no set_config call is needed here.
    await sql`
      INSERT INTO academies (id, name, slug)
      VALUES
        ('org_A', 'Academy A', 'academy-a'),
        ('org_B', 'Academy B', 'academy-b')
      ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO memberships (academy_id, clerk_user_id, role)
      VALUES
        ('org_A', 'user_A1', 'admin'),
        ('org_B', 'user_B1', 'student')
      ON CONFLICT (academy_id, clerk_user_id) DO NOTHING
    `;

    // 8. Seed minimal course data for both orgs so cross-tenant isolation assertions
    //    have rows on both sides. Superuser bypasses RLS for seeding.
    //
    //    org_A seed: one course → one module → one lesson → one enrollment → one progress row
    //    org_B seed: same structure
    //
    //    UUIDs use a fixed pattern for readability; no conflicts with gen_random_uuid().

    // org_A
    await sql`
      INSERT INTO courses (id, academy_id, slug, title, status, position)
      VALUES ('a0000000-0000-0000-0000-000000000001', 'org_A', 'course-a1', 'Course A1', 'published', 1)
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO course_modules (id, course_id, academy_id, title, position)
      VALUES ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'org_A', 'Module A1', 1)
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO lessons (id, module_id, academy_id, type, title, position)
      VALUES ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'org_A', 'video', 'Lesson A1', 1)
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO enrollments (id, course_id, academy_id, clerk_user_id)
      VALUES ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'org_A', 'user_A1')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO lesson_progress (id, enrollment_id, lesson_id, academy_id)
      VALUES ('a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', 'org_A')
      ON CONFLICT (id) DO NOTHING
    `;

    // org_B
    await sql`
      INSERT INTO courses (id, academy_id, slug, title, status, position)
      VALUES ('b0000000-0000-0000-0000-000000000001', 'org_B', 'course-b1', 'Course B1', 'published', 1)
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO course_modules (id, course_id, academy_id, title, position)
      VALUES ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'org_B', 'Module B1', 1)
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO lessons (id, module_id, academy_id, type, title, position)
      VALUES ('b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'org_B', 'video', 'Lesson B1', 1)
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO enrollments (id, course_id, academy_id, clerk_user_id)
      VALUES ('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'org_B', 'user_B1')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO lesson_progress (id, enrollment_id, lesson_id, academy_id)
      VALUES ('b0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 'org_B')
      ON CONFLICT (id) DO NOTHING
    `;

    // 9. Seed the 4 companion/child tables that need direct RLS assertions:
    //    lesson_video_assets, lesson_text_contents, resources, assessments.
    //    Each org gets one row per table so cross-tenant isolation tests have
    //    data on both sides.

    // lesson_video_assets — companion for the existing type='video' lessons
    await sql`
      INSERT INTO lesson_video_assets (lesson_id, academy_id)
      VALUES ('a0000000-0000-0000-0000-000000000003', 'org_A')
      ON CONFLICT (lesson_id) DO NOTHING
    `;
    await sql`
      INSERT INTO lesson_video_assets (lesson_id, academy_id)
      VALUES ('b0000000-0000-0000-0000-000000000003', 'org_B')
      ON CONFLICT (lesson_id) DO NOTHING
    `;

    // New type='text' lessons — required as parents for lesson_text_contents
    await sql`
      INSERT INTO lessons (id, module_id, academy_id, type, title, position)
      VALUES ('a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'org_A', 'text', 'Lesson A2', 2)
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO lessons (id, module_id, academy_id, type, title, position)
      VALUES ('b0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'org_B', 'text', 'Lesson B2', 2)
      ON CONFLICT (id) DO NOTHING
    `;

    // lesson_text_contents — companion for the new type='text' lessons
    await sql`
      INSERT INTO lesson_text_contents (lesson_id, academy_id, body)
      VALUES ('a0000000-0000-0000-0000-000000000006', 'org_A', '{}')
      ON CONFLICT (lesson_id) DO NOTHING
    `;
    await sql`
      INSERT INTO lesson_text_contents (lesson_id, academy_id, body)
      VALUES ('b0000000-0000-0000-0000-000000000006', 'org_B', '{}')
      ON CONFLICT (lesson_id) DO NOTHING
    `;

    // resources — external link attached to the video lessons
    await sql`
      INSERT INTO resources (id, lesson_id, academy_id, type, title, url, position)
      VALUES ('a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'org_A', 'link', 'Resource A1', 'https://example.com/resource-a1', 1)
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO resources (id, lesson_id, academy_id, type, title, url, position)
      VALUES ('b0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000003', 'org_B', 'link', 'Resource B1', 'https://example.com/resource-b1', 1)
      ON CONFLICT (id) DO NOTHING
    `;

    // assessments — one per course (UNIQUE course_id constraint). Explicit,
    // distinct passing_score values per org so cross-tenant RLS assertions
    // on the new column have something to distinguish.
    await sql`
      INSERT INTO assessments (id, course_id, academy_id, title, passing_score, questions)
      VALUES ('a0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'org_A', 'Assessment A1', 70, '[]')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO assessments (id, course_id, academy_id, title, passing_score, questions)
      VALUES ('b0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000001', 'org_B', 'Assessment B1', 80, '[]')
      ON CONFLICT (id) DO NOTHING
    `;

    // assessment_attempts — one passed attempt per org, keyed to the
    // assessment seeded above (a...008 / b...008). Empty answers snapshot
    // is fine here — these rows exist purely for RLS isolation assertions.
    await sql`
      INSERT INTO assessment_attempts (id, assessment_id, academy_id, clerk_user_id, answers, score, passed)
      VALUES ('a0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000008', 'org_A', 'user_A1', '[]', 100, true)
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO assessment_attempts (id, assessment_id, academy_id, clerk_user_id, answers, score, passed)
      VALUES ('b0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000008', 'org_B', 'user_B1', '[]', 100, true)
      ON CONFLICT (id) DO NOTHING
    `;

    // certificates — one issued certificate per org, keyed to the course
    // seeded above (a...001 / b...001). Rows exist purely for RLS isolation
    // assertions.
    await sql`
      INSERT INTO certificates (id, course_id, academy_id, clerk_user_id, certificate_code, score, student_name, course_title, academy_name)
      VALUES ('a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'org_A', 'user_A1', 'CERT-2026-AAAAAAAA', 100, 'Student A1', 'Course A1', 'Academy A')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO certificates (id, course_id, academy_id, clerk_user_id, certificate_code, score, student_name, course_title, academy_name)
      VALUES ('b0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-000000000001', 'org_B', 'user_B1', 'CERT-2026-BBBBBBBB', 100, 'Student B1', 'Course B1', 'Academy B')
      ON CONFLICT (id) DO NOTHING
    `;
  } finally {
    await sql.end();
  }

  return async () => {
    // Container is torn down externally via `docker compose -f docker-compose.test.yml down -v`.
    // Nothing to clean up here.
  };
}
