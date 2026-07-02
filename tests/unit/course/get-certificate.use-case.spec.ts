/**
 * GetCertificateUseCase unit tests — fake CertificateRepository, no DB.
 */

import { describe, it, expect, vi } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { GetCertificateUseCase } from '../../../src/modules/course/application/get-certificate.use-case';
import { Certificate } from '../../../src/modules/course/domain/certificate.entity';
import type { CertificateRepository } from '../../../src/modules/course/domain/ports/certificate.repository';

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };
const now = new Date('2025-01-01T00:00:00Z');

function makeCertificateRepo(overrides: Partial<CertificateRepository> = {}): CertificateRepository {
  return {
    create: vi.fn(),
    findByCourseAndUser: vi.fn(),
    ...overrides,
  };
}

describe('GetCertificateUseCase', () => {
  it('returns the certificate when one exists for (course, user)', async () => {
    const certificate = new Certificate({
      id: 'cert-1',
      courseId: 'course-1',
      academyId: 'org_A',
      clerkUserId: 'user_1',
      certificateCode: 'CERT-2025-ABCDEF12',
      score: 90,
      studentName: 'Jane Student',
      courseTitle: 'Course One',
      academyName: 'Academy A',
      issuedAt: now,
    });
    const certificateRepo = makeCertificateRepo({
      findByCourseAndUser: vi.fn().mockResolvedValue(certificate),
    });
    const useCase = new GetCertificateUseCase(certificateRepo);

    const result = await useCase.execute(studentCtx, 'course-1');

    expect(result).toBe(certificate);
    expect(certificateRepo.findByCourseAndUser).toHaveBeenCalledWith(
      studentCtx,
      'course-1',
      'user_1',
    );
  });

  it('returns null when no certificate exists yet, with no side effects', async () => {
    const certificateRepo = makeCertificateRepo({
      findByCourseAndUser: vi.fn().mockResolvedValue(null),
    });
    const useCase = new GetCertificateUseCase(certificateRepo);

    const result = await useCase.execute(studentCtx, 'course-1');

    expect(result).toBeNull();
    expect(certificateRepo.create).not.toHaveBeenCalled();
  });
});
