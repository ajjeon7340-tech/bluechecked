import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Pin } from 'lucide-react';
import { CreatorProfile, CurrentUser, AffiliateLink, Product } from '../types';
import { DiemLogo, CheckCircle2, Clock, ShieldCheck, MessageSquare, ExternalLink, User, DollarSign, Save, LogOut, ChevronLeft, ChevronRight, Camera, Heart, Paperclip, X, Sparkles, ArrowRight, Lock, Star, Trash, Plus, Send, Check, ShoppingBag, Tag, CreditCard, YouTubeLogo, InstagramLogo, XLogo, TikTokLogo, Twitch, FileText, Download, Play, Coins, Wallet, Share, Image as ImageIcon, TrendingUp, LinkedInLogo, FacebookLogo, SnapchatLogo, PinterestLogo, DiscordLogo, TelegramLogo, WhatsAppLogo, RedditLogo, ThreadsLogo, PatreonLogo, SpotifyLogo, SoundCloudLogo, GitHubLogo, SubstackLogo, BeehiivLogo, OnlyFansLogo } from './Icons';
import { Button } from './Button';
import { sendMessage, updateCreatorProfile, addCredits, createCheckoutSession, isBackendConfigured, DEFAULT_AVATAR, toggleCreatorLike, getCreatorLikeStatus, getSecureDownloadUrl, logAnalyticsEvent, getSupporters, Supporter, createBoardPost, getBoardPosts, uploadBoardAttachment, BoardPost } from '../services/realBackend';

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

