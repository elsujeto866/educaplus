import { redirect } from 'next/navigation';
import type { TenantContext } from '@/shared/kernel/tenant-context';

const ALLOWED_ROLES: TenantContext['role'][] = ['admin', 'instructor'];

/**
 * Page-level authoring gate. `dashboard/requests` calls this right after
 * resolving `TenantContext`, BEFORE rendering or reading any data.
 * `redirect()` throws (Next.js control-flow error) so nothing after this
 * call executes when the guard fails. Mirrors
 * `courses/_lib/require-instructor.ts` / `simulators/_lib/require-instructor.ts`
 * (spec "Student role denied").
 */
export function requireInstructor(ctx: TenantContext): void {
  if (!ALLOWED_ROLES.includes(ctx.role)) {
    redirect('/dashboard');
  }
}
