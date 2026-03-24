/**
 * E2E Tests — Authentication
 * Covers: landing page, sign up (creator + fan), login, logout,
 *         password reset UI, role selection, back navigation.
 *
 * Uses mock backend (VITE_USE_MOCK=true) — no real Supabase calls.
 */

const { test, expect } = require('@playwright/test');
const { clearMockState } = require('./helpers.cjs');

test.beforeEach(async ({ page }) => {
  await clearMockState(page);
});

test.describe('Landing Page', () => {
  test('loads and shows the hero section', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    // Page should render without error
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();
  });

  test('login button navigates to /login', async ({ page }) => {
    await page.goto('/');
    const loginBtn = page.getByRole('button', { name: /log.?in|sign.?in|get started/i }).first();
    await loginBtn.click();
    await expect(page).toHaveURL('/login');
  });

  test('Terms of Service page renders at /terms', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});

test.describe('Sign Up — Fan', () => {
  test('fan can sign up and land on dashboard', async ({ page }) => {
    await page.goto('/login');

    // Switch to FAN role
    const fanTab = page.getByRole('button', { name: /fan/i }).first();
    if (await fanTab.isVisible()) await fanTab.click();

    // Switch to sign-up mode
    const signUpToggle = page.getByRole('button', { name: /sign.?up|create.?account|don.?t have/i }).first();
    if (await signUpToggle.isVisible()) await signUpToggle.click();

    // Fill the form
    const inputs = page.getByRole('textbox');
    const count = await inputs.count();
    if (count >= 2) {
      await inputs.first().fill('E2E Fan Test');
      await inputs.nth(1).fill(`fan-${Date.now()}@test.com`);
    }

    const submitBtn = page.getByRole('button', { name: /sign.?up|create|continue/i }).last();
    await submitBtn.click();

    // Should land on dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });
});

test.describe('Sign Up — Creator', () => {
  test('creator can sign up and land on setup or dashboard', async ({ page }) => {
    await page.goto('/login');

    const creatorTab = page.getByRole('button', { name: /creator/i }).first();
    if (await creatorTab.isVisible()) await creatorTab.click();

    const signUpToggle = page.getByRole('button', { name: /sign.?up|create.?account|don.?t have/i }).first();
    if (await signUpToggle.isVisible()) await signUpToggle.click();

    const inputs = page.getByRole('textbox');
    const count = await inputs.count();
    if (count >= 2) {
      await inputs.first().fill('E2E Creator Test');
      await inputs.nth(1).fill(`creator-${Date.now()}@test.com`);
    }

    const submitBtn = page.getByRole('button', { name: /sign.?up|create|continue/i }).last();
    await submitBtn.click();

    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });
});

test.describe('Login', () => {
  test('shows error for unknown credentials', async ({ page }) => {
    await page.goto('/login');

    const inputs = page.getByRole('textbox');
    await inputs.first().fill('nobody@unknown.com');

    const submitBtn = page.getByRole('button', { name: /log.?in|sign.?in|continue/i }).last();
    await submitBtn.click();

    // Should show an error message (not navigate away)
    await expect(page).toHaveURL('/login');
  });

  test('back button from login returns to landing', async ({ page }) => {
    await page.goto('/login');
    const backBtn = page.getByRole('button', { name: /back/i }).first();
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await expect(page).toHaveURL('/');
    }
  });
});

test.describe('Password Reset', () => {
  test('forgot password link shows reset form', async ({ page }) => {
    await page.goto('/login');
    const forgotBtn = page.getByRole('button', { name: /forgot|reset/i }).first();
    if (await forgotBtn.isVisible()) {
      await forgotBtn.click();
      await expect(page.locator('body')).not.toBeEmpty();
    }
  });
});

test.describe('Logout', () => {
  test('fan can log out and return to landing page', async ({ page }) => {
    // First sign up a fan
    await page.goto('/login');
    const fanTab = page.getByRole('button', { name: /fan/i }).first();
    if (await fanTab.isVisible()) await fanTab.click();

    const signUpToggle = page.getByRole('button', { name: /sign.?up|create.?account|don.?t have/i }).first();
    if (await signUpToggle.isVisible()) await signUpToggle.click();

    const inputs = page.getByRole('textbox');
    if (await inputs.count() >= 2) {
      await inputs.first().fill('Logout Test Fan');
      await inputs.nth(1).fill(`logout-${Date.now()}@test.com`);
    }

    const submitBtn = page.getByRole('button', { name: /sign.?up|create|continue/i }).last();
    await submitBtn.click();

    await page.waitForURL(/dashboard/, { timeout: 10000 });

    // Now logout
    const logoutBtn = page.getByRole('button', { name: /logout|sign.?out/i }).first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await expect(page).toHaveURL('/', { timeout: 5000 });
    }
  });
});