const getXXSWidth = (title?: string) => Math.min(220, Math.max(110, 80 + (title?.length || 0) * 8.5));
const getSWidth = (title?: string) => Math.min(220, Math.max(110, 80 + (title?.length || 0) * 8.5));
const getWideWidth = (title?: string) => {
    if (!title) return 160;
    let charW = 0;
    for (const ch of title) {
        const code = ch.codePointAt(0) || 0;
        if (code >= 0x1100) { charW += 13; }
        else if (ch === ' ') { charW += 4; }
        else { charW += 7.5; }
    }
    return Math.min(220, Math.max(110, Math.ceil(62 + charW)));
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
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const [boardContainerW, setBoardContainerW] = useState(0);
  // Fixed board visible height — mirrors the height set on the board container
  const BOARD_MAX_H = 440;

  // Board camera animation + pan state
  const boardInitRef    = useRef(false);
  const boardAnimating  = useRef(false);
  const boardDragRef    = useRef<{ startX: number; startY: number; camX: number; camY: number } | null>(null);
  const boardTouchRef   = useRef<{ startX: number; startY: number; camX: number; camY: number; pinchDist?: number; camZoom?: number } | null>(null);
  const [boardCamera, setBoardCamera]             = useState<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });
  const [boardAnimReady, setBoardAnimReady]       = useState(false);
  const [boardCamTransition, setBoardCamTransition] = useState('none');
  const [boardPostsLoaded, setBoardPostsLoaded]   = useState(false);
  const [boardIsDragging, setBoardIsDragging]     = useState(false);

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

  // Board Post State
  const [isComposing, setIsComposing] = useState(false);
  const [boardMessage, setBoardMessage] = useState('');
  const [isPrivatePost, setIsPrivatePost] = useState(false);
  const [isBoardSubmitting, setIsBoardSubmitting] = useState(false);
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [selectedBoardPost, setSelectedBoardPost] = useState<BoardPost | null>(null);
  const [boardAttachmentFile, setBoardAttachmentFile] = useState<File | null>(null);
  const [boardAttachmentPreview, setBoardAttachmentPreview] = useState<string | null>(null);
  const boardAttachmentInputRef = useRef<HTMLInputElement>(null);
  const [newlyPostedId, setNewlyPostedId] = useState<string | null>(null);
  const boardTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedNoteColor, setSelectedNoteColor] = useState<string | null>(null);

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

  // Fetch board posts
  useEffect(() => {
    getBoardPosts(creator.id).then(posts => {
        setBoardPosts(posts);
        setBoardPostsLoaded(true);
    }).catch(() => { setBoardPostsLoaded(true); }); // trigger animation even on error
  }, [creator.id]);

  // Board camera animation — eagle-eye → focus (CSS transition, reliable across React 18)
  useEffect(() => {
    if (!boardPostsLoaded || boardContainerW === 0 || boardInitRef.current) return;
    boardInitRef.current = true;

    // Compute canvas bounds from pinnedPosts + links at time of animation
    const NOTE_W = 252, NOTE_H_EST = 272, NOTE_GAP_X = 28, NOTE_GAP_Y = 36;
    const BOARD_PAD = 32, COLS = 3, PROFILE_W = 220;
    const LINK_START_X = BOARD_PAD + COLS * (NOTE_W + NOTE_GAP_X) + 32;
    const pinned = boardPosts.filter(p => p.isPinned && !p.isPrivate);
    const links = (creator.links || []).filter((l: any) => l.id !== '__diem_config__' && !l.hidden);
    const getLH = (l: any) => {
        if (['square-l','square-m','square-s','square','square-xs'].includes(l.iconShape)) {
            return l.iconShape === 'square-l' ? 220 : l.iconShape === 'square-m' ? 160 : l.iconShape === 'square-xs' ? 64 : 110;
        }
        if (l.type === 'DIGITAL_PRODUCT') return 104;
        return 84;
    };
    let autoLY = BOARD_PAD;
    const linkBottoms = links.map((l: any) => {
        if (l.positionY != null) return l.positionY + getLH(l) + 160;
        const b = autoLY + getLH(l) + 160; autoLY += getLH(l) + 14; return b;
    });
    const postBottoms = pinned.map((p: any, idx: number) => {
        if (p.positionY != null) return p.positionY + NOTE_H_EST + 160;
        const row = Math.floor(idx / COLS);
        return BOARD_PAD + row * (NOTE_H_EST + NOTE_GAP_Y) + NOTE_H_EST + 160;
    });
    const cW = Math.max(900, LINK_START_X + PROFILE_W + BOARD_PAD, ...links.map((l: any, i: number) => (l.positionX ?? LINK_START_X) + (PROFILE_W)));
    const cH = Math.max(300, ...postBottoms, ...linkBottoms);

    const eagleZoom = Math.min((boardContainerW * 0.82) / cW, (BOARD_MAX_H * 0.82) / cH, 0.95);
    const eagleCam = { x: cW / 2, y: cH / 2, zoom: eagleZoom };

    const isMobile = boardContainerW < 600;
    const saved = isMobile ? creator.boardFocusMobile : creator.boardFocusDesktop;
    const CREATOR_CARD_ZONE = 300; // offset used in DiemBoard minimap coordinate system
    const DESKTOP_VW = 640, MOBILE_VW = 390;
    // Default: show content from canvas (0,0) — top-left, same as the guideline default
    const focusX = saved?.x ?? DESKTOP_VW / 2;
    const focusY = saved ? Math.max(0, saved.y - CREATOR_CARD_ZONE) : BOARD_MAX_H / 2;
    const focusZoom = 1.0;
    const focusCam = { x: focusX, y: focusY, zoom: focusZoom };

    boardAnimating.current = true;

    // Step 1: set eagle position while still invisible (opacity=0)
    setBoardCamera(eagleCam);

    // Step 2: double-rAF ensures React has committed + browser has painted before we show
    let raf1 = 0, raf2 = 0, t1 = 0, t2 = 0;
    raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
            // Now reveal at eagle position
            setBoardAnimReady(true);

            // Step 3: pause, then CSS-transition to focus
            t1 = window.setTimeout(() => {
                setBoardCamTransition('transform 1.4s cubic-bezier(0.33, 1, 0.68, 1)');
                setBoardCamera(focusCam);
                t2 = window.setTimeout(() => {
                    setBoardCamTransition('none');
                    boardAnimating.current = false;
                }, 1500);
            }, 800);
        });
    });

    return () => {
        boardInitRef.current = false;
        boardAnimating.current = false;
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
        clearTimeout(t1);
        clearTimeout(t2);
    };
  }, [boardPostsLoaded, boardContainerW]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wheel scroll for the board — needs passive:false to preventDefault (React onWheel can't do this)
  useEffect(() => {
    const el = boardScrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
        if (boardAnimating.current) return;
        e.preventDefault();
        if (e.metaKey || e.altKey || e.ctrlKey) {
            // Cmd/Alt/Ctrl + scroll → zoom centered on cursor
            const rect = el.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
            setBoardCamera(prev => {
                const newZoom = Math.min(3, Math.max(0.2, prev.zoom * zoomDelta));
                const W = el.clientWidth;
                const H = el.clientHeight;
                // World point under cursor stays fixed
                const wx = prev.x + (cx - W / 2) / prev.zoom;
                const wy = prev.y + (cy - H / 2) / prev.zoom;
                return { x: wx + (W / 2 - cx) / newZoom, y: wy + (H / 2 - cy) / newZoom, zoom: newZoom };
            });
        } else {
            setBoardCamera(prev => ({
                ...prev,
                x: prev.x + e.deltaX / prev.zoom,
                y: prev.y + e.deltaY / prev.zoom,
            }));
        }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBoardPost = async () => {
    if (!boardMessage.trim()) return;
    setIsBoardSubmitting(true);
    try {
        let attachmentUrl: string | null = null;
        if (boardAttachmentFile && currentUser) {
            attachmentUrl = await uploadBoardAttachment(boardAttachmentFile, currentUser.id);
        }
        const newPost = await createBoardPost(creator.id, boardMessage, isPrivatePost, attachmentUrl, selectedNoteColor);
        setIsComposing(false);
        setBoardMessage('');
        setIsPrivatePost(false);
        setSelectedSticker(null);
        setBoardAttachmentFile(null);
        setBoardAttachmentPreview(null);
        setSelectedNoteColor(null);
        onMessageSent();
        // Refresh board posts then scroll to the newly placed sticker
        getBoardPosts(creator.id).then(posts => {
            setBoardPosts(posts);
            setNewlyPostedId(newPost.id);
            // Clear highlight after 3s
            setTimeout(() => setNewlyPostedId(null), 3000);
        }).catch(() => {});
    } catch (e: any) {
        alert(e.message);
    } finally {
        setIsBoardSubmitting(false);
    }
  };

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
        onMessageSent();
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

  const getYouTubeId = (url: string): string | null => {
    try {
        const u = new URL(url.startsWith('http') ? url : `https://${url}`);
        if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
        if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    } catch { }
    return null;
  };

  const timeAgo = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

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

          {/* 1. MINIMAL PROFILE HEADER */}
          <div className="w-full">
             <div className="border border-stone-200/60 relative transition-all" style={{ backgroundColor: creator.bannerGradient || '#ffffff', borderRadius: cardCornerRadiusValue }}>
                <div className="absolute top-4 left-4 z-30">
                    <div onClick={onCreateOwn} className="flex items-center cursor-pointer hover:opacity-70 transition-opacity">
                      <DiemLogo size={20} className="text-stone-800" />
                    </div>
                </div>
                <div className="absolute top-4 right-4 z-30">
                    <button onClick={handleShare} className="w-9 h-9 bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-700 rounded-full transition-colors flex items-center justify-center flex-shrink-0" title={t('common.share')}>
                        <Share size={16} />
                    </button>
                </div>
                <div className="px-4 pt-8 pb-4 sm:px-6 sm:pt-8 sm:pb-6 relative z-10">
                    <div className="flex flex-col items-center text-center gap-2">
                        {/* Avatar */}
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border border-stone-100 shadow-sm bg-white flex-shrink-0 mx-auto">
                           {!imgError && (editedCreator.avatarUrl || DEFAULT_AVATAR) ? (
                               <img src={editedCreator.avatarUrl || DEFAULT_AVATAR} alt={editedCreator.displayName} className="w-full h-full rounded-full object-cover bg-stone-100" onError={() => setImgError(true)} />
                           ) : (
                               <div className="w-full h-full rounded-full bg-stone-100 flex items-center justify-center text-stone-300"><User size={36} /></div>
                           )}
                        </div>
                        
                        {/* Likes & Rating (Moved below avatar) */}
                        {!isCustomizeMode && ((creator.showLikes ?? true) || (creator.showRating ?? true)) && (
                            <div className="flex items-center justify-center gap-2 -mt-3 relative z-20">
                                {(creator.showLikes ?? true) && (
                                <button
                                    onClick={handleLike}
                                    className={`flex items-center justify-center gap-1 bg-white px-3 py-1 rounded-full border border-stone-100 text-xs font-bold shadow-sm transition-colors ${hasLiked ? 'text-pink-600 border-pink-100' : 'text-stone-500 hover:text-pink-600 hover:bg-pink-50'}`}
                                >
                                    <Heart size={12} className={hasLiked ? "fill-current" : ""} />
                                    <span>{likes}</span>
                                </button>
                                )}

                                {(creator.showRating ?? true) && (
                                <div className="relative group/tooltip flex items-center justify-center gap-1 bg-white px-3 py-1 rounded-full border border-stone-100 text-xs font-bold text-stone-500 shadow-sm cursor-help">
                                    <Star size={12} className="text-yellow-400 fill-yellow-400" />
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

                        {/* Name + handle + stats */}
                        <div className="flex-1 min-w-0 mt-1 w-full text-center">
                            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 leading-tight truncate">{creator.displayName}</h1>
                            {creator.handle && creator.handle !== '@user' && (
                                <p className="text-xs font-medium text-stone-400 mt-0.5">{creator.handle}</p>
                            )}
                        </div>
                    </div>
                </div>
             </div>
          </div>

          {/* 2. COMMUNITY BOARD — always visible, profile info as stickers */}
          {!isCustomizeMode && creator.diemEnabled !== false && (
              <div ref={tutorialDiemBtnRef} className={`w-full${showTutorial && tutorialStep === 1 ? ' ring-2 ring-amber-400 ring-offset-2 rounded-2xl' : ''}`}>
                  <div
                      className="relative overflow-hidden rounded-2xl border border-stone-200/60"
                      style={{ backgroundColor: '#FAFAF9', backgroundImage: 'linear-gradient(rgba(168,162,158,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(168,162,158,0.07) 1px, transparent 1px)', backgroundSize: '32px 32px' }}
                  >
                      {/* Always-on board */}
                      <div>
                              {/* Wide horizontally-scrollable board with profile stickers */}
                              {(() => {
                                  const noteColors = ['#FFFEF0', '#F0FDF4', '#FFF7ED', '#F5F3FF', '#EFF6FF', '#FDF2F8'];
                                  const tapeColors = ['rgba(200,193,185,0.55)', 'rgba(110,200,140,0.45)', 'rgba(240,160,80,0.4)', 'rgba(180,150,240,0.4)', 'rgba(110,170,240,0.4)', 'rgba(240,140,180,0.4)'];
                                  const stickers = ['⭐','❤️','✨','🌟','💙','🎯','🔥','💬','🌙','🌸'];
                                  const rotations = [-2.1, 1.2, -0.8, 1.6, -1.4, 0.7, -1.9, 1.0, -0.6, 1.3];
                                  const stableIdx = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xFFFFFF; return Math.abs(h); };

                                  // Profile stickers: bio + platform links + featured links/products/support
                                  // Flatten all public links across all groups
                                  const allPublicLinks = groupedLinks.flatMap(g => g.links)
                                      .filter(l => l.id !== '__diem_config__' && !l.hidden && l.positionX != null && l.positionY != null);

                                  const NOTE_W = 252;
                                  const NOTE_H_EST = 272;
                                  const COLS = 3;
                                  const NOTE_GAP_X = 28;
                                  const NOTE_GAP_Y = 36;
                                  const BOARD_PAD = 32;
                                  const PROFILE_W = 220;
                                  const LINK_START_X = BOARD_PAD + COLS * (NOTE_W + NOTE_GAP_X) + 32;

                                  // Only pinned, non-private posts appear on the public board
                                  const pinnedPosts = [...boardPosts]
                                      .filter(p => p.isPinned && !p.isPrivate)
                                      .sort((a, b) => {
                                          if (a.displayOrder !== null && b.displayOrder !== null) return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
                                          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                                      });

                                  const _getLinkSize = (l: typeof allPublicLinks[0]) => {
                                      const effStyle = l.displayStyle || (l.iconShape ? 'icon' : 'wide');
                                      if (effStyle !== 'icon') return null;
                                      if (l.iconShape === 'square-s') return 32;
                                      if (l.iconShape === 'square-m') return 44;
                                      if (l.iconShape === 'square-l' || l.iconShape === 'square') return 64;
                                      return null;
                                  };
                                  const _getLinkH = (l: typeof allPublicLinks[0]) => {
                                      if (l.type === 'PHOTO') return l.height ?? 160;
                                      if (l.iconShape === 'square-xxs') return 44;
                                      const sqSize = _getLinkSize(l);
                                      if (sqSize) return sqSize;
                                      // Non-icon mode: S=minimal(40), M=compact(56), L=standard(84)
                                      if (l.iconShape === 'square-s') return 40;
                                      if (l.iconShape === 'square-m') return 56;
                                      if (l.iconShape === 'square-l') return 84;
                                      if (l.type === 'DIGITAL_PRODUCT') return 104;
                                      if (l.url?.match(/youtube\.com|youtu\.be/)) return 162;
                                      return 56;
                                  };

                                  const getLinkPos = (link: typeof allPublicLinks[0], idx: number): {x: number, y: number} => {
                                      if (link.positionX != null && link.positionY != null) {
                                          return { x: link.positionX, y: link.positionY };
                                      }
                                      let y = BOARD_PAD;
                                      for (let i = 0; i < idx; i++) {
                                          const l = allPublicLinks[i];
                                          if (l.positionY == null) {
                                              y += _getLinkH(l) + 14;
                                          }
                                      }
                                      return { x: LINK_START_X, y };
                                  };

                                  const DB_MARGIN = 8;
                                  type _BP = { x: number; y: number };
                                  const _bpOverlaps = (a: _BP, b: _BP) =>
                                      Math.abs(a.x - b.x) < NOTE_W + DB_MARGIN &&
                                      Math.abs(a.y - b.y) < NOTE_H_EST + DB_MARGIN;

                                  const savedPositions = new Map<string, _BP>();
                                  pinnedPosts.forEach(p => {
                                      if (p.positionX != null && p.positionY != null) savedPositions.set(p.id, { x: p.positionX, y: p.positionY });
                                  });

                                  const computedPositions = new Map<string, _BP>(savedPositions);
                                  pinnedPosts.forEach((p, idx) => {
                                      if (computedPositions.has(p.id)) return;
                                      const col = idx % COLS;
                                      const row = Math.floor(idx / COLS);
                                      const gridPos: _BP = {
                                          x: BOARD_PAD + col * (NOTE_W + NOTE_GAP_X) + (row % 2) * 12,
                                          y: BOARD_PAD + row * (NOTE_H_EST + NOTE_GAP_Y),
                                      };
                                      const placed = Array.from(computedPositions.values());
                                      if (!placed.some(op => _bpOverlaps(gridPos, op))) {
                                          computedPositions.set(p.id, gridPos);
                                          return;
                                      }
                                      const cands: _BP[] = [{ x: BOARD_PAD, y: BOARD_PAD }];
                                      for (const op of placed) {
                                          cands.push({ x: op.x + NOTE_W + DB_MARGIN, y: op.y });
                                          cands.push({ x: op.x, y: op.y + NOTE_H_EST + DB_MARGIN });
                                          cands.push({ x: op.x - NOTE_W - DB_MARGIN, y: op.y });
                                          cands.push({ x: op.x, y: op.y - NOTE_H_EST - DB_MARGIN });
                                      }
                                      cands.sort((a, b) => (a.x**2 + a.y**2) - (b.x**2 + b.y**2));
                                      for (const c of cands) {
                                          if (c.x < 0 || c.y < 0) continue;
                                          if (!placed.some(op => _bpOverlaps(c, op))) {
                                              computedPositions.set(p.id, c);
                                              return;
                                          }
                                      }
                                      computedPositions.set(p.id, gridPos);
                                  });

                                  const getPos = (post: BoardPost): _BP => computedPositions.get(post.id) ?? { x: BOARD_PAD, y: BOARD_PAD };

                                  const linkMaxY = allPublicLinks.reduce((max, link, idx) => {
                                      const pos = getLinkPos(link, idx);
                                      return Math.max(max, pos.y + _getLinkH(link) + 160);
                                  }, 0);
                                  const linkMaxX = allPublicLinks.reduce((max, link, idx) => {
                                      const pos = getLinkPos(link, idx);
                                      const sqSize = _getLinkSize(link);
                                      const effStyle = link.displayStyle || (link.iconShape ? 'icon' : 'wide');
                                      const cs = link.iconShape === 'square-s' ? 'S' : link.iconShape === 'square-l' ? 'L' : 'M';
                                      const w = link.type === 'PHOTO' ? (link.width ?? 220) : (effStyle === 'icon' ? (sqSize || PROFILE_W) : effStyle === 'thumbnail' ? (cs === 'S' ? 120 : cs === 'L' ? PROFILE_W : 160) : (cs === 'S' ? 110 : cs === 'L' ? getWideWidth(link.title) : 140));
                                      return Math.max(max, pos.x + w);
                                  }, LINK_START_X + PROFILE_W);
                                  const maxY = pinnedPosts.reduce((max, p) => {
                                      const pos = getPos(p);
                                      return Math.max(max, pos.y + NOTE_H_EST + 160);
                                  }, BOARD_PAD);
                                  const maxX = pinnedPosts.reduce((max, p) => {
                                      const pos = getPos(p);
                                      return Math.max(max, pos.x + NOTE_W);
                                  }, BOARD_PAD + NOTE_W);

                                  const containerH = Math.max(300, maxY, linkMaxY);
                                  const containerW = Math.max(900, maxX + BOARD_PAD, linkMaxX + BOARD_PAD);

                                  const isCreatorOwner = !!(currentUser && currentUser.id === creator.id);

                                  // Camera transform: center camera.x/y in the viewport
                                  const bTx = boardContainerW / 2 - boardCamera.x * boardCamera.zoom;
                                  const bTy = BOARD_MAX_H / 2 - boardCamera.y * boardCamera.zoom;

                                  return (
                                      <div
                                          ref={el => {
                                              (boardScrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                                              if (el) {
                                                  setBoardContainerW(el.offsetWidth);
                                                  const ro = new ResizeObserver(() => setBoardContainerW(el.offsetWidth));
                                                  ro.observe(el);
                                              }
                                          }}
                                          className="overflow-hidden select-none relative"
                                          style={{ height: `${BOARD_MAX_H}px`, cursor: boardIsDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
                                          onMouseDown={e => {
                                              if (boardAnimating.current) return;
                                              setBoardIsDragging(true);
                                              boardDragRef.current = { startX: e.clientX, startY: e.clientY, camX: boardCamera.x, camY: boardCamera.y };
                                          }}
                                          onMouseMove={e => {
                                              if (!boardDragRef.current) return;
                                              const dx = e.clientX - boardDragRef.current.startX;
                                              const dy = e.clientY - boardDragRef.current.startY;
                                              setBoardCamera(prev => ({ ...prev, x: boardDragRef.current!.camX - dx / prev.zoom, y: boardDragRef.current!.camY - dy / prev.zoom }));
                                          }}
                                          onMouseUp={() => { boardDragRef.current = null; setBoardIsDragging(false); }}
                                          onMouseLeave={() => { boardDragRef.current = null; setBoardIsDragging(false); }}
                                          onTouchStart={e => {
                                              if (boardAnimating.current) return;
                                              const t0 = e.touches[0];
                                              if (e.touches.length === 2) {
                                                  const t1 = e.touches[1];
                                                  const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
                                                  boardTouchRef.current = { startX: (t0.clientX + t1.clientX) / 2, startY: (t0.clientY + t1.clientY) / 2, camX: boardCamera.x, camY: boardCamera.y, pinchDist: dist, camZoom: boardCamera.zoom };
                                              } else {
                                                  boardTouchRef.current = { startX: t0.clientX, startY: t0.clientY, camX: boardCamera.x, camY: boardCamera.y };
                                              }
                                          }}
                                          onTouchMove={e => {
                                              if (!boardTouchRef.current) return;
                                              e.preventDefault();
                                              if (e.touches.length === 2 && boardTouchRef.current.pinchDist != null && boardTouchRef.current.camZoom != null) {
                                                  const t0 = e.touches[0], t1 = e.touches[1];
                                                  const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
                                                  const scale = dist / boardTouchRef.current.pinchDist;
                                                  const newZoom = Math.min(3, Math.max(0.2, boardTouchRef.current.camZoom * scale));
                                                  const midX = (t0.clientX + t1.clientX) / 2;
                                                  const midY = (t0.clientY + t1.clientY) / 2;
                                                  const el = boardScrollRef.current;
                                                  const rect = el ? el.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
                                                  const cx = midX - rect.left;
                                                  const cy = midY - rect.top;
                                                  const W = rect.width, H = rect.height;
                                                  const origZoom = boardTouchRef.current.camZoom;
                                                  const wx = boardTouchRef.current.camX + (cx - W / 2) / origZoom;
                                                  const wy = boardTouchRef.current.camY + (cy - H / 2) / origZoom;
                                                  setBoardCamera({ x: wx + (W / 2 - cx) / newZoom, y: wy + (H / 2 - cy) / newZoom, zoom: newZoom });
                                              } else {
                                                  const t = e.touches[0];
                                                  const dx = t.clientX - boardTouchRef.current.startX;
                                                  const dy = t.clientY - boardTouchRef.current.startY;
                                                  setBoardCamera(prev => ({ ...prev, x: boardTouchRef.current!.camX - dx / prev.zoom, y: boardTouchRef.current!.camY - dy / prev.zoom }));
                                              }
                                          }}
                                          onTouchEnd={() => { boardTouchRef.current = null; }}
                                      >
                                          <div
                                              className="absolute"
                                              style={{
                                                  left: 0, top: 0,
                                                  width: `${containerW}px`,
                                                  height: `${containerH}px`,
                                                  transformOrigin: '0 0',
                                                  transform: `translate(${bTx}px, ${bTy}px) scale(${boardCamera.zoom})`,
                                                  transition: boardCamTransition,
                                                  willChange: 'transform',
                                                  opacity: boardAnimReady ? 1 : 0,
                                              }}
                                          >
                                          {/* Focus zone guidelines — only shown to creator to preview what fans see */}
                                          {isCreatorOwner && boardContainerW > 0 && (() => {
                                              const DESKTOP_VW = 640, MOBILE_VW = 390, FOCUS_H = BOARD_MAX_H;
                                              const CREATOR_CARD_ZONE = 300;
                                              const isMob = boardContainerW < 600;
                                              const sv = isMob ? creator.boardFocusMobile : creator.boardFocusDesktop;
                                              // Default: top-left of content (matches default animation focus)
                                              const fX = sv?.x ?? DESKTOP_VW / 2;
                                              const fY = sv ? Math.max(0, sv.y - CREATOR_CARD_ZONE) : FOCUS_H / 2;
                                              // Anchor = top-left of the viewport frame in canvas coordinates
                                              const aX = fX - DESKTOP_VW / 2;
                                              const aY = Math.max(0, fY - FOCUS_H / 2);
                                              return (
                                                  <div className="absolute pointer-events-none" style={{ left: aX, top: aY, zIndex: 5 }}>
                                                      {/* Desktop — solid indigo */}
                                                      <div className="absolute" style={{ left: 0, top: 0, width: DESKTOP_VW, height: FOCUS_H, border: '1.5px solid rgba(99,102,241,0.35)', borderRadius: 3 }}>
                                                          <div className="absolute top-0 right-0 flex items-center gap-1 px-1.5 py-0.5 rounded-bl" style={{ background: 'rgba(99,102,241,0.08)', borderLeft: '1px solid rgba(99,102,241,0.2)', borderBottom: '1px solid rgba(99,102,241,0.2)' }}>
                                                              <span className="text-[7px] font-bold uppercase tracking-wider select-none text-indigo-400">Desktop</span>
                                                          </div>
                                                      </div>
                                                      {/* Mobile — dashed orange, centered within desktop */}
                                                      <div className="absolute" style={{ left: (DESKTOP_VW - MOBILE_VW) / 2, top: 0, width: MOBILE_VW, height: FOCUS_H, border: '1.5px dashed rgba(251,146,60,0.45)', borderRadius: 3 }}>
                                                          <div className="absolute top-0 left-0 flex items-center gap-1 px-1.5 py-0.5 rounded-br" style={{ background: 'rgba(251,146,60,0.08)', borderRight: '1px solid rgba(251,146,60,0.2)', borderBottom: '1px solid rgba(251,146,60,0.2)' }}>
                                                              <span className="text-[7px] font-bold uppercase tracking-wider select-none text-orange-400">Mobile</span>
                                                          </div>
                                                      </div>
                                                  </div>
                                              );
                                          })()}
                                              {/* Featured links / products / support stickers */}
                                              {(() => {
                                                  const LINK_DOMAINS: { pattern: RegExp; id: string }[] = [
                                                      { pattern: /youtube\.com|youtu\.be/, id: 'youtube' },
                                                      { pattern: /instagram\.com/, id: 'instagram' },
                                                      { pattern: /tiktok\.com/, id: 'tiktok' },
                                                      { pattern: /x\.com|twitter\.com/, id: 'x' },
                                                      { pattern: /threads\.net/, id: 'threads' },
                                                      { pattern: /twitch\.tv/, id: 'twitch' },
                                                      { pattern: /discord\.gg|discord\.com/, id: 'discord' },
                                                      { pattern: /linkedin\.com/, id: 'linkedin' },
                                                      { pattern: /spotify\.com/, id: 'spotify' },
                                                      { pattern: /patreon\.com/, id: 'patreon' },
                                                      { pattern: /substack\.com/, id: 'substack' },
                                                      { pattern: /github\.com/, id: 'github' },
                                                  ];
                                                  return allPublicLinks.map((link, li) => {
                                                      const isProduct = link.type === 'DIGITAL_PRODUCT';
                                                      const isSupport = link.type === 'SUPPORT';
                                                      const isEmoji = link.thumbnailUrl?.startsWith('data:emoji,');
                                                      const hasThumbnail = !!link.thumbnailUrl && !isEmoji;
                                                      const nc = li % noteColors.length;
                                                      let detectedPlatform: string | null = null;
                                                      if (!link.thumbnailUrl && link.url) {
                                                          try {
                                                              const hostname = new URL(link.url.startsWith('http') ? link.url : `https://${link.url}`).hostname;
                                                              detectedPlatform = LINK_DOMAINS.find(p => p.pattern.test(hostname))?.id || null;
                                                          } catch { /* invalid url */ }
                                                      }
                                                      const isYoutube = detectedPlatform === 'youtube' && !isProduct && !isSupport;
                                                      const _ytIdLink = isYoutube ? (() => {
                                                          try {
                                                              const u = new URL(link.url.startsWith('http') ? link.url : `https://${link.url}`);
                                                              if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
                                                              if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
                                                          } catch {}
                                                          return null;
                                                      })() : null;
                                                      const effectiveStyle = link.displayStyle || (link.iconShape ? 'icon' : 'wide');
                                                      const isIconMode = effectiveStyle === 'icon';
                                                      const isThumbnailMode = effectiveStyle === 'thumbnail' && !isYoutube;
                                                      const sqSize = _getLinkSize(link);
                                                      const isExternal = link.type === 'EXTERNAL';
                                                      const Tag: React.ElementType = isExternal ? 'a' : 'button';
                                                      // Wide/thumb size: S=minimal, M=compact(old S), L=auto(old M)
                                                      const cardSize = !isIconMode ? (link.iconShape === 'square-s' ? 'S' : link.iconShape === 'square-l' ? 'L' : 'M') : 'M';
                                                      const wideCardW = cardSize === 'S' ? 110 : cardSize === 'L' ? getWideWidth(link.title) : 140;
                                                      const thumbCardW = cardSize === 'S' ? 120 : cardSize === 'L' ? PROFILE_W : 160;

                                                      const pos = getLinkPos(link, li);

                                                      const linkRot = rotations[(stableIdx(link.id) + li) % rotations.length];

                                                      // ── Photo (plain image, no sticker chrome) ──
                                                      if (link.type === 'PHOTO') {
                                                          const phW = link.width ?? 220;
                                                          const phH = link.height ?? 160;
                                                          return (
                                                              <div
                                                                  key={link.id}
                                                                  className="absolute overflow-hidden"
                                                                  style={{ left: pos.x, top: pos.y, width: phW, height: phH, zIndex: 10 + li, borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}
                                                              >
                                                                  {link.thumbnailUrl && <img src={link.thumbnailUrl} alt={link.title || 'photo'} className="w-full h-full object-cover" draggable={false} />}
                                                              </div>
                                                          );
                                                      }

                                                      return (
                                                          <div
                                                              key={link.id}
                                                              className="absolute"
                                                          style={{ left: pos.x, top: pos.y, width: isIconMode ? (sqSize || PROFILE_W) : (isThumbnailMode ? thumbCardW : _ytIdLink ? PROFILE_W : wideCardW), zIndex: 50 + li, transform: `rotate(${linkRot}deg)`, transition: 'transform 0.2s ease' }}
                                                              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'rotate(0deg) scale(1.04)'; (e.currentTarget as HTMLDivElement).style.zIndex = '100'; }}
                                                              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = `rotate(${linkRot}deg) scale(1)`; (e.currentTarget as HTMLDivElement).style.zIndex = `${50 + li}`; }}
                                                          >
                                                          <div className={`h-3 mx-auto rounded-b-sm ${isIconMode ? (sqSize === 32 ? 'w-2.5' : sqSize === 44 ? 'w-3' : sqSize === 64 ? 'w-4' : 'w-8') : 'w-10'}`} style={{ background: tapeColors[nc] }} />
                                                              {isThumbnailMode ? (
                                                                  (() => {
                                                                      const thumbBg = detectedPlatform ? '#0f0f0f' : isProduct ? '#ede9fe' : isSupport ? '#fdf2f8' : '#e5e7eb';
                                                                      const typeIcon = isProduct
                                                                          ? <ShoppingBag size={10} className="text-violet-500 flex-shrink-0" />
                                                                          : isSupport
                                                                              ? <Heart size={10} className="text-pink-500 flex-shrink-0" />
                                                                              : detectedPlatform
                                                                                  ? <span className="w-3 h-3 flex-shrink-0">{getPlatformIcon(detectedPlatform)}</span>
                                                                                  : <ExternalLink size={10} className="text-stone-400 flex-shrink-0" />;
                                                                      const handleThumbClick = () => {
                                                                          if (isProduct) handleProductClick(link);
                                                                          else if (isSupport) handleSupportClick(link.price);
                                                                          else if (link.url) window.open(ensureProtocol(link.url), '_blank');
                                                                      };
                                                                      return (
                                                                          <button
                                                                              onClick={e => { e.stopPropagation(); handleThumbClick(); }}
                                                                              className={`w-full text-left rounded-lg overflow-hidden hover:opacity-90 transition-opacity ${cardSize === 'S' ? 'p-1' : cardSize === 'L' ? 'p-3' : 'p-2'}`}
                                                                              style={{ backgroundColor: noteColors[nc], border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
                                                                          >
                                                                              <div className="relative w-full rounded-md overflow-hidden mb-2" style={{ paddingBottom: '56.25%', backgroundColor: thumbBg }}>
                                                                                  {hasThumbnail
                                                                                      ? <img src={link.thumbnailUrl} className="absolute inset-0 w-full h-full object-cover" alt={link.title} />
                                                                                      : <div className="absolute inset-0 flex items-center justify-center">
                                                                                          {detectedPlatform ? <div className="scale-[2.5]">{getPlatformIcon(detectedPlatform)}</div>
                                                                                              : isProduct ? <ShoppingBag size={28} className="text-violet-300" />
                                                                                              : isSupport ? <Heart size={28} className="text-pink-300" />
                                                                                              : <ExternalLink size={28} className="text-stone-300" />}
                                                                                        </div>}
                                                                              </div>
                                                                              <div className="flex items-center gap-1">
                                                                                  {typeIcon}
                                                                                  <p className="text-[10px] font-bold text-stone-700 truncate">{link.title}</p>
                                                                              </div>
                                                                          </button>
                                                                      );
                                                                  })()
                                                              ) : _ytIdLink && !isIconMode ? (
                                                                  <a
                                                                      href={ensureProtocol(link.url)}
                                                                      target="_blank"
                                                                      rel="noopener noreferrer"
                                                                      onClick={e => e.stopPropagation()}
                                                                      className="block rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                                                                      style={{ backgroundColor: link.buttonColor || noteColors[nc], border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
                                                                  >
                                                                      <div className="p-2.5">
                                                                          <div className="relative w-full rounded-md overflow-hidden mb-2" style={{ paddingBottom: '56.25%' }}>
                                                                              <img src={`https://img.youtube.com/vi/${_ytIdLink}/hqdefault.jpg`} className="absolute inset-0 w-full h-full object-cover" alt={link.title} />
                                                                              <div className="absolute inset-0 flex items-center justify-center">
                                                                                  <div className="w-8 h-6 bg-[#FF0000] rounded-md flex items-center justify-center shadow opacity-90">
                                                                                      <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white ml-0.5"><path d="M8 5v14l11-7z"/></svg>
                                                                                  </div>
                                                                              </div>
                                                                          </div>
                                                                          <div className="flex items-center gap-1">
                                                                              <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="#FF0000"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.03 0 12 0 12s0 3.97.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.97 24 12 24 12s0-3.97-.5-5.81zM9.75 15.52V8.48L15.5 12l-5.75 3.52z"/></svg>
                                                                              <span className="text-[10px] font-bold text-stone-700 truncate">{link.title}</span>
                                                                          </div>
                                                                      </div>
                                                                  </a>
                                                              ) : isIconMode && sqSize === 32 ? (
                                                                  /* S: tiny icon, no padding */
                                                                  <Tag
                                                                      href={isExternal ? ensureProtocol(link.url) : undefined}
                                                                      target={isExternal ? "_blank" : undefined}
                                                                      rel={isExternal ? "noopener noreferrer" : undefined}
                                                                      onClick={e => {
                                                                          e.stopPropagation();
                                                                          if (isProduct) handleProductClick(link);
                                                                          if (isSupport) handleSupportClick(link.price);
                                                                      }}
                                                                      className="flex items-center justify-center rounded-md overflow-hidden hover:opacity-90 transition-opacity aspect-square p-0.5 w-full h-full block"
                                                                      style={{ backgroundColor: noteColors[nc], border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
                                                                  >
                                                                      <div className="w-6 h-6 rounded-md bg-white/60 shadow-sm border border-black/5 flex items-center justify-center mx-auto">
                                                                          {hasThumbnail ? <img src={link.thumbnailUrl} className="w-full h-full object-cover rounded-md" alt={link.title} /> : isEmoji ? <span className="text-xs leading-none">{link.thumbnailUrl!.replace('data:emoji,', '')}</span> : detectedPlatform ? <div className="scale-[0.75]">{getPlatformIcon(detectedPlatform)}</div> : isProduct ? <ShoppingBag size={11} className="text-violet-500" /> : isSupport ? <Heart size={11} className="text-pink-500" /> : <ExternalLink size={11} className="text-stone-500" />}
                                                                      </div>
                                                                  </Tag>
                                                              ) : isIconMode && sqSize === 44 ? (
                                                                  /* M: small square icon */
                                                                  <Tag
                                                                      href={isExternal ? ensureProtocol(link.url) : undefined}
                                                                      target={isExternal ? "_blank" : undefined}
                                                                      rel={isExternal ? "noopener noreferrer" : undefined}
                                                                      onClick={e => {
                                                                          e.stopPropagation();
                                                                          if (isProduct) handleProductClick(link);
                                                                          if (isSupport) handleSupportClick(link.price);
                                                                      }}
                                                                      className="flex items-center justify-center rounded-lg overflow-hidden hover:opacity-90 transition-opacity aspect-square p-1 w-full h-full block"
                                                                      style={{ backgroundColor: noteColors[nc], border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
                                                                  >
                                                                      <div className="w-7 h-7 rounded-lg bg-white/60 shadow-sm border border-black/5 flex items-center justify-center mx-auto">
                                                                          {hasThumbnail ? <img src={link.thumbnailUrl} className="w-full h-full object-cover rounded-lg" alt={link.title} /> : isEmoji ? <span className="text-base leading-none">{link.thumbnailUrl!.replace('data:emoji,', '')}</span> : detectedPlatform ? <div className="scale-[0.85]">{getPlatformIcon(detectedPlatform)}</div> : isProduct ? <ShoppingBag size={14} className="text-violet-500" /> : isSupport ? <Heart size={14} className="text-pink-500" /> : <ExternalLink size={14} className="text-stone-500" />}
                                                                      </div>
                                                                  </Tag>
                                                              ) : isIconMode && sqSize === 64 ? (
                                                                  <Tag
                                                                      href={isExternal ? ensureProtocol(link.url) : undefined}
                                                                      target={isExternal ? "_blank" : undefined}
                                                                      rel={isExternal ? "noopener noreferrer" : undefined}
                                                                      onClick={e => { e.stopPropagation(); if (isProduct) handleProductClick(link); if (isSupport) handleSupportClick(link.price); }}
                                                                      className="flex items-center justify-center rounded-lg overflow-hidden hover:opacity-90 transition-opacity aspect-square p-1.5 w-full h-full block"
                                                                      style={{ backgroundColor: noteColors[nc], border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
                                                                  >
                                                                      <div className="w-10 h-10 rounded-xl bg-white/60 shadow-sm border border-black/5 flex items-center justify-center mx-auto">
                                                                          {hasThumbnail ? <img src={link.thumbnailUrl} className="w-full h-full object-cover rounded-xl" alt={link.title} /> : isEmoji ? <span className="text-xl leading-none">{link.thumbnailUrl!.replace('data:emoji,', '')}</span> : detectedPlatform ? <div className="scale-[1.25]">{getPlatformIcon(detectedPlatform)}</div> : isProduct ? <ShoppingBag size={18} className="text-violet-500" /> : isSupport ? <Heart size={18} className="text-pink-500" /> : <ExternalLink size={18} className="text-stone-500" />}
                                                                      </div>
                                                                  </Tag>
                                                              ) : isProduct ? (
                                                                  <button
                                                                      onClick={() => handleProductClick(link)}
                                                                      className="w-full text-left rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                                                                      style={{ backgroundColor: noteColors[nc], border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
                                                                  >
                                                                      <div className="flex items-center gap-2.5 p-2.5">
                                                                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/60 border border-black/5">
                                                                              {hasThumbnail ? <img src={link.thumbnailUrl} className="w-full h-full object-cover rounded-lg" alt={link.title} /> : isEmoji ? <span className="text-xl leading-none">{link.thumbnailUrl!.replace('data:emoji,', '')}</span> : <ShoppingBag size={16} className="text-violet-400" />}
                                                                          </div>
                                                                          <div className="flex-1 min-w-0">
                                                                              <p className="text-xs font-bold text-stone-800 truncate">{link.title}</p>
                                                                              {link.price && <p className="text-[10px] text-stone-400 font-medium">{link.price}</p>}
                                                                          </div>
                                                                      </div>
                                                                      <div className="mx-2.5 mb-2.5 py-1.5 rounded-md text-[10px] font-bold text-center text-violet-600 bg-violet-50">
                                                                          <ShoppingBag size={9} className="inline mr-1" />Buy
                                                                      </div>
                                                                  </button>
                                                              ) : isSupport ? (
                                                                  <button
                                                                      onClick={() => handleSupportClick(link.price)}
                                                                      className="w-full text-left rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                                                                      style={{ backgroundColor: noteColors[nc], border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
                                                                  >
                                                                      <div className="flex items-center gap-2.5 p-2.5">
                                                                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/60 border border-black/5">
                                                                              {hasThumbnail ? <img src={link.thumbnailUrl} className="w-full h-full object-cover rounded-lg" alt={link.title} /> : isEmoji ? <span className="text-xl leading-none">{link.thumbnailUrl!.replace('data:emoji,', '')}</span> : <Heart size={16} className="text-pink-400" />}
                                                                          </div>
                                                                          <div className="flex-1 min-w-0">
                                                                              <p className="text-xs font-bold text-stone-800 truncate">{link.title}</p>
                                                                          </div>
                                                                          <span className="text-[10px] font-bold text-pink-500 bg-pink-50 px-2 py-1 rounded-full flex-shrink-0">Tip ♥</span>
                                                                      </div>
                                                                  </button>
                                                              ) : (() => {
                                                                  const ytId = detectedPlatform === 'youtube' ? getYouTubeId(link.url) : null;
                                                                  if (ytId) {
                                                                      return (
                                                                          <a
                                                                              href={ensureProtocol(link.url)}
                                                                              target="_blank"
                                                                              rel="noopener noreferrer"
                                                                              onClick={e => e.stopPropagation()}
                                                                              className="block rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                                                                              style={{ backgroundColor: link.buttonColor || noteColors[nc], border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
                                                                          >
                                                                              <div className="p-2.5">
                                                                                  {/* Thumbnail */}
                                                                                  <div className="relative w-full rounded-md overflow-hidden mb-2" style={{ paddingBottom: '56.25%' }}>
                                                                                      <img
                                                                                          src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                                                                                          className="absolute inset-0 w-full h-full object-cover"
                                                                                          alt={link.title}
                                                                                      />
                                                                                      {/* Play button overlay */}
                                                                                      <div className="absolute inset-0 flex items-center justify-center">
                                                                                          <div className="w-8 h-6 bg-[#FF0000] rounded-md flex items-center justify-center shadow opacity-90">
                                                                                              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white ml-0.5"><path d="M8 5v14l11-7z"/></svg>
                                                                                          </div>
                                                                                      </div>
                                                                                  </div>
                                                                                  {/* Title row */}
                                                                                  <div className="flex items-center gap-1">
                                                                                      <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="#FF0000"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.03 0 12 0 12s0 3.97.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.97 24 12 24 12s0-3.97-.5-5.81zM9.75 15.52V8.48L15.5 12l-5.75 3.52z"/></svg>
                                                                                      <span className="text-[10px] font-bold text-stone-700 truncate">{link.title}</span>
                                                                                  </div>
                                                                              </div>
                                                                          </a>
                                                                      );
                                                                  }
                                                                  if (link.iconShape === 'square-xxs') {
                                                                      const isExternal = link.type === 'EXTERNAL';
                                                                      const Tag = isExternal ? 'a' : 'button';
                                                                      return (
                                                                          <Tag
                                                                              href={isExternal ? ensureProtocol(link.url) : undefined}
                                                                              target={isExternal ? "_blank" : undefined}
                                                                              rel={isExternal ? "noopener noreferrer" : undefined}
                                                                              onClick={e => {
                                                                                  e.stopPropagation();
                                                                                  if (isProduct) handleProductClick(link);
                                                                                  if (isSupport) handleSupportClick(link.price);
                                                                              }}
                                                                              className="flex items-center gap-2.5 rounded-lg overflow-hidden hover:opacity-90 transition-opacity p-2 w-full h-full"
                                                                              style={{ backgroundColor: noteColors[nc], border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
                                                                          >
                                                                              <div className="w-6 h-6 rounded-md bg-white/60 shadow-sm border border-black/5 flex items-center justify-center flex-shrink-0">
                                                                                  {hasThumbnail ? <img src={link.thumbnailUrl} className="w-full h-full object-cover rounded-md" alt={link.title} /> : isEmoji ? <span className="text-[14px] leading-none">{link.thumbnailUrl!.replace('data:emoji,', '')}</span> : detectedPlatform ? <div className="scale-[0.9]">{getPlatformIcon(detectedPlatform)}</div> : isProduct ? <ShoppingBag size={12} className="text-violet-500" /> : isSupport ? <Heart size={12} className="text-pink-500" /> : <ExternalLink size={12} className="text-stone-500" />}
                                                                              </div>
                                                                              <p className="text-xs font-bold text-stone-800 leading-tight w-full truncate text-left flex-1">{link.title}</p>
                                                                          </Tag>
                                                                      );
                                                                  }
                                                                  return (
                                                                      <a
                                                                          href={ensureProtocol(link.url)}
                                                                          target="_blank"
                                                                          rel="noopener noreferrer"
                                                                          onClick={e => e.stopPropagation()}
                                                                          className={`flex items-center gap-2 rounded-lg hover:opacity-80 transition-opacity ${cardSize === 'S' ? 'p-1' : cardSize === 'L' ? 'p-2.5' : 'p-2'}`}
                                                                          style={{ backgroundColor: noteColors[nc], border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}
                                                                      >
                                                                          <div className={`${cardSize === 'S' ? 'w-4 h-4' : cardSize === 'L' ? 'w-7 h-7' : 'w-5 h-5'} rounded-lg flex items-center justify-center flex-shrink-0 bg-white/60 border border-black/5 text-stone-600`}>
                                                                              {hasThumbnail ? <img src={link.thumbnailUrl} className="w-full h-full object-cover rounded-lg" alt={link.title} /> : isEmoji ? <span className={cardSize === 'S' ? 'text-[9px] leading-none' : cardSize === 'L' ? 'text-base leading-none' : 'text-xs leading-none'}>{link.thumbnailUrl!.replace('data:emoji,', '')}</span> : detectedPlatform ? <div className={cardSize === 'S' ? 'scale-[0.7]' : cardSize === 'L' ? 'scale-[0.95]' : 'scale-[0.8]'}>{getPlatformIcon(detectedPlatform)}</div> : <ExternalLink size={cardSize === 'S' ? 8 : cardSize === 'L' ? 13 : 10} />}
                                                                          </div>
                                                                          <span className={`${cardSize === 'S' ? 'text-[9px]' : cardSize === 'L' ? 'text-xs' : 'text-[10px]'} font-semibold text-stone-700 ${cardSize === 'L' ? 'overflow-hidden' : 'truncate'} flex-1`}>{link.title}</span>
                                                                      </a>
                                                                  );
                                                              })()}
                                                          </div>
                                                      );
                                                  });
                                              })()}

                                              {/* --- Pinned stickers --- */}
                                              {pinnedPosts.length === 0 && allPublicLinks.length === 0 && (
                                                  <div className="absolute inset-0 flex items-center justify-center opacity-40">
                                                      <div className="text-center">
                                                          <div className="text-4xl mb-3">📋</div>
                                                          <p className="text-sm font-medium text-stone-500">No posts yet — be the first!</p>
                                                      </div>
                                                  </div>
                                              )}
                                              {pinnedPosts.map((post, i) => {
                                                  const nc = stableIdx(post.id) % noteColors.length;
                                                  const rot = rotations[stableIdx(post.id) % rotations.length];
                                                  const pos = getPos(post);
                                                  return (
                                                      <div
                                                          key={post.id}
                                                          data-post-id={post.id}
                                                          className="absolute cursor-pointer"
                                                              style={{ left: pos.x, top: pos.y, width: NOTE_W, transform: `rotate(${rot}deg)`, transition: 'transform 0.2s ease', zIndex: 30 + i }}
                                                          onClick={() => { setSelectedBoardPost(post); setIsComposing(false); }}
                                                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'rotate(0deg) scale(1.04)'; (e.currentTarget as HTMLDivElement).style.zIndex = '100'; }}
                                                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = `rotate(${rot}deg) scale(1)`; (e.currentTarget as HTMLDivElement).style.zIndex = `${30 + i}`; }}
                                                      >
                                                          {/* Tape strip */}
                                                          <div className="h-4 w-14 mx-auto rounded-b-sm" style={{ background: tapeColors[nc] }} />
                                                          {/* Note card — use fan-chosen color if available */}
                                                          <div
                                                              className="relative rounded-lg p-3 overflow-hidden"
                                                              style={{
                                                                  backgroundColor: post.noteColor ?? noteColors[nc],
                                                                  backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 23px, rgba(0,0,0,0.04) 23px, rgba(0,0,0,0.04) 24px)',
                                                                  backgroundPositionY: '36px',
                                                                  border: '1px solid rgba(0,0,0,0.08)',
                                                                  boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                                                              }}
                                                          >
                                                              {/* Fan: avatar + name + badge */}
                                                              <div className="flex items-center gap-1.5 mb-1.5">
                                                                  <div className="w-6 h-6 rounded-full bg-stone-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                                                      {post.fanAvatarUrl
                                                                          ? <img src={post.fanAvatarUrl} className="w-full h-full object-cover" alt={post.fanName} />
                                                                          : <span className="text-white text-[9px] font-bold">{post.fanName.charAt(0).toUpperCase()}</span>}
                                                                  </div>
                                                                  <span className="text-[11px] font-semibold text-stone-800 truncate">{post.fanName}</span>
                                                                  <span className="flex items-center gap-0.5 bg-stone-100 text-stone-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                                                      <User size={7} className="fill-current" />
                                                                      <span className="text-[8px] font-semibold uppercase tracking-wide">Fan</span>
                                                                  </span>
                                                              </div>

                                                              {/* Fan message only — no reply shown in preview */}
                                                              <div className="ml-[30px] bg-white/80 rounded-xl rounded-tl-sm border border-black/06 p-2">
                                                                  <p className="text-[11px] text-stone-700 leading-relaxed line-clamp-4">{post.content}</p>
                                                                  {post.attachmentUrl && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(post.attachmentUrl) && (
                                                                      <img src={post.attachmentUrl} className="mt-1.5 w-full max-h-16 object-cover rounded-lg" alt="attachment" />
                                                                  )}
                                                              </div>
                                                          </div>
                                                      </div>
                                                  );
                                              })}

                                          </div>
                                      </div>
                                  );
                              })()}

                              {/* Thread view — popup modal */}
                              {selectedBoardPost && (() => {
                                  const post = selectedBoardPost;
                                  const noteColors = ['#FFFEF0', '#F0FDF4', '#FFF7ED', '#F5F3FF', '#EFF6FF', '#FDF2F8'];
                                  const tapeColors = ['rgba(200,193,185,0.55)', 'rgba(110,200,140,0.45)', 'rgba(240,160,80,0.4)', 'rgba(180,150,240,0.4)', 'rgba(110,170,240,0.4)', 'rgba(240,140,180,0.4)'];
                                  const _si = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xFFFFFF; return Math.abs(h); };
                                  const nc = _si(post.id) % noteColors.length;
                                  return (
                                      <div
                                          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                                          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
                                          onClick={() => setSelectedBoardPost(null)}
                                      >
                                      <div className="animate-in fade-in zoom-in-95 duration-200 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                                          {/* Tape strip */}
                                          <div className="h-5 w-16 mx-auto rounded-b-sm" style={{ background: tapeColors[nc] }} />
                                          {/* Expanded note card */}
                                          <div
                                              className="relative rounded-lg overflow-hidden"
                                              style={{
                                                  backgroundColor: noteColors[nc],
                                                  backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 27px, rgba(0,0,0,0.05) 27px, rgba(0,0,0,0.05) 28px)',
                                                  backgroundPositionY: '48px',
                                                  border: '1px solid rgba(0,0,0,0.08)',
                                                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                              }}
                                          >
                                                  {/* Back button + label */}
                                              <div className="flex items-center gap-2 px-4 pt-4 pb-2 border-b border-stone-100/60 mb-2">
                                                  <button
                                                      onClick={() => setSelectedBoardPost(null)}
                                                      className="p-1 rounded-full hover:bg-black/5 transition-colors text-stone-400 hover:text-stone-600"
                                                  >
                                                      <ChevronLeft size={15} />
                                                  </button>
                                              <span className="flex items-center gap-1 text-stone-400"><DiemLogo size={14} className="text-stone-400" /></span>
                                                  {post.isPinned && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100"><Pin size={8} className="fill-current" /> Pinned</span>}
                                                  {post.reply && !post.isPinned && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100"><CheckCircle2 size={8} className="fill-current" /> Answered</span>}
                                              </div>

                                              {/* Conversation — inbox style */}
                                              <div className="px-3 pb-5 space-y-1">
                                                  {/* Fan message */}
                                                  <div className="flex relative z-10">
                                                      <div className="flex flex-col items-center mr-3 relative">
                                                          {post.reply && <div className="absolute left-[17px] top-11 -bottom-1 w-0.5 bg-stone-200" />}
                                                          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-stone-800 flex items-center justify-center">
                                                              {post.fanAvatarUrl
                                                                  ? <img src={post.fanAvatarUrl} className="w-full h-full object-cover" alt={post.fanName} />
                                                                  : <div className="w-full h-full bg-stone-200 flex items-center justify-center"><User size={16} className="text-stone-500" /></div>}
                                                          </div>
                                                      </div>
                                                      <div className="flex-1 min-w-0 pb-2">
                                                          <div className="flex items-center gap-2 mb-2 ml-1">
                                                              <span className="font-semibold text-sm text-stone-900">{post.fanName}</span>
                                                              <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                                                  <User size={10} className="fill-current" />
                                                                  <span className="text-[9px] font-semibold uppercase tracking-wide">Fan</span>
                                                              </div>
                                                              <span className="text-xs font-medium text-stone-400">• {new Date(post.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                                                          </div>
                                                          <div className="bg-white p-3 sm:p-4 rounded-2xl rounded-tl-lg border border-stone-200/60">
                                                              <p className="text-sm text-stone-700 leading-relaxed">{post.content}</p>
                                                              {post.attachmentUrl && (
                                                                  /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(post.attachmentUrl)
                                                                      ? <img src={post.attachmentUrl} className="mt-2 w-full max-h-48 object-cover rounded-xl" alt="attachment" />
                                                                      : <a href={post.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 text-xs text-stone-500 hover:text-stone-800 font-medium transition-colors"><Paperclip size={12} /> {post.attachmentUrl.split('/').pop()}</a>
                                                              )}
                                                          </div>
                                                      </div>
                                                  </div>

                                                  {/* Creator reply */}
                                                  {post.reply ? (
                                                      <div className="flex mt-4 relative z-10">
                                                          <div className="flex flex-col items-center mr-3">
                                                              <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-stone-200 flex items-center justify-center">
                                                                  {creator.avatarUrl
                                                                      ? <img src={creator.avatarUrl} className="w-full h-full object-cover" alt={creator.displayName} />
                                                                      : <div className="w-full h-full bg-stone-200 flex items-center justify-center"><User size={16} className="text-stone-500" /></div>}
                                                              </div>
                                                          </div>
                                                          <div className="flex-1 min-w-0">
                                                              <div className="flex items-center gap-2 mb-2 ml-1">
                                                                  <span className="font-semibold text-sm text-stone-900">{creator.displayName}</span>
                                                                  <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                                                      <CheckCircle2 size={10} className="text-blue-500" />
                                                                      <span className="text-[9px] font-semibold uppercase tracking-wide">Creator</span>
                                                                  </div>
                                                                  {post.replyAt && <span className="text-xs font-medium text-stone-400">• {new Date(post.replyAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
                                                              </div>
                                                              <div className="bg-white p-3 sm:p-4 rounded-2xl rounded-tl-lg border border-stone-200/60">
                                                                  <p className="text-sm text-stone-700 leading-relaxed">{post.reply}</p>
                                                                  {post.replyAttachmentUrl && (
                                                                      /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(post.replyAttachmentUrl)
                                                                          ? <img src={post.replyAttachmentUrl} className="mt-2 w-full max-h-48 object-cover rounded-xl" alt="attachment" />
                                                                          : <a href={post.replyAttachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 text-xs text-stone-500 hover:text-stone-800 font-medium transition-colors"><Paperclip size={12} /> {post.replyAttachmentUrl.split('/').pop()}</a>
                                                                  )}
                                                              </div>
                                                          </div>
                                                      </div>
                                                  ) : (
                                                      <div className="flex mt-4 relative z-10">
                                                          <div className="flex flex-col items-center mr-3">
                                                              <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-dashed border-stone-300 flex items-center justify-center">
                                                                  {creator.avatarUrl
                                                                      ? <img src={creator.avatarUrl} className="w-full h-full object-cover opacity-30" alt="" />
                                                                      : <User size={16} className="text-stone-300" />}
                                                              </div>
                                                          </div>
                                                          <div className="flex-1 flex items-center">
                                                              <p className="text-xs text-stone-400 italic ml-1">{creator.stats?.responseTimeAvg ? `Replies in ~${creator.stats.responseTimeAvg}` : `Awaiting reply from ${creator.displayName}…`}</p>
                                                          </div>
                                                      </div>
                                                  )}
                                              </div>
                                          </div>
                                      </div>
                                      </div>
                                  );
                              })()}

                              {/* Post Diem button — always visible */}
                              <div className="flex justify-center pt-0 pb-6 -mt-6 relative z-10">
                                  <button
                                      onClick={() => currentUser ? setIsComposing(true) : onLoginRequest()}
                                      className="inline-flex items-center gap-2 bg-stone-900 text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:bg-stone-700 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                      style={creator.diemButtonColor ? { backgroundColor: creator.diemButtonColor, color: getContrastColor(creator.diemButtonColor) } : undefined}
                                  >
                                      <Plus size={15} /> Post Diem
                                  </button>
                              </div>
                      </div>
                  </div>
              </div>
          )}

          {/* 4. AFFILIATE LINKS, PRODUCTS & SUPPORT — customize mode only; public view uses board stickers */}
          {isCustomizeMode && <div ref={tutorialLinksRef} className={`w-full space-y-6 ${showTutorial && tutorialStep === 3 ? 'ring-2 ring-amber-400 ring-offset-2 rounded-2xl p-1' : ''}`}>
                {groupedLinks.map((group, groupIdx) => {
                    const groupLinksToShow = group.links;
                    if (groupLinksToShow.length === 0 && !isCustomizeMode) return null;
                    if (group.id === null && sortedSections.length > 0 && groupLinksToShow.length === 0 && !isCustomizeMode) return null;

                    const productLinks = groupLinksToShow.filter(l => l.type === 'DIGITAL_PRODUCT');
                    const supportLinks = groupLinksToShow.filter(l => l.type === 'SUPPORT');
                    const externalLinks = groupLinksToShow.filter(l => l.type !== 'DIGITAL_PRODUCT' && l.type !== 'SUPPORT');

                    // Inline platform domain list for external links
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

                    return (
                    <div key={group.id ?? 'default'} className="space-y-4">
                        <div className="flex justify-center items-end">
                            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                                <Tag size={14} /> {group.title ?? (creator.linksSectionTitle || t('profile.featuredLinks'))}
                            </h3>
                        </div>
                        {isCustomizeMode ? (
                            <div className="grid gap-3">
                                {groupLinksToShow.map((link) => {
                                    const isProduct = link.type === 'DIGITAL_PRODUCT';
                                    const isSupport = link.type === 'SUPPORT';
                                    return (
                                        <div key={link.id} className="relative group">
                                            <div className={`relative rounded-2xl p-4 pr-12 border border-dashed flex items-center transition-all ${isProduct ? 'bg-stone-50 border-stone-300' : isSupport ? 'bg-stone-50 border-stone-300' : 'bg-white border-stone-300'}`}>
                                                <button onClick={() => handleUpdateLink(link.id, 'isPromoted', !link.isPromoted)} className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-colors hover:bg-stone-100 ${link.isPromoted ? 'bg-stone-100 text-stone-600' : 'bg-white text-stone-400'}`} title={t('profile.toggleHighlight')}>
                                                    {link.isPromoted ? <Sparkles size={20} /> : <ExternalLink size={20} />}
                                                </button>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {isProduct ? <span className="text-[10px] font-semibold bg-stone-200 text-stone-600 px-1.5 rounded uppercase">{t('profile.product')}</span> : isSupport ? <span className="text-[10px] font-semibold bg-stone-200 text-stone-600 px-1.5 rounded uppercase">{t('profile.support')}</span> : null}
                                                        <input className="block w-full font-bold text-stone-800 text-lg leading-tight bg-transparent outline-none border-b border-transparent focus:border-stone-300 placeholder-stone-300" value={link.title} onChange={(e) => handleUpdateLink(link.id, 'title', e.target.value)} placeholder={t('profile.linkTitle')} />
                                                    </div>
                                                    <input className="block w-full text-xs text-stone-400 mt-1 bg-transparent outline-none border-b border-transparent focus:border-stone-300 placeholder-stone-300" value={link.url} onChange={(e) => handleUpdateLink(link.id, 'url', e.target.value)} placeholder={t('profile.url')} />
                                                </div>
                                            </div>
                                            <button onClick={() => handleRemoveLink(link.id)} className="absolute -top-2 -right-2 bg-red-500 text-white p-2 rounded-full shadow-md hover:bg-red-600 z-20"><Trash size={14} /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : groupLinksToShow.length === 0 ? (
                            <div className="p-6 text-center border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 text-xs">{t('profile.noLinksYet')}</div>
                        ) : (
                            <div className="space-y-3">
                                {/* Products: horizontal boxed cards (like support) */}
                                {productLinks.length > 0 && (
                                    <div className="space-y-3">
                                        {productLinks.map((link) => {
                                            const isEmoji = link.thumbnailUrl?.startsWith('data:emoji,');
                                            const hasThumbnail = !!link.thumbnailUrl && !isEmoji;
                                            const accentColor = link.buttonColor;
                                            const btnStyle = accentColor ? { backgroundColor: accentColor, color: getContrastColor(accentColor) } : undefined;
                                            return (
                                                <button key={link.id} onClick={() => handleProductClick(link)} className={`w-full text-left p-4 rounded-2xl border flex items-center gap-4 group cursor-pointer transition-all hover:shadow-md ${link.isPromoted ? 'bg-gradient-to-r from-violet-50/40 to-purple-50/20 border-violet-100 shadow-sm' : 'bg-white border-stone-200/60 hover:border-stone-300'}`}>
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${hasThumbnail ? 'overflow-hidden border border-stone-100' : isEmoji ? 'bg-stone-100' : 'bg-violet-50 text-violet-400'}`}>
                                                        {hasThumbnail ? <img src={link.thumbnailUrl} className="w-full h-full object-cover" alt={link.title} /> : isEmoji ? <span className="text-2xl leading-none">{link.thumbnailUrl!.replace('data:emoji,', '')}</span> : <FileText size={24} />}
                                                    </div>
                                                    <div className="flex-1 min-w-0 text-left">
                                                        <h4 className="font-semibold text-stone-900 text-sm">{link.title}</h4>
                                                        <p className="text-xs text-stone-400 mt-0.5">{t('profile.product')}{link.price ? ` · ${link.price}` : ''}{link.isPromoted ? ` · ${t('common.recommended')}` : ''}</p>
                                                    </div>
                                                    <div className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 flex-shrink-0 transition-colors ${!btnStyle ? (link.isPromoted ? 'bg-violet-500 text-white' : 'bg-violet-50 text-violet-600 group-hover:bg-violet-100') : ''}`} style={btnStyle}>
                                                        <ShoppingBag size={14} /> {t('common.buy')}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Support: featured card */}
                                {supportLinks.map((link) => {
                                    const isEmoji = link.thumbnailUrl?.startsWith('data:emoji,');
                                    const hasThumbnail = !!link.thumbnailUrl && !isEmoji;
                                    const accentColor = link.buttonColor;
                                    const btnStyle = accentColor ? { backgroundColor: accentColor, color: getContrastColor(accentColor) } : undefined;
                                    return (
                                        <button key={link.id} onClick={() => handleSupportClick(link.price)} className={`w-full text-left p-4 rounded-2xl border flex items-center gap-4 group cursor-pointer transition-all hover:shadow-md ${link.isPromoted ? 'bg-gradient-to-r from-pink-50/40 to-rose-50/20 border-pink-100 shadow-sm' : 'bg-white border-stone-200/60 hover:border-stone-300'}`}>
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${hasThumbnail ? 'overflow-hidden border border-stone-100' : isEmoji ? 'bg-stone-100' : 'bg-pink-50 text-pink-400'}`}>
                                                {hasThumbnail ? <img src={link.thumbnailUrl} className="w-full h-full object-cover" alt={link.title} /> : isEmoji ? <span className="text-2xl leading-none">{link.thumbnailUrl!.replace('data:emoji,', '')}</span> : <Heart size={24} />}
                                            </div>
                                            <div className="flex-1 min-w-0 text-left">
                                                <h4 className="font-semibold text-stone-900 text-sm">{link.title}</h4>
                                                <p className="text-xs text-stone-400 mt-0.5">{t('profile.sendTip')}{link.isPromoted ? ` · ${t('common.recommended')}` : ''}</p>
                                            </div>
                                            <div className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 flex-shrink-0 transition-colors ${!btnStyle ? (link.isPromoted ? 'bg-pink-400 text-white' : 'bg-pink-50 text-pink-500 group-hover:bg-pink-100') : ''}`} style={btnStyle}>
                                                <Heart size={14} /> {t('profile.tip')}
                                            </div>
                                        </button>
                                    );
                                })}

                                {/* External links: YouTube embeds as notes, others as list rows */}
                                {externalLinks.length > 0 && (
                                    <div className="space-y-2">
                                        {externalLinks.map((link) => {
                                            const isEmoji = link.thumbnailUrl?.startsWith('data:emoji,');
                                            const hasThumbnail = !!link.thumbnailUrl && !isEmoji;
                                            const accentColor = link.buttonColor;
                                            const shapeClass = link.iconShape === 'circle' ? 'rounded-full' : link.iconShape === 'rounded' ? 'rounded-xl' : 'rounded-none';
                                            const btnStyle = accentColor ? { backgroundColor: accentColor, color: getContrastColor(accentColor) } : undefined;
                                            const iconStyle = accentColor && !hasThumbnail ? { backgroundColor: `${accentColor}22`, color: accentColor } : undefined;

                                            // YouTube embed note
                                            const ytId = link.url ? getYouTubeId(link.url) : null;
                                            if (ytId) {
                                                return (
                                                    <div key={link.id} className="relative overflow-hidden rounded-2xl border border-stone-200/60 bg-[#fffef5] shadow-sm" style={{ transform: 'rotate(-0.4deg)' }}>
                                                        <div className="h-3 w-20 mx-auto bg-amber-200/70 rounded-b-sm" />
                                                        <div className="aspect-video bg-black">
                                                            <iframe src={`https://www.youtube.com/embed/${ytId}`} className="w-full h-full" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={link.title} />
                                                        </div>
                                                        {link.title && <div className="px-4 py-3"><p className="font-semibold text-stone-800 text-sm">{link.title}</p></div>}
                                                    </div>
                                                );
                                            }

                                            let detectedPlatform: string | null = null;
                                            if (!link.thumbnailUrl && link.url) {
                                                try {
                                                    const hostname = new URL(link.url.startsWith('http') ? link.url : `https://${link.url}`).hostname;
                                                    detectedPlatform = PLATFORM_DOMAINS.find(p => p.pattern.test(hostname))?.id || null;
                                                } catch { /* invalid url */ }
                                            }
                                            let faviconUrl: string | null = null;
                                            if (!link.thumbnailUrl && link.url && !detectedPlatform) {
                                                try { faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(link.url.startsWith('http') ? link.url : `https://${link.url}`).hostname}&sz=64`; } catch { faviconUrl = null; }
                                            }

                                            return (
                                                <a key={link.id} href={ensureProtocol(link.url)} target="_blank" rel="noopener noreferrer" onClick={() => logAnalyticsEvent(creator.id, 'CONVERSION', { type: 'LINK', id: link.id, title: link.title, url: link.url })} className={`flex w-full text-left p-3 sm:p-4 rounded-2xl border items-center gap-3 sm:gap-4 group cursor-pointer transition-all hover:shadow-md relative overflow-hidden ${link.isPromoted ? 'bg-gradient-to-r from-stone-50 to-stone-100/40 border-stone-200 shadow-sm' : 'hover:border-stone-300'}`} style={!link.isPromoted ? linkBlockStyleWithRadius : undefined}>
                                                    <div className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${shapeClass} ${hasThumbnail ? 'p-0 overflow-hidden border border-stone-100' : isEmoji ? 'bg-stone-100' : detectedPlatform ? 'bg-stone-100' : faviconUrl ? 'overflow-hidden bg-white border border-stone-100' : 'bg-stone-900 text-white'}`} style={iconStyle}>
                                                        {hasThumbnail ? <img src={link.thumbnailUrl} className="w-full h-full object-cover" alt={link.title} />
                                                        : isEmoji ? <span className="text-xl sm:text-2xl leading-none">{link.thumbnailUrl!.replace('data:emoji,', '')}</span>
                                                        : detectedPlatform ? getPlatformIcon(detectedPlatform)
                                                        : faviconUrl ? <img src={faviconUrl} className="w-full h-full object-cover" alt={link.title} onError={(e) => { (e.target as HTMLImageElement).style.display='none'; (e.target as HTMLImageElement).parentElement!.classList.add('bg-stone-900'); (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'; }} />
                                                        : <><Sparkles size={20} className="sm:hidden" /><Sparkles size={24} className="hidden sm:block" /></>}
                                                    </div>
                                                    <div className="flex-1 relative z-10 min-w-0 text-left">
                                                        <h4 className="font-semibold sm:font-bold text-sm sm:text-base text-stone-900 group-hover:text-stone-700 transition-colors truncate">{link.title}</h4>
                                                        <p className="text-[10px] text-stone-400 mt-0.5 font-medium truncate">{t('profile.externalLink')}{link.isPromoted ? ` · ${t('common.recommended')}` : ''}</p>
                                                    </div>
                                                    <div className={`w-20 h-9 px-3 py-0 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 flex-shrink-0 whitespace-nowrap transition-colors ${!btnStyle ? (link.isPromoted ? 'bg-stone-900 text-white group-hover:bg-stone-700' : 'bg-stone-100 text-stone-600 hover:bg-stone-200') : ''}`} style={btnStyle}>
                                                        {link.isPromoted ? t('common.visit') : t('common.open')} <ExternalLink size={12} />
                                                    </div>
                                                </a>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    );
                })}
          </div>}


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
                     <div className="flex items-start gap-2.5 mb-4 p-3 bg-blue-50/50 border border-blue-100/60 rounded-xl">
                         <Lock size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                         <p className="text-xs text-blue-700 font-medium leading-relaxed">
                             This is a <strong>Private Message</strong>. It goes directly to {creator.displayName}'s inbox and will <strong className="underline">never</strong> appear on the public board.
                         </p>
                     </div>
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

      {/* Board Compose Modal */}
      {isComposing && (
        <div
            className="fixed inset-0 z-[250] flex items-start sm:items-center justify-center p-4 pt-12 sm:pt-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={() => { setIsComposing(false); setBoardMessage(''); setSelectedSticker(null); setIsPrivatePost(false); setBoardAttachmentFile(null); setBoardAttachmentPreview(null); }}
        >
            <div
                className="w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 flex gap-3 items-start"
                onClick={e => e.stopPropagation()}
            >
                {/* Left panel — emoji picker */}
                <div
                    className="hidden sm:block w-32 flex-shrink-0 rounded-xl shadow-xl overflow-hidden"
                    style={{ background: '#fffef0' }}
                >
                    <div className="px-2 pt-2.5 pb-1">
                        <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest text-center">Emoji</p>
                    </div>
                    <div className="grid grid-cols-3 gap-0.5 p-2 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                        {['⭐','❤️','🔥','✨','🎉','💬','🌙','🌸','💡','🎵','😊','🤍','😂','🥹','🥰','😎','🤔','👏','🙌','💪','🫶','🎶','📸','🌈','🍀','🦋','🌺','🎯','💫','🙏','👋','✌️','🤝','💎','🏆'].map(s => (
                            <button
                                key={s}
                                onClick={() => {
                                    const el = boardTextareaRef.current;
                                    if (!el) { setBoardMessage(m => m + s); return; }
                                    const start = el.selectionStart ?? boardMessage.length;
                                    const end = el.selectionEnd ?? boardMessage.length;
                                    const next = boardMessage.slice(0, start) + s + boardMessage.slice(end);
                                    if (next.length <= 500) {
                                        setBoardMessage(next);
                                        requestAnimationFrame(() => {
                                            el.focus();
                                            el.setSelectionRange(start + s.length, start + s.length);
                                        });
                                    }
                                }}
                                className="w-full aspect-square rounded-lg text-xl flex items-center justify-center hover:bg-stone-100 active:scale-90 transition-all"
                            >{s}</button>
                        ))}
                    </div>
                </div>

                {/* Right panel — note card */}
                <div className="flex-1 min-w-0">
                    {/* Tape strip */}
                    <div className="flex justify-center">
                        <div className="h-5 w-20 bg-amber-200/80 rounded-b-sm shadow-sm" style={{ transform: 'rotate(-1.5deg)' }} />
                    </div>
                    <div
                        className="relative rounded-sm shadow-2xl overflow-hidden transition-colors duration-150"
                        style={{ background: selectedNoteColor ?? '#fffef0', backgroundImage: 'repeating-linear-gradient(transparent 0px, transparent 27px, rgba(0,0,0,0.045) 27px, rgba(0,0,0,0.045) 28px)' }}
                    >
                        <div className="absolute left-9 top-0 bottom-0 w-px bg-red-200/50 pointer-events-none" />

                        {/* Header row */}
                        <div className="flex items-center justify-between px-3 pt-3 pb-1">
                            <div className="flex items-center gap-1.5">
                                {currentUser?.avatarUrl
                                    ? <img src={currentUser.avatarUrl} className="w-6 h-6 rounded-full object-cover" alt="" />
                                    : <div className="w-6 h-6 rounded-full bg-stone-200 flex items-center justify-center"><User size={12} className="text-stone-500" /></div>}
                                <span className="text-xs font-semibold text-stone-500">{currentUser?.name}</span>
                            </div>
                        </div>

                        {/* Color swatches */}
                        <div className="flex items-center gap-1.5 px-3 pb-2">
                            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mr-0.5">Color</span>
                            {[
                                { color: '#fffef0', label: 'Yellow' },
                                { color: '#F0FDF4', label: 'Green' },
                                { color: '#FFF7ED', label: 'Peach' },
                                { color: '#F5F3FF', label: 'Lavender' },
                                { color: '#EFF6FF', label: 'Blue' },
                                { color: '#FDF2F8', label: 'Pink' },
                                { color: '#F1F5F9', label: 'White' },
                            ].map(({ color, label }) => (
                                <button
                                    key={color}
                                    title={label}
                                    onClick={() => setSelectedNoteColor(selectedNoteColor === color ? null : color)}
                                    className="w-5 h-5 rounded-full border-2 transition-all hover:scale-110"
                                    style={{
                                        background: color,
                                        borderColor: selectedNoteColor === color ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)',
                                        boxShadow: selectedNoteColor === color ? '0 0 0 1px rgba(0,0,0,0.3)' : 'none',
                                        transform: selectedNoteColor === color ? 'scale(1.25)' : undefined,
                                    }}
                                />
                            ))}
                        </div>

                        {/* Textarea */}
                        <textarea
                            ref={boardTextareaRef}
                            autoFocus
                            className="w-full pl-11 pr-4 py-2 bg-transparent outline-none resize-none text-stone-800 placeholder:text-stone-300 text-sm"
                            style={{ minHeight: '150px', lineHeight: '28px', fontFamily: 'inherit' }}
                            placeholder="What's on your mind?"
                            value={boardMessage}
                            onChange={e => setBoardMessage(e.target.value)}
                            maxLength={500}
                        />

                        {/* Image preview */}
                        {boardAttachmentPreview && (
                            <div className="mx-3 mb-2 rounded-lg overflow-hidden">
                                <img src={boardAttachmentPreview} className="w-full max-h-32 object-cover" alt="preview" />
                            </div>
                        )}

                        {/* File attachment chip (non-image) */}
                        {boardAttachmentFile && !boardAttachmentPreview && (
                            <div className="mx-3 mb-2 flex items-center gap-2 bg-stone-100 rounded-lg px-2.5 py-1.5">
                                <Paperclip size={13} className="text-stone-500 flex-shrink-0" />
                                <span className="text-[11px] text-stone-700 font-medium truncate flex-1">{boardAttachmentFile.name}</span>
                                <button onClick={() => { setBoardAttachmentFile(null); setBoardAttachmentPreview(null); }} className="text-stone-400 hover:text-stone-600"><X size={11} /></button>
                            </div>
                        )}

                        {/* Bottom toolbar */}
                        <div className="flex items-center justify-between px-3 pb-3 pt-1 border-t border-stone-100/60">
                            <div className="flex items-center gap-2">
                                {/* Attach button — visible */}
                                <input
                                    ref={boardAttachmentInputRef}
                                    type="file"
                                    accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                                    className="hidden"
                                    onChange={e => {
                                        const file = e.target.files?.[0] ?? null;
                                        setBoardAttachmentFile(file);
                                        if (file && file.type.startsWith('image/')) {
                                            const reader = new FileReader();
                                            reader.onload = ev => setBoardAttachmentPreview(ev.target?.result as string);
                                            reader.readAsDataURL(file);
                                        } else {
                                            setBoardAttachmentPreview(null);
                                        }
                                        e.target.value = '';
                                    }}
                                />
                                <button
                                    onClick={() => boardAttachmentInputRef.current?.click()}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${boardAttachmentFile ? 'bg-indigo-100 text-indigo-700' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                                >
                                    <Paperclip size={14} /> {boardAttachmentFile ? 'Change' : 'Attach'}
                                </button>
                            </div>
                            <span className={`text-[10px] font-medium ${boardMessage.length > 450 ? 'text-red-400' : 'text-stone-300'}`}>{boardMessage.length}/500</span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 px-3 pb-3">
                            {/* Cancel */}
                            <button
                                onClick={() => { setIsComposing(false); setBoardMessage(''); setSelectedSticker(null); setIsPrivatePost(false); setBoardAttachmentFile(null); setBoardAttachmentPreview(null); }}
                                className="py-2 px-3 rounded-full border border-stone-300/80 text-stone-600 text-sm font-medium hover:bg-white/80 transition-colors bg-white/50"
                            >Cancel</button>

                            <span className="flex-1" />

                            {/* Privacy toggle */}
                            <button
                                onClick={() => setIsPrivatePost(p => !p)}
                                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity flex-shrink-0"
                            >
                                <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${isPrivatePost ? 'bg-stone-700' : 'bg-stone-300'}`}>
                                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${isPrivatePost ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                                </span>
                                <span className="flex items-center gap-1 text-xs font-semibold text-stone-600">
                                    {isPrivatePost ? <Lock size={11} /> : <Globe size={11} />}
                                    {isPrivatePost ? 'Private' : 'Public'}
                                </span>
                            </button>

                            {/* Post button */}
                            <button
                                onClick={() => {
                                    if (isPrivatePost) {
                                        setGeneralMessage(boardMessage);
                                        if (boardAttachmentFile) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                setAttachments([{ url: reader.result as string, type: boardAttachmentFile.type.startsWith('image/') ? 'IMAGE' : 'FILE', name: boardAttachmentFile.name }]);
                                                setIsComposing(false);
                                                setStep('payment');
                                                setIsModalOpen(true);
                                            };
                                            reader.readAsDataURL(boardAttachmentFile);
                                        } else {
                                            setIsComposing(false);
                                            setStep('payment');
                                            setIsModalOpen(true);
                                        }
                                    } else {
                                        handleBoardPost();
                                    }
                                }}
                                disabled={!boardMessage.trim() || isBoardSubmitting}
                                className="py-2 px-4 rounded-full text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 bg-stone-900 text-white hover:bg-stone-700"
                                style={creator.diemButtonColor && boardMessage.trim() ? { backgroundColor: creator.diemButtonColor, color: getContrastColor(creator.diemButtonColor) } : undefined}
                            >
                                {isBoardSubmitting
                                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <Send size={13} />}
                                Post
                            </button>
                        </div>
                    </div>
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
                  onClick={() => { setShowTutorial(false); onTutorialDone?.(); currentUser ? setIsComposing(true) : onLoginRequest('FAN'); }}
                  className="w-full mb-3 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-stone-900 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare size={15} /> Try Posting a Diem
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
