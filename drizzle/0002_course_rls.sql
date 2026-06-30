-- Manual migration: FORCE ROW LEVEL SECURITY for course tables + app_user grants
--
-- drizzle-kit generate emits (in 0001_careful_starbolt.sql):
--   ENABLE ROW LEVEL SECURITY     — done per table
--   CREATE POLICY "tenant_isolation"  — done per table
--
-- drizzle-kit does NOT emit:
--   FORCE ROW LEVEL SECURITY  — subjects the table OWNER to RLS (footgun guard)
--   GRANT statements
--
-- This file mirrors drizzle/0001_rls.sql and handles both for the 9 new tables.
-- Apply AFTER 0001_careful_starbolt.sql in the test setup.

-- ---------------------------------------------------------------------------
-- Privileges — re-grant to cover the 9 new tables.
-- ALTER DEFAULT PRIVILEGES in 0001_rls.sql covers tables created after that
-- statement, but an explicit GRANT ensures no table is missed.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- ---------------------------------------------------------------------------
-- FORCE ROW LEVEL SECURITY — table owner is also subject to RLS.
--
-- Without FORCE, the owner (migration runner / superuser role) silently bypasses
-- all policies. FORCE RLS closes that footgun. The policies created in
-- 0001_careful_starbolt.sql remain active and apply to the owner too.
-- ---------------------------------------------------------------------------
ALTER TABLE courses              FORCE ROW LEVEL SECURITY;
ALTER TABLE course_modules       FORCE ROW LEVEL SECURITY;
ALTER TABLE assessments          FORCE ROW LEVEL SECURITY;
ALTER TABLE lessons              FORCE ROW LEVEL SECURITY;
ALTER TABLE lesson_video_assets  FORCE ROW LEVEL SECURITY;
ALTER TABLE lesson_text_contents FORCE ROW LEVEL SECURITY;
ALTER TABLE resources            FORCE ROW LEVEL SECURITY;
ALTER TABLE enrollments          FORCE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress      FORCE ROW LEVEL SECURITY;
