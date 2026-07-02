import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Certificate } from '../domain/certificate.entity';
import type { CertificateRepository } from '../domain/ports/certificate.repository';

/**
 * GetCertificateUseCase — reads the caller's certificate for a course, or
 * null if none has been issued yet.
 *
 * Read-only: no `assertRole` guard, no side effects — mirrors GetAssessmentUseCase.
 */
export class GetCertificateUseCase {
  constructor(private readonly certificateRepo: CertificateRepository) {}

  async execute(ctx: TenantContext, courseId: string): Promise<Certificate | null> {
    return this.certificateRepo.findByCourseAndUser(ctx, courseId, ctx.userId);
  }
}
