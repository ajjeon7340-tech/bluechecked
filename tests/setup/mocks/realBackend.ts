/**
 * Vitest manual mock for services/realBackend.ts
 * Place at tests/setup/mocks/realBackend.ts and reference via vi.mock().
 *
 * All functions return sensible defaults so components render without errors.
 * Individual tests can override specific functions via vi.mocked(...).mockResolvedValue().
 */

import { vi } from 'vitest';
import type { CreatorProfile, CurrentUser, Message } from '../../../types';

export const MOCK_CREATOR: CreatorProfile = {
  id: 'c1',
  handle: '@testcreator',
  displayName: 'Test Creator',
  bio: 'A test creator bio.',
  avatarUrl: '',
  pricePerMessage: 100,
  responseWindowHours: 48,
  welcomeMessage: 'Welcome!',
  intakeInstructions: '',
  customQuestions: [],
  tags: ['Tech'],
  links: [
    { id: 'l1', title: 'My Website', url: 'https://example.com', type: 'EXTERNAL' },
    { id: 'l2', title: 'My eBook', url: 'https://example.com/ebook.pdf', type: 'DIGITAL_PRODUCT', price: 500 },
  ],
  linkSections: [],
  products: [],
  likesCount: 10,
  showLikes: true,
  showRating: true,
  showBio: true,
  stats: {
    responseTimeAvg: 'Very Fast',
    replyRate: '98%',
    profileViews: 1200,
    averageRating: 4.8,
  },
};

export const MOCK_FAN_USER: CurrentUser = {
  id: 'u-fan-1',
  name: 'Test Fan',
  email: 'fan@test.com',
  role: 'FAN',
  credits: 500,
  avatarUrl: '',
};

export const MOCK_CREATOR_USER: CurrentUser = {
  id: 'c1',
  name: 'Test Creator',
  email: 'creator@test.com',
  role: 'CREATOR',
  credits: 0,
  avatarUrl: '',
};

export const MOCK_MESSAGES: Message[] = [
  {
    id: 'm1',
    senderName: 'Jane Doe',
    senderEmail: 'jane@example.com',
    content: 'Hey, can you review my code?',
    amount: 100,
    creatorId: 'c1',
    creatorName: 'Test Creator',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    expiresAt: new Date(Date.now() + 172800000).toISOString(),
    status: 'PENDING',
    isRead: false,
    conversation: [
      { id: 'chat-1', role: 'FAN', content: 'Hey, can you review my code?', timestamp: new Date().toISOString() },
    ],
  },
  {
    id: 'm2',
    senderName: 'John Smith',
    senderEmail: 'john@example.com',
    content: 'Thanks for the advice!',
    amount: 100,
    creatorId: 'c1',
    creatorName: 'Test Creator',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    status: 'REPLIED',
    isRead: true,
    replyContent: 'Happy to help!',
    replyAt: new Date().toISOString(),
    conversation: [
      { id: 'chat-2', role: 'FAN', content: 'Thanks for the advice!', timestamp: new Date().toISOString() },
      { id: 'chat-3', role: 'CREATOR', content: 'Happy to help!', timestamp: new Date().toISOString() },
    ],
  },
];

// --- Mocked functions ---

export const DEFAULT_AVATAR = '';
export const isBackendConfigured = vi.fn(() => false);
export const invalidateMsgCache = vi.fn();
export const invalidateChatLinesCache = vi.fn();

export const getCreatorProfile = vi.fn().mockResolvedValue(MOCK_CREATOR);
export const getCreatorProfileByHandle = vi.fn().mockResolvedValue(MOCK_CREATOR);
export const updateCreatorProfile = vi.fn().mockImplementation(async (p) => p);

export const checkAndSyncSession = vi.fn().mockResolvedValue(null);
export const signOut = vi.fn().mockResolvedValue(undefined);
export const subscribeToAuthChanges = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
export const completeOAuthSignup = vi.fn().mockResolvedValue(MOCK_FAN_USER);
export const getDiemPublicProfileId = vi.fn().mockResolvedValue(null);

