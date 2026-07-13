import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardError from '../../../src/app/dashboard/error';

describe('DashboardError boundary', () => {
  it('renders a recoverable message with the error detail instead of crashing', () => {
    render(<DashboardError error={new Error('boom from a server component')} reset={vi.fn()} />);

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    expect(screen.getByText(/boom from a server component/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('calls reset() when the user retries', () => {
    const reset = vi.fn();
    render(<DashboardError error={new Error('boom')} reset={reset} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(reset).toHaveBeenCalledOnce();
  });

  it('falls back to a generic detail when the error has no message', () => {
    render(<DashboardError error={new Error('')} reset={vi.fn()} />);

    expect(screen.getByText('Error desconocido.')).toBeInTheDocument();
  });
});
