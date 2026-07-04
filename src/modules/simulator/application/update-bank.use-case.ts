import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { QuestionBank } from '../domain/question-bank.entity';
import { QuestionBankNotFoundError } from '../domain/errors';
import type { QuestionBankRepository } from '../domain/ports/question-bank.repository';

export interface UpdateBankInput {
  id: string;
  title?: string;
  description?: string | null;
}

/**
 * UpdateBankUseCase
 *
 * Renames a bank and/or updates its description. Mirrors `UpdateCourseUseCase`
 * minus the slug-conflict check (banks have no slug).
 *
 * Authorization: admin or instructor.
 */
export class UpdateBankUseCase {
  constructor(private readonly bankRepo: QuestionBankRepository) {}

  async execute(ctx: TenantContext, input: UpdateBankInput): Promise<QuestionBank> {
    assertRole(ctx, ['admin', 'instructor']);

    const existing = await this.bankRepo.findById(ctx, input.id);
    if (!existing) throw new QuestionBankNotFoundError(input.id);

    const updated = new QuestionBank({
      ...existing,
      title: input.title ?? existing.title,
      description: input.description !== undefined ? input.description : existing.description,
      updatedAt: new Date(),
    });

    await this.bankRepo.update(ctx, updated);
    return updated;
  }
}
