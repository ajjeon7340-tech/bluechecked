import React, { useState, useEffect, useRef } from 'react';
import { CreatorProfile, CurrentUser, AffiliateLink, Product } from '../types';
import { BlueCheckLogo, CheckCircle2, Clock, ShieldCheck, MessageSquare, ExternalLink, User, DollarSign, Save, LogOut, ChevronRight, Camera, Heart, Paperclip, X, Sparkles, ArrowRight, Lock, Star, Trash, Plus, Send, Check, ShoppingBag, Tag, CreditCard, YouTubeLogo, InstagramLogo, XLogo, TikTokLogo, Twitch, FileText, Download, Play, Coins, Wallet, Share } from './Icons';
import { Button } from './Button';
import { sendMessage, updateCreatorProfile, addCredits, DEFAULT_AVATAR, toggleCreatorLike, getCreatorLikeStatus, getSecureDownloadUrl, logAnalyticsEvent } from '../services/realBackend';

interface Props {
  creator: CreatorProfile;
  currentUser: CurrentUser | null;
  onMessageSent: () => void;
  onCreateOwn: () => void;
  onLoginRequest: () => void;
  onNavigateToDashboard: () => void;
  onRefreshData: () => Promise<void>;
}

const ensureProtocol = (url: string) => {
    if (!url) return '';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return url;
    return `https://${url}`;
};

const getResponseTimeTooltip = (status: string) => {
    if (status === 'Lightning') return 'Typically replies in under 1 hour';
    if (status === 'Very Fast') return 'Typically replies in under 4 hours';
    if (status === 'Fast') return 'Typically replies within 24 hours';
    return 'Replies within the guaranteed response window';
};

