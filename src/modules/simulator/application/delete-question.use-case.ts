import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { QuestionRepository } from '../domain/ports/question.repository';

export interface DeleteQuestionInput {
  id: string;
}

/**
 * DeleteQuestionUseCase
 *
 * Hard-deletes a question from its bank. spec.md "Delete question already
 * used in a frozen attempt" is satisfied structurally, not by logic here:
 * `simulator_attempts.frozenQuestions` is a self-contained JSONB snapshot
 * with no FK to this table (Decision 1), so a historical attempt is
 * unaffected — the question is only removed from FUTURE selection pools.
 *
 * Authorization: admin or instructor.
 */
export class DeleteQuestionUseCase {
  constructor(private readonly questionRepo: QuestionRepository) {}

  async execute(ctx: TenantContext, input: DeleteQuestionInput): Promise<void> {
    assertRole(ctx, ['admin', 'instructor']);
    await this.questionRepo.delete(ctx, input.id);
  }
}
