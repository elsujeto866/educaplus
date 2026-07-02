import { describe, it, expect } from 'vitest';
import { Certificate } from '../../../src/modules/course/domain/certificate.entity';

const now = new Date('2026-07-01T00:00:00Z');

function makeProps(
  overrides: Partial<ConstructorParameters<typeof Certificate>[0]> = {},
): ConstructorParameters<typeof Certificate>[0] {
  return {
    id: 'cert-1',
    courseId: 'course-1',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    certificateCode: 'CERT-2026-ABCD1234',
    score: 100,
    studentName: 'Jane Student',
    courseTitle: 'Course One',
    academyName: 'Academy A',
    issuedAt: now,
    ...overrides,
  };
}

describe('Certificate', () => {
  it('can be instantiated with valid props', () => {
    const cert = new Certificate(makeProps());
    expect(cert.id).toBe('cert-1');
    expect(cert.courseId).toBe('course-1');
    expect(cert.academyId).toBe('org_A');
    expect(cert.clerkUserId).toBe('user_1');
    expect(cert.certificateCode).toBe('CERT-2026-ABCD1234');
    expect(cert.score).toBe(100);
    expect(cert.studentName).toBe('Jane Student');
    expect(cert.courseTitle).toBe('Course One');
    expect(cert.academyName).toBe('Academy A');
    expect(cert.issuedAt).toBe(now);
  });

  it('throws when id is missing', () => {
    expect(() => new Certificate(makeProps({ id: '' }))).toThrow(/id is required/);
  });

  it('throws when courseId is missing', () => {
    expect(() => new Certificate(makeProps({ courseId: '' }))).toThrow(/courseId is required/);
  });

  it('throws when academyId is missing', () => {
    expect(() => new Certificate(makeProps({ academyId: '' }))).toThrow(/academyId is required/);
  });

  it('throws when clerkUserId is missing', () => {
    expect(() => new Certificate(makeProps({ clerkUserId: '' }))).toThrow(
      /clerkUserId is required/,
    );
  });

  it('throws when certificateCode is missing', () => {
    expect(() => new Certificate(makeProps({ certificateCode: '' }))).toThrow(
      /certificateCode is required/,
    );
  });

  it('throws when studentName is missing', () => {
    expect(() => new Certificate(makeProps({ studentName: '' }))).toThrow(
      /studentName is required/,
    );
  });

  it('throws when courseTitle is missing', () => {
    expect(() => new Certificate(makeProps({ courseTitle: '' }))).toThrow(
      /courseTitle is required/,
    );
  });

  it('throws when academyName is missing', () => {
    expect(() => new Certificate(makeProps({ academyName: '' }))).toThrow(
      /academyName is required/,
    );
  });

  it.each([-1, 101, 1.5, NaN])('rejects a non-integer/out-of-range score (%s)', (score) => {
    expect(() => new Certificate(makeProps({ score }))).toThrow(
      /score must be an integer between 0 and 100/,
    );
  });

  it.each([0, 50, 100])('accepts boundary scores (%s)', (score) => {
    expect(() => new Certificate(makeProps({ score }))).not.toThrow();
  });
});
