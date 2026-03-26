/**
 * Integration test: Admin welcome message → creator reply → admin reply
 *
 * Verifies that the role stored in each chat_line is correct so that
 * the CreatorDashboard display logic (isOutgoing inversion) renders
 * every message bubble on the right side for both the admin and creator.
 *
 * The display logic tested here:
 *   const isCreator = isOutgoing ? chat.role === 'FAN' : chat.role === 'CREATOR';
 *
 * Run with: npm test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const freshBackend = async () => {
  vi.resetModules();
  return await import('../../services/mockBackend');
};

// Display logic lifted from CreatorDashboard — must stay in sync
const resolveIsCreator = (role: 'CREATOR' | 'FAN', isOutgoing: boolean): boolean =>
  isOutgoing ? role === 'FAN' : role === 'CREATOR';

const ADMIN_EMAIL = 'abe7340@gmail.com';
const ADMIN_NAME = 'Diem Official';

describe('Admin Messaging — welcome thread role assignment', () => {
  it('full scenario: admin welcome → creator reply → admin reply — roles are correct', async () => {
    const mb = await freshBackend();

    // 1. Create accounts (sign up)
    const adminUser = await mb.loginUser('CREATOR', ADMIN_EMAIL, 'EMAIL', ADMIN_NAME);
    const newCreator = await mb.loginUser('CREATOR', 'newcreator@example.com', 'EMAIL', 'New Creator');

    expect(adminUser.email).toBe(ADMIN_EMAIL);
    expect(newCreator.email).toBe('newcreator@example.com');

    // 2. Admin sends a welcome message to new creator
    //    sender=admin, creatorId=newCreator.id  (admin is the "fan" / original sender)
    await mb.loginUser('CREATOR', ADMIN_EMAIL, 'EMAIL'); // switch to admin session
    const welcomeMsg = await mb.sendMessage(
      newCreator.id,
      ADMIN_NAME,
      ADMIN_EMAIL,
      'Welcome to Diem! Let me know if you have any questions.',
      0
    );

    expect(welcomeMsg.senderEmail).toBe(ADMIN_EMAIL);
    expect(welcomeMsg.senderName).toBe(ADMIN_NAME);
    expect(welcomeMsg.creatorId).toBe(newCreator.id);

    // Initial message is always stored as FAN (the sender initiated it)
    expect(welcomeMsg.conversation).toHaveLength(1);
    expect(welcomeMsg.conversation[0].role).toBe('FAN');
    expect(welcomeMsg.conversation[0].content).toContain('Welcome to Diem');

    // 3. New creator replies
    await mb.loginUser('CREATOR', 'newcreator@example.com', 'EMAIL');
    await mb.replyToMessage(welcomeMsg.id, 'Thanks! Really excited to be here.', false);

    const msgs = await mb.getMessages();
    const thread = msgs.find(m => m.id === welcomeMsg.id)!;
    expect(thread.conversation).toHaveLength(2);
    // Creator replied → they are the creator_id → role='CREATOR'
    expect(thread.conversation[1].role).toBe('CREATOR');
    expect(thread.conversation[1].content).toContain('excited');

    // 4. Admin replies again
    await mb.loginUser('CREATOR', ADMIN_EMAIL, 'EMAIL');
    await mb.replyToMessage(welcomeMsg.id, 'Great to have you! Feel free to reach out anytime.', false);

    const msgs2 = await mb.getMessages();
    const thread2 = msgs2.find(m => m.id === welcomeMsg.id)!;
    expect(thread2.conversation).toHaveLength(3);
    // Admin replied → they are the sender_id, NOT creator_id → role='FAN'
    expect(thread2.conversation[2].role).toBe('FAN');
    expect(thread2.conversation[2].content).toContain('Feel free');

    const [welcome, creatorReply, adminReply] = thread2.conversation;

    // ── Display verification: Admin's view of the thread ──────────────────────
    // Admin's creatorId is adminUser.id; msg.creatorId is newCreator.id → isOutgoing=true
    const isOutgoing_admin = welcomeMsg.creatorId !== adminUser.id; // true
    expect(isOutgoing_admin).toBe(true);

    // welcome message (admin sent it, role='FAN') → shows on admin's side
    expect(resolveIsCreator(welcome.role, isOutgoing_admin)).toBe(true);

    // creator's reply (role='CREATOR') → shows on creator's side
    expect(resolveIsCreator(creatorReply.role, isOutgoing_admin)).toBe(false);

    // admin's second reply (role='FAN') → shows on admin's side again
    expect(resolveIsCreator(adminReply.role, isOutgoing_admin)).toBe(true);

    // ── Display verification: Creator's (newcreator) view of the thread ───────
    // newCreator.id === msg.creatorId → isOutgoing=false
    const isOutgoing_creator = welcomeMsg.creatorId !== newCreator.id; // false
    expect(isOutgoing_creator).toBe(false);

    // welcome message (admin sent it, role='FAN') → shows on admin/fan side (not creator)
    expect(resolveIsCreator(welcome.role, isOutgoing_creator)).toBe(false);

    // creator's reply (role='CREATOR') → shows on creator's own side
    expect(resolveIsCreator(creatorReply.role, isOutgoing_creator)).toBe(true);

    // admin's reply (role='FAN') → shows on admin/fan side (not creator)
    expect(resolveIsCreator(adminReply.role, isOutgoing_creator)).toBe(false);

    // ── ADMIN badge condition (CreatorDashboard line 3118) ───────────────────
    // The amber ADMIN badge shows when: !isCreator && msg.senderEmail === ADMIN_EMAIL
    // From creator's view: admin's reply (index 2) is !isCreator=true, and senderEmail is admin's
    const adminReplyIsCreator_creatorView = resolveIsCreator(adminReply.role, isOutgoing_creator);
    expect(adminReplyIsCreator_creatorView).toBe(false); // !isCreator → badge can show
    expect(welcomeMsg.senderEmail).toBe(ADMIN_EMAIL);    // amber badge condition met ✓
    expect(welcomeMsg.senderName).toBe(ADMIN_NAME);       // 'Diem Official' ✓
  });

  it('incoming thread (creator sends to admin): admin reply gets role=CREATOR', async () => {
    const mb = await freshBackend();

    // Create accounts
    const adminUser  = await mb.loginUser('CREATOR', ADMIN_EMAIL, 'EMAIL', ADMIN_NAME);
    const newCreator = await mb.loginUser('CREATOR', 'creator2@example.com', 'EMAIL', 'Creator Two');

    // Creator sends a support message to admin's creator profile
    await mb.loginUser('CREATOR', 'creator2@example.com', 'EMAIL');
    const supportMsg = await mb.sendMessage(
      adminUser.id,       // creatorId = admin's profile
      'Creator Two',
      'creator2@example.com',
      'I have a billing question.',
      0
    );

    expect(supportMsg.creatorId).toBe(adminUser.id);
    expect(supportMsg.conversation[0].role).toBe('FAN'); // creator is the sender here

    // Admin replies
    await mb.loginUser('CREATOR', ADMIN_EMAIL, 'EMAIL');
    await mb.replyToMessage(supportMsg.id, 'Happy to help! What is your question?', false);

    const msgs = await mb.getMessages();
    const thread = msgs.find(m => m.id === supportMsg.id)!;
    expect(thread.conversation).toHaveLength(2);
    // Admin IS the creator_id in this thread → role='CREATOR'
    expect(thread.conversation[1].role).toBe('CREATOR');

    // ── Display verification: Admin's view (isOutgoing=false — admin is creator_id) ──
    const isOutgoing_admin = supportMsg.creatorId !== adminUser.id; // false
    expect(isOutgoing_admin).toBe(false);

    const [fanMsg, adminReply] = thread.conversation;
    // The creator2 message (role='FAN') → shows on fan/creator2 side
    expect(resolveIsCreator(fanMsg.role, isOutgoing_admin)).toBe(false);
    // Admin's reply (role='CREATOR') → shows on admin's side ✓
    expect(resolveIsCreator(adminReply.role, isOutgoing_admin)).toBe(true);
  });
});
