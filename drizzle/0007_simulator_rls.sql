CREATE TABLE "question_banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question_banks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_id" uuid NOT NULL,
	"academy_id" text NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_option_id" text NOT NULL,
	"topic" text,
	"difficulty" text,
	"explanation" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "simulator_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"simulator_id" uuid NOT NULL,
	"academy_id" text NOT NULL,
	"clerk_user_id" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"frozen_questions" jsonb NOT NULL,
	"answers" jsonb,
	"score" integer,
	"passed" boolean,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "simulator_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "simulators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" text NOT NULL,
	"bank_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"question_count" integer NOT NULL,
	"passing_score" integer DEFAULT 70 NOT NULL,
	"time_limit_minutes" integer NOT NULL,
	"attempt_limit" integer DEFAULT 3 NOT NULL,
	"selection_strategy" text DEFAULT 'random' NOT NULL,
	"topic_filter" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "simulators" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_bank_id_question_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."question_banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator_attempts" ADD CONSTRAINT "simulator_attempts_simulator_id_simulators_id_fk" FOREIGN KEY ("simulator_id") REFERENCES "public"."simulators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator_attempts" ADD CONSTRAINT "simulator_attempts_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulators" ADD CONSTRAINT "simulators_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulators" ADD CONSTRAINT "simulators_bank_id_question_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."question_banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_banks_academy_id_idx" ON "question_banks" USING btree ("academy_id");--> statement-breakpoint
CREATE INDEX "questions_academy_id_bank_id_idx" ON "questions" USING btree ("academy_id","bank_id");--> statement-breakpoint
CREATE INDEX "simulator_attempts_academy_simulator_user_idx" ON "simulator_attempts" USING btree ("academy_id","simulator_id","clerk_user_id");--> statement-breakpoint
CREATE INDEX "simulators_academy_id_status_idx" ON "simulators" USING btree ("academy_id","status");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "question_banks" AS PERMISSIVE FOR ALL TO "app_user" USING ("question_banks"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("question_banks"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "questions" AS PERMISSIVE FOR ALL TO "app_user" USING ("questions"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("questions"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "simulator_attempts" AS PERMISSIVE FOR ALL TO "app_user" USING ("simulator_attempts"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("simulator_attempts"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "simulators" AS PERMISSIVE FOR ALL TO "app_user" USING ("simulators"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("simulators"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
-- MANUAL: drizzle-kit emits ENABLE+POLICY but NOT FORCE RLS or GRANT (mirrors 0005_assessment_attempts.sql / 0006_certificates.sql).
-- These are NEW forced tables — the FORCE lines are LOAD-BEARING, not a defensive re-assert.
GRANT SELECT, INSERT, UPDATE, DELETE ON question_banks TO app_user;--> statement-breakpoint
ALTER TABLE "question_banks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON questions TO app_user;--> statement-breakpoint
ALTER TABLE "questions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON simulators TO app_user;--> statement-breakpoint
ALTER TABLE "simulators" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON simulator_attempts TO app_user;--> statement-breakpoint
ALTER TABLE "simulator_attempts" FORCE ROW LEVEL SECURITY;