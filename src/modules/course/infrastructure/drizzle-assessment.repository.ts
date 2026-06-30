import { eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { assessments } from '@/shared/infrastructure/db/schema/course.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Assessment } from '../domain/assessment.entity';
import type { AssessmentRepository } from '../domain/ports/assessment.repository';
import type { JSONValue } from '../domain/value-objects/lesson-content.vo';

/**
 * Maps a raw DB row to an Assessment entity.
 */
function toEntity(row: typeof assessments.$inferSelect): Assessment {
  return new Assessment({
    id: row.id,
    moduleId: row.moduleId,
    academyId: row.academyId,
    title: row.title,
    config: (row.config ?? null) as JSONValue,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Drizzle implementation of AssessmentRepository.
 *
 * Upsert targets the unique moduleId column — each module has at most one
 * assessment. The use-case layer decides whether to allow overwrite or throw
 * DuplicateAssessmentError.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 */
export class DrizzleAssessmentRepository implements AssessmentRepository {
  async upsert(ctx: TenantContext, assessment: Assessment): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx
        .insert(assessments)
        .values({
          id: assessment.id,
          moduleId: assessment.moduleId,
          academyId: assessment.academyId,
          title: assessment.title,
          config: assessment.config as Record<string, unknown>,
          createdAt: assessment.createdAt,
          updatedAt: assessment.updatedAt,
        })
        .onConflictDoUpdate({
          target: assessments.moduleId,
          set: {
            title: assessment.title,
            config: assessment.config as Record<string, unknown>,
            updatedAt: assessment.updatedAt,
          },
        }),
    );
  }

  async findById(ctx: TenantContext, id: string): Promise<Assessment | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(assessments)
        .where(eq(assessments.id, id));
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }

  async findByModule(ctx: TenantContext, moduleId: string): Promise<Assessment | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(assessments)
        .where(eq(assessments.moduleId, moduleId));
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }

  async delete(ctx: TenantContext, id: string): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx.delete(assessments).where(eq(assessments.id, id)),
    );
  }
}
