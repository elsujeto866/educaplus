import type { Config } from 'drizzle-kit';

export default {
  schema: './src/shared/infrastructure/db/schema/*',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Prefer the direct connection (port 5432, no PgBouncer) for migrations.
    // Fall back to DATABASE_URL so local dev (Docker or direct Postgres) works
    // without setting both variables.
    url: process.env['DIRECT_DATABASE_URL'] ?? process.env['DATABASE_URL'] ?? '',
  },
} satisfies Config;
