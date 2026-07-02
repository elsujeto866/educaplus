CREATE TABLE "assessment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"academy_id" text NOT NULL,
	"clerk_user_id" text NOT NULL,
	"answers" jsonb NOT NULL,
	"score" integer NOT NULL,
	"passed" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessment_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessment_attempts_academy_assessment_user_idx" ON "assessment_attempts" USING btree ("academy_id","assessment_id","clerk_user_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "assessment_attempts" AS PERMISSIVE FOR ALL TO "app_user" USING ("assessment_attempts"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("assessment_attempts"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
-- MANUAL: drizzle-kit emits ENABLE+POLICY but NOT FORCE RLS or GRANT (mirrors 0002_course_rls.sql).
-- This is a NEW forced table — the FORCE line is LOAD-BEARING, not a defensive re-assert.
GRANT SELECT, INSERT, UPDATE, DELETE ON assessment_attempts TO app_user;--> statement-breakpoint
ALTER TABLE "assessment_attempts" FORCE ROW LEVEL SECURITY;