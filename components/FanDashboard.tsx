
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CurrentUser, Message, CreatorProfile } from '../types';
import { Button } from './Button';
import { BlueCheckLogo, CheckCircle2, MessageSquare, Clock, LogOut, ExternalLink, ChevronRight, User, AlertCircle, Check, Trash, Paperclip, ChevronLeft, Send, Ban, Star, DollarSign, Plus, X, Heart, Sparkles, Camera, Save, ShieldCheck, Home, Settings, Menu, Bell, Search, Wallet, TrendingUp, ShoppingBag, FileText, Image as ImageIcon, Video, Link as LinkIcon, Lock, HelpCircle, Receipt, ArrowRight, Play, Trophy, MonitorPlay, LayoutGrid, Flame, InstagramLogo, Twitter, Youtube, Twitch, Music2, TikTokLogo, XLogo, YouTubeLogo, Coins, CreditCard, RefreshCw, Download, Smile } from './Icons';
import { getMessages, cancelMessage, sendMessage, rateMessage, sendFanAppreciation, updateCurrentUser, getFeaturedCreators, addCredits, isBackendConfigured, subscribeToMessages, getPurchasedProducts, getSecureDownloadUrl } from '../services/realBackend';

interface Props {
  currentUser: CurrentUser | null;
  onLogout: () => void;
  onBrowseCreators: (creatorId: string) => void;
  onUpdateUser?: (user: CurrentUser) => void;
}

const getResponseTimeTooltip = (status: string) => {
    if (status === 'Lightning') return 'Typically replies in under 1 hour';
    if (status === 'Very Fast') return 'Typically replies in under 4 hours';
    if (status === 'Fast') return 'Typically replies within 24 hours';
    return 'Replies within the guaranteed response window';
};

