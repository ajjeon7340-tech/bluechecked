
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CurrentUser, Message, MessageStatus, CreatorProfile } from '../types';
import { Button } from './Button';
import { CheckCircle2, MessageSquare, Clock, LogOut, ExternalLink, ChevronRight, User, AlertCircle, Check, Trash, Paperclip, ChevronLeft, Send, Ban, Star, DollarSign, Plus, X, Heart, Sparkles, Camera, Save, ShieldCheck, Home, Settings, Menu, Bell, Search, Wallet, TrendingUp, ShoppingBag, FileText, Image as ImageIcon, Video, Link as LinkIcon, Lock, HelpCircle, Receipt, ArrowRight, Play, Trophy, MonitorPlay, LayoutGrid, Flame, InstagramLogo, Twitter, Youtube, Twitch, Music2, TikTokLogo, XLogo, YouTubeLogo, Coins, CreditCard, RefreshCw, Download } from './Icons';
import { getMessages, cancelMessage, sendMessage, rateMessage, sendFanAppreciation, updateCurrentUser, getFeaturedCreators, addCredits, isBackendConfigured, subscribeToMessages, getPurchasedProducts, getSecureDownloadUrl } from '../services/realBackend';

interface Props {
  currentUser: CurrentUser | null;
  onLogout: () => void;
  onBrowseCreators: (creatorId: string) => void;
  onUpdateUser?: (user: CurrentUser) => void;
}

const getResponseTimeTooltip = (status: string) => {
    if (status === 'Super Responsive') return 'Typically replies in under 1 hour';
    if (status === 'Expert') return 'Typically replies in under 4 hours';
    if (status === 'Lightning') return 'Typically replies within 24 hours';
    return 'Replies within the guaranteed response window';
};

