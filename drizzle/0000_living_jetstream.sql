CREATE TABLE "academies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "academies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "academies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" text NOT NULL,
	"clerk_user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_academy_id_clerk_user_id_unique" UNIQUE("academy_id","clerk_user_id")
);
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "academies" AS PERMISSIVE FOR ALL TO "app_user" USING ("academies"."id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("academies"."id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "memberships" AS PERMISSIVE FOR ALL TO "app_user" USING ("memberships"."academy_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("memberships"."academy_id" = current_setting('app.current_tenant_id', true));