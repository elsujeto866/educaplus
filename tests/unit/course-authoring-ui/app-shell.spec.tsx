import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from '../../../src/shared/ui/organisms/app-shell';

describe('AppShell navSlot', () => {
  it('renders the given navSlot content in the header', () => {
    render(
      <AppShell navSlot={<a href="/dashboard/courses">Cursos</a>}>
        <p>content</p>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'Cursos' })).toBeInTheDocument();
  });

  it('renders nothing extra in the header when navSlot is omitted', () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
