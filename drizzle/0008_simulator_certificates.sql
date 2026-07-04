CREATE TABLE "simulator_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"simulator_id" uuid NOT NULL,
	"academy_id" text NOT NULL,
	"clerk_user_id" text NOT NULL,
	"certificate_code" text NOT NULL,
	"score" integer NOT NULL,
	"student_name" text NOT NULL,
	"simulator_title" text NOT NULL,
	"academy_name" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "simulator_certificates_simulator_id_clerk_user_id_unique" UNIQUE("simulator_id","clerk_user_id"),
	CONSTRAINT "simulator_certificates_academy_id_certificate_code_unique" UNIQUE("academy_id","certificate_code")
);
--> statement-breakpoint
ALTER TABLE "simulator_certificates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "simulator_certificates" ADD CONSTRAINT "simulator_certificates_simulator_id_simulators_id_fk" FOREIGN KEY ("simulator_id") REFERENCES "public"."simulators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator_certificates" ADD CONSTRAINT "simulator_certificates_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "simulator_certificates_academy_simulator_user_idx" ON "simulator_certificates" USING btree ("academy_id","simulator_id","clerk_user_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "simulator_certificates" AS PERMISSIVE FOR ALL TO "app_user" USING ("simulator_certificates"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("simulator_certificates"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
-- MANUAL: drizzle-kit emits ENABLE+POLICY but NOT FORCE RLS or GRANT (mirrors 0006_certificates.sql / 0007_simulator_rls.sql).
-- This is a NEW forced table — the FORCE line is LOAD-BEARING, not a defensive re-assert.
GRANT SELECT, INSERT, UPDATE, DELETE ON simulator_certificates TO app_user;--> statement-breakpoint
ALTER TABLE "simulator_certificates" FORCE ROW LEVEL SECURITY;