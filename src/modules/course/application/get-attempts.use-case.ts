import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { AssessmentAttempt } from '../domain/assessment-attempt.entity';
import type { AssessmentRepository } from '../domain/ports/assessment.repository';
import type { AssessmentAttemptRepository } from '../domain/ports/assessment-attempt.repository';

/**
 * GetAttemptsUseCase — lists every attempt the caller has made on a course's
 * final quiz, newest first.
 *
 * Read-only: no assertRole guard. Resolves courseId → assessment via the
 * existing AssessmentRepository.findByCourse (already RLS/ctx-scoped), then
 * queries the attempt repo keyed on assessmentId + the caller's clerkUserId.
 * A course with no assessment yet has no attempts by definition — returns [].
 */
export class GetAttemptsUseCase {
  constructor(
    private readonly assessmentRepo: AssessmentRepository,
    private readonly attemptRepo: AssessmentAttemptRepository,
  ) {}

  async execute(ctx: TenantContext, courseId: string): Promise<AssessmentAttempt[]> {
    const assessment = await this.assessmentRepo.findByCourse(ctx, courseId);
    if (!assessment) return [];

    return this.attemptRepo.findByUserAndAssessment(ctx, assessment.id, ctx.userId);
  }
}

/**
 * GetLatestPassedUseCase — the caller's most recent passing attempt on a
 * course's final quiz, or null if they have never passed. Sufficient for
 * Slice 5 certificate-issuance keying.
 */
export class GetLatestPassedUseCase {
  constructor(
    private readonly assessmentRepo: AssessmentRepository,
    private readonly attemptRepo: AssessmentAttemptRepository,
  ) {}

  async execute(ctx: TenantContext, courseId: string): Promise<AssessmentAttempt | null> {
    const assessment = await this.assessmentRepo.findByCourse(ctx, courseId);
    if (!assessment) return null;

    return this.attemptRepo.findLatestPassed(ctx, assessment.id, ctx.userId);
  }
}
