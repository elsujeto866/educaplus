/**
 * Application use-case unit tests — GetAcademyUseCase.
 *
 * The repository is mocked with vi.fn() — no DB, no infrastructure.
 * Verifies tenant-scoped read orchestration only (no role guard — any member
 * may read their own academy).
 */

import { describe, it, expect, vi } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { GetAcademyUseCase } from '../../../src/modules/academy/application/get-academy.use-case';
import { Academy } from '../../../src/modules/academy/domain/academy.entity';
import type { AcademyRepository } from '../../../src/modules/academy/domain/ports/academy.repository';

const now = new Date('2025-01-01T00:00:00Z');

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_3', role: 'student' };

function makeAcademy(overrides: Partial<ConstructorParameters<typeof Academy>[0]> = {}): Academy {
  return new Academy({
    id: 'org_A',
    name: 'Academy A',
    slug: 'academy-a',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makeAcademyRepo(): AcademyRepository {
  return {
    upsert: vi.fn(),
    findById: vi.fn(),
    softDelete: vi.fn(),
  };
}

describe('GetAcademyUseCase', () => {
  it('returns the tenant-scoped academy', async () => {
    const academyRepo = makeAcademyRepo();
    const academy = makeAcademy();
    vi.mocked(academyRepo.findById).mockResolvedValue(academy);

    const useCase = new GetAcademyUseCase(academyRepo);
    const result = await useCase.execute(studentCtx);

    expect(academyRepo.findById).toHaveBeenCalledWith(studentCtx, studentCtx.orgId);
    expect(result).toBe(academy);
  });

  it('returns null when the academy has not been provisioned yet', async () => {
    const academyRepo = makeAcademyRepo();
    vi.mocked(academyRepo.findById).mockResolvedValue(null);

    const useCase = new GetAcademyUseCase(academyRepo);
    const result = await useCase.execute(studentCtx);

    expect(result).toBeNull();
  });
});
