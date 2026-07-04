import type { TenantContext } from '@/shared/kernel/tenant-context';
import { formatCertificateCode } from '@/shared/kernel/certificate-code';
import { SimulatorCertificate } from '../domain/simulator-certificate.entity';
import { SimulatorCertificateNotEarnedError, SimulatorCertificateNotConfiguredError } from '../domain/errors';
import type { SimulatorAttemptRepository } from '../domain/ports/simulator-attempt.repository';
import type { SimulatorCertificateRepository } from '../domain/ports/simulator-certificate.repository';

/** Postgres unique-violation SQLSTATE — 0060X code checked duck-typed, no infra import. */
const UNIQUE_VIOLATION_CODE = '23505';

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === UNIQUE_VIOLATION_CODE;
}

export interface IssueSimulatorCertificateInput {
  /** Caller-supplied UUID for the new certificate record. */
  id: string;
  simulatorId: string;
  /**
   * studentName/simulatorTitle/academyName are USE-CASE inputs, not resolved
   * internally: the Clerk identity and academy display name are only
   * available at the delivery edge, and this use-case must not reach across
   * module boundaries to resolve them (mirrors
   * `IssueCertificateUseCase`'s `IssueCertificateInput` shape).
   */
  studentName: string;
  simulatorTitle: string;
  academyName: string;
  /**
   * Snapshot of `simulator.issuesCertificate` at call time (Slice S6 —
   * spec.md "Certificate on first pass (optional per simulator)"). Passed
   * in rather than re-fetched via a SimulatorRepository, for the SAME
   * reason `simulatorTitle` is an input above: the caller already resolved
   * the simulator at the delivery edge before reaching this use-case.
   */
  issuesCertificate: boolean;
}

/**
 * IssueSimulatorCertificateUseCase — mirrors `IssueCertificateUseCase`
 * verbatim (design Decision 8), but SIMPLER: since
 * `SimulatorAttemptRepository.findLatestPassed` is already keyed directly
 * on `simulatorId` (no course→assessment indirection needed), there is no
 * extra lookup step.
 *
 * Lazy, idempotent, immutable issuance, first-pass-wins:
 *   1. findBySimulatorAndUser (scoped to ctx.userId, NEVER an
 *      input-supplied user — this is the OWNER-ONLY guarantee) — if a
 *      certificate already exists, RETURN it unchanged (no update on a
 *      later, possibly higher, score. Passing twice never re-issues, and a
 *      simulator's issuesCertificate toggle being flipped off AFTER a
 *      certificate was already issued never hides it — immutability wins).
 *   2. issuesCertificate gate (Slice S6) — if the simulator is configured
 *      NOT to issue certificates, throw SimulatorCertificateNotConfiguredError
 *      BEFORE consulting the pass-gate (cheap short-circuit, no wasted read).
 *   3. attemptRepo.findLatestPassed — null means the caller has never
 *      passed this simulator; throw SimulatorCertificateNotEarnedError
 *      (defense-in-depth pass-gate).
 *   4. Build a SimulatorCertificate snapshotting score from the passing
 *      attempt and studentName/simulatorTitle/academyName from the input,
 *      derive a deterministic certificateCode, and persist it.
 *   5. Race safety: unique(simulator_id, clerk_user_id) may reject a
 *      concurrent insert with a unique-violation — re-read and return the
 *      winning row instead of surfacing the DB error.
 */
export class IssueSimulatorCertificateUseCase {
  constructor(
    private readonly attemptRepo: SimulatorAttemptRepository,
    private readonly certificateRepo: SimulatorCertificateRepository,
  ) {}

  async execute(
    ctx: TenantContext,
    input: IssueSimulatorCertificateInput,
  ): Promise<SimulatorCertificate> {
    const existing = await this.certificateRepo.findBySimulatorAndUser(
      ctx,
      input.simulatorId,
      ctx.userId,
    );
    if (existing) return existing;

    if (!input.issuesCertificate) {
      throw new SimulatorCertificateNotConfiguredError(input.simulatorId);
    }

    const passed = await this.attemptRepo.findLatestPassed(ctx, input.simulatorId, ctx.userId);
    if (!passed) {
      throw new SimulatorCertificateNotEarnedError(input.simulatorId, ctx.userId);
    }

    const issuedAt = new Date();
    const certificate = new SimulatorCertificate({
      id: input.id,
      simulatorId: input.simulatorId,
      academyId: ctx.orgId,
      clerkUserId: ctx.userId,
      certificateCode: formatCertificateCode(input.id, issuedAt),
      score: passed.score as number,
      studentName: input.studentName,
      simulatorTitle: input.simulatorTitle,
      academyName: input.academyName,
      issuedAt,
    });

    try {
      await this.certificateRepo.create(ctx, certificate);
    } catch (err) {
      if (isUniqueViolation(err)) {
        const raced = await this.certificateRepo.findBySimulatorAndUser(
          ctx,
          input.simulatorId,
          ctx.userId,
        );
        if (raced) return raced;
      }
      throw err;
    }

    return certificate;
  }
}