export const FanDashboard: React.FC<Props> = ({ currentUser, onLogout, onBrowseCreators, onUpdateUser }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [featuredCreators, setFeaturedCreators] = useState<CreatorProfile[]>([]);
  const [purchasedProducts, setPurchasedProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  
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
      avatarUrl: ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

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
            avatarUrl: currentUser.avatarUrl || ''
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
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
            stats: { averageRating: 5.0, responseTimeAvg: 'Expert', profileViews: 1200, replyRate: '100%' },
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
              avatarUrl: profileForm.avatarUrl
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
    return { text: `${hours}h left`, color: 'text-slate-500', bg: 'bg-slate-100' };
  };

  const activeRequests = messages.filter(m => m.status === MessageStatus.PENDING).length;
  
  const notifications = useMemo(() => {
      const list: { id: string, icon: any, text: string, time: Date, color: string }[] = [];
      
      // Add Welcome Notification (Ensures list is never empty on first load)
      list.push({
          id: 'welcome',
          icon: Sparkles,
          text: 'Welcome to Bluechecked! Find a creator to start.',
          time: new Date(),
          color: 'bg-indigo-100 text-indigo-600'
      });

      messages.forEach(msg => {
          const isProduct = msg.content.startsWith('Purchased Product:');

          // 1. Sent Request
          list.push({
              id: `sent-${msg.id}`,
              icon: Send,
              text: `You sent a request to ${msg.creatorName || 'Creator'}`,
              time: new Date(msg.createdAt),
              color: 'bg-blue-100 text-blue-600'
          });

          // 2. Reply Received
          if (msg.status === MessageStatus.REPLIED && msg.replyAt && !isProduct) {
              list.push({
                  id: `reply-${msg.id}`,
                  icon: MessageSquare,
                  text: `${msg.creatorName || 'Creator'} replied to your request!`,
                  time: new Date(msg.replyAt),
                  color: 'bg-green-100 text-green-600'
              });
          }

          // 3. Refunded (Expired)
          if (msg.status === MessageStatus.EXPIRED) {
              list.push({
                  id: `exp-${msg.id}`,
                  icon: Coins,
                  text: `Request to ${msg.creatorName || 'Creator'} expired. ${msg.amount} credits refunded.`,
                  time: new Date(msg.expiresAt),
                  color: 'bg-amber-100 text-amber-600'
              });
          }

          // 4. Rejected (Cancelled)
          if (msg.status === MessageStatus.CANCELLED) {
               list.push({
                  id: `can-${msg.id}`,
                  icon: Ban,
                  text: `Request to ${msg.creatorName || 'Creator'} was rejected.`,
                  time: new Date(msg.createdAt), // Fallback
                  color: 'bg-red-100 text-red-600'
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
                  color: 'bg-purple-100 text-purple-600'
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
          ? 'bg-slate-200 text-slate-900' 
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      <Icon size={18} className={`mr-3 ${currentView === view && !selectedCreatorId && !onClick ? 'text-indigo-600' : 'text-slate-400'}`} />
      <span>{label}</span>
      {isBeta && (
          <span className="ml-2 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-200">BETA</span>
      )}
    </button>
  );

  const ComingSoonOverlay = () => (
      <div className="absolute inset-0 bg-slate-50/70 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center text-slate-900">
        <div className="bg-white p-2.5 rounded-full shadow-lg mb-2 ring-1 ring-slate-100 animate-in zoom-in duration-300">
            <Lock size={20} className="text-slate-400" />
        </div>
        <span className="font-bold text-xs uppercase tracking-wider text-slate-500 bg-white/80 px-3 py-1 rounded-full border border-slate-100">Coming Soon</span>
      </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex font-sans text-slate-900 overflow-hidden">

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 z-20 md:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* 1. SIDEBAR */}
        <aside className={`fixed inset-y-0 left-0 w-64 bg-[#F3F4F6] border-r border-slate-200 transform transition-transform duration-300 z-30 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
            <div className="p-4 h-full flex flex-col">
                {/* Brand */}
                <div 
                    onClick={() => { setCurrentView('OVERVIEW'); setSelectedCreatorId(null); }}
                    className="flex items-center gap-2 px-3 py-4 mb-6 cursor-pointer hover:opacity-80 transition-opacity"
                >
                    <div className="bg-blue-600 text-white p-1 rounded-md shadow-lg shadow-blue-500/20">
                        <CheckCircle2 size={16} />
                    </div>
                    <span className="font-bold text-slate-900 tracking-tight">BLUECHECKED</span>
                </div>

                {/* Nav Links */}
                <div className="space-y-1 flex-1">
                    <div className="px-3 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Fan Menu</div>
                    <SidebarItem icon={Home} label="Conversations" view="OVERVIEW" />
                    <SidebarItem icon={Search} label="Explore Creators" view="EXPLORE" />
                    <SidebarItem icon={ShoppingBag} label="Purchased" view="PURCHASED" isBeta={true} />
                    <SidebarItem icon={Bell} label="Notifications" view="NOTIFICATIONS" />
                    {/* Wallet now acts as a trigger for the modal, not a separate view */}
                    <SidebarItem icon={Wallet} label="My Wallet" onClick={() => setShowTopUpModal(true)} />
                    <SidebarItem icon={Receipt} label="Purchase History" view="HISTORY" />
                    <SidebarItem icon={HelpCircle} label="Support" view="SUPPORT" />
                    
                    <div className="my-4 mx-3 border-t border-slate-200"></div>
                    <SidebarItem icon={Settings} label="Settings" view="SETTINGS" />
                </div>

                {/* Profile Snippet Bottom */}
                <div className="mt-auto border-t border-slate-200 pt-4 px-3">
                    <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                            {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-full h-full p-1 text-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{currentUser?.name || 'Fan User'}</p>
                            <p className="text-xs text-slate-500 truncate">{currentUser?.email}</p>
                        </div>
                        <button onClick={onLogout} className="text-slate-400 hover:text-red-600 transition-colors">
                            <LogOut size={16} />
                        </button>
                    </div>
                    <div className="mt-3 flex flex-col items-center gap-1">
                        <div className="text-[10px] text-slate-400 font-mono opacity-50">v3.6.25</div>
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
                <div className="bg-indigo-600 text-white text-[10px] font-bold px-4 py-1 text-center z-50 shadow-sm">
                    DEMO MODE: Supabase not configured. Showing mock data.
                </div>
            )}
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-slate-500">
                        <Menu size={20} />
                    </button>
                    <h2 className="font-semibold text-slate-800">
                        {getPageTitle()}
                    </h2>
                </div>
                {!selectedCreatorId && (
                     <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setShowTopUpModal(true)}
                            className="hidden sm:flex items-center gap-2 bg-slate-100 hover:bg-slate-200 transition-colors px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 cursor-pointer"
                        >
                            <Coins size={14} className="text-indigo-500" />
                            {currentUser?.credits || 0} Credits
                        </button>
                        <div className="relative">
                            <button 
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-full hover:bg-slate-100"
                            >
                                <Bell size={20} />
                                {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>}
                            </button>

                            {showNotifications && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)}></div>
                                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                                            <h3 className="font-bold text-sm text-slate-900">Notifications</h3>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{notifications.length} Updates</span>
                                        </div>
                                        <div className="max-h-[320px] overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="p-8 text-center text-slate-400 text-xs">No notifications yet.</div>
                                            ) : (
                                                notifications.map(notif => (
                                                    <div key={notif.id} className="px-4 py-3 hover:bg-slate-50 transition-colors flex gap-3 border-b border-slate-50 last:border-0 group relative pr-8">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${notif.color}`}>
                                                            <notif.icon size={14} />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-slate-600 leading-snug mb-1 font-medium">{notif.text}</p>
                                                            <p className="text-[10px] text-slate-400">{notif.time.toLocaleDateString()} • {notif.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                                        </div>
                                                        <button 
                                                            onClick={(e) => handleDeleteNotification(e, notif.id)}
                                                            className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
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
            <div className="flex-1 overflow-auto relative bg-[#F7F9FC]">
                
                {/* --- VIEW: PURCHASED (BETA) --- */}
                {currentView === 'PURCHASED' && (
                    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in">
                        <div className="bg-indigo-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden mb-8">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="bg-indigo-500/50 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/20 shadow-sm">Beta Access</span>
                                        <Sparkles size={14} className="text-indigo-300" />
                                    </div>
                                    <h3 className="font-bold text-2xl md:text-3xl mb-2">My Library</h3>
                                    <p className="text-indigo-200 text-sm max-w-lg leading-relaxed">
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

                        {/* Content Filter Tabs (Mock) */}
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                             <button className="px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-bold whitespace-nowrap shadow-md">All Content</button>
                             <button className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-full text-xs font-bold hover:bg-slate-50 whitespace-nowrap">Documents (PDF)</button>
                             <button className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-full text-xs font-bold hover:bg-slate-50 whitespace-nowrap">Images</button>
                             <button className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-full text-xs font-bold hover:bg-slate-50 whitespace-nowrap">Videos</button>
                        </div>

                        {isLoading ? (
                            <div className="text-center py-20 text-slate-400">Loading library...</div>
                        ) : purchasedProducts.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {purchasedProducts.map((product, idx) => (
                                    <div key={idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col h-full relative">
                                <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden flex items-center justify-center p-8 group-hover:bg-indigo-50 transition-colors">
                                     <div className="bg-white shadow-lg p-0 w-24 h-32 rounded-sm border border-slate-200 relative transform group-hover:-rotate-3 transition-transform duration-500 flex items-center justify-center">
                                         <div className="absolute inset-x-2 top-2 bottom-2 border-2 border-dashed border-slate-100"></div>
                                         <FileText size={32} className="text-red-500" />
                                     </div>
                                     <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-slate-500 border border-slate-200">PDF</div>
                                </div>
                                <div className="p-5 flex flex-col flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden">
                                            <img src={product.creatorAvatar || 'https://via.placeholder.com/100'} alt="Creator" className="w-full h-full object-cover"/>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-500">{product.creatorName}</span>
                                    </div>
                                    <h4 className="font-bold text-slate-900 mb-1 leading-tight">{product.title}</h4>
                                    <p className="text-xs text-slate-500 mb-4 line-clamp-2 flex-1">{product.description || 'Digital Download'}</p>
                                    <div className="mt-auto pt-4 border-t border-slate-50 flex justify-between items-center">
                                        <span className="text-[10px] text-slate-400">{new Date(product.purchaseDate).toLocaleDateString()}</span>
                                        <button 
                                            className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
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
                            <div className="text-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-100 shadow-sm">
                                <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="text-lg font-bold text-slate-500">No purchases yet</p>
                                <p className="text-sm">Support creators by purchasing their digital products.</p>
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
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                    Featured Experts
                                    <button onClick={() => loadCreators()} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors" title="Refresh List">
                                        <RefreshCw size={16} />
                                    </button>
                                </h2>
                                <p className="text-slate-500 text-sm mt-1">Verified experts ready to reply.</p>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                <div className="relative group flex-1 sm:flex-initial">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                                    <input 
                                        type="text" 
                                        placeholder="Search creators, tags..." 
                                        value={exploreQuery}
                                        onChange={(e) => setExploreQuery(e.target.value)}
                                        className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                                    />
                                </div>
                                <select className="bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm">
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
                                            className={`group bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col items-center text-center h-full relative overflow-hidden ${isUnderReview ? 'opacity-75' : ''}`}
                                        >
                                            {isUnderReview && (
                                                <div className="absolute inset-0 z-50 flex items-center justify-center">
                                                    <div className="bg-slate-900/90 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl transform -rotate-3 border border-white/20 flex items-center gap-2">
                                                        <Clock size={12} className="text-yellow-400 animate-pulse" />
                                                        Application Under Review
                                                    </div>
                                                </div>
                                            )}
                                            {/* Gradient Header */}
                                            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-slate-50 to-transparent opacity-60"></div>

                                            {/* 1. Avatar (Centered & Larger) */}
                                            <div className="relative mb-4 z-10">
                                                <div className="w-20 h-20 rounded-full p-1 bg-white shadow-sm border border-slate-100 mx-auto flex items-center justify-center overflow-hidden">
                                                    {isUnderReview ? (
                                                        <div className="w-full h-full bg-slate-50 flex items-center justify-center">
                                                            <User size={32} className="text-slate-300" />
                                                        </div>
                                                    ) : (
                                                        <img src={creator.avatarUrl} className="w-full h-full rounded-full object-cover" alt={creator.displayName} />
                                                    )}
                                                </div>
                                            </div>

                                            {/* 2. Name & Info */}
                                            <div className="relative z-10 w-full mb-5">
                                                <h3 className={`font-black text-slate-900 text-lg leading-tight group-hover:text-indigo-600 transition-colors mb-1 truncate px-2 ${isUnderReview ? 'blur-sm opacity-40 select-none' : ''}`}>
                                                    {isUnderReview ? 'Creator Name' : creator.displayName}
                                                </h3>
                                                <div className="flex items-center justify-center gap-1.5 mb-3 mt-2">
                                                    {platforms.slice(0, 3).map((p: string, i: number) => (
                                                        <div key={i} className="w-7 h-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center hover:scale-110 transition-transform shadow-sm">
                                                            {/* @ts-ignore */}
                                                            {getPlatformIcon(p, 'colored')}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex items-center justify-center gap-3 text-xs text-slate-500 font-medium">
                                                    <span className="flex items-center gap-1"><Star size={10} className="fill-yellow-400 text-yellow-400"/> {creator.stats.averageRating}</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span>{likesFormatted} Likes</span>
                                                </div>
                                            </div>

                                            {/* 3. Stats Grid - Compact */}
                                            <div className="grid grid-cols-2 gap-2 w-full mb-6 relative z-10">
                                                <div 
                                                    className="relative group/tooltip bg-slate-50 rounded-xl p-2.5 border border-slate-100 flex flex-col items-center justify-center cursor-help transition-colors hover:bg-slate-100"
                                                >
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Reply</span>
                                                    <span className="font-black text-slate-700 text-xs text-center leading-tight">{creator.stats.responseTimeAvg}</span>
                                                    
                                                    {/* Custom Tooltip */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[140px] bg-slate-800 text-white text-[10px] font-medium py-1.5 px-2.5 rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 text-center shadow-xl">
                                                        {getResponseTimeTooltip(creator.stats.responseTimeAvg)}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 flex flex-col items-center justify-center">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Window</span>
                                                    <span className="font-black text-slate-700 text-sm">{creator.responseWindowHours}h</span>
                                                </div>
                                            </div>

                                            {/* 4. Action */}
                                            <div className="mt-auto w-full relative z-10">
                                                <button className="w-full bg-slate-900 text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-slate-900/10 group-hover:bg-indigo-600 group-hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2">
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
                            <div className="text-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-100 shadow-sm">
                                <Search size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="text-lg font-bold text-slate-500">No creators found</p>
                                <p className="text-sm">Try searching for "fitness", "react", or specific names.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* --- VIEW: HISTORY --- */}
                {currentView === 'HISTORY' && (
                    <div className="p-6 max-w-5xl mx-auto animate-in fade-in">
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                             <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                 <h3 className="text-sm font-bold text-slate-900">Transaction History</h3>
                                 <Button variant="ghost" size="sm" className="text-xs"><ExternalLink size={14} className="mr-1"/> Export CSV</Button>
                             </div>
                             <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-3">Date</th>
                                            <th className="px-6 py-3">Description</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3 text-right">Amount (Credits)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {messages.map(msg => {
                                            const isRefunded = msg.status === MessageStatus.EXPIRED || msg.status === MessageStatus.CANCELLED;
                                            const isProduct = msg.content.startsWith('Purchased Product:');

                                            return (
                                                <tr key={msg.id} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{new Date(msg.createdAt).toLocaleDateString()}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                                                                {isProduct ? <FileText size={14} /> : <User size={14} />}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-900 text-sm">
                                                                    {isProduct ? 'Digital Content Purchase' : 'Priority DM Request'}
                                                                </div>
                                                                <div className="text-xs text-slate-400 truncate max-w-[200px]">{isProduct ? msg.content.replace('Purchased Product: ', '') : msg.content}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {msg.status === MessageStatus.PENDING && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100">
                                                                <Clock size={12} /> Pending
                                                            </span>
                                                        )}
                                                        {msg.status === MessageStatus.REPLIED && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                                <CheckCircle2 size={12} /> Completed
                                                            </span>
                                                        )}
                                                        {isRefunded && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                                                <Ban size={12} /> Refunded
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className={`font-mono font-bold flex items-center justify-end gap-1 ${isRefunded ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                                            <Coins size={14} /> {msg.amount}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {messages.length === 0 && (
                                            <tr><td colSpan={4} className="p-12 text-center text-slate-400">No transactions found.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                             </div>
                        </div>
                    </div>
                )}

                {/* --- VIEW: SUPPORT --- */}
                {currentView === 'SUPPORT' && (
                    <div className="p-6 max-w-2xl mx-auto animate-in fade-in flex items-center justify-center min-h-[500px]">
                         <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 text-center space-y-6 max-w-md w-full relative overflow-hidden">
                             {/* Decorative Background */}
                             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                             
                             <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-inner ring-4 ring-blue-50/50">
                                 <AlertCircle size={40} />
                             </div>
                             
                             <div>
                                <h3 className="text-2xl font-black text-slate-900 mb-2">How can we help?</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    Our support team is available Monday through Friday, 9am - 5pm EST. We usually respond within 24 hours.
                                </p>
                             </div>

                             <div className="space-y-3 pt-2">
                                 <Button fullWidth className="h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10">
                                    <MessageSquare size={18}/> Contact Support
                                 </Button>
                                 <Button fullWidth variant="secondary" className="h-12 rounded-xl flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200">
                                    <FileText size={18}/> View FAQ & Guides
                                 </Button>
                             </div>

                             <div className="pt-6 border-t border-slate-100">
                                 <p className="text-xs text-slate-400">
                                     Direct Email: <a href="#" className="text-indigo-600 font-bold hover:underline">support@bluechecked.com</a>
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
                                <div className="bg-slate-900 text-white rounded-lg px-4 py-3 shadow-lg flex items-center gap-3">
                                    <CheckCircle2 size={20} className="text-green-400" />
                                    <span className="font-bold text-sm">Profile updated successfully!</span>
                                </div>
                            </div>
                        )}
                        <div className="bg-white p-6 rounded-xl border border-slate-200">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-2">Your Profile</h3>
                            <div className="space-y-6">
                                <div className="flex items-center gap-6">
                                    <div className="w-20 h-20 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
                                        {profileForm.avatarUrl ? <img src={profileForm.avatarUrl} className="w-full h-full object-cover" /> : <User size={32} className="m-auto text-slate-300"/>}
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Profile Photo</label>
                                        <div className="flex gap-2">
                                            {profileForm.avatarUrl?.startsWith('data:') ? (
                                                <div className="flex items-center gap-2 w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 text-sm">
                                                    <span className="truncate flex-1">Image uploaded from device</span>
                                                    <button onClick={() => setProfileForm(p => ({...p, avatarUrl: ''}))} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                                                </div>
                                            ) : (
                                                <input 
                                                    type="text" 
                                                    value={profileForm.avatarUrl}
                                                    onChange={e => setProfileForm(p => ({...p, avatarUrl: e.target.value}))}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
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
                                        value={profileForm.name} 
                                        onChange={e => setProfileForm(p => ({...p, name: e.target.value}))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Age (Optional)</label>
                                    <input 
                                        type="number" 
                                        value={profileForm.age} 
                                        onChange={e => setProfileForm(p => ({...p, age: e.target.value}))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"
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
                      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                         <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                             <h3 className="text-sm font-bold text-slate-900">Your Conversations</h3>
                             {/* Search Input - More Prominent */}
                             <div className="relative w-full sm:w-auto group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Search messages..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full sm:w-72 pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all shadow-sm"
                                />
                             </div>
                         </div>

                         {isLoading ? (
                            <div className="text-center py-12 text-sm text-slate-400">Loading requests...</div>
                         ) : filteredGroups.length === 0 ? (
                            <div className="text-center py-16">
                                <MessageSquare size={32} className="mx-auto text-slate-300 mb-3" />
                                <h3 className="text-sm font-bold text-slate-900 mb-1">
                                    {searchQuery ? 'No conversations found' : 'No messages yet'}
                                </h3>
                                <p className="text-xs text-slate-500 mb-6">
                                    {searchQuery ? 'Try a different search term.' : 'Find an expert to help you solve your problem.'}
                                </p>
                                {!searchQuery && (
                                    <Button onClick={() => setCurrentView('EXPLORE')} className="rounded-full shadow-lg shadow-indigo-200">
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
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expert</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Latest Status</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Sessions</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Last Active</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredGroups.map(group => {
                                            const latestMsg = group.latestMessage;
                                            const timeLeft = getTimeLeft(latestMsg.expiresAt);
                                            return (
                                                <tr key={group.creatorId} onClick={() => handleOpenChat(group.creatorId)} className="group cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                                                                {group.creatorAvatarUrl ? (
                                                                    <img src={group.creatorAvatarUrl} className="w-full h-full object-cover" alt={group.creatorName} />
                                                                ) : (
                                                                    <User size={20} />
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-slate-900">{group.creatorName}</span>
                                                                <span className="text-[10px] text-slate-500">View Conversation &rarr;</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {latestMsg.status === MessageStatus.PENDING ? (
                                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${timeLeft.bg} ${timeLeft.color} border-current/20 flex items-center gap-1 w-fit`}>
                                                                <Clock size={10} /> Pending Reply
                                                            </span>
                                                        ) : latestMsg.status === MessageStatus.REPLIED ? (
                                                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1 w-fit">
                                                                <CheckCircle2 size={10} /> Replied
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 w-fit">Refunded</span>
                                                        )}
                                                        <p className="text-[10px] text-slate-400 mt-1 truncate max-w-[150px]">
                                                            {latestMsg.conversation[latestMsg.conversation.length - 1]?.content || latestMsg.content}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">{group.messageCount}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-xs text-slate-500">{new Date(latestMsg.createdAt).toLocaleDateString()}</span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {/* Mobile Cards */}
                            <div className="md:hidden divide-y divide-slate-100">
                                {filteredGroups.map(group => {
                                    const latestMsg = group.latestMessage;
                                    const timeLeft = getTimeLeft(latestMsg.expiresAt);
                                    return (
                                        <div key={group.creatorId} onClick={() => handleOpenChat(group.creatorId)} className="p-4 active:bg-slate-50 cursor-pointer">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 overflow-hidden shadow-sm">
                                                    {group.creatorAvatarUrl ? (
                                                        <img src={group.creatorAvatarUrl} className="w-full h-full object-cover" alt={group.creatorName} />
                                                    ) : (
                                                        <User size={20} />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-sm font-bold text-slate-900">{group.creatorName}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono">{new Date(latestMsg.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="mt-1">
                                                        {latestMsg.status === MessageStatus.PENDING ? (
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${timeLeft.bg} ${timeLeft.color} border-current/20 flex items-center gap-1 w-fit`}>
                                                                <Clock size={10} /> Pending Reply
                                                            </span>
                                                        ) : latestMsg.status === MessageStatus.REPLIED ? (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1 w-fit">
                                                                <CheckCircle2 size={10} /> Replied
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 w-fit">Refunded</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-600 line-clamp-2 mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
                                                "{latestMsg.conversation[latestMsg.conversation.length - 1]?.content || latestMsg.content}"
                                            </p>
                                            <div className="flex justify-between items-center mt-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{group.messageCount} Sessions</span>
                                                <div className="text-xs font-bold text-blue-600 flex items-center gap-1">View <ChevronRight size={14} /></div>
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
                     <div className="h-full flex flex-col bg-[#F0F2F5] animate-in slide-in-from-right-4">
                        {/* Internal Chat Header */}
                        <div className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between shadow-sm flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedCreatorId(null)} className="p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors">
                                    <ChevronLeft size={20} />
                                </button>
                                <div>
                                    <h2 className="font-bold text-slate-900 text-lg leading-tight">{conversationGroups.find(g => g.creatorId === selectedCreatorId)?.creatorName || 'Creator'}</h2>
                                    <p className="text-[10px] text-slate-500 font-medium">Verified Expert</p>
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-8 scroll-smooth" ref={scrollRef}>
                             {threadMessages.map((msg, msgIndex) => {
                                const isPending = msg.status === MessageStatus.PENDING;
                                const isRefunded = msg.status === MessageStatus.EXPIRED || msg.status === MessageStatus.CANCELLED;
                                return (
                                    <div key={msg.id} className="relative group">
                                        <div className="flex items-center justify-center gap-4 mb-6 opacity-60">
                                            <div className="h-px bg-slate-300 flex-1"></div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-[#F0F2F5] px-2 flex items-center gap-1">
                                                Session {msgIndex + 1} • {new Date(msg.createdAt).toLocaleDateString()}
                                            </span>
                                            <div className="h-px bg-slate-300 flex-1"></div>
                                        </div>
                                        <div className="flex flex-col">
                                            {msg.conversation.map((chat, chatIndex) => {
                                                const isMe = chat.role === 'FAN';
                                                const nextChat = msg.conversation[chatIndex + 1];
                                                const prevChat = msg.conversation[chatIndex - 1];
                                                
                                                const getMinuteBucket = (ts: string) => Math.floor(new Date(ts).getTime() / 60000);
                                                const currentBucket = getMinuteBucket(chat.timestamp);
                                                const prevBucket = prevChat ? getMinuteBucket(prevChat.timestamp) : -1;
                                                const nextBucket = nextChat ? getMinuteBucket(nextChat.timestamp) : -1;

                                                const isLastInGroup = !nextChat || nextChat.role !== chat.role || nextBucket !== currentBucket;
                                                const isFirstInGroup = !prevChat || prevChat.role !== chat.role || prevBucket !== currentBucket;
                                                return (
                                                    <React.Fragment key={`${msg.id}-${chatIndex}`}>
                                                    <div className={`flex gap-3 max-w-[85%] md:max-w-[75%] ${isMe ? 'ml-auto justify-end' : ''} ${isFirstInGroup ? 'mt-4' : 'mt-1'}`}>
                                                        {!isMe && (
                                                            <div className={`w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-300 shadow-sm mt-1 ${isFirstInGroup ? '' : 'opacity-0 border-transparent shadow-none'}`}>
                                                                {isFirstInGroup && (
                                                                    msg.creatorAvatarUrl ? (
                                                                        <img src={msg.creatorAvatarUrl} alt="Creator" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <User size={16} className="text-slate-400" />
                                                                    )
                                                                )}
                                                            </div>
                                                        )}
                                                        <div className={`space-y-1 w-full ${isMe ? 'text-right' : 'text-left'}`}>
                                                            <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap inline-block text-left 
                                                                ${isMe ? `bg-blue-600 text-white ${isFirstInGroup ? 'rounded-tr-sm' : 'rounded-tr-2xl'}` : `bg-white text-slate-800 border border-slate-200 ${isFirstInGroup ? 'rounded-tl-sm' : 'rounded-tl-2xl'}`}`}>
                                                                {chat.content}
                                                                {isMe && chatIndex === 0 && msg.attachmentUrl && (
                                                                    <div className="mt-2 rounded-lg overflow-hidden border border-white/20">
                                                                        <img src={msg.attachmentUrl} alt="Attachment" className="w-full h-auto max-w-[200px]" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {isLastInGroup && (
                                                                <div className={`flex items-center gap-1.5 px-1 text-[10px] text-slate-400 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                                    <span>{new Date(chat.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Auto-Reply / Welcome Message (Always shown after first message) */}
                                                    {chatIndex === 0 && (
                                                        <div className="flex gap-3 max-w-[85%] md:max-w-[75%] mt-4">
                                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-300 shadow-sm mt-1">
                                                                {msg.creatorAvatarUrl ? (
                                                                    <img src={msg.creatorAvatarUrl} alt="Creator" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <User size={16} className="text-slate-400" />
                                                                )}
                                                            </div>
                                                            <div className="space-y-1 w-full text-left">
                                                                <div className="px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap inline-block text-left bg-white text-slate-800 border border-slate-200 rounded-tl-sm">
                                                                    {currentCreator?.welcomeMessage || "Thanks for your request! I've received it and will get back to you shortly."}
                                                                    {isPending && (
                                                                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 uppercase tracking-wide">
                                                                            <ShieldCheck size={12} /> 
                                                                            <span>Priority Active • {getTimeLeft(msg.expiresAt).text}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    </React.Fragment>
                                                )
                                            })}
                                            {isRefunded && (
                                                <div className="flex justify-center mt-4">
                                                    <div className="bg-slate-100 text-slate-500 text-xs px-3 py-1.5 rounded-full border border-slate-200 flex items-center gap-2">
                                                        <Ban size={12} /> This session was refunded.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="h-4"></div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="bg-white border-t border-slate-200 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)] z-20 flex-shrink-0">
                            {latestMessage && latestMessage.status === MessageStatus.PENDING && (
                                <div className="p-4 flex items-center justify-between bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white p-2 rounded-full border border-slate-200 shadow-sm animate-pulse">
                                            <Clock size={20} className="text-amber-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">Waiting for reply...</p>
                                            <p className="text-xs text-slate-400">Request expires in {getTimeLeft(latestMessage.expiresAt).text}</p>
                                        </div>
                                    </div>
                                    
                                    {confirmCancelId === latestMessage.id ? (
                                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                            <span className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-1">Refund <Coins size={10}/>{latestMessage.amount}?</span>
                                            <Button size="sm" variant="ghost" onClick={() => setConfirmCancelId(null)}>No</Button>
                                            <Button size="sm" variant="danger" onClick={processCancellation} isLoading={isCancelling}>Yes, Cancel</Button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => handleCancelClick(latestMessage.id)}
                                            className="text-slate-400 hover:text-red-600 text-xs font-bold hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors"
                                        >
                                            Cancel Request
                                        </button>
                                    )}
                                </div>
                            )}

                            {latestMessage && latestMessage.status === MessageStatus.REPLIED && (
                                <div className="p-4 bg-slate-50/50">
                                     {/* Rating Section */}
                                     {!hasRated && !showRatingSuccess && (
                                         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4 text-center">
                                             <h4 className="font-bold text-slate-900 text-sm mb-2">How was the answer?</h4>
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
                                                            className={`${(hoveredStar || rating) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'} transition-colors`}
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
                                                         className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20 mb-3"
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
                                                className={`flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 font-bold py-2 text-sm rounded-xl transition-all shadow-sm ${hasThanked ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
                                             >
                                                 <Heart size={16} className={hasThanked ? "fill-pink-500 text-pink-500" : ""} /> {hasThanked ? 'Thanks Sent' : 'Send Thanks'}
                                             </button>
                                             <button 
                                                onClick={() => setShowFollowUpInput(true)}
                                                className="flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 font-bold py-2 text-sm rounded-xl transition-all shadow-lg shadow-slate-900/10"
                                             >
                                                 <MessageSquare size={16} /> New Request
                                             </button>
                                         </div>
                                     ) : (
                                         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-lg relative animate-in slide-in-from-bottom-2">
                                             <button 
                                                onClick={() => { setShowFollowUpInput(false); setCustomAppreciationMode(false); }}
                                                className="absolute top-2 right-2 p-1 text-slate-300 hover:text-slate-500 rounded-full hover:bg-slate-50"
                                             >
                                                 <X size={16} />
                                             </button>
                                             
                                             <h4 className="font-bold text-slate-900 text-sm mb-3">
                                                 {showFollowUpInput ? 'Send Follow-up Request' : 'Send Appreciation'}
                                             </h4>
                                             
                                             <textarea 
                                                value={showFollowUpInput ? followUpText : customAppreciationText}
                                                onChange={e => showFollowUpInput ? setFollowUpText(e.target.value) : setCustomAppreciationText(e.target.value)}
                                                placeholder={showFollowUpInput ? "Ask another question..." : "Write a nice note..."}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24 mb-3"
                                             />

                                             {showFollowUpInput && (
                                                 <div className="flex justify-between items-center mb-3 text-xs text-slate-500 px-1">
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
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-900">All Notifications</h3>
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
            </div>
        </main>

        {/* Top Up Modal */}
        {showTopUpModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
                    <button onClick={() => setShowTopUpModal(false)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 z-10 transition-colors"><X size={18}/></button>
                    
                    <div className="p-8">
                        <div className="text-center mb-6">
                            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Available Balance</div>
                            <div className="text-4xl font-black text-slate-900 mb-4 flex justify-center items-baseline gap-1">
                                {currentUser?.credits?.toLocaleString() || 0}
                                <span className="text-sm font-bold text-slate-400 uppercase">Credits</span>
                            </div>
                            <h3 className="font-bold text-lg text-slate-800">Add Credits</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {[500, 1000, 2500, 5000].map(amt => (
                                <button 
                                key={amt}
                                onClick={() => setTopUpAmount(amt)}
                                className={`p-3 rounded-xl border text-center transition-all ${topUpAmount === amt ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'}`}
                                >
                                    <div className="font-black text-lg">{amt}</div>
                                    <div className={`text-[10px] font-bold uppercase ${topUpAmount === amt ? 'text-indigo-200' : 'text-slate-400'}`}>Credits</div>
                                </button>
                            ))}
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center mb-6 border border-slate-100">
                            <span className="text-sm font-medium text-slate-600">Total Cost</span>
                            <span className="font-black text-slate-900 text-xl">${(topUpAmount / 100).toFixed(2)}</span>
                        </div>

                        <Button 
                            fullWidth 
                            size="lg" 
                            onClick={handleTopUp}
                            isLoading={isProcessingTopUp}
                            className="bg-slate-900 text-white rounded-xl h-12 font-bold shadow-lg shadow-slate-900/20"
                        >
                            Pay & Add Credits
                        </Button>
                        <p className="text-center text-[10px] text-slate-400 mt-4 flex items-center justify-center gap-1">
                            <Lock size={10} /> Secure encrypted payment
                        </p>
                    </div>
                </div>
            </div>
        )}

        {toastMessage && (
            <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-500">
                <div className="relative overflow-hidden bg-slate-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 border border-white/10 ring-1 ring-white/20">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 opacity-20"></div>
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="bg-gradient-to-tr from-blue-400 to-indigo-500 p-1.5 rounded-full shadow-lg shadow-indigo-500/20">
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
