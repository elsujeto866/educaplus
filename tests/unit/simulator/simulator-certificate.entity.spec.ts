import { describe, it, expect } from 'vitest';
import { SimulatorCertificate } from '../../../src/modules/simulator/domain/simulator-certificate.entity';

const now = new Date('2026-07-01T00:00:00Z');

function makeProps(
  overrides: Partial<ConstructorParameters<typeof SimulatorCertificate>[0]> = {},
): ConstructorParameters<typeof SimulatorCertificate>[0] {
  return {
    id: 'cert-1',
    simulatorId: 'sim-1',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    certificateCode: 'CERT-2026-ABCD1234',
    score: 100,
    studentName: 'Jane Student',
    simulatorTitle: 'Simulator One',
    academyName: 'Academy A',
    issuedAt: now,
    ...overrides,
  };
}

describe('SimulatorCertificate', () => {
  it('can be instantiated with valid props', () => {
    const cert = new SimulatorCertificate(makeProps());
    expect(cert.id).toBe('cert-1');
    expect(cert.simulatorId).toBe('sim-1');
    expect(cert.academyId).toBe('org_A');
    expect(cert.clerkUserId).toBe('user_1');
    expect(cert.certificateCode).toBe('CERT-2026-ABCD1234');
    expect(cert.score).toBe(100);
    expect(cert.studentName).toBe('Jane Student');
    expect(cert.simulatorTitle).toBe('Simulator One');
    expect(cert.academyName).toBe('Academy A');
    expect(cert.issuedAt).toBe(now);
  });

  it('throws when id is missing', () => {
    expect(() => new SimulatorCertificate(makeProps({ id: '' }))).toThrow(/id is required/);
  });

  it('throws when simulatorId is missing', () => {
    expect(() => new SimulatorCertificate(makeProps({ simulatorId: '' }))).toThrow(
      /simulatorId is required/,
    );
  });

  it('throws when academyId is missing', () => {
    expect(() => new SimulatorCertificate(makeProps({ academyId: '' }))).toThrow(
      /academyId is required/,
    );
  });

  it('throws when clerkUserId is missing', () => {
    expect(() => new SimulatorCertificate(makeProps({ clerkUserId: '' }))).toThrow(
      /clerkUserId is required/,
    );
  });

  it('throws when certificateCode is missing', () => {
    expect(() => new SimulatorCertificate(makeProps({ certificateCode: '' }))).toThrow(
      /certificateCode is required/,
    );
  });

  it('throws when studentName is missing', () => {
    expect(() => new SimulatorCertificate(makeProps({ studentName: '' }))).toThrow(
      /studentName is required/,
    );
  });

  it('throws when simulatorTitle is missing', () => {
    expect(() => new SimulatorCertificate(makeProps({ simulatorTitle: '' }))).toThrow(
      /simulatorTitle is required/,
    );
  });

  it('throws when academyName is missing', () => {
    expect(() => new SimulatorCertificate(makeProps({ academyName: '' }))).toThrow(
      /academyName is required/,
    );
  });

  it.each([-1, 101, 1.5, NaN])('rejects a non-integer/out-of-range score (%s)', (score) => {
    expect(() => new SimulatorCertificate(makeProps({ score }))).toThrow(
      /score must be an integer between 0 and 100/,
    );
  });

  it.each([0, 50, 100])('accepts boundary scores (%s)', (score) => {
    expect(() => new SimulatorCertificate(makeProps({ score }))).not.toThrow();
  });
});
