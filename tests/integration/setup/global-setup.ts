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
 *   8. Seed academies org_A / org_B and one membership each (superuser bypasses
 *      RLS here — FORCE RLS applies to the owner but NOT to superusers, so seeds
 *      flow through without tenant context).
 *   9. Seed minimal course/module/lesson/enrollment/progress rows for both orgs
 *      so cross-tenant RLS assertions have rows on both sides to compare against.
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
    //    Course tables (9 new) must be dropped before academy tables.
    await sql.unsafe('DROP TABLE IF EXISTS lesson_progress CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS lesson_video_assets CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS lesson_text_contents CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS resources CASCADE');
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

    // assessments — one per module (UNIQUE module_id constraint)
    await sql`
      INSERT INTO assessments (id, module_id, academy_id, title)
      VALUES ('a0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', 'org_A', 'Assessment A1')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO assessments (id, module_id, academy_id, title)
      VALUES ('b0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000002', 'org_B', 'Assessment B1')
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
