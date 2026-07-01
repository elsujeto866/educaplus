import { assertRole, UnauthorizedError } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Assessment } from '../domain/assessment.entity';
import { CourseNotFoundError } from '../domain/errors';
import type { AssessmentRepository } from '../domain/ports/assessment.repository';
import type { CourseRepository } from '../domain/ports/course.repository';
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
 *
 * Course-ownership gate: `assessments.course_id` is UNIQUE, so upserting
 * against a course from a foreign academy would squat that course's quiz
 * slot and block its real owner from ever creating one. We verify the
 * course exists AND belongs to the caller's academy (via the tenant-scoped,
 * RLS-backed `CourseRepository.findById`) BEFORE touching the assessment
 * repo — this closes the gap at the application layer instead of relying
 * on RLS/DB constraints alone.
 */
export class UpsertAssessmentUseCase {
  constructor(
    private readonly assessmentRepo: AssessmentRepository,
    private readonly courseRepo: CourseRepository,
  ) {}

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

    // Course-ownership gate — findById is RLS/ctx-scoped, so a nonexistent
    // OR foreign-academy courseId both resolve to null here.
    const course = await this.courseRepo.findById(ctx, input.courseId);
    if (!course) {
      throw new CourseNotFoundError(input.courseId);
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
