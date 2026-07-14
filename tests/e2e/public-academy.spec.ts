import { test, expect } from '@playwright/test';

/**
 * E2E — public academy page + request-access flow (spec "Known slug renders
 * public page", "Unknown slug returns 404", "Valid email creates pending
 * request", "Resubmission is idempotent").
 *
 * Requires a real dev server (`pnpm dev`, per playwright.config.ts's
 * webServer) backed by a live, migrated database with at least one
 * PUBLISHED academy seeded at a known slug. This repo does not currently
 * check in a fixture academy/slug for e2e — `PUBLIC_ACADEMY_E2E_SLUG` lets a
 * real environment point at one; without it, the known-slug scenarios are
 * skipped rather than failing on missing fixture data (the unknown-slug 404
 * scenario needs no fixture and always runs).
 */

const knownSlug = process.env['PUBLIC_ACADEMY_E2E_SLUG'];

// Needs no fixture data — always runs regardless of PUBLIC_ACADEMY_E2E_SLUG.
test('public academy page — unknown slug returns 404', async ({ page }) => {
  const response = await page.goto('/a/this-slug-does-not-exist-e2e');
  expect(response?.status()).toBe(404);
});

// Nested in its own describe so `test.skip(condition, ...)` — which skips
// EVERY test in its enclosing scope, not just ones declared after it (see
// Playwright docs) — only affects the fixture-dependent scenarios below,
// never the unknown-slug 404 test above.
test.describe('public academy page — known-slug scenarios (fixture required)', () => {
  test.skip(!knownSlug, 'Set PUBLIC_ACADEMY_E2E_SLUG to a published academy slug to run this scenario.');

  test('known slug renders the academy name and a request-access form', async ({ page }) => {
    await page.goto(`/a/${knownSlug}`);

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /solicitar acceso/i })).toBeVisible();
  });

  test('submitting a valid email shows a confirmation, and resubmitting is idempotent', async ({ page }) => {
    const email = `e2e-${Date.now()}@student.com`;
    await page.goto(`/a/${knownSlug}`);

    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: /solicitar acceso/i }).click();
    await expect(page.getByRole('status')).toContainText(/solicitud enviada/i);

    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: /solicitar acceso/i }).click();
    await expect(page.getByRole('status')).toContainText(/ya tenés una solicitud pendiente/i);
  });
});
