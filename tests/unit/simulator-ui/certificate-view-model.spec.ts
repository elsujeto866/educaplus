/**
 * toSimulatorCertificateView — structural mapper tests, mirrors
 * `tests/unit/learner-ui/certificate-view-model.spec.ts` (course). Takes a
 * STRUCTURAL param, never the `SimulatorCertificate` domain entity, so this
 * delivery-layer file stays domain-import-free per eslint-plugin-boundaries.
 */

import { describe, it, expect } from 'vitest';
import { toSimulatorCertificateView } from '../../../src/app/dashboard/learn/simulators/[simulatorId]/certificate/_lib/certificate-view-model';

describe('toSimulatorCertificateView', () => {
  it('maps a structural certificate param to a SimulatorCertificateViewModel', () => {
    const issuedAt = new Date('2026-03-15T12:00:00Z');

    const view = toSimulatorCertificateView({
      id: 'cert-1',
      studentName: 'Ada Lovelace',
      simulatorTitle: 'Simulacro de Álgebra',
      academyName: 'Educaplus Academy',
      score: 90,
      certificateCode: 'CERT-2026-ABCD1234',
      issuedAt,
    });

    expect(view.studentName).toBe('Ada Lovelace');
    expect(view.simulatorTitle).toBe('Simulacro de Álgebra');
    expect(view.academyName).toBe('Educaplus Academy');
    expect(view.score).toBe(90);
    expect(view.certificateCode).toBe('CERT-2026-ABCD1234');
  });

  it('formats issuedAt (a Date) into a locale-formatted string', () => {
    const issuedAt = new Date('2026-03-15T12:00:00Z');

    const view = toSimulatorCertificateView({
      id: 'cert-1',
      studentName: 'Ada Lovelace',
      simulatorTitle: 'Simulacro de Álgebra',
      academyName: 'Educaplus Academy',
      score: 90,
      certificateCode: 'CERT-2026-ABCD1234',
      issuedAt,
    });

    expect(typeof view.issuedAtLabel).toBe('string');
    expect(view.issuedAtLabel).not.toBe('');
    expect(view.issuedAtLabel).toBe(
      issuedAt.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' }),
    );
  });
});
