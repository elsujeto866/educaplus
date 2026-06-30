import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Resource } from '../resource.entity';

/**
 * Port: ResourceRepository
 *
 * All methods receive TenantContext first — explicit threading, no globals.
 */
export interface ResourceRepository {
  create(ctx: TenantContext, resource: Resource): Promise<void>;

  /** Returns resources for a lesson ordered by position. */
  findByLesson(ctx: TenantContext, lessonId: string): Promise<Resource[]>;

  delete(ctx: TenantContext, id: string): Promise<void>;

  /**
   * Atomically rewrites positions for the given ordered list of resource IDs.
   * All IDs must belong to the same lesson (enforced by the use-case before calling).
   */
  reorder(ctx: TenantContext, lessonId: string, orderedIds: string[]): Promise<void>;
}
