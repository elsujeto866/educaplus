import { JoinRequest } from '../domain/entities/join-request.entity';
import type { JoinRequestSubmissionPort } from '../domain/ports/join-request-submission.port';

/** Postgres unique-violation SQLSTATE — duck-typed check, no infra import. */
const UNIQUE_VIOLATION_CODE = '23505';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { code?: unknown }).code === UNIQUE_VIOLATION_CODE
  );
}

export interface RequestAccessInput {
  /** Caller-supplied UUID for the new join_requests row. */
  id: string;
  /** Resolved server-side from the URL slug (GetPublicAcademyUseCase) — never client input. */
  academyId: string;
  /** Raw email as submitted — normalized (lowercase + trim) by JoinRequest.createPending. */
  email: string;
}

export type RequestAccessResult = { outcome: 'created' } | { outcome: 'already-pending' };

/**
 * RequestAccessUseCase — creates a `pending` JoinRequest for an
 * unauthenticated visitor (spec "Join Request Creation", "Email
 * Normalization", "Duplicate Pending Idempotency").
 *
 * Deliberately takes no TenantContext (public/untenanted path, design D1).
 * Existing-member short-circuit (spec) is OUT OF SCOPE here — deferred to
 * approve-time per design D3 (memberships has no email column); this
 * use-case only handles email validation + duplicate-pending idempotency.
 *
 * Idempotency has TWO layers, because the production Drizzle adapter cannot
 * implement a real pre-check SELECT (academy_public has no SELECT grant on
 * join_requests — see JoinRequestSubmissionPort and
 * drizzle-public-join-request.repository.ts):
 *   1. findPendingByAcademyAndEmail() pre-check — authoritative for test
 *      doubles / in-memory ports; a no-op (always null) on the real adapter.
 *   2. insertPending() unique-violation (23505) catch — the REAL, DB-enforced
 *      guarantee in production, backed by the partial unique index
 *      join_requests_one_pending_idx. Mirrors the established race-safety
 *      pattern used by IssueCertificateUseCase / AddSimulatorToTrackStepUseCase.
 */
export class RequestAccessUseCase {
  constructor(private readonly submissionPort: JoinRequestSubmissionPort) {}

  async execute(input: RequestAccessInput): Promise<RequestAccessResult> {
    const joinRequest = JoinRequest.createPending({
      id: input.id,
      academyId: input.academyId,
      email: input.email,
      createdAt: new Date(),
    });

    const existing = await this.submissionPort.findPendingByAcademyAndEmail(
      input.academyId,
      joinRequest.email,
    );
    if (existing) {
      return { outcome: 'already-pending' };
    }

    try {
      await this.submissionPort.insertPending(joinRequest);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return { outcome: 'already-pending' };
      }
      throw err;
    }

    return { outcome: 'created' };
  }
}
