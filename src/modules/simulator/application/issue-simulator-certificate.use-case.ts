import type { TenantContext } from '@/shared/kernel/tenant-context';
import { formatCertificateCode } from '@/shared/kernel/certificate-code';
import { SimulatorCertificate } from '../domain/simulator-certificate.entity';
import { SimulatorCertificateNotEarnedError } from '../domain/errors';
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
 *      later, possibly higher, score. Passing twice never re-issues).
 *   2. attemptRepo.findLatestPassed — null means the caller has never
 *      passed this simulator; throw SimulatorCertificateNotEarnedError
 *      (defense-in-depth pass-gate).
 *   3. Build a SimulatorCertificate snapshotting score from the passing
 *      attempt and studentName/simulatorTitle/academyName from the input,
 *      derive a deterministic certificateCode, and persist it.
 *   4. Race safety: unique(simulator_id, clerk_user_id) may reject a
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
