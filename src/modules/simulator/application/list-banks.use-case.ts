import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { QuestionBank } from '../domain/question-bank.entity';
import type { QuestionBankRepository } from '../domain/ports/question-bank.repository';

/**
 * ListBanksUseCase — reads the tenant-scoped question bank list.
 *
 * Read-only: no `assertRole` guard — page-level gating (requireInstructor)
 * decides who may reach this use-case. Mirrors `ListCoursesUseCase`.
 */
export class ListBanksUseCase {
  constructor(private readonly bankRepo: QuestionBankRepository) {}

  async execute(ctx: TenantContext): Promise<QuestionBank[]> {
    return this.bankRepo.findByAcademy(ctx, ctx.orgId);
  }
}
