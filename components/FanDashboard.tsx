
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CurrentUser, Message, CreatorProfile } from '../types';
import { Button } from './Button';
import { DiemLogo, CheckCircle2, MessageSquare, Clock, LogOut, ExternalLink, ChevronRight, User, AlertCircle, Check, Trash, Paperclip, ChevronLeft, Send, Ban, Star, DollarSign, Plus, X, Heart, Sparkles, Camera, Save, ShieldCheck, Home, Settings, Menu, Bell, Search, Wallet, TrendingUp, ShoppingBag, FileText, Image as ImageIcon, Video, Link as LinkIcon, Lock, HelpCircle, Receipt, ArrowRight, Play, Trophy, MonitorPlay, LayoutGrid, Flame, InstagramLogo, Twitter, Youtube, Twitch, Music2, TikTokLogo, XLogo, YouTubeLogo, SpotifyLogo, Coins, CreditCard, RefreshCw, Download, Smile, Verified } from './Icons';
import { getMessages, getChatLines, invalidateChatLinesCache, invalidateMsgCache, cancelMessage, sendMessage, sendFanAppreciation, updateCurrentUser, getFeaturedCreators, addCredits, createCheckoutSession, isBackendConfigured, subscribeToMessages, getPurchasedProducts, getSecureDownloadUrl, uploadProductFile, sendFanWelcomeMessage, getDiemCreatorId } from '../services/realBackend';
import { LanguageSwitcher } from './LanguageSwitcher';
import i18n from '../i18n/config';

interface Props {
  currentUser: CurrentUser | null;
  onLogout: () => void;
  onBrowseCreators: (creatorId: string) => void;
  onUpdateUser?: (user: CurrentUser) => void;
}

const getResponseTimeTooltip = (status: string, t?: (key: string) => string) => {
    if (t) {
        if (status === 'Lightning') return t('common.responseTooltipLightning');
        if (status === 'Very Fast') return t('common.responseTooltipVeryFast');
        if (status === 'Fast') return t('common.responseTooltipFast');
        return t('common.responseTooltipDefault');
    }
    if (status === 'Lightning') return 'Typically replies in under 1 hour';
    if (status === 'Very Fast') return 'Typically replies in under 4 hours';
    if (status === 'Fast') return 'Typically replies within 24 hours';
    return 'Replies within the guaranteed response window';
};

const isImage = (url: string) => {
    if (!url) return false;
    if (url.startsWith('data:image')) return true;
    const ext = url.split('.').pop()?.split('?')[0].toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '');
};

// Instagram/Threads style relative time
const getRelativeTime = (dateString: string, t?: (key: string, opts?: any) => string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);

    if (t) {
        if (diffSec < 60) return t('common.justNow');
        if (diffMin < 60) return t('common.mAgo', { count: diffMin });
        if (diffHour < 24) return t('common.hAgo', { count: diffHour });
        if (diffDay < 7) return t('common.dAgo', { count: diffDay });
    } else {
        if (diffSec < 60) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHour < 24) return `${diffHour}h ago`;
        if (diffDay < 7) return `${diffDay}d ago`;
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const firstName = (name: string) => name?.split(' ')[0] || name;
const ResponsiveName = ({ name }: { name: string }) => (
  <><span className="hidden sm:inline">{name}</span><span className="sm:hidden">{firstName(name)}</span></>
);

