import { assertRole, UnauthorizedError } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Assessment } from '../domain/assessment.entity';
import type { AssessmentRepository } from '../domain/ports/assessment.repository';
import { QuizQuestionFactory } from '../domain/value-objects/quiz-question.vo';
import type { RawQuizQuestion } from '../domain/value-objects/quiz-question.vo';

export interface UpsertAssessmentInput {
  /** Caller-supplied UUID for the assessment record. */
  id: string;
  courseId: string;
  academyId: string;
  title: string;
  /** Raw question payloads — validated via QuizQuestionFactory.create before persisting. */
  questions: RawQuizQuestion[];
}

/**
 * UpsertAssessmentUseCase
 *
 * Creates or replaces the final quiz for a course. The unique (course_id)
 * constraint means each course has at most one assessment — this is
 * create-or-REPLACE semantics, not a duplicate-guard.
 *
 * Empty `questions: []` is a valid draft state at this authoring layer.
 *
 * Authorization: admin or instructor.
 */
export class UpsertAssessmentUseCase {
  constructor(private readonly assessmentRepo: AssessmentRepository) {}

  async execute(
    ctx: TenantContext,
    input: UpsertAssessmentInput,
  ): Promise<Assessment> {
    assertRole(ctx, ['admin', 'instructor']);

    // Defense-in-depth: RLS WITH CHECK already blocks cross-tenant writes at
    // the DB layer, but we assert the tenant scope here too so a mismatched
    // academyId is rejected before any repository/DB round-trip.
    if (input.academyId !== ctx.orgId) {
      throw new UnauthorizedError(
        `Cannot upsert an assessment for academyId '${input.academyId}' from tenant context '${ctx.orgId}'`,
      );
    }

    const questions = input.questions.map((raw) => QuizQuestionFactory.create(raw));

    const now = new Date();
    const assessment = new Assessment({
      id: input.id,
      courseId: input.courseId,
      academyId: input.academyId,
      title: input.title,
      questions,
      createdAt: now,
      updatedAt: now,
    });

    await this.assessmentRepo.upsert(ctx, assessment);
    return assessment;
  }
}
