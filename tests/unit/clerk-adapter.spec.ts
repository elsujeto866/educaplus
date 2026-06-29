import { describe, it, expect, vi } from 'vitest';

// Mock @clerk/nextjs/server before any import that pulls clerk.ts,
// because @clerk/nextjs/server uses server-only guards that throw outside
// the Next.js runtime. The mock prevents those guards from loading.
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

import { mapClerkRole } from '../../src/shared/infrastructure/auth/clerk';

describe('mapClerkRole', () => {
  it('maps org:admin to admin', () => {
    expect(mapClerkRole('org:admin')).toBe('admin');
  });

  it('maps org:instructor to instructor', () => {
    expect(mapClerkRole('org:instructor')).toBe('instructor');
  });

  it('maps org:member to student (default)', () => {
    expect(mapClerkRole('org:member')).toBe('student');
  });

  it('maps null to student (no active org)', () => {
    expect(mapClerkRole(null)).toBe('student');
  });

  it('maps undefined to student (missing role)', () => {
    expect(mapClerkRole(undefined)).toBe('student');
  });

  it('maps an unknown custom role to student', () => {
    expect(mapClerkRole('org:moderator')).toBe('student');
  });
});
