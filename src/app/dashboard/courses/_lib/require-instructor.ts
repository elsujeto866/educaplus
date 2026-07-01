import { redirect } from 'next/navigation';
import type { TenantContext } from '@/shared/kernel/tenant-context';

const ALLOWED_ROLES: TenantContext['role'][] = ['admin', 'instructor'];

/**
 * Page-level authoring gate. Every route under `dashboard/courses/**`
 * calls this right after resolving `TenantContext`, BEFORE rendering or
 * reading any data. `redirect()` throws (Next.js control-flow error) so
 * nothing after this call executes when the guard fails.
 */
export function requireInstructor(ctx: TenantContext): void {
  if (!ALLOWED_ROLES.includes(ctx.role)) {
    redirect('/dashboard');
  }
}
