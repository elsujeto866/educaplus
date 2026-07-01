import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Assessment } from '../assessment.entity';

/**
 * Port: AssessmentRepository
 *
 * All methods receive TenantContext first — explicit threading, no globals.
 * The unique constraint (course_id) in the schema means each course has at most
 * one assessment (the final quiz). The use-case upserts by course, replacing
 * questions on conflict.
 */
export interface AssessmentRepository {
  /**
   * Upsert on course_id unique constraint — create if absent, replace if present.
   */
  upsert(ctx: TenantContext, assessment: Assessment): Promise<void>;

  findById(ctx: TenantContext, id: string): Promise<Assessment | null>;

  findByCourse(ctx: TenantContext, courseId: string): Promise<Assessment | null>;

  delete(ctx: TenantContext, id: string): Promise<void>;
}
