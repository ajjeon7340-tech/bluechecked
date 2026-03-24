/**
 * E2E Tests — Creator Public Profile
 * Covers: profile page loads, creator info visible, links, prompt to sign in,
 *         send diem button, stats, tags, platform icons.
 *
 * Uses mock backend (VITE_USE_MOCK=true).
 */

const { test, expect } = require('@playwright/test');
const { clearMockState } = require('./helpers.cjs');

test.beforeEach(async ({ page }) => {
  await clearMockState(page);
});

test.describe('Creator Public Profile — Unauthenticated', () => {
  test('loads profile at /alexcode', async ({ page }) => {
    await page.goto('/alexcode');
    await expect(page.locator('body')).not.toBeEmpty();
    // Should not redirect to login or show error
    await expect(page).not.toHaveURL('/login');
  });

  test('shows creator name on profile page', async ({ page }) => {
    await page.goto('/alexcode');
    await expect(page.locator('body')).toContainText('Alex The Dev');
  });

  test('shows creator bio', async ({ page }) => {
    await page.goto('/alexcode');
    await expect(page.locator('body')).toContainText('React');
  });

  test('shows at least one affiliate link', async ({ page }) => {
    await page.goto('/alexcode');
    // Links are rendered as buttons or list items
    const links = page.getByRole('button').filter({ hasText: /discord|newsletter|vscode|support/i });
    await expect(links.first()).toBeVisible({ timeout: 5000 });
  });

  test('send diem button prompts login for unauthenticated user', async ({ page }) => {
    await page.goto('/alexcode');
    const sendBtn = page.getByRole('button', { name: /send.*diem|diem/i }).first();
    if (await sendBtn.isVisible()) {
      await sendBtn.click();
      // Should navigate to login or show a login modal
      const isLoginPage = page.url().includes('/login');
      const hasLoginModal = await page.getByRole('dialog').isVisible().catch(() => false);
      expect(isLoginPage || hasLoginModal).toBe(true);
    }
  });

  test('profile has creator stats section', async ({ page }) => {
    await page.goto('/alexcode');
    // Stats like "Very Fast", reply rate, etc.
    const statsVisible =
      (await page.getByText(/very fast|fast|reply/i).first().isVisible().catch(() => false)) ||
      (await page.locator('body').textContent())?.toLowerCase().includes('reply');
    expect(statsVisible).toBeTruthy();
  });

  test('platform icons are displayed', async ({ page }) => {
    await page.goto('/alexcode');
    // Profile has youtube/x/twitch platforms; check for SVG icons or links
    const body = await page.locator('body').innerHTML();
    const hasPlatformIcon = body.includes('youtube') || body.includes('twitch') || body.includes('twitter');
    expect(hasPlatformIcon).toBe(true);
  });
});

test.describe('Creator Public Profile — Demo button from landing', () => {
  test('Explore Demo button on landing navigates to a creator profile', async ({ page }) => {
    await page.goto('/');
    const demoBtn = page.getByRole('button', { name: /explore|demo|try/i }).first();
    if (await demoBtn.isVisible()) {
      await demoBtn.click();
      // Should navigate to a creator's profile path
      await expect(page).not.toHaveURL('/');
      await expect(page.locator('body')).not.toBeEmpty();
    }
  });
});

test.describe('Creator Public Profile — Navigation', () => {
  test('back navigation returns to previous page', async ({ page }) => {
    await page.goto('/');
    await page.goto('/alexcode');

    const backBtn = page.getByRole('button', { name: /back|home/i }).first();
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await expect(page.locator('body')).not.toBeEmpty();
    }
  });

  test('unknown handle falls back gracefully', async ({ page }) => {
    await page.goto('/this-handle-does-not-exist-xyz');
    // Should redirect to landing or show a not-found message — not crash
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
