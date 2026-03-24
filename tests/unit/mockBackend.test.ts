/**
 * Unit tests for the Mock Backend service.
 * These run entirely in-memory — no Supabase, no Stripe, no real network.
 * All money-related tests (withdrawal, credit purchase) are here because
 * they must never run against the production environment.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// We use dynamic imports with vi.resetModules() so each test file gets a
// fresh copy of the module (its module-level state is re-initialised).
const freshBackend = async () => {
  vi.resetModules();
  return await import('../../services/mockBackend');
};

describe('Mock Backend — Creator Profile', () => {
  it('returns the default creator profile', async () => {
    const mb = await freshBackend();
    const profile = await mb.getCreatorProfile();
    expect(profile).toBeDefined();
    expect(profile.displayName).toBe('Alex The Dev');
    expect(profile.pricePerMessage).toBeGreaterThan(0);
  });

  it('returns a specific creator by id', async () => {
    const mb = await freshBackend();
    const profile = await mb.getCreatorProfile('c2');
    expect(profile.id).toBe('c2');
    expect(profile.displayName).toBe('Jen Fitness');
  });

  it('updates creator profile and persists the change', async () => {
    const mb = await freshBackend();
    const original = await mb.getCreatorProfile();
    const updated = await mb.updateCreatorProfile({
      ...original,
      bio: 'New bio text',
      displayName: 'Updated Name',
    });
    expect(updated.bio).toBe('New bio text');
    expect(updated.displayName).toBe('Updated Name');

    // Subsequent read should return updated values
    const refetched = await mb.getCreatorProfile();
    expect(refetched.bio).toBe('New bio text');
  });

  it('profile handle and pricing are accessible', async () => {
    const mb = await freshBackend();
    const profile = await mb.getCreatorProfile();
    expect(typeof profile.handle).toBe('string');
    expect(typeof profile.pricePerMessage).toBe('number');
    expect(typeof profile.responseWindowHours).toBe('number');
  });
});

describe('Mock Backend — Authentication', () => {
  it('signs up a new FAN user', async () => {
    const mb = await freshBackend();
    const user = await mb.loginUser('FAN', 'fan@example.com', 'EMAIL', 'Test Fan');
    expect(user.role).toBe('FAN');
    expect(user.email).toBe('fan@example.com');
    expect(user.name).toBe('Test Fan');
    expect(user.credits).toBe(500); // New fans get 500 starter credits
  });

  it('signs up a new CREATOR user with zero credits', async () => {
    const mb = await freshBackend();
    const user = await mb.loginUser('CREATOR', 'creator@example.com', 'EMAIL', 'Test Creator');
    expect(user.role).toBe('CREATOR');
    expect(user.credits).toBe(0);
  });

  it('rejects duplicate email on sign-up', async () => {
    const mb = await freshBackend();
    await mb.loginUser('FAN', 'dup@example.com', 'EMAIL', 'First User');
    await expect(
      mb.loginUser('FAN', 'dup@example.com', 'EMAIL', 'Second User')
    ).rejects.toThrow();
  });

  it('signs in an existing user', async () => {
    const mb = await freshBackend();
    await mb.loginUser('FAN', 'signin@example.com', 'EMAIL', 'Sign In User');
    const loggedIn = await mb.loginUser('FAN', 'signin@example.com', 'EMAIL');
    expect(loggedIn.email).toBe('signin@example.com');
  });

  it('throws on login with unknown credentials', async () => {
    const mb = await freshBackend();
    await expect(
      mb.loginUser('FAN', 'unknown@example.com', 'EMAIL')
    ).rejects.toThrow();
  });

  it('restores session from localStorage', async () => {
    const mb = await freshBackend();
    const user = await mb.loginUser('FAN', 'session@example.com', 'EMAIL', 'Session User');
    // checkAndSyncSession reads from localStorage
    const restored = await mb.checkAndSyncSession();
    expect(restored).not.toBeNull();
    expect(restored?.email).toBe('session@example.com');
  });

  it('returns null session when no user is stored', async () => {
    const mb = await freshBackend();
    const result = await mb.checkAndSyncSession();
    expect(result).toBeNull();
  });
});

describe('Mock Backend — Messages', () => {
  it('returns messages list (includes seeded demo messages)', async () => {
    const mb = await freshBackend();
    const messages = await mb.getMessages();
    expect(Array.isArray(messages)).toBe(true);
    expect(messages.length).toBeGreaterThan(0);
  });

  it('fan can send a message and credits are deducted', async () => {
    const mb = await freshBackend();
    // Sign up a fan with 500 credits
    const fan = await mb.loginUser('FAN', 'fan@test.com', 'EMAIL', 'Fan');
    expect(fan.credits).toBe(500);

    const profile = await mb.getCreatorProfile();
    const msg = await mb.sendMessage(
      profile.id,
      fan.name,
      fan.email!,
      'Hello creator!',
      profile.pricePerMessage
    );

    expect(msg.status).toBe('PENDING');
    expect(msg.content).toBe('Hello creator!');
    expect(msg.amount).toBe(profile.pricePerMessage);

    // Verify credit deduction via checkAndSyncSession
    const updatedUser = await mb.checkAndSyncSession();
    expect(updatedUser?.credits).toBe(500 - profile.pricePerMessage);
  });

  it('rejects message send when credits are insufficient', async () => {
    const mb = await freshBackend();
    await mb.loginUser('FAN', 'broke@test.com', 'EMAIL', 'Broke Fan');

    await expect(
      mb.sendMessage('c1', 'Broke Fan', 'broke@test.com', 'Hi', 99999)
    ).rejects.toThrow(/insufficient/i);
  });

  it('creator can reply to a message', async () => {
    const mb = await freshBackend();
    const messages = await mb.getMessages();
    const pending = messages.find(m => m.status === 'PENDING');
    expect(pending).toBeDefined();

    await mb.replyToMessage(pending!.id, 'Thanks for reaching out!', true);

    const updated = await mb.getMessages();
    const replied = updated.find(m => m.id === pending!.id);
    expect(replied?.status).toBe('REPLIED');
    expect(replied?.replyContent).toBe('Thanks for reaching out!');
  });

  it('fan can cancel a pending message and message status is CANCELLED', async () => {
    const mb = await freshBackend();
    const fan = await mb.loginUser('FAN', 'cancel@test.com', 'EMAIL', 'Cancel Fan');
    const profile = await mb.getCreatorProfile();

    const msg = await mb.sendMessage(
      profile.id,
      fan.name,
      fan.email!,
      'Cancel me',
      profile.pricePerMessage
    );

    await mb.cancelMessage(msg.id);

    const messages = await mb.getMessages();
    const cancelled = messages.find(m => m.id === msg.id);
    expect(cancelled?.status).toBe('CANCELLED');
    // Note: mock backend updates credits in-memory on cancel but does not
    // re-persist to localStorage — this is expected mock behaviour.
  });

  it('marks a message as read', async () => {
    const mb = await freshBackend();
    const messages = await mb.getMessages();
    const unread = messages.find(m => !m.isRead);
    expect(unread).toBeDefined();

    await mb.markMessageAsRead(unread!.id);

    const updated = await mb.getMessages();
    const nowRead = updated.find(m => m.id === unread!.id);
    expect(nowRead?.isRead).toBe(true);
  });

  it('fan can rate a replied message', async () => {
    const mb = await freshBackend();
    const messages = await mb.getMessages();
    const replied = messages.find(m => m.status === 'REPLIED');
    expect(replied).toBeDefined();

    await mb.rateMessage(replied!.id, 5, 'Great response!');

    const updated = await mb.getMessages();
    const rated = updated.find(m => m.id === replied!.id);
    expect(rated?.rating).toBe(5);
    expect(rated?.reviewContent).toBe('Great response!');
  });

  it('product purchase is flagged as REPLIED immediately', async () => {
    const mb = await freshBackend();
    const fan = await mb.loginUser('FAN', 'buyer@test.com', 'EMAIL', 'Buyer');
    const profile = await mb.getCreatorProfile();

    const productLink = profile.links.find(l => l.type === 'DIGITAL_PRODUCT');
    expect(productLink).toBeDefined();

    // Give the fan enough credits for the product (starter credits = 500, product = 1500)
    await mb.addCredits(2000);

    const msg = await mb.sendMessage(
      profile.id,
      fan.name,
      fan.email!,
      `Purchased Product: ${productLink!.title}`,
      productLink!.price ?? 0
    );

    expect(msg.status).toBe('REPLIED');
    expect(msg.isRead).toBe(true);
  });

  it('prevents purchasing the same product twice', async () => {
    const mb = await freshBackend();
    const fan = await mb.loginUser('FAN', 'dupebuyer@test.com', 'EMAIL', 'Dupe Buyer');
    const profile = await mb.getCreatorProfile();
    const productLink = profile.links.find(l => l.type === 'DIGITAL_PRODUCT');

    // Give enough credits for two purchases
    await mb.addCredits(5000);

    const content = `Purchased Product: ${productLink!.title}`;
    await mb.sendMessage(profile.id, fan.name, fan.email!, content, productLink!.price ?? 0);

    await expect(
      mb.sendMessage(profile.id, fan.name, fan.email!, content, productLink!.price ?? 0)
    ).rejects.toThrow(/already purchased/i);
  });
});

describe('Mock Backend — Credits (Mock Only)', () => {
  it('adds credits to a logged-in user', async () => {
    const mb = await freshBackend();
    await mb.loginUser('FAN', 'credits@test.com', 'EMAIL', 'Credits Fan');
    const updated = await mb.addCredits(1000);
    expect(updated.credits).toBe(1500); // 500 starter + 1000 added
  });
});

describe('Mock Backend — Withdrawal (Mock Only)', () => {
  it('requestWithdrawal fails without Stripe connected', async () => {
    const mb = await freshBackend();
    await expect(mb.requestWithdrawal(500)).rejects.toThrow(/stripe/i);
  });

  it('requestWithdrawal succeeds after connecting Stripe', async () => {
    const mb = await freshBackend();
    await mb.connectStripeAccount();

    const withdrawal = await mb.requestWithdrawal(500);
    expect(withdrawal.id).toBeDefined();
    expect(withdrawal.amount).toBe(500);
    expect(withdrawal.status).toBe('COMPLETED');
  });

  it('withdrawal history includes submitted withdrawals', async () => {
    const mb = await freshBackend();
    await mb.connectStripeAccount();
    await mb.requestWithdrawal(200);
    await mb.requestWithdrawal(300);

    const history = await mb.getWithdrawalHistory();
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('getStripeConnectionStatus reflects connected state', async () => {
    const mb = await freshBackend();
    expect(await mb.getStripeConnectionStatus()).toBe(false);
    await mb.connectStripeAccount();
    expect(await mb.getStripeConnectionStatus()).toBe(true);
  });
});

describe('Mock Backend — Analytics', () => {
  it('getHistoricalStats returns 6 months of data', async () => {
    const mb = await freshBackend();
    const stats = await mb.getHistoricalStats();
    expect(stats.length).toBe(6);
    stats.forEach(s => {
      expect(s).toHaveProperty('month');
      expect(s).toHaveProperty('earnings');
      expect(s).toHaveProperty('views');
      expect(s).toHaveProperty('messages');
    });
  });

  it('getProAnalytics returns traffic sources, funnel, and top assets', async () => {
    const mb = await freshBackend();
    const analytics = await mb.getProAnalytics();
    expect(analytics).toHaveProperty('trafficSources');
    expect(analytics).toHaveProperty('funnel');
    expect(analytics).toHaveProperty('topAssets');
    expect(analytics).toHaveProperty('audienceType');
    expect(analytics.funnel.length).toBe(3);
  });

  it('getFinancialStatistics returns correct number of periods for each timeframe', async () => {
    const mb = await freshBackend();
    const now = new Date();

    const daily = await mb.getFinancialStatistics('DAILY', now);
    expect(daily.length).toBe(7);

    const weekly = await mb.getFinancialStatistics('WEEKLY', now);
    expect(weekly.length).toBe(4);

    const monthly = await mb.getFinancialStatistics('MONTHLY', now);
    expect(monthly.length).toBe(6);

    const yearly = await mb.getFinancialStatistics('YEARLY', now);
    expect(yearly.length).toBe(12);
  });

  it('getDetailedStatistics returns correct buckets', async () => {
    const mb = await freshBackend();
    const now = new Date();

    const daily = await mb.getDetailedStatistics('DAILY', now);
    expect(daily.length).toBe(7);
    daily.forEach(s => {
      expect(s).toHaveProperty('date');
      expect(s).toHaveProperty('views');
      expect(s).toHaveProperty('likes');
      expect(s).toHaveProperty('rating');
      expect(s).toHaveProperty('responseTime');
    });
  });

  it('logAnalyticsEvent stores VIEW events that feed getHistoricalStats', async () => {
    const mb = await freshBackend();
    const profile = await mb.getCreatorProfile();
    await mb.logAnalyticsEvent(profile.id, 'VIEW', {});
    const analytics = await mb.getProAnalytics();
    const totalViews = analytics.funnel.find(f => f.name === 'Profile Views');
    expect(totalViews?.count).toBeGreaterThanOrEqual(1);
  });
});

describe('Mock Backend — Featured Creators & Explore', () => {
  it('getFeaturedCreators returns multiple creators', async () => {
    const mb = await freshBackend();
    const creators = await mb.getFeaturedCreators();
    expect(creators.length).toBeGreaterThanOrEqual(2);
    creators.forEach(c => {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('displayName');
    });
  });
});

describe('Mock Backend — Creator Likes', () => {
  it('unauthenticated like check returns false', async () => {
    const mb = await freshBackend();
    const hasLiked = await mb.getCreatorLikeStatus('c1');
    expect(hasLiked).toBe(false);
  });

  it('toggleCreatorLike increments and decrements', async () => {
    const mb = await freshBackend();
    await mb.loginUser('FAN', 'liker@test.com', 'EMAIL', 'Liker');

    const { likes: after, hasLiked } = await mb.toggleCreatorLike('c1');
    expect(hasLiked).toBe(true);
    expect(after).toBeGreaterThanOrEqual(1);

    const { hasLiked: afterUnlike } = await mb.toggleCreatorLike('c1');
    expect(afterUnlike).toBe(false);
  });
});

describe('Mock Backend — Purchased Products', () => {
  it('returns purchased products for fan who bought a digital product', async () => {
    const mb = await freshBackend();
    const fan = await mb.loginUser('FAN', 'downloader@test.com', 'EMAIL', 'Downloader');
    const profile = await mb.getCreatorProfile();
    const productLink = profile.links.find(l => l.type === 'DIGITAL_PRODUCT');

    // Give enough credits for the purchase
    await mb.addCredits(2000);

    await mb.sendMessage(
      profile.id,
      fan.name,
      fan.email!,
      `Purchased Product: ${productLink!.title}`,
      productLink!.price ?? 0
    );

    const purchased = await mb.getPurchasedProducts();
    expect(purchased.length).toBeGreaterThanOrEqual(1);
    expect(purchased[0].title).toBe(productLink!.title);
    expect(purchased[0].type).toBe('DIGITAL_PRODUCT');
  });

  it('getSecureDownloadUrl returns the product url in mock mode', async () => {
    const mb = await freshBackend();
    const url = await mb.getSecureDownloadUrl('prod-1', 'https://example.com/file.pdf', 'c1');
    expect(url).toBe('https://example.com/file.pdf');
  });
});

describe('Mock Backend — Fan Appreciation', () => {
  it('sendFanAppreciation adds a message to conversation', async () => {
    const mb = await freshBackend();
    await mb.loginUser('FAN', 'appreciator@test.com', 'EMAIL', 'Appreciator');
    const messages = await mb.getMessages();
    const replied = messages.find(m => m.status === 'REPLIED');
    expect(replied).toBeDefined();

    await mb.sendFanAppreciation(replied!.id, 'Amazing response, thanks!');

    const updated = await mb.getMessages();
    const msg = updated.find(m => m.id === replied!.id);
    const appreciation = msg?.conversation.find(c => c.content.includes('Amazing response, thanks!'));
    expect(appreciation).toBeDefined();
  });
});
