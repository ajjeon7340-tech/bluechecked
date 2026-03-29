import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CreatorProfile, CurrentUser, AffiliateLink, Product } from '../types';
import { DiemLogo, CheckCircle2, Clock, ShieldCheck, MessageSquare, ExternalLink, User, DollarSign, Save, LogOut, ChevronRight, Camera, Heart, Paperclip, X, Sparkles, ArrowRight, Lock, Star, Trash, Plus, Send, Check, ShoppingBag, Tag, CreditCard, YouTubeLogo, InstagramLogo, XLogo, TikTokLogo, Twitch, FileText, Download, Play, Coins, Wallet, Share, Image as ImageIcon, TrendingUp, LinkedInLogo, FacebookLogo, SnapchatLogo, PinterestLogo, DiscordLogo, TelegramLogo, WhatsAppLogo, RedditLogo, ThreadsLogo, PatreonLogo, SpotifyLogo, SoundCloudLogo, GitHubLogo, SubstackLogo, BeehiivLogo, OnlyFansLogo } from './Icons';
import { Button } from './Button';
import { sendMessage, updateCreatorProfile, addCredits, createCheckoutSession, isBackendConfigured, DEFAULT_AVATAR, toggleCreatorLike, getCreatorLikeStatus, getSecureDownloadUrl, logAnalyticsEvent, getCreatorTrendingStatus, getSupporters, Supporter } from '../services/realBackend';

interface Props {
  creator: CreatorProfile;
  currentUser: CurrentUser | null;
  onMessageSent: () => void;
  onCreateOwn: () => void;
  onLoginRequest: (preferredRole?: 'FAN' | 'CREATOR') => void;
  onNavigateToDashboard: (creatorId?: string) => void;
  onRefreshData: () => Promise<void>;
  startTutorial?: boolean;
  onTutorialDone?: () => void;
}

const getContrastColor = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#1c1917' : '#ffffff';
};

const ensureProtocol = (url: string) => {
    if (!url) return '';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return url;
    return `https://${url}`;
};

const getResponseTimeTooltip = (status: string, t: (key: string) => string) => {
    if (status === 'Lightning') return t('profile.responseTooltipLightning');
    if (status === 'Very Fast') return t('profile.responseTooltipVeryFast');
    if (status === 'Fast') return t('profile.responseTooltipFast');
    return t('profile.responseTooltipDefault');
};

