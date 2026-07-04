/**
 * SimulatorCertificateView — presentational, prop-only tests. Mirrors
 * `tests/unit/learner-ui/certificate-view.spec.tsx` (course). Renders ONLY
 * from a `SimulatorCertificateViewModel` prop — no internal data fetching.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SimulatorCertificateView } from '../../../src/app/dashboard/learn/simulators/[simulatorId]/certificate/_components/certificate-view';
import type { SimulatorCertificateViewModel } from '../../../src/app/dashboard/learn/simulators/[simulatorId]/certificate/_lib/certificate-view-model';

const view: SimulatorCertificateViewModel = {
  studentName: 'Ada Lovelace',
  simulatorTitle: 'Simulacro de Álgebra',
  academyName: 'Educaplus Academy',
  score: 90,
  issuedAtLabel: '15 de marzo de 2026',
  certificateCode: 'CERT-2026-ABCD1234',
};

describe('SimulatorCertificateView', () => {
  it('renders the student name, simulator title, academy name, score, date, and code from the prop', () => {
    render(<SimulatorCertificateView view={view} />);

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Simulacro de Álgebra')).toBeInTheDocument();
    expect(screen.getByText('Educaplus Academy')).toBeInTheDocument();
    expect(screen.getByText(/90/)).toBeInTheDocument();
    expect(screen.getByText('15 de marzo de 2026')).toBeInTheDocument();
    expect(screen.getByText('CERT-2026-ABCD1234')).toBeInTheDocument();
  });
});
