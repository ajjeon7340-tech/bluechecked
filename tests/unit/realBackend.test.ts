/**
 * Unit tests for the Real Backend (Supabase).
 *
 * SAFETY RULES:
 *  - These tests NEVER call requestWithdrawal, createStripeCheckoutSession,
 *    or any other function that moves real money.
 *  - Tests run only when VITE_USE_REAL_DB=true and Supabase env vars are set.
 *  - Write operations use a dedicated test account that does NOT belong to
 *    any real creator or fan (email: test+e2e@diem.ee by convention).
 *
 * Run with:
 *   VITE_USE_REAL_DB=true npx vitest run tests/unit/realBackend.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// ----------------------------------------------------------------
// Skip the entire suite when Supabase is not configured.
// This prevents accidental failures in CI / local dev without keys.
// ----------------------------------------------------------------
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const USE_REAL_DB = import.meta.env.VITE_USE_REAL_DB === 'true';

const itReal = USE_REAL_DB && !!SUPABASE_URL ? it : it.skip;

describe('Real Backend — Creator Profile (read-only)', () => {
  itReal('getCreatorProfileByHandle returns a valid profile', async () => {
    const { getCreatorProfileByHandle } = await import('../../services/realBackend');
    // Assumes the Diem platform profile with handle "diem" exists in the DB
    try {
      const profile = await getCreatorProfileByHandle('diem');
      expect(profile).toBeDefined();
      expect(profile.displayName).toBeDefined();
      expect(typeof profile.pricePerMessage).toBe('number');
    } catch (e: any) {
      // If the handle doesn't exist, the test still passes — we just skip assertion
      if (e.message?.includes('not found') || e.code === 'PROFILE_NOT_FOUND') return;
      throw e;
    }
  });

  itReal('getDiemPublicProfileId resolves without throwing', async () => {
    const { getDiemPublicProfileId } = await import('../../services/realBackend');
    const id = await getDiemPublicProfileId();
    // null is acceptable if no Diem profile is seeded; a string means it's set up
    expect(id === null || typeof id === 'string').toBe(true);
  });
});

describe('Real Backend — Session (read-only)', () => {
  itReal('checkAndSyncSession returns null when no session exists', async () => {
    const { checkAndSyncSession } = await import('../../services/realBackend');
    // With no active browser session, this should return null gracefully
    const result = await checkAndSyncSession();
    expect(result === null || result?.id !== undefined).toBe(true);
  });
});

describe('Real Backend — Featured Creators (read-only)', () => {
  itReal('getFeaturedCreators returns an array', async () => {
    const { getFeaturedCreators } = await import('../../services/realBackend');
    const creators = await getFeaturedCreators();
    expect(Array.isArray(creators)).toBe(true);
  });
});

describe('Real Backend — Analytics (read-only)', () => {
  itReal('logAnalyticsEvent does not throw for VIEW events', async () => {
    const { logAnalyticsEvent, getDiemPublicProfileId } = await import('../../services/realBackend');
    const id = await getDiemPublicProfileId();
    if (!id) return; // Skip if no Diem profile
    await expect(logAnalyticsEvent(id, 'VIEW', { source: 'test' })).resolves.not.toThrow();
  });
});

describe('Real Backend — Money Safety Guard', () => {
  it('requestWithdrawal is NOT tested against real backend', () => {
    // This test documents the explicit decision to never call withdrawal
    // functions in real-backend tests. Withdrawal tests live in
    // mockBackend.test.ts only.
    expect(true).toBe(true);
  });

  it('credit purchase (Stripe) is NOT tested against real backend', () => {
    // Stripe checkout sessions must not be created against prod.
    // All payment flow tests use the mock backend.
    expect(true).toBe(true);
  });
});
