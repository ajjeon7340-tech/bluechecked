
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/config';
import { CreatorProfile, Message, DashboardStats, MonthlyStat, AffiliateLink, LinkSection, ProAnalyticsData, StatTimeFrame, DetailedStat, DetailedFinancialStat, CurrentUser } from '../types';
import { getMessages, getChatLines, invalidateChatLinesCache, replyToMessage, updateCreatorProfile, markMessageAsRead, cancelMessage, getHistoricalStats, getProAnalytics, getDetailedStatistics, getFinancialStatistics, DEFAULT_AVATAR, subscribeToMessages, uploadProductFile, editChatMessage, deleteChatLine, connectStripeAccount, getStripeConnectionStatus, requestWithdrawal, getWithdrawalHistory, sendWelcomeMessage, Withdrawal, isBackendConfigured } from '../services/realBackend';
import { generateReplyDraft } from '../services/geminiService';
import { LanguageSwitcher } from './LanguageSwitcher';
import { 
  Clock, CheckCircle2, AlertCircle, DollarSign, Sparkles, ChevronLeft, LogOut, 
  ExternalLink, User, Settings, Plus, Trash, X, Camera, Paperclip, Send, DiemLogo,
  Home, BarChart3, Wallet, Users, Bell, Search, Menu, ChevronDown, ChevronUp, Ban, Check,
  Heart, Star, Eye, TrendingUp, MessageSquare, ArrowRight, Lock, 
  InstagramLogo, Twitter, Youtube, Twitch, Music2, TikTokLogo, XLogo, YouTubeLogo, Download, ShoppingBag, FileText, PieChart as PieIcon, LayoutGrid, MonitorPlay, Link as LinkIcon, Calendar, ChevronRight, Coins, CreditCard
  , MousePointerClick, GripVertical, Smile, Pencil, RefreshCw, Verified
} from './Icons';
import { Button } from './Button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, PieChart, Pie, Cell, Legend, ComposedChart, Line } from 'recharts';

interface Props {
  creator: CreatorProfile;
  currentUser: CurrentUser | null;
  onLogout: () => void;
  onViewProfile: () => void;
  onRefreshData: () => Promise<void>;
}

type DashboardView = 'OVERVIEW' | 'INBOX' | 'FINANCE' | 'ANALYTICS' | 'STATISTICS' | 'SETTINGS' | 'NOTIFICATIONS' | 'REVIEWS' | 'SUPPORT';
type InboxFilter = 'ALL' | 'PENDING' | 'REPLIED' | 'REJECTED';

const SUPPORTED_PLATFORMS = [
    { id: 'youtube', label: 'YouTube', icon: YouTubeLogo },
    { id: 'instagram', label: 'Instagram', icon: InstagramLogo },
    { id: 'x', label: 'X (Twitter)', icon: XLogo },
    { id: 'tiktok', label: 'TikTok', icon: TikTokLogo },
    { id: 'twitch', label: 'Twitch', icon: Twitch },
];

const getResponseCategory = (hours: number, t?: (key: string) => string) => {
    if (hours < 1) return t ? t('common.responseCategoryLightning') : 'Lightning';
    if (hours < 4) return t ? t('common.responseCategoryVeryFast') : 'Very Fast';
    if (hours < 24) return t ? t('common.responseCategoryFast') : 'Fast';
    return t ? t('common.responseCategoryStandard') : 'Standard';
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

    // Editorial style date: "Feb 15"
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const isImage = (url: string) => {
    if (!url) return false;
    if (url.startsWith('data:image')) return true;
    const ext = url.split('.').pop()?.split('?')[0].toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '');
};

const DUMMY_PRO_DATA: ProAnalyticsData = {
    trafficSources: [
        { name: 'Google Search', value: 35, color: '#4285F4' },
        { name: 'Instagram', value: 28, color: '#E1306C' },
        { name: 'TikTok', value: 20, color: '#000000' },
        { name: 'Twitter', value: 10, color: '#1DA1F2' },
        { name: 'Direct Link', value: 7, color: '#64748b' }
    ],
    funnel: [
        { name: 'Profile Views', count: 15420, fill: '#6366F1' },
        { name: 'Link Clicks', count: 4200, fill: '#818CF8' },
        { name: 'Conversions', count: 850, fill: '#4ADE80' }
    ],
    topAssets: [
        { id: '__diem__', title: 'DIEM Messages', type: 'DIEM', clicks: 320, revenue: 38400, ctr: '2.1%' },
        { id: '1', title: 'Ultimate React Guide', type: 'PRODUCT', clicks: 2400, revenue: 12000, ctr: '15.6%' },
        { id: '3', title: '1:1 Coaching', type: 'PRODUCT', clicks: 450, revenue: 45000, ctr: '2.9%' },
        { id: '__tip__', title: 'Fan Tips', type: 'TIP', clicks: 45, revenue: 8500, ctr: '0.3%' },
        { id: '2', title: 'Discord Community', type: 'LINK', clicks: 1100, revenue: 0, ctr: '7.1%' },
    ],
    audienceType: { new: 62, returning: 38 }
};

const firstName = (name: string) => name?.split(' ')[0] || name;
const ResponsiveName = ({ name }: { name: string }) => (
  <><span className="hidden sm:inline">{name}</span><span className="sm:hidden">{firstName(name)}</span></>
);

