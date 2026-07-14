import { sql } from 'drizzle-orm';
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import { db } from './client';

/**
 * Nominal brand that makes PublicTx incompatible with TenantTx or a plain db
 * handle. Repositories on the public path accept PublicTx — callers cannot
 * fabricate one without going through withPublicRole(), and the branded
 * types keep the public and tenant security paths separate at compile time
 * (design: "Two ports split public-submission vs admin to keep security
 * paths type-separated").
 */
declare const _publicTxBrand: unique symbol;

/**
 * A Drizzle transaction handle running as the `academy_public` Postgres
 * role (via transaction-local `SET LOCAL ROLE`). Obtained exclusively from
 * the `fn` callback inside `withPublicRole`.
 */
export type PublicTx = PostgresJsTransaction<Record<string, never>, Record<string, never>> & {
  readonly [_publicTxBrand]: true;
};

/**
 * Opens a Drizzle transaction and downgrades it to the low-privilege
 * `academy_public` role for the duration of that transaction via
 * `SET LOCAL ROLE` (transaction-local — auto-reverts at commit, PgBouncer
 * transaction-pooler safe), then invokes `fn` with a branded transaction
 * handle.
 *
 * This is the single, mandatory entry point for the PUBLIC (unauthenticated,
 * untenanted) database path — e.g. the /a/[slug] page and the request-access
 * form. It mirrors withTenant()'s single-connection + transaction-local
 * convention, but sets a ROLE instead of a tenant GUC: `academy_public` has
 * no SELECT on join_requests and only column-level SELECT (id, name, slug)
 * on academies, so this path physically cannot read tenant-internal data
 * (design D1 — role-scoped RLS, not an app-only boundary).
 *
 * @param fn - Callback that receives the role-scoped transaction handle.
 */
export async function withPublicRole<T>(fn: (tx: PublicTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE academy_public`);
    return fn(tx as unknown as PublicTx);
  });
}
