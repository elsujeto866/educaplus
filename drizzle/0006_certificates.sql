CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"academy_id" text NOT NULL,
	"clerk_user_id" text NOT NULL,
	"certificate_code" text NOT NULL,
	"score" integer NOT NULL,
	"student_name" text NOT NULL,
	"course_title" text NOT NULL,
	"academy_name" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_course_id_clerk_user_id_unique" UNIQUE("course_id","clerk_user_id"),
	CONSTRAINT "certificates_academy_id_certificate_code_unique" UNIQUE("academy_id","certificate_code")
);
--> statement-breakpoint
ALTER TABLE "certificates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certificates_academy_course_user_idx" ON "certificates" USING btree ("academy_id","course_id","clerk_user_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "certificates" AS PERMISSIVE FOR ALL TO "app_user" USING ("certificates"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("certificates"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
-- MANUAL: drizzle-kit emits ENABLE+POLICY but NOT FORCE RLS or GRANT (mirrors 0005_assessment_attempts.sql).
-- This is a NEW forced table — the FORCE line is LOAD-BEARING, not a defensive re-assert.
GRANT SELECT, INSERT, UPDATE, DELETE ON certificates TO app_user;--> statement-breakpoint
ALTER TABLE "certificates" FORCE ROW LEVEL SECURITY;