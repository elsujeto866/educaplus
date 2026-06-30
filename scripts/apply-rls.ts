#!/usr/bin/env tsx
/**
 * apply-rls.ts
 *
 * Applies the two manual RLS SQL files to the database in order:
 *   1. drizzle/0001_rls.sql        -- FORCE RLS + app_user role + grants for academy/membership tables
 *   2. drizzle/0002_course_rls.sql -- FORCE RLS + grants for course tables
 *
 * These files contain DDL that drizzle-kit migrate does NOT emit:
 *   - FORCE ROW LEVEL SECURITY (subjects the table owner to RLS too)
 *   - CREATE ROLE
 *   - GRANT statements
 *
 * Run this AFTER `pnpm db:migrate`. The app_user role is created idempotently
 * in 0001_rls.sql (guarded by a DO block), so re-running is safe.
 *
 * Requirements:
 *   DIRECT_DATABASE_URL or DATABASE_URL must be set to a superuser/owner
 *   connection — FORCE RLS and GRANT require elevated privileges.
 *
 * Usage:
 *   DIRECT_DATABASE_URL=postgresql://postgres:pass@host:5432/db pnpm db:rls
 */

import 'dotenv/config';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const url = process.env['DIRECT_DATABASE_URL'] ?? process.env['DATABASE_URL'];

if (!url) {
  console.error(
    'Error: set DIRECT_DATABASE_URL (or DATABASE_URL) to a superuser connection before running db:rls.',
  );
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });

const files = [
  join(process.cwd(), 'drizzle', '0001_rls.sql'),
  join(process.cwd(), 'drizzle', '0002_course_rls.sql'),
];

async function applyRls(): Promise<void> {
  for (const file of files) {
    const script = readFileSync(file, 'utf-8');
    console.log(`Applying ${file} ...`);
    await sql.unsafe(script);
    console.log(`  OK`);
  }
  console.log('RLS hardening applied successfully.');
  await sql.end();
}

applyRls().catch((err: unknown) => {
  console.error('Failed to apply RLS:', err);
  process.exit(1);
});
