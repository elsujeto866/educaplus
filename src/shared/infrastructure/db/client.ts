import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '@/config/env';

/**
 * Drizzle database client backed by postgres-js (Supabase-compatible).
 *
 * Connects to the Supabase transaction pooler (port 6543) via DATABASE_URL.
 * { prepare: false } is required because the Supabase transaction pooler
 * (PgBouncer in transaction mode) does not support prepared statements.
 *
 * All tenant-scoped queries MUST go through withTenant() in ./with-tenant.ts,
 * never directly through this `db` instance — that is the only RLS-safe path.
 *
 * LAZY INITIALIZATION: the postgres client and drizzle instance are created on
 * first property access, not at module evaluation time. This keeps `next build`
 * safe when env vars are not present (e.g. CI build without live credentials),
 * while still failing loudly at runtime when DATABASE_URL is actually needed.
 */
function makeDb() {
  const client = postgres(env.DATABASE_URL, { prepare: false });
  return drizzle({ client });
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
