import { sql } from 'drizzle-orm';
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import { db } from './client';
import type { TenantContext } from '@/shared/kernel/tenant-context';

/**
 * Nominal brand that makes TenantTx incompatible with a plain db handle.
 * Repositories accept TenantTx — callers cannot fabricate one without going
 * through withTenant(), making the RLS-safe path the ONLY path.
 */
declare const _tenantTxBrand: unique symbol;

/**
 * A Drizzle transaction handle that has been set up with the tenant config.
 * Obtained exclusively from the `fn` callback inside `withTenant`.
 *
 * Uses PostgresJsTransaction directly (the concrete type from drizzle-orm/postgres-js)
 * to avoid conditional-type inference over a generic method, which resolves to
 * `never` in TypeScript strict mode.
 *
 * The brand prevents passing a raw transaction or the `db` handle directly —
 * callers must go through withTenant().
 */
export type TenantTx = PostgresJsTransaction<Record<string, never>, Record<string, never>> & {
  readonly [_tenantTxBrand]: true;
};

/**
 * Opens a Drizzle transaction, sets `app.current_tenant_id` for the duration
 * of that transaction (Postgres RLS reads this via `current_setting`), then
 * invokes `fn` with a branded transaction handle.
 *
 * This is the single, mandatory entry point for all tenant-scoped DB access.
 * Repositories must not use `db` directly for tables protected by RLS.
 *
 * @param ctx  - Verified TenantContext produced at the edge (Clerk / Svix).
 * @param fn   - Callback that receives the RLS-scoped transaction handle.
 */
export async function withTenant<T>(
  ctx: TenantContext,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_tenant_id', ${ctx.orgId}, true)`,
    );
    return fn(tx as unknown as TenantTx);
  });
}
