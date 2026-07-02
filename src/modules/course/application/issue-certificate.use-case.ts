import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Certificate } from '../domain/certificate.entity';
import { CertificateNotEarnedError } from '../domain/errors';
import { formatCertificateCode } from '../domain/services/certificate-code.service';
import type { AssessmentRepository } from '../domain/ports/assessment.repository';
import type { AssessmentAttemptRepository } from '../domain/ports/assessment-attempt.repository';
import type { CertificateRepository } from '../domain/ports/certificate.repository';

/** Postgres unique-violation SQLSTATE — 0060X code checked duck-typed, no infra import. */
const UNIQUE_VIOLATION_CODE = '23505';

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === UNIQUE_VIOLATION_CODE;
}

export interface IssueCertificateInput {
  /** Caller-supplied UUID for the new certificate record. */
  id: string;
  courseId: string;
  /**
   * studentName/courseTitle/academyName are USE-CASE inputs, not resolved
   * internally: the Clerk identity and academy display name are only
   * available at the delivery edge (5b), and the course module does not own
   * the academies table — resolving academyName here would be a
   * cross-module boundary violation.
   */
  studentName: string;
  courseTitle: string;
  academyName: string;
}

/**
 * IssueCertificateUseCase
 *
 * Lazy, idempotent, immutable issuance. Inlines the same course→assessment→
 * latest-passed-attempt lookup as GetLatestPassedUseCase (the canonical pass
 * signal), composed here via raw ports rather than importing that use-case:
 * eslint-plugin-boundaries disallows application→application imports even
 * within the same module, so this is the boundaries-clean fallback the
 * design explicitly allows.
 *
 * Flow:
 *   1. findByCourseAndUser — if a certificate already exists, RETURN it
 *      unchanged (no update on a later, possibly higher, score).
 *   2. assessmentRepo.findByCourse + attemptRepo.findLatestPassed — null
 *      means the student has never passed; throw CertificateNotEarnedError
 *      (defense-in-depth pass-gate).
 *   3. Build a Certificate snapshotting score from the passing attempt and
 *      studentName/courseTitle/academyName from the input, derive a
 *      deterministic certificateCode, and persist it.
 *   4. Race safety: unique(course_id, clerk_user_id) may reject a concurrent
 *      insert with a unique-violation — re-read and return the winning row
 *      instead of surfacing the DB error.
 */
export class IssueCertificateUseCase {
  constructor(
    private readonly assessmentRepo: AssessmentRepository,
    private readonly attemptRepo: AssessmentAttemptRepository,
    private readonly certificateRepo: CertificateRepository,
  ) {}

  async execute(ctx: TenantContext, input: IssueCertificateInput): Promise<Certificate> {
    const existing = await this.certificateRepo.findByCourseAndUser(
      ctx,
      input.courseId,
      ctx.userId,
    );
    if (existing) return existing;

    const assessment = await this.assessmentRepo.findByCourse(ctx, input.courseId);
    const passed = assessment
      ? await this.attemptRepo.findLatestPassed(ctx, assessment.id, ctx.userId)
      : null;
    if (!passed) {
      throw new CertificateNotEarnedError(input.courseId, ctx.userId);
    }

    const issuedAt = new Date();
    const certificate = new Certificate({
      id: input.id,
      courseId: input.courseId,
      academyId: ctx.orgId,
      clerkUserId: ctx.userId,
      certificateCode: formatCertificateCode(input.id, issuedAt),
      score: passed.score,
      studentName: input.studentName,
      courseTitle: input.courseTitle,
      academyName: input.academyName,
      issuedAt,
    });

    try {
      await this.certificateRepo.create(ctx, certificate);
    } catch (err) {
      if (isUniqueViolation(err)) {
        const raced = await this.certificateRepo.findByCourseAndUser(
          ctx,
          input.courseId,
          ctx.userId,
        );
        if (raced) return raced;
      }
      throw err;
    }

    return certificate;
  }
}
