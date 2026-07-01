import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { AssessmentRepository } from '../domain/ports/assessment.repository';
import type { QuizQuestion } from '../domain/value-objects/quiz-question.vo';

export interface AssessmentView {
  id: string;
  courseId: string;
  title: string;
  questions: QuizQuestion[];
}

/**
 * GetAssessmentUseCase — reads the final quiz for a course (prefill for the
 * quiz builder, and the source of truth for the wizard's `hasQuiz` derivation).
 *
 * Read-only: no `assertRole` guard — page-level gating decides who may reach
 * this use-case. Reuses the existing AssessmentRepository.findByCourse
 * (already RLS/ctx-scoped) — no new repository method needed.
 */
export class GetAssessmentUseCase {
  constructor(private readonly assessmentRepo: AssessmentRepository) {}

  async execute(ctx: TenantContext, courseId: string): Promise<AssessmentView | null> {
    const assessment = await this.assessmentRepo.findByCourse(ctx, courseId);
    if (!assessment) return null;

    return {
      id: assessment.id,
      courseId: assessment.courseId,
      title: assessment.title,
      questions: assessment.questions,
    };
  }
}
