import { asc, count, eq, inArray } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import {
  lessons,
  lessonVideoAssets,
  lessonTextContents,
} from '@/shared/infrastructure/db/schema/course.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Lesson } from '../domain/lesson.entity';
import type { LessonRepository } from '../domain/ports/lesson.repository';
import type { LessonContent, JSONValue, VideoContent, TextContent } from '../domain/value-objects/lesson-content.vo';
import type { LessonType } from '../domain/value-objects/lesson-type.vo';

/**
 * Hydrates a Lesson entity from a base row + companion maps.
 */
function hydrateLesson(
  base: typeof lessons.$inferSelect,
  videoMap: Map<string, typeof lessonVideoAssets.$inferSelect>,
  textMap: Map<string, typeof lessonTextContents.$inferSelect>,
): Lesson {
  let content: LessonContent;
  if (base.type === 'video') {
    const v = videoMap.get(base.id);
    content = {
      type: 'video',
      cloudflareUid: v?.cloudflareUid ?? null,
      durationSeconds: v?.durationSeconds ?? null,
      thumbnailUrl: v?.thumbnailUrl ?? null,
    } satisfies VideoContent;
  } else {
    const t = textMap.get(base.id);
    content = {
      type: 'text',
      body: (t?.body ?? null) as JSONValue,
    } satisfies TextContent;
  }

  return new Lesson({
    id: base.id,
    moduleId: base.moduleId,
    academyId: base.academyId,
    type: base.type as LessonType,
    title: base.title,
    position: base.position,
    content,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
  });
}

/**
 * Drizzle implementation of LessonRepository.
 *
 * Manages CTI lesson persistence — base `lessons` row + typed companion row
 * (lesson_video_assets or lesson_text_contents). Create and update write both
 * rows atomically inside a single withTenant transaction.
 *
 * findByModule batch-loads companions via two IN queries per type to avoid N+1.
 */
export class DrizzleLessonRepository implements LessonRepository {
  /**
   * Writes the base lessons row AND the companion content row in a single
   * withTenant transaction.
   */
  async create(ctx: TenantContext, lesson: Lesson): Promise<void> {
    await withTenant(ctx, async (tx) => {
      await tx.insert(lessons).values({
        id: lesson.id,
        moduleId: lesson.moduleId,
        academyId: lesson.academyId,
        type: lesson.type,
        title: lesson.title,
        position: lesson.position,
        createdAt: lesson.createdAt,
        updatedAt: lesson.updatedAt,
      });

      if (lesson.type === 'video') {
        const content = lesson.content as VideoContent;
        await tx.insert(lessonVideoAssets).values({
          lessonId: lesson.id,
          academyId: lesson.academyId,
          cloudflareUid: content.cloudflareUid,
          durationSeconds: content.durationSeconds,
          thumbnailUrl: content.thumbnailUrl,
        });
      } else {
        const content = lesson.content as TextContent;
        await tx.insert(lessonTextContents).values({
          lessonId: lesson.id,
          academyId: lesson.academyId,
          body: content.body as Record<string, unknown>,
        });
      }
    });
  }

  async findById(ctx: TenantContext, id: string): Promise<Lesson | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx.select().from(lessons).where(eq(lessons.id, id));
      const base = rows[0];
      if (!base) return null;

      const videoMap = new Map<string, typeof lessonVideoAssets.$inferSelect>();
      const textMap = new Map<string, typeof lessonTextContents.$inferSelect>();

      if (base.type === 'video') {
        const companions = await tx
          .select()
          .from(lessonVideoAssets)
          .where(eq(lessonVideoAssets.lessonId, base.id));
        if (companions[0]) videoMap.set(base.id, companions[0]);
      } else {
        const companions = await tx
          .select()
          .from(lessonTextContents)
          .where(eq(lessonTextContents.lessonId, base.id));
        if (companions[0]) textMap.set(base.id, companions[0]);
      }

      return hydrateLesson(base, videoMap, textMap);
    });
  }

  /**
   * Returns lessons for a module ordered by position.
   * Batch-loads companions per type (two IN queries) to avoid N+1.
   */
  async findByModule(ctx: TenantContext, moduleId: string): Promise<Lesson[]> {
    return withTenant(ctx, async (tx) => {
      const baseRows = await tx
        .select()
        .from(lessons)
        .where(eq(lessons.moduleId, moduleId))
        .orderBy(asc(lessons.position));

      if (baseRows.length === 0) return [];

      const videoIds = baseRows.filter((r) => r.type === 'video').map((r) => r.id);
      const textIds = baseRows.filter((r) => r.type === 'text').map((r) => r.id);

      const [videoRows, textRows] = await Promise.all([
        videoIds.length > 0
          ? tx
              .select()
              .from(lessonVideoAssets)
              .where(inArray(lessonVideoAssets.lessonId, videoIds))
          : Promise.resolve([]),
        textIds.length > 0
          ? tx
              .select()
              .from(lessonTextContents)
              .where(inArray(lessonTextContents.lessonId, textIds))
          : Promise.resolve([]),
      ]);

      const videoMap = new Map(videoRows.map((v) => [v.lessonId, v]));
      const textMap = new Map(textRows.map((t) => [t.lessonId, t]));

      return baseRows.map((base) => hydrateLesson(base, videoMap, textMap));
    });
  }

  /** Updates base row and companion row atomically. */
  async update(ctx: TenantContext, lesson: Lesson): Promise<void> {
    await withTenant(ctx, async (tx) => {
      await tx
        .update(lessons)
        .set({ title: lesson.title, position: lesson.position, updatedAt: lesson.updatedAt })
        .where(eq(lessons.id, lesson.id));

      if (lesson.type === 'video') {
        const content = lesson.content as VideoContent;
        await tx
          .update(lessonVideoAssets)
          .set({
            cloudflareUid: content.cloudflareUid,
            durationSeconds: content.durationSeconds,
            thumbnailUrl: content.thumbnailUrl,
            updatedAt: lesson.updatedAt,
          })
          .where(eq(lessonVideoAssets.lessonId, lesson.id));
      } else {
        const content = lesson.content as TextContent;
        await tx
          .update(lessonTextContents)
          .set({
            body: content.body as Record<string, unknown>,
            updatedAt: lesson.updatedAt,
          })
          .where(eq(lessonTextContents.lessonId, lesson.id));
      }
    });
  }

  /** Deletes base row — companion is removed via CASCADE. */
  async delete(ctx: TenantContext, id: string): Promise<void> {
    await withTenant(ctx, (tx) => tx.delete(lessons).where(eq(lessons.id, id)));
  }

  async countByModule(ctx: TenantContext, moduleId: string): Promise<number> {
    return withTenant(ctx, async (tx) => {
      const [result] = await tx
        .select({ n: count() })
        .from(lessons)
        .where(eq(lessons.moduleId, moduleId));
      return result?.n ?? 0;
    });
  }

  /**
   * Atomically rewrites positions for the given ordered list of lesson IDs.
   * All IDs must already belong to the module — enforced by the use-case before calling.
   */
  async reorder(
    ctx: TenantContext,
    moduleId: string,
    orderedIds: string[],
  ): Promise<void> {
    await withTenant(ctx, async (tx) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          tx
            .update(lessons)
            .set({ position: index + 1 })
            .where(eq(lessons.id, id)),
        ),
      );
    });
  }
}
