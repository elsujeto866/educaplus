/**
 * PublicAcademiesDirectory unit tests — the unauthenticated root landing that
 * lists every published academy, each linking to its /a/[slug] request page.
 * Presentational: it receives the already-resolved public-safe projections and
 * renders links + an empty state. Row visibility (published-only) is enforced
 * upstream by RLS, not asserted here.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublicAcademiesDirectory } from '../../../src/app/_components/public-academies-directory';

describe('PublicAcademiesDirectory', () => {
  it('renders one link per academy pointing at its /a/[slug] page', () => {
    render(
      <PublicAcademiesDirectory
        academies={[
          { id: 'a1', name: 'Academia Uno', slug: 'uno' },
          { id: 'a2', name: 'Academia Dos', slug: 'dos' },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Academia Uno' })).toHaveAttribute('href', '/a/uno');
    expect(screen.getByRole('link', { name: 'Academia Dos' })).toHaveAttribute('href', '/a/dos');
  });

  it('shows an empty state when there are no academies', () => {
    render(<PublicAcademiesDirectory academies={[]} />);

    expect(screen.queryByRole('link', { name: /Academia/ })).not.toBeInTheDocument();
    expect(screen.getByText(/No hay academias disponibles/i)).toBeInTheDocument();
  });
});
