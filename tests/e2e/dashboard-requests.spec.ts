import { test, expect } from '@playwright/test';

/**
 * E2E — admin approval queue (spec "Role- and Tenant-Scoped Queue Access",
 * "Student role denied", "Cross-academy isolation", "Approve Sends
 * Invitation", "Reject Closes Request").
 *
 * Unlike `public-academy.spec.ts`, EVERY scenario in this route needs an
 * authenticated Clerk session (admin/instructor or student) — there is no
 * unauthenticated-and-still-observable scenario analogous to the public
 * page's "unknown slug -> 404" that needs zero fixtures, because Next
 * middleware redirects an unauthenticated visitor before this page's own
 * `requireInstructor` guard ever runs (that redirect is Clerk middleware's
 * behavior, already covered generically by existing middleware tests — not
 * re-asserted here). This repo has no pre-authenticated Playwright
 * `storageState` fixtures checked in and no live Clerk test users configured
 * in this sandbox (see apply-progress: no `.env`/Clerk keys available) —
 * every scenario below is gated behind env vars and SKIPPED, not run, in
 * this environment.
 *
 * IMPORTANT — "approve sends invitation" cannot be verified end-to-end here
 * even with real Clerk keys wired: this suite has no HTTP-level interception
 * of Clerk's API, so it can only assert the OBSERVABLE UI effect (the
 * approved row disappears from the pending queue), not the actual Clerk
 * invitation payload — that is covered by the unit-level
 * `clerk-invitation.adapter.spec.ts` (mocked clerkClient) instead.
 */

const adminStorageState = process.env['DASHBOARD_REQUESTS_E2E_ADMIN_STORAGE_STATE'];
const studentStorageState = process.env['DASHBOARD_REQUESTS_E2E_STUDENT_STORAGE_STATE'];
const otherAcademyRequestEmail = process.env['DASHBOARD_REQUESTS_E2E_OTHER_ACADEMY_EMAIL'];

test.describe('admin approval queue — admin/instructor scenarios (fixture required)', () => {
  test.skip(
    !adminStorageState,
    'Set DASHBOARD_REQUESTS_E2E_ADMIN_STORAGE_STATE to a Playwright storageState JSON path for an authenticated admin/instructor session to run this scenario.',
  );

  test.use({ storageState: adminStorageState });

  test('admin sees own-academy pending requests only', async ({ page }) => {
    await page.goto('/dashboard/requests');

    await expect(page.getByRole('heading', { name: 'Solicitudes' })).toBeVisible();
    if (otherAcademyRequestEmail) {
      await expect(page.getByText(otherAcademyRequestEmail)).toHaveCount(0);
    }
  });

  test('approve removes the request from the pending queue', async ({ page }) => {
    await page.goto('/dashboard/requests');

    const firstRow = page.getByRole('listitem').first();
    const email = await firstRow.locator('span').first().textContent();
    await firstRow.getByRole('button', { name: 'Aprobar' }).click();

    if (email) {
      await expect(page.getByText(email)).toHaveCount(0);
    }
  });

  test('reject removes the request from the pending queue', async ({ page }) => {
    await page.goto('/dashboard/requests');

    const firstRow = page.getByRole('listitem').first();
    const email = await firstRow.locator('span').first().textContent();
    await firstRow.getByRole('button', { name: 'Rechazar' }).click();

    if (email) {
      await expect(page.getByText(email)).toHaveCount(0);
    }
  });
});

test.describe('admin approval queue — student scenario (fixture required)', () => {
  test.skip(
    !studentStorageState,
    'Set DASHBOARD_REQUESTS_E2E_STUDENT_STORAGE_STATE to a Playwright storageState JSON path for an authenticated student session to run this scenario.',
  );

  test.use({ storageState: studentStorageState });

  test('student is denied access to the queue (spec: Student role denied)', async ({ page }) => {
    await page.goto('/dashboard/requests');

    await expect(page).not.toHaveURL(/\/dashboard\/requests$/);
  });
});
