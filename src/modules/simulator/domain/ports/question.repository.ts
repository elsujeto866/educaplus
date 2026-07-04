import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Question } from '../question.entity';

/**
 * Port: QuestionRepository
 *
 * Every method receives TenantContext as the first argument — explicit
 * threading, no implicit globals. The Drizzle adapter that implements this
 * interface wraps all DB calls in withTenant() to enforce RLS. Mirrors
 * `modules/course/domain/ports/lesson.repository.ts`'s
 * count-then-append-position convention.
 */
export interface QuestionRepository {
  create(ctx: TenantContext, question: Question): Promise<void>;

  findById(ctx: TenantContext, id: string): Promise<Question | null>;

  /** Returns questions for a bank, ordered by position. */
  findByBank(ctx: TenantContext, bankId: string): Promise<Question[]>;

  update(ctx: TenantContext, question: Question): Promise<void>;

  /**
   * Deletes the question row. Does NOT affect any `simulator_attempts`
   * snapshot — `frozenQuestions` is a self-contained JSONB copy with no FK
   * back to this table (Decision 1: snapshot column, not a join table).
   */
  delete(ctx: TenantContext, id: string): Promise<void>;

  /** Count of questions in a bank — used to assign position = count + 1 on creation. */
  countByBank(ctx: TenantContext, bankId: string): Promise<number>;
}
