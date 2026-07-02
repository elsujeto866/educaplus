import type { TenantContext } from '@/shared/kernel/tenant-context';
import { AssessmentAttempt } from '../domain/assessment-attempt.entity';
import type { SubmittedAnswer } from '../domain/assessment-attempt.entity';
import { CourseNotFoundError, LearnerNotEnrolledError } from '../domain/errors';
import type { AssessmentRepository } from '../domain/ports/assessment.repository';
import type { EnrollmentRepository } from '../domain/ports/enrollment.repository';
import type { AssessmentAttemptRepository } from '../domain/ports/assessment-attempt.repository';
import { assertAnswersValid, score } from '../domain/services/quiz-scoring.service';

export interface SubmitAttemptInput {
  /** Caller-supplied UUID for the new attempt record. */
  id: string;
  courseId: string;
  answers: SubmittedAnswer[];
}

export interface SubmitAttemptResult {
  score: number;
  passed: boolean;
}

/**
 * SubmitAttemptUseCase
 *
 * Input is keyed on courseId (not assessmentId) — the UI holds courseId,
 * and one findByCourse call gives both the assessment and the courseId
 * needed for the enrollment check.
 *
 * Flow: resolve the course's assessment → enrollment gate (BEFORE any
 * persistence, and before answer validation/scoring) → validate answers →
 * score → persist → return {score, passed}.
 *
 * No assertRole guard — students self-attempt; enrollment IS the gate.
 * Unlimited retakes: attemptRepo.create never conflicts (no unique
 * constraint on assessmentId+clerkUserId) — every submission is a new row.
 */
export class SubmitAttemptUseCase {
  constructor(
    private readonly assessmentRepo: AssessmentRepository,
    private readonly enrollmentRepo: EnrollmentRepository,
    private readonly attemptRepo: AssessmentAttemptRepository,
  ) {}

  async execute(ctx: TenantContext, input: SubmitAttemptInput): Promise<SubmitAttemptResult> {
    const assessment = await this.assessmentRepo.findByCourse(ctx, input.courseId);
    if (!assessment) {
      throw new CourseNotFoundError(input.courseId);
    }

    const isEnrolled = await this.enrollmentRepo.existsByCourseAndUser(
      ctx,
      input.courseId,
      ctx.userId,
    );
    if (!isEnrolled) {
      throw new LearnerNotEnrolledError(input.courseId, ctx.userId);
    }

    assertAnswersValid(assessment, input.answers);
    const result = score(assessment, input.answers);

    const attempt = new AssessmentAttempt({
      id: input.id,
      assessmentId: assessment.id,
      academyId: ctx.orgId,
      clerkUserId: ctx.userId,
      answers: input.answers,
      score: result.score,
      passed: result.passed,
      createdAt: new Date(),
    });

    await this.attemptRepo.create(ctx, attempt);
    return result;
  }
}
