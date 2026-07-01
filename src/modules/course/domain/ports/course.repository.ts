import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Course } from '../course.entity';

/**
 * Port: CourseRepository
 *
 * Every method receives TenantContext as the first argument — explicit threading,
 * no implicit globals. The Drizzle adapter that implements this interface wraps
 * all DB calls in withTenant() to enforce RLS.
 */
export interface CourseRepository {
  /** Persist a new course. Caller must verify slug uniqueness first via existsBySlug. */
  create(ctx: TenantContext, course: Course): Promise<void>;

  findById(ctx: TenantContext, id: string): Promise<Course | null>;

  findBySlug(ctx: TenantContext, academyId: string, slug: string): Promise<Course | null>;

  /** Returns all courses for the tenant academy, ordered by position. */
  findByAcademy(ctx: TenantContext, academyId: string): Promise<Course[]>;

  /**
   * Returns only published courses for the tenant academy, ordered by position.
   * Used by learner-facing catalog reads — filters in SQL to avoid loading drafts.
   */
  findPublishedByAcademy(ctx: TenantContext, academyId: string): Promise<Course[]>;

  update(ctx: TenantContext, course: Course): Promise<void>;

  delete(ctx: TenantContext, id: string): Promise<void>;

  /** True when a course with the given slug already exists in the academy. Used to enforce slug uniqueness. */
  existsBySlug(ctx: TenantContext, academyId: string, slug: string): Promise<boolean>;

  /** Returns the highest position value for the academy — used to append a new course at the end. */
  maxPositionByAcademy(ctx: TenantContext, academyId: string): Promise<number>;
}
