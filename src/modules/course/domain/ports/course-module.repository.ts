import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { CourseModule } from '../course-module.entity';

/**
 * Port: CourseModuleRepository
 *
 * All methods receive TenantContext first — explicit threading, no globals.
 */
export interface CourseModuleRepository {
  create(ctx: TenantContext, module: CourseModule): Promise<void>;

  findById(ctx: TenantContext, id: string): Promise<CourseModule | null>;

  /** Returns modules for a course ordered by position. */
  findByCourse(ctx: TenantContext, courseId: string): Promise<CourseModule[]>;

  update(ctx: TenantContext, module: CourseModule): Promise<void>;

  delete(ctx: TenantContext, id: string): Promise<void>;

  /** Count of modules in a course — used to assign position = count + 1 on creation. */
  countByCourse(ctx: TenantContext, courseId: string): Promise<number>;

  /**
   * Atomically rewrites positions for the given ordered list of module IDs.
   * All IDs must belong to the same course (enforced by the use-case before calling).
   */
  reorder(ctx: TenantContext, courseId: string, orderedIds: string[]): Promise<void>;
}
