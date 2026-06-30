/**
 * Vitest global-setup for the integration project.
 *
 * Runs once before any integration test file. Steps:
 *   1. Wait for the Postgres container to accept connections.
 *   2. Clean slate — drop tables so the setup is idempotent across re-runs.
 *   3. Create app_user role (NOSUPERUSER NOBYPASSRLS) if it does not exist yet.
 *      This must happen BEFORE the 0000 migration because that migration
 *      contains CREATE POLICY … TO "app_user", which requires the role to exist.
 *   4. Apply drizzle migration 0000 (tables + ENABLE RLS + policies).
 *   5. Apply manual migration 0001 (GRANT, ALTER TABLE … FORCE ROW LEVEL SECURITY).
 *   6. Seed academies org_A / org_B and one membership each (superuser bypasses
 *      RLS here, which is intentional — FORCE RLS applies to the owner but NOT
 *      to superusers, so seeds flow through without tenant context).
 *
 * Returns a teardown function (no-op — the container is torn down externally).
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

const SUPERUSER_URL =
  process.env['TEST_SUPERUSER_URL'] ??
  'postgresql://postgres:postgres@localhost:5433/educaplus_test';

const DRIZZLE_DIR = join(process.cwd(), 'drizzle');

async function waitForDb(url: string, maxAttempts = 30, delayMs = 1000): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    let probe: postgres.Sql | null = null;
    try {
      probe = postgres(url, { max: 1, connect_timeout: 2, onnotice: () => {} });
      await probe`SELECT 1`;
      await probe.end();
      return;
    } catch {
      if (probe) {
        try {
          await probe.end({ timeout: 1 });
        } catch {
          // ignore end errors
        }
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error(`Postgres not ready after ${maxAttempts} attempts at ${url}`);
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  await waitForDb(SUPERUSER_URL);

  const sql = postgres(SUPERUSER_URL, { max: 1, onnotice: () => {} });

  try {
    // 1. Clean slate — idempotent for re-runs without restarting the container.
    await sql.unsafe('DROP TABLE IF EXISTS memberships CASCADE');
    await sql.unsafe('DROP TABLE IF EXISTS academies CASCADE');

    // 2. Create restricted app_user role before migration (policies reference it).
    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
          CREATE ROLE app_user
            LOGIN
            PASSWORD 'changeme_before_prod'
            NOSUPERUSER
            NOBYPASSRLS
            NOCREATEDB
            NOCREATEROLE;
        END IF;
      END
      $$
    `);

    // 3. Apply 0000 migration — split on Drizzle's statement-breakpoint marker.
    const raw0000 = readFileSync(join(DRIZZLE_DIR, '0000_living_jetstream.sql'), 'utf-8');
    const stmts0000 = raw0000
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of stmts0000) {
      await sql.unsafe(stmt);
    }

    // 4. Apply 0001 migration — GRANT privileges + FORCE ROW LEVEL SECURITY.
    //    The DO block inside 0001 is idempotent (skips if role already exists).
    const raw0001 = readFileSync(join(DRIZZLE_DIR, '0001_rls.sql'), 'utf-8');
    await sql.unsafe(raw0001);

    // 5. Seed two academies and one membership each.
    //    Superuser bypasses RLS (FORCE RLS subjects owner but NOT superuser),
    //    so no set_config call is needed here.
    await sql`
      INSERT INTO academies (id, name, slug)
      VALUES
        ('org_A', 'Academy A', 'academy-a'),
        ('org_B', 'Academy B', 'academy-b')
      ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO memberships (academy_id, clerk_user_id, role)
      VALUES
        ('org_A', 'user_A1', 'admin'),
        ('org_B', 'user_B1', 'student')
      ON CONFLICT (academy_id, clerk_user_id) DO NOTHING
    `;
  } finally {
    await sql.end();
  }

  return async () => {
    // Container is torn down externally via `docker compose -f docker-compose.test.yml down -v`.
    // Nothing to clean up here.
  };
}
