/**
 * Integration test DB clients.
 *
 * Two connections are exported:
 *
 *   superuserClient — postgres / postgres (superuser).
 *     Used in global-setup for migrations and seeding, and in negative-gate
 *     tests that need to drop/restore RLS policies. Superusers bypass RLS even
 *     with FORCE ROW LEVEL SECURITY, which is intentional for setup work.
 *
 *   appUserClient — app_user / changeme_before_prod (restricted, NOSUPERUSER NOBYPASSRLS).
 *     Used for every RLS isolation test. Because this role has neither SUPERUSER
 *     nor BYPASSRLS, FORCE ROW LEVEL SECURITY on both tables ensures that all
 *     policies are always evaluated — matching the production connection path.
 *
 * asTenant(orgId, fn) — runs fn inside a transaction with
 *   set_config('app.current_tenant_id', orgId, true) (LOCAL to transaction).
 *   This mirrors what withTenant() does in production, so policies see the
 *   same GUC value.
 */

import postgres from 'postgres';

const SUPERUSER_URL =
  process.env['TEST_SUPERUSER_URL'] ??
  'postgresql://postgres:postgres@localhost:5433/educaplus_test';

const APP_USER_URL =
  process.env['TEST_APP_USER_URL'] ??
  'postgresql://app_user:changeme_before_prod@localhost:5433/educaplus_test';

export const superuserClient = postgres(SUPERUSER_URL, { max: 3, onnotice: () => {} });

/** Restricted non-superuser connection — RLS is enforced on every query. */
export const appUserClient = postgres(APP_USER_URL, { max: 3, onnotice: () => {} });

/**
 * Run fn inside a transaction where app.current_tenant_id is set to orgId
 * for the duration of the transaction (LOCAL scope, cleared on commit/rollback).
 *
 * The cast to Promise<T> is necessary because postgres-js types begin() as
 * returning Promise<UnwrapPromiseArray<T>>, which TypeScript cannot unify with T
 * when the callback already returns Promise<T>. The runtime behavior is correct.
 */
export function asTenant<T>(
  orgId: string,
  fn: (sql: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return appUserClient.begin(async (txSql) => {
    await txSql`SELECT set_config('app.current_tenant_id', ${orgId}, true)`;
    return fn(txSql);
  }) as unknown as Promise<T>;
}

/** Close both connection pools (call in global afterAll). */
export async function closeAll(): Promise<void> {
  await appUserClient.end();
  await superuserClient.end();
}