// Instagram/Threads style relative time
const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const FanDashboard: React.FC<Props> = ({ currentUser, onLogout, onBrowseCreators, onUpdateUser }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [featuredCreators, setFeaturedCreators] = useState<CreatorProfile[]>([]);
  const [purchasedProducts, setPurchasedProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<'ALL' | 'DOCUMENT' | 'IMAGE' | 'VIDEO'>('ALL');
  
  // Navigation State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'OVERVIEW' | 'EXPLORE' | 'SETTINGS' | 'PURCHASED' | 'HISTORY' | 'SUPPORT' | 'NOTIFICATIONS'>('OVERVIEW');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [exploreQuery, setExploreQuery] = useState('');

  const [showNotifications, setShowNotifications] = useState(false);
  const [deletedNotificationIds, setDeletedNotificationIds] = useState<string[]>(() => {
      try {
          const saved = localStorage.getItem('bluechecked_deleted_notifications');
          return saved ? JSON.parse(saved) : [];
      } catch {
          return [];
      }
  });

  const [lastReadTime, setLastReadTime] = useState<number>(() => {
      try {
          return parseInt(localStorage.getItem('bluechecked_fan_last_read_time') || '0');
      } catch { return 0; }
  });

  // Chat Reaction State
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);

  const handleReactionClick = (msgId: string, emoji: string) => {
      setMessageReactions(prev => {
          const current = prev[msgId];
          if (current === emoji) {
              const next = { ...prev };
              delete next[msgId];
              return next;
          }
          return { ...prev, [msgId]: emoji };
      });
      setActiveReactionPicker(null);
  };

  // Pagination State
  const [historyPage, setHistoryPage] = useState(1);
  const [notificationPage, setNotificationPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
      localStorage.setItem('bluechecked_deleted_notifications', JSON.stringify(deletedNotificationIds));
  }, [deletedNotificationIds]);
  // UI States
  const [isCancelling, setIsCancelling] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const [showFollowUpInput, setShowFollowUpInput] = useState(false);
  const [followUpText, setFollowUpText] = useState('');
  const [reviewText, setReviewText] = useState('');

  // Rating & Appreciation
  const [rating, setRating] = useState(0); 
  const [hoveredStar, setHoveredStar] = useState(0); 
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [showRatingSuccess, setShowRatingSuccess] = useState(false);
  
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
  const [topUpAmount, setTopUpAmount] = useState(1000);
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Real-time Subscription
    if (currentUser) {
        const { unsubscribe } = subscribeToMessages(currentUser.id, () => {
            loadMessages(true);
        });
        return () => unsubscribe();
    }
  }, [currentUser]);

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

  const loadMessages = async (silent = false) => {
    if (!silent) setIsLoading(true);
    const allMessages = await getMessages();
    const myMessages = allMessages.filter(m => 
      m.senderEmail === (currentUser?.email || 'sarah@example.com') || 
      currentUser?.email === 'google-user@example.com'
    );
    // Sort descending for list view
    myMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setMessages(myMessages.length > 0 ? myMessages : allMessages.slice(0, 2));
    if (!silent) setIsLoading(false);
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
      
      const groups: Record<string, { creatorId: string, creatorName: string, creatorAvatarUrl?: string, latestMessage: Message, messageCount: number }> = {};
      
      messages.forEach(msg => {
          if (msg.content.startsWith('Purchased Product:')) return;

          const cId = msg.creatorId || 'unknown';
          if (!groups[cId]) {
              groups[cId] = {
                  creatorId: cId,
                  creatorName: msg.creatorName || 'Creator',
                  creatorAvatarUrl: msg.creatorAvatarUrl,
                  latestMessage: msg,
                  messageCount: 0
              };
          }
          groups[cId].messageCount++;
          if (new Date(msg.createdAt) > new Date(groups[cId].latestMessage.createdAt)) {
              groups[cId].latestMessage = msg;
          }
      });
      
      return Object.values(groups);
  }, [messages]);

  const filteredGroups = useMemo(() => {
      return conversationGroups.filter(g => 
          g.creatorName.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [conversationGroups, searchQuery]);

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
      return messages
        .filter(m => m.creatorId === selectedCreatorId && !m.content.startsWith('Purchased Product:'))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, selectedCreatorId]);

  const latestMessage = threadMessages.length > 0 ? threadMessages[threadMessages.length - 1] : null;

  const currentCreator = useMemo(() => {
      return featuredCreators.find(c => c.id === selectedCreatorId);
  }, [featuredCreators, selectedCreatorId]);

  const [showReadCelebration, setShowReadCelebration] = useState(false);
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
      if (msg.status === 'REPLIED') return { label: 'Creator collected', color: 'text-emerald-600', icon: CheckCircle2 };
      if (msg.status === 'EXPIRED') return { label: 'Expired', color: 'text-stone-400', icon: Ban };
      if (msg.status === 'CANCELLED') return { label: 'Cancelled', color: 'text-red-600', icon: Ban };
      
      // PENDING
      const lastChat = msg.conversation[msg.conversation.length - 1];
      if (lastChat?.role === 'CREATOR') {
          return { label: 'Creator answered', color: 'text-stone-700', icon: MessageSquare };
      }
      
      if (msg.isRead) {
          return { label: 'Read', color: 'text-stone-600', icon: Check };
      }
      
      return { label: 'Not yet read', color: 'text-stone-400', icon: Clock };
  };

  // Derived state for UI logic
  const hasRated = !!(latestMessage?.rating && latestMessage.rating > 0);
  const hasThanked = useMemo(() => {
      return latestMessage?.conversation.some(c => c.role === 'FAN' && c.content.startsWith('Fan Appreciation:'));
  }, [latestMessage]);

  const handleOpenChat = (creatorId: string) => {
      setSelectedCreatorId(creatorId); 
      setShowFollowUpInput(false);
      setFollowUpText('');
      setCustomAppreciationMode(false);
      setCustomAppreciationText('');
      setRating(0);
      setHoveredStar(0);
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
        alert("Failed to cancel message. Please try again.");
    } finally {
        setIsCancelling(false);
    }
  };

  const handleSendFollowUp = async () => {
      if (!latestMessage || !followUpText.trim()) return;
      setIsSendingFollowUp(true);
      try {
          await sendMessage(latestMessage.creatorId || '', latestMessage.senderName, latestMessage.senderEmail, followUpText, latestMessage.amount);
          await loadMessages(true);
          setShowFollowUpInput(false);
          setFollowUpText('');
          setToastMessage("Follow-up Sent!");
          setTimeout(() => setToastMessage(null), 3000);
          // Refresh user balance if updated
          if (onUpdateUser && currentUser) {
              onUpdateUser({ ...currentUser, credits: currentUser.credits - latestMessage.amount });
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

  const handleSubmitRating = async () => {
      if (!latestMessage || rating === 0) return;
      setIsSubmittingRating(true);
      try {
          // Optimistic update for immediate feedback
          setMessages(prev => prev.map(m => m.id === latestMessage.id ? { ...m, rating, reviewContent: reviewText } : m));
          
          await rateMessage(latestMessage.id, rating, reviewText);
          loadMessages(true); // Background refresh
          
          setRating(0); 
          setHoveredStar(0);
          setShowRatingSuccess(true);
          setTimeout(() => setShowRatingSuccess(false), 2000);
      } catch (e: any) { 
          console.error(e); 
          alert(`Failed to submit rating: ${e.message || "Please try again."}`);
          loadMessages(true); // Revert on error
      } finally { setIsSubmittingRating(false); }
  };

  const handleSendAppreciation = async (msgId: string, text: string) => {
      try {
          await sendFanAppreciation(msgId, text);
          setCustomAppreciationText('');
          setCustomAppreciationMode(false);
          await loadMessages(true);
          setToastMessage("Appreciation Sent!");
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

  const handleTopUp = async () => {
      setIsProcessingTopUp(true);
      try {
          // Simulate API delay
          await new Promise(r => setTimeout(r, 1500));
          const updatedUser = await addCredits(topUpAmount);
          if (onUpdateUser) onUpdateUser(updatedUser);
          setShowTopUpModal(false);
      } catch (e) {
          console.error(e);
          alert("Top up failed");
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
              alert("Please upload a valid image file (JPEG, PNG).");
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
    if (diff < 0) return { text: 'Expired', color: 'text-red-600', bg: 'bg-red-50' };
    return { text: `${hours}h left`, color: 'text-stone-500', bg: 'bg-stone-100' };
  };

  const activeRequests = messages.filter(m => m.status === 'PENDING').length;
  
  const notifications = useMemo(() => {
      const list: { id: string, icon: any, text: string, time: Date, color: string, creatorId?: string }[] = [];
      
      // Add Welcome Notification (Ensures list is never empty on first load)
      list.push({
          id: 'welcome',
          icon: Sparkles,
          text: 'Welcome to Bluechecked! Find a creator to start.',
          time: new Date(),
          color: 'bg-stone-100 text-stone-600'
      });

      messages.forEach(msg => {
          const isProduct = msg.content.startsWith('Purchased Product:');

          // 1. Sent Request
          if (!isProduct) {
              list.push({
                  id: `sent-${msg.id}`,
                  icon: Send,
                  text: `You sent a request to ${msg.creatorName || 'Creator'}`,
                  time: new Date(msg.createdAt),
                  color: 'bg-stone-100 text-stone-700',
                  creatorId: msg.creatorId
              });
          }

          // 2. Reply Received
          if (msg.status === 'REPLIED' && msg.replyAt && !isProduct) {
              list.push({
                  id: `reply-${msg.id}`,
                  icon: MessageSquare,
                  text: `${msg.creatorName || 'Creator'} replied to your request!`,
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
                  text: `Request to ${msg.creatorName || 'Creator'} expired. ${msg.amount} credits refunded.`,
                  time: new Date(msg.expiresAt),
                  color: 'bg-amber-100 text-amber-600',
                  creatorId: msg.creatorId
              });
          }

          // 4. Rejected (Cancelled)
          if (msg.status === 'CANCELLED') {
               list.push({
                  id: `can-${msg.id}`,
                  icon: Ban,
                  text: `Request to ${msg.creatorName || 'Creator'} was rejected.`,
                  time: new Date(msg.createdAt), // Fallback
                  color: 'bg-red-100 text-red-600',
                  creatorId: msg.creatorId
              });
          }

          // 5. Product Purchased
          if (isProduct) {
               const productName = msg.content.replace('Purchased Product: ', '');
               list.push({
                  id: `purch-${msg.id}`,
                  icon: ShoppingBag,
                  text: `You purchased ${productName}`,
                  time: new Date(msg.createdAt),
                  color: 'bg-purple-100 text-purple-600',
                  creatorId: msg.creatorId
              });
          }
      });

      return list
        .filter(n => !deletedNotificationIds.includes(n.id))
        .sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [messages, deletedNotificationIds]);

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

  const handleToggleNotifications = () => {
      if (!showNotifications) {
          setLastReadTime(Date.now());
          localStorage.setItem('bluechecked_fan_last_read_time', Date.now().toString());
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
      if (selectedCreatorId) return 'Conversation';
      switch (currentView) {
          case 'OVERVIEW': return 'Conversations';
          case 'EXPLORE': return 'Explore Creators';
          case 'PURCHASED': return 'Purchased Content';
          case 'HISTORY': return 'Purchase History';
          case 'SUPPORT': return 'Support';
          case 'SETTINGS': return 'Profile Settings';
          case 'NOTIFICATIONS': return 'Notifications';
          default: return 'Dashboard';
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
          case 'twitch': return <Twitch size={size} className={`${cn} ${variant === 'colored' ? 'text-purple-600' : ''}`} />;
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
              setCurrentView(view); 
              setSelectedCreatorId(null); 
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
        <span className="font-bold text-xs uppercase tracking-wider text-stone-500 bg-white/80 px-3 py-1 rounded-full border border-stone-100">Coming Soon</span>
      </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex font-sans text-stone-900 overflow-hidden">
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
            className="fixed inset-0 bg-stone-900/50 z-20 md:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* 1. SIDEBAR */}
        <aside className={`fixed inset-y-0 left-0 w-64 bg-[#F5F3EE] border-r border-stone-200 transform transition-transform duration-300 z-30 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
            <div className="p-4 h-full flex flex-col">
                {/* Brand */}
                <div 
                    onClick={() => { setCurrentView('OVERVIEW'); setSelectedCreatorId(null); }}
                    className="flex items-center gap-2 px-3 py-4 mb-6 cursor-pointer hover:opacity-80 transition-opacity"
                >
                    <BlueCheckLogo size={28} className="text-stone-900" />
                    <span className="font-bold text-stone-900 tracking-tight">BLUECHECKED</span>
                </div>

                {/* Nav Links */}
                <div className="space-y-1 flex-1">
                    <div className="px-3 mb-2 text-xs font-bold text-stone-400 uppercase tracking-wider">Fan Menu</div>
                    <SidebarItem icon={Home} label="Conversations" view="OVERVIEW" />
                    <SidebarItem icon={Search} label="Explore Creators" view="EXPLORE" />
                    <SidebarItem icon={ShoppingBag} label="Purchased" view="PURCHASED" isBeta={true} />
                    <SidebarItem icon={Bell} label="Notifications" view="NOTIFICATIONS" />
                    {/* Wallet now acts as a trigger for the modal, not a separate view */}
                    <SidebarItem icon={Wallet} label="My Wallet" onClick={() => setShowTopUpModal(true)} />
                    <SidebarItem icon={Receipt} label="Purchase History" view="HISTORY" />
                    <SidebarItem icon={HelpCircle} label="Support" view="SUPPORT" />
                    
                    <div className="my-4 mx-3 border-t border-stone-200"></div>
                    <SidebarItem icon={User} label="Profile" view="SETTINGS" />
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
                    <div className="mt-3 flex flex-col items-center gap-1">
                        <div className="text-[10px] text-stone-400 font-mono opacity-50">v3.6.30</div>
                        <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${isBackendConfigured() ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                            {isBackendConfigured() ? '● LIVE DB' : '○ MOCK DB'}
                        </div>
                    </div>
                </div>
            </div>
        </aside>

        {/* 2. MAIN CONTENT */}
        <main className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden relative">
            {/* Demo Banner */}
            {!isBackendConfigured() && (
                <div className="bg-stone-800 text-white text-[10px] font-semibold px-4 py-1 text-center z-50">
                    DEMO MODE: Supabase not configured. Showing mock data.
                </div>
            )}
            {/* Header */}
            <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-6 shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500">
                        <Menu size={20} />
                    </button>
                    <h2 className="font-semibold text-stone-800">
                        {getPageTitle()}
                    </h2>
                </div>
                {!selectedCreatorId && (
                     <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setShowTopUpModal(true)}
                            className="hidden sm:flex items-center gap-2 bg-stone-100 hover:bg-stone-200 transition-colors px-3 py-1.5 rounded-full text-xs font-bold text-stone-600 cursor-pointer"
                        >
                            <Coins size={14} className="text-stone-500" />
                            {currentUser?.credits || 0} Credits
                        </button>
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
                                    <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)}></div>
                                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-stone-100 z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <div className="px-4 py-3 border-b border-stone-50 bg-stone-50/50 flex justify-between items-center">
                                            <h3 className="font-bold text-sm text-stone-900">Notifications</h3>
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{notifications.length} Updates</span>
                                        </div>
                                        <div className="max-h-[320px] overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="p-8 text-center text-stone-400 text-xs">No notifications yet.</div>
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
                                                        <div>
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
                )}
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-auto relative bg-[#FAF9F6]">
                
                {/* --- VIEW: PURCHASED (BETA) --- */}
                {currentView === 'PURCHASED' && (
                    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in">
                        <div className="bg-stone-900 text-white p-8 rounded-2xl relative overflow-hidden mb-8">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="bg-white/10 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border border-white/10">Beta Access</span>
                                        <Sparkles size={14} className="text-stone-400" />
                                    </div>
                                    <h3 className="font-bold text-2xl md:text-3xl mb-2">My Library</h3>
                                    <p className="text-stone-400 text-sm max-w-lg leading-relaxed">
                                        Your collection of premium digital assets, guides, and exclusive content from creators you support.
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
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
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
                                     {type === 'ALL' ? 'All Content' : type === 'DOCUMENT' ? 'Documents' : type === 'IMAGE' ? 'Images' : 'Videos'}
                                 </button>
                             ))}
                        </div>

                        {isLoading ? (
                            <div className="text-center py-20 text-stone-400">Loading library...</div>
                        ) : filteredProducts.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredProducts.map((product, idx) => (
                                    <div key={idx} className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col h-full relative">
                                <div className="aspect-[4/3] bg-stone-100 relative overflow-hidden flex items-center justify-center p-8 group-hover:bg-stone-50 transition-colors">
                                     <div className="bg-white shadow-lg p-0 w-24 h-32 rounded-sm border border-stone-200 relative transform group-hover:-rotate-3 transition-transform duration-500 flex items-center justify-center">
                                         <div className="absolute inset-x-2 top-2 bottom-2 border-2 border-dashed border-stone-100"></div>
                                         {(() => {
                                             const type = getFileType(product.url);
                                             if (type === 'IMAGE') return <ImageIcon size={32} className="text-purple-500" />;
                                             if (type === 'VIDEO') return <Video size={32} className="text-blue-500" />;
                                             return <FileText size={32} className="text-red-500" />;
                                         })()}
                                     </div>
                                     <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-stone-500 border border-stone-200">
                                         {getFileType(product.url)}
                                     </div>
                                </div>
                                <div className="p-5 flex flex-col flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-5 h-5 rounded-full bg-stone-200 overflow-hidden">
                                            <img src={product.creatorAvatar || 'https://via.placeholder.com/100'} alt="Creator" className="w-full h-full object-cover"/>
                                        </div>
                                        <span className="text-[10px] font-bold text-stone-500">{product.creatorName}</span>
                                    </div>
                                    <h4 className="font-bold text-stone-900 mb-1 leading-tight">{product.title}</h4>
                                    <p className="text-xs text-stone-500 mb-4 line-clamp-2 flex-1">{product.description || 'Digital Download'}</p>
                                    <div className="mt-auto pt-4 border-t border-stone-50 flex justify-between items-center">
                                        <span className="text-[10px] text-stone-400">{new Date(product.purchaseDate).toLocaleDateString()}</span>
                                        <button 
                                            className="text-xs font-semibold text-stone-700 hover:underline flex items-center gap-1"
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                try {
                                                    const secureUrl = await getSecureDownloadUrl(product.title, product.url, product.creatorId);
                                                    if (secureUrl) {
                                                        const link = document.createElement('a');
                                                        link.href = secureUrl;
                                                        link.download = product.title || 'download'; // Suggest filename
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                    } else {
                                                        alert("Failed to get download link.");
                                                    }
                                                } catch (error: any) {
                                                    console.error("Download failed:", error);
                                                    alert(error.message || "Failed to download file. Please try again.");
                                                }
                                            }}
                                        >
                                            Download <Download size={12}/>
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
                                    {purchasedProducts.length > 0 ? 'No matching content found' : 'No purchases yet'}
                                </p>
                                <p className="text-sm">
                                    {purchasedProducts.length > 0 ? 'Try selecting a different filter.' : 'Support creators by purchasing their digital products.'}
                                </p>
                            </div>
                        )}

                    </div>
                )}
                
                {/* --- VIEW: EXPLORE CREATORS --- */}
                {currentView === 'EXPLORE' && (
                    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in">
                        
                        {/* Header Section */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                            <div>
                                <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
                                    Featured Experts
                                    <button onClick={() => loadCreators()} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-full transition-colors" title="Refresh List">
                                        <RefreshCw size={16} />
                                    </button>
                                </h2>
                                <p className="text-stone-500 text-sm mt-1">Verified experts ready to reply.</p>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                <div className="relative group flex-1 sm:flex-initial">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-stone-600 transition-colors" size={16} />
                                    <input 
                                        type="text" 
                                        placeholder="Search creators, tags..." 
                                        value={exploreQuery}
                                        onChange={(e) => setExploreQuery(e.target.value)}
                                        className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-medium focus:ring-1 focus:ring-stone-400 outline-none transition-all shadow-sm"
                                    />
                                </div>
                                <select className="bg-white border border-stone-200 text-stone-700 text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-stone-400 shadow-sm">
                                    <option>Sort by: Relevance</option>
                                    <option>Sort by: Price (Low to High)</option>
                                    <option>Sort by: Response Time</option>
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
                                                        Application Under Review
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
                                                    <span className="flex items-center gap-1"><Star size={10} className="fill-yellow-400 text-yellow-400"/> {creator.stats.averageRating}</span>
                                                    <span className="w-1 h-1 rounded-full bg-stone-300"></span>
                                                    <span>{likesFormatted} Likes</span>
                                                </div>
                                            </div>

                                            {/* 3. Stats Grid - Compact */}
                                            <div className="grid grid-cols-2 gap-2 w-full mb-6 relative z-10">
                                                <div 
                                                    className="relative group/tooltip bg-stone-50 rounded-xl p-2.5 border border-stone-100 flex flex-col items-center justify-center cursor-help transition-colors hover:bg-stone-100"
                                                >
                                                    <span className="text-[10px] font-bold text-stone-400 uppercase mb-0.5">Reply</span>
                                                    <span className="font-black text-stone-700 text-xs text-center leading-tight">{creator.stats.responseTimeAvg}</span>
                                                    
                                                    {/* Custom Tooltip */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[140px] bg-stone-800 text-white text-[10px] font-medium py-1.5 px-2.5 rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 text-center shadow-xl">
                                                        {getResponseTimeTooltip(creator.stats.responseTimeAvg)}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-800"></div>
                                                    </div>
                                                </div>
                                                <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-100 flex flex-col items-center justify-center">
                                                    <span className="text-[10px] font-bold text-stone-400 uppercase mb-0.5">Window</span>
                                                    <span className="font-black text-stone-700 text-sm">{creator.responseWindowHours}h</span>
                                                </div>
                                            </div>

                                            {/* 4. Action */}
                                            <div className="mt-auto w-full relative z-10">
                                                <button className="w-full bg-stone-900 text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-stone-900/20 group-hover:bg-stone-800 group-hover:shadow-stone-900/30 transition-all flex items-center justify-center gap-2">
                                                    <Sparkles size={14} className="text-yellow-300" />
                                                    <span>Request</span>
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
                                <p className="text-lg font-bold text-stone-500">No creators found</p>
                                <p className="text-sm">Try searching for "fitness", "react", or specific names.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* --- VIEW: HISTORY --- */}
                {currentView === 'HISTORY' && (
                    <div className="p-6 max-w-5xl mx-auto animate-in fade-in">
                        {(() => {
                            const totalPages = Math.ceil(messages.length / ITEMS_PER_PAGE);
                            const displayedMessages = messages.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE);
                            return (
                        <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
                             <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                                 <h3 className="text-sm font-bold text-stone-900">Transaction History</h3>
                                 <Button variant="ghost" size="sm" className="text-xs"><ExternalLink size={14} className="mr-1"/> Export CSV</Button>
                             </div>
                             <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-stone-50 text-stone-500 font-bold border-b border-stone-100 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-3">Date</th>
                                            <th className="px-6 py-3">Description</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3 text-right">Amount (Credits)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {displayedMessages.map(msg => {
                                            const isRefunded = msg.status === 'EXPIRED' || msg.status === 'CANCELLED';
                                            const isProduct = msg.content.startsWith('Purchased Product:');

                                            return (
                                                <tr key={msg.id} className="hover:bg-stone-50 transition-colors group">
                                                    <td className="px-6 py-4 text-stone-500 font-mono text-xs">{new Date(msg.createdAt).toLocaleDateString()}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 border border-stone-200">
                                                                {isProduct ? <FileText size={14} /> : <User size={14} />}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-stone-900 text-sm">
                                                                    {isProduct ? 'Digital Content Purchase' : 'Priority DM Request'}
                                                                </div>
                                                                <div className="text-xs text-stone-400 truncate max-w-[200px]">{isProduct ? msg.content.replace('Purchased Product: ', '') : msg.content}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {msg.status === 'PENDING' && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100">
                                                                <Clock size={12} /> Pending
                                                            </span>
                                                        )}
                                                        {msg.status === 'REPLIED' && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                                <CheckCircle2 size={12} /> Completed
                                                            </span>
                                                        )}
                                                        {isRefunded && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-500 border border-stone-200">
                                                                <Ban size={12} /> Refunded
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className={`font-mono font-bold flex items-center justify-end gap-1 ${isRefunded ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
                                                            <Coins size={14} /> {msg.amount}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {displayedMessages.length === 0 && (
                                            <tr><td colSpan={4} className="p-12 text-center text-stone-400">No transactions found.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                             </div>

                             {/* Mobile List View */}
                             <div className="md:hidden divide-y divide-stone-100">
                                {displayedMessages.map(msg => {
                                    const isRefunded = msg.status === 'EXPIRED' || msg.status === 'CANCELLED';
                                    const isProduct = msg.content.startsWith('Purchased Product:');
                                    
                                    return (
                                        <div key={msg.id} className="p-4 flex flex-col gap-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 border border-stone-200">
                                                        {isProduct ? <FileText size={18} /> : <User size={18} />}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-stone-900 text-sm">
                                                            {isProduct ? 'Digital Content' : 'Priority Request'}
                                                        </div>
                                                        <div className="text-xs text-stone-400">{new Date(msg.createdAt).toLocaleDateString()}</div>
                                                    </div>
                                                </div>
                                                <div className={`font-mono font-bold ${isRefunded ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
                                                    {msg.amount}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <div className="text-stone-500 truncate max-w-[200px]">{isProduct ? msg.content.replace('Purchased Product: ', '') : msg.content}</div>
                                                {msg.status === 'PENDING' && <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Pending</span>}
                                                {msg.status === 'REPLIED' && <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Completed</span>}
                                                {isRefunded && <span className="font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded">Refunded</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                                {displayedMessages.length === 0 && <div className="p-8 text-center text-stone-400 text-sm">No transactions found.</div>}
                             </div>
                             
                             {/* Pagination Controls */}
                             {totalPages > 1 && (
                                <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-center gap-4">
                                    <button 
                                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                        disabled={historyPage === 1}
                                        className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed text-stone-500 transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-xs font-bold text-stone-600">Page {historyPage} of {totalPages}</span>
                                    <button 
                                        onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                                        disabled={historyPage === totalPages}
                                        className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed text-stone-500 transition-colors"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                             )}
                        </div>
                        );
                        })()}
                    </div>
                )}

                {/* --- VIEW: SUPPORT --- */}
                {currentView === 'SUPPORT' && (
                    <div className="p-6 max-w-2xl mx-auto animate-in fade-in flex items-center justify-center min-h-[500px]">
                         <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-xl shadow-stone-200/50 text-center space-y-6 max-w-md w-full relative overflow-hidden">
                             {/* Decorative Background */}
                             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-stone-500 via-stone-700 to-stone-900"></div>

                             <div className="w-20 h-20 bg-stone-50 text-stone-700 rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-inner ring-4 ring-stone-50/50">
                                 <AlertCircle size={40} />
                             </div>
                             
                             <div>
                                <h3 className="text-2xl font-black text-stone-900 mb-2">How can we help?</h3>
                                <p className="text-stone-500 text-sm leading-relaxed">
                                    Our support team is available Monday through Friday, 9am - 5pm EST. We usually respond within 24 hours.
                                </p>
                             </div>

                             <div className="space-y-3 pt-2">
                                 <Button fullWidth className="h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-stone-900/10">
                                    <MessageSquare size={18}/> Contact Support
                                 </Button>
                                 <Button fullWidth variant="secondary" className="h-12 rounded-xl flex items-center justify-center gap-2 bg-stone-50 hover:bg-stone-100 border border-stone-200">
                                    <FileText size={18}/> View FAQ & Guides
                                 </Button>
                             </div>

                             <div className="pt-6 border-t border-stone-100">
                                 <p className="text-xs text-stone-400">
                                     Direct Email: <a href="#" className="text-stone-900 font-semibold hover:underline">support@bluechecked.com</a>
                                 </p>
                             </div>
                         </div>
                    </div>
                )}

                {/* --- VIEW: SETTINGS --- */}
                {currentView === 'SETTINGS' && (
                    <div className="max-w-2xl mx-auto p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        {showSaveSuccess && (
                            <div className="fixed bottom-8 right-8 z-[60] max-w-sm animate-in slide-in-from-bottom-4">
                                <div className="bg-stone-900 text-white rounded-lg px-4 py-3 shadow-lg flex items-center gap-3">
                                    <CheckCircle2 size={20} className="text-green-400" />
                                    <span className="font-bold text-sm">Profile updated successfully!</span>
                                </div>
                            </div>
                        )}
                        <div className="bg-white p-6 rounded-xl border border-stone-200">
                            <h3 className="text-lg font-bold text-stone-900 mb-6 border-b border-stone-100 pb-2">Your Profile</h3>
                            <div className="space-y-6">
                                <div className="flex items-center gap-6">
                                    <div className="w-20 h-20 rounded-full bg-stone-100 flex-shrink-0 overflow-hidden border border-stone-200">
                                        {profileForm.avatarUrl ? <img src={profileForm.avatarUrl} className="w-full h-full object-cover" /> : <User size={32} className="m-auto text-stone-300"/>}
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-stone-700 mb-1">Profile Photo</label>
                                        <div className="flex gap-2">
                                            {profileForm.avatarUrl ? (
                                                <div className="flex items-center gap-2 w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50 text-stone-500 text-sm">
                                                    <span className="truncate flex-1">
                                                        {avatarFileName || (profileForm.avatarUrl.startsWith('data:') ? "Uploaded Image" : "Current Profile Photo")}
                                                    </span>
                                                    <button onClick={() => { setProfileForm(p => ({...p, avatarUrl: ''})); setAvatarFileName(''); }} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50 text-stone-400 text-sm italic">
                                                    No image selected
                                                </div>
                                            )}
                                            <button 
                                                onClick={() => fileInputRef.current?.click()}
                                                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
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
                                        value={profileForm.name} 
                                        onChange={e => setProfileForm(p => ({...p, name: e.target.value}))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Bio</label>
                                    <textarea 
                                        value={profileForm.bio} 
                                        onChange={e => setProfileForm(p => ({...p, bio: e.target.value}))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none resize-none h-24"
                                        placeholder="Tell us about yourself..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Age (Optional)</label>
                                    <input 
                                        type="number" 
                                        value={profileForm.age} 
                                        onChange={e => setProfileForm(p => ({...p, age: e.target.value}))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none"
                                    />
                                </div>
                                <div className="pt-4 flex justify-end">
                                    <Button onClick={handleSaveProfile} isLoading={isSavingProfile}>Save Changes</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- VIEW: OVERVIEW (List) --- */}
                {currentView === 'OVERVIEW' && !selectedCreatorId && (
                   <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in">
                      {/* Conversation List */}
                      <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
                         <div className="px-6 py-4 border-b border-stone-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                             <h3 className="text-sm font-bold text-stone-900">Your Conversations</h3>
                             {/* Search Input - More Prominent */}
                             <div className="relative w-full sm:w-auto group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-stone-600 transition-colors" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Search messages..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full sm:w-72 pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-1 focus:ring-stone-400 focus:bg-white outline-none transition-all shadow-sm"
                                />
                             </div>
                         </div>

                         {isLoading ? (
                            <div className="text-center py-12 text-sm text-stone-400">Loading requests...</div>
                         ) : filteredGroups.length === 0 ? (
                            <div className="text-center py-16">
                                <MessageSquare size={32} className="mx-auto text-stone-300 mb-3" />
                                <h3 className="text-sm font-bold text-stone-900 mb-1">
                                    {searchQuery ? 'No conversations found' : 'No messages yet'}
                                </h3>
                                <p className="text-xs text-stone-500 mb-6">
                                    {searchQuery ? 'Try a different search term.' : 'Find an expert to help you solve your problem.'}
                                </p>
                                {!searchQuery && (
                                    <Button onClick={() => setCurrentView('EXPLORE')} className="rounded-full shadow-lg shadow-stone-200">
                                        Explore Creators
                                    </Button>
                                )}
                            </div>
                         ) : (
                            <>
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[600px]">
                                    <thead>
                                        <tr className="bg-stone-50/50 border-b border-stone-100">
                                            <th className="px-6 py-3 text-[10px] font-bold text-stone-500 uppercase tracking-wider">Expert</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-stone-500 uppercase tracking-wider">Latest Status</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-stone-500 uppercase tracking-wider text-right">Sessions</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-stone-500 uppercase tracking-wider text-right">Last Active</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredGroups.map(group => {
                                            const latestMsg = group.latestMessage;
                                            const timeLeft = getTimeLeft(latestMsg.expiresAt);
                                            return (
                                                <tr key={group.creatorId} onClick={() => handleOpenChat(group.creatorId)} className="group cursor-pointer hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 border border-stone-200 overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                                                                {group.creatorAvatarUrl ? (
                                                                    <img src={group.creatorAvatarUrl} className="w-full h-full object-cover" alt={group.creatorName} />
                                                                ) : (
                                                                    <User size={20} />
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-stone-900">{group.creatorName}</span>
                                                                <span className="text-[10px] text-stone-500">View Conversation &rarr;</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {latestMsg.status === 'PENDING' ? (
                                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${timeLeft.bg} ${timeLeft.color} border-current/20 flex items-center gap-1 w-fit`}>
                                                                <Clock size={10} /> Pending Reply
                                                            </span>
                                                        ) : latestMsg.status === 'REPLIED' ? (
                                                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1 w-fit">
                                                                <CheckCircle2 size={10} /> Replied
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-stone-100 text-stone-500 border border-stone-200 w-fit">Refunded</span>
                                                        )}
                                                        <p className="text-[10px] text-stone-400 mt-1 truncate max-w-[150px]">
                                                            {latestMsg.conversation[latestMsg.conversation.length - 1]?.content || latestMsg.content}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-xs font-mono font-bold text-stone-700 bg-stone-100 px-2 py-1 rounded-md">{group.messageCount}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-xs text-stone-500">{new Date(latestMsg.createdAt).toLocaleDateString()}</span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {/* Mobile Cards */}
                            <div className="md:hidden divide-y divide-stone-100">
                                {filteredGroups.map(group => {
                                    const latestMsg = group.latestMessage;
                                    const timeLeft = getTimeLeft(latestMsg.expiresAt);
                                    return (
                                        <div key={group.creatorId} onClick={() => handleOpenChat(group.creatorId)} className="p-4 active:bg-stone-50 cursor-pointer">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 border border-stone-200 overflow-hidden shadow-sm">
                                                    {group.creatorAvatarUrl ? (
                                                        <img src={group.creatorAvatarUrl} className="w-full h-full object-cover" alt={group.creatorName} />
                                                    ) : (
                                                        <User size={20} />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-sm font-bold text-stone-900">{group.creatorName}</span>
                                                        <span className="text-[10px] text-stone-400 font-mono">{new Date(latestMsg.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="mt-1">
                                                        {latestMsg.status === 'PENDING' ? (
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${timeLeft.bg} ${timeLeft.color} border-current/20 flex items-center gap-1 w-fit`}>
                                                                <Clock size={10} /> Pending Reply
                                                            </span>
                                                        ) : latestMsg.status === 'REPLIED' ? (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1 w-fit">
                                                                <CheckCircle2 size={10} /> Replied
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200 w-fit">Refunded</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-xs text-stone-600 line-clamp-2 mb-3 bg-stone-50 p-2.5 rounded-lg border border-stone-100 italic">
                                                "{latestMsg.conversation[latestMsg.conversation.length - 1]?.content || latestMsg.content}"
                                            </p>
                                            <div className="flex justify-between items-center mt-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{group.messageCount} Sessions</span>
                                                <div className="text-xs font-bold text-stone-700 flex items-center gap-1">View <ChevronRight size={14} /></div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            </>
                         )}
                      </div>
                   </div>
                )}

                {/* --- VIEW: CHAT (Sub-view of Overview) --- */}
                {selectedCreatorId && (
                     <div className="h-full flex flex-col bg-[#F0EEEA] animate-in slide-in-from-right-4 relative">
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
                                <button onClick={() => setSelectedCreatorId(null)} className="p-2 -ml-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-colors">
                                    <ChevronLeft size={20} />
                                </button>
                                <div>
                                    <h2 className="font-bold text-stone-900 text-lg leading-tight">{conversationGroups.find(g => g.creatorId === selectedCreatorId)?.creatorName || 'Creator'}</h2>
                                    <p className="text-[10px] text-stone-500 font-medium">Verified Expert</p>
                                </div>
                            </div>
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

                        {/* Messages - Threads Style */}
                        <div className="flex-1 overflow-y-auto bg-white" ref={scrollRef}>
                             {threadMessages.map((msg, msgIndex) => {
                                const isPending = msg.status === 'PENDING';
                                const isRefunded = msg.status === 'EXPIRED' || msg.status === 'CANCELLED';

                                // Sort conversation by timestamp
                                const sortedConversation = [...msg.conversation].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                                const [firstChat, ...restChats] = sortedConversation;

                                return (
                                    <div key={msg.id} className={`px-4 py-3 ${msgIndex > 0 ? 'border-t border-stone-100' : ''} relative`}>
                                        {/* 1. First Message (The Request) */}
                                        {firstChat && (
                                        <div className="flex relative z-10">
                                            {/* Left: Avatar + Thread Line */}
                                            <div className="flex flex-col items-center mr-3 relative">
                                                {/* Thread Line to Next */}
                                                {(restChats.length > 0 || isPending) && (
                                                    <div className="absolute left-[17px] top-11 -bottom-1 w-0.5 bg-stone-200"></div>
                                                )}
                                                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
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
                                                        <span className="text-xs font-medium text-stone-400">• {getRelativeTime(firstChat.timestamp)}</span>
                                                    </div>
                                                </div>

                                                <div className="bg-white p-5 sm:p-6 rounded-2xl rounded-tl-lg border border-stone-200/60">

                                                    {/* Content */}
                                                    <div>
                                                        <p className="text-sm text-stone-700 leading-relaxed">{firstChat.content}</p>

                                                        {/* Attachment */}
                                                        {msg.attachmentUrl && (
                                                            <div className="mt-3 rounded-lg overflow-hidden border border-stone-200">
                                                                <img src={msg.attachmentUrl} className="max-w-full w-full object-cover" alt="attachment" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Action Row */}
                                                    <div className="flex items-center gap-0 mt-4 -ml-2">
                                                        <div className="relative">
                                                            <button 
                                                                onClick={() => setActiveReactionPicker(activeReactionPicker === firstChat.id ? null : firstChat.id)}
                                                                className="p-2 text-stone-400 hover:text-stone-600 transition-colors relative group"
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
                                                        <div className="flex items-center gap-1.5 text-stone-400 ml-auto text-xs">
                                                            <Coins size={12} className="text-stone-400" />
                                                            <span>{msg.amount}</span>
                                                            {isPending && (
                                                                <>
                                                                    <span className="mx-1">·</span>
                                                                    <span className="text-amber-600">{getTimeLeft(msg.expiresAt).text}</span>
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

                                            return (
                                            <div key={chat.id} className="flex mt-4 relative z-10">
                                                {/* Left: Avatar + Thread Line */}
                                                <div className="flex flex-col items-center mr-3 relative">
                                                    {showLine && (
                                                        <div className="absolute left-[17px] top-11 -bottom-1 w-0.5 bg-stone-200"></div>
                                                    )}
                                                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                                                        {isCreator ? (
                                                            msg.creatorAvatarUrl ? (
                                                                <img src={msg.creatorAvatarUrl} alt={msg.creatorName} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full bg-stone-200 flex items-center justify-center"><User size={16} className="text-stone-500" /></div>
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
                                                                    {isCreator ? (msg.creatorName || 'Creator') : (currentUser?.name || 'You')}
                                                                </span>
                                                                {isCreator ? (
                                                                    <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                                                        <CheckCircle2 size={10} className="fill-current" />
                                                                        <span className="text-[9px] font-semibold uppercase tracking-wide">Creator</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                                                        <User size={10} className="fill-current" />
                                                                        <span className="text-[9px] font-semibold uppercase tracking-wide">Fan</span>
                                                                    </div>
                                                                )}
                                                            <span className="text-xs font-medium text-stone-400">• {getRelativeTime(chat.timestamp)}</span>
                                                        </div>
                                                    </div>
                                                    <div className={`${isCreator ? 'bg-stone-50' : 'bg-white'} p-5 sm:p-6 rounded-2xl rounded-tl-lg border border-stone-200/60`}>
                                                        {/* Content */}
                                                        <p className="text-sm text-stone-700 leading-relaxed">{chat.content}</p>

                                                        {chat.attachmentUrl && (
                                                            <div className="mt-3 rounded-lg overflow-hidden border border-stone-200">
                                                                <img src={chat.attachmentUrl} className="max-w-full w-full object-cover" alt="attachment" />
                                                            </div>
                                                        )}

                                                        {/* Action Row */}
                                                        <div className="flex items-center gap-0 mt-4 -ml-2">
                                                        <div className="relative">
                                                            <button 
                                                                onClick={() => setActiveReactionPicker(activeReactionPicker === chat.id ? null : chat.id)}
                                                                className="p-2 text-stone-400 hover:text-stone-600 transition-colors relative group"
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
                                                            <div className="w-full h-full bg-stone-50 flex items-center justify-center">
                                                                <User size={16} className="text-stone-300" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex-1 flex items-center">
                                                    <span className="text-[15px] text-stone-400">Waiting for {msg.creatorName || 'creator'}'s reply...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div className="h-4"></div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="bg-white border-t border-stone-200 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)] z-20 flex-shrink-0">
                            {latestMessage && latestMessage.status === 'PENDING' && (
                                <div className="p-4 flex items-center justify-between bg-stone-50">
                                    <div className="flex items-center gap-3">
                                        {(() => {
                                            const lastChat = latestMessage.conversation[latestMessage.conversation.length - 1];
                                            const isCreatorReplied = lastChat?.role === 'CREATOR';
                                            
                                            if (isCreatorReplied) {
                                                const diff = new Date(latestMessage.expiresAt).getTime() - Date.now();
                                                const hours = Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
                                                return (
                                                    <>
                                                        <div className="bg-white p-2 rounded-full border border-stone-200 shadow-sm">
                                                            <MessageSquare size={20} className="text-stone-700" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-stone-700">Creator answering</p>
                                                            <p className="text-xs text-stone-400">Creator has {hours} hours left to complete the answer</p>
                                                        </div>
                                                    </>
                                                );
                                            } else if (latestMessage.isRead) {
                                                return (
                                                    <>
                                                        <div className="bg-white p-2 rounded-full border border-stone-200 shadow-sm">
                                                            <Check size={20} className="text-stone-500" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-stone-700">Read</p>
                                                            <p className="text-xs text-stone-400">Request expires in {getTimeLeft(latestMessage.expiresAt).text}</p>
                                                        </div>
                                                    </>
                                                );
                                            } else {
                                                return (
                                                    <>
                                                        <div className="bg-white p-2 rounded-full border border-stone-200 shadow-sm">
                                                            <Clock size={20} className="text-stone-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-stone-700">Not yet read</p>
                                                            <p className="text-xs text-stone-400">Request expires in {getTimeLeft(latestMessage.expiresAt).text}</p>
                                                        </div>
                                                    </>
                                                );
                                            }
                                        })()}
                                    </div>
                                    
                                    {confirmCancelId === latestMessage.id ? (
                                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                            <span className="text-xs font-bold text-stone-500 mr-2 flex items-center gap-1">Refund <Coins size={10}/>{latestMessage.amount}?</span>
                                            <Button size="sm" variant="ghost" onClick={() => setConfirmCancelId(null)}>No</Button>
                                            <Button size="sm" variant="danger" onClick={processCancellation} isLoading={isCancelling}>Yes, Cancel</Button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => handleCancelClick(latestMessage.id)}
                                            className="text-stone-400 hover:text-red-600 text-xs font-bold hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors"
                                        >
                                            Cancel Request
                                        </button>
                                    )}
                                </div>
                            )}

                            {latestMessage && latestMessage.status === 'REPLIED' && (
                                <div className="p-4 bg-stone-50/50">
                                     {/* Rating Section */}
                                     {!hasRated && !showRatingSuccess && (
                                         <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm mb-4 text-center">
                                             <h4 className="font-bold text-stone-900 text-sm mb-2">How was the answer?</h4>
                                             <div className="flex justify-center gap-2 mb-2">
                                                 {[1,2,3,4,5].map(star => (
                                                     <button
                                                        key={star}
                                                        onMouseEnter={() => setHoveredStar(star)}
                                                        onMouseLeave={() => setHoveredStar(0)}
                                                        onClick={() => setRating(star)}
                                                        disabled={isSubmittingRating}
                                                        className="transition-transform hover:scale-110 active:scale-95"
                                                     >
                                                         <Star 
                                                            size={24} 
                                                            className={`${(hoveredStar || rating) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-stone-300'} transition-colors`}
                                                         />
                                                     </button>
                                                 ))}
                                             </div>
                                             
                                             {rating > 0 && (
                                                 <div className="animate-in fade-in slide-in-from-top-2 px-4 pb-2">
                                                     <textarea
                                                         value={reviewText}
                                                         onChange={(e) => setReviewText(e.target.value)}
                                                         placeholder="Write a review (optional)..."
                                                         className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:ring-1 focus:ring-stone-400 outline-none resize-none h-20 mb-3"
                                                     />
                                                     <Button 
                                                         fullWidth 
                                                         onClick={handleSubmitRating}
                                                         isLoading={isSubmittingRating}
                                                         size="sm"
                                                     >
                                                         Submit Review
                                                     </Button>
                                                 </div>
                                             )}
                                         </div>
                                     )}

                                     {showRatingSuccess && (
                                         <div className="bg-green-50 text-green-600 p-3 rounded-xl border border-green-100 text-center text-sm font-bold mb-4 animate-in zoom-in">
                                             Thanks for your feedback!
                                         </div>
                                     )}

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
                                                onClick={() => { setShowFollowUpInput(false); setCustomAppreciationMode(false); }}
                                                className="absolute top-2 right-2 p-1 text-stone-300 hover:text-stone-500 rounded-full hover:bg-stone-50"
                                             >
                                                 <X size={16} />
                                             </button>
                                             
                                             <h4 className="font-bold text-stone-900 text-sm mb-3">
                                                 {showFollowUpInput ? 'Send Follow-up Request' : 'Send Appreciation'}
                                             </h4>
                                             
                                             <textarea 
                                                value={showFollowUpInput ? followUpText : customAppreciationText}
                                                onChange={e => showFollowUpInput ? setFollowUpText(e.target.value) : setCustomAppreciationText(e.target.value)}
                                                placeholder={showFollowUpInput ? "Ask another question..." : "Write a nice note..."}
                                                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:ring-1 focus:ring-stone-400 outline-none resize-none h-24 mb-3"
                                             />

                                             {showFollowUpInput && (
                                                 <div className="flex justify-between items-center mb-3 text-xs text-stone-500 px-1">
                                                     <span className="flex items-center gap-1">Price: <b><Coins size={10} className="inline mb-0.5"/> {latestMessage.amount}</b></span>
                                                 </div>
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

                {/* --- VIEW: NOTIFICATIONS --- */}
                {currentView === 'NOTIFICATIONS' && (
                    <div className="p-6 max-w-3xl mx-auto animate-in fade-in">
                        {(() => {
                            const totalPages = Math.ceil(notifications.length / ITEMS_PER_PAGE);
                            const displayedNotifications = notifications.slice((notificationPage - 1) * ITEMS_PER_PAGE, notificationPage * ITEMS_PER_PAGE);
                            return (
                        <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-stone-900">All Notifications</h3>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-stone-500">{notifications.length} items</span>
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
                            <div className="divide-y divide-stone-100">
                                {displayedNotifications.length === 0 ? (
                                    <div className="p-12 text-center text-stone-400 text-sm">No notifications yet.</div>
                                ) : (
                                    displayedNotifications.map(notif => (
                                        <div key={notif.id} className="px-6 py-4 hover:bg-stone-50 transition-colors flex gap-4 group relative">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${notif.color}`}>
                                                <notif.icon size={18} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-stone-900 font-medium mb-1">{notif.text}</p>
                                                <p className="text-xs text-stone-500">{notif.time.toLocaleString()}</p>
                                            </div>
                                            <button onClick={(e) => handleDeleteNotification(e, notif.id)} className="text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-center gap-4">
                                    <button 
                                        onClick={() => setNotificationPage(p => Math.max(1, p - 1))}
                                        disabled={notificationPage === 1}
                                        className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed text-stone-500 transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-xs font-bold text-stone-600">Page {notificationPage} of {totalPages}</span>
                                    <button 
                                        onClick={() => setNotificationPage(p => Math.min(totalPages, p + 1))}
                                        disabled={notificationPage === totalPages}
                                        className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed text-stone-500 transition-colors"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                        );
                        })()}
                    </div>
                )}
            </div>
        </main>

        {/* Top Up Modal */}
        {showTopUpModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-in fade-in duration-300">
                <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
                    <button onClick={() => setShowTopUpModal(false)} className="absolute top-4 right-4 p-2 bg-stone-100 hover:bg-stone-200 rounded-full text-stone-500 z-10 transition-colors"><X size={18}/></button>
                    
                    <div className="p-8">
                        <div className="text-center mb-6">
                            <div className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-1">Available Balance</div>
                            <div className="text-4xl font-black text-stone-900 mb-4 flex justify-center items-baseline gap-1">
                                {currentUser?.credits?.toLocaleString() || 0}
                                <span className="text-sm font-bold text-stone-400 uppercase">Credits</span>
                            </div>
                            <h3 className="font-bold text-lg text-stone-800">Add Credits</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {[500, 1000, 2500, 5000].map(amt => (
                                <button 
                                key={amt}
                                onClick={() => setTopUpAmount(amt)}
                                className={`p-3 rounded-xl border text-center transition-all ${topUpAmount === amt ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 hover:border-stone-300 text-stone-900'}`}
                                >
                                    <div className="font-bold text-lg">{amt}</div>
                                    <div className={`text-[10px] font-semibold uppercase ${topUpAmount === amt ? 'text-stone-400' : 'text-stone-400'}`}>Credits</div>
                                </button>
                            ))}
                        </div>

                        <div className="bg-stone-50 p-4 rounded-xl flex justify-between items-center mb-6 border border-stone-100">
                            <span className="text-sm font-medium text-stone-600">Total Cost</span>
                            <span className="font-black text-stone-900 text-xl">${(topUpAmount / 100).toFixed(2)}</span>
                        </div>

                        <Button 
                            fullWidth 
                            size="lg" 
                            onClick={handleTopUp}
                            isLoading={isProcessingTopUp}
                            className="bg-stone-900 text-white rounded-xl h-12 font-bold shadow-lg shadow-stone-900/20"
                        >
                            Pay & Add Credits
                        </Button>
                        <p className="text-center text-[10px] text-stone-400 mt-4 flex items-center justify-center gap-1">
                            <Lock size={10} /> Secure encrypted payment
                        </p>
                    </div>
                </div>
            </div>
        )}

        {toastMessage && (
            <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-500">
                <div className="relative overflow-hidden bg-stone-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 border border-white/10 ring-1 ring-white/20">
                    <div className="absolute inset-0 bg-gradient-to-r from-stone-500 via-stone-700 to-stone-900 opacity-20"></div>
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="bg-gradient-to-tr from-stone-600 to-stone-800 p-1.5 rounded-full shadow-lg shadow-stone-800/20">
                            <Send size={16} className="text-white fill-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white tracking-wide">{toastMessage}</p>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
