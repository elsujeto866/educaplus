import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { env } from '@/config/env';

/**
 * Drizzle database client backed by @neondatabase/serverless Pool (WebSocket).
 *
 * neon-http was replaced by neon-serverless because `db.transaction()` requires
 * a persistent connection — neon-http is stateless and cannot support the
 * transaction-local set_config('app.current_tenant_id', ...) needed for RLS.
 *
 * All tenant-scoped queries MUST go through withTenant() in ./with-tenant.ts,
 * never directly through this `db` instance — that is the only RLS-safe path.
 *
 * LAZY INITIALIZATION: the Pool and drizzle instance are created on first
 * property access, not at module evaluation time. This keeps `next build` safe
 * when env vars are not present (e.g. CI build without live credentials), while
 * still failing loudly at runtime when DATABASE_URL is actually needed.
 */
function makeDb() {
  return drizzle(new Pool({ connectionString: env.DATABASE_URL }));
}

type Db = ReturnType<typeof makeDb>;

let _db: Db | undefined;

function getInstance(): Db {
  if (!_db) {
    _db = makeDb();
  }
  return _db;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop: PropertyKey) {
    return getInstance()[prop as keyof Db];
  },
});
