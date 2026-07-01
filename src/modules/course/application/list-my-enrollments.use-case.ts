import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Enrollment } from '../domain/enrollment.entity';
import type { EnrollmentRepository } from '../domain/ports/enrollment.repository';

/**
 * ListMyEnrollmentsUseCase — reads the caller's own enrollments.
 *
 * Read-only: no `assertRole` guard. Scoped to ctx.userId — a learner can only
 * ever see their own enrollments, never another member's.
 */
export class ListMyEnrollmentsUseCase {
  constructor(private readonly enrollmentRepo: EnrollmentRepository) {}

  async execute(ctx: TenantContext): Promise<Enrollment[]> {
    return this.enrollmentRepo.findByLearner(ctx, ctx.userId);
  }
}