export const CreatorPublicProfile: React.FC<Props> = ({ 
  creator, 
  currentUser, 
  onMessageSent, 
  onCreateOwn, 
  onLoginRequest,
  onNavigateToDashboard,
  onRefreshData
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<'compose' | 'payment' | 'topup' | 'success' | 'product_confirm' | 'product_payment' | 'product_success' | 'support_confirm' | 'support_payment' | 'support_success'>('compose');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [generalMessage, setGeneralMessage] = useState(''); 
  const [attachment, setAttachment] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Product Purchase State
  const [selectedProductLink, setSelectedProductLink] = useState<AffiliateLink | null>(null);

  // Support / Tip State
  const [supportAmount, setSupportAmount] = useState(100);
  const [supportMessage, setSupportMessage] = useState('');

  // Customization State
  const [isCustomizeMode, setIsCustomizeMode] = useState(false);
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

  const handleOpenModal = () => {
    if (!isCustomizeMode) {
      setGeneralMessage('');
      setAttachment(null);
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
      setSupportAmount(defaultAmount || 100);
      setSupportMessage('');
      setStep('support_confirm');
      setIsModalOpen(true);
  };

  const checkBalance = (cost: number) => {
      if (!currentUser) return false;
      return currentUser.credits >= cost;
  };

  const handleTopUp = async () => {
      setIsSubmitting(true);
      try {
          await new Promise(r => setTimeout(r, 1500));
          await addCredits(topUpAmount);
          await onRefreshData(); // Wait for parent to update currentUser balance
          
          setIsSubmitting(false);
          // Return to previous flow
          if (selectedProductLink) {
              setStep('product_payment');
          } else if (step === 'support_payment' || step === 'support_confirm') {
              setStep('support_payment');
          } else {
              setStep('payment');
          }
      } catch (e) {
          console.error(e);
          setIsSubmitting(false);
          alert("Failed to top up credits. Please try again.");
      }
  };

  const handleSend = async () => {
    setIsSubmitting(true);
    try {
        await sendMessage(creator.id, name, email, generalMessage, creator.pricePerMessage, attachment || undefined);
        logAnalyticsEvent(creator.id, 'CONVERSION', { type: 'MESSAGE' });
        setIsSubmitting(false);
        setIsModalOpen(false);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 4000);
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
        logAnalyticsEvent(creator.id, 'CONVERSION', { type: 'PRODUCT', id: selectedProductLink.id });
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
        await sendMessage(creator.id, name, email, `Fan Tip: ${supportMessage || 'Just a token of appreciation!'}`, supportAmount);
        logAnalyticsEvent(creator.id, 'CONVERSION', { type: 'TIP', amount: supportAmount });
        setIsSubmitting(false);
        setStep('support_success');
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
    setAttachment(null);
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
        alert("Failed to save profile. Please try again.");
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
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
      if (navigator.share) {
          try {
              await navigator.share({
                  title: creator.displayName,
                  text: creator.bio,
                  url: window.location.href,
              });
              logAnalyticsEvent(creator.id, 'CLICK', { type: 'SHARE' });
          } catch (error) {
              console.log('Error sharing', error);
          }
      } else {
          navigator.clipboard.writeText(window.location.href);
          alert('Link copied to clipboard!');
      }
  };

  // Helper to get platform icon
  const getPlatformIcon = (platform: string) => {
      switch(platform.toLowerCase()) {
          case 'youtube': return <YouTubeLogo className="w-5 h-5 text-[#FF0000]" />;
          case 'instagram': return <InstagramLogo className="w-5 h-5 text-[#E4405F]" />;
          case 'x': return <XLogo className="w-4 h-4 text-black" />;
          case 'tiktok': return <TikTokLogo className="w-4 h-4 text-black" />;
          case 'twitch': return <Twitch size={18} className="text-[#9146FF]" />;
          default: return <Sparkles size={18} className="text-stone-400" />;
      }
  };

  // Determine which links/products to show: the live ones or the edited ones
  const displayedLinks = isCustomizeMode ? (editedCreator.links || []) : (creator.links || []);
  const platforms = isCustomizeMode ? (editedCreator.platforms || []) : (creator.platforms || []);

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-20 selection:bg-stone-200 selection:text-stone-900 relative bg-[#FAF9F6]">
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

      {/* Navigation / Header - Weverse Style */}
      <div className="fixed top-0 left-0 w-full z-40 px-4 py-4 transition-all">
        <div className="max-w-2xl mx-auto bg-white/95 sm:bg-white/80 sm:backdrop-blur-xl border border-stone-100 shadow-sm rounded-full py-3 px-5 flex justify-between items-center">
            <div
              onClick={onCreateOwn}
              className="flex items-center gap-2.5 cursor-pointer hover:opacity-70 transition-opacity pl-1"
            >
              <BlueCheckLogo size={24} className="text-stone-800" />
              <span className="font-semibold tracking-tight text-sm text-stone-800">bluechecked</span>
            </div>

            <div className="flex items-center gap-2">
                {currentUser ? (
                  <button
                      onClick={onNavigateToDashboard}
                      className="flex items-center gap-2 text-stone-700 bg-stone-100 hover:bg-stone-200 px-4 py-2 rounded-full transition-colors text-xs font-medium"
                  >
                      {currentUser.role === 'FAN' && <span className="text-stone-500 mr-1"><Coins size={12} className="inline mr-1"/>{currentUser.credits}</span>}
                      Dashboard
                  </button>
                ) : (
                  <button
                      onClick={onLoginRequest}
                      className="text-stone-500 hover:text-stone-900 px-4 py-2 font-medium text-xs transition-colors"
                  >
                      Sign In
                  </button>
                )}

                {!currentUser && (
                    <button
                      onClick={() => setIsCustomizeMode(!isCustomizeMode)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 border ${isCustomizeMode ? 'bg-stone-900 border-stone-900 text-white' : 'bg-transparent border-stone-200 text-stone-400 hover:border-stone-400'}`}
                    >
                      {isCustomizeMode ? <CheckCircle2 size={10} /> : null}
                      {isCustomizeMode ? 'Editing' : 'Edit'}
                    </button>
                )}
            </div>
        </div>
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
               <Save size={18} className="mr-2" /> Save Changes
             </Button>
          </div>
        )}

      {/* Main Layout - Single Column / Vertical Stack */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 pt-20 sm:pt-24 flex flex-col gap-5 items-center">

          {/* 1. PROFILE INFO & STATS */}
          <div className="w-full">
             <div className="bg-white rounded-2xl border border-stone-200/60 relative transition-all">
                <div className="p-6 sm:p-8 relative z-10">
                    <div className="flex flex-row gap-4 sm:gap-8 items-start">
                        {/* LEFT: Avatar + Stats */}
                        <div className="flex flex-col items-center gap-3 flex-shrink-0">
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 overflow-hidden border border-stone-100 shadow-sm bg-white group">
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
                                   <User size={40} />
                               </div>
                           )}
                        
                            {isCustomizeMode && (
                                <div 
                                    className="absolute inset-0 flex items-center justify-center rounded-full cursor-pointer pointer-events-none z-20"
                                >
                                    <div className="bg-black/50 p-2 rounded-full text-white backdrop-blur-sm"><Camera size={16} /></div>
                                </div>
                            )}
                        </div>

                        {/* Likes & Rating (Moved below avatar) */}
                        {!isCustomizeMode && (
                            <div className="flex items-center gap-2 -mt-6 relative z-20">
                                <button
                                    onClick={handleLike}
                                    className={`flex items-center justify-center gap-1 bg-white px-2.5 py-1 rounded-full border border-stone-100 text-[10px] font-bold shadow-sm transition-colors ${hasLiked ? 'text-pink-600 border-pink-100' : 'text-stone-500 hover:text-pink-600 hover:bg-pink-50'}`}
                                >
                                    <Heart size={12} className={hasLiked ? "fill-current" : ""} />
                                    <span>{likes}</span>
                                </button>

                                <div className="relative group/tooltip flex items-center justify-center gap-1 bg-white px-2.5 py-1 rounded-full border border-stone-100 text-[10px] font-bold text-stone-500 shadow-sm cursor-help">
                                    <Star size={12} className="text-yellow-400 fill-yellow-400" />
                                    <span className="text-stone-700">{creator.stats.averageRating}</span>
                                    
                                    {/* Response Time Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[160px] bg-stone-900 text-white text-[10px] font-medium py-2 px-3 rounded-xl opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 pointer-events-none z-50 text-center shadow-xl normal-case tracking-normal whitespace-normal transform translate-y-2 group-hover/tooltip:translate-y-0">
                                        <div className="font-bold text-emerald-400 mb-0.5 flex items-center justify-center gap-1">
                                            <Clock size={10} /> {creator.stats.responseTimeAvg} Response
                                        </div>
                                        <div className="text-stone-300 leading-snug">
                                            {getResponseTimeTooltip(creator.stats.responseTimeAvg)}
                                        </div>
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        </div>

                        {/* RIGHT: Content Wrapper */}
                        <div className="flex-1 min-w-0 w-full">
                            <div className="w-full">
                                {isCustomizeMode ? (
                                    <div className="space-y-2">
                                        <input 
                                            type="text" 
                                            value={editedCreator.displayName} 
                                            onChange={(e) => updateField('displayName', e.target.value)}
                                            className="block w-full text-2xl sm:text-3xl font-bold text-stone-900 border-b border-dashed border-stone-300 focus:border-black focus:outline-none bg-transparent placeholder-stone-300 text-left"
                                            placeholder="Display Name"
                                        />
                                        <input 
                                            type="text" 
                                            value={editedCreator.handle} 
                                            onChange={(e) => updateField('handle', e.target.value)}
                                            className="block w-full text-sm text-stone-500 font-medium border-b border-dashed border-stone-300 focus:border-black focus:outline-none bg-transparent placeholder-stone-300 text-left"
                                            placeholder="@handle"
                                        />
                                        <textarea
                                            value={editedCreator.bio}
                                            onChange={(e) => updateField('bio', e.target.value)}
                                            className="block w-full text-stone-600 border border-dashed border-stone-300 rounded-xl p-3 focus:ring-1 focus:ring-black min-h-[80px] bg-white text-sm mt-2"
                                            placeholder="Your bio..."
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <h1 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight leading-tight mb-1">
                                            {creator.displayName}
                                        </h1>
                                        <p className="text-sm text-stone-600 leading-relaxed font-normal mt-2 truncate">
                                            {creator.bio}
                                        </p>
                                    </>
                                )}

                                {/* Platforms & Actions Row */}
                                <div className="flex items-center gap-2 mt-4 w-full">
                                    {platforms.length > 0 && (
                                        <div className="flex items-center gap-1 p-1 bg-white border border-stone-200 rounded-xl shadow-sm overflow-x-auto no-scrollbar max-w-[40%] sm:max-w-none flex-shrink-0">
                                            {platforms.map(platform => {
                                            const platformId = typeof platform === 'string' ? platform : platform.id;
                                            const platformUrl = typeof platform === 'string' ? '' : platform.url;

                                            return (
                                                <a
                                                    key={platformId}
                                                    href={platformUrl ? ensureProtocol(platformUrl) : '#'}
                                                    target={platformUrl ? "_blank" : undefined}
                                                    rel="noopener noreferrer"
                                                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all flex-shrink-0 ${platformUrl ? 'hover:bg-stone-100 cursor-pointer text-stone-700' : 'opacity-40 cursor-default text-stone-400'}`}
                                                    title={platformId}
                                                >
                                                    {getPlatformIcon(platformId)}
                                                </a>
                                            );
                                            })}
                                        </div>
                                    )}
                                    
                                    {!isCustomizeMode && (
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <button
                                                onClick={handleShare}
                                                className="w-10 h-10 bg-white border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition-colors flex items-center justify-center shadow-sm flex-shrink-0"
                                                title="Share"
                                            >
                                                <Share size={18} />
                                            </button>
                                            <button
                                                onClick={currentUser ? handleOpenModal : onLoginRequest}
                                                className="flex-1 bg-stone-900 text-white font-semibold h-10 rounded-xl hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 text-sm whitespace-nowrap px-4 min-w-0"
                                            >
                                                <MessageSquare size={16} className="flex-shrink-0" />
                                                <span className="truncate">Ask me anything</span>
                                                <span className="text-stone-400 text-[10px] font-medium flex-shrink-0">· {creator.responseWindowHours}h reply</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
             </div>
          </div>

          {/* 4. AFFILIATE LINKS & DIGITAL PRODUCTS */}
          <div className="w-full space-y-4">
                <div className="flex justify-between items-end mb-2">
                    <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                        <Tag size={14} /> Featured Links & Products
                    </h3>
                </div>

                {displayedLinks.length > 0 ? (
                    <div className="grid gap-3">
                        {displayedLinks.map((link) => {
                            const isProduct = link.type === 'DIGITAL_PRODUCT';
                            const isSupport = link.type === 'SUPPORT';
                            const hasThumbnail = !!link.thumbnailUrl;
                            return (
                                <div key={link.id} className="relative group">
                                    {isCustomizeMode ? (
                                         <div className={`relative rounded-2xl p-4 pr-12 border border-dashed flex items-center transition-all ${isProduct ? 'bg-stone-50 border-stone-300' : isSupport ? 'bg-stone-50 border-stone-300' : 'bg-white border-stone-300'}`}>
                                            <button 
                                                onClick={() => handleUpdateLink(link.id, 'isPromoted', !link.isPromoted)}
                                                className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-colors hover:bg-stone-100 ${link.isPromoted ? 'bg-stone-100 text-stone-600' : 'bg-white text-stone-400'}`}
                                                title="Toggle Highlight"
                                            >
                                                {link.isPromoted ? <Sparkles size={20} /> : <ExternalLink size={20} />}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                 <div className="flex items-center gap-2 mb-1">
                                                     {isProduct ? <span className="text-[10px] font-semibold bg-stone-200 text-stone-600 px-1.5 rounded uppercase">Product</span> : isSupport ? <span className="text-[10px] font-semibold bg-stone-200 text-stone-600 px-1.5 rounded uppercase">Support</span> : null}
                                                     <input 
                                                        className="block w-full font-bold text-stone-800 text-lg leading-tight bg-transparent outline-none border-b border-transparent focus:border-stone-300 placeholder-stone-300"
                                                        value={link.title}
                                                        onChange={(e) => handleUpdateLink(link.id, 'title', e.target.value)}
                                                        placeholder="Link Title"
                                                    />
                                                 </div>
                                                <input 
                                                    className="block w-full text-xs text-stone-400 mt-1 bg-transparent outline-none border-b border-transparent focus:border-stone-300 placeholder-stone-300"
                                                    value={link.url}
                                                    onChange={(e) => handleUpdateLink(link.id, 'url', e.target.value)}
                                                    placeholder="URL"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        // RENDER PRODUCT VS LINK
                                        isSupport ? (
                                            <button
                                                onClick={() => handleSupportClick(link.price)}
                                                className="w-full text-left bg-white p-3 sm:p-4 rounded-2xl border border-stone-200/60 flex items-center gap-3 sm:gap-4 group cursor-pointer hover:border-stone-300 transition-all hover:shadow-sm relative overflow-hidden"
                                            >
                                                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${hasThumbnail ? 'p-0 overflow-hidden border border-stone-100' : 'bg-stone-50 text-stone-500'} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                                                    {hasThumbnail ? (
                                                        <img src={link.thumbnailUrl} className="w-full h-full object-cover" alt={link.title} />
                                                    ) : (
                                                        <>
                                                            <Heart size={20} className="sm:hidden" />
                                                            <Heart size={24} className="hidden sm:block" />
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex-1 relative z-10 min-w-0 text-left">
                                                    <h4 className="font-bold text-stone-900 text-sm sm:text-base group-hover:text-stone-700 transition-colors truncate">{link.title}</h4>
                                                    <p className="text-[10px] sm:text-xs text-stone-400 mt-0.5 font-medium truncate">Send a tip</p>
                                                </div>
                                                <div className="bg-stone-900 text-white px-3 sm:px-5 py-2 rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                                                    <Heart size={12} /> Tip
                                                </div>
                                            </button>
                                        ) : isProduct ? (
                                            <button
                                                onClick={() => handleProductClick(link)}
                                                className="w-full text-left bg-white p-3 sm:p-4 rounded-2xl border border-stone-200/60 flex items-center gap-3 sm:gap-4 group cursor-pointer hover:border-stone-300 transition-all hover:shadow-sm relative overflow-hidden"
                                            >
                                                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${hasThumbnail ? 'p-0 overflow-hidden border border-stone-100' : 'bg-stone-50 text-stone-500'} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                                                    {hasThumbnail ? (
                                                        <img src={link.thumbnailUrl} className="w-full h-full object-cover" alt={link.title} />
                                                    ) : (
                                                        <>
                                                            <FileText size={20} className="sm:hidden" />
                                                            <FileText size={24} className="hidden sm:block" />
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex-1 relative z-10 min-w-0 text-left">
                                                    <h4 className="font-bold text-stone-900 text-sm sm:text-base group-hover:text-stone-700 transition-colors truncate">{link.title}</h4>
                                                    <p className="text-[10px] sm:text-xs text-stone-400 mt-0.5 font-medium truncate">Digital Download</p>
                                                </div>
                                                <div className="bg-stone-900 text-white px-3 sm:px-5 py-2 rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                                                    <Coins size={12} /> {link.price}
                                                </div>
                                            </button>
                                        ) : (
                                            <a
                                                href={ensureProtocol(link.url)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => logAnalyticsEvent(creator.id, 'CONVERSION', { type: 'LINK', id: link.id, title: link.title, url: link.url })}
                                                className={`block w-full text-left p-3 sm:p-4 rounded-2xl border flex items-center gap-3 sm:gap-4 group cursor-pointer transition-all hover:shadow-sm relative overflow-hidden ${link.isPromoted ? 'bg-white border-stone-200/60 hover:border-stone-300' : 'bg-white border-stone-200/60 hover:border-stone-300'}`}
                                            >
                                                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${hasThumbnail ? 'p-0 overflow-hidden border border-stone-100' : (link.isPromoted ? 'bg-stone-50 text-stone-500' : 'bg-stone-50 text-stone-500')}`}>
                                                    {hasThumbnail ? (
                                                        <img src={link.thumbnailUrl} className="w-full h-full object-cover" alt={link.title} />
                                                    ) : link.isPromoted ? (
                                                        <>
                                                            <Sparkles size={20} className="sm:hidden" />
                                                            <Sparkles size={24} className="hidden sm:block" />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ExternalLink size={20} className="sm:hidden" />
                                                            <ExternalLink size={24} className="hidden sm:block" />
                                                        </>
                                                    )}
                                                </div>
                                                
                                                <div className="flex-1 relative z-10 min-w-0 text-left">
                                                    <h4 className="font-bold text-sm sm:text-base text-stone-900 group-hover:text-stone-700 transition-colors truncate">{link.title}</h4>
                                                    <p className="text-[10px] text-stone-400 mt-0.5 font-medium truncate">{link.isPromoted ? 'Recommended' : 'External Link'}</p>
                                                </div>

                                                <div className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap ${link.isPromoted ? 'bg-stone-900 text-white hover:bg-stone-800' : 'bg-stone-100 text-stone-600 group-hover:bg-stone-200'}`}>
                                                    {link.isPromoted ? 'Visit' : 'Open'} <ExternalLink size={12} />
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
                    <div className="p-8 text-center border-2 border-dashed border-stone-200 rounded-3xl text-stone-400">
                        {isCustomizeMode ? "Add a link above" : "No links added yet."}
                    </div>
                )}
          </div>
      </div>

      {/* Message & Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/80 sm:bg-stone-900/60 sm:backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col ring-1 ring-white/50">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-stone-100 flex justify-between items-center bg-white sm:bg-white/80 sm:backdrop-blur-xl sticky top-0 z-10">
              <h3 className="font-bold text-stone-900 text-lg">
                {step === 'compose' && 'New Request'}
                {step === 'payment' && 'Confirm Payment'}
                {step === 'topup' && 'Top Up Wallet'}
                {step === 'success' && 'Sent'}
                {step === 'product_confirm' && 'Checkout'}
                {step === 'product_payment' && 'Confirm Payment'}
                {step === 'product_success' && 'Ready to Download'}
                {step === 'support_confirm' && 'Send a Tip'}
                {step === 'support_payment' && 'Confirm Tip'}
                {step === 'support_success' && 'Thank You!'}
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
                        <p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">Sending as</p>
                        <p className="text-sm font-bold text-stone-900">{name}</p>
                     </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Your Message</label>
                    <div className="mb-3 p-4 bg-stone-50 text-stone-700 rounded-2xl text-sm border border-stone-200/60">
                        <p className="font-bold mb-1.5 flex items-center gap-2"><Sparkles size={14}/> Important:</p>
                        <p className="opacity-80 text-xs sm:text-sm leading-relaxed">
                            {creator.intakeInstructions || "Please be as detailed as possible so I can give you the best answer."}
                        </p>
                    </div>
                    <textarea 
                      className="w-full px-4 py-3 bg-white border border-stone-200/60 rounded-2xl focus:ring-1 focus:ring-stone-400 focus:border-stone-300 outline-none h-40 resize-none text-stone-900 placeholder:text-stone-300 transition-all text-base"
                      placeholder="Type your message..."
                      value={generalMessage}
                      onChange={e => setGeneralMessage(e.target.value)}
                    />
                    
                    {/* Attachment UI */}
                    <div className="flex justify-between items-center mt-3">
                         <div className="flex items-center gap-2">
                             <input 
                                type="file" 
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileSelect}
                             />
                             <button 
                                onClick={triggerFileSelect}
                                className="text-stone-500 hover:text-stone-700 hover:bg-stone-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                             >
                                <Paperclip size={16} />
                                Attach Photo
                             </button>

                             {attachment && (
                                <div className="flex items-center gap-1 bg-stone-100 pl-2 pr-1 py-1 rounded-lg text-xs font-medium text-stone-600 border border-stone-200/60">
                                    <span>Image attached</span>
                                    <button onClick={() => setAttachment(null)} className="hover:bg-stone-200 p-0.5 rounded ml-1 transition-colors"><X size={12}/></button>
                                </div>
                             )}
                         </div>

                         <span className={`text-xs font-medium ${generalMessage.length > 500 ? 'text-red-500' : 'text-stone-300'}`}>
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
                    Continue to Payment
                  </Button>
                </div>
              )}

              {step === 'payment' && (
                <div className="space-y-6">
                  {/* Payment UI remains same */}
                  <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100">
                     <div className="flex justify-between text-sm mb-3">
                       <span className="text-stone-500 font-medium">Request Price</span>
                       <span className="font-bold text-stone-900">{creator.pricePerMessage} Credits</span>
                     </div>
                     <div className="flex justify-between items-end border-t border-stone-200 pt-3">
                       <span className="font-bold text-stone-900 text-lg">Total</span>
                       <span className="font-black text-stone-900 text-3xl tracking-tight flex items-center gap-2">
                           <Coins size={24}/> {creator.pricePerMessage}
                       </span>
                     </div>
                     <div className="mt-4 pt-4 border-t border-dashed border-stone-300">
                        <div className="flex justify-between text-sm">
                            <span className="text-stone-500">Your Wallet Balance:</span>
                            <span className={`font-bold ${checkBalance(creator.pricePerMessage) ? 'text-green-600' : 'text-red-500'}`}>
                                {currentUser?.credits || 0} Credits
                            </span>
                        </div>
                     </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button variant="ghost" onClick={() => setStep('compose')} className="flex-1 rounded-2xl font-semibold">Back</Button>
                    
                    {checkBalance(creator.pricePerMessage) ? (
                        <Button fullWidth onClick={handleSend} isLoading={isSubmitting} className="flex-[2] bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg">
                            Pay & Send
                        </Button>
                    ) : (
                        <Button fullWidth onClick={() => setStep('topup')} className="flex-[2] bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg">
                            Top Up Credits
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
                          <h4 className="font-bold text-stone-900 text-lg">Top Up Wallet</h4>
                          <p className="text-stone-500 text-sm">You need more credits to complete this request.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                          {[500, 1000, 2000, 5000].map(amt => (
                              <button 
                                key={amt}
                                onClick={() => setTopUpAmount(amt)}
                                className={`p-4 rounded-xl border text-center transition-all ${topUpAmount === amt ? 'bg-stone-50 border-stone-900 ring-1 ring-stone-900 text-stone-900' : 'bg-white border-stone-200 hover:border-stone-300'}`}
                              >
                                  <div className="font-black text-xl mb-1">{amt}</div>
                                  <div className="text-xs text-stone-400 uppercase font-bold">Credits</div>
                              </button>
                          ))}
                      </div>

                      <div className="bg-stone-50 p-4 rounded-xl flex justify-between items-center">
                          <span className="text-sm font-medium text-stone-600">Cost</span>
                          <span className="font-bold text-stone-900 text-lg">${(topUpAmount / 100).toFixed(2)}</span>
                      </div>

                      <Button fullWidth onClick={handleTopUp} isLoading={isSubmitting} className="bg-stone-900 text-white rounded-2xl h-14 font-bold">
                          Purchase Credits
                      </Button>
                  </div>
              )}

              {step === 'success' && (
                <div className="py-8 relative overflow-hidden flex flex-col items-center justify-center">
                    {/* Consistent Magical Card Style */}
                    <div className="relative overflow-hidden bg-stone-900 rounded-2xl p-8 text-center animate-in zoom-in duration-500 shadow-xl ring-1 ring-white/10 w-full max-w-sm">
                        {/* Animated Background Particles */}
                        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-40">
                            <div className="absolute top-[10%] left-[20%] text-white animate-float text-xs">✦</div>
                            <div className="absolute bottom-[20%] right-[10%] text-white animate-float text-sm" style={{animationDelay: '1s'}}>✦</div>
                            <div className="absolute top-[40%] right-[30%] text-white animate-pulse text-xs">✨</div>
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                        </div>
                        
                        <div className="relative z-10 flex flex-col items-center justify-center animate-float">
                            <div className="bg-white/20 backdrop-blur-md p-4 rounded-full shadow-inner border border-white/40 mb-4 ring-4 ring-white/10">
                                <Send size={32} className="text-white stroke-[3px]" />
                            </div>
                            <h3 className="font-black text-white text-3xl tracking-tight mb-2 drop-shadow-sm">It's on the way!</h3>
                            <p className="text-white/90 font-medium text-sm leading-relaxed mb-6">
                                <span className="font-bold text-white">{creator.displayName}</span> has been notified.<br/> We'll email you when the magic happens. <Sparkles size={14} className="text-yellow-300 animate-pulse inline" />
                            </p>
                            
                            <Button fullWidth onClick={closeModal} className="bg-white text-stone-900 hover:bg-stone-50 rounded-xl h-12 font-bold text-sm border-none">
                                Back to Profile
                            </Button>
                        </div>
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
                          <p className="text-xs text-stone-500 mb-6">Digital Download • Instant Access</p>
                          <div className="text-4xl font-black text-stone-900 mb-2 flex items-center gap-2">
                              <Coins size={32} /> {selectedProductLink.price}
                          </div>
                      </div>
                      
                      <Button 
                        fullWidth 
                        onClick={() => setStep('product_payment')}
                        className="bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg"
                      >
                        Proceed to Checkout
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
                                     <p className="text-xs font-bold text-stone-500 uppercase">Item</p>
                                     <p className="font-bold text-stone-900 text-sm truncate max-w-[150px]">{selectedProductLink.title}</p>
                                 </div>
                             </div>
                             <span className="font-bold text-stone-900">{selectedProductLink.price} Credits</span>
                         </div>
                         <div className="flex justify-between items-end">
                           <span className="font-bold text-stone-900 text-lg">Total</span>
                           <span className="font-black text-stone-900 text-3xl tracking-tight flex items-center gap-2"><Coins/> {selectedProductLink.price}</span>
                         </div>
                         <div className="mt-4 pt-4 border-t border-dashed border-stone-300">
                            <div className="flex justify-between text-sm">
                                <span className="text-stone-500">Your Wallet Balance:</span>
                                <span className={`font-bold ${checkBalance(selectedProductLink.price || 0) ? 'text-green-600' : 'text-red-500'}`}>
                                    {currentUser?.credits || 0} Credits
                                </span>
                            </div>
                         </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setStep('product_confirm')} className="flex-1 rounded-2xl font-semibold">Back</Button>
                        {checkBalance(selectedProductLink.price || 0) ? (
                            <Button fullWidth onClick={handleProductPurchase} isLoading={isSubmitting} className="flex-[2] bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg">
                                Pay & Download
                            </Button>
                        ) : (
                            <Button fullWidth onClick={() => setStep('topup')} className="flex-[2] bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg">
                                Top Up Credits
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
                        <h3 className="text-2xl font-black text-stone-900 mb-2">Payment Successful!</h3>
                        <p className="text-stone-500 text-sm mb-8">You can now access your content.</p>

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
                                        alert("Failed to get download link.");
                                    }
                                } catch (error: any) {
                                    console.error("Download failed:", error);
                                    alert(error.message || "Failed to download file. Please try again.");
                                }
                            }}
                            className="w-full bg-stone-900 text-white hover:bg-stone-800 rounded-2xl h-14 font-bold text-lg flex items-center justify-center gap-2 shadow-xl shadow-stone-900/20"
                        >
                            <Download size={20} /> Download File
                        </a>
                        
                        <button onClick={closeModal} className="mt-4 text-sm font-medium text-stone-400 hover:text-stone-600">
                            Close
                        </button>
                  </div>
              )}

              {/* --- SUPPORT / TIP FLOW --- */}
              {step === 'support_confirm' && (
                  <div className="space-y-6">
                      <div className="text-center">
                          <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-4 text-pink-500">
                              <Heart size={32} className="fill-pink-500" />
                          </div>
                          <h4 className="font-bold text-stone-900 text-lg">Support {creator.displayName}</h4>
                          <p className="text-stone-500 text-sm">Select an amount to tip.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                          {[100, 300, 500, 1000].map(amt => (
                              <button 
                                key={amt}
                                onClick={() => setSupportAmount(amt)}
                                className={`p-4 rounded-xl border text-center transition-all ${supportAmount === amt ? 'bg-pink-50 border-pink-500 ring-1 ring-pink-500 text-pink-700' : 'bg-white border-stone-200 hover:border-stone-300'}`}
                              >
                                  <div className="font-black text-xl mb-1 flex items-center justify-center gap-1"><Coins size={16}/> {amt}</div>
                              </button>
                          ))}
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-stone-900 mb-2">Message (Optional)</label>
                          <textarea 
                              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none h-24 resize-none text-sm"
                              placeholder="Say something nice..."
                              value={supportMessage}
                              onChange={e => setSupportMessage(e.target.value)}
                          />
                      </div>

                      <Button 
                        fullWidth 
                        onClick={() => setStep('support_payment')}
                        className="bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg"
                      >
                        Continue
                      </Button>
                  </div>
              )}

              {step === 'support_payment' && (
                  <div className="space-y-6">
                      <div className="bg-pink-50 p-6 rounded-2xl border border-pink-100">
                         <div className="flex justify-between items-end">
                           <span className="font-bold text-stone-900 text-lg">Total Tip</span>
                           <span className="font-black text-stone-900 text-3xl tracking-tight flex items-center gap-2"><Coins/> {supportAmount}</span>
                         </div>
                         <div className="mt-4 pt-4 border-t border-dashed border-pink-200">
                            <div className="flex justify-between text-sm">
                                <span className="text-stone-500">Your Wallet Balance:</span>
                                <span className={`font-bold ${checkBalance(supportAmount) ? 'text-green-600' : 'text-red-500'}`}>
                                    {currentUser?.credits || 0} Credits
                                </span>
                            </div>
                         </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setStep('support_confirm')} className="flex-1 rounded-2xl font-semibold">Back</Button>
                        {checkBalance(supportAmount) ? (
                            <Button fullWidth onClick={handleSupportPayment} isLoading={isSubmitting} className="flex-[2] bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg">
                                Pay & Send Tip
                            </Button>
                        ) : (
                            <Button fullWidth onClick={() => setStep('topup')} className="flex-[2] bg-stone-900 hover:bg-stone-800 text-white rounded-2xl h-14 font-bold text-lg">
                                Top Up Credits
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
                        <h3 className="text-2xl font-black text-stone-900 mb-2">Thank You!</h3>
                        <p className="text-stone-500 text-sm mb-8">Your support means the world to {creator.displayName}.</p>
                        
                        <button onClick={closeModal} className="w-full bg-stone-100 text-stone-600 hover:bg-stone-200 rounded-2xl h-12 font-bold text-sm">
                            Close
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
                        <p className="text-sm font-bold text-white tracking-wide">Request Sent!</p>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
