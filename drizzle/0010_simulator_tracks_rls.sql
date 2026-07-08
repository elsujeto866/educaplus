CREATE TABLE "simulator_track_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"academy_id" text NOT NULL,
	"clerk_user_id" text NOT NULL,
	"highest_unlocked_position" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "simulator_track_progress_track_id_clerk_user_id_unique" UNIQUE("track_id","clerk_user_id")
);
--> statement-breakpoint
ALTER TABLE "simulator_track_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "simulator_track_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"academy_id" text NOT NULL,
	"simulator_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "simulator_track_steps_simulator_id_unique" UNIQUE("simulator_id"),
	CONSTRAINT "simulator_track_steps_track_id_position_unique" UNIQUE("track_id","position")
);
--> statement-breakpoint
ALTER TABLE "simulator_track_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "simulator_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "simulator_tracks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "simulator_track_progress" ADD CONSTRAINT "simulator_track_progress_track_id_simulator_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."simulator_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator_track_progress" ADD CONSTRAINT "simulator_track_progress_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator_track_steps" ADD CONSTRAINT "simulator_track_steps_track_id_simulator_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."simulator_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator_track_steps" ADD CONSTRAINT "simulator_track_steps_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator_track_steps" ADD CONSTRAINT "simulator_track_steps_simulator_id_simulators_id_fk" FOREIGN KEY ("simulator_id") REFERENCES "public"."simulators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator_tracks" ADD CONSTRAINT "simulator_tracks_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "simulator_track_progress_academy_track_user_idx" ON "simulator_track_progress" USING btree ("academy_id","track_id","clerk_user_id");--> statement-breakpoint
CREATE INDEX "simulator_track_steps_academy_id_track_id_idx" ON "simulator_track_steps" USING btree ("academy_id","track_id");--> statement-breakpoint
CREATE INDEX "simulator_tracks_academy_id_status_idx" ON "simulator_tracks" USING btree ("academy_id","status");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "simulator_track_progress" AS PERMISSIVE FOR ALL TO "app_user" USING ("simulator_track_progress"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("simulator_track_progress"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "simulator_track_steps" AS PERMISSIVE FOR ALL TO "app_user" USING ("simulator_track_steps"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("simulator_track_steps"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "simulator_tracks" AS PERMISSIVE FOR ALL TO "app_user" USING ("simulator_tracks"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("simulator_tracks"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
-- MANUAL: drizzle-kit emits ENABLE+POLICY but NOT FORCE RLS or GRANT (mirrors 0007_simulator_rls.sql / 0008_simulator_certificates.sql).
-- These are NEW forced tables — the FORCE lines are LOAD-BEARING, not a defensive re-assert.
GRANT SELECT, INSERT, UPDATE, DELETE ON simulator_tracks TO app_user;--> statement-breakpoint
ALTER TABLE "simulator_tracks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON simulator_track_steps TO app_user;--> statement-breakpoint
ALTER TABLE "simulator_track_steps" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON simulator_track_progress TO app_user;--> statement-breakpoint
ALTER TABLE "simulator_track_progress" FORCE ROW LEVEL SECURITY;