export const getMessages = vi.fn().mockResolvedValue(MOCK_MESSAGES);
export const sendMessage = vi.fn().mockResolvedValue(MOCK_MESSAGES[0]);
export const replyToMessage = vi.fn().mockResolvedValue(undefined);
export const cancelMessage = vi.fn().mockResolvedValue(undefined);
export const markMessageAsRead = vi.fn().mockResolvedValue(undefined);
export const rateMessage = vi.fn().mockResolvedValue(undefined);
export const sendFanAppreciation = vi.fn().mockResolvedValue(undefined);
export const editCreatorMessage = vi.fn().mockResolvedValue(undefined);
export const deleteCreatorMessage = vi.fn().mockResolvedValue(undefined);
export const getChatLines = vi.fn().mockResolvedValue([]);

export const getDashboardStats = vi.fn().mockResolvedValue({
  totalEarnings: 1000,
  pendingCount: 2,
  responseRate: 95,
  monthlyStats: [],
});
export const getHistoricalStats = vi.fn().mockResolvedValue([]);
export const getProAnalytics = vi.fn().mockResolvedValue({
  trafficSources: [],
  funnel: [
    { name: 'Profile Views', count: 10, fill: '#6366F1' },
    { name: 'Interactions', count: 5, fill: '#818CF8' },
    { name: 'Conversions', count: 2, fill: '#4ADE80' },
  ],
  topAssets: [],
  audienceType: { new: 75, returning: 25 },
});
export const getDetailedStatistics = vi.fn().mockResolvedValue([]);
export const getFinancialStatistics = vi.fn().mockResolvedValue([]);
export const logAnalyticsEvent = vi.fn().mockResolvedValue(undefined);

export const getFeaturedCreators = vi.fn().mockResolvedValue([MOCK_CREATOR]);
export const searchCreators = vi.fn().mockResolvedValue([MOCK_CREATOR]);
export const toggleCreatorLike = vi.fn().mockResolvedValue({ likes: 11, hasLiked: true });
export const getCreatorLikeStatus = vi.fn().mockResolvedValue(false);

export const getPurchasedProducts = vi.fn().mockResolvedValue([]);
export const getSecureDownloadUrl = vi.fn().mockResolvedValue('https://example.com/file.pdf');
export const uploadFile = vi.fn().mockResolvedValue('https://example.com/upload');
export const uploadProductFile = vi.fn().mockResolvedValue('https://example.com/product');

export const getStripeConnectionStatus = vi.fn().mockResolvedValue(false);
export const connectStripeAccount = vi.fn().mockResolvedValue(true);
export const getWithdrawalHistory = vi.fn().mockResolvedValue([]);
// NOTE: requestWithdrawal intentionally omitted from this mock to prevent
// any component test from accidentally triggering a withdrawal path.

export const signIn = vi.fn().mockResolvedValue(MOCK_FAN_USER);
export const signUp = vi.fn().mockResolvedValue(MOCK_FAN_USER);
export const loginUser = vi.fn().mockResolvedValue(MOCK_FAN_USER);
export const signInWithSocial = vi.fn().mockResolvedValue(undefined);
export const resendConfirmationEmail = vi.fn().mockResolvedValue(undefined);
export const sendPasswordResetEmail = vi.fn().mockResolvedValue(undefined);
export const updatePassword = vi.fn().mockResolvedValue(undefined);
export const updateCurrentUser = vi.fn().mockResolvedValue(undefined);
export const addCredits = vi.fn().mockImplementation(async (amount: number) => ({
  ...MOCK_FAN_USER,
  credits: MOCK_FAN_USER.credits + amount,
}));

// Real-time subscriptions
export const subscribeToMessages = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });

// Stripe / payments — safe mocks (no real charges)
export const createCheckoutSession = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' });

// Creator trending
export const getCreatorTrendingStatus = vi.fn().mockResolvedValue({ isTrending: false, rank: null });

// Fan welcome / Diem creator
export const sendFanWelcomeMessage = vi.fn().mockResolvedValue(undefined);
export const getDiemCreatorId = vi.fn().mockResolvedValue(null);

// Chat editing
export const editChatMessage = vi.fn().mockResolvedValue(undefined);
export const deleteChatLine = vi.fn().mockResolvedValue(undefined);
export const sendWelcomeMessage = vi.fn().mockResolvedValue(undefined);

// Withdrawal — provided as a mock but throws if called without Stripe connected,
// mirroring production safety (component tests should never trigger this).
export const requestWithdrawal = vi.fn().mockRejectedValue(new Error('Stripe not connected'));

// Withdrawal type re-export
export type { Withdrawal } from '../../services/mockBackend';
