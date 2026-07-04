import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Question, type QuestionOption } from '../domain/question.entity';
import type { Difficulty } from '../domain/value-objects/difficulty.vo';
import { QuestionNotFoundError } from '../domain/errors';
import type { QuestionRepository } from '../domain/ports/question.repository';

export interface UpdateQuestionInput {
  id: string;
  prompt?: string;
  options?: QuestionOption[];
  correctOptionId?: string;
  topic?: string | null;
  difficulty?: Difficulty | null;
  explanation?: string | null;
}

/**
 * UpdateQuestionUseCase
 *
 * Updates one or more fields of an existing question. Re-runs the full
 * `Question` entity validation on the merged result (spec.md "Missing
 * correct answer rejected" also applies to edits, not just creation), so an
 * edit that removes the correct option — or changes options without
 * updating correctOptionId to match — is rejected the same way creation is.
 * Mirrors `UpdateCourseUseCase`.
 *
 * Authorization: admin or instructor.
 */
export class UpdateQuestionUseCase {
  constructor(private readonly questionRepo: QuestionRepository) {}

  async execute(ctx: TenantContext, input: UpdateQuestionInput): Promise<Question> {
    assertRole(ctx, ['admin', 'instructor']);

    const existing = await this.questionRepo.findById(ctx, input.id);
    if (!existing) throw new QuestionNotFoundError(input.id);

    const updated = new Question({
      ...existing,
      prompt: input.prompt ?? existing.prompt,
      options: input.options ?? existing.options,
      correctOptionId: input.correctOptionId ?? existing.correctOptionId,
      topic: input.topic !== undefined ? input.topic : existing.topic,
      difficulty: input.difficulty !== undefined ? input.difficulty : existing.difficulty,
      explanation: input.explanation !== undefined ? input.explanation : existing.explanation,
      updatedAt: new Date(),
    });

    await this.questionRepo.update(ctx, updated);
    return updated;
  }
}
