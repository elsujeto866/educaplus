ALTER TABLE "assessments" ADD COLUMN "passing_score" integer DEFAULT 70 NOT NULL;--> statement-breakpoint
-- ADD COLUMN does not drop FORCE ROW LEVEL SECURITY or the tenant_isolation
-- policy (both are unaffected by a column ALTER), but we re-assert FORCE as
-- cheap insurance — verified by pnpm test:rls (assessment-isolation.spec.ts).
ALTER TABLE "assessments" FORCE ROW LEVEL SECURITY;