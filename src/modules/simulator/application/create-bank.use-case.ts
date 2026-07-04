import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { QuestionBank } from '../domain/question-bank.entity';
import type { QuestionBankRepository } from '../domain/ports/question-bank.repository';

export interface CreateBankInput {
  /** Caller-supplied UUID for the new bank. */
  id: string;
  academyId: string;
  title: string;
  description?: string | null;
}

/**
 * CreateBankUseCase
 *
 * Persists a new, empty question bank scoped to the caller's academy.
 * Mirrors `CreateCourseUseCase` minus the slug concept — banks have no
 * public/student-facing URL.
 *
 * Authorization: admin or instructor.
 */
export class CreateBankUseCase {
  constructor(private readonly bankRepo: QuestionBankRepository) {}

  async execute(ctx: TenantContext, input: CreateBankInput): Promise<QuestionBank> {
    assertRole(ctx, ['admin', 'instructor']);

    const now = new Date();
    const bank = new QuestionBank({
      id: input.id,
      academyId: input.academyId,
      title: input.title,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
    });

    await this.bankRepo.create(ctx, bank);
    return bank;
  }
}
