import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Assessment } from '../domain/assessment.entity';
import type { AssessmentRepository } from '../domain/ports/assessment.repository';
import type { JSONValue } from '../domain/value-objects/lesson-content.vo';

export interface UpsertAssessmentInput {
  /** Caller-supplied UUID for the assessment record. */
  id: string;
  moduleId: string;
  academyId: string;
  title: string;
  /** Opaque JSONB config — schema is owned by the SRS change. */
  config: JSONValue;
}

/**
 * UpsertAssessmentUseCase
 *
 * Creates or replaces the assessment for a module. The unique (module_id)
 * constraint means each module has at most one assessment. Callers that want
 * to guard against overwriting should check AssessmentRepository.findByModule
 * and throw DuplicateAssessmentError before calling this use-case.
 *
 * Authorization: admin or instructor.
 */
export class UpsertAssessmentUseCase {
  constructor(private readonly assessmentRepo: AssessmentRepository) {}

  async execute(
    ctx: TenantContext,
    input: UpsertAssessmentInput,
  ): Promise<Assessment> {
    assertRole(ctx, ['admin', 'instructor']);

    const now = new Date();
    const assessment = new Assessment({
      id: input.id,
      moduleId: input.moduleId,
      academyId: input.academyId,
      title: input.title,
      config: input.config,
      createdAt: now,
      updatedAt: now,
    });

    await this.assessmentRepo.upsert(ctx, assessment);
    return assessment;
  }
}
