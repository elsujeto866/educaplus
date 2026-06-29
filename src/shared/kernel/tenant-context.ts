/**
 * Shared Kernel — Tenant Context
 *
 * Pure, framework-agnostic cross-cutting types used by every layer:
 * domain ports, use-cases, Clerk auth adapter, middleware, and future modules.
 *
 * Zero imports — this file MUST remain dependency-free so it can be safely
 * consumed without triggering boundary violations.
 */

// ---------------------------------------------------------------------------
// Role
// ---------------------------------------------------------------------------

export type Role = 'admin' | 'instructor' | 'student';

// ---------------------------------------------------------------------------
// TenantContext
// ---------------------------------------------------------------------------

/**
 * Carries the authenticated tenant identity through every use-case and
 * repository call. Produced at the edge (Clerk session or Svix webhook)
 * and threaded explicitly as a first parameter — never via globals.
 */
export interface TenantContext {
  /** Clerk org_id — matches the academies.id primary key and the RLS set_config value. */
  orgId: string;
  /** Clerk user id of the acting user ('system' for webhook-driven provisioning). */
  userId: string;
  /** Business role within the tenant. */
  role: Role;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MissingTenantContextError extends Error {
  constructor(message = 'Tenant context is missing — request must be authenticated with an active org') {
    super(message);
    this.name = 'MissingTenantContextError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Insufficient role for this operation') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Asserts that ctx.role is in the allowed set.
 * Throws UnauthorizedError when the check fails (use-case layer guard).
 */
export function assertRole(ctx: TenantContext, allowed: Role[]): void {
  if (!allowed.includes(ctx.role)) {
    throw new UnauthorizedError(
      `Role '${ctx.role}' is not permitted for this operation. Required: ${allowed.join(' | ')}`,
    );
  }
}
