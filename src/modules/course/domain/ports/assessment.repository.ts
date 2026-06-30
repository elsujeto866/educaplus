import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Assessment } from '../assessment.entity';

/**
 * Port: AssessmentRepository
 *
 * All methods receive TenantContext first — explicit threading, no globals.
 * The unique constraint (module_id) in the schema means each module has at most
 * one assessment. The use-case checks findByModule before upserting to surface
 * DuplicateAssessmentError when the caller explicitly rejects overwrites.
 */
export interface AssessmentRepository {
  /**
   * Upsert on module_id unique constraint.
   * Use-case layer decides whether to allow overwrite or throw DuplicateAssessmentError.
   */
  upsert(ctx: TenantContext, assessment: Assessment): Promise<void>;

  findById(ctx: TenantContext, id: string): Promise<Assessment | null>;

  findByModule(ctx: TenantContext, moduleId: string): Promise<Assessment | null>;

  delete(ctx: TenantContext, id: string): Promise<void>;
}
