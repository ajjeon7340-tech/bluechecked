/**
 * Unit tests for the three bug fixes:
 *   1. replyToMessage — role is CREATOR when replier is the creator_id side,
 *      FAN when replier is the sender_id side.
 *   2. sendMessage / sendSupportMessage — role in admin-thread chat_lines follows
 *      the same creator_id vs sender_id rule.
 *   3. updateCreatorProfile — profileFont is persisted as profile_font in the DB.
 *
 * These tests mock the Supabase client so no real network calls are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CreatorProfile } from '../../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const ADMIN_ID   = 'admin-user-id';
const CREATOR_ID = 'creator-user-id';
const FAN_ID     = 'fan-user-id';
const MSG_ID     = 'message-id-1';
const FUTURE     = new Date(Date.now() + 86_400_000).toISOString();

// ── Captured call state (reset before each test) ───────────────────────────────

const captured = {
  chatLineInsert:  null as any,
  profilesUpdate:  null as any,
};

// ── Stub message returned by sendMessage's final fetch ─────────────────────────
// Must have chat_lines (even empty []) so mapDbMessageToAppMessage doesn't crash.

const STUB_MESSAGE = {
  id: MSG_ID,
  sender_id: CREATOR_ID,
  creator_id: ADMIN_ID,
  content: 'stub',
  amount: 0,
  status: 'PENDING',
  created_at: new Date().toISOString(),
  expires_at: FUTURE,
  is_read: false,
  attachment_url: null,
  reply_at: null,
  updated_at: new Date().toISOString(),
  rating: null,
  review_content: null,
  chat_lines: [],
  sender:  { display_name: 'Creator', email: 'creator@test.com', avatar_url: null },
  creator: { display_name: 'Admin',   avatar_url: null },
};

// ── Fluent-chain builder ───────────────────────────────────────────────────────
//
// Returns an object that mimics Supabase's query builder:
//   - Chainable methods return `this`
//   - `.single()` resolves to `singleValue`
//   - `.maybeSingle()` resolves to `maybeSingleValue`
//   - The chain is thenable so `await builder.update().eq()` resolves cleanly

function makeChain(singleValue: any, maybeSingleValue: any = { data: null, error: null }) {
  const c: any = {};
  const self = () => c;
  c.select      = vi.fn(self);
  c.eq          = vi.fn(self);
  c.neq         = vi.fn(self);
  c.or          = vi.fn(self);
  c.order       = vi.fn(self);
  c.limit       = vi.fn(self);
  c.gte         = vi.fn(self);
  c.update      = vi.fn(self);
  c.insert      = vi.fn(async () => ({ data: null, error: null }));
  c.single      = vi.fn(() => Promise.resolve(singleValue));
  c.maybeSingle = vi.fn(() => Promise.resolve(maybeSingleValue));
  // Thenable: lets `await builder` (without a terminal method) resolve cleanly
  c.then        = (res: any, rej: any) =>
    Promise.resolve({ data: null, error: null }).then(res, rej);
  return c;
}

// ── Mock Supabase singleton ────────────────────────────────────────────────────

const mockSupabase = {
  auth: { getSession: vi.fn() },
  from: vi.fn(),
  rpc:  vi.fn(),
};

vi.mock('../../services/supabaseClient', () => ({
  isConfigured: true,
  supabase: mockSupabase,
}));

// ── Per-test setup helpers ─────────────────────────────────────────────────────

function setSession(userId: string) {
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: userId } } },
  });
}

/**
 * Configure mockSupabase.from() for a given test scenario.
 *
 * @param messageStatusRow   Value returned by messages.select().eq().single()
 *                           — the status/metadata check in replyToMessage.
 * @param threadRow          Value returned by messages.select().or().maybeSingle()
 *                           — the admin-thread lookup in sendMessage / sendSupportMessage.
 */
function setupFromMock(
  messageStatusRow: any = { data: null, error: null },
  threadRow:        any = { data: null, error: null },
) {
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'messages') {
      // single() → status-check row (replyToMessage) OR final-fetch stub (sendMessage)
      // maybeSingle() → thread-lookup row (sendMessage / sendSupportMessage)
      return makeChain(
        /* single */      messageStatusRow.data !== undefined
                            ? messageStatusRow
                            : { data: STUB_MESSAGE, error: null },
        /* maybeSingle */ threadRow,
      );
    }

    if (table === 'chat_lines') {
      const c = makeChain({ data: null, error: null });
      c.insert = vi.fn(async (data: any) => {
        captured.chatLineInsert = data;
        return { data: null, error: null };
      });
      return c;
    }

    if (table === 'profiles') {
      const c = makeChain({ data: null, error: null });
      c.update = vi.fn((data: any) => {
        captured.profilesUpdate = data;
        return c;           // keep chain fluent so .eq() resolves via .then
      });
      return c;
    }

    return makeChain({ data: null, error: null });
  });
}

