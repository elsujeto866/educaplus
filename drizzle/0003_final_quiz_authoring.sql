ALTER TABLE "course_modules" DROP CONSTRAINT "course_modules_assessment_id_assessments_id_fk";
--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "course_id" uuid;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "questions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" DROP COLUMN "assessment_id";--> statement-breakpoint
ALTER TABLE "assessments" DROP CONSTRAINT "assessments_module_id_unique";--> statement-breakpoint
ALTER TABLE "assessments" DROP CONSTRAINT "assessments_module_id_course_modules_id_fk";
--> statement-breakpoint
ALTER TABLE "assessments" ALTER COLUMN "course_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" DROP COLUMN "module_id";--> statement-breakpoint
ALTER TABLE "assessments" DROP COLUMN "config";--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_id_unique" UNIQUE("course_id");
