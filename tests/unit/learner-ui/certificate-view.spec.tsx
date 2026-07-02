/**
 * CertificateView — presentational, prop-only tests (spec.md's
 * "Certificate View Rendering" + "Presentational Boundary"). Renders
 * ONLY from a `CertificateViewModel` prop — no internal data fetching.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CertificateView } from '../../../src/app/dashboard/learn/courses/[courseId]/certificate/_components/certificate-view';
import type { CertificateViewModel } from '../../../src/app/dashboard/learn/courses/[courseId]/certificate/_lib/certificate-view-model';

const view: CertificateViewModel = {
  studentName: 'Ada Lovelace',
  courseTitle: 'Intro to TypeScript',
  academyName: 'Educaplus Academy',
  score: 90,
  issuedAtLabel: '15 de marzo de 2026',
  certificateCode: 'CERT-2026-ABCD1234',
};

describe('CertificateView', () => {
  it('renders the student name, course title, academy name, score, date, and code from the prop', () => {
    render(<CertificateView view={view} />);

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Intro to TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Educaplus Academy')).toBeInTheDocument();
    expect(screen.getByText(/90/)).toBeInTheDocument();
    expect(screen.getByText('15 de marzo de 2026')).toBeInTheDocument();
    expect(screen.getByText('CERT-2026-ABCD1234')).toBeInTheDocument();
  });
});
