import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { QuestionBank } from '../question-bank.entity';

/**
 * Port: QuestionBankRepository
 *
 * Every method receives TenantContext as the first argument — explicit
 * threading, no implicit globals. The Drizzle adapter that implements this
 * interface wraps all DB calls in withTenant() to enforce RLS. Mirrors
 * `modules/course/domain/ports/course.repository.ts`.
 */
export interface QuestionBankRepository {
  create(ctx: TenantContext, bank: QuestionBank): Promise<void>;

  findById(ctx: TenantContext, id: string): Promise<QuestionBank | null>;

  /** Returns all banks for the tenant academy, most recently created first. */
  findByAcademy(ctx: TenantContext, academyId: string): Promise<QuestionBank[]>;

  update(ctx: TenantContext, bank: QuestionBank): Promise<void>;

  delete(ctx: TenantContext, id: string): Promise<void>;

  /**
   * True when at least one `simulators` row references this bank. Queried
   * directly against the `simulators` table — no `SimulatorRepository`
   * exists yet (Simulator authoring ships in Slice S3), so this is the
   * minimal seam DeleteBankUseCase needs to enforce the "cannot delete a
   * bank bound to a simulator" invariant without pulling the whole
   * Simulator domain forward.
   */
  isReferencedBySimulator(ctx: TenantContext, bankId: string): Promise<boolean>;
}
