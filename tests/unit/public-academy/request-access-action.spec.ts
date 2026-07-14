/**
 * requestAccessAction unit tests — the public, untenanted Server Action for
 * /a/[slug]'s request-access form.
 *
 * Deliberately does NOT mock '@/shared/infrastructure/auth/clerk' — the
 * action must never call getTenantContext() (public path, design D1). If a
 * future change accidentally imports it, this test file's absence of that
 * mock will surface as a hard failure (real Clerk server guards throw
 * outside the Next.js runtime), which is the intended regression guard.
 *
 * Mocks:
 *  - '@/modules/academy/composition' → makeAcademyComposition
 *    (getPublicAcademy.execute resolves academyId server-side from slug —
 *    spec "academy_id is set server-side from the slug resolution, never
 *    client input")
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RequestAccessActionResult } from '../../../src/app/a/[slug]/_lib/action-result';

const getPublicAcademyExecuteMock = vi.fn();
const requestAccessExecuteMock = vi.fn();
vi.mock('../../../src/modules/academy/composition', () => ({
  makeAcademyComposition: () => ({
    getPublicAcademy: { execute: getPublicAcademyExecuteMock },
    requestAccess: { execute: requestAccessExecuteMock },
  }),
}));

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const initialState: RequestAccessActionResult = { ok: false, error: '' };
const publicAcademy = { id: 'org_A', name: 'Academy A', slug: 'academy-a' };

describe('requestAccessAction', () => {
  beforeEach(() => {
    getPublicAcademyExecuteMock.mockReset().mockResolvedValue(publicAcademy);
    requestAccessExecuteMock.mockReset();
  });

  it('rejects an empty email WITHOUT resolving the academy or calling the use-case', async () => {
    const { requestAccessAction } = await import('../../../src/app/a/[slug]/actions');

    const result = await requestAccessAction('academy-a', initialState, formDataWith({ email: '' }));

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(getPublicAcademyExecuteMock).not.toHaveBeenCalled();
    expect(requestAccessExecuteMock).not.toHaveBeenCalled();
  });

  it('resolves academyId from the slug server-side and creates a pending request', async () => {
    requestAccessExecuteMock.mockResolvedValue({ outcome: 'created' });
    const { requestAccessAction } = await import('../../../src/app/a/[slug]/actions');

    const result = await requestAccessAction(
      'academy-a',
      initialState,
      formDataWith({ email: ' New@Student.com ' }),
    );

    expect(getPublicAcademyExecuteMock).toHaveBeenCalledWith('academy-a');
    expect(requestAccessExecuteMock).toHaveBeenCalledWith(
      expect.objectContaining({ academyId: 'org_A', email: 'New@Student.com' }),
    );
    expect(result).toEqual({ ok: true, message: expect.any(String) });
  });

  it('returns an informative (not failure) result when the request is already pending', async () => {
    requestAccessExecuteMock.mockResolvedValue({ outcome: 'already-pending' });
    const { requestAccessAction } = await import('../../../src/app/a/[slug]/actions');

    const result = await requestAccessAction(
      'academy-a',
      initialState,
      formDataWith({ email: 'new@student.com' }),
    );

    expect(result).toEqual({ ok: true, message: expect.any(String) });
  });

  it('maps an invalid-email domain error to a Spanish ActionResult without throwing', async () => {
    const invalidEmail = new Error('Invalid email "not-an-email": must be a well-formed email address.');
    requestAccessExecuteMock.mockRejectedValue(invalidEmail);
    const { requestAccessAction } = await import('../../../src/app/a/[slug]/actions');

    const result = await requestAccessAction(
      'academy-a',
      initialState,
      formDataWith({ email: 'not-an-email' }),
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });

  it('returns a generic failure when the slug does not resolve to a published academy', async () => {
    getPublicAcademyExecuteMock.mockResolvedValue(null);
    const { requestAccessAction } = await import('../../../src/app/a/[slug]/actions');

    const result = await requestAccessAction(
      'ghost-academy',
      initialState,
      formDataWith({ email: 'new@student.com' }),
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(requestAccessExecuteMock).not.toHaveBeenCalled();
  });
});
