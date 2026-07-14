/**
 * Academy domain errors.
 *
 * These are domain-layer invariant violations — not HTTP or infrastructure
 * errors. Use-cases and entities throw these; delivery/infra layers map them
 * to appropriate HTTP responses or log entries.
 *
 * Pure TS — zero imports.
 */

export class InvalidJoinRequestError extends Error {
  constructor(reason: string) {
    super(`Invalid join request: ${reason}`);
    this.name = 'InvalidJoinRequestError';
  }
}

/**
 * Thrown by JoinRequest.approve()/reject() when the request is no longer
 * `pending` (spec "Approve/Reject already-resolved request rejected") —
 * enforces the "no double-resolve" invariant at the entity level.
 */
export class JoinRequestAlreadyResolvedError extends Error {
  constructor(id: string) {
    super(`Join request "${id}" has already been resolved and cannot be resolved again`);
    this.name = 'JoinRequestAlreadyResolvedError';
  }
}

/**
 * Thrown by JoinRequest.fulfill() when called on a request that is not
 * `approved` (reconciliation, Phase 4, can only fulfill approved requests).
 */
export class JoinRequestNotApprovedError extends Error {
  constructor(id: string) {
    super(`Join request "${id}" is not approved and cannot be fulfilled`);
    this.name = 'JoinRequestNotApprovedError';
  }
}

/**
 * Thrown by ApproveJoinRequestUseCase/RejectJoinRequestUseCase (Phase 3)
 * when `id` does not resolve to a JoinRequest in the caller's own academy
 * (RLS/tenant scoping means a cross-tenant id looks identical to an
 * unknown one — never a distinguishable "forbidden" case).
 */
export class JoinRequestNotFoundError extends Error {
  constructor(id: string) {
    super(`Join request "${id}" was not found`);
    this.name = 'JoinRequestNotFoundError';
  }
}
