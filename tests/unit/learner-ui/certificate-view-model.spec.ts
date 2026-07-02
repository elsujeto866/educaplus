/**
 * toCertificateView — structural mapper tests (design.md's "VM boundary":
 * the mapper takes a STRUCTURAL param, never the `Certificate` domain
 * entity, so this delivery-layer file stays domain-import-free per
 * eslint-plugin-boundaries). Verifies every field is passed through and
 * `issuedAt` (a `Date`) is formatted to a locale string.
 */

import { describe, it, expect } from 'vitest';
import { toCertificateView } from '../../../src/app/dashboard/learn/courses/[courseId]/certificate/_lib/certificate-view-model';

describe('toCertificateView', () => {
  it('maps a structural certificate param to a CertificateViewModel', () => {
    const issuedAt = new Date('2026-03-15T12:00:00Z');

    const view = toCertificateView({
      id: 'cert-1',
      studentName: 'Ada Lovelace',
      courseTitle: 'Intro to TypeScript',
      academyName: 'Educaplus Academy',
      score: 90,
      certificateCode: 'CERT-2026-ABCD1234',
      issuedAt,
    });

    expect(view.studentName).toBe('Ada Lovelace');
    expect(view.courseTitle).toBe('Intro to TypeScript');
    expect(view.academyName).toBe('Educaplus Academy');
    expect(view.score).toBe(90);
    expect(view.certificateCode).toBe('CERT-2026-ABCD1234');
  });

  it('formats issuedAt (a Date) into a locale-formatted string', () => {
    const issuedAt = new Date('2026-03-15T12:00:00Z');

    const view = toCertificateView({
      id: 'cert-1',
      studentName: 'Ada Lovelace',
      courseTitle: 'Intro to TypeScript',
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
