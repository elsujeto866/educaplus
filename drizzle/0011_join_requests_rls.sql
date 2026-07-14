CREATE TABLE "join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"fulfilled_at" timestamp with time zone,
	"membership_id" uuid
);
--> statement-breakpoint
ALTER TABLE "join_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "is_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "join_requests_one_pending_idx" ON "join_requests" USING btree ("academy_id","email") WHERE "join_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "join_requests_academy_status_created_idx" ON "join_requests" USING btree ("academy_id","status","created_at");--> statement-breakpoint
CREATE INDEX "join_requests_academy_email_idx" ON "join_requests" USING btree ("academy_id","email");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "join_requests" AS PERMISSIVE FOR ALL TO "app_user" USING ("join_requests"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("join_requests"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
-- MANUAL: drizzle-kit emits the CREATE TABLE + tenant_isolation policy above,
-- but NOT roles, extra role-scoped policies, column-level GRANTs, or FORCE
-- RLS. This tail implements design D1 — the public, untenanted join-request
-- insert path — via a dedicated NOLOGIN role reached with transaction-local
-- SET LOCAL ROLE (see withPublicRole()), never the tenant GUC. Policy ORDER
-- below is LOAD-BEARING: "public_read" on academies is created BEFORE
-- "public_insert" on join_requests because the latter's WITH CHECK
-- subquery reads academies — Postgres does not require this ordering
-- technically, but it documents the dependency and matches design intent.
--
-- TWO corrections vs. the original design draft, found by the RLS test
-- suite (tests/integration/rls/join-requests-isolation.spec.ts) and
-- load-bearing for both isolation and the public-insert path to work:
--
--   1. `GRANT academy_public TO app_user` alone makes app_user a role
--      member WITH INHERIT (the Postgres default). Postgres evaluates a
--      PERMISSIVE policy's `TO <role>` clause via role MEMBERSHIP, not via
--      "is <role> the currently SET ROLE" — so without `WITH INHERIT
--      FALSE`, the "public_read" policy (TO academy_public) silently
--      OR-composes with app_user's own "tenant_isolation" policy on every
--      app_user session, leaking every published/non-deleted academy to
--      EVERY tenant regardless of app.current_tenant_id. `WITH INHERIT
--      FALSE` (Postgres 16+) keeps `SET LOCAL ROLE academy_public` working
--      (SET ROLE only requires membership) while stopping academy_public's
--      grants/policies from silently applying to app_user's own sessions.
--   2. The `public_insert` WITH CHECK subquery below reads
--      `academies.is_public` and `academies.deleted_at`, so academy_public
--      needs column-level SELECT on those two columns too — not just
--      (id, name, slug). Postgres checks column-level privileges for every
--      column referenced anywhere in a policy expression, including inside
--      a WITH CHECK subquery, not only for columns actually projected by
--      the outer query.
--
-- ONE further hardening correction, added post-PR1-verify (WARNING 1) and
-- proven by the "cannot set privileged columns" describe block in the same
-- suite:
--
--   3. The original `GRANT INSERT ON join_requests TO academy_public` was
--      TABLE-WIDE, so the WITH CHECK below (status + publication only) was
--      the ONLY boundary — an untenanted caller could still explicitly set
--      id, created_at, resolved_at, resolved_by, fulfilled_at, or
--      membership_id on their own insert (reconciliation-poisoning: e.g.
--      pre-setting fulfilled_at so a later admin approve's reconciliation
--      query `status='approved' AND fulfilled_at IS NULL` silently skips the
--      row, or spoofing resolved_by). Fixed with TWO layers, matching the
--      column-level GRANT convention already used for `academies` above:
--        a) `GRANT INSERT (academy_id, email, status)` — column-level GRANT
--           restricts which columns academy_public may EXPLICITLY assign in
--           an INSERT's column list at all; every other column can only ever
--           take its DEFAULT (Postgres does not require INSERT privilege on
--           a column that is not explicitly assigned a value, so id/
--           created_at/resolved_at/resolved_by/fulfilled_at/membership_id
--           safely fall back to their table defaults / NULL without needing
--           a grant). This is the PRIMARY, load-bearing boundary — it fails
--           at the privilege-check stage, before WITH CHECK is even
--           evaluated.
--        b) The WITH CHECK below also explicitly asserts
--           `resolved_at/resolved_by/fulfilled_at/membership_id IS NULL` as
--           defense-in-depth, so the guarantee holds even if the column
--           grant is ever accidentally widened in a future migration.
--      `status` stays in the column grant (still explicitly assignable) —
--      the pre-existing WITH CHECK `status = 'pending'` already pins its
--      only legal value.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='academy_public') THEN
    CREATE ROLE academy_public NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;--> statement-breakpoint
GRANT academy_public TO app_user WITH INHERIT FALSE;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO academy_public;--> statement-breakpoint
GRANT SELECT (id, name, slug, is_public, deleted_at) ON academies TO academy_public;--> statement-breakpoint
GRANT INSERT (academy_id, email, status) ON join_requests TO academy_public;--> statement-breakpoint
CREATE POLICY "public_read" ON academies AS PERMISSIVE FOR SELECT TO academy_public
  USING (is_public = true AND deleted_at IS NULL);--> statement-breakpoint
CREATE POLICY "public_insert" ON join_requests AS PERMISSIVE FOR INSERT TO academy_public
  WITH CHECK (status = 'pending'
    AND resolved_at IS NULL AND resolved_by IS NULL
    AND fulfilled_at IS NULL AND membership_id IS NULL
    AND EXISTS (
    SELECT 1 FROM academies a WHERE a.id = academy_id AND a.is_public = true AND a.deleted_at IS NULL));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON join_requests TO app_user;--> statement-breakpoint
ALTER TABLE "join_requests" FORCE ROW LEVEL SECURITY;