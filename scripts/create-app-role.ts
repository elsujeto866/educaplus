import 'dotenv/config';
import postgres from 'postgres';

/**
 * create-app-role.ts
 *
 * Creates the restricted `app_user` role IF it does not already exist.
 *
 * WHY THIS RUNS BEFORE `db:migrate`:
 *   The Drizzle-generated migrations create RLS policies with `TO app_user`.
 *   Postgres requires the role to exist when `CREATE POLICY ... TO app_user`
 *   runs, so the role MUST exist before `pnpm db:migrate`. (The test harness
 *   masks this because it seeds the role first.)
 *
 * The role is created with a PLACEHOLDER password. Set a real one before
 * production with:  ALTER ROLE app_user PASSWORD '<strong-random>';
 *
 * Requires DIRECT_DATABASE_URL (or DATABASE_URL) pointing at a superuser/owner
 * connection (CREATE ROLE needs elevated privileges).
 */

const url = process.env['DIRECT_DATABASE_URL'] ?? process.env['DATABASE_URL'];
if (!url) {
  console.error('Error: set DIRECT_DATABASE_URL (or DATABASE_URL) before running db:role.');
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });

async function main(): Promise<void> {
  await sql.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user LOGIN PASSWORD 'changeme_before_prod'
          NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
      END IF;
    END
    $$;
  `);
  console.log('app_user role ensured. Set a real password before prod: ALTER ROLE app_user PASSWORD ...');
  await sql.end();
}

main().catch((e: unknown) => {
  console.error('Failed to create app_user role:', (e as Error).message);
  process.exit(1);
});
