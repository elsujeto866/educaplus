CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"academy_id" text NOT NULL,
	"title" text NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessments_module_id_unique" UNIQUE("module_id")
);
--> statement-breakpoint
ALTER TABLE "assessments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "course_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"academy_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"assessment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_academy_id_slug_unique" UNIQUE("academy_id","slug")
);
--> statement-breakpoint
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"academy_id" text NOT NULL,
	"clerk_user_id" text NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "enrollments_course_id_clerk_user_id_unique" UNIQUE("course_id","clerk_user_id")
);
--> statement-breakpoint
ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"academy_id" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_progress_enrollment_id_lesson_id_unique" UNIQUE("enrollment_id","lesson_id")
);
--> statement-breakpoint
ALTER TABLE "lesson_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_text_contents" (
	"lesson_id" uuid PRIMARY KEY NOT NULL,
	"academy_id" text NOT NULL,
	"body" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_text_contents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_video_assets" (
	"lesson_id" uuid PRIMARY KEY NOT NULL,
	"academy_id" text NOT NULL,
	"cloudflare_uid" text,
	"duration_seconds" integer,
	"thumbnail_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_video_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"academy_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lessons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"academy_id" text NOT NULL,
	"type" text DEFAULT 'link' NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_text_contents" ADD CONSTRAINT "lesson_text_contents_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_text_contents" ADD CONSTRAINT "lesson_text_contents_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_video_assets" ADD CONSTRAINT "lesson_video_assets_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_video_assets" ADD CONSTRAINT "lesson_video_assets_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_modules_course_id_position_idx" ON "course_modules" USING btree ("course_id","position");--> statement-breakpoint
CREATE INDEX "course_modules_academy_id_idx" ON "course_modules" USING btree ("academy_id");--> statement-breakpoint
CREATE INDEX "courses_academy_id_position_idx" ON "courses" USING btree ("academy_id","position");--> statement-breakpoint
CREATE INDEX "enrollments_academy_id_course_id_idx" ON "enrollments" USING btree ("academy_id","course_id");--> statement-breakpoint
CREATE INDEX "lesson_progress_enrollment_id_lesson_id_idx" ON "lesson_progress" USING btree ("enrollment_id","lesson_id");--> statement-breakpoint
CREATE INDEX "lessons_module_id_position_idx" ON "lessons" USING btree ("module_id","position");--> statement-breakpoint
CREATE INDEX "lessons_academy_id_idx" ON "lessons" USING btree ("academy_id");--> statement-breakpoint
CREATE INDEX "resources_lesson_id_position_idx" ON "resources" USING btree ("lesson_id","position");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "assessments" AS PERMISSIVE FOR ALL TO "app_user" USING ("assessments"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("assessments"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "course_modules" AS PERMISSIVE FOR ALL TO "app_user" USING ("course_modules"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("course_modules"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "courses" AS PERMISSIVE FOR ALL TO "app_user" USING ("courses"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("courses"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "enrollments" AS PERMISSIVE FOR ALL TO "app_user" USING ("enrollments"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("enrollments"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "lesson_progress" AS PERMISSIVE FOR ALL TO "app_user" USING ("lesson_progress"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("lesson_progress"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "lesson_text_contents" AS PERMISSIVE FOR ALL TO "app_user" USING ("lesson_text_contents"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("lesson_text_contents"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "lesson_video_assets" AS PERMISSIVE FOR ALL TO "app_user" USING ("lesson_video_assets"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("lesson_video_assets"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "lessons" AS PERMISSIVE FOR ALL TO "app_user" USING ("lessons"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("lessons"."academy_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "resources" AS PERMISSIVE FOR ALL TO "app_user" USING ("resources"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("resources"."academy_id" = current_setting('app.current_tenant_id', true));