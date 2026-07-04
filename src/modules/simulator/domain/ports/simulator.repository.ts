import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Simulator } from '../simulator.entity';

/**
 * Port: SimulatorRepository
 *
 * Every method receives TenantContext as the first argument — explicit
 * threading, no implicit globals. The Drizzle adapter that implements this
 * interface wraps all DB calls in withTenant() to enforce RLS. Mirrors
 * `QuestionBankRepository`/`CourseRepository`. No `delete()` — deleting a
 * simulator is out of scope for this slice (not required by any spec
 * scenario); the bank it references is deleted via CASCADE instead.
 */
export interface SimulatorRepository {
  create(ctx: TenantContext, simulator: Simulator): Promise<void>;

  findById(ctx: TenantContext, id: string): Promise<Simulator | null>;

  /** Returns all simulators for the tenant academy, most recently created first. */
  findByAcademy(ctx: TenantContext, academyId: string): Promise<Simulator[]>;

  /**
   * Returns only PUBLISHED simulators for the tenant academy — the
   * student-facing catalog read (spec.md "Browse published simulators").
   * Filters in SQL to avoid loading drafts into memory.
   */
  findPublishedByAcademy(ctx: TenantContext, academyId: string): Promise<Simulator[]>;

  update(ctx: TenantContext, simulator: Simulator): Promise<void>;
}
