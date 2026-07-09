/**
 * Learner tracks catalog page (`.../learn/simulators/tracks/page.tsx`) tests
 * — Phase 6. Mirrors `learn/simulators/page.tsx`'s catalog conventions.
 *
 * Only PUBLISHED tracks are visible to learners (spec.md-adjacent
 * convention: same "unpublished stays hidden" rule the standalone
 * simulator catalog already enforces).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const listTracksExecuteMock = vi.fn();
vi.mock('../../../src/modules/simulator/composition', () => ({
  makeSimulatorComposition: () => ({
    listTracks: { execute: listTracksExecuteMock },
  }),
}));

vi.mock('../../../src/app/dashboard/_components/user-menu', () => ({
  UserMenu: () => null,
}));

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };

describe('Learner tracks catalog page', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentCtx);
    listTracksExecuteMock.mockReset();
  });

  it('shows only PUBLISHED tracks, hiding drafts', async () => {
    listTracksExecuteMock.mockResolvedValue([
      { id: 'track-1', title: 'Ruta publicada', description: null, status: 'published' },
      { id: 'track-2', title: 'Ruta en borrador', description: null, status: 'draft' },
    ]);
    const LearnerTracksCatalogPage = (
      await import('../../../src/app/dashboard/learn/simulators/tracks/page')
    ).default;

    render(await LearnerTracksCatalogPage());

    expect(screen.getByText('Ruta publicada')).toBeInTheDocument();
    expect(screen.queryByText('Ruta en borrador')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no published tracks', async () => {
    listTracksExecuteMock.mockResolvedValue([]);
    const LearnerTracksCatalogPage = (
      await import('../../../src/app/dashboard/learn/simulators/tracks/page')
    ).default;

    render(await LearnerTracksCatalogPage());

    expect(screen.getByText(/no hay pistas publicadas/i)).toBeInTheDocument();
  });
});
