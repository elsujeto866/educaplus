/**
 * ListPublicAcademiesUseCase unit tests — the untenanted directory read that
 * powers the public root landing. Like GetPublicAcademyUseCase it takes NO
 * TenantContext (a visitor has no orgId); it just returns whatever published,
 * public-safe projections the PublicAcademyPort yields. RLS (the
 * `public_read` policy) is what actually restricts rows to published,
 * non-deleted academies — asserted in the RLS integration suite, not here.
 */

import { describe, it, expect } from 'vitest';
import { ListPublicAcademiesUseCase } from '../../../src/modules/academy/application/list-public-academies.use-case';
import type {
  PublicAcademyPort,
  PublicAcademyView,
} from '../../../src/modules/academy/domain/ports/public-academy.port';

function portReturning(list: PublicAcademyView[]): PublicAcademyPort {
  return {
    findBySlug: async () => null,
    findAllPublished: async () => list,
  };
}

describe('ListPublicAcademiesUseCase', () => {
  it('returns every public academy the port yields', async () => {
    const list: PublicAcademyView[] = [
      { id: 'a1', name: 'Alpha', slug: 'alpha' },
      { id: 'a2', name: 'Beta', slug: 'beta' },
    ];
    const useCase = new ListPublicAcademiesUseCase(portReturning(list));

    expect(await useCase.execute()).toEqual(list);
  });

  it('returns an empty array when no public academies exist', async () => {
    const useCase = new ListPublicAcademiesUseCase(portReturning([]));

    expect(await useCase.execute()).toEqual([]);
  });
});
