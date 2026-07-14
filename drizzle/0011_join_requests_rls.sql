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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='academy_public') THEN
    CREATE ROLE academy_public NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;--> statement-breakpoint
GRANT academy_public TO app_user;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO academy_public;--> statement-breakpoint
GRANT SELECT (id, name, slug) ON academies TO academy_public;--> statement-breakpoint
GRANT INSERT ON join_requests TO academy_public;--> statement-breakpoint
CREATE POLICY "public_read" ON academies AS PERMISSIVE FOR SELECT TO academy_public
  USING (is_public = true AND deleted_at IS NULL);--> statement-breakpoint
CREATE POLICY "public_insert" ON join_requests AS PERMISSIVE FOR INSERT TO academy_public
  WITH CHECK (status = 'pending' AND EXISTS (
    SELECT 1 FROM academies a WHERE a.id = academy_id AND a.is_public = true AND a.deleted_at IS NULL));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON join_requests TO app_user;--> statement-breakpoint
ALTER TABLE "join_requests" FORCE ROW LEVEL SECURITY;