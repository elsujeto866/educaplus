/**
 * IssueSimulatorCertificateUseCase unit tests — fake repos (vi.fn()), no DB.
 * Mirrors `tests/unit/course/issue-certificate.use-case.spec.ts`, adapted:
 * simulator certificates key directly on `simulatorId` (no course→assessment
 * indirection — `SimulatorAttemptRepository.findLatestPassed` already takes
 * simulatorId), and cover the OWNER-ONLY guarantee (ctx.userId scoping).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { IssueSimulatorCertificateUseCase } from '../../../src/modules/simulator/application/issue-simulator-certificate.use-case';
import type { IssueSimulatorCertificateInput } from '../../../src/modules/simulator/application/issue-simulator-certificate.use-case';
import {
  SimulatorCertificateNotEarnedError,
  SimulatorCertificateNotConfiguredError,
} from '../../../src/modules/simulator/domain/errors';
import { SimulatorCertificate } from '../../../src/modules/simulator/domain/simulator-certificate.entity';
import { SimulatorAttempt } from '../../../src/modules/simulator/domain/simulator-attempt.entity';
import type { SimulatorAttemptRepository } from '../../../src/modules/simulator/domain/ports/simulator-attempt.repository';
import type { SimulatorCertificateRepository } from '../../../src/modules/simulator/domain/ports/simulator-certificate.repository';

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };
const now = new Date('2025-01-01T00:00:00Z');

function makeInput(overrides: Partial<IssueSimulatorCertificateInput> = {}): IssueSimulatorCertificateInput {
  return {
    id: 'ab12cd34-0000-0000-0000-000000000000',
    simulatorId: 'sim-1',
    studentName: 'Jane Student',
    simulatorTitle: 'Simulator One',
    academyName: 'Academy A',
    issuesCertificate: true,
    ...overrides,
  };
}

function makePassedAttempt(overrides: Partial<ConstructorParameters<typeof SimulatorAttempt>[0]> = {}) {
  return new SimulatorAttempt({
    id: 'attempt-1',
    simulatorId: 'sim-1',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    status: 'submitted',
    frozenQuestions: [
      { id: 'q-1', prompt: '2+2', options: [{ id: 'a', label: '3' }, { id: 'b', label: '4' }], correctOptionId: 'b' },
    ],
    answers: [{ questionId: 'q-1', selectedOptionId: 'b' }],
    score: 90,
    passed: true,
    startedAt: now,
    deadlineAt: new Date(now.getTime() + 30 * 60_000),
    submittedAt: now,
    createdAt: now,
    ...overrides,
  });
}

function makeCertificate(overrides: Partial<ConstructorParameters<typeof SimulatorCertificate>[0]> = {}) {
  return new SimulatorCertificate({
    id: 'cert-existing',
    simulatorId: 'sim-1',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    certificateCode: 'CERT-2025-EXISTING',
    score: 80,
    studentName: 'Jane Student',
    simulatorTitle: 'Simulator One',
    academyName: 'Academy A',
    issuedAt: now,
    ...overrides,
  });
}

describe('IssueSimulatorCertificateUseCase', () => {
  let attemptRepo: SimulatorAttemptRepository;
  let certificateRepo: SimulatorCertificateRepository;
  let useCase: IssueSimulatorCertificateUseCase;

  beforeEach(() => {
    attemptRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      startOrResume: vi.fn(),
      update: vi.fn(),
      findLatestPassed: vi.fn().mockResolvedValue(makePassedAttempt()),
    };
    certificateRepo = {
      create: vi.fn().mockResolvedValue(undefined),
      findBySimulatorAndUser: vi.fn().mockResolvedValue(null),
    };
    useCase = new IssueSimulatorCertificateUseCase(attemptRepo, certificateRepo);
  });

  it('issues a certificate snapshotting score/name/title/code when the caller has passed', async () => {
    attemptRepo.findLatestPassed = vi.fn().mockResolvedValue(makePassedAttempt({ score: 90 }));

    const result = await useCase.execute(studentCtx, makeInput());

    expect(result).toBeInstanceOf(SimulatorCertificate);
    expect(result.score).toBe(90);
    expect(result.studentName).toBe('Jane Student');
    expect(result.simulatorTitle).toBe('Simulator One');
    expect(result.academyName).toBe('Academy A');
    expect(result.academyId).toBe('org_A');
    expect(result.clerkUserId).toBe('user_1');
    expect(result.certificateCode).toMatch(/^CERT-\d{4}-[0-9A-F]{8}$/);
    expect(certificateRepo.create).toHaveBeenCalledOnce();
    expect(certificateRepo.create).toHaveBeenCalledWith(studentCtx, result);
    expect(attemptRepo.findLatestPassed).toHaveBeenCalledWith(studentCtx, 'sim-1', 'user_1');
  });

  it('throws SimulatorCertificateNotEarnedError and creates no row when the caller has never passed', async () => {
    attemptRepo.findLatestPassed = vi.fn().mockResolvedValue(null);

    await expect(useCase.execute(studentCtx, makeInput())).rejects.toThrow(
      SimulatorCertificateNotEarnedError,
    );
    expect(certificateRepo.create).not.toHaveBeenCalled();
  });

  it('idempotent: re-issuing (passing twice) returns the SAME existing row, no new create call', async () => {
    const existing = makeCertificate();
    certificateRepo.findBySimulatorAndUser = vi.fn().mockResolvedValue(existing);

    const result = await useCase.execute(studentCtx, makeInput());

    expect(result).toBe(existing);
    expect(certificateRepo.create).not.toHaveBeenCalled();
    // The pass-gate lookup is not even consulted once an existing row is found.
    expect(attemptRepo.findLatestPassed).not.toHaveBeenCalled();
  });

  it('immutability: a later higher-score pass does not update the existing certificate', async () => {
    const existing = makeCertificate({ score: 80 });
    certificateRepo.findBySimulatorAndUser = vi.fn().mockResolvedValue(existing);
    attemptRepo.findLatestPassed = vi.fn().mockResolvedValue(makePassedAttempt({ score: 100 }));

    const result = await useCase.execute(studentCtx, makeInput());

    expect(result.score).toBe(80);
    expect(result).toBe(existing);
    expect(certificateRepo.create).not.toHaveBeenCalled();
  });

  it('OWNER-ONLY: looks up the existing certificate and the pass-gate scoped to ctx.userId, not an input-supplied user', async () => {
    await useCase.execute(studentCtx, makeInput());

    expect(certificateRepo.findBySimulatorAndUser).toHaveBeenCalledWith(
      studentCtx,
      'sim-1',
      'user_1',
    );
    expect(attemptRepo.findLatestPassed).toHaveBeenCalledWith(studentCtx, 'sim-1', 'user_1');
  });

  it('race: a unique-violation (23505) on create re-reads and returns the existing row', async () => {
    const raced = makeCertificate({ id: 'cert-raced' });
    let callCount = 0;
    certificateRepo.findBySimulatorAndUser = vi.fn().mockImplementation(() => {
      callCount += 1;
      return Promise.resolve(callCount === 1 ? null : raced);
    });
    certificateRepo.create = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('duplicate key value'), { code: '23505' }));

    const result = await useCase.execute(studentCtx, makeInput());

    expect(result).toBe(raced);
    expect(certificateRepo.findBySimulatorAndUser).toHaveBeenCalledTimes(2);
  });

  it('re-throws non-unique-violation errors from create', async () => {
    certificateRepo.create = vi.fn().mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute(studentCtx, makeInput())).rejects.toThrow('connection lost');
  });

  // ---------------------------------------------------------------------
  // Slice S6 — per-simulator certificate toggle gate
  // ---------------------------------------------------------------------

  describe('issuesCertificate gate (Slice S6)', () => {
    it('issues a certificate as before when issuesCertificate is true and the caller passed', async () => {
      const result = await useCase.execute(studentCtx, makeInput({ issuesCertificate: true }));

      expect(result).toBeInstanceOf(SimulatorCertificate);
      expect(certificateRepo.create).toHaveBeenCalledOnce();
    });

    it('throws SimulatorCertificateNotConfiguredError and creates no row when issuesCertificate is false', async () => {
      await expect(
        useCase.execute(studentCtx, makeInput({ issuesCertificate: false })),
      ).rejects.toThrow(SimulatorCertificateNotConfiguredError);
      expect(certificateRepo.create).not.toHaveBeenCalled();
    });

    it('does not even consult the pass-gate when issuesCertificate is false (cheap gate, short-circuits before findLatestPassed)', async () => {
      await expect(
        useCase.execute(studentCtx, makeInput({ issuesCertificate: false })),
      ).rejects.toThrow(SimulatorCertificateNotConfiguredError);
      expect(attemptRepo.findLatestPassed).not.toHaveBeenCalled();
    });

    it('returns an existing certificate unaffected even when issuesCertificate is now false (immutability wins over a later config change)', async () => {
      const existing = makeCertificate();
      certificateRepo.findBySimulatorAndUser = vi.fn().mockResolvedValue(existing);

      const result = await useCase.execute(studentCtx, makeInput({ issuesCertificate: false }));

      expect(result).toBe(existing);
      expect(certificateRepo.create).not.toHaveBeenCalled();
    });
  });
});
