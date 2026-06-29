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
 */
export const db = drizzle(new Pool({ connectionString: env.DATABASE_URL }));