export const CreatorPublicProfile: React.FC<Props> = ({
  creator,
  currentUser,
  onMessageSent,
  onCreateOwn,
  onLoginRequest,
  onNavigateToDashboard,
  onRefreshData,
  startTutorial = false,
  onTutorialDone,
}) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<'compose' | 'payment' | 'topup' | 'topup_success' | 'success' | 'product_confirm' | 'product_payment' | 'product_success' | 'support_confirm' | 'support_payment' | 'support_success'>('compose');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [generalMessage, setGeneralMessage] = useState(''); 
  const [attachments, setAttachments] = useState<{url: string, type: 'IMAGE' | 'FILE', name: string}[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Profile Tutorial
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showTutorial, setShowTutorial] = useState(startTutorial);
  useEffect(() => { if (startTutorial) { setTutorialStep(0); setShowTutorial(true); } }, [startTutorial]);
  const tutorialDiemBtnRef = useRef<HTMLDivElement>(null);
  const tutorialLinksRef = useRef<HTMLDivElement>(null);

  const PROFILE_TUTORIAL_STEPS = [
    { emoji: '👋', title: 'Welcome to a Creator\'s Profile', desc: `This is ${creator.displayName}'s public page. You can see their bio, response time, and links. Every creator on Diem accepts personal messages from fans — that's what makes it special.` },
    { emoji: '💬', title: 'Send a Diem Message', desc: `Tap the "Diem" button to send a personal message. Write your question or request, attach photos if needed, and pay the creator's fee. They have a limited time to reply.` },
    { emoji: '⏱️', title: 'Guaranteed Reply or Refund', desc: `If the creator doesn't reply within their response window, you automatically get your credits back. No risk — your message is always worth sending.` },
    { emoji: '🔗', title: 'Links & Products', desc: `Scroll down to see their links, digital downloads, and support options. You can buy products or send a tip right from their profile.` },
    { emoji: '🚀', title: 'You\'re Ready!', desc: `That's everything! Browse creators on Explore, send Diems, and get personal replies. Let's go!` },
  ];

  const handleTutorialNext = () => {
    if (tutorialStep < PROFILE_TUTORIAL_STEPS.length - 1) {
      const next = tutorialStep + 1;
      setTutorialStep(next);
      if (next === 3) setTimeout(() => tutorialLinksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    } else {
      setShowTutorial(false);
      onTutorialDone?.();
    }
  };

  // Trending Status
  const [isTrending, setIsTrending] = useState(false);

  useEffect(() => {
      getCreatorTrendingStatus(creator.id).then(result => {
          setIsTrending(result.isTrending);
      });
  }, [creator.id]);

  // Product Purchase State
  const [selectedProductLink, setSelectedProductLink] = useState<AffiliateLink | null>(null);

  // Support / Tip State
  const [supportAmount, setSupportAmount] = useState(100);
  const [supportMinAmount, setSupportMinAmount] = useState(100);
  const [supportMessage, setSupportMessage] = useState('');
  const [supportIsAnonymous, setSupportIsAnonymous] = useState(false);
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [loadingSupporters, setLoadingSupporters] = useState(false);

  // Customization State (disabled — editing done from dashboard)
  const isCustomizeMode = false;
  const [editedCreator, setEditedCreator] = useState(creator);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Link Adding State
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // Interaction State
  const [hasLiked, setHasLiked] = useState(false);
  const [likes, setLikes] = useState(creator.likesCount || 0);

  // Credit/Top-up State
  const [topUpAmount, setTopUpAmount] = useState(500);
  const [imgError, setImgError] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showPostSendPrompt, setShowPostSendPrompt] = useState(false);
  const viewLogRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setEmail(currentUser.email || '');
    }
  }, [currentUser]);

  useEffect(() => {
    setEditedCreator(creator);
    setLikes(creator.likesCount || 0);
    
    // Check initial like status
    if (currentUser) {
        getCreatorLikeStatus(creator.id).then(status => {
            setHasLiked(status);
        });
    }
  }, [creator, currentUser]);

  useEffect(() => {
    if (viewLogRef.current === creator.id) return;
    // Log Page View
    logAnalyticsEvent(creator.id, 'VIEW');
    viewLogRef.current = creator.id;
  }, [creator.id]);

  useEffect(() => {
    setImgError(false);
  }, [editedCreator.avatarUrl]);

  // Fetch supporters on load
  useEffect(() => {
    const hasSupportLink = creator.links.some(l => l.type === 'SUPPORT');
    if (!hasSupportLink) return;
    setLoadingSupporters(true);
    getSupporters(creator.id).then(list => {
        setSupporters(list);
        setLoadingSupporters(false);
    });
  }, [creator.id]);

  const handleOpenModal = () => {
    if (!isCustomizeMode) {
      setGeneralMessage('');
      setAttachments([]);
      setStep('compose');
      setIsModalOpen(true);
    }
  };

  const handleProductClick = (link: AffiliateLink) => {
      if (isCustomizeMode) return;
      setSelectedProductLink(link);
      logAnalyticsEvent(creator.id, 'CLICK', { type: 'PRODUCT', id: link.id, title: link.title });
      setStep('product_confirm');
      setIsModalOpen(true);
  };

  const handleSupportClick = (defaultAmount?: number) => {
      if (isCustomizeMode) return;
      const min = defaultAmount || 100;
      setSupportMinAmount(min);
      setSupportAmount(min);
      setSupportMessage('');
      setSupportIsAnonymous(false);
      setStep('support_confirm');
      setIsModalOpen(true);
  };

  const checkBalance = (cost: number) => {
      if (!currentUser) return false;
      return currentUser.credits >= cost;
  };

  const handleTopUp = async () => {
      setIsSubmitting(true);

      // Try Stripe Checkout if backend is configured
      if (isBackendConfigured()) {
          try {
              // Store creator handle so App.tsx returns user here after checkout
              if (creator.handle) {
                  localStorage.setItem('diem_return_to_creator', creator.handle);
              }
              const { url } = await createCheckoutSession(topUpAmount, window.location.origin + '/dashboard');
              if (url) {
                  window.location.href = url;
                  return;
              }
          } catch (e: any) {
              console.error(e);
              // Fall through to mock
          }
      }

      // Mock fallback
      try {
          await new Promise(r => setTimeout(r, 1500));
          await addCredits(topUpAmount);
          await onRefreshData();

          setIsSubmitting(false);
          const prevStep = step;
          setStep('topup_success');
          setTimeout(() => {
              if (selectedProductLink) {
                  setStep('product_payment');
              } else if (prevStep === 'support_payment' || prevStep === 'support_confirm') {
                  setStep('support_payment');
              } else {
                  setStep('payment');
              }
          }, 2800);
      } catch (e) {
          console.error(e);
          setIsSubmitting(false);
          alert(t('profile.failedTopUp'));
      }
  };

  const handleSend = async () => {
    setIsSubmitting(true);
    try {
        await sendMessage(creator.id, name, email, generalMessage, creator.pricePerMessage, attachments);
        logAnalyticsEvent(creator.id, 'CONVERSION', { type: 'MESSAGE', price: creator.pricePerMessage });
        setIsSubmitting(false);
        setIsModalOpen(false);
        setShowPostSendPrompt(true);
        onMessageSent();
    } catch (e: any) {
        setIsSubmitting(false);
        if (e.message.includes("Insufficient")) {
            setStep('topup');
        } else {
            alert(e.message);
        }
    }
  };

  const handleProductPurchase = async () => {
      if (!selectedProductLink || !selectedProductLink.price) return;
      
      setIsSubmitting(true);
      // Simulate deduction logic (would be a real API call)
      try {
        await sendMessage(creator.id, name, email, `Purchased Product: ${selectedProductLink.title}`, selectedProductLink.price);
        logAnalyticsEvent(creator.id, 'CONVERSION', { type: 'PRODUCT', id: selectedProductLink.id, title: selectedProductLink.title, price: selectedProductLink.price });
        setIsSubmitting(false);
        setStep('product_success');
      } catch (e: any) {
          setIsSubmitting(false);
          if (e.message.includes("Insufficient")) {
              setStep('topup');
          } else {
              alert(e.message);
          }
      }
  };

  const handleSupportPayment = async () => {
      setIsSubmitting(true);
      try {
        const msgContent = supportIsAnonymous
            ? `Fan Tip: [anon] ${supportMessage || 'Just a token of appreciation!'}`
            : `Fan Tip: ${supportMessage || 'Just a token of appreciation!'}`;
        await sendMessage(creator.id, name, email, msgContent, supportAmount);
        logAnalyticsEvent(creator.id, 'CONVERSION', { type: 'TIP', amount: supportAmount });
        setIsSubmitting(false);
        setStep('support_success');
        // Refresh supporter list
        getSupporters(creator.id).then(setSupporters);
      } catch (e: any) {
          setIsSubmitting(false);
          if (e.message.includes("Insufficient")) {
              setStep('topup');
          } else {
              alert(e.message);
          }
      }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setStep('compose');
    setGeneralMessage('');
    setAttachments([]);
    setSelectedProductLink(null);
    if (step === 'success') onMessageSent();
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
        await updateCreatorProfile(editedCreator);
        await onRefreshData(); 
        setIsCustomizeMode(false);
    } catch (e) {
        console.error("Failed to save profile", e);
        alert(t('profile.failedSaveProfile'));
    } finally {
        setIsSavingProfile(false);
    }
  };

  const updateField = (field: keyof CreatorProfile, value: any) => {
    setEditedCreator(prev => ({ ...prev, [field]: value }));
  };

  const handleUpdateLink = (id: string, field: keyof AffiliateLink, value: any) => {
    setEditedCreator(prev => ({
        ...prev,
        links: (prev.links || []).map(l => l.id === id ? { ...l, [field]: value } : l)
    }));
  };

  const handleAddLink = () => {
    if (!newLinkTitle.trim()) return;
    const newLink: AffiliateLink = {
        id: `l-${Date.now()}`,
        title: newLinkTitle,
        url: newLinkUrl,
        isPromoted: false,
        type: 'EXTERNAL'
    };
    setEditedCreator(prev => ({
        ...prev,
        links: [...(prev.links || []), newLink]
    }));
    setNewLinkTitle('');
    setNewLinkUrl('');
  };

  const handleRemoveLink = (id: string) => {
    setEditedCreator(prev => ({
        ...prev,
        links: (prev.links || []).filter(l => l.id !== id)
    }));
  };

  const isFormValid = () => {
    return generalMessage.trim().length > 0;
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
          alert(t('profile.uploadValidImage'));
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
            updateField('avatarUrl', dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarEdit = () => {
    avatarInputRef.current?.click();
  };

  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'IMAGE' | 'FILE') => {
    const files = e.target.files;
    if (!files) return;

    const currentTypeCount = attachments.filter(a => a.type === type).length;
    const max = 3;

    if (currentTypeCount + files.length > max) {
        alert(t('profile.maxAttachments', { max, type: type === 'IMAGE' ? t('profile.photos') : t('profile.files') }));
        if (e.target) e.target.value = '';
        return;
    }

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
            setAttachments(prev => [...prev, {
                url: reader.result as string,
                type,
                name: file.name
            }]);
        };
        reader.readAsDataURL(file);
    });
    
    if (e.target) e.target.value = '';
  };

  const handleLike = async () => {
      if (!currentUser) {
          onLoginRequest();
          return;
      }
      try {
          const result = await toggleCreatorLike(creator.id);
          setHasLiked(result.hasLiked);
          setLikes(result.likes);
      } catch (e) {
          console.error("Failed to toggle like", e);
      }
  };

  const handleShare = async () => {
      const shareUrl = creator.handle && creator.handle !== '@user'
          ? `${window.location.origin}/${creator.handle.replace('@', '')}`
          : window.location.href;

      navigator.clipboard.writeText(shareUrl);
      alert(t('profile.linkCopied'));
      logAnalyticsEvent(creator.id, 'CLICK', { type: 'SHARE' });
  };

  // Helper to get platform icon
  const getPlatformIcon = (platform: string) => {
      const cls = "w-4 h-4 sm:w-5 sm:h-5";
      const clsSm = "w-3.5 h-3.5 sm:w-4 sm:h-4";
      switch(platform.toLowerCase()) {
          case 'youtube':    return <YouTubeLogo className={`${cls} text-[#FF0000]`} />;
          case 'instagram':  return <InstagramLogo className={`${cls} text-[#E4405F]`} />;
          case 'x':          return <XLogo className={`${clsSm} text-black`} />;
          case 'tiktok':     return <TikTokLogo className={`${clsSm} text-black`} />;
          case 'twitch':     return <Twitch size={16} className="sm:!w-[18px] sm:!h-[18px] text-[#9146FF]" />;
          case 'threads':    return <ThreadsLogo className={`${cls} text-black`} />;
          case 'facebook':   return <FacebookLogo className={`${cls} text-[#1877F2]`} />;
          case 'discord':    return <DiscordLogo className={`${cls} text-[#5865F2]`} />;
          case 'linkedin':   return <LinkedInLogo className={`${clsSm} text-[#0A66C2]`} />;
          case 'snapchat':   return <SnapchatLogo className={`${clsSm} text-[#FFFC00]`} />;
          case 'pinterest':  return <PinterestLogo className={`${cls} text-[#E60023]`} />;
          case 'reddit':     return <RedditLogo className={`${cls} text-[#FF4500]`} />;
          case 'telegram':   return <TelegramLogo className={`${cls} text-[#26A5E4]`} />;
          case 'whatsapp':   return <WhatsAppLogo className={`${cls} text-[#25D366]`} />;
          case 'spotify':    return <SpotifyLogo className={`${cls} text-[#1DB954]`} />;
          case 'soundcloud': return <SoundCloudLogo className={`${cls} text-[#FF5500]`} />;
          case 'patreon':    return <PatreonLogo className={`${clsSm} text-[#FF424D]`} />;
          case 'onlyfans':   return <OnlyFansLogo className={`${cls} text-[#00AFF0]`} />;
          case 'substack':   return <SubstackLogo className={`${clsSm} text-[#FF6719]`} />;
          case 'beehiiv':    return <BeehiivLogo className={`${clsSm} text-[#F5C518]`} />;
          case 'github':     return <GitHubLogo className={`${clsSm} text-black`} />;
          default:           return <Sparkles size={16} className="sm:!w-[18px] sm:!h-[18px] text-stone-400" />;
      }
  };

  // Determine which links/products to show: the live ones or the edited ones
  const displayedLinks = isCustomizeMode ? (editedCreator.links || []) : (creator.links || []);
  const platforms = isCustomizeMode ? (editedCreator.platforms || []) : (creator.platforms || []);

  // Group links by custom sections
  const displayedSections = isCustomizeMode ? (editedCreator.linkSections || []) : (creator.linkSections || []);
  const sortedSections = [...displayedSections].sort((a, b) => a.order - b.order);
  const groupedLinks: { id: string | null; title: string | null; links: typeof displayedLinks }[] = sortedSections.length > 0
    ? [
        ...sortedSections.map(s => ({ id: s.id, title: s.title, links: displayedLinks.filter(l => l.sectionId === s.id) })),
        { id: null, title: null, links: displayedLinks.filter(l => !l.sectionId) },
      ]
    : [{ id: null, title: null, links: displayedLinks }];

  const profileFontClass = {
    'inter': 'font-sans',
    'playfair': "font-['Playfair_Display',serif]",
    'space-grotesk': "font-['Space_Grotesk',sans-serif]",
    'dm-serif': "font-['DM_Serif_Text',serif]",
  }[creator.profileFont || 'inter'] || 'font-sans';

  const linkBlockStyle = creator.bannerGradient
    ? { backgroundColor: creator.bannerGradient, borderColor: creator.bannerGradient === '#1c1917' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }
    : { backgroundColor: '#ffffff', borderColor: 'rgb(231 229 228 / 0.6)' };

  const cornerRadiusValue = {
    'soft': '8px',
    'rounded': '16px',
    'pill': '999px',
  }[creator.cornerRadius || 'rounded'] || '16px';
  const cardCornerRadiusValue = {
    'soft': '8px',
    'rounded': '16px',
    'pill': '24px',
  }[creator.cornerRadius || 'rounded'] || '16px';
  const linkBlockStyleWithRadius = { ...linkBlockStyle, borderRadius: cornerRadiusValue };

  return (
    <div className={`min-h-screen ${profileFontClass} text-stone-900 pb-20 selection:bg-stone-200 selection:text-stone-900 relative bg-[#FAF9F6]`}>
      <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
          @keyframes pulse-soft {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          .animate-float { animation: float 6s ease-in-out infinite; }
          .animate-pulse-soft { animation: pulse-soft 3s ease-in-out infinite; }
      `}</style>

      {/* Warm Background Gradient - Weverse Style */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 hidden sm:block">
          <div className="absolute -top-[10%] -right-[10%] w-[600px] h-[600px] bg-stone-200/20 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[0%] -left-[10%] w-[500px] h-[500px] bg-stone-100/30 rounded-full blur-[80px]"></div>
      </div>

      <input 
        type="file" 
        ref={avatarInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleAvatarChange}
      />

      {isCustomizeMode && (
          <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4">
             <Button size="lg" onClick={handleSaveProfile} isLoading={isSavingProfile} className="shadow-xl bg-stone-900 text-white hover:bg-stone-800 rounded-2xl px-6">
               <Save size={18} className="mr-2" /> {t('common.saveChanges')}
             </Button>
          </div>
        )}

      {/* Main Layout - Single Column / Vertical Stack */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 pt-2 flex flex-col gap-5 items-center">

          {/* 1. PROFILE INFO & STATS */}
          <div className="w-full">
             <div className="border border-stone-200/60 relative transition-all" style={{ backgroundColor: creator.bannerGradient || '#ffffff', borderRadius: cardCornerRadiusValue }}>
                <div className="px-4 py-3 flex justify-between items-center">
                    <div
                      onClick={onCreateOwn}
                      className="flex items-center cursor-pointer hover:opacity-70 transition-opacity"
                    >
                      <DiemLogo size={20} className="text-stone-800" />
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleShare}
                            className="w-9 h-9 bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-700 rounded-full transition-colors flex items-center justify-center flex-shrink-0"
                            title={t('common.share')}
                        >
                            <Share size={16} />
                        </button>


                    </div>
                </div>
                <div className="px-4 pt-1 pb-4 sm:px-6 sm:pb-6 relative z-10">
                    <div className="flex flex-col items-center text-center gap-2">
                        {/* Instagram Notes style: Avatar with thought bubble overlaid */}
                        <div className={`flex flex-col items-center flex-shrink-0 relative`}>
                        {/* Avatar container - bubble overlaps onto avatar */}
                        <div className="relative">
                        {/* Thought bubble overlapping top of avatar */}
                        {!isCustomizeMode && (creator.showBio ?? true) && creator.bio && (
                            <div className="absolute bottom-[75%] sm:bottom-[70%] left-1/2 -translate-x-1/2 z-30" style={{ width: 'max-content', maxWidth: '220px' }}>
                                <div className="bg-white rounded-[20px] px-4 py-2.5 shadow-lg border border-stone-200/60">
                                    <p className="text-xs sm:text-sm text-stone-800 leading-snug font-medium text-center">
                                        {creator.bio}
                                    </p>
                                </div>
                                {/* Thought bubble dots trailing from left toward center */}
                                <div className="relative h-5 mt-0.5">
                                    <div className="absolute left-3 top-0 w-2.5 h-2.5 bg-white rounded-full shadow-md border border-stone-200/60"></div>
                                    <div className="absolute left-6 top-2.5 w-1.5 h-1.5 bg-white rounded-full shadow-md border border-stone-200/60"></div>
                                </div>
                            </div>
                        )}
                        <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full p-1 overflow-hidden border border-stone-100 shadow-sm bg-white group">
                           {!imgError && (editedCreator.avatarUrl || DEFAULT_AVATAR) ? (
                               <img 
                                    src={editedCreator.avatarUrl || DEFAULT_AVATAR} 
                                    alt={editedCreator.displayName} 
                                    className={`w-full h-full rounded-full object-cover bg-stone-100 ${isCustomizeMode ? 'cursor-pointer hover:opacity-80' : ''}`}
                                    onClick={isCustomizeMode ? handleAvatarEdit : undefined}
                                    onError={() => setImgError(true)}
                                />
                           ) : (
                               <div 
                                    className={`w-full h-full rounded-full bg-stone-100 flex items-center justify-center text-stone-300 ${isCustomizeMode ? 'cursor-pointer hover:bg-stone-200' : ''}`}
                                    onClick={isCustomizeMode ? handleAvatarEdit : undefined}
                               >
                                   <User size={48} />
                               </div>
                           )}
                        
                            {isCustomizeMode && (
                                <div 
                                    className="absolute inset-0 flex items-center justify-center rounded-full cursor-pointer pointer-events-none z-20"
                                >
                                    <div className="bg-black/50 p-2 rounded-full text-white backdrop-blur-sm"><Camera size={20} /></div>
                                </div>
                            )}
                        </div>
                        </div>{/* close relative avatar container */}

                        {/* Likes & Rating (Moved below avatar) */}
                        {!isCustomizeMode && ((creator.showLikes ?? true) || (creator.showRating ?? true)) && (
                            <div className="flex items-center gap-2 -mt-5 relative z-20">
                                {(creator.showLikes ?? true) && (
                                <button
                                    onClick={handleLike}
                                    className={`flex items-center justify-center gap-1 bg-white px-3 py-1.5 rounded-full border border-stone-100 text-xs font-bold shadow-sm transition-colors ${hasLiked ? 'text-pink-600 border-pink-100' : 'text-stone-500 hover:text-pink-600 hover:bg-pink-50'}`}
                                >
                                    <Heart size={14} className={hasLiked ? "fill-current" : ""} />
                                    <span>{likes}</span>
                                </button>
                                )}

                                {(creator.showRating ?? true) && (
                                <div className="relative group/tooltip flex items-center justify-center gap-1 bg-white px-3 py-1.5 rounded-full border border-stone-100 text-xs font-bold text-stone-500 shadow-sm cursor-help">
                                    <Star size={14} className="text-yellow-400 fill-yellow-400" />
                                    <span className="text-stone-700">{creator.stats.averageRating.toFixed(1)}</span>
                                    
                                    {/* Response Time Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[160px] bg-stone-900 text-white text-[10px] font-medium py-2 px-3 rounded-xl opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 pointer-events-none z-50 text-center shadow-xl normal-case tracking-normal whitespace-normal transform translate-y-2 group-hover/tooltip:translate-y-0">
                                        <div className="font-bold text-emerald-400 mb-0.5 flex items-center justify-center gap-1">
                                            <Clock size={10} /> {creator.stats.responseTimeAvg} {t('profile.response')}
                                        </div>
                                        <div className="text-stone-300 leading-snug">
                                            {getResponseTimeTooltip(creator.stats.responseTimeAvg, t)}
                                        </div>
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900"></div>
                                    </div>
                                </div>
                                )}
                            </div>
                        )}
                        </div>

                        {/* Content Wrapper */}
                        <div className="flex-1 min-w-0 w-full flex flex-col items-center">
                            <div className="w-full flex flex-col items-center">
                                {isCustomizeMode ? (
                                    <div className="space-y-4 w-full text-center">
                                        <input 
                                            type="text" 
                                            value={editedCreator.displayName} 
                                            onChange={(e) => updateField('displayName', e.target.value)}
                                            className="block w-full text-2xl sm:text-3xl font-bold text-stone-900 border-b border-dashed border-stone-300 focus:border-black focus:outline-none bg-transparent placeholder-stone-300 text-center"
                                            placeholder={t('auth.displayName')}
                                        />
                                        <input 
                                            type="text" 
                                            value={editedCreator.handle} 
                                            onChange={(e) => updateField('handle', e.target.value)}
                                            className="block w-full text-sm text-stone-500 font-medium border-b border-dashed border-stone-300 focus:border-black focus:outline-none bg-transparent placeholder-stone-300 text-center"
                                            placeholder={`@${t('creator.handle').toLowerCase()}`}
                                        />
                                        <textarea
                                            value={editedCreator.bio}
                                            onChange={(e) => updateField('bio', e.target.value)}
                                            className="block w-full text-stone-600 border border-dashed border-stone-300 rounded-xl p-3 focus:ring-1 focus:ring-black min-h-[80px] bg-white text-sm mt-2 text-center"
                                            placeholder={t('auth.bioAbout')}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <h1 className="text-2xl sm:text-3xl font-bold sm:font-black text-stone-900 tracking-tight leading-tight mb-1">
                                            {creator.displayName}
                                        </h1>
                                        {creator.handle && creator.handle !== '@user' && (
                                            <p className="text-sm font-medium text-stone-500 mb-4">
                                                {creator.handle}
                                            </p>
                                        )}
                                        

                                        {platforms.length > 0 && (
                                            <div className="flex items-center justify-center gap-3">
                                                {platforms.map(platform => {
                                                const platformId = typeof platform === 'string' ? platform : platform.id;
                                                const platformUrl = typeof platform === 'string' ? '' : platform.url;
                                                return (
                                                    <a
                                                        key={platformId}
                                                        href={platformUrl ? ensureProtocol(platformUrl) : '#'}
                                                        target={platformUrl ? "_blank" : undefined}
                                                        rel="noopener noreferrer"
                                                        className={`w-8 h-8 flex items-center justify-center rounded-full bg-stone-50 border border-stone-100 transition-all ${platformUrl ? 'hover:bg-stone-100 hover:scale-110 cursor-pointer text-stone-600' : 'opacity-40 cursor-default text-stone-400'}`}
                                                        title={platformId}
                                                    >
                                                        {getPlatformIcon(platformId)}
                                                    </a>
                                                );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
             </div>
          </div>

          {/* Guaranteed Reply + Ask Me Anything */}
          {!isCustomizeMode && creator.diemEnabled !== false && (
              <div ref={tutorialDiemBtnRef} className={`w-full${showTutorial && tutorialStep === 1 ? ' ring-2 ring-amber-400 ring-offset-2 rounded-2xl' : ''}`}>
              <div
                  onClick={() => { currentUser ? handleOpenModal() : onLoginRequest(); }}
                  className={`w-full text-left p-3 sm:p-4 rounded-2xl border flex items-center gap-3 sm:gap-4 group cursor-pointer transition-all hover:shadow-md relative overflow-hidden ${creator.isDiemHighlighted ? 'bg-gradient-to-r from-indigo-50/40 to-blue-50/20 border-indigo-100 shadow-sm' : 'hover:border-stone-300 hover:shadow-sm'}`}
                  style={!creator.isDiemHighlighted ? linkBlockStyleWithRadius : undefined}
              >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform overflow-hidden bg-white border border-stone-100">
                      {creator.diemIcon?.startsWith('data:emoji,') ? (
                          <span className="text-2xl">{creator.diemIcon.replace('data:emoji,', '')}</span>
                      ) : creator.diemIcon ? (
                          <img src={creator.diemIcon} alt="Diem" className="w-full h-full object-cover" />
                      ) : (
                          <img src="/favicon.svg" alt="Diem" className="w-full h-full object-cover" />
                      )}
                  </div>
                  <div className="flex-1 relative z-10 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                          <h4 className="font-semibold sm:font-bold text-stone-900 text-sm sm:text-base group-hover:text-stone-700 transition-colors">DIEM</h4>
                          {isTrending && (
                              <span className="flex items-center gap-1 text-[10px] sm:text-xs text-blue-500 font-medium">
                                  <TrendingUp size={12} className="text-blue-500" />
                                  Trending
                              </span>
                          )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-stone-500 mt-0.5 font-medium truncate">
                          <MessageSquare size={12} className="text-emerald-500" />
                          <span>{t('profile.guaranteed', { hours: creator.responseWindowHours })}{creator.isDiemHighlighted ? ` · ${t('common.recommended')}` : ''}</span>
                      </div>
                  </div>
                  <button
                      onClick={(e) => {
                          e.stopPropagation();
                          currentUser ? handleOpenModal() : onLoginRequest();
                      }}
                      className={`w-20 h-9 px-3 py-0 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 flex-shrink-0 whitespace-nowrap z-20 transition-colors ${!creator.diemButtonColor ? (creator.isDiemHighlighted ? 'bg-indigo-500 text-white group-hover:bg-indigo-600' : 'bg-stone-900 text-white hover:bg-stone-700') : ''}`}
                      style={creator.diemButtonColor ? { backgroundColor: creator.diemButtonColor, color: getContrastColor(creator.diemButtonColor) } : undefined}
                  >
                      {t('common.diem')}
                  </button>
              </div>
              </div>
          )}

          {/* 4. AFFILIATE LINKS & DIGITAL PRODUCTS */}
          <div ref={tutorialLinksRef} className={`w-full space-y-6 ${showTutorial && tutorialStep === 3 ? 'ring-2 ring-amber-400 ring-offset-2 rounded-2xl p-1' : ''}`}>
                {groupedLinks.map((group, groupIdx) => {
                    const groupLinksToShow = group.links;
                    if (groupLinksToShow.length === 0 && !isCustomizeMode) return null;
                    // For the null/default group in sectioned mode with no unsectioned links, skip
                    if (group.id === null && sortedSections.length > 0 && groupLinksToShow.length === 0 && !isCustomizeMode) return null;
                    return (
                    <div key={group.id ?? 'default'} className="space-y-3">
                        <div className="flex justify-center items-end">
                            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                                <Tag size={14} /> {group.title ?? (creator.linksSectionTitle || t('profile.featuredLinks'))}
                            </h3>
                        </div>
                        {groupLinksToShow.length > 0 ? (
                    <div className="grid gap-3">
                        {groupLinksToShow.map((link) => {
                            const isProduct = link.type === 'DIGITAL_PRODUCT';
                            const isSupport = link.type === 'SUPPORT';
                            const isEmoji = link.thumbnailUrl?.startsWith('data:emoji,');
                            const hasThumbnail = !!link.thumbnailUrl && !isEmoji;
                            const accentColor = link.buttonColor;
                            const shapeClass = link.iconShape === 'circle' ? 'rounded-full' : link.iconShape === 'rounded' ? 'rounded-xl' : 'rounded-none';
                            // Detect platform from URL to use branded icon
                            const PLATFORM_DOMAINS: { pattern: RegExp; id: string }[] = [
                                { pattern: /youtube\.com|youtu\.be/, id: 'youtube' },
                                { pattern: /instagram\.com/, id: 'instagram' },
                                { pattern: /tiktok\.com/, id: 'tiktok' },
                                { pattern: /x\.com|twitter\.com/, id: 'x' },
                                { pattern: /threads\.net/, id: 'threads' },
                                { pattern: /facebook\.com|fb\.com/, id: 'facebook' },
                                { pattern: /twitch\.tv/, id: 'twitch' },
                                { pattern: /discord\.com|discord\.gg/, id: 'discord' },
                                { pattern: /linkedin\.com/, id: 'linkedin' },
                                { pattern: /snapchat\.com/, id: 'snapchat' },
                                { pattern: /pinterest\.com/, id: 'pinterest' },
                                { pattern: /reddit\.com/, id: 'reddit' },
                                { pattern: /t\.me|telegram\.me/, id: 'telegram' },
                                { pattern: /wa\.me|whatsapp\.com/, id: 'whatsapp' },
                                { pattern: /open\.spotify\.com|spotify\.com/, id: 'spotify' },
                                { pattern: /soundcloud\.com/, id: 'soundcloud' },
                                { pattern: /patreon\.com/, id: 'patreon' },
                                { pattern: /onlyfans\.com/, id: 'onlyfans' },
                                { pattern: /substack\.com/, id: 'substack' },
                                { pattern: /beehiiv\.com/, id: 'beehiiv' },
                                { pattern: /github\.com/, id: 'github' },
                            ];
                            let detectedPlatform: string | null = null;
                            if (!link.thumbnailUrl && !isProduct && !isSupport && link.url) {
                                try {
                                    const hostname = new URL(link.url.startsWith('http') ? link.url : `https://${link.url}`).hostname;
                                    detectedPlatform = PLATFORM_DOMAINS.find(p => p.pattern.test(hostname))?.id || null;
                                } catch { /* invalid url */ }
                            }
                            let faviconUrl: string | null = null;
                            if (!link.thumbnailUrl && !isProduct && !isSupport && link.url && !detectedPlatform) {
                                try { faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(link.url.startsWith('http') ? link.url : `https://${link.url}`).hostname}&sz=64`; } catch { faviconUrl = null; }
                            }
                            const btnStyle = accentColor ? { backgroundColor: accentColor, color: getContrastColor(accentColor) } : undefined;
                            const iconStyle = accentColor && !hasThumbnail ? { backgroundColor: `${accentColor}22`, color: accentColor } : undefined;
                            return (
                                <div key={link.id} className="relative group">
                                    {isCustomizeMode ? (
                                         <div className={`relative rounded-2xl p-4 pr-12 border border-dashed flex items-center transition-all ${isProduct ? 'bg-stone-50 border-stone-300' : isSupport ? 'bg-stone-50 border-stone-300' : 'bg-white border-stone-300'}`}>
                                            <button 
                                                onClick={() => handleUpdateLink(link.id, 'isPromoted', !link.isPromoted)}
                                                className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-colors hover:bg-stone-100 ${link.isPromoted ? 'bg-stone-100 text-stone-600' : 'bg-white text-stone-400'}`}
                                                title={t('profile.toggleHighlight')}
                                            >
                                                {link.isPromoted ? <Sparkles size={20} /> : <ExternalLink size={20} />}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                 <div className="flex items-center gap-2 mb-1">
                                                     {isProduct ? <span className="text-[10px] font-semibold bg-stone-200 text-stone-600 px-1.5 rounded uppercase">{t('profile.product')}</span> : isSupport ? <span className="text-[10px] font-semibold bg-stone-200 text-stone-600 px-1.5 rounded uppercase">{t('profile.support')}</span> : null}
                                                     <input 
                                                        className="block w-full font-bold text-stone-800 text-lg leading-tight bg-transparent outline-none border-b border-transparent focus:border-stone-300 placeholder-stone-300"
                                                        value={link.title}
                                                        onChange={(e) => handleUpdateLink(link.id, 'title', e.target.value)}
                                                        placeholder={t('profile.linkTitle')}
                                                    />
                                                 </div>
                                                <input 
                                                    className="block w-full text-xs text-stone-400 mt-1 bg-transparent outline-none border-b border-transparent focus:border-stone-300 placeholder-stone-300"
                                                    value={link.url}
                                                    onChange={(e) => handleUpdateLink(link.id, 'url', e.target.value)}
                                                    placeholder={t('profile.url')}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        // RENDER PRODUCT VS LINK
                                        isSupport ? (
                                            <button
                                                onClick={() => handleSupportClick(link.price)}
                                                className={`w-full text-left p-3 sm:p-4 rounded-2xl border flex items-center gap-3 sm:gap-4 group cursor-pointer transition-all hover:shadow-md relative overflow-hidden ${link.isPromoted ? 'bg-gradient-to-r from-pink-50/40 to-rose-50/20 border-pink-100 shadow-sm' : 'hover:border-stone-300 hover:shadow-sm'}`}
                                                style={!link.isPromoted ? linkBlockStyleWithRadius : undefined}
                                            >
                                                <div className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${shapeClass} ${hasThumbnail ? 'p-0 overflow-hidden border border-stone-100' : isEmoji ? 'bg-stone-100' : 'bg-pink-50 text-pink-400'}`} style={iconStyle}>
                                                    {hasThumbnail ? (
                                                        <img src={link.thumbnailUrl} className="w-full h-full object-cover" alt={link.title} />
                                                    ) : isEmoji ? (
                                                        <span className="text-xl sm:text-2xl leading-none">{link.thumbnailUrl!.replace('data:emoji,', '')}</span>
                                                    ) : (
                                                        <>
                                                            <Heart size={20} className="sm:hidden" />
                                                            <Heart size={24} className="hidden sm:block" />
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex-1 relative z-10 min-w-0 text-left">
                                                    <h4 className="font-semibold sm:font-bold text-stone-900 text-sm sm:text-base group-hover:text-stone-700 transition-colors truncate">{link.title}</h4>
                                                    <p className="text-[10px] sm:text-xs text-stone-400 mt-0.5 font-medium truncate">{t('profile.sendTip')}{link.isPromoted ? ` · ${t('common.recommended')}` : ''}</p>
                                                </div>
                                                <div className={`w-20 h-9 px-3 py-0 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 flex-shrink-0 whitespace-nowrap transition-colors ${!btnStyle ? (link.isPromoted ? 'bg-pink-400 text-white group-hover:bg-pink-500' : 'bg-stone-100 text-stone-600 hover:bg-stone-200') : ''}`} style={btnStyle}>
                                                    <Heart size={12} /> {t('profile.tip')}
                                                </div>
                                            </button>
                                        ) : isProduct ? (
                                            <button
                                                onClick={() => handleProductClick(link)}
                                                className={`w-full text-left p-3 sm:p-4 rounded-2xl border flex items-center gap-3 sm:gap-4 group cursor-pointer transition-all hover:shadow-md relative overflow-hidden ${link.isPromoted ? 'bg-gradient-to-r from-purple-50/40 to-violet-50/20 border-purple-100 shadow-sm' : 'hover:border-stone-300 hover:shadow-sm'}`}
                                                style={!link.isPromoted ? linkBlockStyleWithRadius : undefined}
                                            >
                                                <div className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${shapeClass} ${hasThumbnail ? 'p-0 overflow-hidden border border-stone-100' : isEmoji ? 'bg-stone-100' : 'bg-purple-50 text-purple-400'}`} style={iconStyle}>
                                                    {hasThumbnail ? (
                                                        <img src={link.thumbnailUrl} className="w-full h-full object-cover" alt={link.title} />
                                                    ) : isEmoji ? (
                                                        <span className="text-xl sm:text-2xl leading-none">{link.thumbnailUrl!.replace('data:emoji,', '')}</span>
                                                    ) : (
                                                        <>
                                                            <FileText size={20} className="sm:hidden" />
                                                            <FileText size={24} className="hidden sm:block" />
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex-1 relative z-10 min-w-0 text-left">
                                                    <h4 className="font-semibold sm:font-bold text-stone-900 text-sm sm:text-base group-hover:text-stone-700 transition-colors truncate">{link.title}</h4>
                                                    <p className="text-[10px] sm:text-xs text-stone-400 mt-0.5 font-medium truncate">{t('profile.digitalDownload')}{link.isPromoted ? ` · ${t('common.recommended')}` : ''}</p>
                                                </div>
                                                <div className={`w-20 h-9 px-3 py-0 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 flex-shrink-0 whitespace-nowrap transition-colors ${!btnStyle ? (link.isPromoted ? 'bg-purple-500 text-white group-hover:bg-purple-600' : 'bg-stone-100 text-stone-600 hover:bg-stone-200') : ''}`} style={btnStyle}>
                                                    {t('common.buy')}
                                                </div>
                                            </button>
                                        ) : (
                                            <a
                                                href={ensureProtocol(link.url)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => logAnalyticsEvent(creator.id, 'CONVERSION', { type: 'LINK', id: link.id, title: link.title, url: link.url })}
                                                className={`block w-full text-left p-3 sm:p-4 rounded-2xl border flex items-center gap-3 sm:gap-4 group cursor-pointer transition-all hover:shadow-md relative overflow-hidden ${link.isPromoted ? 'bg-gradient-to-r from-stone-50 to-stone-100/40 border-stone-200 shadow-sm' : 'hover:border-stone-300'}`}
                                                style={!link.isPromoted ? linkBlockStyleWithRadius : undefined}
                                            >
                                                <div className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${shapeClass} ${hasThumbnail ? 'p-0 overflow-hidden border border-stone-100' : isEmoji ? 'bg-stone-100' : detectedPlatform ? 'bg-stone-100' : faviconUrl ? 'overflow-hidden bg-white border border-stone-100' : 'bg-stone-900 text-white'}`} style={iconStyle}>
                                                    {hasThumbnail ? (
                                                        <img src={link.thumbnailUrl} className="w-full h-full object-cover" alt={link.title} />
                                                    ) : isEmoji ? (
                                                        <span className="text-xl sm:text-2xl leading-none">{link.thumbnailUrl!.replace('data:emoji,', '')}</span>
                                                    ) : detectedPlatform ? (
                                                        getPlatformIcon(detectedPlatform)
                                                    ) : faviconUrl ? (
                                                        <img src={faviconUrl} className="w-full h-full object-cover" alt={link.title} onError={(e) => { (e.target as HTMLImageElement).style.display='none'; (e.target as HTMLImageElement).parentElement!.classList.add('bg-stone-900'); (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'; }} />
                                                    ) : (
                                                        <>
                                                            <Sparkles size={20} className="sm:hidden" />
                                                            <Sparkles size={24} className="hidden sm:block" />
                                                        </>
                                                    )}
                                                </div>

                                                <div className="flex-1 relative z-10 min-w-0 text-left">
                                                    <h4 className="font-semibold sm:font-bold text-sm sm:text-base text-stone-900 group-hover:text-stone-700 transition-colors truncate">{link.title}</h4>
                                                    <p className="text-[10px] text-stone-400 mt-0.5 font-medium truncate">{t('profile.externalLink')}{link.isPromoted ? ` · ${t('common.recommended')}` : ''}</p>
                                                </div>

                                                <div className={`w-20 h-9 px-3 py-0 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 flex-shrink-0 whitespace-nowrap transition-colors ${!btnStyle ? (link.isPromoted ? 'bg-stone-900 text-white group-hover:bg-stone-700' : 'bg-stone-100 text-stone-600 hover:bg-stone-200') : ''}`} style={btnStyle}>
                                                    {link.isPromoted ? t('common.visit') : t('common.open')} <ExternalLink size={12} />
                                                </div>
                                            </a>
                                        )
                                    )}
                                    
                                    {isCustomizeMode && (
                                        <button 
                                            onClick={() => handleRemoveLink(link.id)}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white p-2 rounded-full shadow-md hover:bg-red-600 z-20 scale-100 transition-transform duration-200"
                                        >
                                            <Trash size={14} />
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="p-6 text-center border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 text-xs">
                        {isCustomizeMode ? t('profile.addLinkAbove') : t('profile.noLinksYet')}
                    </div>
                )}
                    </div>
                    );
                })}
          </div>

      </div>

      {/* Message & Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/80 sm:bg-stone-900/60 sm:backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col ring-1 ring-white/50">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-stone-100 flex justify-between items-center bg-white sm:bg-white/80 sm:backdrop-blur-xl sticky top-0 z-10">
              <h3 className="font-bold text-stone-900 text-lg">
                {step === 'compose' && t('profile.newRequest')}
                {step === 'payment' && t('profile.confirmPayment')}
                {step === 'topup' && t('profile.topUpWallet')}
                {step === 'topup_success' && '🪙 Credits Added!'}
                {step === 'success' && t('profile.sent')}
                {step === 'product_confirm' && t('profile.checkout')}
                {step === 'product_payment' && t('profile.confirmPayment')}
                {step === 'product_success' && t('profile.readyToDownload')}
                {step === 'support_confirm' && t('profile.sendATip')}
                {step === 'support_payment' && t('profile.confirmTip')}
                {step === 'support_success' && t('profile.thankYou')}
              </h3>
              <button onClick={closeModal} className="p-2 bg-stone-100 rounded-full text-stone-500 hover:bg-stone-200 transition-colors hover:rotate-90 duration-200">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              
              {/* --- MESSAGE FLOW --- */}
              {step === 'compose' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-100">
                     <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-stone-500 shadow-sm border border-stone-100">
                        <User size={20} />
                     </div>
                     <div className="flex-1">
                        <p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">{t('profile.sendingAs')}</p>
                        <p className="text-sm font-bold text-stone-900">{name}</p>
                     </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">{t('profile.yourMessage')}</label>
                    <div className="mb-3 p-4 bg-stone-50 text-stone-700 rounded-2xl text-sm border border-stone-200/60">
                        <p className="font-bold mb-1.5 flex items-center gap-2"><Sparkles size={14}/> {t('profile.important')}</p>
                        <p className="opacity-80 text-xs sm:text-sm leading-relaxed">
                            {creator.intakeInstructions || t('profile.defaultIntake')}
                        </p>
                    </div>
                    <textarea 
                      className="w-full px-4 py-3 bg-white border border-stone-200/60 rounded-2xl focus:ring-1 focus:ring-stone-400 focus:border-stone-300 outline-none h-40 resize-none text-stone-900 placeholder:text-stone-300 transition-all text-base"
                      placeholder={t('profile.typeMessage')}
                      value={generalMessage}
                      onChange={e => setGeneralMessage(e.target.value)}
                    />
                    
                    {/* Attachment UI */}
                    <div className="flex justify-between items-center mt-3">
                         <div className="flex flex-col gap-2 w-full">
                             <div className="flex items-center gap-2">
                                 <input 
                                    type="file" 
                                    ref={photoInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => handleAttachmentSelect(e, 'IMAGE')}
                                 />
                                 <button 
                                    onClick={() => photoInputRef.current?.click()}
                                    className="text-stone-500 hover:text-stone-700 hover:bg-stone-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                                 >
                                    <ImageIcon size={16} />
                                    {t('profile.attachPhotos')}
                                 </button>

                                 <input 
                                    type="file" 
                                    ref={docInputRef}
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,.txt"
                                    multiple
                                    onChange={(e) => handleAttachmentSelect(e, 'FILE')}
                                 />
                                 <button 
                                    onClick={() => docInputRef.current?.click()}
                                    className="text-stone-500 hover:text-stone-700 hover:bg-stone-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                                 >
                                    <Paperclip size={16} />
                                    {t('profile.attachFiles')}
                                 </button>
                             </div>

                             {attachments.length > 0 && (
                                 <div className="flex flex-wrap gap-2">
                                     {attachments.map((att, idx) => (
                                         <div key={idx} className="flex items-center gap-1.5 bg-stone-100 pl-2 pr-1 py-1 rounded-lg text-xs font-medium text-stone-600 border border-stone-200/60">
                                             {att.type === 'IMAGE' ? <ImageIcon size={12}/> : <FileText size={12}/>}
                                             <span className="truncate max-w-[150px]">{att.name}</span>
                                             <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="hover:bg-stone-200 p-0.5 rounded ml-1 transition-colors"><X size={12}/></button>
                                         </div>
                                     ))}
                                 </div>
                             )}
                         </div>

                         <span className={`text-xs font-medium whitespace-nowrap ml-2 ${generalMessage.length > 500 ? 'text-red-500' : 'text-stone-300'}`}>
                           {generalMessage.length}/500
                         </span>
                    </div>
                  </div>

                  <Button 
                    fullWidth 
                    disabled={!isFormValid()} 
                    onClick={() => setStep('payment')}
                    className="bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg"
                  >
                    {t('profile.continueToPayment')}
                  </Button>
                </div>
              )}

              {step === 'payment' && (
                <div className="space-y-6">
                  {/* Payment UI remains same */}
                  <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100">
                     <div className="flex justify-between text-sm mb-3">
                       <span className="text-stone-500 font-medium">{t('profile.requestPrice')}</span>
                       <span className="font-bold text-stone-900">{creator.pricePerMessage} {t('common.credits')}</span>
                     </div>
                     <div className="flex justify-between items-end border-t border-stone-200 pt-3">
                       <span className="font-bold text-stone-900 text-lg">{t('common.total')}</span>
                       <span className="font-black text-stone-900 text-3xl tracking-tight flex items-center gap-2">
                           <Coins size={24}/> {creator.pricePerMessage}
                       </span>
                     </div>
                     <div className="mt-4 pt-4 border-t border-dashed border-stone-300">
                        <div className="flex justify-between text-sm">
                            <span className="text-stone-500">{t('profile.yourWalletBalance')}</span>
                            <span className={`font-bold ${checkBalance(creator.pricePerMessage) ? 'text-green-600' : 'text-red-500'}`}>
                                {currentUser?.credits || 0} {t('common.credits')}
                            </span>
                        </div>
                     </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button variant="ghost" onClick={() => setStep('compose')} className="flex-1 rounded-2xl font-semibold">{t('common.back')}</Button>

                    {checkBalance(creator.pricePerMessage) ? (
                        <Button fullWidth onClick={handleSend} isLoading={isSubmitting} className="flex-[2] bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg">
                            {t('profile.paySend')}
                        </Button>
                    ) : (
                        <Button fullWidth onClick={() => setStep('topup')} className="flex-[2] bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg">
                            {t('profile.topUpCredits')}
                        </Button>
                    )}
                  </div>
                </div>
              )}

              {step === 'topup' && (
                  <div className="space-y-6">
                      <div className="text-center">
                          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-500">
                              <Wallet size={32} />
                          </div>
                          <h4 className="font-bold text-stone-900 text-lg">{t('profile.topUpWallet')}</h4>
                          <p className="text-stone-500 text-sm">{t('profile.needMoreCredits')}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                          {[500, 1000, 2500, 5000].map(amt => (
                              <button 
                                key={amt}
                                onClick={() => setTopUpAmount(amt)}
                                className={`p-4 rounded-xl border text-center transition-all ${topUpAmount === amt ? 'bg-stone-50 border-stone-900 ring-1 ring-stone-900 text-stone-900' : 'bg-white border-stone-200 hover:border-stone-300'}`}
                              >
                                  <div className="font-black text-xl mb-1">{amt}</div>
                                  <div className="text-xs text-stone-400 uppercase font-bold">{t('common.credits')}</div>
                              </button>
                          ))}
                      </div>

                      <div className="bg-stone-50 p-4 rounded-xl flex justify-between items-center">
                          <span className="text-sm font-medium text-stone-600">{t('profile.cost')}</span>
                          <span className="font-bold text-stone-900 text-lg">${(topUpAmount / 100).toFixed(2)}</span>
                      </div>

                      <Button fullWidth onClick={handleTopUp} isLoading={isSubmitting} className="bg-stone-900 text-white rounded-2xl h-14 font-bold">
                          {t('profile.purchaseCredits')}
                      </Button>
                  </div>
              )}

              {step === 'topup_success' && (
                <div className="py-6 flex flex-col items-center justify-center text-center gap-4">
                    <style>{`
                        @keyframes sketch-draw { to { stroke-dashoffset: 0; } }
                        @keyframes sketch-pop { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                    `}</style>
                    <svg viewBox="0 0 160 140" width="160" height="140" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* Wallet */}
                        <rect x="28" y="40" width="90" height="65" rx="8" stroke="#1c1917" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'sketch-draw 0.5s ease forwards 0.1s' }} />
                        <rect x="84" y="58" width="34" height="22" rx="5" stroke="#1c1917" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'sketch-draw 0.4s ease forwards 0.3s' }} />
                        <circle cx="96" cy="69" r="5" stroke="#1c1917" strokeWidth="1.5" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'sketch-draw 0.3s ease forwards 0.5s' }} />
                        <line x1="28" y1="56" x2="118" y2="56" stroke="#1c1917" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'sketch-draw 0.4s ease forwards 0.2s' }} />
                        {/* Coins flying in */}
                        <circle cx="50" cy="20" r="10" stroke="#f59e0b" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'sketch-draw 0.3s ease forwards 0.6s' }} />
                        <text x="45" y="25" fontSize="10" fill="#f59e0b" style={{ animation: 'sketch-pop 0.3s ease forwards 0.7s', opacity: 0 }}>$</text>
                        <circle cx="80" cy="12" r="10" stroke="#f59e0b" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'sketch-draw 0.3s ease forwards 0.8s' }} />
                        <circle cx="115" cy="20" r="8" stroke="#f59e0b" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'sketch-draw 0.3s ease forwards 0.9s' }} />
                        {/* Arrow down into wallet */}
                        <line x1="73" y1="30" x2="73" y2="44" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'sketch-draw 0.3s ease forwards 1.0s' }} />
                        <polyline points="67,38 73,45 79,38" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'sketch-draw 0.3s ease forwards 1.1s' }} />
                        {/* Sparkles */}
                        <line x1="130" y1="40" x2="136" y2="34" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'sketch-draw 0.2s ease forwards 1.2s' }} />
                        <line x1="135" y1="50" x2="143" y2="48" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'sketch-draw 0.2s ease forwards 1.3s' }} />
                    </svg>
                    <div style={{ animation: 'sketch-pop 0.4s ease forwards 1.4s', opacity: 0 }}>
                        <p className="text-xl font-black text-stone-900">{topUpAmount.toLocaleString()} Credits Added!</p>
                        <p className="text-stone-400 text-sm mt-1">Returning you to checkout...</p>
                    </div>
                </div>
              )}

              {step === 'success' && (
                <div className="py-4 flex flex-col items-center justify-center text-center gap-5">
                    <style>{`
                        @keyframes sketch-draw { to { stroke-dashoffset: 0; } }
                        @keyframes sketch-pop { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                    `}</style>

                    {/* Sketch SVG illustration */}
                    <svg viewBox="0 0 220 190" width="220" height="190" xmlns="http://www.w3.org/2000/svg">
                        {/* Envelope body */}
                        <path d="M 35,72 L 35,152 L 175,152 L 175,72 Z"
                            fill="none" stroke="#1c1917" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                            pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                            style={{ animation: 'sketch-draw 0.7s cubic-bezier(0.4,0,0.2,1) 0.1s forwards' }} />
                        {/* Envelope flap */}
                        <path d="M 35,72 L 105,118 L 175,72"
                            fill="none" stroke="#1c1917" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                            pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                            style={{ animation: 'sketch-draw 0.45s cubic-bezier(0.4,0,0.2,1) 0.75s forwards' }} />
                        {/* Bottom left seam */}
                        <path d="M 35,152 L 97,118"
                            fill="none" stroke="#1c1917" strokeWidth="2.2" strokeLinecap="round"
                            pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                            style={{ animation: 'sketch-draw 0.3s ease 1.15s forwards' }} />
                        {/* Bottom right seam */}
                        <path d="M 175,152 L 113,118"
                            fill="none" stroke="#1c1917" strokeWidth="2.2" strokeLinecap="round"
                            pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                            style={{ animation: 'sketch-draw 0.3s ease 1.38s forwards' }} />
                        {/* Heart on envelope */}
                        <path d="M 105,100 C 105,97 102,92 98,94 C 94,96 94,101 98,105 L 105,112 L 112,105 C 116,101 116,96 112,94 C 108,92 105,97 105,100 Z"
                            fill="none" stroke="#1c1917" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                            pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                            style={{ animation: 'sketch-draw 0.55s ease 1.6s forwards' }} />
                        {/* Motion lines — right */}
                        <path d="M 183,88 Q 200,85 205,82"
                            fill="none" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round"
                            pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                            style={{ animation: 'sketch-draw 0.2s ease 2.05s forwards' }} />
                        <path d="M 183,110 Q 202,109 207,109"
                            fill="none" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round"
                            pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                            style={{ animation: 'sketch-draw 0.2s ease 2.2s forwards' }} />
                        <path d="M 183,130 Q 198,133 203,136"
                            fill="none" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round"
                            pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                            style={{ animation: 'sketch-draw 0.2s ease 2.35s forwards' }} />
                        {/* Sparkle dots */}
                        <circle cx="22" cy="100" r="2.5" fill="#1c1917"
                            style={{ opacity: 0, animation: 'sketch-pop 0.3s ease 2.4s forwards' }} />
                        <circle cx="15" cy="128" r="1.5" fill="#1c1917"
                            style={{ opacity: 0, animation: 'sketch-pop 0.3s ease 2.55s forwards' }} />
                        <circle cx="205" cy="68" r="2" fill="#1c1917"
                            style={{ opacity: 0, animation: 'sketch-pop 0.3s ease 2.5s forwards' }} />
                        <circle cx="30" cy="60" r="1.5" fill="#1c1917"
                            style={{ opacity: 0, animation: 'sketch-pop 0.3s ease 2.6s forwards' }} />
                    </svg>

                    <div style={{ opacity: 0, animation: 'sketch-pop 0.5s ease 2.1s forwards' }} className="space-y-1.5">
                        <h3 className="font-bold text-stone-900 text-2xl tracking-tight">{t('profile.itsOnTheWay')}</h3>
                        <p className="text-stone-500 text-sm leading-relaxed">
                            <span className="font-semibold text-stone-700">{t('profile.creatorNotified', { name: creator.displayName })}</span><br/>
                            {t('profile.emailWhenMagic')}
                        </p>
                    </div>

                    <div style={{ opacity: 0, animation: 'sketch-pop 0.5s ease 2.5s forwards' }} className="w-full">
                        <Button fullWidth onClick={closeModal} className="rounded-2xl h-12 font-semibold">
                            {t('profile.backToProfile')}
                        </Button>
                    </div>
                </div>
              )}

              {/* --- PRODUCT FLOW --- */}
              {step === 'product_confirm' && selectedProductLink && (
                  <div className="space-y-6">
                      <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200/60 flex flex-col items-center text-center">
                          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border border-stone-200/60 mb-4">
                              <FileText size={32} className="text-stone-500" />
                          </div>
                          <h4 className="font-bold text-stone-900 text-lg mb-1">{selectedProductLink.title}</h4>
                          <p className="text-xs text-stone-500 mb-6">{t('profile.digitalDownload')} • {t('profile.instantAccess')}</p>
                          <div className="text-4xl font-black text-stone-900 mb-2 flex items-center gap-2">
                              <Coins size={32} /> {selectedProductLink.price}
                          </div>
                      </div>
                      
                      <Button 
                        fullWidth 
                        onClick={() => setStep('product_payment')}
                        className="bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg"
                      >
                        {t('profile.proceedToCheckout')}
                      </Button>
                  </div>
              )}

              {step === 'product_payment' && selectedProductLink && (
                  <div className="space-y-6">
                      <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100">
                         <div className="flex justify-between items-center mb-4 pb-4 border-b border-stone-200">
                             <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-400">
                                     <FileText size={20} />
                                 </div>
                                 <div className="text-left">
                                     <p className="text-xs font-bold text-stone-500 uppercase">{t('profile.item')}</p>
                                     <p className="font-bold text-stone-900 text-sm truncate max-w-[150px]">{selectedProductLink.title}</p>
                                 </div>
                             </div>
                             <span className="font-bold text-stone-900">{selectedProductLink.price} {t('common.credits')}</span>
                         </div>
                         <div className="flex justify-between items-end">
                           <span className="font-bold text-stone-900 text-lg">{t('common.total')}</span>
                           <span className="font-black text-stone-900 text-3xl tracking-tight flex items-center gap-2"><Coins/> {selectedProductLink.price}</span>
                         </div>
                         <div className="mt-4 pt-4 border-t border-dashed border-stone-300">
                            <div className="flex justify-between text-sm">
                                <span className="text-stone-500">{t('profile.yourWalletBalance')}</span>
                                <span className={`font-bold ${checkBalance(selectedProductLink.price || 0) ? 'text-green-600' : 'text-red-500'}`}>
                                    {currentUser?.credits || 0} {t('common.credits')}
                                </span>
                            </div>
                         </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setStep('product_confirm')} className="flex-1 rounded-2xl font-semibold">{t('common.back')}</Button>
                        {checkBalance(selectedProductLink.price || 0) ? (
                            <Button fullWidth onClick={handleProductPurchase} isLoading={isSubmitting} className="flex-[2] bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg">
                                {t('profile.payDownload')}
                            </Button>
                        ) : (
                            <Button fullWidth onClick={() => setStep('topup')} className="flex-[2] bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg">
                                {t('profile.topUpCredits')}
                            </Button>
                        )}
                      </div>
                  </div>
              )}

              {step === 'product_success' && selectedProductLink && (
                  <div className="py-8 relative overflow-hidden flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6 animate-in zoom-in">
                            <Check size={40} strokeWidth={3} />
                        </div>
                        <h3 className="text-2xl font-black text-stone-900 mb-2">{t('profile.paymentSuccessful')}</h3>
                        <p className="text-stone-500 text-sm mb-8">{t('profile.canAccessContent')}</p>

                        <a 
                            // href={selectedProductLink.url} // Removed direct href
                            // target="_blank" // Removed direct target
                            // rel="noopener noreferrer" // Removed direct rel
                            onClick={async (e) => {
                                e.preventDefault();
                                if (!selectedProductLink || !creator) return;
                                try {
                                    const secureUrl = await getSecureDownloadUrl(selectedProductLink.title, selectedProductLink.url, creator.id);
                                    if (secureUrl) {
                                        const link = document.createElement('a');
                                        link.href = secureUrl;
                                        link.download = selectedProductLink.title || 'download'; // Suggest filename
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
                            className="w-full bg-stone-900 text-white hover:bg-stone-800 rounded-2xl h-14 font-bold text-lg flex items-center justify-center gap-2 shadow-xl shadow-stone-900/20"
                        >
                            <Download size={20} /> {t('profile.downloadFile')}
                        </a>
                        
                        <button onClick={closeModal} className="mt-4 text-sm font-medium text-stone-400 hover:text-stone-600">
                            {t('common.close')}
                        </button>
                  </div>
              )}

              {/* --- SUPPORT / TIP FLOW --- */}
              {step === 'support_confirm' && (
                  <div className="space-y-5">
                      <div className="text-center">
                          <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-4 text-pink-500">
                              <Heart size={32} className="fill-pink-500" />
                          </div>
                          <h4 className="font-bold text-stone-900 text-lg">{t('profile.supportCreator', { name: creator.displayName })}</h4>
                          <p className="text-stone-500 text-sm">Minimum: <span className="font-semibold text-stone-700 inline-flex items-center gap-0.5"><Coins size={12}/> {supportMinAmount}</span></p>
                      </div>

                      {/* Supporters list */}
                      <div className="bg-stone-50 rounded-2xl p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-2">Recent supporters</p>
                          {loadingSupporters ? (
                              <div className="flex items-center justify-center py-3">
                                  <div className="w-4 h-4 border-2 border-pink-300 border-t-pink-500 rounded-full animate-spin" />
                              </div>
                          ) : supporters.length === 0 ? (
                              <p className="text-xs text-stone-400 text-center py-2">Be the first to support {creator.displayName}! 💛</p>
                          ) : (
                              <div className="space-y-2">
                                  {supporters.slice(0, 5).map((s, i) => (
                                      <div key={i} className="flex items-center gap-2">
                                          {s.senderAvatarUrl ? (
                                              <img src={s.senderAvatarUrl} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt={s.senderName} />
                                          ) : (
                                              <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-stone-500">
                                                  {s.isAnonymous ? '?' : s.senderName[0]?.toUpperCase()}
                                              </div>
                                          )}
                                          <div className="flex-1 min-w-0">
                                              <p className="text-xs font-semibold text-stone-700 truncate">{s.isAnonymous ? 'Anonymous' : s.senderName}</p>
                                          </div>
                                          <span className="text-[10px] font-bold text-stone-500 flex items-center gap-0.5 flex-shrink-0">
                                              <Coins size={10} />{s.amount}
                                          </span>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>

                      {/* Amount selector */}
                      <div className="bg-stone-50 rounded-2xl p-4 text-center">
                          <div className="flex items-center justify-center gap-4 mb-3">
                              <button
                                  onClick={() => setSupportAmount(a => Math.max(supportMinAmount, a - 50))}
                                  className="w-9 h-9 rounded-full bg-white border border-stone-200 flex items-center justify-center text-xl font-bold text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-30"
                                  disabled={supportAmount <= supportMinAmount}
                              >−</button>
                              <div className="font-black text-4xl text-stone-900 tracking-tight flex items-center gap-1.5">
                                  <Coins size={24} className="text-stone-400" />{supportAmount}
                              </div>
                              <button
                                  onClick={() => setSupportAmount(a => a + 50)}
                                  className="w-9 h-9 rounded-full bg-white border border-stone-200 flex items-center justify-center text-xl font-bold text-stone-600 hover:bg-stone-100 transition-colors"
                              >+</button>
                          </div>
                          <div className="flex justify-center gap-2">
                              {[50, 100, 500].map(add => (
                                  <button
                                      key={add}
                                      onClick={() => setSupportAmount(a => a + add)}
                                      className="px-3 py-1 text-xs font-bold rounded-full bg-pink-100 text-pink-700 hover:bg-pink-200 transition-colors"
                                  >+{add}</button>
                              ))}
                          </div>
                      </div>

                      {/* Anonymous toggle */}
                      <button
                          onClick={() => setSupportIsAnonymous(a => !a)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl hover:bg-stone-100 transition-colors"
                      >
                          <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                              <User size={15} />
                              {supportIsAnonymous ? 'Remain anonymous' : 'Show my name publicly'}
                          </div>
                          <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${supportIsAnonymous ? 'bg-stone-400' : 'bg-pink-500'}`}>
                              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${supportIsAnonymous ? 'translate-x-0' : 'translate-x-4'}`} />
                          </div>
                      </button>

                      <Button
                        fullWidth
                        onClick={() => setStep('support_payment')}
                        className="bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg"
                      >
                        {t('common.continue')}
                      </Button>
                  </div>
              )}

              {step === 'support_payment' && (
                  <div className="space-y-6">
                      <div className="bg-pink-50 p-6 rounded-2xl border border-pink-100">
                         <div className="flex justify-between items-end">
                           <span className="font-bold text-stone-900 text-lg">{t('profile.totalTip')}</span>
                           <span className="font-black text-stone-900 text-3xl tracking-tight flex items-center gap-2"><Coins/> {supportAmount}</span>
                         </div>
                         <div className="mt-4 pt-4 border-t border-dashed border-pink-200">
                            <div className="flex justify-between text-sm">
                                <span className="text-stone-500">{t('profile.yourWalletBalance')}</span>
                                <span className={`font-bold ${checkBalance(supportAmount) ? 'text-green-600' : 'text-red-500'}`}>
                                    {currentUser?.credits || 0} {t('common.credits')}
                                </span>
                            </div>
                         </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setStep('support_confirm')} className="flex-1 rounded-2xl font-semibold">{t('common.back')}</Button>
                        {checkBalance(supportAmount) ? (
                            <Button fullWidth onClick={handleSupportPayment} isLoading={isSubmitting} className="flex-[2] bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg">
                                {t('profile.paySendTip')}
                            </Button>
                        ) : (
                            <Button fullWidth onClick={() => setStep('topup')} className="flex-[2] bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg">
                                {t('profile.topUpCredits')}
                            </Button>
                        )}
                      </div>
                  </div>
              )}

              {step === 'support_success' && (
                  <div className="py-8 relative overflow-hidden flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center text-pink-600 mb-6 animate-in zoom-in">
                            <Heart size={40} className="fill-pink-600" />
                        </div>
                        <h3 className="text-2xl font-black text-stone-900 mb-2">{t('profile.thankYou')}</h3>
                        <p className="text-stone-500 text-sm mb-8">{t('profile.supportMeans', { name: creator.displayName })}</p>
                        
                        <button onClick={closeModal} className="w-full bg-stone-100 text-stone-600 hover:bg-stone-200 rounded-2xl h-12 font-bold text-sm">
                            {t('common.close')}
                        </button>
                  </div>
              )}

            </div>
          </div>
        </div>
      )}

      {showSuccessToast && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-500">
            <div className="relative overflow-hidden bg-stone-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 border border-white/10 ring-1 ring-white/20">
                <div className="relative z-10 flex items-center gap-3">
                    <div className="bg-white/20 p-1.5 rounded-full">
                        <Sparkles size={16} className="text-white fill-white" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white tracking-wide">{t('profile.requestSent')}</p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Post-Send Navigation Prompt */}
      {showPostSendPrompt && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-0">
            <style>{`
                @keyframes sketch-draw { to { stroke-dashoffset: 0; } }
                @keyframes sketch-pop { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setShowPostSendPrompt(false)} />
            <div className="relative bg-white rounded-3xl shadow-2xl border border-stone-100 px-6 pt-6 pb-8 max-w-sm w-full mx-4 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 flex flex-col items-center text-center">

                {/* Sketch animation */}
                <svg viewBox="0 0 220 170" width="200" height="155" xmlns="http://www.w3.org/2000/svg">
                    {/* Envelope body */}
                    <path d="M 35,55 L 35,135 L 175,135 L 175,55 Z"
                        fill="none" stroke="#1c1917" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                        pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                        style={{ animation: 'sketch-draw 0.7s cubic-bezier(0.4,0,0.2,1) 0.1s forwards' }} />
                    {/* Envelope flap */}
                    <path d="M 35,55 L 105,100 L 175,55"
                        fill="none" stroke="#1c1917" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                        pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                        style={{ animation: 'sketch-draw 0.45s cubic-bezier(0.4,0,0.2,1) 0.75s forwards' }} />
                    {/* Bottom left seam */}
                    <path d="M 35,135 L 97,100"
                        fill="none" stroke="#1c1917" strokeWidth="2.2" strokeLinecap="round"
                        pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                        style={{ animation: 'sketch-draw 0.3s ease 1.15s forwards' }} />
                    {/* Bottom right seam */}
                    <path d="M 175,135 L 113,100"
                        fill="none" stroke="#1c1917" strokeWidth="2.2" strokeLinecap="round"
                        pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                        style={{ animation: 'sketch-draw 0.3s ease 1.38s forwards' }} />
                    {/* Heart */}
                    <path d="M 105,83 C 105,80 102,75 98,77 C 94,79 94,84 98,88 L 105,95 L 112,88 C 116,84 116,79 112,77 C 108,75 105,80 105,83 Z"
                        fill="none" stroke="#1c1917" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                        pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                        style={{ animation: 'sketch-draw 0.55s ease 1.6s forwards' }} />
                    {/* Motion lines */}
                    <path d="M 183,72 Q 200,69 205,66" fill="none" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round"
                        pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                        style={{ animation: 'sketch-draw 0.2s ease 2.05s forwards' }} />
                    <path d="M 183,92 Q 202,91 207,91" fill="none" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round"
                        pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                        style={{ animation: 'sketch-draw 0.2s ease 2.2s forwards' }} />
                    <path d="M 183,112 Q 198,115 203,118" fill="none" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round"
                        pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                        style={{ animation: 'sketch-draw 0.2s ease 2.35s forwards' }} />
                    {/* Sparkle dots */}
                    <circle cx="22" cy="85" r="2.5" fill="#1c1917"
                        style={{ opacity: 0, animation: 'sketch-pop 0.3s ease 2.4s forwards' }} />
                    <circle cx="15" cy="110" r="1.5" fill="#1c1917"
                        style={{ opacity: 0, animation: 'sketch-pop 0.3s ease 2.55s forwards' }} />
                    <circle cx="205" cy="50" r="2" fill="#1c1917"
                        style={{ opacity: 0, animation: 'sketch-pop 0.3s ease 2.5s forwards' }} />
                    <circle cx="30" cy="44" r="1.5" fill="#1c1917"
                        style={{ opacity: 0, animation: 'sketch-pop 0.3s ease 2.6s forwards' }} />
                </svg>

                <div style={{ opacity: 0, animation: 'sketch-pop 0.5s ease 2.1s forwards' }} className="space-y-1.5 mb-6">
                    <h3 className="text-lg font-bold text-stone-900">{t('profile.requestSent')}</h3>
                    <p className="text-sm text-stone-500">{t('profile.requestSentDesc', { name: creator.displayName })}</p>
                </div>

                <div style={{ opacity: 0, animation: 'sketch-pop 0.5s ease 2.5s forwards' }} className="flex flex-col gap-2.5 w-full">
                    <button
                        onClick={() => { setShowPostSendPrompt(false); onNavigateToDashboard(creator.id); }}
                        className="w-full bg-stone-900 text-white py-3 rounded-2xl text-sm font-semibold hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
                    >
                        <MessageSquare size={16} /> {t('profile.goToInbox')}
                    </button>
                    <button
                        onClick={() => setShowPostSendPrompt(false)}
                        className="w-full bg-stone-50 text-stone-600 py-3 rounded-2xl text-sm font-semibold hover:bg-stone-100 transition-colors"
                    >
                        {t('profile.stayHere')}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Profile Tutorial Overlay */}
      {showTutorial && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => { setShowTutorial(false); onTutorialDone?.(); }} />
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] w-[min(400px,calc(100vw-32px))] bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden">
            {/* Progress bar */}
            <div className="h-1 bg-stone-100">
              <div className="h-full bg-amber-400 transition-all duration-300" style={{ width: `${((tutorialStep + 1) / PROFILE_TUTORIAL_STEPS.length) * 100}%` }} />
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">{PROFILE_TUTORIAL_STEPS[tutorialStep].emoji}</span>
                  <span className="font-bold text-stone-900 text-sm">{PROFILE_TUTORIAL_STEPS[tutorialStep].title}</span>
                </div>
                <span className="text-[11px] text-stone-400 font-medium shrink-0 ml-2">{tutorialStep + 1} / {PROFILE_TUTORIAL_STEPS.length}</span>
              </div>
              <p className="text-sm text-stone-500 leading-relaxed mb-4">{PROFILE_TUTORIAL_STEPS[tutorialStep].desc}</p>
              {tutorialStep === 1 && (
                <button
                  onClick={() => { setShowTutorial(false); onTutorialDone?.(); currentUser ? handleOpenModal() : onLoginRequest('FAN'); }}
                  className="w-full mb-3 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-stone-900 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare size={15} /> Try Sending a Diem
                </button>
              )}
              <div className="flex items-center justify-between">
                <button onClick={() => { setShowTutorial(false); onTutorialDone?.(); }} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                  Skip tutorial
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {PROFILE_TUTORIAL_STEPS.map((_, i) => (
                      <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === tutorialStep ? 'w-4 bg-amber-500' : i < tutorialStep ? 'w-1.5 bg-amber-200' : 'w-1.5 bg-stone-200'}`} />
                    ))}
                  </div>
                  <button
                    onClick={handleTutorialNext}
                    className="px-4 py-2 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-700 transition-colors"
                  >
                    {tutorialStep < PROFILE_TUTORIAL_STEPS.length - 1 ? 'Next →' : 'Got it ✓'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
