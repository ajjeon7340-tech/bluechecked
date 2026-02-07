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
          default: return <Sparkles size={18} className="text-slate-400" />;
      }
  };

  // Determine which links/products to show: the live ones or the edited ones
  const displayedLinks = isCustomizeMode ? (editedCreator.links || []) : (creator.links || []);
  const platforms = isCustomizeMode ? (editedCreator.platforms || []) : (creator.platforms || ['youtube', 'x']);

  return (
    <div className="min-h-screen font-sans text-slate-900 pb-20 selection:bg-indigo-500 selection:text-white relative bg-[#F8FAFC]">
      <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          @keyframes float-delayed {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
          }
          @keyframes pulse-ring {
            0% { transform: scale(0.85); opacity: 0; }
            50% { opacity: 0.25; }
            100% { transform: scale(1.3); opacity: 0; }
          }
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .animate-float { animation: float 8s ease-in-out infinite; }
          .animate-float-delayed { animation: float-delayed 7s ease-in-out infinite; }
          .animate-pulse-ring { animation: pulse-ring 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
          .animate-shimmer { animation: shimmer 2s infinite; }
      `}</style>
      
      {/* Aesthetic Background Elements - Adjusted Contrast */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute -top-[10%] -right-[10%] w-[800px] h-[800px] bg-indigo-200/10 rounded-full blur-[120px] mix-blend-multiply animate-pulse duration-[8000ms]"></div>
          <div className="absolute top-[20%] -left-[10%] w-[600px] h-[600px] bg-purple-100/20 rounded-full blur-[100px] mix-blend-multiply"></div>
          <div className="absolute bottom-[0%] right-[20%] w-[500px] h-[500px] bg-blue-100/20 rounded-full blur-[100px] mix-blend-multiply"></div>
          {/* Subtle noise texture */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02]"></div>
      </div>

      {/* Navigation / Header */}
      <div 
        className="fixed top-0 left-0 w-full z-40 px-4 py-4 transition-all"
      >
        <div className="max-w-2xl mx-auto bg-white/70 backdrop-blur-xl border border-white/50 shadow-[0_2px_20px_-10px_rgba(0,0,0,0.05)] rounded-full py-3 px-5 flex justify-between items-center">
            <div 
            onClick={onCreateOwn} 
            className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity pl-1"
            >
            <BlueCheckLogo size={24} className="text-blue-600" />
            <span className="font-bold tracking-tight text-sm text-slate-900">Bluechecked</span>
            </div>
            
            <div className="flex items-center gap-2">
                
                {currentUser ? (
                <button 
                    onClick={onNavigateToDashboard} 
                    className="flex items-center gap-2 text-slate-700 bg-slate-100/80 hover:bg-slate-200/80 px-4 py-2 rounded-full transition-colors text-xs font-semibold"
                >
                    {currentUser.role === 'FAN' && <span className="font-mono text-indigo-600 mr-1"><Coins size={12} className="inline mr-1"/>{currentUser.credits}</span>}
                    Dashboard
                </button>
                ) : (
                <button 
                    onClick={onLoginRequest} 
                    className="text-slate-600 hover:text-black px-4 py-2 font-semibold text-xs transition-colors"
                >
                    Fan Log In
                </button>
                )}

                {!currentUser && (
                    <button 
                    onClick={() => setIsCustomizeMode(!isCustomizeMode)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 border ${isCustomizeMode ? 'bg-black border-black text-white' : 'bg-transparent border-slate-200 text-slate-400 hover:border-slate-400'}`}
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
             <Button size="lg" onClick={handleSaveProfile} isLoading={isSavingProfile} className="shadow-2xl shadow-indigo-900/20 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl px-6">
               <Save size={18} className="mr-2" /> Save Changes
             </Button>
          </div>
        )}

      {/* Main Layout - Single Column / Vertical Stack */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 pt-32 flex flex-col gap-6 items-center">
        
          {/* 1. PROFILE INFO & STATS */}
          <div className="w-full">
             <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm relative transition-all hover:shadow-md">
                <div className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start relative z-10">
                    {/* Avatar Section */}
                    <div className="relative group flex-shrink-0">
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 overflow-hidden border border-slate-100 shadow-sm bg-white">
                           {!imgError && (editedCreator.avatarUrl || DEFAULT_AVATAR) ? (
                               <img 
                                    src={editedCreator.avatarUrl || DEFAULT_AVATAR} 
                                    alt={editedCreator.displayName} 
                                    className={`w-full h-full rounded-full object-cover bg-slate-100 ${isCustomizeMode ? 'cursor-pointer hover:opacity-80' : ''}`}
                                    onClick={isCustomizeMode ? handleAvatarEdit : undefined}
                                    onError={() => setImgError(true)}
                                />
                           ) : (
                               <div 
                                    className={`w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-slate-300 ${isCustomizeMode ? 'cursor-pointer hover:bg-slate-200' : ''}`}
                                    onClick={isCustomizeMode ? handleAvatarEdit : undefined}
                               >
                                   <User size={40} />
                               </div>
                           )}
                        </div>
                        
                        {!isCustomizeMode && (
                            <div className="absolute bottom-1 right-1 z-20" title="Active Now">
                                <span className="relative flex h-5 w-5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-5 w-5 bg-emerald-500 border-[3px] border-white"></span>
                                </span>
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

                    {/* Info Section */}
                    <div className="flex-1 text-left w-full min-w-0">
                        <div>
                        {isCustomizeMode ? (
                                <div className="space-y-2">
                                    <input 
                                        type="text" 
                                        value={editedCreator.displayName} 
                                        onChange={(e) => updateField('displayName', e.target.value)}
                                        className="block w-full text-2xl sm:text-3xl font-bold text-slate-900 border-b border-dashed border-slate-300 focus:border-black focus:outline-none bg-transparent placeholder-slate-300 text-left"
                                        placeholder="Display Name"
                                    />
                                    <input 
                                        type="text" 
                                        value={editedCreator.handle} 
                                        onChange={(e) => updateField('handle', e.target.value)}
                                        className="block w-full text-sm text-slate-500 font-medium border-b border-dashed border-slate-300 focus:border-black focus:outline-none bg-transparent placeholder-slate-300 text-left"
                                        placeholder="@handle"
                                    />
                                </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center w-full gap-4 mb-1 mt-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                                                {creator.displayName}
                                            </h1>
                                        </div>

                                        {/* Stats Pill */}
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <div className="inline-flex flex-wrap items-center gap-3 sm:gap-4 bg-slate-50 p-2 px-3 rounded-xl border border-slate-100 text-xs font-medium text-slate-500">
                                                <button 
                                                    onClick={handleLike}
                                                    className={`flex items-center gap-1.5 transition-colors ${hasLiked ? 'text-pink-600' : 'text-slate-500 hover:text-pink-600'}`}
                                                >
                                                    <Heart size={14} className={hasLiked ? "fill-current" : ""} />
                                                    <span className={hasLiked ? "font-bold" : ""}>{likes} Likes</span>
                                                </button>
                                                <div className="w-px h-3 bg-slate-200"></div>
                                                <div className="relative group/tooltip flex items-center gap-1.5 cursor-help">
                                                        <Star size={14} className="text-yellow-400 fill-yellow-400" />
                                                        <span className="font-bold text-slate-700">{creator.stats.averageRating}</span>
                                                        <span className="text-slate-400">Rating</span>
                                                        
                                                        {/* Response Time Tooltip */}
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[160px] bg-slate-900 text-white text-[10px] font-medium py-2 px-3 rounded-xl opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 pointer-events-none z-50 text-center shadow-xl normal-case tracking-normal whitespace-normal transform translate-y-2 group-hover/tooltip:translate-y-0">
                                                            <div className="font-bold text-emerald-400 mb-0.5 flex items-center justify-center gap-1">
                                                                <Clock size={10} /> {creator.stats.responseTimeAvg} Response
                                                            </div>
                                                            <div className="text-slate-300 leading-snug">
                                                                {getResponseTimeTooltip(creator.stats.responseTimeAvg)}
                                                            </div>
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                                        </div>
                                                </div>
                                                <div className="w-px h-3 bg-slate-200"></div>
                                                <div className="flex items-center gap-2">
                                                    {platforms.map(platform => (
                                                        <div key={platform} className="flex items-center">
                                                            {getPlatformIcon(platform)}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={handleShare}
                                            className="group flex flex-col items-center gap-1 transition-all text-slate-400 hover:text-indigo-500"
                                        >
                                            <div className="p-2.5 rounded-xl border border-slate-100 bg-white shadow-sm transition-all group-hover:border-indigo-100 group-hover:bg-indigo-50">
                                                <Share size={20} className="transition-transform group-active:scale-90" />
                                            </div>
                                            <span className="text-[10px] font-bold">Share</span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                        </div>

                    </div>
                </div>

                <div className="w-full h-px bg-slate-100"></div>

                <div className="p-6 sm:p-8 bg-slate-50/30 rounded-b-[2rem]">
                    {isCustomizeMode ? (
                        <textarea 
                           value={editedCreator.bio} 
                           onChange={(e) => updateField('bio', e.target.value)}
                           className="block w-full text-slate-600 border border-dashed border-slate-300 rounded-xl p-3 focus:ring-1 focus:ring-black min-h-[80px] bg-white text-sm"
                           placeholder="Your bio..."
                        />
                    ) : (
                        <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                            {creator.bio}
                        </p>
                    )}
                </div>
             </div>
          </div>

          {/* 2. SERVICES (Send Message) - COMPACT DESIGN */}
          <div className="w-full space-y-3">
               <div className="flex justify-between items-end">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles size={14} /> Services
                    </h3>
                </div>

               <div className="w-full bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 group transition-all hover:shadow-md hover:border-indigo-300 relative overflow-hidden">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                        <MessageSquare size={24} />
                    </div>
                    
                    {/* Text */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-bold text-slate-900 text-base group-hover:text-indigo-600 transition-colors">Priority DM</h4>
                            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border border-indigo-100">Guaranteed</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><Clock size={12} className="text-slate-400"/> {creator.responseWindowHours}h turnaround</span>
                            <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-slate-400"/> Auto-refund</span>
                        </div>
                    </div>

                    {/* Action */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        {isCustomizeMode && (
                             <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                                <Coins size={12} className="text-slate-400"/>
                                <input 
                                    type="number"
                                    value={editedCreator.pricePerMessage}
                                    onChange={(e) => updateField('pricePerMessage', Number(e.target.value))}
                                    className="w-12 font-bold text-slate-900 text-right bg-transparent outline-none text-sm"
                                />
                             </div>
                        )}
                        
                        <button 
                            onClick={currentUser ? handleOpenModal : onLoginRequest}
                            disabled={isCustomizeMode}
                            className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2 whitespace-nowrap"
                        >
                            {isCustomizeMode ? (
                                <>Preview <ArrowRight size={12} className="opacity-50"/></>
                            ) : (
                                <><Coins size={12} /> {creator.pricePerMessage}</>
                            )}
                        </button>
                    </div>
               </div>
                
                {isCustomizeMode && (
                    <div className="mt-2 bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-dashed border-slate-300 text-sm">
                        <p className="font-bold text-slate-700 mb-3 uppercase text-xs tracking-wider flex items-center gap-2">
                            <Sparkles size={12} className="text-indigo-500" /> Intake Instructions
                        </p>
                         <textarea 
                           value={editedCreator.intakeInstructions || ''} 
                           onChange={(e) => updateField('intakeInstructions', e.target.value)}
                           className="block w-full text-slate-600 border border-slate-200 rounded-xl p-3 focus:ring-1 focus:ring-black min-h-[80px] bg-white text-sm"
                           placeholder="Instructions for fans (e.g. Please be specific...)"
                        />
                    </div>
                )}
          </div>

          {/* 4. AFFILIATE LINKS & DIGITAL PRODUCTS */}
          <div className="w-full space-y-4">
                <div className="flex justify-between items-end mb-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Tag size={14} /> Featured Links & Products
                    </h3>
                </div>

                {displayedLinks.length > 0 ? (
                    <div className="grid gap-3">
                        {displayedLinks.map((link) => {
                            const isProduct = link.type === 'DIGITAL_PRODUCT';
                            const isSupport = link.type === 'SUPPORT';
                            return (
                                <div key={link.id} className="relative group">
                                    {isCustomizeMode ? (
                                         <div className={`relative rounded-2xl p-4 pr-12 border border-dashed flex items-center transition-all ${isProduct ? 'bg-purple-50 border-purple-200' : isSupport ? 'bg-pink-50 border-pink-200' : 'bg-white border-slate-300'}`}>
                                            <button 
                                                onClick={() => handleUpdateLink(link.id, 'isPromoted', !link.isPromoted)}
                                                className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-colors hover:bg-slate-100 ${link.isPromoted ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-slate-400'}`}
                                                title="Toggle Highlight"
                                            >
                                                {link.isPromoted ? <Sparkles size={20} /> : <ExternalLink size={20} />}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                 <div className="flex items-center gap-2 mb-1">
                                                     {isProduct ? <span className="text-[10px] font-bold bg-purple-200 text-purple-700 px-1.5 rounded uppercase">Product</span> : isSupport ? <span className="text-[10px] font-bold bg-pink-200 text-pink-700 px-1.5 rounded uppercase">Support</span> : null}
                                                     <input 
                                                        className="block w-full font-bold text-slate-800 text-lg leading-tight bg-transparent outline-none border-b border-transparent focus:border-slate-300 placeholder-slate-300"
                                                        value={link.title}
                                                        onChange={(e) => handleUpdateLink(link.id, 'title', e.target.value)}
                                                        placeholder="Link Title"
                                                    />
                                                 </div>
                                                <input 
                                                    className="block w-full text-xs text-slate-400 mt-1 bg-transparent outline-none border-b border-transparent focus:border-slate-300 placeholder-slate-300"
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
                                                className="w-full text-left bg-gradient-to-r from-pink-50 to-rose-50 p-4 rounded-2xl border border-pink-100 shadow-sm flex items-center gap-4 group cursor-pointer hover:border-pink-300 transition-all hover:shadow-md relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-white/40 rounded-full blur-2xl -mr-6 -mt-6 transition-transform group-hover:scale-110"></div>
                                                <div className="w-12 h-12 rounded-full bg-white text-pink-500 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                                                    <Heart size={24} className="fill-pink-500" />
                                                </div>
                                                <div className="flex-1 relative z-10 min-w-0">
                                                    <h4 className="font-bold text-slate-900 text-base group-hover:text-pink-600 transition-colors">{link.title}</h4>
                                                    <p className="text-xs text-slate-500 mt-0.5 font-medium">Send a tip to show appreciation</p>
                                                </div>
                                                <div className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
                                                    <Heart size={12} /> Tip
                                                </div>
                                            </button>
                                        ) : isProduct ? (
                                            <button
                                                onClick={() => handleProductClick(link)}
                                                className="w-full text-left bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 group cursor-pointer hover:border-indigo-300 transition-all hover:shadow-md"
                                            >
                                                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                                    <FileText size={24} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-slate-900 text-base group-hover:text-indigo-600 transition-colors">{link.title}</h4>
                                                    <p className="text-xs text-slate-500 mt-0.5 font-medium">Digital Download • Instant Access</p>
                                                </div>
                                                <div className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
                                                    <Coins size={12} /> {link.price}
                                                </div>
                                            </button>
                                        ) : (
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => logAnalyticsEvent(creator.id, 'CONVERSION', { type: 'LINK', id: link.id, title: link.title, url: link.url })}
                                                className={`block bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 group cursor-pointer transition-all ${link.isPromoted ? 'hover:border-amber-300' : 'hover:border-slate-300'}`}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${link.isPromoted ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600'}`}>
                                                    {link.isPromoted ? <Sparkles size={18} /> : <ExternalLink size={18} />}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-slate-900 text-sm group-hover:text-slate-700 transition-colors">{link.title}</h4>
                                                    <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{link.isPromoted ? 'Recommended' : 'External Link'}</p>
                                                </div>
                                                <ExternalLink size={14} className={`transition-colors ${link.isPromoted ? 'text-slate-300 group-hover:text-amber-500' : 'text-slate-300 group-hover:text-slate-500'}`} />
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
                    <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-400">
                        {isCustomizeMode ? "Add a link above" : "No links added yet."}
                    </div>
                )}
          </div>
      </div>

      {/* Message & Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col ring-1 ring-white/50">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-xl sticky top-0 z-10">
              <h3 className="font-bold text-slate-900 text-lg">
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
              <button onClick={closeModal} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors hover:rotate-90 duration-200">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              
              {/* --- MESSAGE FLOW --- */}
              {step === 'compose' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                     <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 shadow-sm border border-slate-100">
                        <User size={20} />
                     </div>
                     <div className="flex-1">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Sending as</p>
                        <p className="text-sm font-bold text-slate-900">{name}</p>
                     </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">Your Message</label>
                    <div className="mb-3 p-4 bg-indigo-50/50 text-indigo-900 rounded-2xl text-sm border border-indigo-100/50">
                        <p className="font-bold mb-1.5 flex items-center gap-2"><Sparkles size={14}/> Important:</p>
                        <p className="opacity-80 text-xs sm:text-sm leading-relaxed">
                            {creator.intakeInstructions || "Please be as detailed as possible so I can give you the best answer."}
                        </p>
                    </div>
                    <textarea 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none h-40 resize-none text-slate-900 placeholder:text-slate-300 transition-all text-base"
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
                                className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                             >
                                <Paperclip size={16} />
                                Attach Photo
                             </button>

                             {attachment && (
                                <div className="flex items-center gap-1 bg-indigo-50 pl-2 pr-1 py-1 rounded-lg text-xs font-medium text-indigo-700 border border-indigo-100">
                                    <span>Image attached</span>
                                    <button onClick={() => setAttachment(null)} className="hover:bg-indigo-100 p-0.5 rounded ml-1 transition-colors"><X size={12}/></button>
                                </div>
                             )}
                         </div>

                         <span className={`text-xs font-medium ${generalMessage.length > 500 ? 'text-red-500' : 'text-slate-300'}`}>
                           {generalMessage.length}/500
                         </span>
                    </div>
                  </div>

                  <Button 
                    fullWidth 
                    disabled={!isFormValid()} 
                    onClick={() => setStep('payment')}
                    className="bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-14 font-bold shadow-lg shadow-slate-900/20 text-lg"
                  >
                    Continue to Payment
                  </Button>
                </div>
              )}

              {step === 'payment' && (
                <div className="space-y-6">
                  {/* Payment UI remains same */}
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                     <div className="flex justify-between text-sm mb-3">
                       <span className="text-slate-500 font-medium">Request Price</span>
                       <span className="font-bold text-slate-900">{creator.pricePerMessage} Credits</span>
                     </div>
                     <div className="flex justify-between items-end border-t border-slate-200 pt-3">
                       <span className="font-bold text-slate-900 text-lg">Total</span>
                       <span className="font-black text-slate-900 text-3xl tracking-tight flex items-center gap-2">
                           <Coins size={24}/> {creator.pricePerMessage}
                       </span>
                     </div>
                     <div className="mt-4 pt-4 border-t border-dashed border-slate-300">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Your Wallet Balance:</span>
                            <span className={`font-bold ${checkBalance(creator.pricePerMessage) ? 'text-green-600' : 'text-red-500'}`}>
                                {currentUser?.credits || 0} Credits
                            </span>
                        </div>
                     </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button variant="ghost" onClick={() => setStep('compose')} className="flex-1 rounded-2xl font-semibold">Back</Button>
                    
                    {checkBalance(creator.pricePerMessage) ? (
                        <Button fullWidth onClick={handleSend} isLoading={isSubmitting} className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-14 font-bold shadow-lg shadow-slate-900/20 text-lg">
                            Pay & Send
                        </Button>
                    ) : (
                        <Button fullWidth onClick={() => setStep('topup')} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-14 font-bold shadow-lg shadow-indigo-600/20 text-lg">
                            Top Up Credits
                        </Button>
                    )}
                  </div>
                </div>
              )}

              {step === 'topup' && (
                  <div className="space-y-6">
                      <div className="text-center">
                          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                              <Wallet size={32} />
                          </div>
                          <h4 className="font-bold text-slate-900 text-lg">Top Up Wallet</h4>
                          <p className="text-slate-500 text-sm">You need more credits to complete this request.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                          {[500, 1000, 2000, 5000].map(amt => (
                              <button 
                                key={amt}
                                onClick={() => setTopUpAmount(amt)}
                                className={`p-4 rounded-xl border text-center transition-all ${topUpAmount === amt ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 text-indigo-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                              >
                                  <div className="font-black text-xl mb-1">{amt}</div>
                                  <div className="text-xs text-slate-400 uppercase font-bold">Credits</div>
                              </button>
                          ))}
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-600">Cost</span>
                          <span className="font-bold text-slate-900 text-lg">${(topUpAmount / 100).toFixed(2)}</span>
                      </div>

                      <Button fullWidth onClick={handleTopUp} isLoading={isSubmitting} className="bg-slate-900 text-white rounded-2xl h-14 font-bold">
                          Purchase Credits
                      </Button>
                  </div>
              )}

              {step === 'success' && (
                <div className="py-8 relative overflow-hidden flex flex-col items-center justify-center">
                    {/* Consistent Magical Card Style */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 rounded-3xl p-8 text-center animate-in zoom-in duration-500 shadow-2xl shadow-indigo-500/30 ring-1 ring-white/20 w-full max-w-sm">
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
                            
                            <Button fullWidth onClick={closeModal} className="bg-white text-indigo-600 hover:bg-white/90 rounded-xl h-12 font-bold text-sm shadow-xl border-none">
                                Back to Profile
                            </Button>
                        </div>
                    </div>
                </div>
              )}

              {/* --- PRODUCT FLOW --- */}
              {step === 'product_confirm' && selectedProductLink && (
                  <div className="space-y-6">
                      <div className="bg-purple-50 p-6 rounded-[2rem] border border-purple-100 flex flex-col items-center text-center">
                          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                              <FileText size={32} className="text-purple-600" />
                          </div>
                          <h4 className="font-bold text-slate-900 text-lg mb-1">{selectedProductLink.title}</h4>
                          <p className="text-xs text-slate-500 mb-6">Digital Download • Instant Access</p>
                          <div className="text-4xl font-black text-slate-900 mb-2 flex items-center gap-2">
                              <Coins size={32} /> {selectedProductLink.price}
                          </div>
                      </div>
                      
                      <Button 
                        fullWidth 
                        onClick={() => setStep('product_payment')}
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-14 font-bold shadow-lg shadow-slate-900/20 text-lg"
                      >
                        Proceed to Checkout
                      </Button>
                  </div>
              )}

              {step === 'product_payment' && selectedProductLink && (
                  <div className="space-y-6">
                      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                         <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
                             <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                                     <FileText size={20} />
                                 </div>
                                 <div className="text-left">
                                     <p className="text-xs font-bold text-slate-500 uppercase">Item</p>
                                     <p className="font-bold text-slate-900 text-sm truncate max-w-[150px]">{selectedProductLink.title}</p>
                                 </div>
                             </div>
                             <span className="font-bold text-slate-900">{selectedProductLink.price} Credits</span>
                         </div>
                         <div className="flex justify-between items-end">
                           <span className="font-bold text-slate-900 text-lg">Total</span>
                           <span className="font-black text-slate-900 text-3xl tracking-tight flex items-center gap-2"><Coins/> {selectedProductLink.price}</span>
                         </div>
                         <div className="mt-4 pt-4 border-t border-dashed border-slate-300">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Your Wallet Balance:</span>
                                <span className={`font-bold ${checkBalance(selectedProductLink.price || 0) ? 'text-green-600' : 'text-red-500'}`}>
                                    {currentUser?.credits || 0} Credits
                                </span>
                            </div>
                         </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setStep('product_confirm')} className="flex-1 rounded-2xl font-semibold">Back</Button>
                        {checkBalance(selectedProductLink.price || 0) ? (
                            <Button fullWidth onClick={handleProductPurchase} isLoading={isSubmitting} className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-14 font-bold shadow-lg shadow-slate-900/20 text-lg">
                                Pay & Download
                            </Button>
                        ) : (
                            <Button fullWidth onClick={() => setStep('topup')} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-14 font-bold shadow-lg shadow-indigo-600/20 text-lg">
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
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Payment Successful!</h3>
                        <p className="text-slate-500 text-sm mb-8">You can now access your content.</p>

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
                            className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-2xl h-14 font-bold text-lg flex items-center justify-center gap-2 shadow-xl shadow-slate-900/20"
                        >
                            <Download size={20} /> Download File
                        </a>
                        
                        <button onClick={closeModal} className="mt-4 text-sm font-medium text-slate-400 hover:text-slate-600">
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
                          <h4 className="font-bold text-slate-900 text-lg">Support {creator.displayName}</h4>
                          <p className="text-slate-500 text-sm">Select an amount to tip.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                          {[100, 300, 500, 1000].map(amt => (
                              <button 
                                key={amt}
                                onClick={() => setSupportAmount(amt)}
                                className={`p-4 rounded-xl border text-center transition-all ${supportAmount === amt ? 'bg-pink-50 border-pink-500 ring-1 ring-pink-500 text-pink-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                              >
                                  <div className="font-black text-xl mb-1 flex items-center justify-center gap-1"><Coins size={16}/> {amt}</div>
                              </button>
                          ))}
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-slate-900 mb-2">Message (Optional)</label>
                          <textarea 
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none h-24 resize-none text-sm"
                              placeholder="Say something nice..."
                              value={supportMessage}
                              onChange={e => setSupportMessage(e.target.value)}
                          />
                      </div>

                      <Button 
                        fullWidth 
                        onClick={() => setStep('support_payment')}
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-14 font-bold shadow-lg shadow-slate-900/20 text-lg"
                      >
                        Continue
                      </Button>
                  </div>
              )}

              {step === 'support_payment' && (
                  <div className="space-y-6">
                      <div className="bg-pink-50 p-6 rounded-[2rem] border border-pink-100">
                         <div className="flex justify-between items-end">
                           <span className="font-bold text-slate-900 text-lg">Total Tip</span>
                           <span className="font-black text-slate-900 text-3xl tracking-tight flex items-center gap-2"><Coins/> {supportAmount}</span>
                         </div>
                         <div className="mt-4 pt-4 border-t border-dashed border-pink-200">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Your Wallet Balance:</span>
                                <span className={`font-bold ${checkBalance(supportAmount) ? 'text-green-600' : 'text-red-500'}`}>
                                    {currentUser?.credits || 0} Credits
                                </span>
                            </div>
                         </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setStep('support_confirm')} className="flex-1 rounded-2xl font-semibold">Back</Button>
                        {checkBalance(supportAmount) ? (
                            <Button fullWidth onClick={handleSupportPayment} isLoading={isSubmitting} className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-14 font-bold shadow-lg shadow-slate-900/20 text-lg">
                                Pay & Send Tip
                            </Button>
                        ) : (
                            <Button fullWidth onClick={() => setStep('topup')} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-14 font-bold shadow-lg shadow-indigo-600/20 text-lg">
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
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Thank You!</h3>
                        <p className="text-slate-500 text-sm mb-8">Your support means the world to {creator.displayName}.</p>
                        
                        <button onClick={closeModal} className="w-full bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-2xl h-12 font-bold text-sm">
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
            <div className="relative overflow-hidden bg-slate-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 border border-white/10 ring-1 ring-white/20">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20"></div>
                <div className="relative z-10 flex items-center gap-3">
                    <div className="bg-gradient-to-tr from-yellow-400 to-orange-500 p-1.5 rounded-full shadow-lg shadow-orange-500/20">
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