export const CreatorDashboard: React.FC<Props> = ({ creator, currentUser, onLogout, onViewProfile, onRefreshData }) => {
  const { t } = useTranslation();
  const [currentView, setCurrentView] = useState<DashboardView>(() => {
      const path = window.location.pathname;
      if (path.startsWith('/dashboard/')) {
          const view = path.split('/')[2].toUpperCase();
          if (['INBOX', 'FINANCE', 'ANALYTICS', 'STATISTICS', 'SETTINGS', 'NOTIFICATIONS', 'REVIEWS', 'SUPPORT'].includes(view)) {
              return view as DashboardView;
          }
      }
      return 'OVERVIEW';
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [selectedSenderEmail, setSelectedSenderEmail] = useState<string | null>(null);
  const selectedSenderEmailRef = useRef<string | null>(null);
  const subscriptionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [historicalStats, setHistoricalStats] = useState<MonthlyStat[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  
  // Credit Trend Chart State
  const [trendTimeFrame, setTrendTimeFrame] = useState<StatTimeFrame>('DAILY'); // Default to 'Week' view (Daily data)
  const [trendDate, setTrendDate] = useState<Date>(new Date());
  const [trendData, setTrendData] = useState<DetailedFinancialStat[]>([]);
  
  // Analytics State
  const [proData, setProData] = useState<ProAnalyticsData | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState<'1D' | '7D' | '30D' | 'ALL'>('30D');

  // Statistics State
  const [statsTimeFrame, setStatsTimeFrame] = useState<StatTimeFrame>('WEEKLY');
  const [statsDate, setStatsDate] = useState<Date>(new Date()); 
  
  const [detailedStats, setDetailedStats] = useState<DetailedStat[]>([]);
  const [financialStats, setFinancialStats] = useState<DetailedFinancialStat[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Inbox Filter
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('ALL');
  const [inboxSortOrder, setInboxSortOrder] = useState<'LATEST' | 'COUNT'>('LATEST');

  // Withdrawal State
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isStripeConnected, setIsStripeConnected] = useState(false);
  const [stripeLast4, setStripeLast4] = useState<string | null>(null);
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  const [showWithdrawAnimation, setShowWithdrawAnimation] = useState(false);
  const [withdrawnAmount, setWithdrawnAmount] = useState(0);
  const [showStripeAnimation, setShowStripeAnimation] = useState(false);
  
  // Reply State
  const [replyText, setReplyText] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState<string[]>([]);
  const [isUploadingReplyAttachment, setIsUploadingReplyAttachment] = useState(false);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [showCollectAnimation, setShowCollectAnimation] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [showReadCelebration, setShowReadCelebration] = useState(false);
  const [collectedAmount, setCollectedAmount] = useState(0);

  // Edit Profile State
  const [editedCreator, setEditedCreator] = useState<CreatorProfile>(creator);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  
  // Link Editing State
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [avatarFileName, setAvatarFileName] = useState('');
  const [newLinkType, setNewLinkType] = useState<'EXTERNAL' | 'DIGITAL_PRODUCT' | 'SUPPORT'>('EXTERNAL');
  const [newLinkPrice, setNewLinkPrice] = useState('');
  const [newLinkThumbnail, setNewLinkThumbnail] = useState('');
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

  // Mobile Sidebar Toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Premium State
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingProduct, setIsUploadingProduct] = useState(false);

  const [deletedNotificationIds, setDeletedNotificationIds] = useState<string[]>(() => {
      try {
          const saved = localStorage.getItem('diem_creator_deleted_notifications');
          return saved ? JSON.parse(saved) : [];
      } catch {
          return [];
      }
  });

  const [lastReadTime, setLastReadTime] = useState<number>(() => {
      try {
          return parseInt(localStorage.getItem('diem_creator_last_read_time') || '0');
      } catch { return 0; }
  });

  // Pagination State
  const [financePage, setFinancePage] = useState(1);
  const [notificationPage, setNotificationPage] = useState(1);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [overviewReviewsPage, setOverviewReviewsPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const OVERVIEW_REVIEWS_PER_PAGE = 5;
  const [chatSessionIndex, setChatSessionIndex] = useState(0);

  // Left Chatrooms (hidden, not deleted from DB) - stores timestamp of when left
  const [leftChatrooms, setLeftChatrooms] = useState<Record<string, number>>(() => {
      try {
          const saved = localStorage.getItem('diem_creator_left_chatrooms');
          return saved ? JSON.parse(saved) : {};
      } catch { return {}; }
  });

  const leaveChatroom = (senderEmail: string) => {
      if (!window.confirm(t('creator.leaveConversation'))) return;
      const updated = { ...leftChatrooms, [senderEmail]: Date.now() };
      setLeftChatrooms(updated);
      localStorage.setItem('diem_creator_left_chatrooms', JSON.stringify(updated));
      setSelectedSenderEmail(null);
  };

  // Drag and Drop State for Links
  const [draggedLinkIndex, setDraggedLinkIndex] = useState<number | null>(null);
  const [openIconPickerId, setOpenIconPickerId] = useState<string | null>(null);

  // Section State
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');
  const [newLinkSectionId, setNewLinkSectionId] = useState('');

  // Settings text tab state
  const [settingsTextTab, setSettingsTextTab] = useState<'bio' | 'instructions' | 'reply'>('bio');

  // Onboarding tutorial (settings)
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialIsRevisit, setTutorialIsRevisit] = useState(false);
  const tutorialLinksRef = useRef<HTMLDivElement>(null);
  const tutorialSectionsRef = useRef<HTMLDivElement>(null);

  // Inbox tutorial
  const [showInboxTutorial, setShowInboxTutorial] = useState(false);
  const [inboxTutorialStep, setInboxTutorialStep] = useState(0);
  const inboxTutorialRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null]);
  const [, setInboxTutorialScrollTick] = useState(0);

  const TUTORIAL_STEPS = [
    { title: 'Your Status Message', desc: 'This appears on your public profile — it\'s the first thing fans see when they visit your page. Make it personal!', tab: 'bio' as const, highlight: 'bio' },
    { title: 'Request Instructions', desc: 'Shown to fans before they send you a Diem request. Guide them on what context to include so you can give the best answer.', tab: 'instructions' as const, highlight: 'instructions' },
    { title: 'Auto-Reply Message', desc: 'Sent automatically the moment a fan pays — a warm acknowledgment while you prepare your response.', tab: 'reply' as const, highlight: 'reply' },
    { title: 'Links & Products', desc: 'Share links to your social profiles, website, or resources. You can also upload digital products fans can purchase directly.', tab: null, highlight: 'links' },
    { title: 'Custom Sections', desc: 'Group your links under named sections like "My Work" or "Resources". Type a section name and hit Add to create one.', tab: null, highlight: 'sections' },
  ] as const;

  const handleAddSection = () => {
      if (!newSectionTitle.trim()) return;
      const newSection: LinkSection = {
          id: `s-${Date.now()}`,
          title: newSectionTitle.trim(),
          order: (editedCreator.linkSections || []).length,
      };
      setEditedCreator(prev => ({ ...prev, linkSections: [...(prev.linkSections || []), newSection] }));
      setNewSectionTitle('');
  };

  const handleDeleteSection = (sectionId: string) => {
      setEditedCreator(prev => ({
          ...prev,
          linkSections: (prev.linkSections || []).filter(s => s.id !== sectionId),
          links: (prev.links || []).map(l => l.sectionId === sectionId ? { ...l, sectionId: undefined } : l),
      }));
  };

  const handleRenameSectionTitle = (sectionId: string, title: string) => {
      if (!title.trim()) return;
      setEditedCreator(prev => ({
          ...prev,
          linkSections: (prev.linkSections || []).map(s => s.id === sectionId ? { ...s, title: title.trim() } : s),
      }));
  };

  const handleMoveSection = (sectionId: string, direction: 'up' | 'down') => {
      setEditedCreator(prev => {
          const sorted = [...(prev.linkSections || [])].sort((a, b) => a.order - b.order);
          const idx = sorted.findIndex(s => s.id === sectionId);
          const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
          const updated = sorted.map((s, i) => {
              if (i === idx) return { ...s, order: sorted[swapIdx].order };
              if (i === swapIdx) return { ...s, order: sorted[idx].order };
              return s;
          });
          return { ...prev, linkSections: updated };
      });
  };

  const handleAssignLinkSection = (linkId: string, sectionId: string | undefined) => {
      setEditedCreator(prev => ({
          ...prev,
          links: (prev.links || []).map(l => l.id === linkId ? { ...l, sectionId } : l),
      }));
  };

  const handleDragStart = (index: number) => {
      setDraggedLinkIndex(index);
  };

  const handleDragEnter = (index: number) => {
      if (draggedLinkIndex === null || draggedLinkIndex === index) return;
      
      const newLinks = [...(editedCreator.links || [])];
      const draggedItem = newLinks[draggedLinkIndex];
      newLinks.splice(draggedLinkIndex, 1);
      newLinks.splice(index, 0, draggedItem);
      
      setEditedCreator(prev => ({ ...prev, links: newLinks }));
      setDraggedLinkIndex(index);
  };

  const handleDragEnd = () => {
      setDraggedLinkIndex(null);
  };

  // Chat Reaction State
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>(() => {
      try { return JSON.parse(localStorage.getItem('diem_creator_reactions') || '{}'); } catch { return {}; }
  });
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editAttachment, setEditAttachment] = useState<string | null | undefined>(undefined);
  const [isUploadingEditAttachment, setIsUploadingEditAttachment] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

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
          localStorage.setItem('diem_creator_reactions', JSON.stringify(next));
          return next;
      });
      setActiveReactionPicker(null);
  };

  const handleEditChat = async (chatId: string, messageId: string) => {
      if (!editContent.trim() && !editAttachment) return;
      try {
          await editChatMessage(chatId, editContent.trim(), editAttachment);
          invalidateChatLinesCache(messageId);
          setMessages(prev => prev.map(m => {
              if (m.id !== messageId) return m;
              return {
                  ...m,
                  conversation: m.conversation.map(c =>
                      c.id === chatId ? { ...c, content: editContent.trim(), attachmentUrl: editAttachment ?? undefined, isEdited: true } : c
                  )
              };
          }));
          setEditingChatId(null);
          setEditContent('');
          setEditAttachment(undefined);
      } catch (err) {
          console.error('Failed to edit message:', err);
      }
  };

  const handleDeleteChat = async (chatId: string, messageId: string) => {
      try {
          await deleteChatLine(chatId);
          invalidateChatLinesCache(messageId);
          setMessages(prev => prev.map(m => {
              if (m.id !== messageId) return m;
              return { ...m, conversation: m.conversation.filter(c => c.id !== chatId) };
          }));
          setEditingChatId(null);
          setEditContent('');
          setEditAttachment(undefined);
      } catch (err) {
          console.error('Failed to delete message:', err);
      }
  };

  const handleEditFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploadingEditAttachment(true);
      try {
          const url = await uploadProductFile(file, creator.id);
          setEditAttachment(url);
      } catch (error) {
          console.error("Upload failed", error);
      } finally {
          setIsUploadingEditAttachment(false);
          if (editFileInputRef.current) editFileInputRef.current.value = '';
      }
  };

  useEffect(() => {
      const handlePopState = () => {
          const path = window.location.pathname;
          if (path === '/dashboard' || path === '/dashboard/') {
              setCurrentView('OVERVIEW');
          } else if (path.startsWith('/dashboard/')) {
              const view = path.split('/')[2].toUpperCase();
              if (['INBOX', 'FINANCE', 'ANALYTICS', 'STATISTICS', 'SETTINGS', 'NOTIFICATIONS', 'REVIEWS', 'SUPPORT'].includes(view)) {
                  setCurrentView(view as DashboardView);
              }
          }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
      localStorage.setItem('diem_creator_deleted_notifications', JSON.stringify(deletedNotificationIds));
  }, [deletedNotificationIds]);

  // Memoize sprinkles to prevent re-render jitter (Copied from FanDashboard for consistency)
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

  const notifications = useMemo(() => {
      const list: { id: string, icon: any, text: string, time: Date, color: string, senderEmail?: string }[] = [];
      
      messages.forEach(msg => {
          // Only incoming messages (where I am creator)
          if (msg.creatorId !== creator.id) return;

          const isProduct = msg.content.startsWith('Purchased Product:');
          
          // 1. New Request
          if (msg.status === 'PENDING' && !isProduct) {
              list.push({
                  id: `req-${msg.id}`,
                  icon: MessageSquare,
                  text: `New request from ${msg.senderName}`,
                  time: new Date(msg.createdAt),
                  color: 'bg-stone-100 text-stone-600',
                  senderEmail: msg.senderEmail
              });
          }

          // 2. Product Purchased
          if (isProduct) {
               const productName = msg.content.replace('Purchased Product: ', '');
               list.push({
                  id: `sale-${msg.id}`,
                  icon: ShoppingBag,
                  text: `${msg.senderName} purchased ${productName}`,
                  time: new Date(msg.createdAt),
                  color: 'bg-purple-100 text-purple-600',
                  senderEmail: msg.senderEmail
              });
          }
          
          // 3. Tips (Fan Appreciation & Direct Tips)
          msg.conversation.forEach(chat => {
              const isAppreciation = chat.content.startsWith('Fan Appreciation:');
              const isTip = chat.content.startsWith('Fan Tip:');
              
              if (chat.role === 'FAN' && (isAppreciation || isTip)) {
                  const prefix = isAppreciation ? 'Fan Appreciation: ' : 'Fan Tip: ';
                  const tipText = chat.content.replace(prefix, '');
                  
                  list.push({
                      id: `tip-${chat.id}`,
                      icon: Heart,
                      text: isAppreciation ? `${msg.senderName} sent appreciation: "${tipText}"` : `${msg.senderName} sent a tip: "${tipText}"`,
                      time: new Date(chat.timestamp),
                      color: 'bg-pink-100 text-pink-600',
                      senderEmail: msg.senderEmail
                  });
              }
          });

          // 4. Reviews
          if (msg.rating && msg.rating > 0) {
              list.push({
                  id: `review-${msg.id}`,
                  icon: Star,
                  text: `${msg.senderName} left a ${msg.rating}-star review`,
                  time: msg.replyAt ? new Date(msg.replyAt) : new Date(msg.createdAt),
                  color: 'bg-yellow-100 text-yellow-600',
                  senderEmail: msg.senderEmail
              });
          }
      });

      // 5. Withdrawals
      withdrawals.forEach(w => {
          list.push({
              id: `withdraw-${w.id}`,
              icon: Wallet,
              text: `Withdrawal of ${w.amount.toLocaleString()} credits ($${(w.amount * 0.01 * 0.9).toFixed(2)}) — ${w.status === 'COMPLETED' ? 'completed' : 'pending'}`,
              time: new Date(w.createdAt),
              color: 'bg-blue-100 text-blue-600',
          });
      });

      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      return list
        .filter(n => !deletedNotificationIds.includes(n.id))
        .filter(n => n.time.getTime() >= threeDaysAgo)
        .sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [messages, creator.id, deletedNotificationIds, withdrawals]);

  // Ensure pagination stays valid when items are deleted
  useEffect(() => {
      const totalPages = Math.ceil(notifications.length / ITEMS_PER_PAGE);
      if (notificationPage > totalPages && totalPages > 0) {
          setNotificationPage(totalPages);
      }
  }, [notifications.length, notificationPage]);

  const handleDeleteNotification = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeletedNotificationIds(prev => [...prev, id]);
  };

  const handleClearAllNotifications = () => {
      if (notifications.length === 0) return;
      if (window.confirm(t('creator.clearAllConfirm'))) {
          const allIds = notifications.map(n => n.id);
          setDeletedNotificationIds(prev => [...prev, ...allIds]);
      }
  };

  const handleToggleNotifications = () => {
      if (!showNotifications) {
          setLastReadTime(Date.now());
          localStorage.setItem('diem_creator_last_read_time', Date.now().toString());
      }
      setShowNotifications(!showNotifications);
  };

  const handleNotificationClick = (notif: any) => {
      if (notif.senderEmail) {
          handleOpenChat(notif.senderEmail);
      }
      setDeletedNotificationIds(prev => [...prev, notif.id]);
      setShowNotifications(false);
  };

  useEffect(() => {
    loadData();

    // Real-time Subscription (debounced to prevent duplicate rapid fires)
    if (currentUser) {
        const { unsubscribe } = subscribeToMessages(currentUser.id, () => {
            if (subscriptionDebounceRef.current) clearTimeout(subscriptionDebounceRef.current);
            subscriptionDebounceRef.current = setTimeout(() => loadData(true), 300);
        });
        return () => { unsubscribe(); if (subscriptionDebounceRef.current) clearTimeout(subscriptionDebounceRef.current); };
    }
  }, [currentUser]);

  // Check Stripe connection status when returning from Stripe onboarding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe') === 'return' || params.get('stripe') === 'refresh') {
      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('stripe');
      window.history.replaceState({}, '', url.toString());

      // Re-check Stripe status
      getStripeConnectionStatus().then(({ connected, last4 }) => {
        setIsStripeConnected(connected);
        setStripeLast4(last4);
        if (connected) {
          setCurrentView('FINANCE');
          setShowStripeAnimation(true);
          setTimeout(() => setShowStripeAnimation(false), 4000);
        }
      });
    }
  }, []);

  useEffect(() => {
      loadTrendData();
  }, [trendTimeFrame, trendDate]);

  // Show tutorial the first time a creator visits Profile Settings (including Google OAuth new accounts)
  useEffect(() => {
    if (currentView !== 'SETTINGS' || !currentUser) return;
    const shownKey = `diem_tutorial_shown_${currentUser.id}`;
    const doneKey = `diem_tutorial_done_${currentUser.id}`;
    if (!localStorage.getItem(doneKey)) {
      const shownCount = parseInt(localStorage.getItem(shownKey) || '0');
      // Show tutorial on 1st and 2nd visit to settings (skip marks done on 2nd)
      if (shownCount < 2) {
        localStorage.setItem(shownKey, String(shownCount + 1));
        setTutorialIsRevisit(shownCount >= 1);
        setTutorialStep(0);
        setSettingsTextTab('bio');
        setShowTutorial(true);
      }
    }
  }, [currentView, currentUser?.id]);

  // Send welcome message on every load — idempotent, skips if already sent
  useEffect(() => {
    if (currentUser) sendWelcomeMessage(i18n.language);
  }, [currentUser?.id]);

  // Show inbox tutorial the first time a creator opens the Diem welcome message
  useEffect(() => {
    if (!currentUser || selectedSenderEmail !== 'abe7340@gmail.com') return;
    const doneKey = `diem_creator_inbox_tutorial_done_${currentUser.id}`;
    if (!localStorage.getItem(doneKey)) {
      setInboxTutorialStep(0);
      setShowInboxTutorial(true);
    }
  }, [selectedSenderEmail, currentUser?.id]);

  // Re-render inbox tutorial card on scroll so it follows the highlighted element
  useEffect(() => {
    if (!showInboxTutorial) return;
    const onScroll = () => setInboxTutorialScrollTick(n => n + 1);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [showInboxTutorial]);

  const handleTutorialNext = () => {
    const nextStep = tutorialStep + 1;
    if (nextStep >= TUTORIAL_STEPS.length) { handleTutorialDone(); return; }
    setTutorialStep(nextStep);
    const tab = TUTORIAL_STEPS[nextStep].tab;
    if (tab) setSettingsTextTab(tab);
    if (nextStep === 3) setTimeout(() => tutorialLinksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    if (nextStep === 4) setTimeout(() => tutorialSectionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  };

  const handleTutorialSkip = () => {
    // On the second showing, skip = done
    if (tutorialIsRevisit && currentUser) {
      localStorage.setItem(`diem_tutorial_done_${currentUser.id}`, '1');
    }
    setShowTutorial(false);
  };

  const handleTutorialDone = () => {
    if (currentUser) localStorage.setItem(`diem_tutorial_done_${currentUser.id}`, '1');
    setShowTutorial(false);
  };

  const handleInboxTutorialNext = () => {
    const INBOX_STEPS = 5;
    if (inboxTutorialStep + 1 >= INBOX_STEPS) {
      handleInboxTutorialDone();
    } else {
      setInboxTutorialStep(prev => prev + 1);
    }
  };

  const handleInboxTutorialDone = () => {
    if (currentUser) localStorage.setItem(`diem_creator_inbox_tutorial_done_${currentUser.id}`, '1');
    setShowInboxTutorial(false);
  };

  useEffect(() => {
    if (currentView === 'ANALYTICS' && creator.isPremium) {
        loadProAnalytics(analyticsRange);
    }
  }, [currentView, creator.isPremium, analyticsRange]);

  useEffect(() => {
    if (currentView === 'STATISTICS') {
        loadDetailedStats();
    } else if (currentView === 'FINANCE') {
        loadFinancialStats();
    }
  }, [currentView, statsTimeFrame, statsDate]);

  useEffect(() => {
    setEditedCreator(creator);
  }, [creator]);

  // Keep ref in sync for use inside async callbacks
  useEffect(() => { selectedSenderEmailRef.current = selectedSenderEmail; }, [selectedSenderEmail]);

  // Lazily hydrate full conversation for a message when it's opened
  const hydrateConversation = async (msg: Message) => {
    const lines = await getChatLines(msg.id);
    if (lines.length === 0) return;
    const initialMsg = msg.conversation[0]; // always exists (built from parent row)
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

  // When a thread is selected, only hydrate the active message immediately (others hydrate on demand)
  useEffect(() => {
    if (!selectedSenderEmail) return;
    const threadMsgs = messages.filter(m => m.creatorId === creator.id && m.senderEmail === selectedSenderEmail);
    if (threadMsgs.length === 0) return;
    const pending = [...threadMsgs].reverse().find(m => m.status === 'PENDING');
    const target = pending || threadMsgs[threadMsgs.length - 1];
    if (target.conversation.length <= 1) hydrateConversation(target);
  }, [selectedSenderEmail]); // eslint-disable-line react-hooks/exhaustive-deps


  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);

    // Fetch message headers (chat_lines loaded lazily per conversation)
    const msgs = await getMessages();

    // Merge: preserve already-hydrated conversations from prev state (take fresh metadata from DB)
    setMessages(prev => {
      if (prev.length === 0) return msgs;
      const prevMap = new Map(prev.map(m => [m.id, m]));
      return msgs.map(m => {
        const prevMsg = prevMap.get(m.id);
        if (prevMsg && prevMsg.conversation.length > 1) {
          return { ...m, conversation: prevMsg.conversation };
        }
        return m;
      });
    });
    if (!silent) setIsLoading(false);

    // After a silent (real-time) refresh, re-hydrate the open conversation
    if (silent) {
      const openEmail = selectedSenderEmailRef.current;
      if (openEmail) {
        const threadMsgs = msgs.filter(m => m.creatorId === creator.id && m.senderEmail === openEmail);
        threadMsgs.forEach(msg => {
          invalidateChatLinesCache(msg.id);
          hydrateConversation(msg);
        });
      }
    }

    // Load Stripe, withdrawals, and trend data in parallel (non-blocking)
    const promises: Promise<void>[] = [
        getStripeConnectionStatus().then(({ connected, last4 }) => { setIsStripeConnected(connected); setStripeLast4(last4); }),
        getWithdrawalHistory().then(history => setWithdrawals(history)),
    ];
    if (trendData.length === 0) {
        promises.push(
            getFinancialStatistics(trendTimeFrame, trendDate).then(data => setTrendData(data))
        );
    }
    await Promise.all(promises);
  };

  const loadTrendData = async () => {
      const data = await getFinancialStatistics(trendTimeFrame, trendDate);
      setTrendData(data);
  };

  const handleTrendDateNavigate = (direction: 'PREV' | 'NEXT') => {
      const newDate = new Date(trendDate);
      newDate.setFullYear(newDate.getFullYear() + (direction === 'NEXT' ? 1 : -1));
      setTrendDate(newDate);
  };

  const loadProAnalytics = async (range: '1D' | '7D' | '30D' | 'ALL' = analyticsRange) => {
      setIsLoadingAnalytics(true);
      const data = await getProAnalytics(range);
      setProData(data);
      setIsLoadingAnalytics(false);
  };

  const loadDetailedStats = async () => {
      setIsLoadingStats(true);
      const data = await getDetailedStatistics(statsTimeFrame, statsDate);
      setDetailedStats(data);
      setIsLoadingStats(false);
  };

  const loadFinancialStats = async () => {
      setIsLoadingStats(true);
      const data = await getFinancialStatistics(statsTimeFrame, statsDate);
      setFinancialStats(data);
      setIsLoadingStats(false);
  };

  // Helper for Statistics Navigation
  const handleDateNavigate = (direction: 'PREV' | 'NEXT') => {
      const newDate = new Date(statsDate);
      const modifier = direction === 'NEXT' ? 1 : -1;

      if (statsTimeFrame === 'DAILY') {
          // Move by 1 Month
          newDate.setMonth(newDate.getMonth() + modifier);
      } else if (statsTimeFrame === 'WEEKLY') {
          // Move by 1 Quarter (3 months)
          newDate.setMonth(newDate.getMonth() + (modifier * 3));
      } else {
          // Move by 1 Year
          newDate.setFullYear(newDate.getFullYear() + modifier);
      }
      setStatsDate(newDate);
  };

  const getStatsDateLabel = () => {
      if (statsTimeFrame === 'DAILY') {
          return statsDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      } else if (statsTimeFrame === 'WEEKLY') {
          const q = Math.floor(statsDate.getMonth() / 3) + 1;
          return `Q${q} ${statsDate.getFullYear()}`;
      } else {
          return statsDate.getFullYear().toString();
      }
  };

  // Filter messages to only show incoming requests (where I am the creator)
  const incomingMessages = useMemo(() => messages.filter(m => m.creatorId === creator.id), [messages, creator.id]);

  // Group messages by Sender for Inbox List
  const conversationGroups = useMemo(() => {
      if (incomingMessages.length === 0) return [];
      
      const groups: Record<string, { senderEmail: string, senderName: string, latestMessage: Message, messageCount: number }> = {};
      
      incomingMessages.forEach(msg => {
          if (msg.content.startsWith('Purchased Product:')) return;
          if (msg.content.startsWith('Fan Tip:')) return;

          const email = msg.senderEmail;
          if (!groups[email]) {
              groups[email] = { senderEmail: email, senderName: msg.senderName, latestMessage: msg, messageCount: 0 };
          }
          groups[email].messageCount++;
          if (new Date(msg.createdAt).getTime() > new Date(groups[email].latestMessage.createdAt).getTime()) {
              groups[email].latestMessage = msg;
          }
      });
      return Object.values(groups).sort((a, b) => new Date(b.latestMessage.createdAt).getTime() - new Date(a.latestMessage.createdAt).getTime());
  }, [incomingMessages]);

  const reviews = useMemo(() => {
      return messages
          .filter(m => m.rating && m.rating > 0)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [messages]);

  const stats = useMemo((): DashboardStats => {
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const replied = incomingMessages.filter(m => m.status === 'REPLIED');

    // Credits earned from messages replied > 2 days ago
    const availableEarnings = replied
      .filter(m => m.replyAt && now - new Date(m.replyAt).getTime() >= TWO_DAYS_MS)
      .reduce((sum, m) => sum + m.amount, 0);

    // Credits still in 2-day hold
    const holdEarnings = replied
      .filter(m => !m.replyAt || now - new Date(m.replyAt).getTime() < TWO_DAYS_MS)
      .reduce((sum, m) => sum + m.amount, 0);

    // Earliest release time among held earnings (for UI hint)
    const heldMessages = replied.filter(m => m.replyAt && now - new Date(m.replyAt).getTime() < TWO_DAYS_MS);
    const nextReleaseAt = heldMessages.length > 0
      ? new Date(Math.min(...heldMessages.map(m => new Date(m.replyAt!).getTime() + TWO_DAYS_MS)))
      : null;

    const totalEarnings = availableEarnings + holdEarnings;

    // Filter out products for message metrics
    const messageOnly = incomingMessages.filter(m => !m.content.startsWith('Purchased Product:') && !m.content.startsWith('Fan Tip:'));

    const pendingCount = messageOnly.filter(m => m.status === 'PENDING').length;
    const repliedCount = messageOnly.filter(m => m.status === 'REPLIED').length;
    const expiredCount = messageOnly.filter(m => m.status === 'EXPIRED').length;
    const totalProcessed = repliedCount + expiredCount;
    const responseRate = totalProcessed === 0 ? 100 : Math.round((repliedCount / totalProcessed) * 100);

    // Calculate Avg Response Time
    const repliedMessages = messageOnly.filter(m => m.status === 'REPLIED' && m.replyAt);
    let avgResponseTime = 'N/A';
    if (repliedMessages.length > 0) {
        const totalTimeMs = repliedMessages.reduce((acc, m) => acc + (new Date(m.replyAt!).getTime() - new Date(m.createdAt).getTime()), 0);
        const avgHours = Math.round(totalTimeMs / repliedMessages.length / (1000 * 60 * 60));
        avgResponseTime = `${avgHours}h`;
    }

    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const availableBalance = availableEarnings - totalWithdrawn;

    return {
      totalEarnings,
      pendingCount,
      responseRate,
      // @ts-ignore
      avgResponseTime,
      // @ts-ignore
      availableBalance,
      // @ts-ignore
      holdEarnings,
      // @ts-ignore
      nextReleaseAt,
      monthlyStats: []
    };
  }, [incomingMessages, historicalStats, withdrawals]);

  const handleWithdraw = async () => {
    // @ts-ignore
    const balance = stats.availableBalance;
    if (balance <= 0) return;

    const PLATFORM_FEE_RATE = 0.10;
    const CREDIT_TO_USD = 0.01;

    const grossUsd = balance * CREDIT_TO_USD;
    const platformFee = grossUsd * PLATFORM_FEE_RATE;
    const netUsd = grossUsd - platformFee;

    const confirmed = window.confirm(
        `Withdraw ${balance.toLocaleString()} credits?\n\n` +
        `Gross amount: $${grossUsd.toFixed(2)}\n` +
        `Platform fee (10%): -$${platformFee.toFixed(2)}\n` +
        `You receive: $${netUsd.toFixed(2)}`
    );
    if (!confirmed) return;

    setIsWithdrawing(true);
    try {
        await requestWithdrawal(balance);
        await loadData(true);
        setWithdrawnAmount(netUsd);
        setShowWithdrawAnimation(true);
        setTimeout(() => setShowWithdrawAnimation(false), 4000);
    } catch (e: any) {
        alert(e.message || t('creator.withdrawFailed'));
    } finally {
        setIsWithdrawing(false);
    }
  };

  const handleConnectStripe = async () => {
      if (isStripeConnected) return;
      setIsConnectingStripe(true);
      try {
          const url = await connectStripeAccount();
          if (url) {
              // Real backend: open Stripe's hosted onboarding in a new tab
              window.open(url, '_blank');
          } else {
              // Mock backend: just mark as connected
              setIsStripeConnected(true);
              setShowStripeAnimation(true);
              setTimeout(() => setShowStripeAnimation(false), 4000);
          }
      } catch (e) {
          alert(t('creator.withdrawFailed'));
      } finally {
          setIsConnectingStripe(false);
      }
  };

  const handleOpenChat = async (senderEmail: string) => {
    setSelectedSenderEmail(senderEmail);
    setChatSessionIndex(Infinity); // Will be clamped to latest

    // Mark all unread from this sender as read
    const unread = incomingMessages.filter(m => {
        if (m.senderEmail !== senderEmail || m.isRead) return false;
        // Only mark as read if the last message is from the FAN
        const lastMsg = m.conversation[m.conversation.length - 1];
        return !lastMsg || lastMsg.role === 'FAN';
    });
    if (unread.length > 0) {
        // Optimistic update first for immediate UI feedback
        setMessages(prev => prev.map(m => (m.senderEmail === senderEmail && !m.isRead) ? { ...m, isRead: true } : m));
        await Promise.all(unread.map(m => markMessageAsRead(m.id)));
    }
    setReplyText(''); // Reset reply input for fresh chat
    setReplyAttachments([]);
    setConfirmRejectId(null);
    if (currentView !== 'INBOX') {
        setCurrentView('INBOX');
    }
  };

  // Thread messages for the selected sender
  const threadMessages = useMemo(() => {
      if (!selectedSenderEmail) return [];
      const leftAt = leftChatrooms[selectedSenderEmail];
      return incomingMessages
          .filter(m => m.senderEmail === selectedSenderEmail && !m.content.startsWith('Purchased Product:') && !m.content.startsWith('Fan Tip:'))
          .filter(m => !leftAt || new Date(m.createdAt).getTime() >= leftAt)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [incomingMessages, selectedSenderEmail, leftChatrooms]);

  // Clamp session index to valid range (defaults to latest)
  const effectiveSessionIndex = useMemo(() => {
      if (threadMessages.length === 0) return 0;
      return Math.min(chatSessionIndex, threadMessages.length - 1);
  }, [chatSessionIndex, threadMessages.length]);

  // When navigating to a different session, hydrate it on demand
  useEffect(() => {
    const msg = threadMessages[effectiveSessionIndex];
    if (msg && msg.conversation.length <= 1) hydrateConversation(msg);
  }, [effectiveSessionIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine the "Active" message for the reply input (Latest Pending, or just latest)
  const activeMessage = useMemo(() => {
      const pending = [...threadMessages].reverse().find(m => m.status === 'PENDING');
      return pending || threadMessages[threadMessages.length - 1];
  }, [threadMessages]);

  useEffect(() => {
    // Auto scroll to bottom when conversation changes
    if (scrollRef.current && activeMessage) {
        setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, 100);
    }
  }, [activeMessage?.conversation, activeMessage?.id]);

  const handleGenerateAI = async () => {
    if (!activeMessage) return;
    setIsGeneratingAI(true);
    // Use the last fan message as context for the AI
    const lastFanMsg = [...activeMessage.conversation].reverse().find(m => m.role === 'FAN')?.content || activeMessage.content;
    const draft = await generateReplyDraft(activeMessage.senderName, lastFanMsg, creator);
    setReplyText(draft);
    setIsGeneratingAI(false);
  };

  const handleReplyFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const remaining = 3 - replyAttachments.length;
      const toUpload = files.slice(0, remaining);
      if (toUpload.length === 0) return;

      setIsUploadingReplyAttachment(true);
      try {
          const urls = await Promise.all(toUpload.map(f => uploadProductFile(f, creator.id)));
          setReplyAttachments(prev => [...prev, ...urls]);
      } catch (error) {
          console.error("Upload failed", error);
          alert(t('creator.failedSaveProfile'));
      } finally {
          setIsUploadingReplyAttachment(false);
          if (replyFileInputRef.current) replyFileInputRef.current.value = '';
      }
  };

  const handleSendReply = async (isComplete: boolean) => {
    if (!activeMessage) return;
    
    if (isComplete) {
        if (!window.confirm(t('creator.confirmWithdraw'))) {
            return;
        }
    }

    const hasText = replyText.trim().length > 0;
    const hasAttachment = replyAttachments.length > 0;
    // CRITICAL FIX: Exclude auto-replies when checking for creator participation
    const hasManualReply = activeMessage.conversation.some(m => m.role === 'CREATOR' && !m.id.endsWith('-auto'));

    // Validation:
    // 1. If sending a partial reply (not complete), must have text or attachment.
    if (!isComplete && !hasText && !hasAttachment) return;

    // 2. If completing, must have EITHER (text OR attachment) OR a previous MANUAL reply history.
    if (isComplete && !hasText && !hasAttachment && !hasManualReply) return;

    setIsSendingReply(true);

    try {
        const combinedAttachment = replyAttachments.length > 0 ? replyAttachments.join('|||') : null;
        await replyToMessage(activeMessage.id, replyText, isComplete, combinedAttachment);

        // Kick off hydration immediately (fire-and-forget — subscription also does a background sync)
        invalidateChatLinesCache(activeMessage.id);
        hydrateConversation({ ...activeMessage, conversation: activeMessage.conversation.slice(0, 1) });

        // Also update the message metadata optimistically (status/replyAt) so UI is consistent
        if (isComplete) {
            const replyAt = new Date().toISOString();
            setMessages(prev => prev.map(m => m.id === activeMessage.id ? { ...m, status: 'REPLIED', replyAt } : m));
        }

        setReplyText('');
        setReplyAttachments([]);

        if (isComplete) {
            setCollectedAmount(activeMessage.amount);
            setShowCollectAnimation(true);
            setShowReadCelebration(true); // Trigger confetti for collection
            setTimeout(() => setShowReadCelebration(false), 4000);
            setTimeout(() => setShowCollectAnimation(false), 3500);
        }
    } catch (error) {
        console.error("Failed to send reply:", error);
        alert(t('creator.failedSaveProfile'));
    } finally {
        setIsSendingReply(false);
    }
  };

  const handleReject = async (e?: React.MouseEvent) => {
      if (e) {
          e.preventDefault();
          e.stopPropagation();
      }
      if (!activeMessage) return;
      if (!window.confirm(t('creator.rejectRequest'))) return;
      
      setIsRejecting(true);
      await cancelMessage(activeMessage.id);
      await loadData(true);
      setIsRejecting(false);
  };

  const hasUnsavedChanges = () => {
    if (currentView !== 'SETTINGS') return false;
    return JSON.stringify(editedCreator) !== JSON.stringify(creator);
  };

  const handleNavigate = (view: DashboardView) => {
    if (hasUnsavedChanges() && view !== 'SETTINGS') {
      if (!window.confirm(t('creator.leaveConversation'))) return;
      setEditedCreator(creator);
    }
    if (view === 'NOTIFICATIONS') {
      setLastReadTime(Date.now());
      localStorage.setItem('diem_creator_last_read_time', Date.now().toString());
      setNotificationPage(1);
    } else if (view === 'REVIEWS') {
        setReviewsPage(1);
    }
    
    const path = view === 'OVERVIEW' ? '/dashboard' : `/dashboard/${view.toLowerCase()}`;
    window.history.pushState({ page: 'DASHBOARD' }, '', path);

    setCurrentView(view);
    setSelectedSenderEmail(null);
    setShowInboxTutorial(false);
    setIsSidebarOpen(false);
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setShowSaveSuccess(false);
    try {
        await updateCreatorProfile(editedCreator);
        await onRefreshData();
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000);
    } catch (e) {
        console.error("Failed to save profile", e);
        alert(t('creator.failedSaveProfile'));
    } finally {
        setIsSavingProfile(false);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setAvatarFileName(file.name);
          if (!file.type.startsWith('image/')) {
              alert(t('profile.uploadValidImage'));
              return;
          }

          // Resize image to max 400x400 to prevent payload issues and UI lag
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
                  
                  // Compress to JPEG 80% quality
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                  setEditedCreator(prev => ({ ...prev, avatarUrl: dataUrl }));
              };
              img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
      }
  };

  const handleTogglePlatform = (platformId: string) => {
      const currentPlatforms = editedCreator.platforms || [];
      const existingIndex = currentPlatforms.findIndex(p => 
          (typeof p === 'string' ? p : p.id) === platformId
      );

      if (existingIndex >= 0) {
          const existingPlatform = currentPlatforms[existingIndex];
          const currentUrl = typeof existingPlatform === 'object' ? existingPlatform.url : '';
          const url = window.prompt(t('common.editUrlFor', { platform: platformId }), currentUrl);
          
          if (url === null) return;

          if (url.trim() === '') {
              setEditedCreator(prev => ({
                  ...prev,
                  platforms: prev.platforms?.filter((_, i) => i !== existingIndex)
              }));
          } else {
              const updatedPlatforms = [...currentPlatforms];
              updatedPlatforms[existingIndex] = { id: platformId, url: url.trim() };
              setEditedCreator(prev => ({ ...prev, platforms: updatedPlatforms }));
          }
      } else {
          const url = window.prompt(t('auth.enterUrlFor', { platform: platformId }));
          if (url && url.trim()) {
              const newPlatform = { id: platformId, url: url.trim() };
              setEditedCreator(prev => ({
                  ...prev,
                  platforms: [...(prev.platforms || []), newPlatform]
              }));
          }
      }
  };

  const handleUpdateLink = (id: string, field: keyof AffiliateLink, value: any) => {
     setEditedCreator(prev => ({
         ...prev,
         links: (prev.links || []).map(l => l.id === id ? { ...l, [field]: value } : l)
     }));
  };

  const handleLinkThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>, linkId?: string) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!linkId) setIsUploadingThumbnail(true);
      
      try {
          const url = await uploadProductFile(file, creator.id);
          if (linkId) {
              handleUpdateLink(linkId, 'thumbnailUrl', url);
          } else {
              setNewLinkThumbnail(url);
          }
      } catch (error) {
          console.error("Upload failed", error);
          alert(t('common.uploading'));
      } finally {
          if (!linkId) setIsUploadingThumbnail(false);
      }
  };

  const handleAddLink = () => {
    if (!newLinkTitle.trim()) return;
    if (newLinkType !== 'SUPPORT' && !newLinkUrl.trim()) return;
    
    // Price validation for products
    if (newLinkType === 'DIGITAL_PRODUCT' && (!newLinkPrice || isNaN(Number(newLinkPrice)))) {
        alert(t('creator.failedSaveProfile'));
        return;
    }

    const newLink: AffiliateLink = {
      id: `l-${Date.now()}`,
      title: newLinkTitle,
      url: newLinkType === 'SUPPORT' ? '#' : newLinkUrl,
      fileName: newFileName,
      isPromoted: false,
      type: newLinkType,
      price: (newLinkType === 'DIGITAL_PRODUCT' || newLinkType === 'SUPPORT') && newLinkPrice ? Number(newLinkPrice) : undefined,
      thumbnailUrl: newLinkThumbnail,
      sectionId: newLinkSectionId || undefined,
    };

    setEditedCreator(prev => ({ ...prev, links: [...(prev.links || []), newLink] }));
    setNewLinkTitle('');
    setNewLinkUrl('');
    setNewFileName('');
    setNewLinkPrice('');
    setNewLinkThumbnail('');
    setNewLinkType('EXTERNAL');
    setNewLinkSectionId('');
  };

  const handleRemoveLink = (id: string) => {
     setEditedCreator(prev => ({ ...prev, links: (prev.links || []).filter(l => l.id !== id) }));
  };

  const handleProductFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploadingProduct(true);
      try {
          const url = await uploadProductFile(file, creator.id);
          setNewLinkUrl(url);
          setNewFileName(file.name);
      } catch (error) {
          console.error("Upload failed", error);
          alert(t('creator.failedSaveProfile'));
      } finally {
          setIsUploadingProduct(false);
      }
  };

  const handleProductDrop = async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (isUploadingProduct) return;

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      setIsUploadingProduct(true);
      try {
          const url = await uploadProductFile(file, creator.id);
          setNewLinkUrl(url);
          setNewFileName(file.name);
      } catch (error) {
          console.error("Upload failed", error);
          alert(t('creator.failedSaveProfile'));
      } finally {
          setIsUploadingProduct(false);
      }
  };

  const handleExistingProductUpload = async (e: React.ChangeEvent<HTMLInputElement>, linkId: string) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
          // Note: In a real app, we'd want a per-item loading state. 
          // For MVP, we rely on the async update.
          const url = await uploadProductFile(file, creator.id);
          handleUpdateLink(linkId, 'url', url);
          handleUpdateLink(linkId, 'fileName', file.name);
      } catch (error) {
          console.error("Upload failed", error);
          alert(t('creator.failedSaveProfile'));
      }
  };

  const handleExistingProductDrop = async (e: React.DragEvent<HTMLDivElement>, linkId: string) => {
      e.preventDefault();
      e.stopPropagation();
      
      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      try {
          const url = await uploadProductFile(file, creator.id);
          handleUpdateLink(linkId, 'url', url);
          handleUpdateLink(linkId, 'fileName', file.name);
      } catch (error) {
          console.error("Upload failed", error);
          alert(t('creator.failedSaveProfile'));
      }
  };

  const handleUpgradeToPremium = async () => {
      setIsUpgrading(true);
      // Simulate API call
      await new Promise(r => setTimeout(r, 1500));
      
      const upgradedCreator = { ...creator, isPremium: true };
      await updateCreatorProfile(upgradedCreator);
      await onRefreshData();
      
      // Auto load analytics after upgrade
      await loadProAnalytics();

      setIsUpgrading(false);
      setShowPremiumModal(false);
  };

  const getTimeLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (diff < 0) return { text: 'Expired', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', iconColor: 'text-red-500' };
    if (hours < 4) return { text: `${hours}h left`, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', iconColor: 'text-amber-500' };
    if (hours < 12) return { text: `${hours}h left`, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', iconColor: 'text-orange-500' };
    return { text: `${hours}h left`, color: 'text-stone-600', bg: 'bg-stone-100', border: 'border-stone-200', iconColor: 'text-stone-500' };
  };

  const filteredGroups = useMemo(() => {
      const filtered = conversationGroups.filter(group => {
          const leftAt = leftChatrooms[group.senderEmail];
          if (leftAt && new Date(group.latestMessage.createdAt).getTime() < leftAt) return false;
          const status = group.latestMessage.status;

          if (inboxFilter === 'ALL') return true;
          if (inboxFilter === 'PENDING') return status === 'PENDING';
          if (inboxFilter === 'REPLIED') return status === 'REPLIED';
          if (inboxFilter === 'REJECTED') return status === 'EXPIRED' || status === 'CANCELLED';
          return false;
      });
      if (inboxSortOrder === 'COUNT') {
          return [...filtered].sort((a, b) => b.messageCount - a.messageCount);
      }
      return filtered;
  }, [conversationGroups, inboxFilter, leftChatrooms, inboxSortOrder]);

  const hasManualCreatorReply = activeMessage 
    ? activeMessage.conversation.some(m => m.role === 'CREATOR' && !m.id.endsWith('-auto'))
    : false;

  const SidebarItem = ({ icon: Icon, label, view, badge }: { icon: any, label: string, view: DashboardView, badge?: number }) => (
    <button
      onClick={() => handleNavigate(view)}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-md mb-1 transition-colors text-sm font-medium ${
        currentView === view 
          ? 'bg-stone-200 text-stone-900' 
          : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className={currentView === view ? 'text-stone-900' : 'text-stone-400'} />
        <span>{label}</span>
      </div>
      {badge ? (
        <span className="bg-stone-900 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {badge}
        </span>
      ) : null}
    </button>
  );

  // Use real data if premium, otherwise use dummy data for blurred preview
  const analyticsData = creator.isPremium ? proData : DUMMY_PRO_DATA;

  const TopNav = ({ className = "", hideBurger = false }: { className?: string; hideBurger?: boolean }) => (
    <div className={`flex items-center gap-1.5 sm:gap-2.5 mt-0.5 ${className}`}>
        {!hideBurger && (
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 mr-auto p-2 -ml-2">
                <Menu size={24} />
            </button>
        )}

        <div className="relative">
            <button
                onClick={handleToggleNotifications}
                className="relative text-stone-400 hover:text-stone-600 transition-colors p-1.5 rounded-lg hover:bg-stone-100"
            >
                <Bell size={18} />
                {notifications.filter(n => n.time.getTime() > lastReadTime).length > 0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>}
            </button>

            {showNotifications && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-white rounded-2xl shadow-xl border border-stone-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-4 py-3 border-b border-stone-50 bg-stone-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-sm text-stone-900">{t('creator.notifications')}</h3>
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{notifications.length} {t('creator.notifications')}</span>
                        </div>
                        <div className="max-h-[320px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-stone-400 text-xs">{t('creator.noNotifications')}</div>
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

        <LanguageSwitcher />
        
        <button onClick={onViewProfile} className="text-xs font-medium text-stone-500 hover:text-stone-900 flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <span className="hidden sm:inline">{t('common.view')}</span> <ExternalLink size={14} />
        </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col font-sans text-stone-900 overflow-hidden">
      {!isBackendConfigured() && (
        <div className="bg-amber-500 text-white text-[11px] font-bold px-4 py-1.5 text-center z-50 tracking-wide w-full shrink-0">
          MOCK DATA — not connected to real backend
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
      {/* Mobile Sidebar Overlay - Fixes menu close bug */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-stone-900/50 z-30 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 1. LEFT SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-[#F5F3EE] border-r border-stone-200 transform transition-transform duration-300 z-40 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 flex flex-col`}>
        <div className="p-4 flex flex-col h-full">
            {/* Brand */}
            <div 
                onClick={() => handleNavigate('OVERVIEW')}
                className="flex items-center gap-2 px-3 py-4 mb-6 cursor-pointer hover:opacity-80 transition-opacity"
            >
                <DiemLogo size={24} className="text-stone-900" />
                {creator.isPremium && (
                   <span className="bg-yellow-100 text-yellow-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-yellow-200 ml-1">PRO</span>
                )}
            </div>

            {/* Nav Links */}
            <div className="space-y-1 flex-1">
                <div className="px-3 mb-2 text-xs font-bold text-stone-400 uppercase tracking-wider">{t('creator.main')}</div>
                <SidebarItem icon={Home} label={t('creator.overview')} view="OVERVIEW" />
                <SidebarItem icon={Users} label={t('creator.inbox')} view="INBOX" badge={stats.pendingCount > 0 ? stats.pendingCount : undefined} />
                <SidebarItem icon={Wallet} label={t('creator.finance')} view="FINANCE" />
                <SidebarItem icon={Bell} label={t('creator.notifications')} view="NOTIFICATIONS" badge={notifications.filter(n => n.time.getTime() > lastReadTime).length || undefined} />
                <SidebarItem icon={Star} label={t('creator.reviews')} view="REVIEWS" />
                <SidebarItem icon={TrendingUp} label={t('creator.analytics')} view="ANALYTICS" />
                <SidebarItem icon={AlertCircle} label={t('creator.support')} view="SUPPORT" />
                <SidebarItem icon={PieIcon} label={t('creator.statistics')} view="STATISTICS" />

                <div className="px-3 mt-8 mb-2 text-xs font-bold text-stone-400 uppercase tracking-wider">{t('creator.settings')}</div>
                <SidebarItem icon={User} label={t('creator.profileSettings')} view="SETTINGS" />
            </div>

            {!creator.isPremium && (
                <div className="px-3 mb-4">
                    <button 
                        onClick={() => { setIsSidebarOpen(false); setShowPremiumModal(true); }}
                        className="w-full bg-stone-900 text-white rounded-xl p-3 hover:bg-stone-800 transition-all text-left group relative overflow-hidden"
                    >
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 font-bold text-sm mb-1">
                                <Sparkles size={14} className="text-yellow-300 fill-yellow-300" /> {t('creator.upgradeNow')}
                            </div>
                            <p className="text-sm text-stone-400">{t('creator.advancedAnalytics')}</p>
                        </div>
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    </button>
                </div>
            )}

            {/* Profile Snippet Bottom */}
            <div className="mt-auto border-t border-stone-200 pt-4 px-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-stone-200 overflow-hidden flex-shrink-0 border border-stone-200">
                        <img 
                            src={creator.avatarUrl || DEFAULT_AVATAR} 
                            className="w-full h-full object-cover" 
                            alt="me" 
                            onError={(e) => {
                                e.currentTarget.src = DEFAULT_AVATAR; // Fallback to default if broken
                            }}
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-900 truncate">{creator.displayName}</p>
                        <p className="text-xs text-stone-500 truncate">{currentUser?.email || creator.handle}</p>
                    </div>
                    <button onClick={onLogout} className="text-stone-400 hover:text-red-600 transition-colors">
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <main className="flex-1 md:ml-64 flex flex-col h-screen relative">
        
        {/* Scrollable Content */}
        <div className={`flex-1 ${currentView === 'INBOX' ? 'overflow-hidden p-0' : 'overflow-auto p-6'} relative`}>
            
            {/* ... (Overview View) ... */}
            {currentView === 'OVERVIEW' && (
                <div className="space-y-8 max-w-5xl mx-auto">
                    {/* Welcome Header - Editorial Style */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0"><Menu size={24} /></button>
                            <div>
                                <p className="text-sm font-medium text-stone-400 mb-1">{t('creator.overview')}</p>
                                <h1 className="text-2xl sm:text-3xl font-semibold text-stone-900 tracking-tight">{creator.displayName}</h1>
                            </div>
                        </div>
                        <TopNav hideBurger />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Total Earned */}
                        <div className="bg-white p-5 rounded-2xl border border-stone-200/60 group hover:shadow-sm transition-all">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-stone-100 text-stone-400 rounded-lg"><Coins size={14}/></div>
                                <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{t('creator.totalEarnings')}</span>
                            </div>
                            <div className="text-2xl font-bold text-stone-900 tracking-tight">{stats.totalEarnings.toLocaleString()}</div>
                            <div className="text-[11px] text-emerald-600 font-medium mt-1.5">{t('creator.thisWeek')}</div>
                        </div>

                        {/* Pending */}
                        <div className="bg-white p-5 rounded-2xl border border-stone-200/60 group hover:shadow-sm transition-all">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-stone-100 text-stone-400 rounded-lg"><Clock size={14}/></div>
                                <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{t('common.pending')}</span>
                            </div>
                            <div className="text-2xl font-bold text-stone-900 tracking-tight">{stats.pendingCount}</div>
                            <div className="text-[11px] text-stone-400 font-medium mt-1.5">{t('creator.pendingRequests')}</div>
                        </div>

                        {/* Response Rate */}
                        <div className="bg-white p-5 rounded-2xl border border-stone-200/60 group hover:shadow-sm transition-all">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-stone-100 text-stone-400 rounded-lg"><CheckCircle2 size={14}/></div>
                                <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{t('profile.response')}</span>
                            </div>
                            <div className="text-2xl font-bold text-stone-900 tracking-tight">{stats.responseRate}%</div>
                            {/* @ts-ignore */}
                            <div className="text-[11px] text-stone-400 font-medium mt-1.5">{t('creator.avg', { time: stats.avgResponseTime })}</div>
                        </div>

                        {/* Total Requests */}
                        <div className="bg-white p-5 rounded-2xl border border-stone-200/60 group hover:shadow-sm transition-all">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-stone-100 text-stone-400 rounded-lg"><MessageSquare size={14}/></div>
                                <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{t('creator.totalMessages')}</span>
                            </div>
                            <div className="text-2xl font-bold text-stone-900 tracking-tight">{incomingMessages.length.toLocaleString()}</div>
                            <div className="text-[11px] text-stone-400 font-medium mt-1.5">{t('creator.lifetime')}</div>
                        </div>
                    </div>
                    {/* ... Charts ... */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-2xl border border-stone-200/60 shadow-sm relative overflow-hidden h-96 flex flex-col">
                            <h3 className="font-bold text-stone-900 mb-6 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <span>{t('creator.creditTrend')}</span>
                                    {trendTimeFrame === 'YEARLY' && (
                                        <div className="flex items-center gap-1 ml-2 bg-stone-50 rounded-lg p-0.5 border border-stone-100">
                                            <button onClick={() => handleTrendDateNavigate('PREV')} className="p-0.5 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-600 transition-colors">
                                                <ChevronLeft size={14} />
                                            </button>
                                            <span className="text-[10px] font-bold text-stone-600 px-1 min-w-[32px] text-center">{trendDate.getFullYear()}</span>
                                            <button onClick={() => handleTrendDateNavigate('NEXT')} className="p-0.5 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-600 transition-colors">
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex bg-stone-100 p-0.5 rounded-lg">
                                    {[
                                        { label: t('creator.daily'), value: 'DAILY' },
                                        { label: t('creator.weekly'), value: 'WEEKLY' },
                                        { label: t('creator.monthly'), value: 'YEARLY' }
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => { setTrendTimeFrame(opt.value as StatTimeFrame); setTrendDate(new Date()); }}
                                            className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${trendTimeFrame === opt.value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </h3>
                            
                            <div className={`flex-1 w-full min-h-0 ${!creator.isPremium ? 'blur-sm select-none opacity-50' : ''}`}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trendData}>
                                        <defs>
                                            <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#78716c" stopOpacity={0.15}/>
                                                <stop offset="95%" stopColor="#78716c" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#a8a29e', fontSize: 12}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#a8a29e', fontSize: 12}} domain={[0, 'auto']} />
                                        <Tooltip cursor={{fill: 'rgba(120, 113, 108, 0.06)'}} contentStyle={{borderRadius: '12px', border: '1px solid #e7e5e4', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)', backgroundColor: '#fff'}} />
                                        <Area type="monotone" dataKey="totalRevenue" stroke="#78716c" strokeWidth={2} fillOpacity={1} fill="url(#colorEarnings)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {!creator.isPremium && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                    <div className="bg-white/80 backdrop-blur-md border border-white/50 p-6 rounded-2xl shadow-xl flex flex-col items-center max-w-xs text-center">
                                        <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center mb-3 text-stone-500">
                                            <Lock size={20} />
                                        </div>
                                        <h4 className="font-bold text-stone-900 mb-1">{t('creator.creditTrend')}</h4>
                                        <p className="text-xs text-stone-500 mb-4">{t('creator.advancedAnalytics')}</p>
                                        <Button size="sm" onClick={() => setShowPremiumModal(true)} className="w-full">{t('creator.upgradeNow')}</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                         <div className="space-y-4">
                             <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col h-96">
                                {(() => {
                                    const totalOverviewPages = Math.ceil(reviews.length / OVERVIEW_REVIEWS_PER_PAGE);
                                    const displayedOverviewReviews = reviews.slice((overviewReviewsPage - 1) * OVERVIEW_REVIEWS_PER_PAGE, overviewReviewsPage * OVERVIEW_REVIEWS_PER_PAGE);
                                    
                                    return (
                                        <>
                                <div className="flex justify-between items-center mb-4 pb-2 border-b border-stone-50 flex-shrink-0">
                                    <div className="text-stone-400 text-xs font-bold uppercase tracking-wider">{t('creator.recentReviews')}</div>
                                    <div className="flex items-center gap-2">
                                        {totalOverviewPages > 1 && (
                                            <div className="flex items-center gap-0.5">
                                                {Array.from({ length: totalOverviewPages }, (_, i) => i + 1).map(p => (
                                                    <button
                                                        key={p}
                                                        onClick={() => setOverviewReviewsPage(p)}
                                                        className={`w-5 h-5 text-[9px] font-bold rounded transition-all ${overviewReviewsPage === p ? 'bg-stone-800 text-white' : 'text-stone-400 hover:bg-stone-100'}`}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <button 
                                            onClick={() => handleNavigate('REVIEWS')}
                                            className="text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-50 px-2 py-1 rounded transition-colors"
                                        >
                                            {t('creator.viewAll')}
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                                    {displayedOverviewReviews.length === 0 ? (
                                        <div className="text-center py-6">
                                            <Star size={24} className="mx-auto text-stone-200 mb-2" />
                                            <p className="text-xs text-stone-400">{t('creator.noReviewsYet')}</p>
                                        </div>
                                    ) : (
                                        displayedOverviewReviews.map(review => (
                                            <div key={review.id} className="group">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-stone-900 text-xs">{review.senderName}</span>
                                                    <span className="text-[10px] text-stone-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex gap-0.5 mb-2">
                                                        {[1,2,3,4,5].map(i => (
                                                            <Star key={i} size={10} className={`${(review.rating || 0) >= i ? "fill-yellow-400 text-yellow-400" : "text-stone-200"}`}/>
                                                        ))}
                                                </div>
                                                <div className="bg-stone-50 p-2 rounded-lg">
                                                    <p className="text-[10px] text-stone-500 line-clamp-2 italic">
                                                        "{review.reviewContent || t('creator.noWrittenReview')}"
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

             {/* --- VIEW: FINANCE OR STATISTICS --- */}
            {(currentView === 'FINANCE' || currentView === 'STATISTICS') && (
                <div className="max-w-6xl mx-auto animate-in fade-in space-y-6 sm:space-y-8 overflow-x-hidden">
                     {/* Header Controls */}
                     <div className="flex flex-col gap-4">
                         <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                 <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0"><Menu size={24} /></button>
                                 <div>
                                     <h2 className="text-xl sm:text-2xl font-bold text-stone-900">
                                         {currentView === 'FINANCE' ? t('creator.financeCredits') : t('creator.activityStatistics')}
                                     </h2>
                                     <p className="text-stone-500 text-xs sm:text-sm">
                                         {currentView === 'FINANCE'
                                            ? t('creator.manageEarnings')
                                            : t('creator.trackPerformance')}
                                     </p>
                                 </div>
                             </div>
                             <TopNav hideBurger />
                         </div>

                         {currentView === 'STATISTICS' && (
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:items-center bg-white p-1.5 sm:p-1 rounded-xl border border-stone-200 shadow-sm w-full sm:w-fit">
                                {/* Timeframe Toggle */}
                                <div className="flex bg-stone-100 p-1 rounded-lg">
                                    {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((tf) => (
                                        <button
                                            key={tf}
                                            onClick={() => { setStatsTimeFrame(tf); setStatsDate(new Date()); }}
                                            className={`flex-1 sm:flex-initial px-3 py-1.5 text-[10px] font-bold rounded-md transition-all uppercase tracking-wide ${
                                                statsTimeFrame === tf
                                                ? 'bg-white text-stone-900 shadow-sm'
                                                : 'text-stone-500 hover:text-stone-900'
                                            }`}
                                        >
                                            {tf}
                                        </button>
                                    ))}
                                </div>

                                {/* Date Picker / Navigation */}
                                <div className="flex items-center justify-center gap-2 sm:pl-3 sm:pr-2">
                                    <button onClick={() => handleDateNavigate('PREV')} className="p-1.5 hover:bg-stone-100 rounded text-stone-500">
                                        <ChevronLeft size={16} />
                                    </button>
                                    <div className="flex items-center gap-2 px-2 min-w-[120px] justify-center">
                                        <Calendar size={14} className="text-stone-400" />
                                        <span className="text-xs font-bold text-stone-900">{getStatsDateLabel()}</span>
                                    </div>
                                    <button onClick={() => handleDateNavigate('NEXT')} className="p-1.5 hover:bg-stone-100 rounded text-stone-500">
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                         )}
                     </div>

                     {/* CONTENT FOR STATISTICS (ACTIVITY) */}
                     {currentView === 'STATISTICS' && (
                         <>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-in fade-in zoom-in-95 duration-300">
                                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/60 group hover:shadow-sm transition-all">
                                    <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                                        <div className="p-1 sm:p-1.5 bg-stone-100 text-stone-400 rounded-lg"><Eye size={14}/></div>
                                        <span className="text-[10px] sm:text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{t('creator.views')}</span>
                                    </div>
                                    <div className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                                        {detailedStats.reduce((acc, curr) => acc + curr.views, 0).toLocaleString()}
                                    </div>
                                </div>
                                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/60 group hover:shadow-sm transition-all">
                                    <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                                        <div className="p-1 sm:p-1.5 bg-stone-100 text-stone-400 rounded-lg"><Heart size={14} className="fill-current"/></div>
                                        <span className="text-[10px] sm:text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{t('creator.likes')}</span>
                                    </div>
                                    <div className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                                        {detailedStats.reduce((acc, curr) => acc + curr.likes, 0).toLocaleString()}
                                    </div>
                                </div>
                                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/60 group hover:shadow-sm transition-all">
                                    <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                                        <div className="p-1 sm:p-1.5 bg-stone-100 text-stone-400 rounded-lg"><Star size={14} className="fill-current"/></div>
                                        <span className="text-[10px] sm:text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{t('creator.rating')}</span>
                                    </div>
                                    <div className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                                        {(() => {
                                            const valid = detailedStats.filter(s => s.rating > 0);
                                            const avg = valid.length > 0 ? valid.reduce((acc, curr) => acc + curr.rating, 0) / valid.length : 0;
                                            return avg.toFixed(1);
                                        })()}
                                    </div>
                                </div>
                                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/60 group hover:shadow-sm transition-all">
                                    <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                                        <div className="p-1 sm:p-1.5 bg-stone-100 text-stone-400 rounded-lg"><Clock size={14}/></div>
                                        <span className="text-[10px] sm:text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{t('profile.response')}</span>
                                    </div>
                                    <div className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                                        {(() => {
                                            const valid = detailedStats.filter(s => s.responseTime > 0);
                                            const avg = valid.length > 0 ? valid.reduce((acc, curr) => acc + curr.responseTime, 0) / valid.length : 0;

                                            if (avg <= 0) return 'N/A';

                                            return (
                                                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                                                    <span>{avg.toFixed(1)}h</span>
                                                    <span className="text-[9px] sm:text-[10px] font-medium text-stone-500 bg-stone-50 px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wide border border-stone-200 w-fit">
                                                        {getResponseCategory(avg, t)}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                {/* Profile Views Chart */}
                                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200/60">
                                    <h3 className="text-sm font-bold text-stone-900 mb-1 flex items-center gap-2">
                                        <Eye size={14} className="text-stone-400" />
                                        {t('creator.profileViews')}
                                    </h3>
                                    <p className="text-xs text-stone-400 mb-4 sm:mb-5">{getStatsDateLabel()}</p>

                                    <div className="h-44 sm:h-52 w-full">
                                        {isLoadingStats ? (
                                            <div className="h-full w-full flex items-center justify-center text-stone-400 text-sm">{t('common.loading')}</div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={detailedStats} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="colorViewsStats" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#78716c" stopOpacity={0.1}/>
                                                            <stop offset="95%" stopColor="#78716c" stopOpacity={0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#a8a29e', fontSize: 11}} dy={8} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#a8a29e', fontSize: 11}} />
                                                    <Tooltip
                                                        contentStyle={{borderRadius: '10px', border: '1px solid #e7e5e4', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', backgroundColor: '#fff', fontSize: '12px'}}
                                                        cursor={{fill: 'rgba(120, 113, 108, 0.06)'}}
                                                    />
                                                    <Area type="monotone" dataKey="views" stroke="#78716c" strokeWidth={2} fill="url(#colorViewsStats)" dot={{r: 3, fill: '#78716c', strokeWidth: 2, stroke: '#fff'}} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>

                                {/* Likes Chart */}
                                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200/60">
                                    <h3 className="text-sm font-bold text-stone-900 mb-1 flex items-center gap-2">
                                        <Heart size={14} className="text-stone-400 fill-current" />
                                        {t('creator.likes')}
                                    </h3>
                                    <p className="text-xs text-stone-400 mb-4 sm:mb-5">{getStatsDateLabel()}</p>

                                    <div className="h-44 sm:h-52 w-full">
                                        {isLoadingStats ? (
                                            <div className="h-full w-full flex items-center justify-center text-stone-400 text-sm">{t('common.loading')}</div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={detailedStats} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#a8a29e', fontSize: 11}} dy={8} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#a8a29e', fontSize: 11}} allowDecimals={false} />
                                                    <Tooltip
                                                        contentStyle={{borderRadius: '10px', border: '1px solid #e7e5e4', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', backgroundColor: '#fff', fontSize: '12px'}}
                                                        cursor={{fill: 'rgba(120, 113, 108, 0.06)'}}
                                                    />
                                                    <Bar dataKey="likes" fill="#a8a29e" radius={[4, 4, 0, 0]} barSize={24} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>
                            </div>
                         </>
                     )}

                     {/* CONTENT FOR FINANCE */}
                     {currentView === 'FINANCE' && (
                         <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in zoom-in-95 duration-300">

                                {/* 1. Total Revenue Card */}
                                <div className="bg-white p-5 rounded-2xl border border-stone-200/60 group hover:shadow-sm transition-all">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-1.5 bg-stone-100 text-stone-400 rounded-lg"><TrendingUp size={14}/></div>
                                        <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{t('creator.lifetimeRevenue')}</span>
                                    </div>
                                    <div className="text-2xl font-bold text-stone-900 tracking-tight flex items-baseline gap-1">
                                        {stats.totalEarnings.toLocaleString()}
                                        <span className="text-sm font-medium text-stone-400">{t('common.credits').toLowerCase()}</span>
                                    </div>
                                    <p className="text-[11px] text-emerald-600 mt-1.5 font-medium">{t('creator.approxUsd', { amount: (stats.totalEarnings / 100).toFixed(2) })}</p>
                                </div>

                                {/* 2. Current Credits Card */}
                                <div className="bg-white p-5 rounded-2xl border border-stone-200/60 group hover:shadow-sm transition-all">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-1.5 bg-stone-100 text-stone-400 rounded-lg"><Wallet size={14}/></div>
                                        <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{t('creator.availableBalanceLabel')}</span>
                                    </div>
                                    {isLoading ? (
                                        <div className="flex items-center gap-2 text-stone-400">
                                            <RefreshCw size={16} className="animate-spin" />
                                            <span className="text-sm font-medium">{t('creator.calculatingBalance') || 'Calculating...'}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="text-2xl font-bold text-stone-900 tracking-tight flex items-baseline gap-1">
                                                {/* @ts-ignore */}
                                                {stats.availableBalance.toLocaleString()}
                                                <span className="text-sm font-medium text-stone-400">{t('common.credits').toLowerCase()}</span>
                                            </div>
                                            <p className="text-[11px] text-emerald-600 mt-1.5 font-medium">{t('creator.readyToPayout')}</p>
                                            {/* @ts-ignore */}
                                            {stats.holdEarnings > 0 && (
                                                <div className="mt-2 pt-2 border-t border-stone-100">
                                                    <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                                                        <span>⏳</span>
                                                        {/* @ts-ignore */}
                                                        {stats.holdEarnings.toLocaleString()} credits in 2-day hold
                                                    </p>
                                                    {/* @ts-ignore */}
                                                    {stats.nextReleaseAt && (
                                                        <p className="text-[10px] text-stone-400 mt-0.5">
                                                            {/* @ts-ignore */}
                                                            Next release: {new Date(stats.nextReleaseAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* 3. Withdraw Action Card */}
                                <div className="bg-white p-5 rounded-2xl border border-stone-200/60 flex flex-col justify-center hover:shadow-sm transition-all">
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-stone-600 mb-4">{t('creator.convertWithdraw')}</p>
                                        <Button
                                            onClick={handleWithdraw}
                                            isLoading={isWithdrawing}
                                            // @ts-ignore
                                            disabled={isLoading || stats.availableBalance === 0}
                                            fullWidth
                                            className="bg-stone-900 text-white hover:bg-stone-800 h-12 shadow-md flex items-center justify-center gap-2"
                                        >
                                            <CreditCard size={16} />
                                            {isLoading
                                                ? (t('creator.loadingBalance') || 'Loading...')
                                                // @ts-ignore
                                                : t('creator.withdrawAmount', { amount: (stats.availableBalance / 100).toFixed(2) })
                                            }
                                        </Button>
                                        <p className="text-[10px] text-stone-400 mt-3 text-center">
                                            {t('creator.transferDays')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Payout Method (Stripe) */}
                            <div className="bg-white p-6 rounded-2xl border border-stone-200/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isStripeConnected ? 'bg-green-100 text-green-600' : 'bg-stone-100 text-stone-500'}`}>
                                        {isStripeConnected ? <Check size={24} /> : <CreditCard size={24} />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-stone-900">{t('creator.payoutMethod')}</h3>
                                        <p className="text-sm text-stone-500">
                                            {isStripeConnected
                                                ? stripeLast4
                                                    ? `Connected to Stripe (•••• ${stripeLast4}). Automatic payouts enabled.`
                                                    : t('creator.stripeConnectedDesc')
                                                : t('creator.stripeLinkDesc')}
                                        </p>
                                    </div>
                                </div>
                                {isStripeConnected ? (
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-lg text-sm font-semibold">
                                            <Check size={16} /> {t('creator.connected')}
                                        </span>
                                        <button
                                            onClick={() => {
                                                if (window.confirm(t('creator.disconnectStripeConfirm'))) {
                                                    setIsStripeConnected(false);
                                                }
                                            }}
                                            className="text-xs font-medium text-stone-400 hover:text-red-500 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
                                        >
                                            {t('creator.disconnect')}
                                        </button>
                                    </div>
                                ) : (
                                    <Button
                                        onClick={handleConnectStripe}
                                        isLoading={isConnectingStripe}
                                        className="bg-[#635BFF] hover:bg-[#5851E8] text-white shadow-md shadow-indigo-500/20"
                                    >
                                        {t('creator.connectStripeBtn')}
                                    </Button>
                                )}
                            </div>

                            {/* --- TRANSACTION HISTORY TABLE --- */}
                            {(() => {
                                // Merge messages and withdrawals into a unified transaction list
                                type Transaction = { id: string; date: Date; source: string; type: 'message' | 'product' | 'tip' | 'withdrawal'; status: string; amount: number; isWithdrawal: boolean };
                                const txns: Transaction[] = messages
                                    .filter(m => m.status === 'REPLIED')
                                    .map(msg => ({
                                        id: msg.id,
                                        date: new Date(msg.createdAt),
                                        source: msg.senderName,
                                        type: (msg.content.startsWith('Purchased Product:') ? 'product' : msg.content.startsWith('Fan Tip:') ? 'tip' : 'message') as Transaction['type'],
                                        status: 'SETTLED',
                                        amount: msg.amount,
                                        isWithdrawal: false,
                                    }));
                                withdrawals.forEach(w => {
                                    txns.push({
                                        id: `w-${w.id}`,
                                        date: new Date(w.createdAt),
                                        source: 'Withdrawal',
                                        type: 'withdrawal',
                                        status: w.status,
                                        amount: w.amount,
                                        isWithdrawal: true,
                                    });
                                });
                                txns.sort((a, b) => b.date.getTime() - a.date.getTime());
                                const totalPages = Math.ceil(txns.length / ITEMS_PER_PAGE);
                                const displayedFinance = txns.slice((financePage - 1) * ITEMS_PER_PAGE, financePage * ITEMS_PER_PAGE);
                                return (
                            <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-3">
                                <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                                     <h3 className="text-sm font-bold text-stone-900">{t('creator.creditHistory')}</h3>
                                     <Button variant="ghost" size="sm" className="text-xs"><ExternalLink size={14} className="mr-1"/> {t('creator.exportCsv')}</Button>
                                </div>
                                <div className="hidden md:block overflow-x-auto">
                                   <table className="w-full text-left text-sm whitespace-nowrap">
                                       <thead className="bg-stone-50 text-stone-500 font-bold border-b border-stone-100 text-xs uppercase tracking-wider">
                                           <tr>
                                               <th className="px-6 py-3">{t('creator.date')}</th>
                                               <th className="px-6 py-3">{t('creator.source')}</th>
                                               <th className="px-6 py-3">{t('creator.type')}</th>
                                               <th className="px-6 py-3">{t('creator.status')}</th>
                                               <th className="px-6 py-3 text-right">{t('fan.amountCredits')}</th>
                                           </tr>
                                       </thead>
                                       <tbody className="divide-y divide-stone-100">
                                           {displayedFinance.map(txn => (
                                               <tr key={txn.id} className="hover:bg-stone-50 transition-colors">
                                                   <td className="px-6 py-4 text-stone-500 font-mono text-xs">{txn.date.toLocaleDateString()}</td>
                                                   <td className="px-6 py-4 font-medium text-stone-900">{txn.source}</td>
                                                   <td className="px-6 py-4">
                                                       <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                                           txn.type === 'product' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                           txn.type === 'tip' ? 'bg-pink-50 text-pink-700 border-pink-100' :
                                                           txn.type === 'withdrawal' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                           'bg-stone-50 text-stone-700 border-stone-200'
                                                       }`}>
                                                           {txn.type === 'product' ? <ShoppingBag size={12}/> : txn.type === 'tip' ? <Heart size={12}/> : txn.type === 'withdrawal' ? <Wallet size={12}/> : <MessageSquare size={12}/>}
                                                           {txn.type === 'product' ? t('creator.product') : txn.type === 'tip' ? t('creator.tip') : txn.type === 'withdrawal' ? t('creator.withdrawal') || 'Withdrawal' : t('creator.message')}
                                                       </span>
                                                   </td>
                                                   <td className="px-6 py-4">
                                                       {txn.isWithdrawal ? (
                                                           <span className={`font-bold text-xs flex items-center gap-1 ${txn.status === 'COMPLETED' ? 'text-blue-600' : 'text-amber-600'}`}>
                                                               {txn.status === 'COMPLETED' ? <CheckCircle2 size={12} /> : <Clock size={12} />} {txn.status === 'COMPLETED' ? t('creator.completed') : t('creator.pending') || 'Pending'}
                                                           </span>
                                                       ) : (
                                                           <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                                                               <CheckCircle2 size={12} /> {t('creator.settled')}
                                                           </span>
                                                       )}
                                                   </td>
                                                   <td className="px-6 py-4 text-right">
                                                       <span className={`font-mono font-bold ${txn.isWithdrawal ? 'text-red-500' : 'text-emerald-600'}`}>
                                                           {txn.isWithdrawal ? '-' : '+'}{txn.amount}
                                                       </span>
                                                   </td>
                                               </tr>
                                           ))}
                                           {displayedFinance.length === 0 && (
                                               <tr><td colSpan={5} className="p-12 text-center text-stone-400">{t('creator.noTransactions')}</td></tr>
                                           )}
                                       </tbody>
                                   </table>
                                </div>
                                
                                {/* Mobile List View */}
                                <div className="md:hidden divide-y divide-stone-100">
                                    {displayedFinance.map(txn => (
                                        <div key={txn.id} className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                    txn.type === 'product' ? 'bg-purple-100 text-purple-600' :
                                                    txn.type === 'tip' ? 'bg-pink-100 text-pink-600' :
                                                    txn.type === 'withdrawal' ? 'bg-blue-100 text-blue-600' :
                                                    'bg-stone-100 text-stone-600'
                                                }`}>
                                                    {txn.type === 'product' ? <ShoppingBag size={18}/> : txn.type === 'tip' ? <Heart size={18}/> : txn.type === 'withdrawal' ? <Wallet size={18}/> : <MessageSquare size={18}/>}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-stone-900 text-sm">{txn.source}</div>
                                                    <div className="text-xs text-stone-500 flex items-center gap-1">
                                                        <span>{txn.date.toLocaleDateString()}</span>
                                                        <span>•</span>
                                                        <span>{txn.type === 'product' ? t('creator.product') : txn.type === 'tip' ? t('creator.tip') : txn.type === 'withdrawal' ? t('creator.withdrawal') || 'Withdrawal' : t('creator.message')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`font-mono font-bold ${txn.isWithdrawal ? 'text-red-500' : 'text-emerald-600'}`}>{txn.isWithdrawal ? '-' : '+'}{txn.amount}</div>
                                                <div className="text-[10px] text-stone-400">{t('common.credits')}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {displayedFinance.length === 0 && (
                                        <div className="p-8 text-center text-stone-400 text-sm">{t('creator.noTransactions')}</div>
                                    )}
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-center gap-4">
                                        <button 
                                            onClick={() => setFinancePage(p => Math.max(1, p - 1))}
                                            disabled={financePage === 1}
                                            className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed text-stone-500 transition-colors"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <span className="text-xs font-bold text-stone-600">{t('common.page', { current: financePage, total: totalPages })}</span>
                                        <button 
                                            onClick={() => setFinancePage(p => Math.min(totalPages, p + 1))}
                                            disabled={financePage === totalPages}
                                            className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed text-stone-500 transition-colors"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            );
                            })()}
                         </>
                     )}
                </div>
            )}

            {/* --- VIEW: ANALYTICS (Pro Feature) --- */}
            {currentView === 'ANALYTICS' && (
                <div className="max-w-6xl mx-auto animate-in fade-in relative min-h-[80vh] overflow-x-hidden">
                    {/* Header - Always visible */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6 sm:mb-8">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0"><Menu size={24} /></button>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-stone-900">{t('creator.analyticsOverview')}</h2>
                                <p className="text-stone-500 text-xs sm:text-sm">{t('creator.performanceMetrics')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1">
                                {(['1D', '7D', '30D', 'ALL'] as const).map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setAnalyticsRange(r)}
                                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${analyticsRange === r ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                                    >
                                        {r === '1D' ? 'Today' : r === '7D' ? '7 Days' : r === '30D' ? '30 Days' : 'All Time'}
                                    </button>
                                ))}
                            </div>
                            <button className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-600 shadow-sm hover:bg-stone-50">{t('creator.exportReport')}</button>
                            <TopNav hideBurger />
                        </div>
                    </div>

                    {/* Loading State for Premium Users */}
                    {creator.isPremium && isLoadingAnalytics && (
                         <div className="h-96 flex items-center justify-center text-stone-400">{t('creator.loadingAnalytics')}</div>
                    )}

                    {/* Content (Visible if premium loaded OR if not premium (dummy)) */}
                    {analyticsData && (
                        <>
                            {/* Lock Overlay for Non-Premium */}
                            {!creator.isPremium && (
                                <div className="absolute inset-0 z-30 flex items-center justify-center backdrop-blur-[2px]">
                                    <div className="bg-white/90 p-8 rounded-3xl shadow-2xl border border-white/50 text-center max-w-md w-full mx-4 flex flex-col items-center gap-6 transform transition-all hover:scale-105 duration-300">
                                        <div className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center mb-2">
                                            <Lock size={32} className="text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-stone-900 mb-2">{t('creator.unlockProAnalytics')}</h2>
                                            <p className="text-stone-500 text-sm leading-relaxed">
                                                {t('creator.unlockProDesc')}
                                            </p>
                                        </div>
                                        <Button size="lg" onClick={() => setShowPremiumModal(true)} className="w-full bg-stone-900 hover:bg-stone-800 shadow-xl">
                                            {t('creator.upgradeToPro')}
                                        </Button>
                                        <p className="text-xs text-stone-400">{t('creator.moneyBackGuarantee')}</p>
                                    </div>
                                </div>
                            )}

                            {/* Charts Layout - Blurred if not premium */}
                            <div className={`space-y-6 transition-all duration-500 ${!creator.isPremium ? 'filter blur-sm opacity-50 pointer-events-none select-none' : ''}`}>
                                
                                {/* 1. Key Metrics Cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/60 hover:shadow-sm transition-all">
                                        <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                                            <div className="p-1 sm:p-1.5 bg-stone-100 text-stone-400 rounded-lg"><Eye size={14}/></div>
                                            <span className="text-[10px] sm:text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{t('creator.views')}</span>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                                            {analyticsData.funnel.find(f => f.name === 'Profile Views')?.count.toLocaleString() || 0}
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/60 hover:shadow-sm transition-all">
                                        <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                                            <div className="p-1 sm:p-1.5 bg-stone-100 text-stone-400 rounded-lg"><MousePointerClick size={14}/></div>
                                            <span className="text-[10px] sm:text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{t('creator.interactions')}</span>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                                            {analyticsData.funnel.find(f => f.name === 'Interactions')?.count.toLocaleString() || 0}
                                        </div>
                                        <div className="text-[10px] sm:text-[11px] text-emerald-600 font-medium mt-1">
                                            {(() => {
                                                const views = analyticsData.funnel.find(f => f.name === 'Profile Views')?.count || 0;
                                                const interactions = analyticsData.funnel.find(f => f.name === 'Interactions')?.count || 0;
                                                return views > 0 ? ((interactions / views) * 100).toFixed(1) : '0.0';
                                            })()}% {t('creator.interactions')}
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/60 hover:shadow-sm transition-all col-span-2 sm:col-span-1">
                                        <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                                            <div className="p-1 sm:p-1.5 bg-stone-100 text-stone-400 rounded-lg"><CheckCircle2 size={14}/></div>
                                            <span className="text-[10px] sm:text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{t('creator.conversions')}</span>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                                            {analyticsData.funnel.find(f => f.name === 'Conversions')?.count.toLocaleString() || 0}
                                        </div>
                                        <div className="text-[10px] sm:text-[11px] text-emerald-600 font-medium mt-1">
                                            {(() => {
                                                const views = analyticsData.funnel.find(f => f.name === 'Profile Views')?.count || 0;
                                                const conversions = analyticsData.funnel.find(f => f.name === 'Conversions')?.count || 0;
                                                return views > 0 ? ((conversions / views) * 100).toFixed(1) : '0.0';
                                            })()}% {t('creator.conversions')}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                                    {/* Traffic Sources */}
                                    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200/60">
                                        <h3 className="text-sm font-bold text-stone-900 mb-1 flex items-center gap-2">
                                            <PieIcon size={14} className="text-stone-400" /> {t('creator.whereVisitors')}
                                        </h3>
                                        <p className="text-xs text-stone-400 mb-4 sm:mb-5">{t('creator.topSourcesDriving')}</p>
                                        <div className="space-y-3.5">
                                            {analyticsData.trafficSources.map((source) => (
                                                <div key={source.name}>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: source.color }} />
                                                            <span className="text-sm font-medium text-stone-700">{source.name}</span>
                                                        </div>
                                                        <span className="text-sm font-bold text-stone-900">{source.value}%</span>
                                                    </div>
                                                    <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-1000"
                                                            style={{ width: `${source.value}%`, backgroundColor: source.color, opacity: 0.8 }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Conversion Funnel */}
                                    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200/60">
                                        <h3 className="text-sm font-bold text-stone-900 mb-1 flex items-center gap-2">
                                            <TrendingUp size={14} className="text-stone-400" /> {t('creator.conversionFunnel')}
                                        </h3>
                                        <p className="text-xs text-stone-400 mb-4 sm:mb-5">{t('creator.visitorJourney')}</p>
                                        <div className="space-y-5">
                                            {analyticsData.funnel.map((step, index) => {
                                                const maxVal = analyticsData.funnel[0].count || 1;
                                                const percent = (step.count / maxVal) * 100;
                                                return (
                                                    <div key={step.name}>
                                                        <div className="flex justify-between items-baseline mb-1.5">
                                                            <span className="text-xs font-medium text-stone-600">{step.name}</span>
                                                            <span className="text-xs font-bold text-stone-900">{step.count.toLocaleString()}</span>
                                                        </div>
                                                        <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full transition-all duration-1000"
                                                                style={{ width: `${percent}%`, backgroundColor: step.fill }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Audience Split */}
                                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200/60">
                                    <h3 className="text-sm font-bold text-stone-900 mb-1 flex items-center gap-2">
                                        <Users size={14} className="text-stone-400" /> {t('creator.audience')}
                                    </h3>
                                    <p className="text-xs text-stone-400 mb-4 sm:mb-5">{t('creator.newVsReturning')}</p>
                                    <div className="flex items-center gap-6">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="h-2 flex-1 bg-stone-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-stone-700 rounded-full transition-all duration-1000" style={{ width: `${analyticsData.audienceType.new}%` }} />
                                                </div>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-stone-700" />
                                                    <span className="text-stone-600">{t('creator.newVisitorsLabel')}</span>
                                                    <span className="font-bold text-stone-900">{analyticsData.audienceType.new}%</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-stone-200" />
                                                    <span className="text-stone-600">{t('creator.returningLabel')}</span>
                                                    <span className="font-bold text-stone-900">{analyticsData.audienceType.returning}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Top Performing Assets */}
                                <div className="bg-white border border-stone-200/60 rounded-2xl shadow-sm overflow-hidden">
                                    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-stone-100 flex items-center gap-2">
                                        <Star size={16} className="text-yellow-500" />
                                        <h3 className="text-sm font-bold text-stone-900">{t('creator.topPerformingContent')}</h3>
                                    </div>
                                    {/* Desktop Table */}
                                    <div className="hidden sm:block overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-stone-50 text-stone-500 font-bold border-b border-stone-100 text-xs uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-6 py-3">{t('creator.asset')}</th>
                                                    <th className="px-6 py-3">{t('creator.type')}</th>
                                                    <th className="px-6 py-3 text-right">{t('creator.clicks')}</th>
                                                    <th className="px-6 py-3 text-right">{t('creator.ctr')}</th>
                                                    <th className="px-6 py-3 text-right">{t('creator.revenue')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-100">
                                                {analyticsData.topAssets.map((asset) => (
                                                    <tr key={asset.id} className="hover:bg-stone-50 transition-colors">
                                                        <td className="px-6 py-4 font-bold text-stone-700">{asset.title}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${asset.type === 'PRODUCT' ? 'bg-purple-100 text-purple-700' : 'bg-stone-100 text-stone-600'}`}>
                                                                {asset.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-stone-600 font-mono">{asset.clicks.toLocaleString()}</td>
                                                        <td className="px-6 py-4 text-right font-semibold text-stone-900">{asset.ctr}</td>
                                                        <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">
                                                            {asset.revenue > 0 ? `${asset.revenue}` : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {/* Mobile Card View */}
                                    <div className="sm:hidden divide-y divide-stone-100">
                                        {analyticsData.topAssets.map((asset) => (
                                            <div key={asset.id} className="p-4 flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${asset.type === 'PRODUCT' ? 'bg-purple-100 text-purple-600' : 'bg-stone-100 text-stone-500'}`}>
                                                    {asset.type === 'PRODUCT' ? <ShoppingBag size={18}/> : <ExternalLink size={18}/>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-stone-800 text-sm truncate">{asset.title}</div>
                                                    <div className="text-[10px] text-stone-400 flex items-center gap-2 mt-0.5">
                                                        <span>{asset.clicks.toLocaleString()} {t('creator.clicks').toLowerCase()}</span>
                                                        <span>·</span>
                                                        <span>{asset.ctr} {t('creator.ctr')}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <div className="font-mono font-bold text-emerald-600 text-sm">{asset.revenue > 0 ? asset.revenue : '-'}</div>
                                                    <div className="text-[10px] text-stone-400">{t('common.credits').toLowerCase()}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {currentView === 'INBOX' && (
                <div className="h-full flex flex-col bg-[#FAF9F6] animate-in fade-in">
                    {/* Header Row */}
                    <div className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0">
                                <Menu size={24} />
                            </button>
                            <h2 className="text-xl sm:text-2xl font-bold text-stone-900">{t('creator.inbox')}</h2>
                        </div>
                        <TopNav hideBurger />
                    </div>
                    <div className="flex flex-1 min-h-0 overflow-x-hidden">
                    {/* List Column */}
                    <div className={`w-full md:w-80 lg:w-96 border-r border-stone-200/60 flex flex-col bg-white ${selectedSenderEmail ? 'hidden md:flex' : 'flex'}`}>
                        <div className="p-3 border-b border-stone-100 space-y-2">
                            <div className="flex flex-wrap gap-1 bg-stone-100/60 p-1 rounded-lg">
                                {(['ALL', 'PENDING', 'REPLIED', 'REJECTED'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setInboxFilter(f)}
                                        className={`flex-1 px-2 py-1.5 text-[10px] font-semibold rounded transition-all whitespace-nowrap ${inboxFilter === f ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-stone-400 font-medium">Sort:</span>
                                <div className="flex gap-1 bg-stone-100/60 p-0.5 rounded-md">
                                    <button
                                        onClick={() => setInboxSortOrder('LATEST')}
                                        className={`px-2 py-1 text-[10px] font-semibold rounded transition-all ${inboxSortOrder === 'LATEST' ? 'bg-stone-300 text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}
                                    >
                                        Latest
                                    </button>
                                    <button
                                        onClick={() => setInboxSortOrder('COUNT')}
                                        className={`px-2 py-1 text-[10px] font-semibold rounded transition-all flex items-center gap-0.5 ${inboxSortOrder === 'COUNT' ? 'bg-stone-300 text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}
                                    >
                                        <Coins size={9} /> Sessions
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="p-8 text-center text-sm text-stone-400">{t('common.loading')}</div>
                            ) : filteredGroups.length === 0 ? (
                                <div className="p-8 text-center text-sm text-stone-400">{t('creator.noMessagesFound')}</div>
                            ) : (
                                filteredGroups.map(group => {
                                    const isActive = selectedSenderEmail === group.senderEmail;
                                    const latestMsg = group.latestMessage;
                                    const timeLeft = getTimeLeft(latestMsg.expiresAt);
                                    // Check unread based on role
                                    const isUnread = incomingMessages.some(m => {
                                        if (m.senderEmail !== group.senderEmail) return false;
                                        if (m.isRead) return false;
                                        const lastMsg = m.conversation[m.conversation.length - 1];
                                        return !lastMsg || lastMsg.role === 'FAN';
                                    });
                                    
                                    return (
                                        <div 
                                            key={group.senderEmail}
                                            onClick={() => handleOpenChat(group.senderEmail)}
                                            className={`p-4 border-b border-stone-100/80 cursor-pointer hover:bg-stone-50/50 transition-colors ${isActive ? 'bg-stone-50/70 border-l-2 border-l-stone-900' : 'border-l-2 border-l-transparent'}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`text-sm font-semibold ${isUnread ? 'text-stone-900' : 'text-stone-600'}`}>
                                                    <ResponsiveName name={group.senderName} />
                                                    {isUnread && <span className="inline-block w-2 h-2 bg-stone-900 rounded-full ml-2"></span>}
                                                </span>
                                                <span className="text-xs text-stone-400">{new Date(latestMsg.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-stone-500 line-clamp-2 mb-2">{latestMsg.content}</p>
                                            <div className="flex items-center justify-between">
                                                {latestMsg.status === 'PENDING' ? (
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${timeLeft.bg} ${timeLeft.color}`}>{timeLeft.text}</span>
                                                ) : latestMsg.status === 'REPLIED' ? (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">REPLIED</span>
                                                ) : (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">{latestMsg.status === 'EXPIRED' ? 'EXPIRED' : 'CANCELLED'}</span>
                                                )}
                                                <span className="text-xs font-mono font-medium text-stone-700 flex items-center gap-1"><Coins size={10}/> {group.messageCount}</span>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                    
                    {/* Detail Column */}
                    <div className={`flex-1 flex flex-col bg-[#FAF9F6] ${!selectedSenderEmail ? 'hidden md:flex' : 'flex'}`}>
                        {!activeMessage ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-stone-400">
                                {/* Celebration Overlay (Reused from FanDashboard logic but triggered on Collect) */}
                                {showReadCelebration && (
                                    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
                                        {sprinkles.map((s: any) => (
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
                                <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                                    <Users size={32} className="text-stone-300" />
                                </div>
                                <p className="text-sm font-medium">{t('creator.selectMessage')}</p>
                            </div>
                        ) : (
                             <div className="h-full flex flex-col bg-[#FAF9F6] relative overflow-hidden">
                                {/* Celebration Overlay (Inside Chat View) */}
                                {showReadCelebration && (
                                    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
                                        {sprinkles.map((s: any) => (
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
                                {/* Collection Animation Overlay */}
                                {showCollectAnimation && (
                                    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                                        <style>{`
                                            @keyframes cd-sketch { to { stroke-dashoffset: 0; } }
                                            @keyframes cd-pop { from { opacity: 0; transform: translateY(12px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
                                        `}</style>
                                        <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-stone-100 px-8 py-6 flex flex-col items-center gap-3 animate-in zoom-in-95 fade-in duration-300">
                                            {/* Sketch coin/checkmark illustration */}
                                            <svg viewBox="0 0 120 100" width="120" height="100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                {/* Coin stack */}
                                                <ellipse cx="60" cy="72" rx="26" ry="8" stroke="#1c1917" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.4s ease forwards 0.1s' }} />
                                                <rect x="34" y="52" width="52" height="20" rx="2" stroke="#1c1917" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.4s ease forwards 0.2s' }} />
                                                <ellipse cx="60" cy="52" rx="26" ry="8" stroke="#1c1917" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.4s ease forwards 0.3s' }} />
                                                <rect x="34" y="34" width="52" height="20" rx="2" stroke="#1c1917" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.4s ease forwards 0.4s' }} />
                                                <ellipse cx="60" cy="34" rx="26" ry="8" stroke="#1c1917" strokeWidth="2" fill="#f5f0eb" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.4s ease forwards 0.5s' }} />
                                                {/* Sparkle lines */}
                                                <line x1="96" y1="18" x2="103" y2="11" stroke="#10b981" strokeWidth="2" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.3s ease forwards 0.7s' }} />
                                                <line x1="100" y1="30" x2="108" y2="28" stroke="#10b981" strokeWidth="2" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.3s ease forwards 0.8s' }} />
                                                <line x1="90" y1="10" x2="90" y2="4" stroke="#10b981" strokeWidth="2" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.3s ease forwards 0.9s' }} />
                                                {/* Check */}
                                                <path d="M50 34 L57 41 L72 26" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.4s ease forwards 0.6s' }} />
                                            </svg>
                                            <div style={{ animation: 'cd-pop 0.4s ease forwards 0.9s', opacity: 0 }}>
                                                <p className="text-base font-bold text-stone-900">{t('creator.creditsCollected')}</p>
                                                <p className="text-2xl font-black text-emerald-600 text-center">+{collectedAmount}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Withdraw Success Animation */}
                                {showWithdrawAnimation && (
                                    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                                        <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-stone-100 px-8 py-6 flex flex-col items-center gap-3 animate-in zoom-in-95 fade-in duration-300">
                                            <svg viewBox="0 0 120 100" width="120" height="100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                {/* Wallet outline */}
                                                <rect x="20" y="30" width="80" height="50" rx="6" stroke="#1c1917" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.5s ease forwards 0.1s' }} />
                                                <rect x="72" y="47" width="28" height="18" rx="4" stroke="#1c1917" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.4s ease forwards 0.3s' }} />
                                                <circle cx="82" cy="56" r="4" stroke="#1c1917" strokeWidth="1.5" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.3s ease forwards 0.5s' }} />
                                                <line x1="20" y1="43" x2="100" y2="43" stroke="#1c1917" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.4s ease forwards 0.2s' }} />
                                                {/* Arrow up (withdraw) */}
                                                <line x1="44" y1="22" x2="44" y2="8" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.3s ease forwards 0.6s' }} />
                                                <polyline points="38,15 44,8 50,15" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.3s ease forwards 0.7s' }} />
                                                {/* Sparkles */}
                                                <line x1="90" y1="18" x2="97" y2="11" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.3s ease forwards 0.8s' }} />
                                                <line x1="95" y1="25" x2="103" y2="23" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.3s ease forwards 0.9s' }} />
                                            </svg>
                                            <div style={{ animation: 'cd-pop 0.4s ease forwards 1s', opacity: 0 }}>
                                                <p className="text-base font-bold text-stone-900">Withdrawal Requested!</p>
                                                <p className="text-2xl font-black text-indigo-600 text-center">${withdrawnAmount.toFixed(2)}</p>
                                                <p className="text-xs text-stone-400 text-center mt-0.5">will be sent to your Stripe account</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Stripe Connect Success Animation */}
                                {showStripeAnimation && (
                                    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                                        <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-stone-100 px-8 py-6 flex flex-col items-center gap-3 animate-in zoom-in-95 fade-in duration-300">
                                            <svg viewBox="0 0 120 100" width="120" height="100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                {/* Credit card */}
                                                <rect x="18" y="25" width="84" height="55" rx="8" stroke="#635BFF" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.5s ease forwards 0.1s' }} />
                                                <line x1="18" y1="42" x2="102" y2="42" stroke="#635BFF" strokeWidth="3" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.4s ease forwards 0.2s' }} />
                                                <rect x="28" y="52" width="20" height="8" rx="3" stroke="#635BFF" strokeWidth="1.5" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.3s ease forwards 0.4s' }} />
                                                {/* Big checkmark */}
                                                <circle cx="84" cy="35" r="14" stroke="#10b981" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.5s ease forwards 0.5s' }} />
                                                <path d="M77 35 L82 40 L92 28" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.4s ease forwards 0.8s' }} />
                                                {/* Sparkles */}
                                                <line x1="20" y1="14" x2="26" y2="8" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.3s ease forwards 1s' }} />
                                                <line x1="14" y1="20" x2="8" y2="20" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'cd-sketch 0.3s ease forwards 1.1s' }} />
                                            </svg>
                                            <div style={{ animation: 'cd-pop 0.4s ease forwards 1.2s', opacity: 0 }}>
                                                <p className="text-base font-bold text-stone-900">Stripe Connected!</p>
                                                <p className="text-sm text-stone-400 text-center">You're ready to receive payouts</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Header & Chat Content */}
                                <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-stone-200/60 flex items-center justify-between bg-white sticky top-0 z-10 gap-2">
                                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                                        <button onClick={() => setSelectedSenderEmail(null)} className="md:hidden p-2 -ml-2 hover:bg-stone-50 rounded-full text-stone-400 hover:text-stone-700 flex-shrink-0">
                                            <ChevronLeft size={20} />
                                        </button>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <h3 className="font-bold text-stone-900 truncate"><ResponsiveName name={activeMessage.senderName} /></h3>
                                                {activeMessage.status === 'PENDING' && (
                                                    <button 
                                                        onClick={(e) => handleReject(e)}
                                                        disabled={isRejecting}
                                                        className="p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                        title={t('creator.rejectRefund')}
                                                    >
                                                        <Ban size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="text-xs text-stone-500 flex items-center gap-2">
                                                <span className="font-mono font-medium flex items-center gap-1"><Coins size={10}/> {activeMessage.amount}</span>
                                                <span className="w-1 h-1 bg-stone-300 rounded-full"></span>
                                                <span>{new Date(activeMessage.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {activeMessage.status === 'PENDING' && (() => {
                                            const tl = getTimeLeft(activeMessage.expiresAt);
                                            return (
                                                <>
                                                    <div ref={(el) => { inboxTutorialRefs.current[0] = el; }} className={showInboxTutorial && inboxTutorialStep === 0 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-full' : ''}>
                                                        <div className={`text-[10px] sm:text-xs font-semibold ${tl.color} ${tl.bg} px-2 sm:px-3 py-1 sm:py-1.5 rounded-full flex items-center gap-1 border ${tl.border} whitespace-nowrap`}>
                                                            <Clock size={12} className={tl.iconColor} /> {tl.text}
                                                        </div>
                                                    </div>
                                                    <div ref={(el) => { inboxTutorialRefs.current[3] = el; }} className={showInboxTutorial && inboxTutorialStep === 3 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-full' : ''}>
                                                        <button
                                                            onClick={() => handleSendReply(true)}
                                                            disabled={((!replyText.trim() && replyAttachments.length === 0) && !hasManualCreatorReply) || isSendingReply || isRejecting}
                                                            className="h-7 px-3 rounded-full bg-stone-900 text-white hover:bg-stone-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 font-semibold text-[10px] sm:text-xs group whitespace-nowrap"
                                                            title="Complete & Collect"
                                                        >
                                                            <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                                                            <span>Collect {activeMessage.amount}</span>
                                                        </button>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                        {activeMessage.status === 'REPLIED' && (
                                            <div className="text-[10px] sm:text-xs font-bold text-emerald-600 bg-emerald-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full flex items-center gap-1 border border-emerald-100 whitespace-nowrap">
                                                <CheckCircle2 size={12} /> {t('creator.completed')}
                                            </div>
                                        )}
                                        {(activeMessage.status === 'EXPIRED' || activeMessage.status === 'CANCELLED') && (
                                            <div className="text-[10px] sm:text-xs font-bold text-stone-500 bg-stone-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-stone-200 whitespace-nowrap">
                                                {t('creator.refunded')}
                                            </div>
                                        )}
                                        <div ref={(el) => { inboxTutorialRefs.current[4] = el; }} className={showInboxTutorial && inboxTutorialStep === 4 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-lg' : ''}>
                                            <button
                                                onClick={() => leaveChatroom(activeMessage.senderEmail)}
                                                className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title={t('creator.leaveConversationTitle')}
                                            >
                                                <LogOut size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto bg-white" ref={scrollRef}>
                                    {/* Session Pagination - full width */}
                                    {threadMessages.length > 0 && (
                                        <div className="flex items-center justify-between px-4 py-2 bg-stone-50 border-b border-stone-100 sticky top-0 z-30">
                                            <button
                                                onClick={() => setChatSessionIndex(effectiveSessionIndex - 1)}
                                                disabled={effectiveSessionIndex <= 0}
                                                className="p-1.5 rounded-full hover:bg-stone-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <ChevronLeft size={16} className="text-stone-600" />
                                            </button>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                                                    {t('creator.sessionOf', { current: effectiveSessionIndex + 1, total: threadMessages.length }) || `Session ${effectiveSessionIndex + 1} of ${threadMessages.length}`}
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
                                    <div className="pt-3 max-w-lg mx-auto px-1">
                                    {threadMessages.slice(effectiveSessionIndex, effectiveSessionIndex + 1).map((msg) => {
                                        const isPending = msg.status === 'PENDING';
                                        const isRefunded = msg.status === 'EXPIRED' || msg.status === 'CANCELLED';

                                        // Sort conversation by timestamp
                                        const sortedConversation = [...msg.conversation].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                                        const [firstChat, ...restChats] = sortedConversation;

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
                                                        <div className={`w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ${msg.senderAvatarUrl ? 'cursor-pointer' : ''}`} onClick={() => msg.senderAvatarUrl && setEnlargedImage(msg.senderAvatarUrl)}>
                                                            {msg.senderAvatarUrl ? (
                                                                <img src={msg.senderAvatarUrl} alt={msg.senderName} className="w-full h-full object-cover" />
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
                                                                <span className="font-semibold text-sm text-stone-900"><ResponsiveName name={msg.senderName} /></span>
                                                                <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                                                    <User size={10} className="fill-current" />
                                                                    <span className="text-[9px] font-semibold uppercase tracking-wide">{t('common.fan')}</span>
                                                                </div>
                                                                <span className="text-xs font-medium text-stone-400">• {new Date(firstChat.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                                                            </div>
                                                        </div>

                                                        <div className="bg-white p-3 sm:p-4 rounded-2xl rounded-tl-lg border border-stone-200/60">

                                            {/* Content */}
                                            <div>
                                                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed break-words">{firstChat.content}</p>

                                                {/* Attachments */}
                                                {msg.attachmentUrl && (() => {
                                                    const allUrls = msg.attachmentUrl.split('|||');
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
                                                    <span className="text-[10px] text-stone-400"><ResponsiveName name={creator.displayName || 'You'} /></span>
                                                )}
                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                )}

                                                {/* 2. Subsequent Messages (Replies & Appreciation) */}
                                                {restChats.map((chat, idx) => {
                                                    const isCreator = chat.role === 'CREATOR';
                                                    const isLast = idx === restChats.length - 1;
                                                    const showLine = !isLast;

                                                    return (
                                                    <div key={chat.id} className="flex mt-4 relative z-10">
                                                        {/* Left: Avatar + Thread Line */}
                                                        <div className="flex flex-col items-center mr-3 relative">
                                                            {showLine && (
                                                                <div className="absolute left-[17px] top-11 -bottom-1 w-0.5 bg-stone-200"></div>
                                                            )}
                                                            <div className={`w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ${(isCreator ? creator.avatarUrl : msg.senderAvatarUrl) ? 'cursor-pointer' : ''}`} onClick={() => { const url = isCreator ? creator.avatarUrl : msg.senderAvatarUrl; if (url) setEnlargedImage(url); }}>
                                                                {isCreator ? (
                                                                    creator.avatarUrl ? (
                                                                        <img src={creator.avatarUrl} alt={creator.displayName} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full bg-stone-100 flex items-center justify-center"><Verified size={22} /></div>
                                                                    )
                                                                ) : (
                                                                    msg.senderAvatarUrl ? (
                                                                        <img src={msg.senderAvatarUrl} alt={msg.senderName} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full bg-stone-200 flex items-center justify-center"><User size={16} className="text-stone-500" /></div>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Right: Content */}
                                                        <div className="flex-1 min-w-0 pb-2">
                                                            <div className="flex items-center justify-between mb-2 ml-1">
                                                                <div className="flex items-center gap-2">
                                                                        <span className="font-semibold text-sm text-stone-900">
                                                                            {isCreator ? (creator.displayName || 'You') : msg.senderName}
                                                                        </span>
                                                                        {isCreator ? (
                                                                            <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full overflow-visible">
                                                                                <Verified size={12} />
                                                                                <span className="text-[9px] font-semibold uppercase tracking-wide">{t('common.creator')}</span>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                                                                <User size={10} className="fill-current" />
                                                                                <span className="text-[9px] font-semibold uppercase tracking-wide">{t('common.fan')}</span>
                                                                            </div>
                                                                        )}
                                                                        <span className="text-xs font-medium text-stone-400">• {new Date(chat.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                                                                    </div>
                                                                </div>

                                                            <div className={`${isCreator ? 'bg-stone-50' : 'bg-white'} p-3 sm:p-4 rounded-2xl rounded-tl-lg border border-stone-200/60`}>
                                                                {/* Content */}
                                                                {editingChatId === chat.id ? (
                                                                    <div className="space-y-3">
                                                                        <textarea
                                                                            value={editContent}
                                                                            onChange={(e) => setEditContent(e.target.value)}
                                                                            className="w-full text-sm text-stone-700 leading-relaxed bg-white border border-stone-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-stone-400"
                                                                            rows={3}
                                                                            autoFocus
                                                                        />
                                                                        {/* Edit attachment preview */}
                                                                        {editAttachment && (
                                                                            <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg border border-stone-200">
                                                                                {editAttachment.toLowerCase().endsWith('.pdf') ? (
                                                                                    <FileText size={16} className="text-stone-400 flex-shrink-0" />
                                                                                ) : (
                                                                                    <img src={editAttachment} className="w-10 h-10 rounded object-cover flex-shrink-0" alt="" />
                                                                                )}
                                                                                <span className="text-xs text-stone-500 truncate flex-1">{editAttachment.split('/').pop()}</span>
                                                                                <button onClick={() => setEditAttachment(null)} className="p-1 text-stone-400 hover:text-stone-600 transition-colors"><X size={14} /></button>
                                                                            </div>
                                                                        )}
                                                                        <div className="flex items-center gap-2 justify-between">
                                                                            <div className="flex items-center gap-1">
                                                                                <button
                                                                                    onClick={() => editFileInputRef.current?.click()}
                                                                                    disabled={isUploadingEditAttachment}
                                                                                    className="p-2 text-stone-400 hover:text-stone-600 transition-colors rounded-lg hover:bg-stone-100"
                                                                                    title={editAttachment ? 'Replace file' : 'Attach file'}
                                                                                >
                                                                                    {isUploadingEditAttachment ? <div className="w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" /> : <Paperclip size={14} />}
                                                                                </button>
                                                                                <input type="file" ref={editFileInputRef} className="hidden" onChange={handleEditFileChange} />
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <button onClick={() => { setEditingChatId(null); setEditContent(''); setEditAttachment(undefined); }} className="text-xs text-stone-400 hover:text-stone-600 px-3 py-1.5 rounded-lg transition-colors">{t('common.cancel')}</button>
                                                                                <button onClick={() => handleDeleteChat(chat.id, msg.id)} className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg transition-colors">Delete</button>
                                                                                <button onClick={() => handleEditChat(chat.id, msg.id)} disabled={isUploadingEditAttachment} className="text-xs text-white bg-stone-900 hover:bg-stone-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">{t('common.save')}</button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <p className="text-xs sm:text-sm text-stone-700 leading-relaxed break-words">{chat.content}</p>
                                                                        {chat.isEdited && <span className="text-[10px] text-stone-400 mt-1 block">edited</span>}
                                                                    </>
                                                                )}

                                                                {/* Attachments (shown when NOT editing) */}
                                                                {editingChatId !== chat.id && chat.attachmentUrl && (() => {
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
                                                                    <span className="text-[10px] text-stone-400"><ResponsiveName name={creator.displayName || 'You'} /></span>
                                                                )}
                                                                {isCreator && editingChatId !== chat.id && msg.status !== 'REPLIED' && (
                                                                    <button
                                                                        onClick={() => { setEditingChatId(chat.id); setEditContent(chat.content); setEditAttachment(chat.attachmentUrl || null); }}
                                                                        className="ml-auto p-2 text-stone-300 hover:text-stone-500 transition-colors"
                                                                        title="Edit message"
                                                                    >
                                                                        <Pencil size={13} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    );
                                                })}

                                                {/* Waiting indicator */}
                                                {isPending && sortedConversation[sortedConversation.length - 1]?.role === 'FAN' && (
                                                    <div className="flex mt-4 relative z-10">
                                                        <div className="flex flex-col items-center mr-3">
                                                            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-dashed border-stone-300">
                                                                {creator.avatarUrl ? (
                                                                    <img src={creator.avatarUrl} alt={creator.displayName} className="w-full h-full object-cover opacity-30" />
                                                                ) : (
                                                                    <div className="w-full h-full bg-stone-50 flex items-center justify-center">
                                                                        <User size={16} className="text-stone-300" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 flex items-center">
                                                            <span className="text-[15px] text-stone-400">Reply to thread...</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Status indicator */}
                                                {msg.status === 'REPLIED' && (
                                                    <div className="mt-5 mx-auto max-w-[260px]">
                                                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/60 rounded-xl p-3 shadow-sm">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="bg-emerald-500 p-1 rounded-full">
                                                                        <Check size={10} className="text-white stroke-[3px]" />
                                                                    </div>
                                                                    <span className="text-xs font-semibold text-emerald-700">{t('creator.creditsCollected')}</span>
                                                                </div>
                                                                <span className="text-sm font-bold text-emerald-600 font-mono">+{msg.amount}</span>
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
                                                                <span className="text-xs font-semibold text-red-500">{t('creator.refunded')}</span>
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
                                                                <span className="text-xs font-semibold text-stone-500">{t('creator.refunded')}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    <div className="h-4"></div>
                                    </div>
                                </div>

                                {/* Reply Input Area */}
                                {activeMessage.status === 'PENDING' && (
                                    <div className="p-3 sm:p-4 bg-white border-t border-stone-200/60 z-20">
                                        <div className="flex items-center mb-3 gap-2">
                                            <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 font-medium whitespace-nowrap text-[10px] sm:text-xs">
                                                <Coins size={12} className="flex-shrink-0" /> <span className="hidden sm:inline">Payment held in </span>escrow
                                            </span>
                                            <div ref={(el) => { inboxTutorialRefs.current[2] = el; }} className={showInboxTutorial && inboxTutorialStep === 2 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-full' : ''}>
                                                <button
                                                    onClick={() => replyFileInputRef.current?.click()}
                                                    disabled={isUploadingReplyAttachment || replyAttachments.length >= 3}
                                                    className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors disabled:opacity-30"
                                                    title={replyAttachments.length >= 3 ? 'Max 3 photos' : 'Attach photos (max 3)'}
                                                >
                                                    {isUploadingReplyAttachment ? <div className="w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" /> : <Paperclip size={16} />}
                                                </button>
                                            </div>
                                            <input type="file" ref={replyFileInputRef} className="hidden" accept="image/*" multiple onChange={handleReplyFileChange} />
                                        </div>

                                        {replyAttachments.length > 0 && (
                                            <div className="mb-2 flex flex-wrap gap-2">
                                                {replyAttachments.map((att, i) => (
                                                    <div key={i} className="flex items-center gap-2 bg-stone-50 p-1.5 rounded-lg border border-stone-200 animate-in zoom-in duration-200">
                                                        {isImage(att) ? (
                                                            <img src={att} className="w-10 h-10 rounded object-cover" alt={`attachment ${i + 1}`} />
                                                        ) : (
                                                            <div className="w-10 h-10 bg-white rounded flex items-center justify-center text-stone-500 border border-stone-100">
                                                                <Paperclip size={14} />
                                                            </div>
                                                        )}
                                                        <button onClick={() => setReplyAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-stone-400 hover:text-red-500 p-1 hover:bg-stone-100 rounded transition-colors">
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                                {replyAttachments.length < 3 && (
                                                    <span className="text-[10px] text-stone-400 self-center">{replyAttachments.length}/3</span>
                                                )}
                                            </div>
                                        )}

                                        <textarea
                                            value={replyText}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendReply(false);
                                                }
                                            }}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            placeholder="Write your reply..."
                                            className="w-full bg-stone-50/50 border border-stone-200/60 rounded-xl p-3 text-sm focus:ring-1 focus:ring-stone-400 focus:border-stone-300 outline-none resize-none min-h-[100px] text-stone-900 placeholder:text-stone-400"
                                        />

                                        <div className="flex justify-end mt-2">
                                            <div ref={(el) => { inboxTutorialRefs.current[1] = el; }} className={showInboxTutorial && inboxTutorialStep === 1 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-full' : ''}>
                                                <button
                                                    onClick={() => handleSendReply(false)}
                                                    disabled={(!replyText.trim() && replyAttachments.length === 0) || isSendingReply || isRejecting}
                                                    className="h-9 px-4 rounded-full bg-stone-600 text-white hover:bg-stone-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold text-xs"
                                                    title="Send reply (Keep Pending)"
                                                >
                                                    Send <Send size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                             </div>
                        )}
                    </div>
                </div>
                </div>
            )}

            {/* --- VIEW: SETTINGS (Profile) --- */}
            {currentView === 'SETTINGS' && (
                <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0"><Menu size={24} /></button>
                            <h2 className="text-xl sm:text-2xl font-bold text-stone-900">{t('creator.profileSettings')}</h2>
                        </div>
                        <TopNav hideBurger />
                    </div>
                    {/* ... (Existing Settings Code) ... */}
                    {/* Magical Success Message */}
                    {showSaveSuccess && (
                        <div className="fixed bottom-8 right-8 z-[60] max-w-sm animate-in slide-in-from-bottom-4">
                            <div className="relative overflow-hidden bg-stone-900 rounded-2xl p-5 text-center shadow-xl ring-1 ring-white/10">
                                {/* Background Particles */}
                                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-40">
                                    <div className="absolute top-[10%] left-[20%] text-white animate-float text-xs">✦</div>
                                    <div className="absolute top-[40%] right-[30%] text-white animate-pulse text-xs">✨</div>
                                </div>
                                
                                <div className="relative z-10 flex items-center gap-3 justify-center">
                                    <div className="bg-white/20 backdrop-blur-md p-2 rounded-full shadow-inner border border-white/40">
                                        <Check size={20} className="text-white stroke-[3px]" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-black text-white text-lg tracking-tight leading-none mb-0.5 drop-shadow-sm">Profile Saved!</h3>
                                        <p className="text-white/80 font-medium text-xs">Your changes are live.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Pro Banner in Settings */}
                    {!creator.isPremium && (
                         <div className="bg-stone-900 rounded-xl p-4 sm:p-6 text-white flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                            <div>
                                <h3 className="font-bold text-base sm:text-lg flex items-center gap-2"><Sparkles className="text-yellow-300 fill-yellow-300" size={18}/> Diem Pro</h3>
                                <p className="text-stone-400 text-xs sm:text-sm mt-1">Upgrade to unlock analytics and remove commissions.</p>
                            </div>
                            <button onClick={() => setShowPremiumModal(true)} className="px-5 py-2 bg-white text-stone-900 hover:bg-stone-100 font-semibold text-sm rounded-xl whitespace-nowrap flex-shrink-0 transition-colors">Upgrade</button>
                        </div>
                    )}

                    <div className="bg-white p-6 rounded-xl border border-stone-200">
                        <h3 className="text-lg font-bold text-stone-900 mb-6 border-b border-stone-100 pb-2">Profile Settings</h3>
                        
                        <div className="space-y-6">
                            {/* ... Profile Settings Form (Unchanged) ... */}
                            {/* Avatar Edit */}
                            <div className="flex items-start gap-4 sm:gap-6">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-stone-100 flex-shrink-0 overflow-hidden border border-stone-200">
                                    <img
                                        src={editedCreator.avatarUrl || DEFAULT_AVATAR}
                                        alt="Avatar Preview"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.src = DEFAULT_AVATAR;
                                        }}
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Profile Photo</label>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        {editedCreator.avatarUrl ? (
                                            <div className="flex items-center gap-2 w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50 text-stone-500 text-sm min-w-0">
                                                <span className="truncate flex-1">
                                                    {avatarFileName || (editedCreator.avatarUrl.startsWith('data:') ? "Uploaded Image" : "Current Photo")}
                                                </span>
                                                <button onClick={() => { setEditedCreator({...editedCreator, avatarUrl: ''}); setAvatarFileName(''); }} className="text-red-500 hover:text-red-700 flex-shrink-0"><X size={14}/></button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50 text-stone-400 text-sm italic">
                                                No image selected
                                            </div>
                                        )}
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap flex-shrink-0"
                                        >
                                            <Camera size={16} /> Upload
                                        </button>
                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarFileChange} />
                                    </div>
                                    <p className="text-[10px] text-stone-400 mt-1">Upload from desktop.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Display Name</label>
                                <input 
                                    type="text" 
                                    value={editedCreator.displayName}
                                    onChange={e => setEditedCreator({...editedCreator, displayName: e.target.value})}
                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">User ID (Handle)</label>
                                <input 
                                    type="text" 
                                    value={editedCreator.handle}
                                    onChange={e => setEditedCreator({...editedCreator, handle: e.target.value})}
                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none"
                                />
                                <p className="text-[10px] text-stone-400 mt-1">
                                    Your public page: <span className="font-mono text-stone-600">{window.location.host}/{editedCreator.handle?.replace('@', '')}</span>
                                </p>
                            </div>
                            {/* Bio / Instructions / Auto-Reply tab switcher */}
                            <div className={showTutorial && tutorialStep <= 2 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-xl p-1 -m-1' : ''}>
                                <div className="flex bg-stone-100 rounded-xl p-1 mb-3 gap-0.5">
                                    {[
                                        { key: 'bio', label: 'Bio / About' },
                                        { key: 'instructions', label: 'Request Instructions' },
                                        { key: 'reply', label: 'Auto-Reply' },
                                    ].map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setSettingsTextTab(tab.key as typeof settingsTextTab)}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${settingsTextTab === tab.key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                {settingsTextTab === 'bio' && (
                                    <textarea
                                        value={editedCreator.bio}
                                        onChange={e => setEditedCreator({...editedCreator, bio: e.target.value})}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none h-28 resize-none"
                                        placeholder="Tell fans about yourself..."
                                    />
                                )}
                                {settingsTextTab === 'instructions' && (
                                    <>
                                        <textarea
                                            value={editedCreator.intakeInstructions || ''}
                                            onChange={e => setEditedCreator({...editedCreator, intakeInstructions: e.target.value})}
                                            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none h-28 resize-none"
                                            placeholder="Please be as detailed as possible so I can give you the best answer."
                                        />
                                        <p className="text-[10px] text-stone-400 mt-1">This is shown to fans before they send a request.</p>
                                    </>
                                )}
                                {settingsTextTab === 'reply' && (
                                    <>
                                        <textarea
                                            value={editedCreator.welcomeMessage || ''}
                                            onChange={e => setEditedCreator({...editedCreator, welcomeMessage: e.target.value})}
                                            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none h-28 resize-none"
                                            placeholder="Hi! Thanks for your message. I'll get back to you soon..."
                                        />
                                        <p className="text-[10px] text-stone-400 mt-1">This is sent automatically when a fan pays.</p>
                                    </>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Price (Credits)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500"><Coins size={14}/></span>
                                        <input 
                                            type="number" 
                                            value={editedCreator.pricePerMessage}
                                            onChange={e => setEditedCreator({...editedCreator, pricePerMessage: Number(e.target.value)})}
                                            className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Response Time</label>
                                    <select 
                                        value={editedCreator.responseWindowHours}
                                        onChange={e => setEditedCreator({...editedCreator, responseWindowHours: Number(e.target.value)})}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white focus:ring-1 focus:ring-stone-400 outline-none"
                                    >
                                        <option value={24}>24 Hours</option>
                                        <option value={48}>48 Hours</option>
                                        <option value={72}>72 Hours</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Connected Platforms</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {SUPPORTED_PLATFORMS.map(platform => {
                                        const platformData = editedCreator.platforms?.find(p => (typeof p === 'string' ? p : p.id) === platform.id);
                                        const isSelected = !!platformData;
                                        const url = typeof platformData === 'object' ? platformData.url : '';

                                        return (
                                            <button 
                                                key={platform.id}
                                                onClick={() => handleTogglePlatform(platform.id)}
                                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-left ${
                                                    isSelected 
                                                    ? 'bg-stone-900 text-white border-stone-900 shadow-md' 
                                                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                                                }`}
                                            >
                                                <platform.icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-stone-400'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-xs font-bold block">{platform.label}</span>
                                                    {isSelected && url && (
                                                        <span className="text-[9px] text-stone-300 truncate block">{url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                                                    )}
                                                </div>
                                                {isSelected && <Check size={12} className="ml-auto text-green-400 flex-shrink-0" />}
                                            </button>
                                        )
                                    })}
                                </div>
                                <p className="text-[10px] text-stone-400 mt-2">These icons will appear on your public profile.</p>
                            </div>
                            
                            {/* DIEM Request Highlight Toggle */}
                            <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${editedCreator.isDiemHighlighted ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-stone-400 border border-stone-200'}`}>
                                        <Sparkles size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-stone-800">Highlight DIEM Request</p>
                                        <p className="text-xs text-stone-400">Makes your request section stand out on your profile</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditedCreator({ ...editedCreator, isDiemHighlighted: !editedCreator.isDiemHighlighted })}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${editedCreator.isDiemHighlighted ? 'bg-indigo-500' : 'bg-stone-200'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${editedCreator.isDiemHighlighted ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {/* DIEM Button Color */}
                            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                <p className="text-sm font-semibold text-stone-800 mb-1">DIEM Button Color</p>
                                <p className="text-xs text-stone-400 mb-3">Choose the color of the "Diem" button on your public profile</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {['#1c1917','#6366f1','#8b5cf6','#ec4899','#10b981','#0ea5e9','#f59e0b','#ef4444'].map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setEditedCreator({ ...editedCreator, diemButtonColor: editedCreator.diemButtonColor === color ? undefined : color })}
                                            className="w-6 h-6 rounded-full transition-all flex-shrink-0"
                                            style={{ backgroundColor: color, outline: editedCreator.diemButtonColor === color ? `2px solid ${color}` : '2px solid transparent', outlineOffset: '2px' }}
                                        />
                                    ))}
                                    <label className="relative w-6 h-6 rounded-full border border-dashed border-stone-300 cursor-pointer flex items-center justify-center hover:border-stone-500 transition-colors flex-shrink-0" title="Custom color">
                                        {editedCreator.diemButtonColor && !['#1c1917','#6366f1','#8b5cf6','#ec4899','#10b981','#0ea5e9','#f59e0b','#ef4444'].includes(editedCreator.diemButtonColor) && (
                                            <span className="absolute inset-0 rounded-full" style={{ backgroundColor: editedCreator.diemButtonColor }} />
                                        )}
                                        <input type="color" className="absolute opacity-0 w-0 h-0" value={editedCreator.diemButtonColor || '#000000'} onChange={e => setEditedCreator({ ...editedCreator, diemButtonColor: e.target.value })} />
                                        {(!editedCreator.diemButtonColor || ['#1c1917','#6366f1','#8b5cf6','#ec4899','#10b981','#0ea5e9','#f59e0b','#ef4444'].includes(editedCreator.diemButtonColor)) && <span className="text-[9px] text-stone-400 font-bold">+</span>}
                                    </label>
                                    {editedCreator.diemButtonColor && (
                                        <button onClick={() => setEditedCreator({ ...editedCreator, diemButtonColor: undefined })} className="text-[10px] text-stone-400 hover:text-red-400 underline transition-colors">Reset</button>
                                    )}
                                </div>
                            </div>

                            {/* Links & Products Section */}
                            <div ref={tutorialLinksRef} className={showTutorial && tutorialStep === 3 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-xl p-1 -m-1' : ''}>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Links & Products</label>

                                {/* Section Management */}
                                <div ref={tutorialSectionsRef} className={`mb-4 p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-3${showTutorial && tutorialStep === 4 ? ' ring-2 ring-amber-400' : ''}`}>
                                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Custom Sections</span>
                                    {(editedCreator.linkSections || []).length > 0 && (
                                        <div className="flex flex-col gap-1.5">
                                            {[...(editedCreator.linkSections || [])].sort((a,b) => a.order - b.order).map((section, idx, arr) => (
                                                <div key={section.id} className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-xl px-3 py-2 group shadow-sm">
                                                    {/* Reorder buttons */}
                                                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                                                        <button
                                                            onClick={() => handleMoveSection(section.id, 'up')}
                                                            disabled={idx === 0}
                                                            className="text-stone-300 hover:text-stone-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            <ChevronUp size={11}/>
                                                        </button>
                                                        <button
                                                            onClick={() => handleMoveSection(section.id, 'down')}
                                                            disabled={idx === arr.length - 1}
                                                            className="text-stone-300 hover:text-stone-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            <ChevronDown size={11}/>
                                                        </button>
                                                    </div>
                                                    {editingSectionId === section.id ? (
                                                        <>
                                                            <input
                                                                className="flex-1 text-xs font-medium bg-transparent outline-none border-b border-stone-400"
                                                                value={editingSectionTitle}
                                                                autoFocus
                                                                onChange={e => setEditingSectionTitle(e.target.value)}
                                                                onBlur={() => { handleRenameSectionTitle(section.id, editingSectionTitle); setEditingSectionId(null); }}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') { handleRenameSectionTitle(section.id, editingSectionTitle); setEditingSectionId(null); }
                                                                    if (e.key === 'Escape') setEditingSectionId(null);
                                                                }}
                                                            />
                                                            <button onClick={() => { handleRenameSectionTitle(section.id, editingSectionTitle); setEditingSectionId(null); }} className="text-green-600 hover:text-green-800 ml-1 flex-shrink-0">
                                                                <Check size={12}/>
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span
                                                                className="flex-1 text-xs font-medium text-stone-700 cursor-pointer hover:text-stone-900"
                                                                onClick={() => { setEditingSectionId(section.id); setEditingSectionTitle(section.title); }}
                                                                title="Click to rename"
                                                            >
                                                                {section.title}
                                                            </span>
                                                            <button
                                                                onClick={() => handleDeleteSection(section.id)}
                                                                className="text-stone-300 hover:text-red-500 ml-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                                            >
                                                                <X size={11}/>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="New section name..."
                                            className="flex-1 px-3 py-1.5 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-stone-400 outline-none bg-white"
                                            value={newSectionTitle}
                                            onChange={e => setNewSectionTitle(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddSection()}
                                        />
                                        <button
                                            onClick={handleAddSection}
                                            disabled={!newSectionTitle.trim()}
                                            className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-medium hover:bg-stone-700 disabled:opacity-40 transition-colors flex items-center gap-1"
                                        >
                                            <Plus size={12}/> Add
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-3">
                                    {(editedCreator.links || []).map((link, index) => {
                                        const isProduct = link.type === 'DIGITAL_PRODUCT';
                                        const isSupport = link.type === 'SUPPORT';
                                        return (
                                            <div
                                                key={link.id}
                                                draggable
                                                onDragStart={() => handleDragStart(index)}
                                                onDragEnter={() => handleDragEnter(index)}
                                                onDragEnd={handleDragEnd}
                                                onDragOver={(e) => e.preventDefault()}
                                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isProduct ? 'bg-purple-50 border-purple-100' : isSupport ? 'bg-pink-50 border-pink-100' : 'bg-stone-50 border-stone-200'} ${draggedLinkIndex === index ? 'opacity-50 border-dashed border-stone-400' : ''}`}
                                            >
                                                <div className="text-stone-400 cursor-grab active:cursor-grabbing">
                                                    <GripVertical size={16} />
                                                </div>
                                                
                                                {/* Thumbnail / Icon Picker for Existing Link */}
                                                <div className="flex-shrink-0 relative">
                                                    <div className="relative group/thumb">
                                                        {link.thumbnailUrl?.startsWith('data:emoji,') ? (
                                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-stone-100 border border-stone-200 text-xl cursor-pointer`} onClick={() => setOpenIconPickerId(openIconPickerId === link.id ? null : link.id)}>
                                                                {link.thumbnailUrl.replace('data:emoji,', '')}
                                                            </div>
                                                        ) : link.thumbnailUrl ? (
                                                            <img src={link.thumbnailUrl} className="w-10 h-10 rounded-lg object-cover border border-stone-200 bg-white cursor-pointer" onClick={() => setOpenIconPickerId(openIconPickerId === link.id ? null : link.id)} />
                                                        ) : (
                                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border cursor-pointer ${isProduct ? 'bg-purple-100 text-purple-600 border-purple-200' : isSupport ? 'bg-pink-100 text-pink-600 border-pink-200' : 'bg-stone-100 text-stone-500 border-stone-200'}`} onClick={() => setOpenIconPickerId(openIconPickerId === link.id ? null : link.id)}>
                                                                {isProduct ? <FileText size={20}/> : isSupport ? <Heart size={20}/> : <LinkIcon size={20}/>}
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 cursor-pointer transition-opacity" onClick={() => setOpenIconPickerId(openIconPickerId === link.id ? null : link.id)}>
                                                            <Camera size={14} className="text-white"/>
                                                        </div>
                                                    </div>
                                                    {openIconPickerId === link.id && (
                                                        <div className="absolute z-20 mt-1 p-2 bg-white border border-stone-200 rounded-xl shadow-lg w-56">
                                                            <div className="flex flex-wrap gap-1 mb-2">
                                                                {['🔗','📺','📸','🎵','🎮','📝','💼','🛒','📧','💬','🌐','🎨','📱','🎬','🏆','🎯','🚀','✨','💡','🎁'].map(em => (
                                                                    <button key={em} onClick={() => { handleUpdateLink(link.id, 'thumbnailUrl', `data:emoji,${em}`); setOpenIconPickerId(null); }} className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center text-lg transition-colors">{em}</button>
                                                                ))}
                                                            </div>
                                                            <div className="flex gap-1 pt-1 border-t border-stone-100">
                                                                <button onClick={() => { document.getElementById(`thumb-${link.id}`)?.click(); setOpenIconPickerId(null); }} className="flex-1 px-2 py-1 text-[10px] bg-stone-100 hover:bg-stone-200 rounded-lg font-medium text-stone-600 flex items-center justify-center gap-1 transition-colors"><Camera size={10}/> Upload</button>
                                                                {link.thumbnailUrl && <button onClick={() => { handleUpdateLink(link.id, 'thumbnailUrl', ''); setOpenIconPickerId(null); }} className="px-2 py-1 text-[10px] bg-red-50 hover:bg-red-100 rounded-lg font-medium text-red-500 transition-colors">Remove</button>}
                                                            </div>
                                                            {/* Shape Selector */}
                                                            <div className="flex gap-1 pt-1 mt-1 border-t border-stone-100">
                                                                {([['circle','●'],['rounded','▢'],['square','■']] as const).map(([shape, icon]) => (
                                                                    <button key={shape} onClick={() => handleUpdateLink(link.id, 'iconShape', link.iconShape === shape ? undefined : shape)} className={`flex-1 py-1 text-[10px] rounded-lg font-medium transition-colors ${link.iconShape === shape || (!link.iconShape && shape === 'circle') ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>{icon}</button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <input type="file" id={`thumb-${link.id}`} className="hidden" accept="image/*" onChange={(e) => handleLinkThumbnailUpload(e, link.id)} />
                                                </div>

                                                <div className="flex-1 min-w-0 space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full w-fit ${isProduct ? 'bg-purple-100 text-purple-600' : isSupport ? 'bg-pink-100 text-pink-600' : 'bg-stone-200 text-stone-500'}`}>
                                                                {isProduct ? 'Digital Download' : isSupport ? 'Support / Tip' : 'Link'}
                                                            </div>
                                                            {link.buttonColor && (
                                                                <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white shadow-sm" style={{ backgroundColor: link.buttonColor }} />
                                                            )}
                                                        </div>
                                                        {(isProduct || (isSupport && link.price)) && <span className="text-xs font-bold text-stone-900">{link.price} Credits</span>}
                                                    </div>
                                                    
                                                    <input 
                                                        className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-sm font-bold text-stone-800 focus:ring-1 focus:ring-stone-400 outline-none"
                                                        value={link.title}
                                                        onChange={(e) => handleUpdateLink(link.id, 'title', e.target.value)}
                                                        placeholder="Title"
                                                    />
                                                    {isProduct ? (
                                                        <div 
                                                            className="relative group/upload"
                                                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                            onDrop={(e) => handleExistingProductDrop(e, link.id)}
                                                        >
                                                            <div className="flex gap-2">
                                                                <input 
                                                                    className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs text-stone-500 focus:ring-1 focus:ring-stone-400 outline-none pr-8"
                                                                    value={link.fileName || (link.url.startsWith('data:') ? 'Uploaded File' : link.url.split('/').pop()?.split('?')[0] || link.url)}
                                                                    onChange={(e) => handleUpdateLink(link.id, 'url', e.target.value)}
                                                                    placeholder="File URL"
                                                                    readOnly
                                                                />
                                                                <button 
                                                                    onClick={() => document.getElementById(`update-file-${link.id}`)?.click()}
                                                                    className="px-2 py-1 bg-white border border-stone-200 rounded text-xs font-bold text-stone-600 hover:bg-stone-50 whitespace-nowrap"
                                                                >
                                                                    Replace
                                                                </button>
                                                            </div>
                                                            <input 
                                                                type="file" 
                                                                id={`update-file-${link.id}`} 
                                                                className="hidden" 
                                                                onChange={(e) => handleExistingProductUpload(e, link.id)} 
                                                            />
                                                            {/* Drag Overlay */}
                                                            <div className="absolute inset-0 bg-stone-50/90 border-2 border-dashed border-stone-300 rounded flex items-center justify-center opacity-0 group-hover/upload:opacity-100 pointer-events-none transition-opacity z-10">
                                                                <span className="text-[10px] font-semibold text-stone-600">Drop new file to replace</span>
                                                            </div>
                                                        </div>
                                                     ) : isSupport ? (
                                                        <input 
                                                            className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs text-stone-500 focus:ring-1 focus:ring-stone-400 outline-none"
                                                            value={link.url}
                                                            onChange={(e) => handleUpdateLink(link.id, 'url', e.target.value)}
                                                            placeholder="#"
                                                            disabled
                                                        />
                                                    ) : (
                                                        <input 
                                                            className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs text-stone-500 focus:ring-1 focus:ring-stone-400 outline-none"
                                                            value={link.url}
                                                            onChange={(e) => handleUpdateLink(link.id, 'url', e.target.value)}
                                                            placeholder="https://..."
                                                        />
                                                    )}
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <input
                                                            type="checkbox"
                                                            id={`promo-${link.id}`}
                                                            checked={link.isPromoted || false}
                                                            onChange={(e) => handleUpdateLink(link.id, 'isPromoted', e.target.checked)}
                                                            className="rounded text-stone-600 focus:ring-stone-400 accent-stone-600"
                                                        />
                                                        <label htmlFor={`promo-${link.id}`} className="text-xs text-stone-500 cursor-pointer flex items-center gap-1">
                                                            {link.isPromoted ? <Sparkles size={10} className="text-stone-500"/> : null}
                                                            Highlight
                                                        </label>
                                                        <span className="text-stone-200">|</span>
                                                        {/* Inline color swatches */}
                                                        {['#1c1917','#6366f1','#8b5cf6','#ec4899','#10b981','#0ea5e9','#f59e0b','#ef4444'].map(color => (
                                                            <button
                                                                key={color}
                                                                onClick={() => handleUpdateLink(link.id, 'buttonColor', link.buttonColor === color ? undefined : color)}
                                                                className="w-4 h-4 rounded-full transition-all flex-shrink-0"
                                                                style={{ backgroundColor: color, outline: link.buttonColor === color ? `2px solid ${color}` : '2px solid transparent', outlineOffset: '2px' }}
                                                            />
                                                        ))}
                                                        <label className="relative w-4 h-4 rounded-full border border-dashed border-stone-300 cursor-pointer flex items-center justify-center hover:border-stone-500 transition-colors flex-shrink-0" title="Custom color">
                                                            {link.buttonColor && !['#1c1917','#6366f1','#8b5cf6','#ec4899','#10b981','#0ea5e9','#f59e0b','#ef4444'].includes(link.buttonColor) && (
                                                                <span className="absolute inset-0 rounded-full" style={{ backgroundColor: link.buttonColor }} />
                                                            )}
                                                            <input type="color" className="absolute opacity-0 w-0 h-0" value={link.buttonColor || '#000000'} onChange={e => handleUpdateLink(link.id, 'buttonColor', e.target.value)} />
                                                            {(!link.buttonColor || ['#1c1917','#6366f1','#8b5cf6','#ec4899','#10b981','#0ea5e9','#f59e0b','#ef4444'].includes(link.buttonColor)) && <span className="text-[7px] text-stone-400 font-bold">+</span>}
                                                        </label>
                                                        {link.buttonColor && (
                                                            <button onClick={() => handleUpdateLink(link.id, 'buttonColor', undefined)} className="text-[9px] text-stone-300 hover:text-red-400 underline transition-colors">×</button>
                                                        )}
                                                        {(editedCreator.linkSections || []).length > 0 && (
                                                            <select
                                                                value={link.sectionId || ''}
                                                                onChange={(e) => handleAssignLinkSection(link.id, e.target.value || undefined)}
                                                                className="ml-auto text-[10px] border border-stone-200 rounded-md px-2 py-0.5 bg-white focus:ring-1 focus:ring-stone-400 outline-none text-stone-600"
                                                            >
                                                                <option value="">No section</option>
                                                                {[...(editedCreator.linkSections || [])].sort((a,b) => a.order - b.order).map(s => (
                                                                    <option key={s.id} value={s.id}>{s.title}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>
                                                </div>
                                                <button onClick={() => handleRemoveLink(link.id)} className="text-stone-400 hover:text-red-500 p-1">
                                                    <Trash size={16} />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-stone-500 uppercase">Add New Item</span>
                                        <div className="flex bg-white rounded-lg p-0.5 border border-stone-200">
                                            <button 
                                                onClick={() => setNewLinkType('EXTERNAL')}
                                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${newLinkType === 'EXTERNAL' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
                                            >
                                                Link
                                            </button>
                                             <button 
                                                 onClick={() => setNewLinkType('SUPPORT')}
                                                 className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${newLinkType === 'SUPPORT' ? 'bg-pink-600 text-white shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
                                             >
                                                 Support / Tip
                                             </button>
                                            <button 
                                                onClick={() => setNewLinkType('DIGITAL_PRODUCT')}
                                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${newLinkType === 'DIGITAL_PRODUCT' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
                                            >
                                                Digital Product
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            {/* Thumbnail Upload for New Link */}
                                            <div className="relative group/newthumb flex-shrink-0">
                                                {newLinkThumbnail ? (
                                                    <img src={newLinkThumbnail} className="w-10 h-10 rounded-lg object-cover border border-stone-200 bg-white" />
                                                ) : (
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border border-dashed border-stone-300 bg-stone-50 text-stone-400 cursor-pointer hover:bg-stone-100 hover:border-stone-400 transition-colors`} onClick={() => document.getElementById('new-link-thumb')?.click()}>
                                                        {isUploadingThumbnail ? <div className="w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin"/> : <Camera size={16}/>}
                                                    </div>
                                                )}
                                                {newLinkThumbnail && (
                                                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover/newthumb:opacity-100 cursor-pointer transition-opacity" onClick={() => document.getElementById('new-link-thumb')?.click()}>
                                                        <Camera size={14} className="text-white"/>
                                                    </div>
                                                )}
                                                <input type="file" id="new-link-thumb" className="hidden" accept="image/*" onChange={(e) => handleLinkThumbnailUpload(e)} />
                                            </div>
                                            <input 
                                                type="text" 
                                                placeholder={newLinkType === 'SUPPORT' ? "Title (e.g. Buy me a coffee)" : "Title (e.g. My Course / Portfolio)"}
                                                className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-1 focus:ring-stone-400 outline-none"
                                                value={newLinkTitle}
                                                onChange={e => setNewLinkTitle(e.target.value)}
                                            />
                                        </div>
                                        {newLinkType === 'DIGITAL_PRODUCT' ? (
                                            <div 
                                                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all ${isUploadingProduct ? 'bg-stone-50 border-stone-300' : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50 cursor-pointer'}`}
                                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                onDrop={handleProductDrop}
                                                onClick={() => !isUploadingProduct && !newLinkUrl && productFileInputRef.current?.click()}
                                            >
                                                <input type="file" ref={productFileInputRef} className="hidden" onChange={handleProductFileChange} />
                                                
                                                {isUploadingProduct ? (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="animate-spin h-6 w-6 border-2 border-stone-600 border-t-transparent rounded-full"></div>
                                                        <span className="text-xs font-medium text-stone-500">Uploading...</span>
                                                    </div>
                                                ) : newLinkUrl ? (
                                                    <div className="flex flex-col items-center gap-2 w-full">
                                                        <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                                                            <Check size={20} />
                                                        </div>
                                                        <p className="text-sm font-medium text-stone-900">File Ready</p>
                                                         <p className="text-xs text-stone-400 break-all max-w-full truncate px-4">{newFileName || newLinkUrl}</p>
                                                        <button 
                                                             onClick={(e) => { e.stopPropagation(); setNewLinkUrl(''); setNewFileName(''); }}
                                                            className="text-xs text-red-500 hover:text-red-700 font-bold mt-2 bg-red-50 px-3 py-1.5 rounded-full"
                                                        >
                                                            Remove File
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="w-10 h-10 bg-stone-100 text-stone-500 rounded-full flex items-center justify-center mb-2">
                                                            <Download size={20} className="rotate-180" />
                                                        </div>
                                                        <p className="text-sm font-medium text-stone-700">Upload from local disk</p>
                                                        <p className="text-xs text-stone-400 mt-1">PDF, Video, or Image (Max 50MB)</p>
                                                    </>
                                                )}
                                            </div>
                                         ) : newLinkType !== 'SUPPORT' && (
                                            <input 
                                                type="text" 
                                                placeholder="URL (https://...)"
                                                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-1 focus:ring-stone-400 outline-none"
                                                value={newLinkUrl}
                                                onChange={e => setNewLinkUrl(e.target.value)}
                                            />
                                        )}
                                        {(newLinkType === 'DIGITAL_PRODUCT' || newLinkType === 'SUPPORT') && (
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm"><Coins size={14}/></span>
                                                <input 
                                                    type="number" 
                                                    placeholder={newLinkType === 'SUPPORT' ? "Default Tip (Credits)" : "Price (Credits)"}
                                                    className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-1 focus:ring-stone-400 outline-none"
                                                    value={newLinkPrice}
                                                    onChange={e => setNewLinkPrice(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    {(editedCreator.linkSections || []).length > 0 && (
                                        <select
                                            value={newLinkSectionId}
                                            onChange={e => setNewLinkSectionId(e.target.value)}
                                            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-1 focus:ring-stone-400 outline-none bg-white text-stone-600"
                                        >
                                            <option value="">No section</option>
                                            {[...(editedCreator.linkSections || [])].sort((a,b) => a.order - b.order).map(s => (
                                                <option key={s.id} value={s.id}>{s.title}</option>
                                            ))}
                                        </select>
                                    )}
                                    <Button size="sm" onClick={handleAddLink} type="button" fullWidth className="mt-2">
                                         <Plus size={16} className="mr-1"/> Add {newLinkType === 'DIGITAL_PRODUCT' ? 'Product' : newLinkType === 'SUPPORT' ? 'Support Item' : 'Link'}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Profile Display Toggles */}
                        <div className="mt-6 border-t border-stone-100 pt-6 space-y-3">
                            <h4 className="text-sm font-semibold text-stone-700">Profile Display</h4>
                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <p className="text-sm font-medium text-stone-800">Show Likes</p>
                                    <p className="text-xs text-stone-400">Display the heart / like count on your public profile</p>
                                </div>
                                <button
                                    onClick={() => setEditedCreator({ ...editedCreator, showLikes: !(editedCreator.showLikes ?? true) })}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${(editedCreator.showLikes ?? true) ? 'bg-stone-900' : 'bg-stone-200'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${(editedCreator.showLikes ?? true) ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <p className="text-sm font-medium text-stone-800">Show Star Rating</p>
                                    <p className="text-xs text-stone-400">Display your average star rating on your public profile</p>
                                </div>
                                <button
                                    onClick={() => setEditedCreator({ ...editedCreator, showRating: !(editedCreator.showRating ?? true) })}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${(editedCreator.showRating ?? true) ? 'bg-stone-900' : 'bg-stone-200'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${(editedCreator.showRating ?? true) ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <p className="text-sm font-medium text-stone-800">Show Bio</p>
                                    <p className="text-xs text-stone-400">Display your status message / bio on your public profile</p>
                                </div>
                                <button
                                    onClick={() => setEditedCreator({ ...editedCreator, showBio: !(editedCreator.showBio ?? true) })}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${(editedCreator.showBio ?? true) ? 'bg-stone-900' : 'bg-stone-200'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${(editedCreator.showBio ?? true) ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-center">
                            <Button onClick={handleSaveProfile} isLoading={isSavingProfile} className="px-8">Save Changes</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- VIEW: NOTIFICATIONS --- */}
            {currentView === 'NOTIFICATIONS' && (
                <div className="max-w-3xl mx-auto animate-in fade-in space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0"><Menu size={24} /></button>
                            <h2 className="text-xl sm:text-2xl font-bold text-stone-900">{t('creator.notifications')}</h2>
                        </div>
                        <TopNav hideBurger />
                    </div>
                    {(() => {
                        const totalPages = Math.ceil(notifications.length / ITEMS_PER_PAGE);
                        const displayedDesktop = notifications.slice((notificationPage - 1) * ITEMS_PER_PAGE, notificationPage * ITEMS_PER_PAGE);
                        const renderRow = (notif: typeof notifications[0]) => (
                            <div key={notif.id} onClick={() => handleNotificationClick(notif)} className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-stone-50 transition-colors flex gap-3 sm:gap-4 group relative cursor-pointer">
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
                            <h3 className="text-sm font-bold text-stone-900">Notifications</h3>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-stone-500">{notifications.length} items</span>
                                {notifications.length > 0 && (
                                    <button onClick={handleClearAllNotifications} className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors flex items-center gap-1">
                                        <Trash size={12} /> {t('creator.clearAll')}
                                    </button>
                                )}
                            </div>
                        </div>
                        {/* Mobile: all items */}
                        <div className="md:hidden divide-y divide-stone-100">
                            {notifications.length === 0 ? <div className="p-10 text-center text-stone-400 text-sm">No notifications yet.</div> : notifications.map(renderRow)}
                        </div>
                        {/* Desktop: paginated */}
                        <div className="hidden md:block divide-y divide-stone-100">
                            {displayedDesktop.length === 0 ? <div className="p-12 text-center text-stone-400 text-sm">No notifications yet.</div> : displayedDesktop.map(renderRow)}
                        </div>
                        {totalPages > 1 && (
                            <div className="hidden md:flex px-6 py-4 border-t border-stone-100 items-center justify-center gap-4">
                                <button onClick={() => setNotificationPage(p => Math.max(1, p - 1))} disabled={notificationPage === 1} className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed text-stone-500 transition-colors"><ChevronLeft size={16} /></button>
                                <span className="text-xs font-bold text-stone-600">Page {notificationPage} of {totalPages}</span>
                                <button onClick={() => setNotificationPage(p => Math.min(totalPages, p + 1))} disabled={notificationPage === totalPages} className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed text-stone-500 transition-colors"><ChevronRight size={16} /></button>
                            </div>
                        )}
                    </div>
                    );
                    })()}
                </div>
            )}

            {/* --- VIEW: REVIEWS --- */}
            {currentView === 'REVIEWS' && (
                <div className="max-w-5xl mx-auto animate-in fade-in space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0"><Menu size={24} /></button>
                            <h2 className="text-xl sm:text-2xl font-bold text-stone-900">{t('creator.reviews')}</h2>
                        </div>
                        <TopNav hideBurger />
                    </div>
                    {(() => {
                        const totalPages = Math.ceil(reviews.length / ITEMS_PER_PAGE);
                        const displayedReviews = reviews.slice((reviewsPage - 1) * ITEMS_PER_PAGE, reviewsPage * ITEMS_PER_PAGE);
                        return (
                    <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-stone-900">All Reviews</h3>
                            <span className="text-xs text-stone-500">{reviews.length} reviews</span>
                        </div>
                        <div className="divide-y divide-stone-100">
                            {displayedReviews.length === 0 ? (
                                <div className="p-12 text-center text-stone-400 text-sm">No reviews yet.</div>
                            ) : (
                                displayedReviews.map(review => (
                                    <div key={review.id} className="p-6 hover:bg-stone-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-stone-900 text-sm">{review.senderName}</span>
                                                <div className="flex gap-0.5">
                                                    {[1,2,3,4,5].map(i => (
                                                        <Star key={i} size={14} className={`${(review.rating || 0) >= i ? "fill-yellow-400 text-yellow-400" : "text-stone-200"}`}/>
                                                    ))}
                                                </div>
                                            </div>
                                            <span className="text-xs text-stone-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        {/* @ts-ignore */}
                                        <p className="text-sm text-stone-600 italic mb-2">"{review.reviewContent || "No written review"}"</p>
                                        <div className="text-xs text-stone-400">
                                            Session Amount: <span className="font-medium text-stone-600">{review.amount} Credits</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {/* Pagination Controls */}
                        <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-center gap-4">
                            <button
                                onClick={() => setReviewsPage(p => Math.max(1, p - 1))}
                                disabled={reviewsPage === 1}
                                className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed text-stone-500 transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-xs font-bold text-stone-600">Page {reviewsPage} of {Math.max(1, totalPages)}</span>
                            <button
                                onClick={() => setReviewsPage(p => Math.min(totalPages, p + 1))}
                                disabled={reviewsPage === totalPages || totalPages <= 1}
                                className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed text-stone-500 transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                    );
                    })()}
                </div>
            )}

            {/* --- VIEW: SUPPORT --- */}
            {currentView === 'SUPPORT' && (
                <div className="max-w-2xl mx-auto animate-in fade-in flex flex-col items-center min-h-[500px] gap-6">
                     <div className="w-full flex items-center justify-between">
                         <div className="flex items-center gap-2">
                             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0"><Menu size={24} /></button>
                             <h2 className="text-xl sm:text-2xl font-bold text-stone-900">{t('creator.support')}</h2>
                         </div>
                         <TopNav hideBurger />
                     </div>
                     <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-xl shadow-stone-200/50 text-center space-y-6 max-w-md w-full relative overflow-hidden">
                         {/* Decorative Background */}
                         <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-stone-400 via-stone-600 to-stone-800"></div>
                         
                         <div className="w-20 h-20 bg-amber-50 text-stone-500 rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-inner ring-4 ring-amber-50/50">
                             <AlertCircle size={40} />
                         </div>
                         
                         <div>
                            <h3 className="text-2xl font-black text-stone-900 mb-2">Creator Support</h3>
                            <p className="text-stone-500 text-sm leading-relaxed">
                                Need help with your account or payments? Our team is here for you.
                            </p>
                         </div>

                         <div className="space-y-3 pt-2">
                             <Button fullWidth className="h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-stone-900/10" onClick={() => { setCurrentView('INBOX'); setSelectedSenderEmail('abe7340@gmail.com'); }}>
                                <MessageSquare size={18}/> Contact Support
                             </Button>
                             <Button fullWidth variant="secondary" className="h-12 rounded-xl flex items-center justify-center gap-2 bg-stone-50 hover:bg-stone-100 border border-stone-200">
                                <FileText size={18}/> Creator Guide
                             </Button>
                         </div>

                         <div className="pt-6 border-t border-stone-100">
                             <p className="text-xs text-stone-400">
                                 Or email us directly at <a href="mailto:support@diem.ee" className="text-stone-900 font-semibold hover:underline">support@diem.ee</a>
                             </p>
                         </div>
                     </div>
                </div>
            )}
        </div>
      </main>

      {/* Premium Upgrade Modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative">
                <button onClick={() => setShowPremiumModal(false)} className="absolute top-4 right-4 p-2 bg-stone-100 hover:bg-stone-200 rounded-full text-stone-500 z-10 transition-colors"><X size={20}/></button>
                
                {/* Header Graphic */}
                <div className="h-40 bg-stone-900 relative overflow-hidden flex items-center justify-center">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-stone-400/20 rounded-full blur-[80px]"></div>
                     <div className="absolute bottom-0 left-0 w-64 h-64 bg-stone-500/20 rounded-full blur-[80px]"></div>
                     <div className="relative z-10 text-center">
                         <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1 rounded-full text-xs font-bold text-white mb-3 backdrop-blur-md">
                             <Sparkles size={12} className="text-yellow-400" /> RECOMMENDED
                         </div>
                         <h2 className="text-3xl font-black text-white tracking-tight">Diem Pro</h2>
                     </div>
                </div>

                <div className="p-8">
                    <div className="flex items-baseline justify-center gap-1 mb-8">
                        <span className="text-5xl font-black text-stone-900">2000</span>
                        <span className="text-stone-500 font-medium">credits / mo</span>
                    </div>

                    <div className="space-y-4 mb-8">
                        {[
                            "Advanced Traffic Analytics",
                            "Revenue Forecasting",
                            "0% Commission for 12 Months",
                            "Verified 'Pro' Badge",
                            "Priority Support"
                        ].map((feature, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
                                    <Check size={12} strokeWidth={3} />
                                </div>
                                <span className="text-stone-700 font-medium">{feature}</span>
                            </div>
                        ))}
                    </div>

                    <Button 
                        fullWidth 
                        size="lg" 
                        onClick={handleUpgradeToPremium}
                        isLoading={isUpgrading}
                        className="bg-stone-900 hover:bg-stone-800 text-white h-14 text-lg font-bold shadow-xl shadow-stone-900/20"
                    >
                        Upgrade Now
                    </Button>
                    <p className="text-center text-xs text-stone-400 mt-4">Cancel anytime. Secure checkout.</p>
                </div>
            </div>
        </div>
      )}
      {/* Onboarding Tutorial Overlay */}
      {showTutorial && currentView === 'SETTINGS' && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/40 z-50" onClick={handleTutorialSkip} />
          {/* Coach card */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] w-[min(400px,calc(100vw-32px))] bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden">
            {/* Progress bar */}
            <div className="h-1 bg-stone-100">
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${((tutorialStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
              />
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {['✍️', '📋', '💬', '🔗', '📂'][tutorialStep]}
                  </span>
                  <span className="font-bold text-stone-900 text-sm">{TUTORIAL_STEPS[tutorialStep].title}</span>
                </div>
                <span className="text-[11px] text-stone-400 font-medium shrink-0 ml-2">{tutorialStep + 1} / {TUTORIAL_STEPS.length}</span>
              </div>
              <p className="text-sm text-stone-500 leading-relaxed mb-4">{TUTORIAL_STEPS[tutorialStep].desc}</p>
              <div className="flex items-center justify-between">
                <button onClick={handleTutorialSkip} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                  Skip tutorial
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {TUTORIAL_STEPS.map((_, i) => (
                      <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === tutorialStep ? 'w-4 bg-amber-500' : i < tutorialStep ? 'w-1.5 bg-amber-200' : 'w-1.5 bg-stone-200'}`} />
                    ))}
                  </div>
                  <button
                    onClick={handleTutorialNext}
                    className="px-4 py-2 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-700 transition-colors"
                  >
                    {tutorialStep < TUTORIAL_STEPS.length - 1 ? 'Next →' : 'Got it ✓'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Inbox Tutorial Overlay */}
      {showInboxTutorial && selectedSenderEmail === 'abe7340@gmail.com' && currentView === 'INBOX' && !!activeMessage && (() => {
        const INBOX_TUTORIAL_STEPS = [
          { emoji: '⏱️', title: t('tutorial.inbox.timer.title'),   desc: t('tutorial.inbox.timer.desc') },
          { emoji: '💬', title: t('tutorial.inbox.send.title'),    desc: t('tutorial.inbox.send.desc') },
          { emoji: '📎', title: t('tutorial.inbox.attach.title'),  desc: t('tutorial.inbox.attach.desc') },
          { emoji: '🪙', title: t('tutorial.inbox.collect.title'), desc: t('tutorial.inbox.collect.desc') },
          { emoji: '🚪', title: t('tutorial.inbox.exit.title'),    desc: t('tutorial.inbox.exit.desc') },
        ];
        const step = INBOX_TUTORIAL_STEPS[inboxTutorialStep];

        // Compute card position anchored to the highlighted element
        const CARD_W = 340;
        const GAP = 12;
        const targetEl = inboxTutorialRefs.current[inboxTutorialStep];
        const rect = targetEl?.getBoundingClientRect();
        let cardStyle: React.CSSProperties;
        let arrowStyle: React.CSSProperties = {};
        let showArrowAbove = false; // arrow at top of card pointing up toward element

        if (rect) {
          const centerX = rect.left + rect.width / 2;
          const rawLeft = centerX - CARD_W / 2;
          const clampedLeft = Math.max(8, Math.min(rawLeft, window.innerWidth - CARD_W - 8));
          const arrowLeft = Math.max(16, Math.min(centerX - clampedLeft - 8, CARD_W - 32));

          if (rect.bottom + GAP + 220 < window.innerHeight) {
            // Place card BELOW the element
            cardStyle = { top: rect.bottom + GAP, left: clampedLeft, width: CARD_W };
            showArrowAbove = true;
            arrowStyle = { left: arrowLeft };
          } else {
            // Place card ABOVE the element
            cardStyle = { bottom: window.innerHeight - rect.top + GAP, left: clampedLeft, width: CARD_W };
            arrowStyle = { left: arrowLeft };
          }
        } else {
          // Fallback: bottom center
          cardStyle = { bottom: 24, left: '50%', transform: 'translateX(-50%)', width: `min(${CARD_W}px, calc(100vw - 32px))` };
        }

        return (
          <>
            <div className="fixed inset-0 bg-black/40 z-50" />
            <div className="fixed z-[70] bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-visible" style={cardStyle}>
              {/* Arrow pointing toward element */}
              {rect && showArrowAbove && (
                <div className="absolute -top-2 h-0 w-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-white" style={arrowStyle} />
              )}
              {rect && !showArrowAbove && (
                <div className="absolute -bottom-2 h-0 w-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-white" style={arrowStyle} />
              )}
              <div className="h-1 bg-stone-100 rounded-t-2xl overflow-hidden">
                <div className="h-full bg-stone-900 transition-all duration-300" style={{ width: `${((inboxTutorialStep + 1) / INBOX_TUTORIAL_STEPS.length) * 100}%` }} />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{step.emoji}</span>
                    <span className="font-bold text-stone-900 text-sm">{step.title}</span>
                  </div>
                  <span className="text-[11px] text-stone-400 font-medium shrink-0 ml-2">{inboxTutorialStep + 1} / {INBOX_TUTORIAL_STEPS.length}</span>
                </div>
                <p className="text-sm text-stone-500 leading-relaxed">{step.desc}</p>
                <div className="flex items-center justify-between mt-4">
                  <button onClick={handleInboxTutorialDone} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                    Skip tutorial
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {INBOX_TUTORIAL_STEPS.map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === inboxTutorialStep ? 'w-4 bg-stone-900' : i < inboxTutorialStep ? 'w-1.5 bg-stone-300' : 'w-1.5 bg-stone-200'}`} />
                      ))}
                    </div>
                    <button onClick={handleInboxTutorialNext} className="px-4 py-2 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-700 transition-colors">
                      {inboxTutorialStep < INBOX_TUTORIAL_STEPS.length - 1 ? 'Next →' : 'Got it ✓'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      })()}

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
    </div>
  );
};
