-- Manual migration: RLS hardening + restricted app role
--
-- drizzle-kit generate emits:
--   ENABLE ROW LEVEL SECURITY  (done in 0000)
--   CREATE POLICY "tenant_isolation" with USING + WITH CHECK  (done in 0000)
--
-- drizzle-kit does NOT emit:
--   FORCE ROW LEVEL SECURITY  — subjects the table OWNER to RLS too (the key footgun guard)
--   CREATE ROLE                — role lifecycle is outside schema management scope
--   GRANT statements
--
-- This file handles all three.

-- ---------------------------------------------------------------------------
-- app_user role — idempotent guard (DO block avoids error if role already exists)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'app_user'
  ) THEN
    CREATE ROLE app_user LOGIN PASSWORD 'changeme_before_prod' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Privileges — app_user can DML on all current tables
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- ---------------------------------------------------------------------------
-- FORCE ROW LEVEL SECURITY — table owner is also subject to RLS
--
-- Without FORCE, the owner (typically the migration runner / superuser role)
-- silently bypasses all policies. FORCE RLS closes that footgun.
-- The policies created in 0000 remain active and apply to the owner too.
-- ---------------------------------------------------------------------------
ALTER TABLE academies   FORCE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
