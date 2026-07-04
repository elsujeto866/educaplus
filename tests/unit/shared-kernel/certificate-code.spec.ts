import { describe, it, expect } from 'vitest';
import { formatCertificateCode } from '../../../src/shared/kernel/certificate-code';

describe('shared/kernel/certificate-code — formatCertificateCode', () => {
  it('formats as CERT-{year}-{8 hex chars, uppercased, dashes stripped}', () => {
    const id = 'ab12cd34-0000-0000-0000-000000000000';
    const issuedAt = new Date('2026-07-01T00:00:00Z');

    expect(formatCertificateCode(id, issuedAt)).toBe('CERT-2026-AB12CD34');
  });

  it('is deterministic: same id + issuedAt produce the same code on repeated calls', () => {
    const id = 'ffeeddcc-1111-2222-3333-444455556666';
    const issuedAt = new Date('2025-01-15T12:30:00Z');

    const first = formatCertificateCode(id, issuedAt);
    const second = formatCertificateCode(id, issuedAt);

    expect(first).toBe(second);
    expect(first).toBe('CERT-2025-FFEEDDCC');
  });

  it('derives the year from issuedAt, not from the current date', () => {
    const id = '11112222-3333-4444-5555-666677778888';
    const issuedAt = new Date('2020-12-31T23:59:59Z');

    expect(formatCertificateCode(id, issuedAt)).toBe('CERT-2020-11112222');
  });

  it('strips dashes and uppercases lowercase hex from the id', () => {
    const id = 'deadbeef-aaaa-bbbb-cccc-dddddddddddd';
    const issuedAt = new Date('2026-01-01T00:00:00Z');

    expect(formatCertificateCode(id, issuedAt)).toBe('CERT-2026-DEADBEEF');
  });
});
