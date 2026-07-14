/**
 * Application use-case unit tests — RequestAccessUseCase.
 *
 * JoinRequestSubmissionPort is mocked with vi.fn() — no DB. Exercises:
 *   - happy path: valid email creates a pending request, normalized BEFORE
 *     both the dedup pre-check and the insert (spec "Email Normalization").
 *   - invalid email: rejected before any port call (spec "Invalid email
 *     rejected") — JoinRequest.createPending/Email VO does the validation.
 *   - duplicate pending idempotency via the port's pre-check
 *     (findPendingByAcademyAndEmail returns an existing request).
 *   - duplicate pending idempotency via a DB race: insertPending rejects
 *     with a Postgres unique-violation (SQLSTATE 23505) — the production
 *     Drizzle adapter's ONLY real dedup signal, since academy_public has no
 *     SELECT grant on join_requests (see drizzle-public-join-request.repository.ts).
 *     Mirrors the established isUniqueViolation race-safety pattern from
 *     IssueCertificateUseCase / AddSimulatorToTrackStepUseCase.
 *   - any other insert failure propagates unmodified.
 */

import { describe, it, expect, vi } from 'vitest';
import { RequestAccessUseCase } from '../../../src/modules/academy/application/request-access.use-case';
import { JoinRequest } from '../../../src/modules/academy/domain/entities/join-request.entity';
import type { JoinRequestSubmissionPort } from '../../../src/modules/academy/domain/ports/join-request-submission.port';

function makePort(): JoinRequestSubmissionPort {
  return {
    findPendingByAcademyAndEmail: vi.fn(),
    insertPending: vi.fn(),
  };
}

function uniqueViolation(): Error {
  const err = new Error('duplicate key value violates unique constraint "join_requests_one_pending_idx"');
  (err as Error & { code: string }).code = '23505';
  return err;
}

describe('RequestAccessUseCase', () => {
  it('creates a pending request for a valid, non-duplicate email (normalized before insert)', async () => {
    const port = makePort();
    vi.mocked(port.findPendingByAcademyAndEmail).mockResolvedValue(null);
    vi.mocked(port.insertPending).mockResolvedValue(undefined);

    const useCase = new RequestAccessUseCase(port);
    const result = await useCase.execute({ id: 'jr-1', academyId: 'org_A', email: ' New@Student.com ' });

    expect(result).toEqual({ outcome: 'created' });
    expect(port.findPendingByAcademyAndEmail).toHaveBeenCalledWith('org_A', 'new@student.com');
    expect(port.insertPending).toHaveBeenCalledTimes(1);
    const inserted = vi.mocked(port.insertPending).mock.calls[0]?.[0] as JoinRequest;
    expect(inserted.email).toBe('new@student.com');
    expect(inserted.academyId).toBe('org_A');
    expect(inserted.status).toBe('pending');
  });

  it('rejects an invalid email without calling the port at all', async () => {
    const port = makePort();

    const useCase = new RequestAccessUseCase(port);

    await expect(
      useCase.execute({ id: 'jr-1', academyId: 'org_A', email: 'not-an-email' }),
    ).rejects.toThrow(/Invalid email/);
    expect(port.findPendingByAcademyAndEmail).not.toHaveBeenCalled();
    expect(port.insertPending).not.toHaveBeenCalled();
  });

  it('is idempotent when the port pre-check finds an existing pending request', async () => {
    const port = makePort();
    vi.mocked(port.findPendingByAcademyAndEmail).mockResolvedValue(
      JoinRequest.createPending({
        id: 'jr-0',
        academyId: 'org_A',
        email: 'new@student.com',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      }),
    );

    const useCase = new RequestAccessUseCase(port);
    const result = await useCase.execute({ id: 'jr-1', academyId: 'org_A', email: 'new@student.com' });

    expect(result).toEqual({ outcome: 'already-pending' });
    expect(port.insertPending).not.toHaveBeenCalled();
  });

  it('is idempotent when insertPending races into a unique-violation (23505)', async () => {
    const port = makePort();
    vi.mocked(port.findPendingByAcademyAndEmail).mockResolvedValue(null);
    vi.mocked(port.insertPending).mockRejectedValue(uniqueViolation());

    const useCase = new RequestAccessUseCase(port);
    const result = await useCase.execute({ id: 'jr-1', academyId: 'org_A', email: 'new@student.com' });

    expect(result).toEqual({ outcome: 'already-pending' });
  });

  it('rethrows insert errors that are not a unique-violation', async () => {
    const port = makePort();
    vi.mocked(port.findPendingByAcademyAndEmail).mockResolvedValue(null);
    vi.mocked(port.insertPending).mockRejectedValue(new Error('connection reset'));

    const useCase = new RequestAccessUseCase(port);

    await expect(
      useCase.execute({ id: 'jr-1', academyId: 'org_A', email: 'new@student.com' }),
    ).rejects.toThrow('connection reset');
  });
});
