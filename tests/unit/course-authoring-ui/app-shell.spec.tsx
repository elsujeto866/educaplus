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

describe('AppShell sidebar slot', () => {
  it('renders a single pane (no aside) when no sidebar prop is passed', () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('content');
  });

  it('renders a two-pane layout (aside + main) when a sidebar prop is passed', () => {
    render(
      <AppShell sidebar={<p>Sidebar content</p>}>
        <p>Main content</p>
      </AppShell>,
    );

    expect(screen.getByRole('complementary')).toHaveTextContent('Sidebar content');
    expect(screen.getByRole('main')).toHaveTextContent('Main content');
  });
});
