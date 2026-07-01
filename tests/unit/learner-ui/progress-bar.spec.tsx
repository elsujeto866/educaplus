import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../../../src/shared/ui/molecules/progress-bar';

describe('ProgressBar', () => {
  it('exposes the given value as the accessible progress value', () => {
    render(<ProgressBar value={45} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '45');
  });

  it('clamps a value above 100 down to 100', () => {
    render(<ProgressBar value={150} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('clamps a negative value up to 0', () => {
    render(<ProgressBar value={-20} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('uses the label as the accessible name when provided', () => {
    render(<ProgressBar value={60} label="Progreso del curso" />);
    expect(screen.getByRole('progressbar', { name: 'Progreso del curso' })).toBeInTheDocument();
    expect(screen.getByText('Progreso del curso')).toBeInTheDocument();
  });
});