export const FanDashboard: React.FC<Props> = ({ currentUser, onLogout, onBrowseCreators, onUpdateUser }) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [featuredCreators, setFeaturedCreators] = useState<CreatorProfile[]>([]);
  const [purchasedProducts, setPurchasedProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showFanLoadingUI, setShowFanLoadingUI] = useState(false);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const selectedCreatorIdRef = useRef<string | null>(null);
  const subscriptionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [productFilter, setProductFilter] = useState<'ALL' | 'DOCUMENT' | 'IMAGE' | 'VIDEO'>('ALL');
  
  // Navigation State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'OVERVIEW' | 'EXPLORE' | 'SETTINGS' | 'PURCHASED' | 'HISTORY' | 'SUPPORT' | 'NOTIFICATIONS'>(() => {
      const path = window.location.pathname;
      if (path.startsWith('/dashboard/')) {
          const view = path.split('/')[2].toUpperCase();
          if (['EXPLORE', 'SETTINGS', 'PURCHASED', 'HISTORY', 'SUPPORT', 'NOTIFICATIONS'].includes(view)) {
              return view as any;
          }
      }
      return 'OVERVIEW';
  });

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [exploreQuery, setExploreQuery] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'ALL' | 'PENDING' | 'REPLIED' | 'REJECTED'>('ALL');

  const [showNotifications, setShowNotifications] = useState(false);
  const [deletedNotificationIds, setDeletedNotificationIds] = useState<string[]>(() => {
      try {
          const saved = localStorage.getItem('diem_deleted_notifications');
          return saved ? JSON.parse(saved) : [];
      } catch {
          return [];
      }
  });

  const [lastReadTime, setLastReadTime] = useState<number>(() => {
      try {
          return parseInt(localStorage.getItem('diem_fan_last_read_time') || '0');
      } catch { return 0; }
  });

  // Left Chatrooms (hidden, not deleted from DB) - stores timestamp of when left
  const [leftChatrooms, setLeftChatrooms] = useState<Record<string, number>>(() => {
      try {
          const saved = localStorage.getItem('diem_fan_left_chatrooms');
          return saved ? JSON.parse(saved) : {};
      } catch { return {}; }
  });

  const leaveChatroom = async (creatorId: string) => {
      if (!window.confirm(t('fan.leaveConversation'))) return;

      // Cancel any pending requests to this creator
      const pendingMessages = messages.filter(
          m => m.creatorId === creatorId && m.status === 'PENDING'
      );
      await Promise.all(pendingMessages.map(m => cancelMessage(m.id).catch(() => {})));

      // Use the latest server-side message timestamp as the cutoff so clock
      // skew between client and Supabase doesn't cause the group to reappear.
      const msgTimes = messages
          .filter(m => m.creatorId === creatorId)
          .map(m => new Date(m.createdAt).getTime());
      const cutoff = msgTimes.length > 0 ? Math.max(...msgTimes) + 1000 : Date.now() + 1000;
      const updated = { ...leftChatrooms, [creatorId]: cutoff };
      setLeftChatrooms(updated);
      localStorage.setItem('diem_fan_left_chatrooms', JSON.stringify(updated));
      setSelectedCreatorId(null);
      if (pendingMessages.length > 0) loadMessages(true);
  };

  // Chat Reaction State
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>(() => {
      try { return JSON.parse(localStorage.getItem('diem_fan_reactions') || '{}'); } catch { return {}; }
  });
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);

  const handleReactionClick = (msgId: string, emoji: string) => {
      setMessageReactions(prev => {
          const current = prev[msgId];
          let next: Record<string, string>;
          if (current === emoji) {
              next = { ...prev };
              delete next[msgId];
          } else {
              next = { ...prev, [msgId]: emoji };
          }
          localStorage.setItem('diem_fan_reactions', JSON.stringify(next));
          return next;
      });
      setActiveReactionPicker(null);
  };

  // Pagination State
  const [historyPage, setHistoryPage] = useState(1);
  const [notificationPage, setNotificationPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [chatSessionIndex, setChatSessionIndex] = useState(Infinity);

  useEffect(() => {
      localStorage.setItem('diem_deleted_notifications', JSON.stringify(deletedNotificationIds));
  }, [deletedNotificationIds]);
  // UI States
  const [isCancelling, setIsCancelling] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const [showFollowUpInput, setShowFollowUpInput] = useState(false);
  const [followUpText, setFollowUpText] = useState('');
  const [followUpAttachments, setFollowUpAttachments] = useState<string[]>([]);
  const [isUploadingFollowUpAttachment, setIsUploadingFollowUpAttachment] = useState(false);
  const followUpFileInputRef = useRef<HTMLInputElement>(null);
  
  // Custom Appreciation State
  const [customAppreciationMode, setCustomAppreciationMode] = useState(false);
  const [customAppreciationText, setCustomAppreciationText] = useState('');

  // Profile Editor State
  const [profileForm, setProfileForm] = useState({
      name: '',
      age: '',
      avatarUrl: '',
      bio: ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [avatarFileName, setAvatarFileName] = useState('');

  // Wallet / Top Up State
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpSuccess, setTopUpSuccess] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(500);
  const [lastTopUpAmount, setLastTopUpAmount] = useState(1000);
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [creditPurchases, setCreditPurchases] = useState<{ id: string; amount: number; date: string }[]>(() => {
      try { return JSON.parse(localStorage.getItem('diem_credit_purchases') || '[]'); } catch { return []; }
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      if (!isInitialLoad) { setShowFanLoadingUI(false); return; }
      const t = setTimeout(() => setShowFanLoadingUI(true), 300);
      return () => clearTimeout(t);
  }, [isInitialLoad]);

  useEffect(() => {
      const handlePopState = () => {
          const path = window.location.pathname;
          if (path === '/dashboard' || path === '/dashboard/') {
              setCurrentView('OVERVIEW');
          } else if (path.startsWith('/dashboard/')) {
              const view = path.split('/')[2].toUpperCase();
              if (['EXPLORE', 'SETTINGS', 'PURCHASED', 'HISTORY', 'SUPPORT', 'NOTIFICATIONS'].includes(view)) {
                  setCurrentView(view as any);
              }
          }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    loadMessages();
    loadCreators();
    if (currentUser) {
        setProfileForm({
            name: currentUser.name || '',
            age: currentUser.age?.toString() || '',
            avatarUrl: currentUser.avatarUrl || '',
            bio: currentUser.bio || ''
        });
    }

    // Real-time Subscription (debounced to prevent duplicate rapid fires)
    if (currentUser) {
        const { unsubscribe } = subscribeToMessages(currentUser.id, () => {
            if (subscriptionDebounceRef.current) clearTimeout(subscriptionDebounceRef.current);
            subscriptionDebounceRef.current = setTimeout(() => { invalidateMsgCache(); loadMessages(true); }, 300);
        });
        return () => { unsubscribe(); if (subscriptionDebounceRef.current) clearTimeout(subscriptionDebounceRef.current); };
    }
  }, [currentUser]);

  // Send welcome message to new fans — idempotent, skips if already sent
  useEffect(() => {
    if (currentUser?.role === 'FAN') sendFanWelcomeMessage(i18n.language);
  }, [currentUser?.id]);

  // Handle return from Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      const url = new URL(window.location.href);
      url.searchParams.delete('checkout');
      window.history.replaceState({}, '', url.toString());
      const pendingAmount = parseInt(localStorage.getItem('diem_pending_purchase_amount') || '0');
      if (pendingAmount > 0) {
        recordCreditPurchase(pendingAmount);
        localStorage.removeItem('diem_pending_purchase_amount');
      }
      setToastMessage(t('fan.paymentSuccess'));
      setTimeout(() => setToastMessage(null), 4000);
      setTimeout(async () => {
        try {
          const updatedUser = await addCredits(0);
          if (onUpdateUser) onUpdateUser(updatedUser);
        } catch {
          setToastMessage('Your balance is still being processed. Please check back in a moment.');
          setTimeout(() => setToastMessage(null), 5000);
        }
      }, 2000);
    } else if (params.get('checkout') === 'cancel') {
      const url = new URL(window.location.href);
      url.searchParams.delete('checkout');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Auto-refresh creators when entering Explore view
  useEffect(() => {
    if (currentView === 'EXPLORE') {
        loadCreators();
    }
    if (currentView === 'PURCHASED') {
        loadPurchasedProducts();
    }
  }, [currentView]);

  useEffect(() => {
    if (selectedCreatorId && scrollRef.current) {
        setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }, 100);
    }
  }, [messages, selectedCreatorId, showFollowUpInput, customAppreciationMode]);

  // Keep ref in sync for use inside async callbacks
  useEffect(() => { selectedCreatorIdRef.current = selectedCreatorId; }, [selectedCreatorId]);

  // Open pending creator after initial load (from post-send navigation on profile page)
  useEffect(() => {
    if (!isInitialLoad) {
      const pendingCreatorId = localStorage.getItem('diem_open_creator');
      if (pendingCreatorId) {
        localStorage.removeItem('diem_open_creator');
        setSelectedCreatorId(pendingCreatorId);
        setCurrentView('OVERVIEW');
      }
    }
  }, [isInitialLoad]);

  // Lazily hydrate full conversation for a message when it's opened
  const hydrateConversation = async (msg: Message) => {
    const lines = await getChatLines(msg.id);
    if (lines.length === 0) return;
    const initialMsg = msg.conversation[0];
    const hasInitial = lines.some(
      l => l.role === 'FAN' &&
        (l.content?.trim() === initialMsg.content?.trim() ||
          Math.abs(new Date(l.timestamp).getTime() - new Date(initialMsg.timestamp).getTime()) < 8000)
    );
    let fullConv = hasInitial ? lines : [initialMsg, ...lines];
    fullConv.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    // Deduplicate: same role+content (trimmed) within 5s
    fullConv = fullConv.filter((c, i, arr) =>
      i === arr.findIndex(x =>
        x.role === c.role && x.content?.trim() === c.content?.trim() &&
        Math.abs(new Date(x.timestamp).getTime() - new Date(c.timestamp).getTime()) < 5000
      )
    );
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, conversation: fullConv } : m));
  };

  // When a creator conversation is opened, hydrate all thread messages
  useEffect(() => {
    if (!selectedCreatorId) return;
    const threadMsgs = messages.filter(m => m.creatorId === selectedCreatorId);
    threadMsgs.forEach(msg => { if (msg.conversation.length <= 1) hydrateConversation(msg); });
  }, [selectedCreatorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMessages = async (silent = false) => {
    if (!silent) setIsLoading(true);
    const allMessages = await getMessages();
    const myMessages = allMessages.filter(m =>
      m.senderEmail === (currentUser?.email || 'sarah@example.com') ||
      currentUser?.email === 'google-user@example.com' ||
      (currentUser?.id && m.creatorId === currentUser.id)
    );
    myMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const freshMessages = myMessages.length > 0 ? myMessages : allMessages.slice(0, 2);

    // Merge: preserve already-hydrated conversations from prev state (take fresh metadata from DB)
    setMessages(prev => {
      if (prev.length === 0) return freshMessages;
      const prevMap = new Map(prev.map(m => [m.id, m]));
      return freshMessages.map(m => {
        const prevMsg = prevMap.get(m.id);
        if (prevMsg && prevMsg.conversation.length > 1) {
          return { ...m, conversation: prevMsg.conversation };
        }
        return m;
      });
    });
    if (!silent) { setIsLoading(false); setIsInitialLoad(false); }

    // After a silent (real-time) refresh, re-hydrate the open conversation
    if (silent) {
      const openCreatorId = selectedCreatorIdRef.current;
      if (openCreatorId) {
        const threadMsgs = freshMessages.filter(m => m.creatorId === openCreatorId);
        threadMsgs.forEach(msg => {
          invalidateChatLinesCache(msg.id);
          hydrateConversation(msg);
        });
      }
    }
  };

  const loadCreators = async () => {
      const creators = await getFeaturedCreators();
      // Force a state update to ensure UI reflects changes
      setFeaturedCreators(creators);
  };

  const loadPurchasedProducts = async () => {
      setIsLoading(true);
      const products = await getPurchasedProducts();
      setPurchasedProducts(products);
      setIsLoading(false);
  };

  const getFileType = (url: string) => {
      if (!url) return 'OTHER';
      if (url.startsWith('data:image')) return 'IMAGE';
      if (url.startsWith('data:application/pdf')) return 'DOCUMENT';
      if (url.startsWith('data:video')) return 'VIDEO';
      
      const ext = url.split('.').pop()?.split('?')[0].toLowerCase();
      if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) return 'DOCUMENT';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return 'IMAGE';
      if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext || '')) return 'VIDEO';
      return 'OTHER';
  };

  const filteredProducts = useMemo(() => {
      if (productFilter === 'ALL') return purchasedProducts;
      return purchasedProducts.filter(p => getFileType(p.url) === productFilter);
  }, [purchasedProducts, productFilter]);

  // Group messages for List View (Simulating grouping by Creator)
  const conversationGroups = useMemo(() => {
      if (messages.length === 0) return [];

      const groups: Record<string, { creatorId: string, creatorName: string, creatorAvatarUrl?: string, latestMessage: Message, messageCount: number, isDiemMessage: boolean }> = {};

      messages.forEach(msg => {
          if (msg.content.startsWith('Purchased Product:')) return;
          if (msg.content.startsWith('Fan Tip:')) return;

          // Diem→fan messages: fan is creator_id, Diem is sender
          const isDiemMessage = msg.creatorId === currentUser?.id;
          const cId = msg.creatorId || 'unknown';
          if (!groups[cId]) {
              groups[cId] = {
                  creatorId: cId,
                  // For Diem→fan messages, show Diem's name/avatar instead of the fan's own
                  creatorName: isDiemMessage ? (msg.senderName || 'Diem') : (msg.creatorName || 'Creator'),
                  creatorAvatarUrl: isDiemMessage ? msg.senderAvatarUrl : msg.creatorAvatarUrl,
                  latestMessage: msg,
                  messageCount: 0,
                  isDiemMessage,
              };
          }
          if (msg.status === 'REPLIED' && !msg.isRead) groups[cId].messageCount++;
          if (new Date(msg.createdAt) > new Date(groups[cId].latestMessage.createdAt)) {
              groups[cId].latestMessage = msg;
          }
      });

      return Object.values(groups);
  }, [messages, currentUser?.id]);

  const filteredGroups = useMemo(() => {
      return conversationGroups.filter(g => {
          const leftAt = leftChatrooms[g.creatorId];
          if (leftAt && new Date(g.latestMessage.createdAt).getTime() <= leftAt) return false;
          
          const status = g.latestMessage.status;
          if (inboxFilter === 'PENDING' && status !== 'PENDING') return false;
          if (inboxFilter === 'REPLIED' && status !== 'REPLIED') return false;
          if (inboxFilter === 'REJECTED' && status !== 'EXPIRED' && status !== 'CANCELLED') return false;

          return g.creatorName.toLowerCase().includes(searchQuery.toLowerCase());
      });
  }, [conversationGroups, searchQuery, leftChatrooms, inboxFilter]);

  const filteredCreators = useMemo(() => {
    const list = featuredCreators.filter(c => 
        c.displayName.toLowerCase().includes(exploreQuery.toLowerCase()) ||
        c.tags.some(t => t.toLowerCase().includes(exploreQuery.toLowerCase()))
    );

    // Add Mock "Under Review" Expert
    if (!exploreQuery || 'sarah design'.includes(exploreQuery.toLowerCase())) {
        list.push({
            id: 'mock-review-1',
            displayName: 'Sarah Design',
            handle: '@sarahdesign',
            bio: 'Senior Product Designer. Portfolio reviews & career mentorship.',
            avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
            pricePerMessage: 150,
            responseWindowHours: 24,
            stats: { averageRating: 5.0, responseTimeAvg: 'Very Fast', profileViews: 1200, replyRate: '100%' },
            tags: ['Design', 'UX'],
            likesCount: 45,
            platforms: ['instagram', 'linkedin'],
            links: [],
            products: [],
            customQuestions: [],
            // @ts-ignore
            isUnderReview: true
        } as CreatorProfile);
    }
    
    return list;
  }, [featuredCreators, exploreQuery]);

  const threadMessages = useMemo(() => {
      if (!selectedCreatorId) return [];
      const leftAt = leftChatrooms[selectedCreatorId];
      return messages
        .filter(m => m.creatorId === selectedCreatorId && !m.content.startsWith('Purchased Product:') && !m.content.startsWith('Fan Tip:'))
        .filter(m => !leftAt || new Date(m.createdAt).getTime() > leftAt)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, selectedCreatorId, leftChatrooms]);

  const latestMessage = threadMessages.length > 0 ? threadMessages[threadMessages.length - 1] : null;

  const effectiveSessionIndex = useMemo(() => {
      if (threadMessages.length === 0) return 0;
      return Math.min(chatSessionIndex, threadMessages.length - 1);
  }, [chatSessionIndex, threadMessages.length]);

  const currentCreator = useMemo(() => {
      return featuredCreators.find(c => c.id === selectedCreatorId);
  }, [featuredCreators, selectedCreatorId]);

  const [showReadCelebration, setShowReadCelebration] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [showReadBanner, setShowReadBanner] = useState(false);
  const [celebratedMessageIds, setCelebratedMessageIds] = useState<Set<string>>(new Set());

  // Memoize sprinkles to prevent re-render jitter
  const sprinkles = useMemo(() => {
      const colors = ['#FFD700', '#FF69B4', '#00FFFF', '#00FF00', '#9D00FF', '#FF4500'];
      return Array.from({ length: 80 }).map((_, i) => ({
          id: i,
          left: Math.random() * 100,
          animationDelay: Math.random() * 0.8,
          animationDuration: 2 + Math.random() * 2.5,
          size: 6 + Math.random() * 8,
          color: colors[Math.floor(Math.random() * colors.length)],
          type: ['circle', 'square', 'triangle'][Math.floor(Math.random() * 3)]
      }));
  }, []);

  useEffect(() => {
      if (latestMessage) {
          // Check if we should celebrate this message being read
          // We celebrate if it's Read, Pending, and hasn't been celebrated in this session yet
          if (latestMessage.isRead && latestMessage.status === 'PENDING' && !celebratedMessageIds.has(latestMessage.id)) {
              const lastChat = latestMessage.conversation[latestMessage.conversation.length - 1];
              // Only celebrate if the last message was from the fan (waiting for reply)
              if (!lastChat || lastChat.role === 'FAN') {
                  setShowReadCelebration(true);
                  setTimeout(() => setShowReadCelebration(false), 4000);
                  
                  setShowReadBanner(true);
                  setTimeout(() => setShowReadBanner(false), 2000);
                  
                  setCelebratedMessageIds(prev => new Set(prev).add(latestMessage.id));
              }
          }
      }
  }, [latestMessage, celebratedMessageIds]);

  const getSessionStatus = (msg: Message) => {
      if (msg.status === 'REPLIED') return { label: t('creator.collected'), color: 'text-emerald-600', icon: CheckCircle2 };
      if (msg.status === 'EXPIRED') return { label: t('creator.expired'), color: 'text-stone-400', icon: Ban };
      if (msg.status === 'CANCELLED') return { label: t('creator.cancelled'), color: 'text-red-600', icon: Ban };
      
      // PENDING
      const lastChat = msg.conversation[msg.conversation.length - 1];
      if (lastChat?.role === 'CREATOR') {
          return { label: t('fan.creatorAnswering'), color: 'text-stone-700', icon: MessageSquare };
      }
      
      if (msg.isRead) {
          return { label: t('creator.read'), color: 'text-stone-600', icon: Check };
      }
      
      return { label: t('fan.notYetRead'), color: 'text-stone-400', icon: Clock };
  };

  const handleNavigate = (view: typeof currentView) => {
      const path = view === 'OVERVIEW' ? '/dashboard' : `/dashboard/${view.toLowerCase()}`;
      window.history.pushState({ page: 'FAN_DASHBOARD' }, '', path);
      setCurrentView(view);
      setSelectedCreatorId(null);
      setIsSidebarOpen(false);
  };

  // Derived state for UI logic
  const hasThanked = useMemo(() => {
      return latestMessage?.conversation.some(c => c.role === 'FAN' && c.content.startsWith('Fan Appreciation:'));
  }, [latestMessage]);

  const handleOpenChat = (creatorId: string) => {
      setSelectedCreatorId(creatorId);
      setChatSessionIndex(Infinity);
      setShowFollowUpInput(false);
      setFollowUpText('');
      setCustomAppreciationMode(false);
      setCustomAppreciationText('');
      setConfirmCancelId(null);
      setShowReadBanner(false);
      // Ensure we stay in Overview when opening chat, but the 'selectedCreatorId' acts as a sub-view
      setCurrentView('OVERVIEW');
  };

  const handleCancelClick = (msgId: string) => {
    setConfirmCancelId(msgId);
  };

  const processCancellation = async () => {
    if (!confirmCancelId) return;
    setIsCancelling(true);
    try {
        await cancelMessage(confirmCancelId);
        await loadMessages(true);
        setConfirmCancelId(null);
    } catch (error) {
        console.error("Cancel failed", error);
        alert(t('fan.failedCancel'));
    } finally {
        setIsCancelling(false);
    }
  };

  const handleFollowUpFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (!files.length || !latestMessage) return;
      const remaining = 3 - followUpAttachments.length;
      const toUpload = files.slice(0, remaining);
      if (toUpload.length === 0) return;
      setIsUploadingFollowUpAttachment(true);
      try {
          const urls = await Promise.all(toUpload.map(f => uploadProductFile(f, latestMessage.creatorId || '')));
          setFollowUpAttachments(prev => [...prev, ...urls]);
      } catch (error) {
          console.error('Follow-up attachment upload failed:', error);
      } finally {
          setIsUploadingFollowUpAttachment(false);
          if (followUpFileInputRef.current) followUpFileInputRef.current.value = '';
      }
  };

  const handleSendFollowUp = async () => {
      if (!latestMessage || !followUpText.trim()) return;
      setIsSendingFollowUp(true);
      try {
          const attachments = followUpAttachments.length > 0
              ? followUpAttachments.map(url => ({
                  url,
                  type: (isImage(url) ? 'IMAGE' : 'FILE') as 'IMAGE' | 'FILE',
                  name: url.split('/').pop()?.split('?')[0] || 'file'
              }))
              : undefined;
          // For Diem→fan threads, creatorId = fan's own ID; the real target is the sender (Diem admin)
          const isDiemThread = latestMessage.creatorId === currentUser?.id;
          const targetCreatorId = isDiemThread ? (latestMessage.senderId || latestMessage.creatorId || '') : (latestMessage.creatorId || '');
          const followUpPrice = isDiemThread ? 0 : (currentCreator?.pricePerMessage ?? latestMessage.amount);
          await sendMessage(targetCreatorId, latestMessage.senderName, latestMessage.senderEmail, followUpText, followUpPrice, attachments);
          // Subscription will refresh message list via debounced loadMessages(true)
          setShowFollowUpInput(false);
          setFollowUpText('');
          setFollowUpAttachments([]);
          setToastMessage(t('fan.followUpSent'));
          setTimeout(() => setToastMessage(null), 3000);
          // Refresh user balance if updated
          if (onUpdateUser && currentUser) {
              onUpdateUser({ ...currentUser, credits: currentUser.credits - followUpPrice });
          }
      } catch (e: any) {
          if (e.message.includes("Insufficient")) {
              setShowTopUpModal(true);
          } else {
              console.error(e);
              alert(e.message || "Failed to send follow-up.");
          }
      } finally {
          setIsSendingFollowUp(false);
      }
  };

  const handleSendAppreciation = async (msgId: string, text: string) => {
      try {
          await sendFanAppreciation(msgId, text);
          setCustomAppreciationText('');
          setCustomAppreciationMode(false);
          await loadMessages(true);
          setToastMessage(t('fan.appreciationSent'));
          setTimeout(() => setToastMessage(null), 3000);
          // Decrease local credits for the tip (mock 50)
          if (onUpdateUser && currentUser) {
              onUpdateUser({ ...currentUser, credits: currentUser.credits - 50 });
          }
      } catch (e: any) { 
          if (e.message?.includes("Insufficient") || (currentUser && currentUser.credits < 50)) { // Mock check for tip
              setShowTopUpModal(true);
          } else {
              console.error("Failed to send appreciation", e);
          }
      }
  };

  const recordCreditPurchase = (amount: number) => {
      const purchase = { id: `cp-${Date.now()}`, amount, date: new Date().toISOString() };
      const updated = [purchase, ...creditPurchases];
      setCreditPurchases(updated);
      localStorage.setItem('diem_credit_purchases', JSON.stringify(updated));
  };

  const handleTopUp = async () => {
      setIsProcessingTopUp(true);

      // Try Stripe Checkout if backend is configured
      if (isBackendConfigured()) {
          try {
              const { url } = await createCheckoutSession(topUpAmount);
              if (url) {
                  localStorage.setItem('diem_pending_purchase_amount', String(topUpAmount));
                  window.location.href = url;
                  return;
              }
              // url is null — Stripe not configured, fall through to mock
          } catch (e: any) {
              console.error(e);
              setIsProcessingTopUp(false);
              alert('Your balance is still being processed. Please try again in a few moments.');
              return;
          }
      }

      // Mock fallback
      try {
          await new Promise(r => setTimeout(r, 1500));
          const updatedUser = await addCredits(topUpAmount);
          if (onUpdateUser) onUpdateUser(updatedUser);
          recordCreditPurchase(topUpAmount);
          setLastTopUpAmount(topUpAmount);
          setTopUpSuccess(true);
          setTimeout(() => {
              setTopUpSuccess(false);
              setShowTopUpModal(false);
          }, 3000);
      } catch (e) {
          console.error(e);
          alert(t('fan.topUpFailed'));
      } finally {
          setIsProcessingTopUp(false);
      }
  };

  const handleSaveProfile = async () => {
      if (!currentUser) return;
      setIsSavingProfile(true);
      setShowSaveSuccess(false);
      try {
          const updatedUser = {
              ...currentUser,
              name: profileForm.name,
              age: profileForm.age ? parseInt(profileForm.age) : undefined,
              avatarUrl: profileForm.avatarUrl,
              bio: profileForm.bio
          };
          await updateCurrentUser(updatedUser);
          if (onUpdateUser) onUpdateUser(updatedUser);
          setShowSaveSuccess(true);
          setTimeout(() => setShowSaveSuccess(false), 3000);
      } catch (e) { console.error(e); } finally { setIsSavingProfile(false); }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setAvatarFileName(file.name);
          if (!file.type.startsWith('image/')) {
              alert(t('fan.invalidImage'));
              return;
          }

          // Resize image to max 400x400
          const reader = new FileReader();
          reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;
                  const MAX_SIZE = 400;
                  if (width > height) {
                      if (width > MAX_SIZE) {
                          height *= MAX_SIZE / width;
                          width = MAX_SIZE;
                      }
                  } else {
                      if (height > MAX_SIZE) {
                          width *= MAX_SIZE / height;
                          height = MAX_SIZE;
                      }
                  }
                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0, width, height);
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                  setProfileForm(prev => ({ ...prev, avatarUrl: dataUrl }));
              };
              img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
      }
  };

  const getTimeLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (diff < 0) return { text: 'Expired', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', iconColor: 'text-red-500' };
    if (hours < 4) return { text: `${hours}h left`, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', iconColor: 'text-amber-500' };
    if (hours < 12) return { text: `${hours}h left`, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', iconColor: 'text-orange-500' };
    return { text: `${hours}h left`, color: 'text-stone-600', bg: 'bg-stone-100', border: 'border-stone-200', iconColor: 'text-stone-500' };
  };

  const activeRequests = messages.filter(m => m.status === 'PENDING').length;
  
  const notifications = useMemo(() => {
      const list: { id: string, icon: any, text: string, time: Date, color: string, creatorId?: string }[] = [];

      messages.forEach(msg => {
          const isProduct = msg.content.startsWith('Purchased Product:');
          const isTip = msg.content.startsWith('Fan Tip:');

          // 1. Reply Received
          if (msg.status === 'REPLIED' && msg.replyAt && !isProduct && !isTip) {
              list.push({
                  id: `reply-${msg.id}`,
                  icon: MessageSquare,
                  text: t('fan.creatorReplied', { name: msg.creatorName || t('common.creator') }),
                  time: new Date(msg.replyAt),
                  color: 'bg-green-100 text-green-600',
                  creatorId: msg.creatorId
              });
          }

          // 3. Refunded (Expired)
          if (msg.status === 'EXPIRED') {
              list.push({
                  id: `exp-${msg.id}`,
                  icon: Coins,
                  text: t('fan.requestExpired', { name: msg.creatorName || t('common.creator'), amount: msg.amount }),
                  time: new Date(msg.expiresAt),
                  color: 'bg-amber-100 text-amber-600',
                  creatorId: msg.creatorId
              });
          }

          // 4. Cancelled by fan
          if (msg.status === 'CANCELLED') {
               list.push({
                  id: `can-${msg.id}`,
                  icon: Ban,
                  text: t('fan.requestCancelled', { name: msg.creatorName || t('common.creator') }),
                  time: new Date(msg.createdAt),
                  color: 'bg-stone-100 text-stone-500',
                  creatorId: msg.creatorId
              });
          }

          // 5. Product Purchased
          if (isProduct) {
               const productName = msg.content.replace('Purchased Product: ', '');
               list.push({
                  id: `purch-${msg.id}`,
                  icon: ShoppingBag,
                  text: t('fan.productPurchased', { product: productName }),
                  time: new Date(msg.createdAt),
                  color: 'bg-purple-100 text-purple-600',
                  creatorId: msg.creatorId
              });
          }
      });

      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      return list
        .filter(n => !deletedNotificationIds.includes(n.id))
        .filter(n => n.time.getTime() >= threeDaysAgo)
        .sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [messages, deletedNotificationIds]);

  const handleDeleteNotification = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeletedNotificationIds(prev => [...prev, id]);
  };

  const handleClearAllNotifications = () => {
      if (notifications.length === 0) return;
      if (window.confirm(t('fan.clearNotifications'))) {
          const allIds = notifications.map(n => n.id);
          setDeletedNotificationIds(prev => [...prev, ...allIds]);
      }
  };

  const handleToggleNotifications = () => {
      if (!showNotifications) {
          setLastReadTime(Date.now());
          localStorage.setItem('diem_fan_last_read_time', Date.now().toString());
      }
      setShowNotifications(!showNotifications);
  };

  const handleNotificationClick = (notif: any) => {
      if (notif.creatorId) {
          handleOpenChat(notif.creatorId);
      }
      setDeletedNotificationIds(prev => [...prev, notif.id]);
      setShowNotifications(false);
  };

  const getPageTitle = () => {
      if (selectedCreatorId) return t('fan.conversations');
      switch (currentView) {
          case 'OVERVIEW': return t('fan.conversations');
          case 'EXPLORE': return t('fan.exploreCreators');
          case 'PURCHASED': return t('fan.purchased');
          case 'HISTORY': return t('fan.purchaseHistory');
          case 'SUPPORT': return t('profile.support');
          case 'SETTINGS': return t('creator.profileSettings');
          case 'NOTIFICATIONS': return t('creator.notifications');
          default: return t('common.diem');
      }
  };

  // Helper to get platform icon
  const getPlatformIcon = (platform: string, variant: 'light' | 'colored' = 'colored') => {
      const size = 14;
      const cn = variant === 'light' ? 'text-white fill-current' : '';
      switch(platform.toLowerCase()) {
          case 'youtube': return <YouTubeLogo className={`${cn} ${variant === 'colored' ? 'text-red-600' : ''} w-4 h-4`} />;
          case 'instagram': return <InstagramLogo className={`${cn} ${variant === 'colored' ? 'text-pink-600' : ''} w-4 h-4`} />;
          case 'x': return <XLogo className={`${cn} ${variant === 'colored' ? 'text-black' : ''} w-3.5 h-3.5`} />;
          case 'tiktok': return <TikTokLogo className={`${cn} ${variant === 'colored' ? 'text-black' : ''} w-3.5 h-3.5`} />;
          case 'spotify': return <SpotifyLogo className={`${cn} ${variant === 'colored' ? 'text-[#1DB954]' : ''} w-4 h-4`} />;
          case 'linkedin': return <User size={size} className={`${cn} ${variant === 'colored' ? 'text-blue-700' : ''}`} />;
          default: return <Sparkles size={size} className={cn} />;
      }
  };

  // Sidebar Item Component
  const SidebarItem = ({ icon: Icon, label, view, isBeta, onClick }: { icon: any, label: string, view?: 'OVERVIEW' | 'EXPLORE' | 'SETTINGS' | 'PURCHASED' | 'HISTORY' | 'SUPPORT' | 'NOTIFICATIONS', isBeta?: boolean, onClick?: () => void }) => (
    <button 
      onClick={() => { 
          if (onClick) {
              onClick();
          } else if (view) {
              handleNavigate(view);
          }
          setIsSidebarOpen(false); 
      }}
      className={`w-full flex items-center px-3 py-2 rounded-md mb-1 transition-colors text-sm font-medium ${
        currentView === view && !selectedCreatorId && !onClick
          ? 'bg-stone-200 text-stone-900' 
          : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
      }`}
    >
      <Icon size={18} className={`mr-3 ${currentView === view && !selectedCreatorId && !onClick ? 'text-stone-900' : 'text-stone-400'}`} />
      <span>{label}</span>
      {isBeta && (
          <span className="ml-2 bg-stone-100 text-stone-500 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-stone-200">BETA</span>
      )}
    </button>
  );

  const ComingSoonOverlay = () => (
      <div className="absolute inset-0 bg-stone-50/70 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center text-stone-900">
        <div className="bg-white p-2.5 rounded-full shadow-lg mb-2 ring-1 ring-stone-100 animate-in zoom-in duration-300">
            <Lock size={20} className="text-stone-400" />
        </div>
        <span className="font-bold text-xs uppercase tracking-wider text-stone-500 bg-white/80 px-3 py-1 rounded-full border border-stone-100">{t('common.comingSoon')}</span>
      </div>
  );

  const TopNav = ({ className = "", hideBurger = false }: { className?: string; hideBurger?: boolean }) => (
    <div className={`flex items-center justify-end gap-3 ${className}`}>
        {!hideBurger && (
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 mr-auto p-2 -ml-2">
                <Menu size={24} />
            </button>
        )}

        <button 
            onClick={() => setShowTopUpModal(true)}
            className="hidden sm:flex items-center gap-2 bg-stone-100 hover:bg-stone-200 transition-colors px-3 py-1.5 rounded-full text-xs font-bold text-stone-600 cursor-pointer"
        >
            <Coins size={14} className="text-stone-500" />
            {currentUser?.credits || 0} {t('common.credits')}
        </button>
        
        <div className="hidden sm:block h-6 w-px bg-stone-200"></div>
        <LanguageSwitcher />

        <div className="relative">
            <button 
                onClick={handleToggleNotifications}
                className="relative text-stone-400 hover:text-stone-600 transition-colors p-2 rounded-full hover:bg-stone-100"
            >
                <Bell size={20} />
                {notifications.filter(n => n.time.getTime() > lastReadTime).length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>}
            </button>

            {showNotifications && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-white rounded-2xl shadow-xl border border-stone-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-4 py-3 border-b border-stone-50 bg-stone-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-sm text-stone-900">{t('creator.notifications')}</h3>
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{t('fan.updates', { count: notifications.length })}</span>
                        </div>
                        <div className="max-h-[320px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-stone-400 text-xs">{t('fan.noNotifications')}</div>
                            ) : (
                                notifications.map(notif => (
                                    <div 
                                        key={notif.id} 
                                        onClick={() => handleNotificationClick(notif)}
                                        className="px-4 py-3 hover:bg-stone-50 transition-colors flex gap-3 border-b border-stone-50 last:border-0 group relative pr-8 cursor-pointer"
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${notif.color}`}>
                                            <notif.icon size={14} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs text-stone-600 leading-snug mb-1 font-medium">{notif.text}</p>
                                            <p className="text-[10px] text-stone-400">{notif.time.toLocaleDateString()} • {notif.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                        </div>
                                        <button 
                                            onClick={(e) => handleDeleteNotification(e, notif.id)}
                                            className="absolute top-3 right-3 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Dismiss"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    </div>
  );

  if (isInitialLoad) {
    if (!showFanLoadingUI) return null;
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9]" style={{ animation: 'fadeIn 0.3s ease both' }}>
        <div className="flex flex-col items-center gap-4">
          <DiemLogo size={32} />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-sm font-semibold text-stone-700">Carpe Diem</span>
            <span className="text-xs text-stone-400">Seize your day from your favorite creator</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex font-sans text-stone-900 overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true" style={{
        backgroundImage: 'linear-gradient(to right, rgba(168,162,158,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(168,162,158,0.08) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 100%)',
      }} />
        {/* Inject Animation Styles Globally for the Component */}
        <style>{`
            @keyframes sprinkle-fall {
                0% { transform: translateY(-10vh) rotate(0deg) translateX(0); opacity: 1; }
                25% { transform: translateY(20vh) rotate(90deg) translateX(15px); }
                50% { transform: translateY(50vh) rotate(180deg) translateX(-15px); }
                75% { transform: translateY(75vh) rotate(270deg) translateX(10px); }
                100% { transform: translateY(100vh) rotate(360deg) translateX(0); opacity: 0; }
            }
            .animate-sprinkle {
                animation: sprinkle-fall 3s linear forwards;
                will-change: transform;
            }
        `}</style>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-stone-900/50 z-30 md:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* 1. SIDEBAR */}
        <aside className={`fixed inset-y-0 left-0 w-64 bg-[#F5F3EE] border-r border-stone-200 transform transition-transform duration-300 z-40 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
            <div className="p-4 h-full flex flex-col">
                {/* Brand */}
                <div 
                    onClick={() => handleNavigate('OVERVIEW')}
                    className="flex items-center gap-2 px-3 py-4 mb-6 cursor-pointer hover:opacity-80 transition-opacity"
                >
                    <DiemLogo size={24} className="text-stone-900" />
                </div>

                {/* Nav Links */}
                <div className="space-y-1 flex-1">
                    <div className="px-3 mb-2 text-xs font-bold text-stone-400 uppercase tracking-wider">{t('fan.fanMenu')}</div>
                    <SidebarItem icon={Home} label={t('fan.conversations')} view="OVERVIEW" />
                    {/* <SidebarItem icon={Search} label={t('fan.exploreCreators')} view="EXPLORE" /> */}
                    <SidebarItem icon={ShoppingBag} label={t('fan.purchased')} view="PURCHASED" isBeta={true} />
                    <SidebarItem icon={Bell} label={t('creator.notifications')} view="NOTIFICATIONS" />
                    {/* Wallet now acts as a trigger for the modal, not a separate view */}
                    <SidebarItem icon={Wallet} label={t('fan.myWallet')} onClick={() => setShowTopUpModal(true)} />
                    <SidebarItem icon={Receipt} label={t('fan.purchaseHistory')} view="HISTORY" />
                    <SidebarItem icon={HelpCircle} label={t('profile.support')} view="SUPPORT" />
                    
                    <div className="my-4 mx-3 border-t border-stone-200"></div>
                    <SidebarItem icon={User} label={t('fan.profile')} view="SETTINGS" />
                </div>

                {/* Profile Snippet Bottom */}
                <div className="mt-auto border-t border-stone-200 pt-4 px-3">
                    <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-stone-200 overflow-hidden">
                            {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-full h-full p-1 text-stone-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-900 truncate">{currentUser?.name || 'Fan User'}</p>
                            <p className="text-xs text-stone-500 truncate">{currentUser?.email}</p>
                        </div>
                        <button onClick={onLogout} className="text-stone-400 hover:text-red-600 transition-colors">
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </aside>

        {/* 2. MAIN CONTENT */}
        <main className="flex-1 md:ml-64 flex flex-col h-screen relative min-w-0 overflow-x-hidden">
            {/* Demo Banner */}
            {!isBackendConfigured() && (
                <div className="bg-amber-500 text-white text-[11px] font-bold px-4 py-1.5 text-center z-50 tracking-wide">
                    MOCK DATA — not connected to real backend
                </div>
            )}

            {/* Content Area */}
            <div className={`flex-1 relative bg-[#FAF9F6] ${currentView === 'OVERVIEW' ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'} ${currentView === 'OVERVIEW' && !selectedCreatorId ? 'p-0' : ''}`}>
                
                {/* --- VIEW: PURCHASED (BETA) --- */}
                {currentView === 'PURCHASED' && (
                    <div className="animate-in fade-in w-full">
                        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0">
                                    <Menu size={24} />
                                </button>
                                <h2 className="text-xl font-bold text-stone-900">{t('fan.purchased')}</h2>
                            </div>
                            <TopNav hideBurger />
                        </div>
                        <div className="px-3 sm:px-6 pb-6 space-y-4 sm:space-y-6 max-w-5xl mx-auto">
                        <div className="bg-stone-900 text-white p-4 sm:p-8 rounded-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="bg-white/10 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border border-white/10">{t('fan.betaAccess')}</span>
                                        <Sparkles size={14} className="text-stone-400" />
                                    </div>
                                    <h3 className="font-bold text-2xl md:text-3xl mb-2">{t('fan.myLibrary')}</h3>
                                    <p className="text-stone-400 text-sm max-w-lg leading-relaxed">
                                        {t('fan.libraryDesc')}
                                    </p>
                                </div>
                                <div className="hidden md:block">
                                    <div className="bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                                        <ShoppingBag size={32} className="text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Content Filter Tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                             {(['ALL', 'DOCUMENT', 'IMAGE', 'VIDEO'] as const).map(type => (
                                 <button 
                                    key={type}
                                    onClick={() => setProductFilter(type)}
                                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                                        productFilter === type 
                                        ? 'bg-stone-900 text-white shadow-md' 
                                        : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                                    }`}
                                 >
                                     {type === 'ALL' ? t('fan.allContent') : type === 'DOCUMENT' ? t('fan.documents') : type === 'IMAGE' ? t('fan.images') : t('fan.videos')}
                                 </button>
                             ))}
                        </div>

                        {isLoading ? (
                            <div className="text-center py-20 text-stone-400">{t('fan.loadingLibrary')}</div>
                        ) : filteredProducts.length > 0 ? (
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                                {filteredProducts.map((product, idx) => (
                                    <div key={idx} className="bg-white rounded-xl sm:rounded-2xl border border-stone-200 overflow-hidden shadow-sm flex flex-col">
                                <div className="bg-stone-100 flex items-center justify-center p-4 sm:p-8 h-28 sm:h-auto sm:aspect-[4/3] relative">
                                     <div className="bg-white shadow-lg w-14 h-20 sm:w-24 sm:h-32 rounded-sm border border-stone-200 flex items-center justify-center flex-shrink-0">
                                         {(() => {
                                             const type = getFileType(product.url);
                                             if (type === 'IMAGE') return <ImageIcon size={20} className="text-purple-500 sm:hidden" />;
                                             if (type === 'VIDEO') return <Video size={20} className="text-blue-500 sm:hidden" />;
                                             return <FileText size={20} className="text-red-500 sm:hidden" />;
                                         })()}
                                         {(() => {
                                             const type = getFileType(product.url);
                                             if (type === 'IMAGE') return <ImageIcon size={32} className="text-purple-500 hidden sm:block" />;
                                             if (type === 'VIDEO') return <Video size={32} className="text-blue-500 hidden sm:block" />;
                                             return <FileText size={32} className="text-red-500 hidden sm:block" />;
                                         })()}
                                     </div>
                                     <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-bold text-stone-500 border border-stone-200">
                                         {getFileType(product.url)}
                                     </div>
                                </div>
                                <div className="p-3 sm:p-5 flex flex-col flex-1">
                                    <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                                        <div className="w-4 h-4 rounded-full bg-stone-200 overflow-hidden flex-shrink-0">
                                            <img src={product.creatorAvatar || 'https://via.placeholder.com/100'} alt="Creator" className="w-full h-full object-cover"/>
                                        </div>
                                        <span className="text-[9px] font-bold text-stone-500 truncate">{product.creatorName}</span>
                                    </div>
                                    <h4 className="font-bold text-stone-900 text-xs sm:text-sm mb-1 leading-tight line-clamp-2">{product.title}</h4>
                                    <p className="text-[10px] sm:text-xs text-stone-500 mb-3 line-clamp-2 flex-1 hidden sm:block">{product.description || t('profile.digitalDownload')}</p>
                                    <div className="pt-2 border-t border-stone-100 flex justify-between items-center gap-1">
                                        <span className="text-[9px] text-stone-400">{new Date(product.purchaseDate).toLocaleDateString()}</span>
                                        <button
                                            className="text-[10px] sm:text-xs font-semibold text-stone-700 hover:underline flex items-center gap-0.5 flex-shrink-0"
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                try {
                                                    const secureUrl = await getSecureDownloadUrl(product.title, product.url, product.creatorId);
                                                    if (secureUrl) {
                                                        const link = document.createElement('a');
                                                        link.href = secureUrl;
                                                        link.download = product.title || 'download';
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                    } else {
                                                        alert(t('profile.failedDownload'));
                                                    }
                                                } catch (error: any) {
                                                    console.error("Download failed:", error);
                                                    alert(error.message || t('profile.failedDownloadRetry'));
                                                }
                                            }}
                                        >
                                            <Download size={10}/> {t('profile.downloadFile')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 text-stone-400 bg-white rounded-3xl border border-stone-100 shadow-sm">
                                <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="text-lg font-bold text-stone-500">
                                    {purchasedProducts.length > 0 ? t('fan.noMatchingContent') : t('fan.noPurchases')}
                                </p>
                                <p className="text-sm">
                                    {purchasedProducts.length > 0 ? t('fan.tryDifferentFilter') : t('fan.supportCreatorsProducts')}
                                </p>
                            </div>
                        )}

                        </div>
                    </div>
                )}

                {/* --- VIEW: EXPLORE CREATORS (hidden for now) --- */}
                {false && currentView === 'EXPLORE' && (
                    <div className="animate-in fade-in">
                        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0">
                                    <Menu size={24} />
                                </button>
                            </div>
                            <TopNav hideBurger />
                        </div>
                        <div className="px-4 sm:px-6 pb-6 space-y-6 max-w-7xl mx-auto">
                        {/* Header Section */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                            <div>
                                <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
                                    {t('fan.featuredExperts')}
                                    <button onClick={() => loadCreators()} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-full transition-colors" title={t('fan.refreshList')}>
                                        <RefreshCw size={16} />
                                    </button>
                                </h2>
                                <p className="text-stone-500 text-sm mt-1">{t('fan.verifiedExperts')}</p>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                <div className="relative group flex-1 sm:flex-initial">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-stone-600 transition-colors" size={16} />
                                    <input 
                                        type="text" 
                                        placeholder={t('fan.searchCreators')}
                                        value={exploreQuery}
                                        onChange={(e) => setExploreQuery(e.target.value)}
                                        className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-medium focus:ring-1 focus:ring-stone-400 outline-none transition-all shadow-sm"
                                    />
                                </div>
                                <select className="bg-white border border-stone-200 text-stone-700 text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-stone-400 shadow-sm">
                                    <option>{t('fan.sortRelevance')}</option>
                                    <option>{t('fan.sortPrice')}</option>
                                    <option>{t('fan.sortResponse')}</option>
                                </select>
                            </div>
                        </div>

                        {/* RANKING GRID */}
                        {filteredCreators.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredCreators.map((creator, index) => {
                                    // @ts-ignore
                                    const platforms = creator.platforms || ['youtube'];
                                    const followers = (creator.stats.profileViews / 1000).toFixed(1) + 'k'; // Mock followers from views
                                    const likesFormatted = creator.likesCount.toLocaleString();
                                    // @ts-ignore
                                    const isUnderReview = creator.isUnderReview;

                                    return (
                                        <div 
                                            key={creator.id} 
                                            onClick={() => !isUnderReview && onBrowseCreators(creator.id)}
                                            className={`group bg-white rounded-[2rem] p-6 border border-stone-100 shadow-sm hover:shadow-xl hover:shadow-stone-200/50 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col items-center text-center h-full relative overflow-hidden ${isUnderReview ? 'opacity-75' : ''}`}
                                        >
                                            {isUnderReview && (
                                                <div className="absolute inset-0 z-50 flex items-center justify-center">
                                                    <div className="bg-stone-900/90 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl transform -rotate-3 border border-white/20 flex items-center gap-2">
                                                        <Clock size={12} className="text-yellow-400 animate-pulse" />
                                                        {t('fan.applicationUnderReview')}
                                                    </div>
                                                </div>
                                            )}
                                            {/* Gradient Header */}
                                            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-stone-50 to-transparent opacity-60"></div>

                                            {/* 1. Avatar (Centered & Larger) */}
                                            <div className="relative mb-4 z-10">
                                                <div className="w-20 h-20 rounded-full p-1 bg-white shadow-sm border border-stone-100 mx-auto flex items-center justify-center overflow-hidden">
                                                    {isUnderReview ? (
                                                        <div className="w-full h-full bg-stone-50 flex items-center justify-center">
                                                            <User size={32} className="text-stone-300" />
                                                        </div>
                                                    ) : (
                                                        <img src={creator.avatarUrl} className="w-full h-full rounded-full object-cover" alt={creator.displayName} />
                                                    )}
                                                </div>
                                            </div>

                                            {/* 2. Name & Info */}
                                            <div className="relative z-10 w-full mb-5">
                                                <h3 className={`font-black text-stone-900 text-lg leading-tight group-hover:text-stone-900 transition-colors mb-1 truncate px-2 ${isUnderReview ? 'blur-sm opacity-40 select-none' : ''}`}>
                                                    {isUnderReview ? 'Creator Name' : creator.displayName}
                                                </h3>
                                                <div className="flex items-center justify-center gap-1.5 mb-3 mt-2">
                                                    {platforms.slice(0, 3).map((p: any, i: number) => {
                                                        const platformId = typeof p === 'string' ? p : p?.id || '';
                                                        return (
                                                            <div key={i} className="w-7 h-7 rounded-full bg-stone-50 border border-stone-100 flex items-center justify-center hover:scale-110 transition-transform shadow-sm">
                                                                {getPlatformIcon(platformId, 'colored')}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="flex items-center justify-center gap-3 text-xs text-stone-500 font-medium">
                                                    <span className="flex items-center gap-1"><Star size={10} className="fill-yellow-400 text-yellow-400"/> {creator.stats.averageRating.toFixed(1)}</span>
                                                    <span className="w-1 h-1 rounded-full bg-stone-300"></span>
                                                    <span>{likesFormatted} Likes</span>
                                                </div>
                                            </div>

                                            {/* 3. Stats Grid - Compact */}
                                            <div className="grid grid-cols-2 gap-2 w-full mb-6 relative z-10">
                                                <div 
                                                    className="relative group/tooltip bg-stone-50 rounded-xl p-2.5 border border-stone-100 flex flex-col items-center justify-center cursor-help transition-colors hover:bg-stone-100"
                                                >
                                                    <span className="text-[10px] font-bold text-stone-400 uppercase mb-0.5">{t('fan.reply')}</span>
                                                    <span className="font-black text-stone-700 text-xs text-center leading-tight">{creator.stats.responseTimeAvg}</span>
                                                    
                                                    {/* Custom Tooltip */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[140px] bg-stone-800 text-white text-[10px] font-medium py-1.5 px-2.5 rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 text-center shadow-xl">
                                                        {getResponseTimeTooltip(creator.stats.responseTimeAvg, t)}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-800"></div>
                                                    </div>
                                                </div>
                                                <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-100 flex flex-col items-center justify-center">
                                                    <span className="text-[10px] font-bold text-stone-400 uppercase mb-0.5">{t('fan.window')}</span>
                                                    <span className="font-black text-stone-700 text-sm">{creator.responseWindowHours}h</span>
                                                </div>
                                            </div>

                                            {/* 4. Action */}
                                            <div className="mt-auto w-full relative z-10">
                                                <button className="w-full bg-stone-900 text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-stone-900/20 group-hover:bg-stone-800 group-hover:shadow-stone-900/30 transition-all flex items-center justify-center gap-2">
                                                    <Sparkles size={14} className="text-yellow-300" />
                                                    <span>{t('common.diem')}</span>
                                                    <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-mono">{creator.pricePerMessage}</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-20 text-stone-400 bg-white rounded-3xl border border-stone-100 shadow-sm">
                                <Search size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="text-lg font-bold text-stone-500">{t('fan.noCreatorsFound')}</p>
                                <p className="text-sm">{t('fan.trySearching')}</p>
                            </div>
                        )}
                        </div>
                    </div>
                )}

                {/* --- VIEW: HISTORY --- */}
                {currentView === 'HISTORY' && (() => {
                    const allTxns = [
                        ...messages.map(msg => ({ kind: 'msg' as const, msg, date: new Date(msg.createdAt).getTime() })),
                        ...creditPurchases.map(cp => ({ kind: 'purchase' as const, cp, date: new Date(cp.date).getTime() })),
                    ].sort((a, b) => b.date - a.date);
                    const totalTxnPages = Math.ceil(allTxns.length / ITEMS_PER_PAGE);
                    const displayedTxns = allTxns.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE);
                    return (
                    <div className="max-w-5xl mx-auto animate-in fade-in">
                        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0">
                                    <Menu size={24} />
                                </button>
                                <h2 className="text-xl font-bold text-stone-900">{t('fan.transactionHistory')}</h2>
                            </div>
                            <TopNav hideBurger />
                        </div>
                        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                        <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
                             <div className="px-4 sm:px-6 py-4 border-b border-stone-100 flex items-center justify-end shrink-0">
                                 <Button variant="ghost" size="sm" className="text-xs"><ExternalLink size={14} className="mr-1"/> {t('fan.exportCSV')}</Button>
                             </div>
                             <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-stone-50 text-stone-500 font-bold border-b border-stone-100 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-3">{t('fan.date')}</th>
                                            <th className="px-6 py-3">{t('fan.to')}</th>
                                            <th className="px-6 py-3">{t('fan.type')}</th>
                                            <th className="px-6 py-3">{t('fan.status')}</th>
                                            <th className="px-6 py-3 text-right">{t('fan.amountCredits')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {displayedTxns.map(item => {
                                            if (item.kind === 'purchase') {
                                                const cp = item.cp;
                                                return (
                                                    <tr key={cp.id} className="hover:bg-stone-50 transition-colors">
                                                        <td className="px-6 py-4 text-stone-500 font-mono text-xs">{new Date(cp.date).toLocaleDateString()}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 border border-emerald-200">
                                                                    <CreditCard size={14} />
                                                                </div>
                                                                <span className="font-bold text-stone-900 text-sm">Diem</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-sm text-stone-600">Credit Purchase</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                                <CheckCircle2 size={12} /> {t('common.completed')}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className="font-mono font-bold flex items-center justify-end gap-1 text-emerald-600">
                                                                <Coins size={14} /> +{cp.amount}
                                                            </span>
                                                            <span className="text-[10px] text-stone-400 block mt-0.5">credits purchased</span>
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                            const msg = item.msg;
                                            const isRefunded = msg.status === 'EXPIRED' || msg.status === 'CANCELLED';
                                            const isProduct = msg.content.startsWith('Purchased Product:');
                                            const isTip = msg.content.startsWith('Fan Tip:');
                                            return (
                                                <tr key={msg.id} className="hover:bg-stone-50 transition-colors group">
                                                    <td className="px-6 py-4 text-stone-500 font-mono text-xs">{new Date(msg.createdAt).toLocaleDateString()}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 border border-stone-200 overflow-hidden">
                                                                {msg.creatorAvatarUrl ? <img src={msg.creatorAvatarUrl} className="w-full h-full object-cover" /> : <User size={14} />}
                                                            </div>
                                                            <span className="font-bold text-stone-900 text-sm"><ResponsiveName name={msg.creatorName || 'Creator'} /></span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm text-stone-600">
                                                            {isProduct ? t('fan.digitalContent') : isTip ? t('fan.fanTip') : t('fan.diemRequest')}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {msg.status === 'PENDING' && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100">
                                                                <Clock size={12} /> {t('common.pending')}
                                                            </span>
                                                        )}
                                                        {msg.status === 'REPLIED' && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                                <CheckCircle2 size={12} /> {t('common.completed')}
                                                            </span>
                                                        )}
                                                        {isRefunded && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-500 border border-stone-200">
                                                                <Ban size={12} /> {t('common.refunded')}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className={`font-mono font-bold flex items-center justify-end gap-1 ${isRefunded ? 'text-stone-400 line-through' : msg.status === 'REPLIED' ? 'text-red-500' : 'text-stone-900'}`}>
                                                            <Coins size={14} /> {msg.status === 'REPLIED' ? `-${msg.amount}` : msg.amount}
                                                        </span>
                                                        {msg.status === 'REPLIED' && (
                                                            <span className="text-[10px] text-stone-400 block mt-0.5">{t('fan.creditsUsed')}</span>
                                                        )}
                                                        {msg.status === 'PENDING' && (
                                                            <span className="text-[10px] text-amber-500 block mt-0.5">{t('fan.heldInEscrow')}</span>
                                                        )}
                                                        {isRefunded && (
                                                            <span className="text-[10px] text-stone-400 block mt-0.5">{t('fan.creditsReturned')}</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {allTxns.length === 0 && (
                                            <tr><td colSpan={5} className="p-12 text-center text-stone-400">{t('fan.noTransactions')}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                             </div>

                             {/* Mobile List View */}
                             <div className="md:hidden divide-y divide-stone-100">
                                {displayedTxns.map(item => {
                                    if (item.kind === 'purchase') {
                                        const cp = item.cp;
                                        return (
                                            <div key={cp.id} className="px-4 py-3 flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 border border-emerald-200 shrink-0">
                                                    <CreditCard size={18} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-stone-900 text-sm">Diem</span>
                                                        <span className="font-mono font-bold text-sm shrink-0 ml-2 text-emerald-600">+{cp.amount}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-0.5">
                                                        <span className="text-xs text-stone-500">Credit Purchase</span>
                                                        <span className="text-xs text-stone-400">{new Date(cp.date).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="mt-1">
                                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{t('common.completed')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    const msg = item.msg;
                                    const isRefunded = msg.status === 'EXPIRED' || msg.status === 'CANCELLED';
                                    const isProduct = msg.content.startsWith('Purchased Product:');
                                    const isTip = msg.content.startsWith('Fan Tip:');
                                    return (
                                        <div key={msg.id} className="px-4 py-3 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 border border-stone-200 shrink-0 overflow-hidden">
                                                {msg.creatorAvatarUrl ? <img src={msg.creatorAvatarUrl} className="w-full h-full object-cover" /> : <User size={18} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-stone-900 text-sm truncate"><ResponsiveName name={msg.creatorName || 'Creator'} /></span>
                                                    <span className={`font-mono font-bold text-sm shrink-0 ml-2 ${isRefunded ? 'text-stone-400 line-through' : msg.status === 'REPLIED' ? 'text-red-500' : 'text-stone-900'}`}>
                                                        {msg.status === 'REPLIED' ? `-${msg.amount}` : msg.amount}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between mt-0.5">
                                                    <span className="text-xs text-stone-500">
                                                        {isProduct ? t('fan.digitalContent') : isTip ? t('fan.fanTip') : t('fan.diemRequest')}
                                                    </span>
                                                    <span className="text-xs text-stone-400">{new Date(msg.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <div className="mt-1">
                                                    {msg.status === 'PENDING' && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{t('common.pending')}</span>}
                                                    {msg.status === 'REPLIED' && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{t('common.completed')}</span>}
                                                    {isRefunded && <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">{t('common.refunded')}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {allTxns.length === 0 && <div className="p-8 text-center text-stone-400 text-sm">{t('fan.noTransactions')}</div>}
                             </div>

                             {/* Pagination */}
                             {totalTxnPages > 1 && (
                                <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-center gap-4">
                                    <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed text-stone-500 transition-colors"><ChevronLeft size={16} /></button>
                                    <span className="text-xs font-bold text-stone-600">Page {historyPage} of {totalTxnPages}</span>
                                    <button onClick={() => setHistoryPage(p => Math.min(totalTxnPages, p + 1))} disabled={historyPage === totalTxnPages} className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed text-stone-500 transition-colors"><ChevronRight size={16} /></button>
                                </div>
                             )}
                        </div>
                        </div>
                    </div>
                    );
                })()}

                {/* --- VIEW: SUPPORT --- */}
                {currentView === 'SUPPORT' && (
                    <div className="max-w-2xl mx-auto animate-in fade-in">
                        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0">
                                    <Menu size={24} />
                                </button>
                                <h2 className="text-xl font-bold text-stone-900">{t('profile.support')}</h2>
                            </div>
                            <TopNav hideBurger />
                        </div>
                        <div className="px-4 sm:px-6 pb-6 flex flex-col items-center min-h-[400px] justify-center">
                         <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-xl shadow-stone-200/50 text-center space-y-6 max-w-md w-full relative overflow-hidden">
                             {/* Decorative Background */}
                             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-stone-500 via-stone-700 to-stone-900"></div>

                             <div className="w-20 h-20 bg-stone-50 text-stone-700 rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-inner ring-4 ring-stone-50/50">
                                 <AlertCircle size={40} />
                             </div>
                             
                             <div>
                                <h3 className="text-2xl font-black text-stone-900 mb-2">{t('fan.howCanWeHelp')}</h3>
                                <p className="text-stone-500 text-sm leading-relaxed">
                                    {t('fan.supportHours')}
                                </p>
                             </div>

                             <div className="space-y-3 pt-2">
                                 <Button fullWidth className="h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-stone-900/10" onClick={async () => {
                                     const diemChatLeft = !!(currentUser?.id && leftChatrooms[currentUser.id]);
                                     if (diemChatLeft) {
                                         const creatorId = await getDiemCreatorId();
                                         if (creatorId) onBrowseCreators(creatorId);
                                     } else {
                                         setCurrentView('OVERVIEW');
                                         setSelectedCreatorId(currentUser?.id ?? null);
                                     }
                                 }}>
                                    <MessageSquare size={18}/> {t('creator.contactSupport')}
                                 </Button>
                                 <Button fullWidth variant="secondary" className="h-12 rounded-xl flex items-center justify-center gap-2 bg-stone-50 hover:bg-stone-100 border border-stone-200">
                                    <FileText size={18}/> {t('fan.viewFAQ')}
                                 </Button>
                             </div>

                             <div className="pt-6 border-t border-stone-100">
                                 <p className="text-xs text-stone-400">
                                     {t('fan.directEmail').split('support@diem')[0]}<a href="mailto:support@diem.ee" className="text-stone-900 font-semibold hover:underline">support@diem.ee</a>
                                 </p>
                             </div>
                         </div>
                        </div>
                    </div>
                )}

                {/* --- VIEW: SETTINGS --- */}
                {currentView === 'SETTINGS' && (
                    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0">
                                    <Menu size={24} />
                                </button>
                                <h2 className="text-xl font-bold text-stone-900">{t('fan.profile')}</h2>
                            </div>
                            <TopNav hideBurger />
                        </div>
                        <div className="px-4 sm:px-6 pb-6 space-y-6">
                        {showSaveSuccess && (
                            <div className="fixed bottom-8 right-8 z-[60] max-w-sm animate-in slide-in-from-bottom-4">
                                <div className="bg-stone-900 text-white rounded-lg px-4 py-3 shadow-lg flex items-center gap-3">
                                    <CheckCircle2 size={20} className="text-green-400" />
                                    <span className="font-bold text-sm">{t('fan.profileUpdated')}</span>
                                </div>
                            </div>
                        )}
                        <div className="bg-white p-6 rounded-xl border border-stone-200">
                            <h3 className="text-lg font-bold text-stone-900 mb-6 border-b border-stone-100 pb-2">{t('fan.yourProfile')}</h3>
                            <div className="space-y-6">
                                <div className="flex items-center gap-6">
                                    <div className="w-20 h-20 rounded-full bg-stone-100 flex-shrink-0 overflow-hidden border border-stone-200">
                                        {profileForm.avatarUrl ? <img src={profileForm.avatarUrl} className="w-full h-full object-cover" /> : <User size={32} className="m-auto text-stone-300"/>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <label className="block text-sm font-medium text-stone-700 mb-1">{t('fan.profilePhoto')}</label>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            {profileForm.avatarUrl ? (
                                                <div className="flex items-center gap-2 w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50 text-stone-500 text-sm">
                                                    <span className="truncate flex-1">
                                                        {avatarFileName || (profileForm.avatarUrl.startsWith('data:') ? "Uploaded Image" : "Current Profile Photo")}
                                                    </span>
                                                    <button onClick={() => { setProfileForm(p => ({...p, avatarUrl: ''})); setAvatarFileName(''); }} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50 text-stone-400 text-sm italic">
                                                    {t('fan.noImageSelected')}
                                                </div>
                                            )}
                                            <button 
                                                onClick={() => fileInputRef.current?.click()}
                                                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap flex-shrink-0"
                                            >
                                                <Camera size={16} /> {t('auth.upload')}
                                            </button>
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarFileChange} />
                                        </div>
                                        <p className="text-[10px] text-stone-400 mt-1">{t('fan.uploadFromDesktop')}</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">{t('fan.displayName')}</label>
                                    <input 
                                        type="text" 
                                        value={profileForm.name} 
                                        onChange={e => setProfileForm(p => ({...p, name: e.target.value}))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">{t('fan.bio')}</label>
                                    <textarea 
                                        value={profileForm.bio} 
                                        onChange={e => setProfileForm(p => ({...p, bio: e.target.value}))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none resize-none h-24"
                                        placeholder={t('fan.bioPlaceholder')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">{t('fan.ageOptional')}</label>
                                    <input 
                                        type="number" 
                                        value={profileForm.age} 
                                        onChange={e => setProfileForm(p => ({...p, age: e.target.value}))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none"
                                    />
                                </div>
                                <div className="pt-4 flex justify-end">
                                    <Button onClick={handleSaveProfile} isLoading={isSavingProfile}>{t('common.saveChanges')}</Button>
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>
                )}

                {/* --- VIEW: OVERVIEW (Two-column Inbox) --- */}
                {currentView === 'OVERVIEW' && (
                   <div className="h-full flex flex-col bg-[#FAF9F6] animate-in fade-in">
                      {/* Header Row */}
                      <div className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0">
                          <div className="flex items-center gap-2">
                              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0">
                                  <Menu size={24} />
                              </button>
                              <h2 className="text-xl sm:text-2xl font-bold text-stone-900">{t('fan.inbox')}</h2>
                          </div>
                          <TopNav hideBurger />
                      </div>
                      <div className="flex flex-1 min-h-0 overflow-x-hidden">
                      {/* List Column */}
                      <div className={`w-full md:w-80 lg:w-96 border-r border-stone-200/60 flex flex-col ${selectedCreatorId ? 'hidden md:flex' : 'flex'}`} style={{ background: 'linear-gradient(135deg, #FAFAF8 0%, #F5F3EF 100%)', backgroundImage: 'linear-gradient(to right, rgba(168,162,158,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(168,162,158,0.07) 1px, transparent 1px)', backgroundSize: '28px 28px' }}>
                         <div className="p-3 border-b border-stone-200/40 bg-white/60 backdrop-blur-sm">
                             {/* Search Input */}
                             <div className="relative group">
                                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-stone-600 transition-colors" size={16} />
                                 <input
                                     type="text"
                                     placeholder={t('fan.searchMessages')}
                                     value={searchQuery}
                                     onChange={(e) => setSearchQuery(e.target.value)}
                                     className="w-full pl-10 pr-4 py-2 bg-white/80 border border-stone-200 rounded-xl text-sm focus:ring-1 focus:ring-stone-400 focus:bg-white outline-none transition-all"
                                 />
                             </div>
                         </div>
                         <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
                            {isLoading ? (
                                <div className="p-8 text-center text-sm text-stone-400">{t('fan.loadingRequests')}</div>
                            ) : filteredGroups.length === 0 ? (
                                <div className="p-8 text-center">
                                    <MessageSquare size={24} className="mx-auto text-stone-300 mb-2" />
                                    <h3 className="text-sm font-bold text-stone-900 mb-1">
                                        {searchQuery ? t('fan.noConversations') : t('fan.noMessagesYet')}
                                    </h3>
                                    <p className="text-xs text-stone-500">
                                        {searchQuery ? t('fan.tryDifferentSearch') : t('fan.findExpert')}
                                    </p>
                                </div>
                            ) : (
                                filteredGroups.map((group, noteIdx) => {
                                    const noteColors = ['#FFFEF0', '#F0FDF4', '#FFF7ED', '#F5F3FF', '#EFF6FF', '#FDF2F8'];
                                    const tapeColors = ['rgba(200,193,185,0.55)', 'rgba(110,200,140,0.45)', 'rgba(240,160,80,0.4)', 'rgba(180,150,240,0.4)', 'rgba(110,170,240,0.4)', 'rgba(240,140,180,0.4)'];
                                    const stickers = ['⭐', '❤️', '✨', '🌟', '💙', '🎯'];
                                    const rotations = [-1.8, 0.9, -0.7, 1.4, -1.1, 0.6];
                                    const nc = noteIdx % noteColors.length;
                                    const rot = rotations[nc];
                                    const isActive = selectedCreatorId === group.creatorId;
                                    const latestMsg = group.latestMessage;
                                    const timeLeft = getTimeLeft(latestMsg.expiresAt);
                                    const lastChatContent = latestMsg.conversation[latestMsg.conversation.length - 1]?.content || latestMsg.content;

                                    return (
                                        <div
                                            key={group.creatorId}
                                            onClick={() => handleOpenChat(group.creatorId)}
                                            className="relative cursor-pointer"
                                            style={{ transform: isActive ? 'rotate(0deg) scale(1.02)' : `rotate(${rot}deg)`, transition: 'transform 0.2s ease', zIndex: isActive ? 10 : 1 }}
                                        >
                                            {/* Tape strip */}
                                            <div className="h-4 w-14 mx-auto rounded-b-sm" style={{ background: tapeColors[nc] }} />
                                            {/* Note card */}
                                            <div
                                                className="relative rounded-lg p-3 overflow-hidden"
                                                style={{
                                                    backgroundColor: noteColors[nc],
                                                    backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 23px, rgba(0,0,0,0.04) 23px, rgba(0,0,0,0.04) 24px)',
                                                    backgroundPositionY: '36px',
                                                    border: isActive ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                                                    boxShadow: isActive ? '0 6px 20px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.07)',
                                                }}
                                            >
                                                {/* Sticker */}
                                                <span className="absolute top-2.5 right-2.5 text-lg leading-none">{stickers[nc]}</span>

                                                {/* Avatar + Name row */}
                                                <div className="flex items-center gap-2.5 mb-2 pr-8">
                                                    <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0 overflow-hidden border border-stone-200/60">
                                                        {group.creatorAvatarUrl
                                                            ? <img src={group.creatorAvatarUrl} className="w-full h-full object-cover" alt={group.creatorName} />
                                                            : <span className="text-white text-xs font-bold">{group.creatorName.charAt(0).toUpperCase()}</span>}
                                                    </div>
                                                    <p className="text-sm font-bold text-stone-800 truncate"><ResponsiveName name={group.creatorName} /></p>
                                                </div>

                                                {/* Message preview */}
                                                <p className="text-xs text-stone-500 line-clamp-2 mb-2.5 leading-relaxed">{lastChatContent}</p>

                                                {/* Footer */}
                                                <div className="flex items-center justify-between">
                                                    {group.isDiemMessage ? (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 animate-pulse">NEW</span>
                                                    ) : latestMsg.status === 'PENDING' ? (
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${timeLeft.bg} ${timeLeft.color}`}>{timeLeft.text}</span>
                                                    ) : latestMsg.status === 'REPLIED' ? (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{t('creator.replied')}</span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">{latestMsg.status === 'EXPIRED' ? t('creator.expired') : t('creator.cancelled')}</span>
                                                    )}
                                                    {group.messageCount > 0 && <span className="text-[10px] font-mono font-medium text-stone-500 flex items-center gap-0.5"><Bell size={9}/> {group.messageCount}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                         </div>
                      </div>

                      {/* Detail Column */}
                      <div className={`flex-1 flex flex-col bg-[#FAF9F6] ${!selectedCreatorId ? 'hidden md:flex' : 'flex'}`}>
                        {!selectedCreatorId ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-stone-400 relative">
                                <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{
                                    backgroundImage: 'linear-gradient(to right, rgba(168,162,158,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(168,162,158,0.08) 1px, transparent 1px)',
                                    backgroundSize: '64px 64px',
                                    maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 100%)',
                                    WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 100%)',
                                }} />
                                <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                                    <MessageSquare size={32} className="text-stone-300" />
                                </div>
                                <p className="text-sm font-medium">{t('fan.selectConversation') || 'Select a conversation'}</p>
                            </div>
                        ) : (
                     <div className="h-full flex flex-col bg-[#FAF9F6] relative overflow-hidden">
                        <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true" style={{
                            backgroundImage: 'linear-gradient(to right, rgba(168,162,158,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(168,162,158,0.08) 1px, transparent 1px)',
                            backgroundSize: '64px 64px',
                            maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 10%, transparent 100%)',
                            WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 10%, transparent 100%)',
                        }} />
                        {/* Celebration Overlay */}
                        {showReadCelebration && (
                            <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
                                {sprinkles.map((s) => (
                                    <div
                                        key={s.id}
                                        className="absolute animate-sprinkle"
                                        style={{
                                            left: `${s.left}%`,
                                            top: '-20px',
                                            width: `${s.size}px`,
                                            height: `${s.size}px`,
                                            backgroundColor: s.color,
                                            borderRadius: s.type === 'circle' ? '50%' : s.type === 'square' ? '2px' : '0',
                                            clipPath: s.type === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 'none',
                                            animationDelay: `${s.animationDelay}s`,
                                            animationDuration: `${s.animationDuration}s`
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Internal Chat Header */}
                        <div className="bg-white px-4 py-3 border-b border-stone-200 flex items-center justify-between shadow-sm flex-shrink-0 z-20 relative">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedCreatorId(null)} className="md:hidden p-2 -ml-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-colors">
                                    <ChevronLeft size={20} />
                                </button>
                                <div>
                                    <h2 className="font-bold text-stone-900 text-lg leading-tight"><ResponsiveName name={conversationGroups.find(g => g.creatorId === selectedCreatorId)?.creatorName || 'Creator'} /></h2>
                                    <p className="text-[10px] text-stone-500 font-medium">Verified Expert</p>
                                </div>
                            </div>
                            <button
                                onClick={() => selectedCreatorId && leaveChatroom(selectedCreatorId)}
                                className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Leave conversation"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>

                        {/* Read Banner */}
                        {showReadBanner && latestMessage?.isRead && latestMessage.status === 'PENDING' && (
                            (() => {
                                const lastChat = latestMessage.conversation[latestMessage.conversation.length - 1];
                                if (!lastChat || lastChat.role === 'FAN') {
                                    return (
                                        <div className="bg-stone-800 text-white px-4 py-2 text-center text-xs font-semibold animate-in slide-in-from-top-2 z-10 flex items-center justify-center gap-2">
                                            <Sparkles size={14} className="text-stone-300 animate-pulse" />
                                            <span>{currentCreator?.displayName || 'Creator'} has read your message!</span>
                                        </div>
                                    );
                                }
                                return null;
                            })()
                        )}

                        {/* Session Pagination - outside scroll area so content doesn't go above it */}
                        {threadMessages.length > 0 && (
                            <div className="flex items-center justify-between px-4 py-2 bg-stone-50 border-b border-stone-100 flex-shrink-0 z-10">
                                <button
                                    onClick={() => setChatSessionIndex(effectiveSessionIndex - 1)}
                                    disabled={effectiveSessionIndex <= 0}
                                    className="p-1.5 rounded-full hover:bg-stone-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={16} className="text-stone-600" />
                                </button>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                                        {t('fan.sessionOf', { current: effectiveSessionIndex + 1, total: threadMessages.length }) || `Session ${effectiveSessionIndex + 1} of ${threadMessages.length}`}
                                    </span>
                                    {(() => {
                                        const ts = threadMessages[effectiveSessionIndex]?.createdAt || threadMessages[effectiveSessionIndex]?.conversation?.[0]?.timestamp;
                                        if (!ts) return null;
                                        const diff = Date.now() - new Date(ts).getTime();
                                        const mins = Math.floor(diff / 60000);
                                        const hrs = Math.floor(mins / 60);
                                        const days = Math.floor(hrs / 24);
                                        const elapsed = days > 0 ? `${days}d ${hrs % 24}h ago` : hrs > 0 ? `${hrs}h ${mins % 60}m ago` : `${mins}m ago`;
                                        return <span className="text-[9px] text-stone-400">{new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {elapsed}</span>;
                                    })()}
                                </div>
                                <button
                                    onClick={() => setChatSessionIndex(effectiveSessionIndex + 1)}
                                    disabled={effectiveSessionIndex >= threadMessages.length - 1}
                                    className="p-1.5 rounded-full hover:bg-stone-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight size={16} className="text-stone-600" />
                                </button>
                            </div>
                        )}

                        {/* Messages - Threads Style */}
                        <div className="flex-1 overflow-y-auto bg-white" ref={scrollRef}>
                          <div className="pt-3 max-w-md mx-auto px-1">
                             {threadMessages.slice(effectiveSessionIndex, effectiveSessionIndex + 1).map((msg) => {
                                const isPending = msg.status === 'PENDING';
                                const isRefunded = msg.status === 'EXPIRED' || msg.status === 'CANCELLED';

                                // Sort conversation by timestamp
                                const sortedConversation = [...msg.conversation].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                                // If first message is from CREATOR (e.g. Diem welcome), don't treat it as fan's message
                                const firstIsCreator = sortedConversation[0]?.role === 'CREATOR';
                                const firstChat = firstIsCreator ? undefined : sortedConversation[0];
                                const restChats = firstIsCreator ? sortedConversation : sortedConversation.slice(1);

                                return (
                                    <div key={msg.id} className="px-3 sm:px-4 py-2 relative">
                                        {/* 1. First Message (The Request) */}
                                        {firstChat && (
                                        <div className="flex relative z-10">
                                            {/* Left: Avatar + Thread Line */}
                                            <div className="flex flex-col items-center mr-3 relative">
                                                {/* Thread Line to Next */}
                                                {(restChats.length > 0 || isPending) && (
                                                    <div className="absolute left-[17px] top-11 -bottom-1 w-0.5 bg-stone-200"></div>
                                                )}
                                                <div className={`w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ${currentUser?.avatarUrl ? 'cursor-pointer' : ''}`} onClick={() => currentUser?.avatarUrl && setEnlargedImage(currentUser.avatarUrl)}>
                                                    {currentUser?.avatarUrl ? (
                                                        <img src={currentUser.avatarUrl} alt="You" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-stone-200 flex items-center justify-center">
                                                            <User size={16} className="text-stone-500" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: Content */}
                                            <div className="flex-1 min-w-0 pb-2">
                                                <div className="flex items-center justify-between mb-2 ml-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm text-stone-900">{currentUser?.name || 'You'}</span>
                                                        <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                                            <User size={10} className="fill-current" />
                                                            <span className="text-[9px] font-semibold uppercase tracking-wide">Fan</span>
                                                        </div>
                                                        <span className="text-xs font-medium text-stone-400">• {new Date(firstChat.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>

                                                <div className="bg-white p-3 sm:p-4 rounded-2xl rounded-tl-lg border border-stone-200/60">

                                                    {/* Content */}
                                                    <div>
                                                        <p className="text-xs sm:text-sm text-stone-700 leading-relaxed break-words">{firstChat.content}</p>

                                                        {/* Attachment */}
                                                        {msg.attachmentUrl && (() => {
                                                            const allUrls = msg.attachmentUrl.split('|||');
                                                            const imgUrls = allUrls.filter((u: string) => isImage(u));
                                                            const fileUrls = allUrls.filter((u: string) => !isImage(u));
                                                            return (
                                                                <div className="mt-3 space-y-2">
                                                                    {fileUrls.map((url: string, ai: number) => (
                                                                        <div key={`f${ai}`} className="rounded-lg overflow-hidden border border-stone-200">
                                                                            <a href={url} target="_blank" rel="noopener noreferrer" download className="flex items-center gap-3 p-3 hover:bg-stone-50 transition-colors">
                                                                                <div className="p-2 bg-stone-100 rounded-lg"><FileText size={18} className="text-stone-500" /></div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <p className="text-sm font-medium text-stone-700 truncate">{url.split('/').pop() || 'Document'}</p>
                                                                                    <p className="text-xs text-stone-400">Document</p>
                                                                                </div>
                                                                                <Download size={16} className="text-stone-400 flex-shrink-0" />
                                                                            </a>
                                                                        </div>
                                                                    ))}
                                                                    {imgUrls.length > 0 && (
                                                                        <div className={imgUrls.length === 1 ? '' : 'grid grid-cols-2 gap-1.5'}>
                                                                            {imgUrls.map((url: string, ai: number) => (
                                                                                <div key={`i${ai}`} className="rounded-lg overflow-hidden border border-stone-200">
                                                                                    <img src={url} onClick={() => setEnlargedImage(url)} className={`block object-cover cursor-pointer hover:opacity-90 transition-opacity ${imgUrls.length === 1 ? 'max-h-[240px] w-auto max-w-[260px]' : 'w-full h-[140px]'}`} alt={`attachment ${ai + 1}`} />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>

                                                    {/* Action Row */}
                                                    <div className="flex items-center gap-1 mt-1 -ml-1 -mb-1.5">
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => setActiveReactionPicker(activeReactionPicker === firstChat.id ? null : firstChat.id)}
                                                                className="p-1 text-stone-400 hover:text-stone-600 transition-colors relative group"
                                                            >
                                                                {messageReactions[firstChat.id] ? (
                                                                    <span className="text-lg animate-in zoom-in">{messageReactions[firstChat.id]}</span>
                                                                ) : (
                                                                    <div className="w-6 h-6 rounded-full bg-stone-50 border border-stone-200 flex items-center justify-center hover:bg-stone-100 transition-colors relative">
                                                                        <Smile size={14} className="text-stone-400" />
                                                                        <div className="absolute -top-0.5 -right-0.5 bg-white rounded-full border border-stone-100 p-[1px]">
                                                                            <Plus size={6} className="text-stone-400" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </button>
                                                            {activeReactionPicker === firstChat.id && (
                                                                <div className="absolute bottom-full left-0 mb-1 bg-white border border-stone-200 shadow-lg rounded-full p-1 flex gap-1 z-10 animate-in zoom-in duration-200">
                                                                    <button onClick={() => handleReactionClick(firstChat.id, '👍')} className="p-1.5 hover:bg-stone-100 rounded-full transition-colors text-lg leading-none">👍</button>
                                                                    <button onClick={() => handleReactionClick(firstChat.id, '❤️')} className="p-1.5 hover:bg-stone-100 rounded-full transition-colors text-lg leading-none">❤️</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {messageReactions[firstChat.id] && (
                                                            <span className="text-[10px] text-stone-400">{currentUser?.name || 'You'}</span>
                                                        )}
                                                        <div className="flex items-center gap-1.5 text-stone-400 ml-auto text-xs">
                                                            <Coins size={12} className="text-stone-400" />
                                                            <span>{msg.amount}</span>
                                                            {isPending && (
                                                                <>
                                                                    <span className="mx-1">·</span>
                                                                    <span className={getTimeLeft(msg.expiresAt).color}>{getTimeLeft(msg.expiresAt).text}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        )}

                                        {/* 2. Subsequent Messages (Replies & Appreciation) */}
                                        {restChats.map((chat, idx) => {
                                            const isCreator = chat.role === 'CREATOR';
                                            const isLast = idx === restChats.length - 1;
                                            const showLine = !isLast || isPending;

                                            // For Diem→fan threads, CREATOR = sender (Diem), FAN = current user
                                            const creatorName = firstIsCreator ? (msg.senderName || 'DIEM') : (msg.creatorName || 'Creator');
                                            const creatorAvatar = firstIsCreator ? msg.senderAvatarUrl : msg.creatorAvatarUrl;
                                            return (
                                            <div key={chat.id} className="flex mt-4 relative z-10">
                                                {/* Left: Avatar + Thread Line */}
                                                <div className="flex flex-col items-center mr-3 relative">
                                                    {showLine && (
                                                        <div className="absolute left-[17px] top-11 -bottom-1 w-0.5 bg-stone-200"></div>
                                                    )}
                                                    <div className={`w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ${(isCreator ? creatorAvatar : currentUser?.avatarUrl) ? 'cursor-pointer' : ''}`} onClick={() => { const url = isCreator ? creatorAvatar : currentUser?.avatarUrl; if (url) setEnlargedImage(url); }}>
                                                        {isCreator ? (
                                                            creatorAvatar ? (
                                                                <img src={creatorAvatar} alt={creatorName} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full bg-stone-100 flex items-center justify-center"><Verified size={22} /></div>
                                                            )
                                                        ) : (
                                                            currentUser?.avatarUrl ? (
                                                                <img src={currentUser.avatarUrl} alt="You" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full bg-stone-200 flex items-center justify-center"><User size={16} className="text-stone-500" /></div>
                                                            )
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right: Content */}
                                                <div className="flex-1 min-w-0 pb-2">
                                                    {/* Header Row - Moved Outside Card */}
                                                    <div className="flex items-center justify-between mb-2 ml-1">
                                                        <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-sm text-stone-900">
                                                                    {isCreator ? <ResponsiveName name={creatorName} /> : <ResponsiveName name={currentUser?.name || 'You'} />}
                                                                </span>
                                                                {isCreator ? (
                                                                    <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-1 rounded-full overflow-visible">
                                                                        <Verified size={12} />
                                                                        <span className="text-[9px] font-semibold uppercase tracking-wide">Creator</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                                                        <User size={10} className="fill-current" />
                                                                        <span className="text-[9px] font-semibold uppercase tracking-wide">Fan</span>
                                                                    </div>
                                                                )}
                                                            <span className="text-xs font-medium text-stone-400">• {new Date(chat.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                                                        </div>
                                                    </div>
                                <div className={`${isCreator ? 'bg-stone-50' : 'bg-white'} p-3 sm:p-4 rounded-2xl rounded-tl-lg border border-stone-200/60`}>
                                                        {/* Content */}
                                                        <p className="text-xs sm:text-sm text-stone-700 leading-relaxed break-words">{chat.content}</p>
                                                        {chat.isEdited && <span className="text-[10px] text-stone-400 mt-1 block">edited</span>}

                                                        {chat.attachmentUrl && (() => {
                                                            const allUrls = chat.attachmentUrl.split('|||');
                                                            const imgUrls = allUrls.filter((u: string) => isImage(u));
                                                            const fileUrls = allUrls.filter((u: string) => !isImage(u));
                                                            return (
                                                                <div className="mt-3 space-y-2">
                                                                    {fileUrls.map((url: string, ai: number) => (
                                                                        <div key={`f${ai}`} className="rounded-lg overflow-hidden border border-stone-200">
                                                                            <a href={url} target="_blank" rel="noopener noreferrer" download="attachment" className="flex items-center gap-3 p-3 hover:bg-stone-50 transition-colors">
                                                                                <div className="p-2 bg-stone-100 rounded-lg"><FileText size={18} className="text-stone-500" /></div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <p className="text-sm font-medium text-stone-700 truncate">{url.startsWith('data:') ? 'Attached File' : (url.split('/').pop() || 'Document')}</p>
                                                                                    <p className="text-xs text-stone-400">Document</p>
                                                                                </div>
                                                                                <Download size={16} className="text-stone-400 flex-shrink-0" />
                                                                            </a>
                                                                        </div>
                                                                    ))}
                                                                    {imgUrls.length > 0 && (
                                                                        <div className={imgUrls.length === 1 ? '' : 'grid grid-cols-2 gap-1.5'}>
                                                                            {imgUrls.map((url: string, ai: number) => (
                                                                                <div key={`i${ai}`} className="rounded-lg overflow-hidden border border-stone-200">
                                                                                    <img src={url} onClick={() => setEnlargedImage(url)} className={`block object-cover cursor-pointer hover:opacity-90 transition-opacity ${imgUrls.length === 1 ? 'max-h-[240px] w-auto max-w-[260px]' : 'w-full h-[140px]'}`} alt={`attachment ${ai + 1}`} />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Action Row */}
                                                        <div className="flex items-center gap-1 mt-1 -ml-1 -mb-1.5">
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => setActiveReactionPicker(activeReactionPicker === chat.id ? null : chat.id)}
                                                                className="p-1 text-stone-400 hover:text-stone-600 transition-colors relative group"
                                                            >
                                                                {messageReactions[chat.id] ? (
                                                                    <span className="text-lg animate-in zoom-in">{messageReactions[chat.id]}</span>
                                                                ) : (
                                                                    <div className="w-6 h-6 rounded-full bg-stone-50 border border-stone-200 flex items-center justify-center hover:bg-stone-100 transition-colors relative">
                                                                        <Smile size={14} className="text-stone-400" />
                                                                        <div className="absolute -top-0.5 -right-0.5 bg-white rounded-full border border-stone-100 p-[1px]">
                                                                            <Plus size={6} className="text-stone-400" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </button>
                                                            {activeReactionPicker === chat.id && (
                                                                <div className="absolute bottom-full left-0 mb-1 bg-white border border-stone-200 shadow-lg rounded-full p-1 flex gap-1 z-10 animate-in zoom-in duration-200">
                                                                    <button onClick={() => handleReactionClick(chat.id, '👍')} className="p-1.5 hover:bg-stone-100 rounded-full transition-colors text-lg leading-none">👍</button>
                                                                    <button onClick={() => handleReactionClick(chat.id, '❤️')} className="p-1.5 hover:bg-stone-100 rounded-full transition-colors text-lg leading-none">❤️</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {messageReactions[chat.id] && (
                                                            <span className="text-[10px] text-stone-400">{chat.role === 'FAN' ? <ResponsiveName name={currentUser?.name || 'You'} /> : <ResponsiveName name={msg.creatorName || 'Creator'} />}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            </div>
                                            );
                                        })}

                                        {/* Waiting for reply indicator */}
                                        {isPending && sortedConversation[sortedConversation.length - 1]?.role === 'FAN' && (
                                            <div className="flex mt-4 relative z-10">
                                                <div className="flex flex-col items-center mr-3">
                                                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-dashed border-stone-300">
                                                        {msg.creatorAvatarUrl ? (
                                                            <img src={msg.creatorAvatarUrl} alt={msg.creatorName} className="w-full h-full object-cover opacity-30" />
                                                        ) : (
                                                            <div className="w-full h-full bg-stone-50 flex items-center justify-center opacity-30">
                                                                <Verified size={22} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex-1 flex items-center">
                                                    <span className="text-[15px] text-stone-400">Waiting for <ResponsiveName name={msg.creatorName || 'creator'} />'s reply...</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Completed indicator */}
                                        {msg.status === 'REPLIED' && (
                                            <div className="mt-5 mx-auto max-w-[260px]">
                                                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/60 rounded-xl p-3 shadow-sm">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="bg-emerald-500 p-1 rounded-full">
                                                                <Check size={10} className="text-white stroke-[3px]" />
                                                            </div>
                                                            <span className="text-xs font-semibold text-emerald-700">{t('common.completed')}</span>
                                                        </div>
                                                        <span className="text-sm font-bold text-emerald-600 font-mono">{msg.amount} credits</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {msg.status === 'EXPIRED' && (
                                            <div className="mt-5 mx-auto max-w-[260px]">
                                                <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200/60 rounded-xl p-3 shadow-sm">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="bg-red-500 p-1 rounded-full">
                                                                <AlertCircle size={10} className="text-white stroke-[3px]" />
                                                            </div>
                                                            <span className="text-xs font-semibold text-red-700">Deadline Missed</span>
                                                        </div>
                                                        <span className="text-xs font-semibold text-red-500">{t('common.refunded')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {msg.status === 'CANCELLED' && (
                                            <div className="mt-5 mx-auto max-w-[260px]">
                                                <div className="bg-gradient-to-br from-stone-50 to-stone-100 border border-stone-200/60 rounded-xl p-3 shadow-sm">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="bg-stone-500 p-1 rounded-full">
                                                                <Ban size={10} className="text-white stroke-[3px]" />
                                                            </div>
                                                            <span className="text-xs font-semibold text-stone-700">Cancelled</span>
                                                        </div>
                                                        <span className="text-xs font-semibold text-stone-500">{t('common.refunded')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div className="h-16"></div>
                          </div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="bg-white border-t border-stone-200 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)] z-20 flex-shrink-0">
                            {latestMessage && latestMessage.status === 'PENDING' && (
                                <div className="p-3 sm:p-4 flex flex-row items-center justify-between bg-stone-50 gap-2">
                                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                        {(() => {
                                            const lastChat = latestMessage.conversation[latestMessage.conversation.length - 1];
                                            const isCreatorReplied = lastChat?.role === 'CREATOR';

                                            if (isCreatorReplied) {
                                                const diff = new Date(latestMessage.expiresAt).getTime() - Date.now();
                                                const hours = Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
                                                return (
                                                    <>
                                                        <div className="bg-white p-2 rounded-full border border-stone-200 shadow-sm flex-shrink-0">
                                                            <MessageSquare size={20} className="text-stone-700" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-stone-700">Creator answering</p>
                                                            <p className="text-xs text-stone-400 truncate">Creator has {hours} hours left to complete</p>
                                                        </div>
                                                    </>
                                                );
                                            } else if (latestMessage.isRead) {
                                                return (
                                                    <>
                                                        <div className="bg-white p-2 rounded-full border border-stone-200 shadow-sm flex-shrink-0">
                                                            <Check size={20} className="text-stone-500" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-stone-700">Read</p>
                                                            <p className="text-xs text-stone-400 truncate">Expires in {getTimeLeft(latestMessage.expiresAt).text}</p>
                                                        </div>
                                                    </>
                                                );
                                            } else {
                                                return (
                                                    <>
                                                        <div className="bg-white p-2 rounded-full border border-stone-200 shadow-sm flex-shrink-0">
                                                            <Clock size={20} className="text-stone-400" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-stone-700">Not yet read</p>
                                                            <p className="text-xs text-stone-400 truncate">Expires in {getTimeLeft(latestMessage.expiresAt).text}</p>
                                                        </div>
                                                    </>
                                                );
                                            }
                                        })()}
                                    </div>

                                    {confirmCancelId === latestMessage.id ? (
                                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 flex-shrink-0">
                                            <span className="text-xs font-bold text-stone-500 mr-1 flex items-center gap-1 whitespace-nowrap">Refund <Coins size={10}/>{latestMessage.amount}?</span>
                                            <Button size="sm" variant="ghost" onClick={() => setConfirmCancelId(null)}>No</Button>
                                            <Button size="sm" variant="danger" onClick={processCancellation} isLoading={isCancelling}>Yes</Button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleCancelClick(latestMessage.id)}
                                            className="text-stone-400 hover:text-red-600 text-xs font-bold hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors flex-shrink-0"
                                        >
                                            Cancel Request
                                        </button>
                                    )}
                                </div>
                            )}

                            {latestMessage && latestMessage.status === 'REPLIED' && (
                                <div className="p-4 bg-stone-50/50">
                                     {/* Follow Up / Appreciation */}
                                     {!showFollowUpInput && !customAppreciationMode ? (
                                         <div className="grid grid-cols-2 gap-3">
                                             <button 
                                                onClick={() => setCustomAppreciationMode(true)}
                                                disabled={!!hasThanked}
                                                className={`flex items-center justify-center gap-2 bg-white border border-stone-200 hover:border-stone-300 hover:bg-stone-50 text-stone-600 font-semibold py-2 text-sm rounded-xl transition-all ${hasThanked ? 'opacity-60 cursor-not-allowed bg-stone-50' : ''}`}
                                             >
                                                 <Heart size={16} className={hasThanked ? "fill-pink-500 text-pink-500" : ""} /> {hasThanked ? 'Thanks Sent' : 'Send Thanks'}
                                             </button>
                                             <button 
                                                onClick={() => setShowFollowUpInput(true)}
                                                className="flex items-center justify-center gap-2 bg-stone-900 text-white hover:bg-stone-800 font-bold py-2 text-sm rounded-xl transition-all shadow-lg shadow-stone-900/10"
                                             >
                                                 <MessageSquare size={16} /> New Request
                                             </button>
                                         </div>
                                     ) : (
                                         <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-lg relative animate-in slide-in-from-bottom-2">
                                             <button 
                                                onClick={() => { setShowFollowUpInput(false); setCustomAppreciationMode(false); setFollowUpAttachments([]); }}
                                                className="absolute top-2 right-2 p-1 text-stone-300 hover:text-stone-500 rounded-full hover:bg-stone-50"
                                             >
                                                 <X size={16} />
                                             </button>
                                             
                                             <h4 className="font-bold text-stone-900 text-sm mb-1">
                                                 {showFollowUpInput ? 'Send Follow-up Request' : 'Send Appreciation'}
                                             </h4>
                                             {showFollowUpInput && (
                                                 <p className="text-[11px] text-stone-400 mb-3 flex items-center gap-1">
                                                     <Camera size={10} /> You can attach up to 3 photos
                                                 </p>
                                             )}
                                             
                                             <textarea 
                                                value={showFollowUpInput ? followUpText : customAppreciationText}
                                                onChange={e => showFollowUpInput ? setFollowUpText(e.target.value) : setCustomAppreciationText(e.target.value)}
                                                placeholder={showFollowUpInput ? "Ask another question..." : "Write a nice note..."}
                                                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:ring-1 focus:ring-stone-400 outline-none resize-none h-24 mb-3"
                                             />

                                             {showFollowUpInput && (
                                                 <>
                                                 {followUpAttachments.length > 0 && (
                                                     <div className="flex flex-wrap gap-2 mb-2">
                                                         {followUpAttachments.map((att, i) => (
                                                             <div key={i} className="flex items-center gap-2 bg-stone-50 p-1.5 rounded-lg border border-stone-200">
                                                                 {isImage(att) ? (
                                                                     <img src={att} className="w-10 h-10 rounded object-cover" alt="" />
                                                                 ) : (
                                                                     <Paperclip size={14} className="text-stone-400" />
                                                                 )}
                                                                 <button onClick={() => setFollowUpAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-stone-400 hover:text-stone-600">
                                                                     <X size={12} />
                                                                 </button>
                                                             </div>
                                                         ))}
                                                         {followUpAttachments.length < 3 && (
                                                             <span className="text-[10px] text-stone-400 self-end">{followUpAttachments.length}/3</span>
                                                         )}
                                                     </div>
                                                 )}

                                                 <div className="flex justify-between items-center mb-3 text-xs text-stone-500 px-1">
                                                     <span className="flex items-center gap-1">Price: <b><Coins size={10} className="inline mb-0.5"/> {currentCreator?.pricePerMessage ?? latestMessage.amount}</b></span>
                                                     <button
                                                         onClick={() => followUpFileInputRef.current?.click()}
                                                         disabled={followUpAttachments.length >= 3 || isUploadingFollowUpAttachment}
                                                         className="flex items-center gap-1 text-stone-400 hover:text-stone-600 disabled:opacity-40"
                                                     >
                                                         {isUploadingFollowUpAttachment ? <RefreshCw size={14} className="animate-spin" /> : <Camera size={14} />}
                                                         <span className="text-[11px]">Attach</span>
                                                     </button>
                                                     <input
                                                         ref={followUpFileInputRef}
                                                         type="file"
                                                         accept="image/*"
                                                         multiple
                                                         className="hidden"
                                                         onChange={handleFollowUpFileChange}
                                                     />
                                                 </div>
                                                 </>
                                             )}

                                             <Button 
                                                fullWidth 
                                                onClick={showFollowUpInput ? handleSendFollowUp : () => handleSendAppreciation(latestMessage.id, customAppreciationText)}
                                                isLoading={isSendingFollowUp}
                                                disabled={showFollowUpInput ? !followUpText.trim() : !customAppreciationText.trim()}
                                             >
                                                 {showFollowUpInput ? 'Pay & Send' : 'Send Message'}
                                             </Button>
                                         </div>
                                     )}
                                </div>
                            )}
                        </div>
                     </div>
                        )}
                      </div>
                      </div>
                   </div>
                )}

                {/* --- VIEW: NOTIFICATIONS --- */}
                {currentView === 'NOTIFICATIONS' && (
                    <div className="max-w-3xl mx-auto animate-in fade-in">
                        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0">
                                    <Menu size={24} />
                                </button>
                                <h2 className="text-xl font-bold text-stone-900">{t('creator.notifications')}</h2>
                            </div>
                            <TopNav hideBurger />
                        </div>
                        <div className="px-4 sm:px-6 pb-6">
                        {(() => {
                            const totalPages = Math.ceil(notifications.length / ITEMS_PER_PAGE);
                            // Mobile: show all; Desktop: paginate
                            const displayedNotifications = notifications; // mobile shows all
                            const displayedDesktop = notifications.slice((notificationPage - 1) * ITEMS_PER_PAGE, notificationPage * ITEMS_PER_PAGE);
                            const renderRow = (notif: typeof notifications[0]) => (
                                <div key={notif.id} className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-stone-50 transition-colors flex gap-3 sm:gap-4 group relative">
                                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${notif.color}`}>
                                        <notif.icon size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs sm:text-sm text-stone-900 font-medium leading-snug">{notif.text}</p>
                                        <p className="text-[10px] sm:text-xs text-stone-400 mt-0.5">{notif.time.toLocaleString()}</p>
                                    </div>
                                    <button onClick={(e) => handleDeleteNotification(e, notif.id)} className="text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 sm:p-2 flex-shrink-0">
                                        <X size={14} />
                                    </button>
                                </div>
                            );
                            return (
                        <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="px-4 sm:px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-stone-900">{t('fan.allNotifications')}</h3>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-stone-500">{t('creator.items', { count: notifications.length })}</span>
                                    {notifications.length > 0 && (
                                        <button onClick={handleClearAllNotifications} className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors flex items-center gap-1">
                                            <Trash size={12} /> {t('fan.clearAll')}
                                        </button>
                                    )}
                                </div>
                            </div>
                            {/* Mobile: all items, no pagination */}
                            <div className="md:hidden divide-y divide-stone-100">
                                {displayedNotifications.length === 0 ? (
                                    <div className="p-10 text-center text-stone-400 text-sm">{t('fan.noNotifications')}</div>
                                ) : displayedNotifications.map(renderRow)}
                            </div>
                            {/* Desktop: paginated */}
                            <div className="hidden md:block divide-y divide-stone-100">
                                {displayedDesktop.length === 0 ? (
                                    <div className="p-12 text-center text-stone-400 text-sm">{t('fan.noNotifications')}</div>
                                ) : displayedDesktop.map(renderRow)}
                            </div>
                            {totalPages > 1 && (
                                <div className="hidden md:flex px-6 py-4 border-t border-stone-100 items-center justify-center gap-4">
                                    <button onClick={() => setNotificationPage(p => Math.max(1, p - 1))} disabled={notificationPage === 1} className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed text-stone-500 transition-colors"><ChevronLeft size={16} /></button>
                                    <span className="text-xs font-bold text-stone-600">{t('common.page', { current: notificationPage, total: totalPages })}</span>
                                    <button onClick={() => setNotificationPage(p => Math.min(totalPages, p + 1))} disabled={notificationPage === totalPages} className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed text-stone-500 transition-colors"><ChevronRight size={16} /></button>
                                </div>
                            )}
                        </div>
                        );
                        })()}
                        </div>
                    </div>
                )}
            </div>
        </main>

        {/* Top Up Modal */}
        {showTopUpModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
                <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-300 my-auto max-h-[90vh] overflow-y-auto">
                    {!topUpSuccess && <button onClick={() => setShowTopUpModal(false)} className="absolute top-4 right-4 p-2 bg-stone-100 hover:bg-stone-200 rounded-full text-stone-500 z-10 transition-colors"><X size={18}/></button>}

                    {topUpSuccess ? (
                        <div className="p-8 flex flex-col items-center justify-center text-center gap-4">
                            <style>{`
                                @keyframes fd-sketch { to { stroke-dashoffset: 0; } }
                                @keyframes fd-pop { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                            `}</style>
                            <svg viewBox="0 0 160 140" width="160" height="140" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="28" y="40" width="90" height="65" rx="8" stroke="#1c1917" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={{ animation: 'fd-sketch 0.6s ease forwards 0.1s' }} />
                                <rect x="84" y="58" width="34" height="22" rx="5" stroke="#1c1917" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={{ animation: 'fd-sketch 0.5s ease forwards 0.4s' }} />
                                <circle cx="96" cy="69" r="5" stroke="#1c1917" strokeWidth="1.5" pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={{ animation: 'fd-sketch 0.4s ease forwards 0.7s' }} />
                                <line x1="28" y1="56" x2="118" y2="56" stroke="#1c1917" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={{ animation: 'fd-sketch 0.5s ease forwards 0.25s' }} />
                                <circle cx="50" cy="20" r="10" stroke="#f59e0b" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={{ animation: 'fd-sketch 0.4s ease forwards 0.9s' }} />
                                <text x="45" y="25" fontSize="10" fill="#f59e0b" style={{ animation: 'fd-pop 0.3s ease forwards 1.1s', opacity: 0 }}>$</text>
                                <circle cx="80" cy="12" r="10" stroke="#f59e0b" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={{ animation: 'fd-sketch 0.4s ease forwards 1.1s' }} />
                                <circle cx="115" cy="20" r="8" stroke="#f59e0b" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={{ animation: 'fd-sketch 0.4s ease forwards 1.3s' }} />
                                <line x1="73" y1="30" x2="73" y2="44" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={{ animation: 'fd-sketch 0.3s ease forwards 1.5s' }} />
                                <polyline points="67,38 73,45 79,38" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={{ animation: 'fd-sketch 0.3s ease forwards 1.65s' }} />
                                <line x1="130" y1="40" x2="136" y2="34" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={{ animation: 'fd-sketch 0.2s ease forwards 1.8s' }} />
                                <line x1="135" y1="50" x2="143" y2="48" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={{ animation: 'fd-sketch 0.2s ease forwards 1.95s' }} />
                            </svg>
                            <div style={{ animation: 'fd-pop 0.4s ease forwards 2.0s', opacity: 0 }}>
                                <p className="text-xl font-black text-stone-900">{t('fan.creditsAdded', { count: lastTopUpAmount.toLocaleString() })}</p>
                                <p className="text-stone-400 text-sm mt-1">{t('fan.walletToppedUp')}</p>
                            </div>
                        </div>
                    ) : (
                    <div className="p-8">
                        <div className="text-center mb-6">
                            <div className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-1">{t('fan.availableBalance')}</div>
                            <div className="text-4xl font-black text-stone-900 mb-4 flex justify-center items-baseline gap-1">
                                {currentUser?.credits?.toLocaleString() || 0}
                                <span className="text-sm font-bold text-stone-400 uppercase">{t('common.credits')}</span>
                            </div>
                            <h3 className="font-bold text-lg text-stone-800">{t('fan.addCredits')}</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {[10, 100, 500, 1000, 2500].map(amt => (
                                <button
                                key={amt}
                                onClick={() => setTopUpAmount(amt)}
                                className={`p-3 rounded-xl border text-center transition-all ${topUpAmount === amt ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 hover:border-stone-300 text-stone-900'}`}
                                >
                                    <div className="font-bold text-lg">{amt}</div>
                                    <div className={`text-[10px] font-semibold uppercase ${topUpAmount === amt ? 'text-stone-400' : 'text-stone-400'}`}>{amt === 10 ? 'Test' : t('common.credits')}</div>
                                </button>
                            ))}
                        </div>

                        {(() => {
                            const TIER_CENTS: Record<number, number> = { 10: 50, 100: 100, 500: 500, 1000: 1000, 2500: 2500, 5000: 5000 };
                            const baseCents = TIER_CENTS[topUpAmount] ?? topUpAmount;
                            const feeCents = Math.ceil((baseCents + 30) / (1 - 0.029) - baseCents);
                            const totalCents = baseCents + feeCents;
                            return (
                                <div className="bg-stone-50 p-4 rounded-xl mb-6 border border-stone-100 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-stone-500">{topUpAmount.toLocaleString()} {t('common.credits')}</span>
                                        <span className="text-sm font-medium text-stone-700">${(baseCents / 100).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-stone-500">{t('fan.processingFee')}</span>
                                        <span className="text-sm font-medium text-stone-700">${(feeCents / 100).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-stone-400">
                                        <span>{t('fan.taxAtCheckout')}</span>
                                    </div>
                                    <div className="border-t border-stone-200 pt-2 flex justify-between items-center">
                                        <span className="text-sm font-bold text-stone-700">{t('fan.subtotal')}</span>
                                        <span className="font-black text-stone-900 text-xl">${(totalCents / 100).toFixed(2)}</span>
                                    </div>
                                </div>
                            );
                        })()}

                        <Button
                            fullWidth
                            size="lg"
                            onClick={handleTopUp}
                            isLoading={isProcessingTopUp}
                            className="bg-stone-900 text-white rounded-xl h-12 font-bold shadow-lg shadow-stone-900/20"
                        >
                            {t('fan.payAddCredits')}
                        </Button>
                        <p className="text-center text-[10px] text-stone-400 mt-4 flex items-center justify-center gap-1">
                            <Lock size={10} /> {t('fan.securePayment')}
                        </p>
                    </div>
                    )}
                </div>
            </div>
        )}

        {toastMessage && (
            <div className="fixed bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-500 flex justify-center">
                <div className="relative overflow-hidden bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10 ring-1 ring-white/20 w-full sm:w-auto">
                    <div className="absolute inset-0 bg-gradient-to-r from-stone-500 via-stone-700 to-stone-900 opacity-20"></div>
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="bg-gradient-to-tr from-stone-600 to-stone-800 p-1.5 rounded-full shadow-lg shadow-stone-800/20 flex-shrink-0">
                            <Send size={16} className="text-white fill-white" />
                        </div>
                        <p className="text-sm font-bold text-white tracking-wide">{toastMessage}</p>
                    </div>
                </div>
            </div>
        )}
      {/* Image Lightbox */}
      {enlargedImage && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setEnlargedImage(null)}>
              <button className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/40 rounded-full transition-colors" onClick={() => setEnlargedImage(null)}>
                  <X size={24} />
              </button>
              <img src={enlargedImage} className="max-w-full max-h-full object-contain rounded-lg" alt="Enlarged" onClick={e => e.stopPropagation()} />
          </div>
      )}
    </div>
  );
};
