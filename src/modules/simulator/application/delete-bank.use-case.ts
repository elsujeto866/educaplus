import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { QuestionBankInUseError } from '../domain/errors';
import type { QuestionBankRepository } from '../domain/ports/question-bank.repository';

export interface DeleteBankInput {
  id: string;
}

/**
 * DeleteBankUseCase
 *
 * Hard-deletes a bank (and its questions, via CASCADE) UNLESS it is bound to
 * at least one simulator (spec.md "Delete bank referenced by a simulator").
 * The FK is `onDelete=CASCADE` for academy-teardown purposes (Decision 1) —
 * this in-use guard is enforced here, at the use-case level, instead.
 *
 * Authorization: admin or instructor.
 */
export class DeleteBankUseCase {
  constructor(private readonly bankRepo: QuestionBankRepository) {}

  async execute(ctx: TenantContext, input: DeleteBankInput): Promise<void> {
    assertRole(ctx, ['admin', 'instructor']);

    const inUse = await this.bankRepo.isReferencedBySimulator(ctx, input.id);
    if (inUse) throw new QuestionBankInUseError(input.id);

    await this.bankRepo.delete(ctx, input.id);
  }
}
