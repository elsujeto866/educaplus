import { test, expect } from '@playwright/test';

test('landing page loads and shows a visible landmark', async ({ page }) => {
  await page.goto('/');
  // Either a main element or an h1 must be visible
  const main = page.locator('main');
  const h1 = page.locator('h1');

  const mainVisible = await main.isVisible().catch(() => false);
  const h1Visible = await h1.isVisible().catch(() => false);

  expect(mainVisible || h1Visible).toBe(true);
});
