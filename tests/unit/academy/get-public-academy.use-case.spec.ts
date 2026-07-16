/**
 * Application use-case unit tests — GetPublicAcademyUseCase.
 *
 * The public academy port is mocked with vi.fn() — no DB, no infrastructure,
 * no withPublicRole(). Verifies pure orchestration: delegate to the port by
 * slug and return whatever it resolves (published academy view or null for
 * unknown/unpublished/deleted — the port/RLS layer is what actually decides
 * that, per design D2).
 */

import { describe, it, expect, vi } from 'vitest';
import { GetPublicAcademyUseCase } from '../../../src/modules/academy/application/get-public-academy.use-case';
import type {
  PublicAcademyPort,
  PublicAcademyView,
} from '../../../src/modules/academy/domain/ports/public-academy.port';

function makePort(): PublicAcademyPort {
  return { findBySlug: vi.fn(), findAllPublished: vi.fn() };
}

describe('GetPublicAcademyUseCase', () => {
  it('returns the public-safe view for a known/published slug', async () => {
    const port = makePort();
    const view: PublicAcademyView = { id: 'org_A', name: 'Academy A', slug: 'academy-a' };
    vi.mocked(port.findBySlug).mockResolvedValue(view);

    const useCase = new GetPublicAcademyUseCase(port);
    const result = await useCase.execute('academy-a');

    expect(port.findBySlug).toHaveBeenCalledWith('academy-a');
    expect(result).toBe(view);
  });

  it('returns null for an unknown/unpublished/deleted slug (caller renders 404)', async () => {
    const port = makePort();
    vi.mocked(port.findBySlug).mockResolvedValue(null);

    const useCase = new GetPublicAcademyUseCase(port);
    const result = await useCase.execute('ghost-academy');

    expect(result).toBeNull();
  });
});