// ── Test lifecycle ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  captured.chatLineInsert = null;
  captured.profilesUpdate = null;

  // Admin RPC returns ADMIN_ID by default
  mockSupabase.rpc.mockResolvedValue({ data: ADMIN_ID, error: null });

  // Default session: CREATOR_ID is logged in
  setSession(CREATOR_ID);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
//  1. replyToMessage — role assignment
// ══════════════════════════════════════════════════════════════════════════════

describe('replyToMessage — role assignment', () => {

  it('creator replying to an admin-initiated thread → role CREATOR', async () => {
    // Thread layout: admin sent (sender_id=ADMIN), creator is recipient (creator_id=CREATOR)
    // Logged-in replier: CREATOR_ID
    // Rule: user.id === creator_id → CREATOR
    setSession(CREATOR_ID);
    setupFromMock({
      data: { status: 'PENDING', expires_at: FUTURE, sender_id: ADMIN_ID, creator_id: CREATOR_ID },
      error: null,
    });

    const { replyToMessage } = await import('../../services/realBackend');
    await replyToMessage(MSG_ID, 'Hello from creator', false);

    expect(captured.chatLineInsert).not.toBeNull();
    expect(captured.chatLineInsert.role).toBe('CREATOR');
    expect(captured.chatLineInsert.sender_id).toBe(CREATOR_ID);
  });

  it('admin replying to an admin-initiated thread → role FAN', async () => {
    // Thread layout: sender_id=ADMIN, creator_id=CREATOR
    // Logged-in replier: ADMIN_ID
    // Rule: user.id !== creator_id → FAN
    setSession(ADMIN_ID);
    setupFromMock({
      data: { status: 'PENDING', expires_at: FUTURE, sender_id: ADMIN_ID, creator_id: CREATOR_ID },
      error: null,
    });

    const { replyToMessage } = await import('../../services/realBackend');
    await replyToMessage(MSG_ID, 'Hello from admin', false);

    expect(captured.chatLineInsert).not.toBeNull();
    expect(captured.chatLineInsert.role).toBe('FAN');
    expect(captured.chatLineInsert.sender_id).toBe(ADMIN_ID);
  });

  it('creator replying to a creator-initiated thread → role FAN', async () => {
    // Thread layout: creator sent (sender_id=CREATOR), admin is recipient (creator_id=ADMIN)
    // Logged-in replier: CREATOR_ID
    // Rule: user.id !== creator_id → FAN
    setSession(CREATOR_ID);
    setupFromMock({
      data: { status: 'PENDING', expires_at: FUTURE, sender_id: CREATOR_ID, creator_id: ADMIN_ID },
      error: null,
    });

    const { replyToMessage } = await import('../../services/realBackend');
    await replyToMessage(MSG_ID, 'Follow-up from creator', false);

    expect(captured.chatLineInsert).not.toBeNull();
    expect(captured.chatLineInsert.role).toBe('FAN');
  });

  it('admin replying to a creator-initiated thread → role CREATOR', async () => {
    // Thread layout: sender_id=CREATOR, creator_id=ADMIN
    // Logged-in replier: ADMIN_ID
    // Rule: user.id === creator_id → CREATOR
    setSession(ADMIN_ID);
    setupFromMock({
      data: { status: 'PENDING', expires_at: FUTURE, sender_id: CREATOR_ID, creator_id: ADMIN_ID },
      error: null,
    });

    const { replyToMessage } = await import('../../services/realBackend');
    await replyToMessage(MSG_ID, 'Admin replying to creator message', false);

    expect(captured.chatLineInsert).not.toBeNull();
    expect(captured.chatLineInsert.role).toBe('CREATOR');
  });

  it('regular fan-to-creator reply → role CREATOR (no regression)', async () => {
    // Standard flow: fan sent, creator replies
    // creator_id = CREATOR_ID, user.id = CREATOR_ID → CREATOR (same as before fix)
    setSession(CREATOR_ID);
    setupFromMock({
      data: { status: 'PENDING', expires_at: FUTURE, sender_id: FAN_ID, creator_id: CREATOR_ID },
      error: null,
    });

    const { replyToMessage } = await import('../../services/realBackend');
    await replyToMessage(MSG_ID, 'Creator replying to fan', false);

    expect(captured.chatLineInsert?.role).toBe('CREATOR');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  2. sendMessage — role in admin-thread chat_lines
// ══════════════════════════════════════════════════════════════════════════════

describe('sendMessage — admin thread role', () => {

  it('creator-initiated thread (creator_id=admin) → role FAN', async () => {
    // Thread was started by the creator; creator_id in the thread = ADMIN_ID
    // Logged-in user (CREATOR_ID) !== thread.creator_id → FAN
    setSession(CREATOR_ID);
    setupFromMock(
      { data: STUB_MESSAGE, error: null },                        // single() final fetch
      { data: { id: MSG_ID, creator_id: ADMIN_ID }, error: null }, // maybeSingle thread lookup
    );

    const { sendMessage } = await import('../../services/realBackend');
    await sendMessage(ADMIN_ID, 'Creator Name', 'creator@test.com', 'Help!', 0);

    expect(captured.chatLineInsert).not.toBeNull();
    expect(captured.chatLineInsert.role).toBe('FAN');
  });

  it('admin-initiated thread (creator_id=creator) → role CREATOR', async () => {
    // Thread was started by the admin; creator_id in the thread = CREATOR_ID
    // Logged-in user (CREATOR_ID) === thread.creator_id → CREATOR
    setSession(CREATOR_ID);
    setupFromMock(
      { data: STUB_MESSAGE, error: null },
      { data: { id: MSG_ID, creator_id: CREATOR_ID }, error: null },
    );

    const { sendMessage } = await import('../../services/realBackend');
    await sendMessage(ADMIN_ID, 'Creator Name', 'creator@test.com', 'Reply to admin msg', 0);

    expect(captured.chatLineInsert).not.toBeNull();
    expect(captured.chatLineInsert.role).toBe('CREATOR');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  3. sendSupportMessage — role in admin-thread chat_lines
// ══════════════════════════════════════════════════════════════════════════════

describe('sendSupportMessage — admin thread role', () => {

  it('creator-initiated thread (creator_id=admin) → role FAN', async () => {
    setSession(CREATOR_ID);
    setupFromMock(
      { data: null, error: null },
      { data: { id: MSG_ID, creator_id: ADMIN_ID }, error: null },
    );

    const { sendSupportMessage } = await import('../../services/realBackend');
    await sendSupportMessage('Need help with my account');

    expect(captured.chatLineInsert).not.toBeNull();
    expect(captured.chatLineInsert.role).toBe('FAN');
  });

  it('admin-initiated thread (creator_id=creator) → role CREATOR', async () => {
    setSession(CREATOR_ID);
    setupFromMock(
      { data: null, error: null },
      { data: { id: MSG_ID, creator_id: CREATOR_ID }, error: null },
    );

    const { sendSupportMessage } = await import('../../services/realBackend');
    await sendSupportMessage('Thanks for reaching out');

    expect(captured.chatLineInsert).not.toBeNull();
    expect(captured.chatLineInsert.role).toBe('CREATOR');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  4. updateCreatorProfile — profileFont persisted as profile_font
// ══════════════════════════════════════════════════════════════════════════════

describe('updateCreatorProfile — profileFont', () => {
  const BASE_PROFILE: CreatorProfile = {
    id: CREATOR_ID,
    handle: '@testcreator',
    displayName: 'Test Creator',
    bio: 'Bio text',
    avatarUrl: '',
    pricePerMessage: 100,
    responseWindowHours: 48,
    welcomeMessage: '',
    intakeInstructions: '',
    customQuestions: [],
    tags: [],
    links: [],
    linkSections: [],
    products: [],
    platforms: [],
    likesCount: 0,
    isPremium: false,
    showLikes: true,
    showRating: true,
    showBio: true,
    stats: { responseTimeAvg: 'Standard', replyRate: '100%', profileViews: 0, averageRating: 5 },
  };

  beforeEach(() => {
    setSession(CREATOR_ID);
    setupFromMock({ data: null, error: null });
  });

  it('saves profileFont as profile_font in the DB update', async () => {
    const { updateCreatorProfile } = await import('../../services/realBackend');
    await updateCreatorProfile({ ...BASE_PROFILE, profileFont: 'playfair' });

    expect(captured.profilesUpdate).not.toBeNull();
    expect(captured.profilesUpdate.profile_font).toBe('playfair');
  });

  it('defaults profile_font to inter when profileFont is undefined', async () => {
    const { updateCreatorProfile } = await import('../../services/realBackend');
    await updateCreatorProfile({ ...BASE_PROFILE, profileFont: undefined });

    expect(captured.profilesUpdate.profile_font).toBe('inter');
  });

  it('saves all four supported font values', async () => {
    const { updateCreatorProfile } = await import('../../services/realBackend');
    const fonts = ['inter', 'playfair', 'space-grotesk', 'dm-serif'] as const;

    for (const font of fonts) {
      captured.profilesUpdate = null;
      setupFromMock({ data: null, error: null });
      await updateCreatorProfile({ ...BASE_PROFILE, profileFont: font });
      expect(captured.profilesUpdate?.profile_font).toBe(font);
    }
  });

  it('does not throw when profileFont is provided', async () => {
    const { updateCreatorProfile } = await import('../../services/realBackend');
    await expect(
      updateCreatorProfile({ ...BASE_PROFILE, profileFont: 'dm-serif' })
    ).resolves.not.toThrow();
  });
});
