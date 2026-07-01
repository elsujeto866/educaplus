/**
 * CourseWizardSteps — presentational molecule tests. Covers spec.md's
 * "CourseWizardSteps Presentational Contract" requirement: each status
 * renders a distinct marker, `aria-current="step"` marks the current step,
 * and the locked step is non-interactive (no link, `aria-disabled`).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CourseWizardSteps } from '../../../src/shared/ui/molecules/course-wizard-steps';

const steps = [
  { id: 'datos', label: 'Datos', status: 'completed' as const, href: '/dashboard/courses/c1' },
  { id: 'modulos', label: 'Módulos', status: 'current' as const, href: '/dashboard/courses/c1' },
  { id: 'lecciones', label: 'Lecciones', status: 'upcoming' as const, href: '/dashboard/courses/c1' },
  { id: 'evaluacion-final', label: 'Evaluación final', status: 'locked' as const },
  { id: 'publicar', label: 'Publicar', status: 'upcoming' as const, href: '/dashboard/courses/c1' },
];

describe('CourseWizardSteps', () => {
  it('renders every step label', () => {
    render(<CourseWizardSteps steps={steps} />);

    for (const step of steps) {
      expect(screen.getByText(step.label)).toBeInTheDocument();
    }
  });

  it('marks the current step with aria-current="step"', () => {
    render(<CourseWizardSteps steps={steps} />);

    const current = screen.getByText('Módulos').closest('[aria-current="step"]');
    expect(current).not.toBeNull();
    expect(screen.getByText('Datos').closest('[aria-current="step"]')).toBeNull();
  });

  it('renders the locked step as non-interactive (no link, aria-disabled)', () => {
    render(<CourseWizardSteps steps={steps} />);

    expect(screen.queryByRole('link', { name: /Evaluación final/ })).not.toBeInTheDocument();
    const locked = screen.getByText('Evaluación final').closest('[aria-disabled]');
    expect(locked).not.toBeNull();
    expect(locked).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders completed and current steps with href as links', () => {
    render(<CourseWizardSteps steps={steps} />);

    expect(screen.getByRole('link', { name: /Datos/ })).toHaveAttribute(
      'href',
      '/dashboard/courses/c1',
    );
    expect(screen.getByRole('link', { name: /Módulos/ })).toHaveAttribute(
      'href',
      '/dashboard/courses/c1',
    );
  });

  it('renders upcoming steps as plain (non-link) text', () => {
    render(<CourseWizardSteps steps={steps} />);

    expect(screen.queryByRole('link', { name: /^Lecciones$/ })).not.toBeInTheDocument();
    expect(screen.getByText('Lecciones')).toBeInTheDocument();
  });
});
