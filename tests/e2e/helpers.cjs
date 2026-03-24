/**
 * Shared E2E helpers for Playwright tests.
 * All helpers use the mock backend (VITE_USE_MOCK=true).
 */

const { expect } = require('@playwright/test');

const TEST_FAN_EMAIL = 'e2e-fan@test.com';
const TEST_FAN_NAME = 'E2E Fan';
const TEST_CREATOR_EMAIL = 'e2e-creator@test.com';
const TEST_CREATOR_NAME = 'E2E Creator';

/**
 * Clear mock backend state stored in localStorage.
 */
async function clearMockState(page) {
  await page.evaluate(() => {
    const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('diem_'));
    keysToRemove.forEach(k => localStorage.removeItem(k));
  });
}

/**
 * Sign up a new FAN user via the UI.
 */
async function signUpAsFan(page, email = TEST_FAN_EMAIL, name = TEST_FAN_NAME) {
  await page.goto('/login');

  // Switch to FAN tab if needed
  const fanTab = page.getByRole('button', { name: /fan/i }).first();
  if (await fanTab.isVisible()) await fanTab.click();

  // Switch to sign-up mode
  const signUpLink = page.getByRole('button', { name: /sign.?up|create.?account/i }).first();
  if (await signUpLink.isVisible()) await signUpLink.click();

  // Fill in form
  const nameInput = page.getByRole('textbox').first();
  await nameInput.fill(name);

  const emailInput = page.getByRole('textbox').filter({ hasText: /./ }).nth(1);
  await emailInput.fill(email);

  // Submit
  const submitBtn = page.getByRole('button', { name: /sign.?up|create|continue/i }).last();
  await submitBtn.click();

  await page.waitForURL(/dashboard/, { timeout: 10000 });
}

/**
 * Sign up a CREATOR user via the UI.
 */
async function signUpAsCreator(page, email = TEST_CREATOR_EMAIL, name = TEST_CREATOR_NAME) {
  await page.goto('/login');

  const creatorTab = page.getByRole('button', { name: /creator/i }).first();
  if (await creatorTab.isVisible()) await creatorTab.click();

  const signUpLink = page.getByRole('button', { name: /sign.?up|create.?account/i }).first();
  if (await signUpLink.isVisible()) await signUpLink.click();

  const inputs = page.getByRole('textbox');
  await inputs.first().fill(name);
  await inputs.nth(1).fill(email);

  const submitBtn = page.getByRole('button', { name: /sign.?up|create|continue/i }).last();
  await submitBtn.click();

  await page.waitForURL(/dashboard/, { timeout: 10000 });
}

/**
 * Navigate to the first creator profile in the explore section.
 */
async function navigateToFirstCreator(page) {
  await page.goto('/');
  const demoBtn = page.getByRole('button', { name: /explore|demo|try/i }).first();
  if (await demoBtn.isVisible()) await demoBtn.click();
  await page.waitForURL(/\/[^/]+/, { timeout: 5000 });
}

module.exports = { clearMockState, signUpAsFan, signUpAsCreator, navigateToFirstCreator, TEST_FAN_EMAIL, TEST_FAN_NAME, TEST_CREATOR_EMAIL, TEST_CREATOR_NAME };
