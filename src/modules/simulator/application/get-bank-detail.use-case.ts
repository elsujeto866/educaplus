import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { QuestionBank } from '../domain/question-bank.entity';
import type { Question } from '../domain/question.entity';
import type { QuestionBankRepository } from '../domain/ports/question-bank.repository';
import type { QuestionRepository } from '../domain/ports/question.repository';

export interface BankDetailView {
  bank: QuestionBank;
  questions: Question[];
}

/**
 * GetBankDetailUseCase — reads a single bank's full authoring view model:
 * the bank plus its questions (ordered by position).
 *
 * Read-only: no `assertRole` guard — page-level gating decides who may reach
 * this use-case. Returns `null` when the bank does not exist OR belongs to a
 * different tenant (bankRepo.findById is already RLS/ctx-scoped) — this is
 * the single not-found/cross-tenant path, no data leak. Mirrors
 * `GetCourseDetailUseCase`.
 */
export class GetBankDetailUseCase {
  constructor(
    private readonly bankRepo: QuestionBankRepository,
    private readonly questionRepo: QuestionRepository,
  ) {}

  async execute(ctx: TenantContext, bankId: string): Promise<BankDetailView | null> {
    const bank = await this.bankRepo.findById(ctx, bankId);
    if (!bank) return null;

    const questions = await this.questionRepo.findByBank(ctx, bankId);
    return { bank, questions };
  }
}
