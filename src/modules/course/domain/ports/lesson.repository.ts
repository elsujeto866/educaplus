import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Lesson } from '../lesson.entity';

/**
 * Port: LessonRepository
 *
 * Manages CTI lesson persistence — base row + typed companion row.
 * All DB writes must be atomic: the base lessons row and its companion
 * (lesson_video_assets or lesson_text_contents) are written in a single transaction.
 *
 * All methods receive TenantContext first — explicit threading, no globals.
 */
export interface LessonRepository {
  /**
   * Writes the base lessons row AND the companion content row in a single
   * withTenant transaction.
   */
  create(ctx: TenantContext, lesson: Lesson): Promise<void>;

  /** Selects base row, branches on type, fetches companion, returns hydrated entity. */
  findById(ctx: TenantContext, id: string): Promise<Lesson | null>;

  /**
   * Returns lessons for a module ordered by position.
   * Batch-loads companions per type (two IN queries) to avoid N+1.
   */
  findByModule(ctx: TenantContext, moduleId: string): Promise<Lesson[]>;

  /** Updates base row and companion row atomically. */
  update(ctx: TenantContext, lesson: Lesson): Promise<void>;

  /** Deletes base row — companion is removed via CASCADE. */
  delete(ctx: TenantContext, id: string): Promise<void>;

  /** Count of lessons in a module — used to assign position = count + 1 on creation. */
  countByModule(ctx: TenantContext, moduleId: string): Promise<number>;

  /**
   * Atomically rewrites positions for the given ordered list of lesson IDs.
   * All IDs must belong to the same module (enforced by the use-case before calling).
   */
  reorder(ctx: TenantContext, moduleId: string, orderedIds: string[]): Promise<void>;
}
