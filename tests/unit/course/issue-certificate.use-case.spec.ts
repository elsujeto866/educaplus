/**
 * IssueCertificateUseCase unit tests — fake repos (vi.fn()), no DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { IssueCertificateUseCase } from '../../../src/modules/course/application/issue-certificate.use-case';
import type { IssueCertificateInput } from '../../../src/modules/course/application/issue-certificate.use-case';
import { CertificateNotEarnedError } from '../../../src/modules/course/domain/errors';
import { Certificate } from '../../../src/modules/course/domain/certificate.entity';
import { Assessment } from '../../../src/modules/course/domain/assessment.entity';
import { AssessmentAttempt } from '../../../src/modules/course/domain/assessment-attempt.entity';
import type { AssessmentRepository } from '../../../src/modules/course/domain/ports/assessment.repository';
import type { AssessmentAttemptRepository } from '../../../src/modules/course/domain/ports/assessment-attempt.repository';
import type { CertificateRepository } from '../../../src/modules/course/domain/ports/certificate.repository';

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };
const now = new Date('2025-01-01T00:00:00Z');

function makeInput(overrides: Partial<IssueCertificateInput> = {}): IssueCertificateInput {
  return {
    id: 'ab12cd34-0000-0000-0000-000000000000',
    courseId: 'course-1',
    studentName: 'Jane Student',
    courseTitle: 'Course One',
    academyName: 'Academy A',
    ...overrides,
  };
}

function makeAssessment(): Assessment {
  return new Assessment({
    id: 'assess-1',
    courseId: 'course-1',
    academyId: 'org_A',
    title: 'Quiz 1',
    passingScore: 70,
    questions: [],
    createdAt: now,
    updatedAt: now,
  });
}

function makePassedAttempt(overrides: Partial<ConstructorParameters<typeof AssessmentAttempt>[0]> = {}) {
  return new AssessmentAttempt({
    id: 'attempt-1',
    assessmentId: 'assess-1',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    answers: [],
    score: 90,
    passed: true,
    createdAt: now,
    ...overrides,
  });
}

function makeCertificate(overrides: Partial<ConstructorParameters<typeof Certificate>[0]> = {}) {
  return new Certificate({
    id: 'cert-existing',
    courseId: 'course-1',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    certificateCode: 'CERT-2025-EXISTING',
    score: 80,
    studentName: 'Jane Student',
    courseTitle: 'Course One',
    academyName: 'Academy A',
    issuedAt: now,
    ...overrides,
  });
}

describe('IssueCertificateUseCase', () => {
  let assessmentRepo: AssessmentRepository;
  let attemptRepo: AssessmentAttemptRepository;
  let certificateRepo: CertificateRepository;
  let useCase: IssueCertificateUseCase;

  beforeEach(() => {
    assessmentRepo = {
      upsert: vi.fn(),
      findById: vi.fn(),
      findByCourse: vi.fn().mockResolvedValue(makeAssessment()),
      delete: vi.fn(),
    };
    attemptRepo = {
      create: vi.fn(),
      findByUserAndAssessment: vi.fn(),
      findLatestPassed: vi.fn().mockResolvedValue(makePassedAttempt()),
    };
    certificateRepo = {
      create: vi.fn().mockResolvedValue(undefined),
      findByCourseAndUser: vi.fn().mockResolvedValue(null),
    };
    useCase = new IssueCertificateUseCase(assessmentRepo, attemptRepo, certificateRepo);
  });

  it('issues a certificate snapshotting score/name/titles/code when the student has passed', async () => {
    attemptRepo.findLatestPassed = vi.fn().mockResolvedValue(makePassedAttempt({ score: 90 }));

    const result = await useCase.execute(studentCtx, makeInput());

    expect(result).toBeInstanceOf(Certificate);
    expect(result.score).toBe(90);
    expect(result.studentName).toBe('Jane Student');
    expect(result.courseTitle).toBe('Course One');
    expect(result.academyName).toBe('Academy A');
    expect(result.academyId).toBe('org_A');
    expect(result.clerkUserId).toBe('user_1');
    expect(result.certificateCode).toMatch(/^CERT-\d{4}-[0-9A-F]{8}$/);
    expect(certificateRepo.create).toHaveBeenCalledOnce();
    expect(certificateRepo.create).toHaveBeenCalledWith(studentCtx, result);
    expect(attemptRepo.findLatestPassed).toHaveBeenCalledWith(studentCtx, 'assess-1', 'user_1');
  });

  it('throws CertificateNotEarnedError and creates no row when the course has no assessment', async () => {
    assessmentRepo.findByCourse = vi.fn().mockResolvedValue(null);

    await expect(useCase.execute(studentCtx, makeInput())).rejects.toThrow(
      CertificateNotEarnedError,
    );
    expect(certificateRepo.create).not.toHaveBeenCalled();
  });

  it('throws CertificateNotEarnedError and creates no row when the student has not passed', async () => {
    attemptRepo.findLatestPassed = vi.fn().mockResolvedValue(null);

    await expect(useCase.execute(studentCtx, makeInput())).rejects.toThrow(
      CertificateNotEarnedError,
    );
    expect(certificateRepo.create).not.toHaveBeenCalled();
  });

  it('idempotent: re-issuing returns the SAME existing row, no new create call', async () => {
    const existing = makeCertificate();
    certificateRepo.findByCourseAndUser = vi.fn().mockResolvedValue(existing);

    const result = await useCase.execute(studentCtx, makeInput());

    expect(result).toBe(existing);
    expect(certificateRepo.create).not.toHaveBeenCalled();
  });

  it('immutability: a later higher-score pass does not update the existing certificate', async () => {
    const existing = makeCertificate({ score: 80 });
    certificateRepo.findByCourseAndUser = vi.fn().mockResolvedValue(existing);
    attemptRepo.findLatestPassed = vi.fn().mockResolvedValue(makePassedAttempt({ score: 100 }));

    const result = await useCase.execute(studentCtx, makeInput());

    expect(result.score).toBe(80);
    expect(result).toBe(existing);
    expect(certificateRepo.create).not.toHaveBeenCalled();
    // The pass-gate lookup is not even consulted once an existing row is found.
    expect(assessmentRepo.findByCourse).not.toHaveBeenCalled();
    expect(attemptRepo.findLatestPassed).not.toHaveBeenCalled();
  });

  it('race: a unique-violation (23505) on create re-reads and returns the existing row', async () => {
    const raced = makeCertificate({ id: 'cert-raced' });
    let callCount = 0;
    certificateRepo.findByCourseAndUser = vi.fn().mockImplementation(() => {
      callCount += 1;
      return Promise.resolve(callCount === 1 ? null : raced);
    });
    certificateRepo.create = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('duplicate key value'), { code: '23505' }));

    const result = await useCase.execute(studentCtx, makeInput());

    expect(result).toBe(raced);
    expect(certificateRepo.findByCourseAndUser).toHaveBeenCalledTimes(2);
  });

  it('re-throws non-unique-violation errors from create', async () => {
    certificateRepo.create = vi.fn().mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute(studentCtx, makeInput())).rejects.toThrow('connection lost');
  });
});
