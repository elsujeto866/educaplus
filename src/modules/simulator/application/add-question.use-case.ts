import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Question, type QuestionOption } from '../domain/question.entity';
import type { Difficulty } from '../domain/value-objects/difficulty.vo';
import type { QuestionRepository } from '../domain/ports/question.repository';

export interface AddQuestionInput {
  /** Caller-supplied UUID for the new question. */
  id: string;
  bankId: string;
  academyId: string;
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string;
  topic?: string | null;
  difficulty?: Difficulty | null;
  explanation?: string | null;
}

/**
 * AddQuestionUseCase
 *
 * Creates a new question at position = count + 1. All invariants (≥2
 * options, unique option ids, correctOptionId must reference an existing
 * option — spec.md "Missing correct answer rejected") are enforced by the
 * `Question` entity constructor; this use-case only orchestrates position
 * assignment and persistence. Mirrors `AddLessonUseCase`.
 *
 * Authorization: admin or instructor.
 */
export class AddQuestionUseCase {
  constructor(private readonly questionRepo: QuestionRepository) {}

  async execute(ctx: TenantContext, input: AddQuestionInput): Promise<Question> {
    assertRole(ctx, ['admin', 'instructor']);

    const count = await this.questionRepo.countByBank(ctx, input.bankId);

    const now = new Date();
    const question = new Question({
      id: input.id,
      bankId: input.bankId,
      academyId: input.academyId,
      prompt: input.prompt,
      options: input.options,
      correctOptionId: input.correctOptionId,
      topic: input.topic ?? null,
      difficulty: input.difficulty ?? null,
      explanation: input.explanation ?? null,
      position: count + 1,
      createdAt: now,
      updatedAt: now,
    });

    await this.questionRepo.create(ctx, question);
    return question;
  }
}
