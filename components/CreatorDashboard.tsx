
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { CreatorProfile, Message, DashboardStats, MonthlyStat, AffiliateLink, ProAnalyticsData, StatTimeFrame, DetailedStat, DetailedFinancialStat, CurrentUser } from '../types';
import { getMessages, replyToMessage, updateCreatorProfile, markMessageAsRead, cancelMessage, getHistoricalStats, getProAnalytics, getDetailedStatistics, getFinancialStatistics, DEFAULT_AVATAR, subscribeToMessages, uploadProductFile } from '../services/realBackend';
import { generateReplyDraft } from '../services/geminiService';
import { 
  Clock, CheckCircle2, AlertCircle, DollarSign, Sparkles, ChevronLeft, LogOut, 
  ExternalLink, User, Settings, Plus, Trash, X, Camera, Paperclip, Send, 
  Home, BarChart3, Wallet, Users, Bell, Search, Menu, ChevronDown, Ban, Check,
  Heart, Star, Eye, TrendingUp, MessageSquare, ArrowRight, Lock, 
  InstagramLogo, Twitter, Youtube, Twitch, Music2, TikTokLogo, XLogo, YouTubeLogo, Download, ShoppingBag, FileText, PieChart as PieIcon, LayoutGrid, MonitorPlay, Link as LinkIcon, Calendar, ChevronRight, Coins, CreditCard
  , MousePointerClick
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

type DashboardView = 'OVERVIEW' | 'INBOX' | 'FINANCE' | 'ANALYTICS' | 'STATISTICS' | 'SETTINGS' | 'NOTIFICATIONS' | 'REVIEWS';
type InboxFilter = 'ALL' | 'PENDING' | 'REPLIED' | 'REJECTED';

const SUPPORTED_PLATFORMS = [
    { id: 'youtube', label: 'YouTube', icon: YouTubeLogo },
    { id: 'instagram', label: 'Instagram', icon: InstagramLogo },
    { id: 'x', label: 'X (Twitter)', icon: XLogo },
    { id: 'tiktok', label: 'TikTok', icon: TikTokLogo },
    { id: 'twitch', label: 'Twitch', icon: Twitch },
];

const DUMMY_PRO_DATA: ProAnalyticsData = {
    trafficSources: [
        { name: 'YouTube', value: 45, color: '#FF0000' },
        { name: 'Instagram', value: 25, color: '#E1306C' },
        { name: 'X', value: 20, color: '#000000' },
        { name: 'Other', value: 10, color: '#64748b' }
    ],
    funnel: [
        { name: 'Profile Views', count: 15420, fill: '#6366F1' },
        { name: 'Link Clicks', count: 4200, fill: '#818CF8' },
        { name: 'Conversions', count: 850, fill: '#4ADE80' }
    ],
    topAssets: [
        { id: '1', title: 'Ultimate React Guide', type: 'PRODUCT', clicks: 2400, revenue: 12000, ctr: '12.5%' },
        { id: '2', title: 'Discord Community', type: 'LINK', clicks: 1100, revenue: 0, ctr: '8.2%' },
        { id: '3', title: '1:1 Coaching', type: 'PRODUCT', clicks: 450, revenue: 45000, ctr: '3.1%' },
    ],
    audienceType: { new: 62, returning: 38 }
};

export const CreatorDashboard: React.FC<Props> = ({ creator, currentUser, onLogout, onViewProfile, onRefreshData }) => {
  const [currentView, setCurrentView] = useState<DashboardView>('OVERVIEW');
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [selectedSenderEmail, setSelectedSenderEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [historicalStats, setHistoricalStats] = useState<MonthlyStat[]>([]);
  
  // Analytics State
  const [proData, setProData] = useState<ProAnalyticsData | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Statistics State
  const [statsTimeFrame, setStatsTimeFrame] = useState<StatTimeFrame>('WEEKLY');
  const [statsDate, setStatsDate] = useState<Date>(new Date()); 
  
  const [detailedStats, setDetailedStats] = useState<DetailedStat[]>([]);
  const [financialStats, setFinancialStats] = useState<DetailedFinancialStat[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Inbox Filter
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('ALL');

  // Withdrawal State
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  
  // Reply State
  const [replyText, setReplyText] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [showCollectAnimation, setShowCollectAnimation] = useState(false);
  const [collectedAmount, setCollectedAmount] = useState(0);

  // Edit Profile State
  const [editedCreator, setEditedCreator] = useState<CreatorProfile>(creator);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  
  // Link Editing State
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkType, setNewLinkType] = useState<'EXTERNAL' | 'DIGITAL_PRODUCT'>('EXTERNAL');
  const [newLinkPrice, setNewLinkPrice] = useState('');

  // Mobile Sidebar Toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Premium State
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingProduct, setIsUploadingProduct] = useState(false);

  const [deletedNotificationIds, setDeletedNotificationIds] = useState<string[]>(() => {
      try {
          const saved = localStorage.getItem('bluechecked_creator_deleted_notifications');
          return saved ? JSON.parse(saved) : [];
      } catch {
          return [];
      }
  });

  useEffect(() => {
      localStorage.setItem('bluechecked_creator_deleted_notifications', JSON.stringify(deletedNotificationIds));
  }, [deletedNotificationIds]);

  const notifications = useMemo(() => {
      const list: { id: string, icon: any, text: string, time: Date, color: string }[] = [];
      
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
                  color: 'bg-blue-100 text-blue-600'
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
                  color: 'bg-purple-100 text-purple-600'
              });
          }
          
          // 3. Tips (Fan Appreciation)
          msg.conversation.forEach(chat => {
              if (chat.role === 'FAN' && chat.content.startsWith('Fan Appreciation:')) {
                  list.push({
                      id: `tip-${chat.id}`,
                      icon: Heart,
                      text: `${msg.senderName} sent a tip!`,
                      time: new Date(chat.timestamp),
                      color: 'bg-pink-100 text-pink-600'
                  });
              }
          });
      });

      return list
        .filter(n => !deletedNotificationIds.includes(n.id))
        .sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [messages, creator.id, deletedNotificationIds]);

  const handleDeleteNotification = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeletedNotificationIds(prev => [...prev, id]);
  };

  const handleClearAllNotifications = () => {
      if (notifications.length === 0) return;
      if (window.confirm("Are you sure you want to clear all notifications?")) {
          const allIds = notifications.map(n => n.id);
          setDeletedNotificationIds(prev => [...prev, ...allIds]);
      }
  };

  useEffect(() => {
    loadData();

    // Real-time Subscription
    if (currentUser) {
        const { unsubscribe } = subscribeToMessages(currentUser.id, () => {
            loadData(true);
        });
        return () => unsubscribe();
    }
  }, [currentUser]);

  useEffect(() => {
    // Load pro analytics if user is premium and on analytics tab
    if (currentView === 'ANALYTICS' && creator.isPremium && !proData) {
        loadProAnalytics();
    }
  }, [currentView, creator.isPremium]);

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

  useEffect(() => {
    // Auto scroll to bottom when conversation changes
    if (scrollRef.current && selectedMessage) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedMessage?.conversation, selectedMessage?.id]);

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    const msgs = await getMessages();
    setMessages(msgs);

    const history = await getHistoricalStats();
    setHistoricalStats(history);

    // If we have a selected message, update it with fresh data
    // If we have a selected sender, refresh their thread implicitly by updating 'messages'
    if (selectedSenderEmail) {
        // We don't need to manually update selectedMessage here as we will derive activeMessage from the thread
        // But we keep selectedMessage sync for safety if used elsewhere
    }
    if (!silent) setIsLoading(false);
  };

  const loadProAnalytics = async () => {
      setIsLoadingAnalytics(true);
      const data = await getProAnalytics();
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
          return statsDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
    const totalEarnings = incomingMessages
      .filter(m => m.status === 'REPLIED')
      .reduce((sum, m) => sum + m.amount, 0);
    
    // Filter out products for message metrics
    const messageOnly = incomingMessages.filter(m => !m.content.startsWith('Purchased Product:'));

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

    return {
      totalEarnings,
      pendingCount,
      responseRate,
      // @ts-ignore - Adding temporary field to stats object
      avgResponseTime,
      monthlyStats: historicalStats
    };
  }, [incomingMessages, historicalStats]);

  const handleWithdraw = async () => {
    if (stats.totalEarnings <= 0) return;
    if (!window.confirm(`Withdraw ${stats.totalEarnings} credits to your connected account?`)) return;
    
    setIsWithdrawing(true);
    // Simulate network request
    await new Promise(r => setTimeout(r, 2000));
    setIsWithdrawing(false);
    alert(`Successfully transferred ${stats.totalEarnings} credits.`);
  };

  const handleOpenChat = async (senderEmail: string) => {
    setSelectedSenderEmail(senderEmail);

    // Mark all unread from this sender as read
    const unread = incomingMessages.filter(m => {
        if (m.senderEmail !== senderEmail || m.isRead) return false;
        // Only mark as read if the last message is from the FAN
        const lastMsg = m.conversation[m.conversation.length - 1];
        return !lastMsg || lastMsg.role === 'FAN';
    });
    if (unread.length > 0) {
        await Promise.all(unread.map(m => markMessageAsRead(m.id)));
        // Optimistic update
        setMessages(prev => prev.map(m => (m.senderEmail === senderEmail && !m.isRead) ? { ...m, isRead: true } : m));
    }
    setReplyText(''); // Reset reply input for fresh chat
    setConfirmRejectId(null);
    if (currentView !== 'INBOX') {
        setCurrentView('INBOX');
    }
  };

  // Thread messages for the selected sender
  const threadMessages = useMemo(() => {
      if (!selectedSenderEmail) return [];
      return incomingMessages
          .filter(m => m.senderEmail === selectedSenderEmail && !m.content.startsWith('Purchased Product:'))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [incomingMessages, selectedSenderEmail]);

  // Determine the "Active" message for the reply input (Latest Pending, or just latest)
  const activeMessage = useMemo(() => {
      const pending = [...threadMessages].reverse().find(m => m.status === 'PENDING');
      return pending || threadMessages[threadMessages.length - 1];
  }, [threadMessages]);

  const handleGenerateAI = async () => {
    if (!activeMessage) return;
    setIsGeneratingAI(true);
    // Use the last fan message as context for the AI
    const lastFanMsg = [...activeMessage.conversation].reverse().find(m => m.role === 'FAN')?.content || activeMessage.content;
    const draft = await generateReplyDraft(activeMessage.senderName, lastFanMsg, creator);
    setReplyText(draft);
    setIsGeneratingAI(false);
  };

  const handleSendReply = async (isComplete: boolean) => {
    if (!activeMessage) return;
    
    const hasText = replyText.trim().length > 0;
    // CRITICAL FIX: Exclude auto-replies when checking for creator participation
    const hasManualReply = activeMessage.conversation.some(m => m.role === 'CREATOR' && !m.id.endsWith('-auto'));

    // Validation: 
    // 1. If sending a partial reply (not complete), must have text.
    if (!isComplete && !hasText) return; 
    
    // 2. If completing, must have EITHER text OR a previous MANUAL reply history.
    if (isComplete && !hasText && !hasManualReply) return;

    setIsSendingReply(true);
    await new Promise(r => setTimeout(r, 800)); // Simulate delay
    
    // The backend now handles empty replyText by skipping message creation but updating status
    await replyToMessage(activeMessage.id, replyText, isComplete);
    await loadData(true); 
    setReplyText('');
    setIsSendingReply(false);

    if (isComplete) {
        setCollectedAmount(activeMessage.amount);
        setShowCollectAnimation(true);
        setTimeout(() => setShowCollectAnimation(false), 3500);
    }
  };

  const handleReject = async (e?: React.MouseEvent) => {
      if (e) {
          e.preventDefault();
          e.stopPropagation();
      }
      if (!activeMessage) return;
      if (!window.confirm("Are you sure you want to reject this request? The funds will be refunded to the user immediately.")) return;
      
      setIsRejecting(true);
      await cancelMessage(activeMessage.id);
      await loadData(true);
      setIsRejecting(false);
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
        alert("Failed to save profile changes. Please try again.");
    } finally {
        setIsSavingProfile(false);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (!file.type.startsWith('image/')) {
              alert("Please upload a valid image file (JPEG, PNG).");
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
      if (currentPlatforms.includes(platformId)) {
          setEditedCreator(prev => ({
              ...prev,
              platforms: prev.platforms?.filter(p => p !== platformId)
          }));
      } else {
          setEditedCreator(prev => ({
              ...prev,
              platforms: [...(prev.platforms || []), platformId]
          }));
      }
  };

  const handleUpdateLink = (id: string, field: keyof AffiliateLink, value: any) => {
     setEditedCreator(prev => ({
         ...prev,
         links: (prev.links || []).map(l => l.id === id ? { ...l, [field]: value } : l)
     }));
  };

  const handleAddLink = () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
    
    // Price validation for products
    if (newLinkType === 'DIGITAL_PRODUCT' && (!newLinkPrice || isNaN(Number(newLinkPrice)))) {
        alert("Please enter a valid credit price for the digital product.");
        return;
    }

    const newLink: AffiliateLink = {
      id: `l-${Date.now()}`,
      title: newLinkTitle,
      url: newLinkUrl,
      isPromoted: false,
      type: newLinkType,
      price: newLinkType === 'DIGITAL_PRODUCT' ? Number(newLinkPrice) : undefined
    };
    
    setEditedCreator(prev => ({ ...prev, links: [...(prev.links || []), newLink] }));
    setNewLinkTitle('');
    setNewLinkUrl('');
    setNewLinkPrice('');
    setNewLinkType('EXTERNAL');
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
      } catch (error) {
          console.error("Upload failed", error);
          alert("Failed to upload file.");
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
      } catch (error) {
          console.error("Upload failed", error);
          alert("Failed to upload file.");
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
      } catch (error) {
          console.error("Upload failed", error);
          alert("Failed to upload file.");
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
      } catch (error) {
          console.error("Upload failed", error);
          alert("Failed to upload file.");
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
    if (diff < 0) return { text: 'Expired', color: 'text-red-600', bg: 'bg-red-50' };
    if (hours < 4) return { text: `${hours}h left`, color: 'text-amber-600', bg: 'bg-amber-50' };
    return { text: `${hours}h left`, color: 'text-slate-500', bg: 'bg-slate-100' };
  };

  const filteredGroups = useMemo(() => conversationGroups.filter(group => {
      const status = group.latestMessage.status;

      if (inboxFilter === 'ALL') return true;
      if (inboxFilter === 'PENDING') return status === 'PENDING';
      if (inboxFilter === 'REPLIED') return status === 'REPLIED';
      if (inboxFilter === 'REJECTED') return status === 'EXPIRED' || status === 'CANCELLED';
      return false;
  }), [conversationGroups, inboxFilter]);

  const hasManualCreatorReply = activeMessage 
    ? activeMessage.conversation.some(m => m.role === 'CREATOR' && !m.id.endsWith('-auto'))
    : false;

  const SidebarItem = ({ icon: Icon, label, view, badge }: { icon: any, label: string, view: DashboardView, badge?: number }) => (
    <button 
      onClick={() => { setCurrentView(view); setSelectedSenderEmail(null); setIsSidebarOpen(false); }}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-md mb-1 transition-colors text-sm font-medium ${
        currentView === view 
          ? 'bg-slate-200 text-slate-900' 
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className={currentView === view ? 'text-indigo-600' : 'text-slate-400'} />
        <span>{label}</span>
      </div>
      {badge ? (
        <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {badge}
        </span>
      ) : null}
    </button>
  );

  // Use real data if premium, otherwise use dummy data for blurred preview
  const analyticsData = creator.isPremium ? proData : DUMMY_PRO_DATA;

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex font-sans text-slate-900 overflow-hidden">
      {/* Mobile Sidebar Overlay - Fixes menu close bug */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-20 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 1. LEFT SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-[#F3F4F6] border-r border-slate-200 transform transition-transform duration-300 z-30 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 flex flex-col`}>
        <div className="p-4 flex flex-col h-full">
            {/* Brand */}
            <div 
                onClick={() => { setCurrentView('OVERVIEW'); setSelectedSenderEmail(null); }}
                className="flex items-center gap-2 px-3 py-4 mb-6 cursor-pointer hover:opacity-80 transition-opacity"
            >
                <div className="bg-blue-600 text-white p-1 rounded-md shadow-lg shadow-blue-500/20">
                    <CheckCircle2 size={16} />
                </div>
                <span className="font-bold text-slate-900 tracking-tight">BLUECHECKED</span>
                {creator.isPremium && (
                   <span className="bg-yellow-100 text-yellow-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-yellow-200 ml-1">PRO</span>
                )}
            </div>

            {/* Nav Links */}
            <div className="space-y-1 flex-1">
                <div className="px-3 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Main</div>
                <SidebarItem icon={Home} label="Overview" view="OVERVIEW" />
                <SidebarItem icon={Users} label="Inbox" view="INBOX" badge={stats.pendingCount > 0 ? stats.pendingCount : undefined} />
                <SidebarItem icon={Wallet} label="Finance" view="FINANCE" />
                <SidebarItem icon={Bell} label="Notifications" view="NOTIFICATIONS" badge={notifications.length > 0 ? notifications.length : undefined} />
                <SidebarItem icon={Star} label="Reviews" view="REVIEWS" />
                <SidebarItem icon={TrendingUp} label="Analytics" view="ANALYTICS" />
                <SidebarItem icon={PieIcon} label="Statistics" view="STATISTICS" />
                
                <div className="px-3 mt-8 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Settings</div>
                <SidebarItem icon={User} label="Profile" view="SETTINGS" />
            </div>

            {!creator.isPremium && (
                <div className="px-3 mb-4">
                    <button 
                        onClick={() => { setIsSidebarOpen(false); setShowPremiumModal(true); }}
                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl p-3 shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-transform text-left group relative overflow-hidden"
                    >
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 font-bold text-sm mb-1">
                                <Sparkles size={14} className="text-yellow-300 fill-yellow-300" /> Upgrade to Pro
                            </div>
                            <p className="text-sm text-indigo-100">Unlock detailed analytics & 0% fees.</p>
                        </div>
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    </button>
                </div>
            )}

            {/* Profile Snippet Bottom */}
            <div className="mt-auto border-t border-slate-200 pt-4 px-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-200">
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
                        <p className="text-sm font-medium text-slate-900 truncate">{creator.displayName}</p>
                        <p className="text-xs text-slate-500 truncate">{currentUser?.email || creator.handle}</p>
                    </div>
                    <button onClick={onLogout} className="text-slate-400 hover:text-red-600 transition-colors">
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <main className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
            {/* ... (Header Content Unchanged) ... */}
            <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-slate-500">
                    <Menu size={20} />
                </button>
                <h2 className="font-semibold text-slate-800">
                    {currentView.charAt(0) + currentView.slice(1).toLowerCase()}
                </h2>
            </div>
            <div className="flex items-center gap-4">
                <div className="relative hidden sm:block">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm text-slate-600 focus:ring-2 focus:ring-slate-200 outline-none w-64 transition-all"
                    />
                </div>
                <button className="relative text-slate-400 hover:text-slate-600">
                    <Bell size={20} />
                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                </button>
                <div className="h-6 w-px bg-slate-200"></div>
                <button onClick={onViewProfile} className="text-sm font-medium text-slate-600 hover:text-indigo-600 flex items-center gap-1">
                    Public Page <ExternalLink size={14} />
                </button>
            </div>
        </header>

        {/* Scrollable Content */}
        <div className={`flex-1 overflow-auto ${currentView === 'INBOX' ? 'p-0' : 'p-6'} relative`}>
            
            {/* ... (Overview View) ... */}
            {currentView === 'OVERVIEW' && (
                <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-2">
                    {/* ... Content ... */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Stats Cards */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                            <div className="relative z-10">
                                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Coins size={16} className="text-indigo-500"/> Total Credits Earned
                                </div>
                                <div className="text-3xl font-black text-slate-900 mb-1 tracking-tight">{stats.totalEarnings.toLocaleString()}</div>
                                <div className="text-xs text-green-600 font-bold bg-green-50 inline-block px-1.5 py-0.5 rounded">+12% this week</div>
                            </div>
                        </div>
                        {/* ... Other Stat Cards ... */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                             <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Clock size={16} className="text-amber-500"/> Pending Requests
                            </div>
                            <div className="text-3xl font-black text-slate-900 mb-1 tracking-tight">{stats.pendingCount}</div>
                            <div className="text-xs text-slate-400 font-medium">Action required</div>
                        </div>
                         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                             <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                <BarChart3 size={16} className="text-blue-500"/> Response Rate
                            </div>
                            <div className="text-3xl font-black text-slate-900 mb-1 tracking-tight">{stats.responseRate}%</div>
                            {/* @ts-ignore */}
                            <div className="text-xs text-slate-400 font-medium">Avg time: {stats.avgResponseTime}</div>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                             <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                <MessageSquare size={16} className="text-purple-500"/> Total Requests
                            </div>
                            <div className="text-3xl font-black text-slate-900 mb-1 tracking-tight">
                                {incomingMessages.length.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-400 font-medium">Lifetime received</div>
                        </div>
                    </div>
                    {/* ... Charts ... */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden h-96 flex flex-col">
                            <h3 className="font-bold text-slate-900 mb-6 flex items-center justify-between flex-shrink-0">
                                <span>Credit Trend</span>
                                <span className="text-xs font-normal text-slate-400 bg-slate-50 px-2 py-1 rounded">Last 6 Months</span>
                            </h3>
                            
                            <div className={`flex-1 w-full min-h-0 ${!creator.isPremium ? 'blur-sm select-none opacity-50' : ''}`}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.monthlyStats}>
                                        <defs>
                                            <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                        <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
                                        <Area type="monotone" dataKey="earnings" stroke="#6366f1" fillOpacity={1} fill="url(#colorEarnings)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {!creator.isPremium && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                    <div className="bg-white/80 backdrop-blur-md border border-white/50 p-6 rounded-2xl shadow-xl flex flex-col items-center max-w-xs text-center">
                                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mb-3 text-indigo-600">
                                            <Lock size={20} />
                                        </div>
                                        <h4 className="font-bold text-slate-900 mb-1">Unlock detailed trends</h4>
                                        <p className="text-xs text-slate-500 mb-4">See your earnings growth and forecast with a Premium account.</p>
                                        <Button size="sm" onClick={() => setShowPremiumModal(true)} className="w-full">Upgrade to View</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                         <div className="space-y-4">
                             <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col h-96">
                                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-50 flex-shrink-0">
                                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Recent Reviews ({reviews.length})</div>
                                    <div className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{reviews.length}</div>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                                    {reviews.length === 0 ? (
                                        <div className="text-center py-6">
                                            <Star size={24} className="mx-auto text-slate-200 mb-2" />
                                            <p className="text-xs text-slate-400">No reviews yet.</p>
                                        </div>
                                    ) : (
                                        reviews.map(review => (
                                            <div key={review.id} className="group">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-slate-900 text-xs">{review.senderName}</span>
                                                    <span className="text-[10px] text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex gap-0.5 mb-2">
                                                        {[1,2,3,4,5].map(i => (
                                                            <Star key={i} size={10} className={`${(review.rating || 0) >= i ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}`}/>
                                                        ))}
                                                </div>
                                                <div className="bg-slate-50 p-2 rounded-lg">
                                                    <p className="text-[10px] text-slate-500 line-clamp-2 italic">
                                                        {/* @ts-ignore */}
                                                        "{review.reviewContent || "No written review"}"
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

             {/* --- VIEW: FINANCE OR STATISTICS --- */}
            {(currentView === 'FINANCE' || currentView === 'STATISTICS') && (
                <div className="max-w-6xl mx-auto animate-in fade-in space-y-8">
                     {/* Header Controls */}
                     <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                         <div>
                             <h2 className="text-2xl font-bold text-slate-900">
                                 {currentView === 'FINANCE' ? 'Finance & Credits' : 'Activity Statistics'}
                             </h2>
                             <p className="text-slate-500 text-sm">
                                 {currentView === 'FINANCE' 
                                    ? 'Manage your earnings, withdrawals, and transaction history.' 
                                    : 'Track your profile performance and engagement metrics.'}
                             </p>
                         </div>
                         
                         <div className="flex flex-wrap gap-4 items-center">
                             {currentView === 'STATISTICS' && (
                                <div className="flex gap-4 items-center bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                                    {/* Timeframe Toggle - ONLY FOR STATISTICS */}
                                    <div className="flex bg-slate-100 p-1 rounded-lg">
                                        {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((tf) => (
                                            <button
                                                key={tf}
                                                onClick={() => { setStatsTimeFrame(tf); setStatsDate(new Date()); }}
                                                className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all uppercase tracking-wide ${
                                                    statsTimeFrame === tf 
                                                    ? 'bg-white text-slate-900 shadow-sm' 
                                                    : 'text-slate-500 hover:text-slate-900'
                                                }`}
                                            >
                                                {tf}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Date Picker / Navigation */}
                                    <div className="flex items-center gap-2 pr-2">
                                        <button onClick={() => handleDateNavigate('PREV')} className="p-1 hover:bg-slate-100 rounded text-slate-500">
                                            <ChevronLeft size={16} />
                                        </button>
                                        <div className="flex items-center gap-2 px-2 min-w-[120px] justify-center">
                                            <Calendar size={14} className="text-indigo-500" />
                                            <span className="text-xs font-bold text-slate-900">{getStatsDateLabel()}</span>
                                        </div>
                                        <button onClick={() => handleDateNavigate('NEXT')} className="p-1 hover:bg-slate-100 rounded text-slate-500">
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                             )}
                         </div>
                     </div>

                     {/* CONTENT FOR STATISTICS (ACTIVITY) */}
                     {currentView === 'STATISTICS' && (
                         <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-300">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110"></div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><Eye size={16}/></div>
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Views</span>
                                        </div>
                                        <div className="text-3xl font-black text-slate-900">
                                            {detailedStats.reduce((acc, curr) => acc + curr.views, 0).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 w-24 h-24 bg-pink-50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110"></div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="p-1.5 bg-pink-100 text-pink-600 rounded-lg"><Heart size={16} className="fill-current"/></div>
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Likes</span>
                                        </div>
                                        <div className="text-3xl font-black text-slate-900">
                                            {detailedStats.reduce((acc, curr) => acc + curr.likes, 0).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 w-24 h-24 bg-yellow-50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110"></div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="p-1.5 bg-yellow-100 text-yellow-600 rounded-lg"><Star size={16} className="fill-current"/></div>
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Rating</span>
                                        </div>
                                        <div className="text-3xl font-black text-slate-900">
                                            {(detailedStats.reduce((acc, curr) => acc + curr.rating, 0) / (detailedStats.length || 1)).toFixed(1)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <BarChart3 size={18} className="text-indigo-600" />
                                    Activity Breakdown - <span className="font-normal text-slate-500 ml-1">{getStatsDateLabel()}</span>
                                </h3>
                                
                                <div className="h-80 w-full">
                                    {isLoadingStats ? (
                                        <div className="h-full w-full flex items-center justify-center text-slate-400">Loading statistics...</div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={detailedStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorViewsStats" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#334155', fontSize: 12, fontWeight: 600}} dy={10} />
                                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#334155', fontSize: 12, fontWeight: 600}} />
                                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#334155', fontSize: 12, fontWeight: 600}} domain={[0, 5]} hide />
                                                <Tooltip 
                                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}
                                                    cursor={{fill: '#f8fafc'}}
                                                />
                                                <Legend wrapperStyle={{paddingTop: '20px'}} iconType="circle" />
                                                
                                                <Area yAxisId="left" type="monotone" dataKey="views" name="Profile Views" stroke="#8b5cf6" fill="url(#colorViewsStats)" strokeWidth={2} />
                                                <Bar yAxisId="left" dataKey="likes" name="Likes" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={20} />
                                                <Line yAxisId="right" type="monotone" dataKey="rating" name="Rating" stroke="#eab308" strokeWidth={2} dot={{r: 3, fill: '#eab308'}} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                         </>
                     )}

                     {/* CONTENT FOR FINANCE */}
                     {currentView === 'FINANCE' && (
                         <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-300">
                                
                                {/* 1. Total Revenue Card */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-40 relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                                    <div className="relative z-10 flex flex-col h-full justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><TrendingUp size={18}/></div>
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lifetime Revenue</span>
                                        </div>
                                        <div>
                                            <div className="text-3xl font-black text-slate-900 tracking-tight flex items-baseline gap-1">
                                                {stats.totalEarnings.toLocaleString()}
                                                <span className="text-sm font-bold text-slate-400">credits</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1 font-medium">Approx. ${(stats.totalEarnings / 100).toFixed(2)} USD</p>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Current Credits Card */}
                                <div className="bg-indigo-600 p-6 rounded-2xl border border-indigo-500 shadow-lg shadow-indigo-500/20 flex flex-col justify-between h-40 relative overflow-hidden text-white group">
                                    <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-xl group-hover:scale-110 transition-transform"></div>
                                    <div className="relative z-10 flex flex-col h-full justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-white/20 text-white rounded-xl backdrop-blur-sm"><Wallet size={18}/></div>
                                            <span className="text-xs font-bold text-indigo-100 uppercase tracking-wider">Available Balance</span>
                                        </div>
                                        <div>
                                            <div className="text-3xl font-black text-white tracking-tight flex items-baseline gap-1">
                                                {stats.totalEarnings.toLocaleString()} 
                                                {/* Note: Using totalEarnings as current balance for MVP simulation */}
                                                <span className="text-sm font-bold text-indigo-200">credits</span>
                                            </div>
                                            <p className="text-xs text-indigo-200 mt-1 font-medium">Ready to payout</p>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Withdraw Action Card */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center h-40 relative overflow-hidden">
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-slate-600 mb-4">Convert & Withdraw</p>
                                        <Button 
                                            onClick={handleWithdraw} 
                                            isLoading={isWithdrawing}
                                            disabled={stats.totalEarnings === 0}
                                            fullWidth
                                            className="bg-slate-900 text-white hover:bg-slate-800 h-12 shadow-md flex items-center justify-center gap-2"
                                        >
                                            <CreditCard size={16} /> 
                                            Withdraw ${(stats.totalEarnings / 100).toFixed(2)}
                                        </Button>
                                        <p className="text-[10px] text-slate-400 mt-3 text-center">
                                            Transfers typically take 1-3 business days.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* --- TRANSACTION HISTORY TABLE --- */}
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-3">
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                     <h3 className="text-sm font-bold text-slate-900">Credit History</h3>
                                     <Button variant="ghost" size="sm" className="text-xs"><ExternalLink size={14} className="mr-1"/> Export CSV</Button>
                                </div>
                                <div className="overflow-x-auto">
                                   <table className="w-full text-left text-sm whitespace-nowrap">
                                       <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 text-xs uppercase tracking-wider">
                                           <tr>
                                               <th className="px-6 py-3">Date</th>
                                               <th className="px-6 py-3">Source</th>
                                               <th className="px-6 py-3">Type</th>
                                               <th className="px-6 py-3">Status</th>
                                               <th className="px-6 py-3 text-right">Amount (Credits)</th>
                                           </tr>
                                       </thead>
                                       <tbody className="divide-y divide-slate-100">
                                           {messages.filter(m => m.status === MessageStatus.REPLIED).map(msg => (
                                               <tr key={msg.id} className="hover:bg-slate-50 transition-colors">
                                                   <td className="px-6 py-4 text-slate-500 font-mono text-xs">{new Date(msg.createdAt).toLocaleDateString()}</td>
                                                   <td className="px-6 py-4 font-medium text-slate-900">{msg.senderName}</td>
                                                   <td className="px-6 py-4">
                                                       <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
                                                           Message
                                                       </span>
                                                   </td>
                                                   <td className="px-6 py-4">
                                                       <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                                                           <CheckCircle2 size={12} /> Settled
                                                       </span>
                                                   </td>
                                                   <td className="px-6 py-4 text-right">
                                                       <span className="font-mono font-bold text-emerald-600">+{msg.amount}</span>
                                                   </td>
                                               </tr>
                                           ))}
                                           {messages.length === 0 && (
                                               <tr><td colSpan={5} className="p-12 text-center text-slate-400">No transaction history available.</td></tr>
                                           )}
                                       </tbody>
                                   </table>
                                </div>
                            </div>
                         </>
                     )}
                </div>
            )}

            {/* --- VIEW: ANALYTICS (Pro Feature) --- */}
            {currentView === 'ANALYTICS' && (
                <div className="max-w-6xl mx-auto animate-in fade-in relative min-h-[80vh]">
                    {/* Header - Always visible */}
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">Analytics Overview</h2>
                            <p className="text-slate-500 text-sm">Performance metrics for the last 30 days.</p>
                        </div>
                        <div className="flex gap-2">
                            <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50">Export Report</button>
                        </div>
                    </div>

                    {/* Loading State for Premium Users */}
                    {creator.isPremium && isLoadingAnalytics && (
                         <div className="h-96 flex items-center justify-center text-slate-400">Loading analytics...</div>
                    )}

                    {/* Content (Visible if premium loaded OR if not premium (dummy)) */}
                    {analyticsData && (
                        <>
                            {/* Lock Overlay for Non-Premium */}
                            {!creator.isPremium && (
                                <div className="absolute inset-0 z-30 flex items-center justify-center backdrop-blur-[2px]">
                                    <div className="bg-white/90 p-8 rounded-3xl shadow-2xl border border-white/50 text-center max-w-md w-full mx-4 flex flex-col items-center gap-6 transform transition-all hover:scale-105 duration-300">
                                        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-xl shadow-indigo-200 mb-2">
                                            <Lock size={32} className="text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 mb-2">Unlock Pro Analytics</h2>
                                            <p className="text-slate-500 text-sm leading-relaxed">
                                                See exactly where your traffic comes from and identify your highest converting products.
                                            </p>
                                        </div>
                                        <Button size="lg" onClick={() => setShowPremiumModal(true)} className="w-full bg-slate-900 hover:bg-slate-800 shadow-xl">
                                            Upgrade to Pro
                                        </Button>
                                        <p className="text-xs text-slate-400">30-day money-back guarantee.</p>
                                    </div>
                                </div>
                            )}

                            {/* Charts Layout - Blurred if not premium */}
                            <div className={`space-y-6 transition-all duration-500 ${!creator.isPremium ? 'filter blur-sm opacity-50 pointer-events-none select-none' : ''}`}>
                                
                                {/* 1. Key Metrics Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <Eye size={16} className="text-indigo-500"/> Profile Views
                                        </div>
                                        <div className="text-3xl font-black text-slate-900">
                                            {analyticsData.funnel.find(f => f.name === 'Profile Views')?.count.toLocaleString() || 0}
                                        </div>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <MousePointerClick size={16} className="text-blue-500"/> Interactions
                                        </div>
                                        <div className="text-3xl font-black text-slate-900">
                                            {analyticsData.funnel.find(f => f.name === 'Interactions')?.count.toLocaleString() || 0}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            {(() => {
                                                const views = analyticsData.funnel.find(f => f.name === 'Profile Views')?.count || 0;
                                                const interactions = analyticsData.funnel.find(f => f.name === 'Interactions')?.count || 0;
                                                return views > 0 ? ((interactions / views) * 100).toFixed(1) : '0.0';
                                            })()}% Engagement
                                        </div>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <CheckCircle2 size={16} className="text-emerald-500"/> Conversions
                                        </div>
                                        <div className="text-3xl font-black text-slate-900">
                                            {analyticsData.funnel.find(f => f.name === 'Conversions')?.count.toLocaleString() || 0}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            {(() => {
                                                const views = analyticsData.funnel.find(f => f.name === 'Profile Views')?.count || 0;
                                                const conversions = analyticsData.funnel.find(f => f.name === 'Conversions')?.count || 0;
                                                return views > 0 ? ((conversions / views) * 100).toFixed(1) : '0.0';
                                            })()}% Conversion Rate
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Traffic Sources Pie Chart */}
                                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                                            <PieIcon size={16} className="text-indigo-500" /> Traffic Sources
                                        </h3>
                                        <div className="h-64 flex items-center justify-center">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={analyticsData.trafficSources}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {analyticsData.trafficSources.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                                                    <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Conversion Funnel - Simplified Visual */}
                                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                                        <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                                            <TrendingUp size={16} className="text-emerald-500" /> Conversion Funnel
                                        </h3>
                                        <div className="flex-1 flex flex-col justify-center space-y-8">
                                            {analyticsData.funnel.map((step, index) => {
                                                const maxVal = analyticsData.funnel[0].count || 1;
                                                const percent = (step.count / maxVal) * 100;
                                                return (
                                                    <div key={step.name} className="relative">
                                                        <div className="flex justify-between text-sm font-medium mb-2">
                                                            <span className="text-slate-700">{step.name}</span>
                                                            <span className="text-slate-900 font-bold">{step.count.toLocaleString()}</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                                            <div 
                                                                className="h-full rounded-full transition-all duration-1000" 
                                                                style={{ width: `${percent}%`, backgroundColor: step.fill }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Top Performing Assets */}
                                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                                        <Star size={16} className="text-yellow-500" />
                                        <h3 className="text-sm font-bold text-slate-900">Top Performing Content</h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 text-xs uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-6 py-3">Asset</th>
                                                    <th className="px-6 py-3">Type</th>
                                                    <th className="px-6 py-3 text-right">Clicks</th>
                                                    <th className="px-6 py-3 text-right">CTR</th>
                                                    <th className="px-6 py-3 text-right">Revenue</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {analyticsData.topAssets.map((asset) => (
                                                    <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 font-bold text-slate-700">{asset.title}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${asset.type === 'PRODUCT' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                                                {asset.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-slate-600 font-mono">{asset.clicks.toLocaleString()}</td>
                                                        <td className="px-6 py-4 text-right font-bold text-indigo-600">{asset.ctr}</td>
                                                        <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">
                                                            {asset.revenue > 0 ? `${asset.revenue}` : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {currentView === 'INBOX' && (
                <div className="h-[calc(100vh-64px)] flex bg-white animate-in fade-in">
                    {/* ... (Inbox List & Detail Logic Unchanged) ... */}
                    {/* List Column */}
                    <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col ${selectedSenderEmail ? 'hidden md:flex' : 'flex'}`}>
                        <div className="p-4 border-b border-slate-200 flex flex-col gap-3">
                            <span className="font-bold text-slate-900">Messages</span>
                            <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg">
                                {(['ALL', 'PENDING', 'REPLIED', 'REJECTED'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setInboxFilter(f)}
                                        className={`flex-1 px-2 py-1.5 text-[10px] font-bold rounded transition-all whitespace-nowrap ${inboxFilter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
                            ) : filteredGroups.length === 0 ? (
                                <div className="p-8 text-center text-sm text-slate-400">No messages found.</div>
                            ) : (
                                filteredGroups.map(group => {
                                    const isActive = selectedSenderEmail === group.senderEmail;
                                    const latestMsg = group.latestMessage;
                                    const timeLeft = getTimeLeft(latestMsg.expiresAt);
                                    // Check unread based on role
                                    const lastChatRole = latestMsg.conversation[latestMsg.conversation.length - 1]?.role;
                                    const isUnread = incomingMessages.some(m => m.senderEmail === group.senderEmail && !m.isRead && (lastChatRole === 'FAN' || !lastChatRole));
                                    
                                    return (
                                        <div 
                                            key={group.senderEmail}
                                            onClick={() => handleOpenChat(group.senderEmail)}
                                            className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${isActive ? 'bg-blue-50/50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`text-sm font-semibold ${isUnread ? 'text-slate-900' : 'text-slate-600'}`}>
                                                    {group.senderName}
                                                    {isUnread && <span className="inline-block w-2 h-2 bg-blue-500 rounded-full ml-2"></span>}
                                                </span>
                                                <span className="text-xs text-slate-400">{new Date(latestMsg.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 line-clamp-2 mb-2">{latestMsg.content}</p>
                                            <div className="flex items-center justify-between">
                                                {latestMsg.status === 'PENDING' ? (
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${timeLeft.bg} ${timeLeft.color}`}>{timeLeft.text}</span>
                                                ) : latestMsg.status === 'REPLIED' ? (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">REPLIED</span>
                                                ) : (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{latestMsg.status === 'EXPIRED' ? 'EXPIRED' : 'REJECTED'}</span>
                                                )}
                                                <span className="text-xs font-mono font-medium text-slate-700 flex items-center gap-1"><Coins size={10}/> {group.messageCount}</span>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                    
                    {/* Detail Column */}
                    <div className={`flex-1 flex flex-col bg-slate-50 ${!selectedSenderEmail ? 'hidden md:flex' : 'flex'}`}>
                        {!activeMessage ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                    <Users size={32} className="text-slate-300" />
                                </div>
                                <p className="text-sm font-medium">Select a message to view details</p>
                            </div>
                        ) : (
                             <div className="h-full flex flex-col bg-white relative overflow-hidden">
                                {/* Collection Animation Overlay */}
                                {showCollectAnimation && (
                                    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-500">
                                        <div className="relative overflow-hidden bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 border border-white/10 ring-1 ring-white/20">
                                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20"></div>
                                            <div className="relative z-10 flex items-center gap-3">
                                                <div className="bg-gradient-to-tr from-emerald-400 to-teal-500 p-1.5 rounded-full shadow-lg shadow-emerald-500/20">
                                                    <Check size={14} className="text-white stroke-[3px]" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold">Credits Collected</p>
                                                </div>
                                            </div>
                                            <div className="relative z-10 w-px h-4 bg-white/20"></div>
                                            <div className="relative z-10 flex items-center gap-1.5 text-emerald-400 font-mono font-bold text-lg">
                                                <Plus size={14} strokeWidth={3} />
                                                {collectedAmount}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Header & Chat Content */}
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10 shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => setSelectedSenderEmail(null)} className="md:hidden p-2 -ml-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-700">
                                            <ChevronLeft size={20} />
                                        </button>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-slate-900">{activeMessage.senderName}</h3>
                                                {activeMessage.status === 'PENDING' && (
                                                    <button 
                                                        onClick={(e) => handleReject(e)}
                                                        disabled={isRejecting}
                                                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                        title="Reject & Refund"
                                                    >
                                                        <Ban size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                                <span className="font-mono font-medium flex items-center gap-1"><Coins size={10}/> {activeMessage.amount}</span>
                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                <span>{new Date(activeMessage.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        {activeMessage.status === 'PENDING' && (
                                            <div className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full flex items-center gap-1 border border-amber-100">
                                                <Clock size={12} /> {getTimeLeft(activeMessage.expiresAt).text}
                                            </div>
                                        )}
                                        {activeMessage.status === 'REPLIED' && (
                                            <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full flex items-center gap-1 border border-emerald-100">
                                                <CheckCircle2 size={12} /> Completed
                                            </div>
                                        )}
                                        {(activeMessage.status === 'EXPIRED' || activeMessage.status === 'CANCELLED') && (
                                            <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                                                Refunded
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 scroll-smooth flex flex-col" ref={scrollRef}>
                                    {threadMessages.map((msg, msgIndex) => (
                                        <div key={msg.id} className="mb-8">
                                            {/* Optional: Separator between requests if needed, or just stack them */}
                                            {msgIndex > 0 && (
                                                <div className="flex items-center justify-center my-6 opacity-40">
                                                    <div className="h-px bg-slate-300 w-16"></div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase px-2">New Request</span>
                                                    <div className="h-px bg-slate-300 w-16"></div>
                                                </div>
                                            )}
                                            {msg.conversation.map((chat, index) => {
                                        const isMe = chat.role === 'CREATOR';
                                        const nextMsg = msg.conversation[index + 1];
                                        const prevMsg = msg.conversation[index - 1];
                                        
                                        const getMinuteBucket = (ts: string) => Math.floor(new Date(ts).getTime() / 60000);
                                        const currentBucket = getMinuteBucket(chat.timestamp);
                                        const prevBucket = prevMsg ? getMinuteBucket(prevMsg.timestamp) : -1;
                                        const nextBucket = nextMsg ? getMinuteBucket(nextMsg.timestamp) : -1;

                                        const isLastInGroup = !nextMsg || nextMsg.role !== chat.role || nextBucket !== currentBucket;
                                        const isFirstInGroup = !prevMsg || prevMsg.role !== chat.role || prevBucket !== currentBucket;
                                        return (
                                            <div key={`${msg.id}-${index}`} className={`flex gap-4 ${isMe ? 'flex-row-reverse' : ''} ${isFirstInGroup ? 'mt-4' : 'mt-1'}`}>
                                                {!isMe && (
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border bg-indigo-100 text-indigo-600 border-indigo-200 ${isFirstInGroup ? '' : 'opacity-0 border-transparent'}`}>
                                                        {isFirstInGroup && <User size={18} />}
                                                    </div>
                                                )}
                                                
                                                <div className={`space-y-1 max-w-[85%] ${isMe ? 'text-right' : 'text-left'}`}>
                                                    <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap text-left ${isMe ? `bg-indigo-600 text-white ${isFirstInGroup ? 'rounded-tr-none' : 'rounded-tr-2xl'}` : `bg-white text-slate-800 border border-slate-200 ${isFirstInGroup ? 'rounded-tl-none' : 'rounded-tl-2xl'}`}`}>
                                                        {chat.content}
                                                        {!isMe && index === 0 && msg.attachmentUrl && (
                                                            <div className="mt-3 rounded-lg overflow-hidden border border-black/10">
                                                                <img src={msg.attachmentUrl} className="max-w-xs w-full object-cover" alt="attachment" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isLastInGroup && (
                                                        <span className="text-[10px] text-slate-400 block px-1">
                                                            {new Date(chat.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                        </div>
                                    ))}

                                    {activeMessage.status === 'EXPIRED' && (
                                        <div className="flex justify-center py-4 mt-4">
                                            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm border border-red-100 flex items-center gap-2">
                                                <AlertCircle size={16} /> Deadline missed. Refund issued.
                                            </div>
                                        </div>
                                    )}
                                    {activeMessage.status === 'CANCELLED' && (
                                        <div className="flex justify-center py-4 mt-4">
                                            <div className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm border border-slate-200 flex items-center gap-2">
                                                <Ban size={16} /> Request rejected & refunded.
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Reply Input Area */}
                                {activeMessage.status === 'PENDING' && (
                                    <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 font-medium">
                                                    <Coins size={12} /> Payment held in escrow
                                                </span>
                                            </div>
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                onClick={handleGenerateAI} 
                                                disabled={isGeneratingAI}
                                                className="text-xs h-7 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                            >
                                                <Sparkles size={12} className="mr-1.5" />
                                                {isGeneratingAI ? 'Drafting...' : 'AI Draft'}
                                            </Button>
                                        </div>

                                        <div className="relative">
                                            <textarea 
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                placeholder="Write your reply..."
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pb-12 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none min-h-[100px] text-slate-900"
                                            />
                                            
                                            <div className="absolute bottom-3 right-3 flex items-center gap-3">
                                                <button 
                                                    onClick={() => handleSendReply(false)} 
                                                    disabled={!replyText.trim() || isSendingReply || isRejecting}
                                                    className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-white hover:shadow-md hover:text-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed group border border-transparent hover:border-slate-100"
                                                    title="Send reply (Keep Pending)"
                                                >
                                                    <Send size={18} className="ml-0.5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                                                </button>

                                                <button 
                                                    onClick={() => handleSendReply(true)} 
                                                    disabled={(!replyText.trim() && !hasManualCreatorReply) || isSendingReply || isRejecting}
                                                    className="h-10 px-5 rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold group"
                                                    title="Complete & Collect"
                                                >
                                                    <CheckCircle2 size={18} className="text-emerald-400" />
                                                    <span>Collect {activeMessage.amount}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                             </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- VIEW: SETTINGS (Profile) --- */}
            {currentView === 'SETTINGS' && (
                <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    {/* ... (Existing Settings Code) ... */}
                    {/* Magical Success Message */}
                    {showSaveSuccess && (
                        <div className="fixed bottom-8 right-8 z-[60] max-w-sm animate-in slide-in-from-bottom-4">
                            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 rounded-2xl p-5 text-center shadow-2xl shadow-indigo-500/30 ring-1 ring-white/20">
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
                         <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-6 text-white shadow-lg flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2"><Sparkles className="text-yellow-300 fill-yellow-300" size={18}/> Bluechecked Pro</h3>
                                <p className="text-indigo-100 text-sm mt-1">Upgrade to unlock analytics and remove commissions.</p>
                            </div>
                            <Button className="bg-white text-indigo-600 hover:bg-indigo-50" onClick={() => setShowPremiumModal(true)}>Upgrade for 2000 Credits/mo</Button>
                        </div>
                    )}

                    <div className="bg-white p-6 rounded-xl border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-2">Profile Settings</h3>
                        
                        <div className="space-y-6">
                            {/* ... Profile Settings Form (Unchanged) ... */}
                            {/* Avatar Edit */}
                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
                                    <img 
                                        src={editedCreator.avatarUrl || DEFAULT_AVATAR} 
                                        alt="Avatar Preview" 
                                        className="w-full h-full object-cover" 
                                        onError={(e) => {
                                            e.currentTarget.src = DEFAULT_AVATAR;
                                        }}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Profile Photo</label>
                                    <div className="flex gap-2">
                                        {editedCreator.avatarUrl?.startsWith('data:') || (editedCreator.avatarUrl?.length || 0) > 1000 ? (
                                            <div className="flex items-center gap-2 w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 text-sm">
                                                <span className="truncate flex-1">Image uploaded from device</span>
                                                <button onClick={() => setEditedCreator({...editedCreator, avatarUrl: ''})} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                                            </div>
                                        ) : (
                                            <input 
                                                type="text" 
                                                value={editedCreator.avatarUrl}
                                                onChange={e => setEditedCreator({...editedCreator, avatarUrl: e.target.value})}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="https://..."
                                            />
                                        )}
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                                        >
                                            <Camera size={16} /> Upload
                                        </button>
                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarFileChange} />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Upload from desktop or paste an image URL.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
                                <input 
                                    type="text" 
                                    value={editedCreator.displayName}
                                    onChange={e => setEditedCreator({...editedCreator, displayName: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Bio</label>
                                <textarea 
                                    value={editedCreator.bio}
                                    onChange={e => setEditedCreator({...editedCreator, bio: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                                />
                            </div>

                             {/* New Welcome Message Field */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Auto-Reply Welcome Message</label>
                                <textarea 
                                    value={editedCreator.welcomeMessage || ''}
                                    onChange={e => setEditedCreator({...editedCreator, welcomeMessage: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                                    placeholder="Hi! Thanks for your message. I'll get back to you soon..."
                                />
                                <p className="text-[10px] text-slate-400 mt-1">This is sent automatically when a fan pays.</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Price (Credits)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-500"><Coins size={14}/></span>
                                        <input 
                                            type="number" 
                                            value={editedCreator.pricePerMessage}
                                            onChange={e => setEditedCreator({...editedCreator, pricePerMessage: Number(e.target.value)})}
                                            className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Response Time</label>
                                    <select 
                                        value={editedCreator.responseWindowHours}
                                        onChange={e => setEditedCreator({...editedCreator, responseWindowHours: Number(e.target.value)})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value={24}>24 Hours</option>
                                        <option value={48}>48 Hours</option>
                                        <option value={72}>72 Hours</option>
                                    </select>
                                </div>
                            </div>

                            {/* REPLACED TAGS WITH PLATFORM SELECTOR */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Connected Platforms</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {SUPPORTED_PLATFORMS.map(platform => {
                                        const isSelected = editedCreator.platforms?.includes(platform.id);
                                        return (
                                            <button 
                                                key={platform.id}
                                                onClick={() => handleTogglePlatform(platform.id)}
                                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                                                    isSelected 
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                <platform.icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                                                <span className="text-xs font-bold">{platform.label}</span>
                                                {isSelected && <Check size={12} className="ml-auto text-green-400" />}
                                            </button>
                                        )
                                    })}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2">These icons will appear on your public profile.</p>
                            </div>
                            
                            {/* Featured Links Section - UPDATED with Digital Products */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Featured Links & Products</label>
                                <div className="space-y-3 mb-3">
                                    {(editedCreator.links || []).map(link => {
                                        const isProduct = link.type === 'DIGITAL_PRODUCT';
                                        return (
                                            <div key={link.id} className={`flex items-start gap-3 p-3 rounded-lg border ${isProduct ? 'bg-purple-50 border-purple-100' : 'bg-slate-50 border-slate-200'}`}>
                                                <div className="flex-1 min-w-0 space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full w-fit ${isProduct ? 'bg-purple-100 text-purple-600' : 'bg-slate-200 text-slate-500'}`}>
                                                            {isProduct ? 'Digital Download' : 'Link'}
                                                        </div>
                                                        {isProduct && <span className="text-xs font-bold text-slate-900">{link.price} Credits</span>}
                                                    </div>
                                                    
                                                    <input 
                                                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
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
                                                                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none pr-8"
                                                                    value={link.url}
                                                                    onChange={(e) => handleUpdateLink(link.id, 'url', e.target.value)}
                                                                    placeholder="File URL"
                                                                    readOnly
                                                                />
                                                                <button 
                                                                    onClick={() => document.getElementById(`update-file-${link.id}`)?.click()}
                                                                    className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-50 whitespace-nowrap"
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
                                                            <div className="absolute inset-0 bg-indigo-50/90 border-2 border-dashed border-indigo-300 rounded flex items-center justify-center opacity-0 group-hover/upload:opacity-100 pointer-events-none transition-opacity z-10">
                                                                <span className="text-[10px] font-bold text-indigo-600">Drop new file to replace</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <input 
                                                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                            value={link.url}
                                                            onChange={(e) => handleUpdateLink(link.id, 'url', e.target.value)}
                                                            placeholder="https://..."
                                                        />
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="checkbox" 
                                                            id={`promo-${link.id}`}
                                                            checked={link.isPromoted || false}
                                                            onChange={(e) => handleUpdateLink(link.id, 'isPromoted', e.target.checked)}
                                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <label htmlFor={`promo-${link.id}`} className="text-xs text-slate-500 cursor-pointer flex items-center gap-1">
                                                            {link.isPromoted ? <Sparkles size={10} className="text-indigo-500"/> : null}
                                                            Highlight
                                                        </label>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleRemoveLink(link.id)} className="text-slate-400 hover:text-red-500 p-1 mt-1">
                                                    <Trash size={16} />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-slate-500 uppercase">Add New Item</span>
                                        <div className="flex bg-white rounded-lg p-0.5 border border-slate-200">
                                            <button 
                                                onClick={() => setNewLinkType('EXTERNAL')}
                                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${newLinkType === 'EXTERNAL' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                                            >
                                                Link
                                            </button>
                                            <button 
                                                onClick={() => setNewLinkType('DIGITAL_PRODUCT')}
                                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${newLinkType === 'DIGITAL_PRODUCT' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                                            >
                                                Digital Product
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <input 
                                            type="text" 
                                            placeholder="Title (e.g. My Course / Portfolio)" 
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={newLinkTitle}
                                            onChange={e => setNewLinkTitle(e.target.value)}
                                        />
                                        {newLinkType === 'DIGITAL_PRODUCT' ? (
                                            <div 
                                                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all ${isUploadingProduct ? 'bg-slate-50 border-slate-300' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer'}`}
                                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                onDrop={handleProductDrop}
                                                onClick={() => !isUploadingProduct && !newLinkUrl && productFileInputRef.current?.click()}
                                            >
                                                <input type="file" ref={productFileInputRef} className="hidden" onChange={handleProductFileChange} />
                                                
                                                {isUploadingProduct ? (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                                                        <span className="text-xs font-medium text-slate-500">Uploading...</span>
                                                    </div>
                                                ) : newLinkUrl ? (
                                                    <div className="flex flex-col items-center gap-2 w-full">
                                                        <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                                                            <Check size={20} />
                                                        </div>
                                                        <p className="text-sm font-medium text-slate-900">File Ready</p>
                                                        <p className="text-xs text-slate-400 break-all max-w-full truncate px-4">{newLinkUrl.length > 30 ? '...' + newLinkUrl.slice(-20) : newLinkUrl}</p>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setNewLinkUrl(''); }}
                                                            className="text-xs text-red-500 hover:text-red-700 font-bold mt-2 bg-red-50 px-3 py-1.5 rounded-full"
                                                        >
                                                            Remove File
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-2">
                                                            <Download size={20} className="rotate-180" />
                                                        </div>
                                                        <p className="text-sm font-medium text-slate-700">Upload from local disk</p>
                                                        <p className="text-xs text-slate-400 mt-1">PDF, Video, or Image (Max 50MB)</p>
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <input 
                                                type="text" 
                                                placeholder="URL (https://...)"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                value={newLinkUrl}
                                                onChange={e => setNewLinkUrl(e.target.value)}
                                            />
                                        )}
                                        {newLinkType === 'DIGITAL_PRODUCT' && (
                                            <div className="relative">
                                                <span className="absolute left-3 top-2 text-slate-500 text-sm"><Coins size={14}/></span>
                                                <input 
                                                    type="number" 
                                                    placeholder="Price (Credits)"
                                                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    value={newLinkPrice}
                                                    onChange={e => setNewLinkPrice(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <Button size="sm" onClick={handleAddLink} type="button" fullWidth className="mt-2">
                                        <Plus size={16} className="mr-1"/> Add {newLinkType === 'DIGITAL_PRODUCT' ? 'Product' : 'Link'}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                            <Button onClick={handleSaveProfile} isLoading={isSavingProfile}>Save Changes</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- VIEW: NOTIFICATIONS --- */}
            {currentView === 'NOTIFICATIONS' && (
                <div className="p-6 max-w-3xl mx-auto animate-in fade-in">
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-500">{notifications.length} items</span>
                                {notifications.length > 0 && (
                                    <button 
                                        onClick={handleClearAllNotifications}
                                        className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                    >
                                        <Trash size={12} /> Clear All
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {notifications.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 text-sm">No notifications yet.</div>
                            ) : (
                                notifications.map(notif => (
                                    <div key={notif.id} className="px-6 py-4 hover:bg-slate-50 transition-colors flex gap-4 group relative">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${notif.color}`}>
                                            <notif.icon size={18} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-slate-900 font-medium mb-1">{notif.text}</p>
                                            <p className="text-xs text-slate-500">{notif.time.toLocaleString()}</p>
                                        </div>
                                        <button onClick={(e) => handleDeleteNotification(e, notif.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- VIEW: REVIEWS --- */}
            {currentView === 'REVIEWS' && (
                <div className="p-6 max-w-5xl mx-auto animate-in fade-in">
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900">All Reviews</h3>
                            <span className="text-xs text-slate-500">{reviews.length} reviews</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {reviews.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 text-sm">No reviews yet.</div>
                            ) : (
                                reviews.map(review => (
                                    <div key={review.id} className="p-6 hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-900 text-sm">{review.senderName}</span>
                                                <div className="flex gap-0.5">
                                                    {[1,2,3,4,5].map(i => (
                                                        <Star key={i} size={14} className={`${(review.rating || 0) >= i ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}`}/>
                                                    ))}
                                                </div>
                                            </div>
                                            <span className="text-xs text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        {/* @ts-ignore */}
                                        <p className="text-sm text-slate-600 italic mb-2">"{review.reviewContent || "No written review"}"</p>
                                        <div className="text-xs text-slate-400">
                                            Session Amount: <span className="font-medium text-slate-600">{review.amount} Credits</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
      </main>

      {/* Premium Upgrade Modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative">
                <button onClick={() => setShowPremiumModal(false)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 z-10 transition-colors"><X size={20}/></button>
                
                {/* Header Graphic */}
                <div className="h-40 bg-slate-900 relative overflow-hidden flex items-center justify-center">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/30 rounded-full blur-[80px]"></div>
                     <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/30 rounded-full blur-[80px]"></div>
                     <div className="relative z-10 text-center">
                         <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1 rounded-full text-xs font-bold text-white mb-3 backdrop-blur-md">
                             <Sparkles size={12} className="text-yellow-400" /> RECOMMENDED
                         </div>
                         <h2 className="text-3xl font-black text-white tracking-tight">Bluechecked Pro</h2>
                     </div>
                </div>

                <div className="p-8">
                    <div className="flex items-baseline justify-center gap-1 mb-8">
                        <span className="text-5xl font-black text-slate-900">2000</span>
                        <span className="text-slate-500 font-medium">credits / mo</span>
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
                                <span className="text-slate-700 font-medium">{feature}</span>
                            </div>
                        ))}
                    </div>

                    <Button 
                        fullWidth 
                        size="lg" 
                        onClick={handleUpgradeToPremium}
                        isLoading={isUpgrading}
                        className="bg-slate-900 hover:bg-slate-800 text-white h-14 text-lg font-bold shadow-xl shadow-slate-900/20"
                    >
                        Upgrade Now
                    </Button>
                    <p className="text-center text-xs text-slate-400 mt-4">Cancel anytime. Secure checkout.</p>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
