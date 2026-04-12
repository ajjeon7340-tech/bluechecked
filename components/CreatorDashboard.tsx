
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/config';
import { CreatorProfile, Message, DashboardStats, MonthlyStat, AffiliateLink, LinkSection, ProAnalyticsData, StatTimeFrame, DetailedStat, DetailedFinancialStat, CurrentUser } from '../types';
import { getMessages, getChatLines, invalidateChatLinesCache, replyToMessage, updateCreatorProfile, markMessageAsRead, cancelMessage, getHistoricalStats, getProAnalytics, getDetailedStatistics, getFinancialStatistics, DEFAULT_AVATAR, subscribeToMessages, uploadProductFile, uploadPremiumContent, editChatMessage, deleteChatLine, connectStripeAccount, getStripeConnectionStatus, requestWithdrawal, getWithdrawalHistory, sendWelcomeMessage, sendSupportMessage, Withdrawal, isBackendConfigured, getBoardPosts, getPendingBoardPosts, replyToBoardPost, deleteBoardPost, updateBoardPostVisibility, pinBoardPost, markBoardPostAsAddedToChat, updateBoardNoteColor, updateBoardPostPosition, updateBoardPostSize, promoteMessageToBoardPost, uploadBoardAttachment, BoardPost} from '../services/realBackend';
import { generateReplyDraft } from '../services/geminiService';
import { LanguageSwitcher } from './LanguageSwitcher';
import {
  Clock, CheckCircle2, AlertCircle, DollarSign, Sparkles, ChevronLeft, LogOut,
  ExternalLink, User, Settings, Plus, Trash, X, Camera, Paperclip, Send, DiemLogo,
  Home, BarChart3, Wallet, Users, Bell, Search, Menu, ChevronDown, ChevronUp, Ban, Check,
  Heart, Star, Eye, TrendingUp, MessageSquare, ArrowRight, Lock,
  InstagramLogo, Twitter, Youtube, Twitch, Music2, TikTokLogo, XLogo, YouTubeLogo, Download, ShoppingBag, FileText, PieChart as PieIcon, LayoutGrid, MonitorPlay, Link as LinkIcon, Calendar, ChevronRight, Coins, CreditCard,
  MousePointerClick, GripVertical, Smile, Pencil, RefreshCw, Verified,
  LinkedInLogo, FacebookLogo, SnapchatLogo, PinterestLogo, DiscordLogo, TelegramLogo,
  WhatsAppLogo, RedditLogo, ThreadsLogo, PatreonLogo, SpotifyLogo, SoundCloudLogo,
  GitHubLogo, SubstackLogo, BeehiivLogo, OnlyFansLogo,
} from './Icons';
import { Button } from './Button';
import { Globe, Trash2, Loader2, Pin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, PieChart, Pie, Cell, Legend, ComposedChart, Line } from 'recharts';

interface Props {
  creator: CreatorProfile;
  currentUser: CurrentUser | null;
  onLogout: () => void;
  onViewProfile: () => void;
  onRefreshData: () => Promise<void>;
}

type DashboardView = 'OVERVIEW' | 'INBOX' | 'BOARD' | 'FINANCE' | 'ANALYTICS' | 'STATISTICS' | 'SETTINGS' | 'NOTIFICATIONS' | 'REVIEWS' | 'SUPPORT';
type InboxFilter = 'ALL' | 'PENDING' | 'REPLIED' | 'REJECTED';

const SUPPORTED_PLATFORMS = [
    { id: 'youtube',   label: 'YouTube',   icon: YouTubeLogo },
    { id: 'instagram', label: 'Instagram', icon: InstagramLogo },
    { id: 'tiktok',   label: 'TikTok',    icon: TikTokLogo },
    { id: 'x',        label: 'X',         icon: XLogo },
    { id: 'threads',  label: 'Threads',   icon: ThreadsLogo },
    { id: 'facebook', label: 'Facebook',  icon: FacebookLogo },
    { id: 'twitch',   label: 'Twitch',    icon: Twitch },
    { id: 'discord',  label: 'Discord',   icon: DiscordLogo },
    { id: 'linkedin', label: 'LinkedIn',  icon: LinkedInLogo },
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

const getContrastColor = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#1c1917' : '#ffffff';
};

const getPreviewPlatformIcon = (platform: string) => {
    const cls = "w-4 h-4";
    switch (platform.toLowerCase()) {
        case 'youtube':    return <YouTubeLogo className={`${cls} text-[#FF0000]`} />;
        case 'instagram':  return <InstagramLogo className={`${cls} text-[#E4405F]`} />;
        case 'x':          return <XLogo className="w-3.5 h-3.5 text-black" />;
        case 'tiktok':     return <TikTokLogo className="w-3.5 h-3.5 text-black" />;
        case 'twitch':     return <Twitch size={16} className="text-[#9146FF]" />;
        case 'threads':    return <ThreadsLogo className={`${cls} text-black`} />;
        case 'facebook':   return <FacebookLogo className={`${cls} text-[#1877F2]`} />;
        case 'discord':    return <DiscordLogo className={`${cls} text-[#5865F2]`} />;
        case 'linkedin':   return <LinkedInLogo className="w-3.5 h-3.5 text-[#0A66C2]" />;
        case 'snapchat':   return <SnapchatLogo className="w-3.5 h-3.5 text-[#FFFC00]" />;
        case 'pinterest':  return <PinterestLogo className={`${cls} text-[#E60023]`} />;
        case 'reddit':     return <RedditLogo className={`${cls} text-[#FF4500]`} />;
        case 'telegram':   return <TelegramLogo className={`${cls} text-[#26A5E4]`} />;
        case 'whatsapp':   return <WhatsAppLogo className={`${cls} text-[#25D366]`} />;
        case 'spotify':    return <SpotifyLogo className={`${cls} text-[#1DB954]`} />;
        case 'soundcloud': return <SoundCloudLogo className={`${cls} text-[#FF5500]`} />;
        case 'patreon':    return <PatreonLogo className="w-3.5 h-3.5 text-[#FF424D]" />;
        case 'onlyfans':   return <OnlyFansLogo className={`${cls} text-[#00AFF0]`} />;
        case 'substack':   return <SubstackLogo className="w-3.5 h-3.5 text-[#FF6719]" />;
        case 'beehiiv':    return <BeehiivLogo className="w-3.5 h-3.5 text-[#F5C518]" />;
        case 'github':     return <GitHubLogo className="w-3.5 h-3.5 text-black" />;
        default:           return <Sparkles size={14} className="text-stone-400" />;
    }
};

const PLATFORM_DOMAINS_PREVIEW: { pattern: RegExp; id: string }[] = [
    { pattern: /youtube\.com|youtu\.be/, id: 'youtube' },
    { pattern: /instagram\.com/, id: 'instagram' },
    { pattern: /tiktok\.com/, id: 'tiktok' },
    { pattern: /x\.com|twitter\.com/, id: 'x' },
    { pattern: /threads\.net/, id: 'threads' },
    { pattern: /facebook\.com|fb\.com/, id: 'facebook' },
    { pattern: /twitch\.tv/, id: 'twitch' },
    { pattern: /discord\.com|discord\.gg/, id: 'discord' },
    { pattern: /linkedin\.com/, id: 'linkedin' },
    { pattern: /t\.me|telegram\.me/, id: 'telegram' },
    { pattern: /wa\.me|whatsapp\.com/, id: 'whatsapp' },
    { pattern: /open\.spotify\.com|spotify\.com/, id: 'spotify' },
    { pattern: /soundcloud\.com/, id: 'soundcloud' },
    { pattern: /patreon\.com/, id: 'patreon' },
    { pattern: /github\.com/, id: 'github' },
];

const isImage = (url: string) => {
    if (!url) return false;
    if (url.startsWith('data:image')) return true;
    const ext = url.split('.').pop()?.split('?')[0].toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '');
};

const getXXSWidth = (title?: string) => Math.min(220, Math.max(110, 80 + (title?.length || 0) * 8.5));
const getSWidth = (title?: string) => Math.min(220, Math.max(110, 80 + (title?.length || 0) * 8.5));
// Wide-mode: base(icon 28 + gap 10 + padding 24 = 62) + per-char width (CJK chars are ~13px, spaces 4px, ASCII ~7.5px)
const getWideWidth = (title?: string) => {
    if (!title) return 160;
    let charW = 0;
    for (const ch of title) {
        const code = ch.codePointAt(0) || 0;
        if (code >= 0x1100) { charW += 13; } // Korean, CJK, and other wide chars
        else if (ch === ' ') { charW += 4; }
        else { charW += 7.5; }
    }
    return Math.min(220, Math.max(110, Math.ceil(62 + charW)));
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

const ProfilePreviewCard: React.FC<{ creator: CreatorProfile; compact?: boolean }> = ({ creator, compact = false }) => {
    const cornerRadius = { soft: '8px', rounded: '16px', pill: '999px' }[creator.cornerRadius || 'rounded'] || '16px';
    const cardRadius = { soft: '8px', rounded: '16px', pill: '24px' }[creator.cornerRadius || 'rounded'] || '16px';
    const linkBg = creator.bannerGradient
        ? { backgroundColor: creator.bannerGradient, borderColor: creator.bannerGradient === '#1c1917' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }
        : { backgroundColor: '#ffffff', borderColor: 'rgb(231 229 228 / 0.6)' };
    const linkBlockStyle = { ...linkBg, borderRadius: cornerRadius };

    const platforms = creator.platforms || [];
    const visibleLinks = (creator.links || []).filter(l => l.id !== '__diem_config__' && !l.hidden);
    const ds = creator.diemIconShape;
    const dsc = ds === 'square' ? 'rounded-none' : ds === 'rounded' ? 'rounded-xl' : 'rounded-full';
    const sz = compact ? 'text-xs' : 'text-sm';

    return (
        <div className="bg-[#FAF9F6] rounded-xl overflow-hidden">
            {/* Main profile card */}
            <div className="border border-stone-200/60 relative overflow-hidden" style={{ backgroundColor: creator.bannerGradient || '#ffffff', borderRadius: cardRadius }}>
                    <div className="absolute top-3 left-3 z-30">
                        <DiemLogo size={compact ? 16 : 18} className={creator.bannerDesign && creator.bannerPhotoUrl ? 'text-white' : 'text-stone-800'} />
                    </div>
                    <div className="absolute top-3 right-3 z-30">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${creator.bannerDesign && creator.bannerPhotoUrl ? 'bg-black/30' : 'bg-stone-100'}`}>
                            <ExternalLink size={10} className={creator.bannerDesign && creator.bannerPhotoUrl ? 'text-white' : 'text-stone-400'} />
                        </div>
                    </div>
                    {/* Banner photo */}
                    {creator.bannerDesign && creator.bannerPhotoUrl ? (
                        <div className={`w-full ${compact ? 'h-16' : 'h-24'} relative`}>
                            <img src={creator.bannerPhotoUrl} alt="Banner" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/20" />
                        </div>
                    ) : (
                        <div className={`w-full ${compact ? 'h-10' : 'h-14'}`} />
                    )}
            </div>

            {/* Post a Diem CTA */}
            {creator.diemEnabled !== false && (
                <div className="mt-2 mx-0">
                    <div className="relative overflow-hidden rounded-2xl border border-stone-200/60 py-3 px-3"
                        style={{
                            background: 'linear-gradient(135deg, #FAFAF9 0%, #F5F3F0 100%)',
                            backgroundImage: 'linear-gradient(rgba(168,162,158,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(168,162,158,0.08) 1px, transparent 1px)',
                            backgroundSize: '24px 24px',
                        }}>
                        <p className={`${compact ? 'text-[8px]' : 'text-[9px]'} font-bold text-stone-400 uppercase tracking-widest mb-1`}>Ask me anything</p>
                        <p className={`font-semibold text-stone-900 ${compact ? 'text-[10px]' : sz} mb-2`}>Post a Diem</p>
                        <div className={`inline-flex items-center gap-1 bg-stone-900 text-white rounded-full font-semibold ${compact ? 'px-3 py-1 text-[9px]' : 'px-4 py-1.5 text-[10px]'}`}
                            style={creator.diemButtonColor ? { backgroundColor: creator.diemButtonColor, color: getContrastColor(creator.diemButtonColor) } : undefined}>
                            <MessageSquare size={compact ? 9 : 10} /> Post
                        </div>
                    </div>
                </div>
            )}

            {/* Links: Products as cards, support + external as rows */}
            {visibleLinks.length > 0 && (
                <div className="mt-2 space-y-1.5">
                    <p className={`${compact ? 'text-[8px]' : 'text-[9px]'} font-bold text-stone-400 uppercase tracking-widest text-center flex items-center justify-center gap-1`}>
                        <span>⌗</span> {creator.linksSectionTitle || 'Featured Links & Products'}
                    </p>
                    {/* Products: mini card grid */}
                    {visibleLinks.filter(l => l.type === 'DIGITAL_PRODUCT').slice(0, compact ? 2 : 4).length > 0 && (
                        <div className={`grid gap-1.5 ${visibleLinks.filter(l => l.type === 'DIGITAL_PRODUCT').length >= 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {visibleLinks.filter(l => l.type === 'DIGITAL_PRODUCT').slice(0, compact ? 2 : 4).map(link => {
                                const isEmoji = link.thumbnailUrl?.startsWith('data:emoji,');
                                const hasThumbnail = !!link.thumbnailUrl && !isEmoji;
                                const accentColor = link.buttonColor;
                                const btnStyle = accentColor ? { backgroundColor: accentColor, color: getContrastColor(accentColor) } : undefined;
                                return (
                                    <div key={link.id} className="rounded-xl border border-stone-200/60 bg-white overflow-hidden">
                                        <div className={`${compact ? 'h-10' : 'h-12'} bg-stone-50 flex items-center justify-center overflow-hidden`}>
                                            {hasThumbnail ? <img src={link.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                                            : isEmoji ? <span className={compact ? 'text-xl' : 'text-2xl'}>{link.thumbnailUrl!.replace('data:emoji,', '')}</span>
                                            : <FileText size={compact ? 14 : 16} className="text-stone-300" />}
                                        </div>
                                        <div className="p-1.5">
                                            <p className={`font-semibold text-stone-900 truncate ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{link.title}</p>
                                            <div className="flex items-center justify-between mt-1 gap-1">
                                                {link.price ? <span className={`${compact ? 'text-[8px]' : 'text-[9px]'} font-bold text-stone-600`}>{link.price}cr</span> : <span />}
                                                <span className={`${compact ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-0.5 text-[9px]'} rounded font-semibold flex-shrink-0 ${!btnStyle ? 'bg-stone-900 text-white' : ''}`} style={btnStyle}>Buy</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {/* Support + external links as rows */}
                    {visibleLinks.filter(l => l.type !== 'DIGITAL_PRODUCT').slice(0, compact ? 3 : 4).map(link => {
                        const isSupport = link.type === 'SUPPORT';
                        const isEmoji = link.thumbnailUrl?.startsWith('data:emoji,');
                        const hasThumbnail = !!link.thumbnailUrl && !isEmoji;
                        const shapeClass = link.iconShape === 'circle' ? 'rounded-full' : link.iconShape === 'rounded' ? 'rounded-xl' : 'rounded-none';
                        const accentColor = link.buttonColor;
                        const iconStyle = accentColor && !hasThumbnail ? { backgroundColor: `${accentColor}22`, color: accentColor } : undefined;
                        const btnStyle = accentColor ? { backgroundColor: accentColor, color: getContrastColor(accentColor) } : undefined;
                        let detectedPlatform: string | null = null;
                        let faviconUrl: string | null = null;
                        if (!link.thumbnailUrl && !isSupport && link.url) {
                            try {
                                const hostname = new URL(link.url.startsWith('http') ? link.url : `https://${link.url}`).hostname;
                                detectedPlatform = PLATFORM_DOMAINS_PREVIEW.find(p => p.pattern.test(hostname))?.id || null;
                                if (!detectedPlatform) faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
                            } catch { /* invalid url */ }
                        }
                        return (
                            <div key={link.id} className={`p-2.5 rounded-2xl border flex items-center gap-2 ${isSupport ? 'bg-gradient-to-r from-pink-50/40 to-rose-50/20 border-pink-100' : ''}`}
                                style={!isSupport ? linkBlockStyle : undefined}>
                                <div className={`${compact ? 'w-7 h-7' : 'w-8 h-8'} flex items-center justify-center flex-shrink-0 ${shapeClass} ${hasThumbnail ? 'overflow-hidden border border-stone-100' : isEmoji ? 'bg-stone-100' : isSupport ? 'bg-pink-50 text-pink-400' : detectedPlatform ? 'bg-stone-100' : faviconUrl ? 'overflow-hidden bg-white border border-stone-100' : 'bg-stone-900 text-white'}`} style={iconStyle}>
                                    {hasThumbnail ? <img src={link.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                                    : isEmoji ? <span className={compact ? 'text-sm' : 'text-base'}>{link.thumbnailUrl!.replace('data:emoji,', '')}</span>
                                    : isSupport ? <Heart size={compact ? 14 : 16} />
                                    : detectedPlatform ? getPreviewPlatformIcon(detectedPlatform)
                                    : faviconUrl ? <img src={faviconUrl} className="w-full h-full object-cover" alt="" />
                                    : <Sparkles size={compact ? 12 : 14} />}
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <p className={`font-semibold text-stone-900 truncate ${compact ? 'text-[10px]' : sz}`}>{link.title}</p>
                                    <p className={`${compact ? 'text-[8px]' : 'text-[9px]'} text-stone-400 mt-0.5`}>{isSupport ? 'Send tip' : 'External link'}</p>
                                </div>
                                <div className={`${compact ? 'px-2 py-1 text-[9px]' : 'px-2.5 py-1 text-[10px]'} rounded-xl font-semibold flex-shrink-0 whitespace-nowrap ${!btnStyle ? 'bg-stone-100 text-stone-600' : ''}`} style={btnStyle}>
                                    {isSupport ? 'Tip' : 'Open'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export const CreatorDashboard: React.FC<Props> = ({ creator, currentUser, onLogout, onViewProfile, onRefreshData }) => {
  const { t } = useTranslation();
  const [currentView, setCurrentView] = useState<DashboardView>(() => {
      const path = window.location.pathname;
      if (path.startsWith('/dashboard/')) {
          const view = path.split('/')[2].toUpperCase();
          if (['INBOX', 'BOARD', 'FINANCE', 'ANALYTICS', 'STATISTICS', 'SETTINGS', 'NOTIFICATIONS', 'REVIEWS', 'SUPPORT'].includes(view)) {
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

  // Board State
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardFilter, setBoardFilter] = useState<'ALL' | 'PENDING' | 'LINKS'>('ALL');
  const [boardFocusModeOpen, setBoardFocusModeOpen] = useState(false);
  // Single anchor = top-left of the viewport in DiemBoard canvas coords (CREATOR_CARD_ZONE included)
  const [boardFocusAnchor, setBoardFocusAnchor] = useState<{ x: number; y: number }>({ x: 0, y: 300 });
  const [boardLinkEditId, setBoardLinkEditId] = useState<string | null>(null);
  const [boardAddingLink, setBoardAddingLink] = useState(false);
  const [boardAddingProduct, setBoardAddingProduct] = useState(false);
  const [boardAddingSupport, setBoardAddingSupport] = useState(false);
  const [boardAddingPhoto, setBoardAddingPhoto] = useState(false);
  const [boardAddingPanel, setBoardAddingPanel] = useState(false);
  const [boardPanelDraft, setBoardPanelDraft] = useState({ label: '', style: 'light' as 'light' | 'dark' | 'warm' });
  const [boardSelectedPlatform, setBoardSelectedPlatform] = useState<string | null>(null);
  const [boardPlatformUrlDraft, setBoardPlatformUrlDraft] = useState('');
  const [boardPhotoDraft, setBoardPhotoDraft] = useState<{ file: File | null; previewUrl: string | null; isUploading: boolean }>({ file: null, previewUrl: null, isUploading: false });
  const [boardLinkSizes, setBoardLinkSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [boardLinkResizing, setBoardLinkResizing] = useState<{ id: string; startMouseX: number; startMouseY: number; startW: number; startH: number; flipX?: boolean } | null>(null);
  const [boardPhotoEditId, setBoardPhotoEditId] = useState<string | null>(null);
  const [mobileAddMenuOpen, setMobileAddMenuOpen] = useState(false);

  const _closeAllBoardAdding = () => {
    setBoardAddingLink(false);
    setBoardAddingProduct(false);
    setBoardAddingSupport(false);
    setBoardAddingPhoto(false);
    setBoardAddingPanel(false);
    setBoardSelectedPlatform(null);
    setBoardPlatformUrlDraft('');
    setBoardChatPickerOpen(false);
    setBoardLinkDraft({ title: '', url: '', price: '', type: 'EXTERNAL', color: undefined });
    setBoardPhotoDraft({ file: null, previewUrl: null, isUploading: false });
    setMobileAddMenuOpen(false);
  };
  const [boardLinkDraft, setBoardLinkDraft] = useState<{ title: string; url: string; price: string; type: 'EXTERNAL' | 'DIGITAL_PRODUCT' | 'SUPPORT'; color?: string; thumbnailUrl?: string; displayStyle?: 'icon' | 'thumbnail' }>({ title: '', url: '', price: '', type: 'EXTERNAL' });
  const [boardReplyDraft, setBoardReplyDraft] = useState<Record<string, string>>({});
  const [boardReplyingId, setBoardReplyingId] = useState<string | null>(null);
  const [boardReplyAttachmentFile, setBoardReplyAttachmentFile] = useState<File | null>(null);
  const [boardReplyAttachmentPreview, setBoardReplyAttachmentPreview] = useState<string | null>(null);
  const boardReplyAttachmentInputRef = useRef<HTMLInputElement>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [boardPopupPost, setBoardPopupPost] = useState<BoardPost | null>(null);
  const [inboxSelectedPostId, setInboxSelectedPostId] = useState<string | null>(null);
  const [inboxBoardFilter, setInboxBoardFilter] = useState<'ALL' | 'PUBLIC' | 'PRIVATE' | 'PENDING' | 'ANSWERED'>('ALL');
  const [boardPositions, setBoardPositions] = useState<Record<string, {x: number, y: number}>>({});
  const [boardPostSizes, setBoardPostSizes] = useState<Record<string, 'S' | 'M' | 'L'>>({});
  const [boardDragging, setBoardDragging] = useState<{
      id: string;
      startMouseX: number;
      startMouseY: number;
      startNoteX: number;
      startNoteY: number;
  } | null>(null);
  const [boardChatPickerOpen, setBoardChatPickerOpen] = useState(false);
  const [boardLinkPositions, setBoardLinkPositions] = useState<Record<string, {x: number, y: number}>>({});
  const [linkZOrder, setLinkZOrder] = useState<string[]>([]);
  const [boardLinkDragging, setBoardLinkDragging] = useState<{
      id: string;
      startMouseX: number;
      startMouseY: number;
      startNoteX: number;
      startNoteY: number;
  } | null>(null);
  const boardCanvasRef = useRef<HTMLDivElement>(null);
  const boardScrollContainerRef = useRef<HTMLDivElement>(null);
  const [boardViewportW, setBoardViewportW] = useState(0);
  const [boardViewportH, setBoardViewportH] = useState(0);

  // Long Press Drag State (Mobile)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{x: number, y: number} | null>(null);

  // Pending drag: activated only after mouse moves > threshold to avoid accidental drags during scroll
  const pendingDragRef = useRef<{ id: string; startMouseX: number; startMouseY: number; startNoteX: number; startNoteY: number } | null>(null);
  const pendingLinkDragRef = useRef<{ id: string; startMouseX: number; startMouseY: number; startNoteX: number; startNoteY: number } | null>(null);
  const DRAG_THRESHOLD = 6;

  // Infinite canvas camera (pan + zoom) for the board
  const [dashCamera, setDashCamera] = useState<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });
  const [dashCamTransition, setDashCamTransition] = useState('none');
  const dashPanRef = useRef<{ startX: number; startY: number; camX: number; camY: number } | null>(null);
  const dashCamInitRef = useRef(false);

  useEffect(() => {
      const preventDefault = (e: TouchEvent) => { if (boardDragging || boardLinkDragging) e.preventDefault(); };
      // Block native mobile scrolling actively while dragging a sticker
      document.addEventListener('touchmove', preventDefault, { passive: false, capture: true });
      return () => document.removeEventListener('touchmove', preventDefault, { capture: true });
  }, [boardDragging, boardLinkDragging]);

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
  const [pendingNavigateView, setPendingNavigateView] = useState<DashboardView | null>(null);
  
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
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  // Premium State
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
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
  const [diemIconPickerOpen, setDiemIconPickerOpen] = useState(false);

  // Section State
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');
  const [newLinkSectionId, setNewLinkSectionId] = useState('');

  // Settings text tab state
  const [settingsTextTab, setSettingsTextTab] = useState<'bio' | 'instructions' | 'reply'>('bio');
  const [settingsMainTab, setSettingsMainTab] = useState<'general' | 'style'>('general');

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
  // Tracks links that were intentionally changed (delete/add/reorder) so that onRefreshData
  // does not restore deleted links via the useEffect([creator]) below.
  const pendingLinksRef = useRef<AffiliateLink[] | null>(null);
  const [, setInboxTutorialScrollTick] = useState(0);

  const TUTORIAL_STEPS = [
    { title: 'Profile Photo', desc: 'Add a profile photo so fans know who they\'re talking to. Tap "Upload" to choose one from your device — a clear, friendly photo works best!', tab: null, highlight: 'avatar' },
    { title: 'Your Status Message', desc: 'This appears on your public profile — it\'s the first thing fans see when they visit your page. Make it personal!', tab: 'bio' as const, highlight: 'bio' },
    { title: 'Request Instructions', desc: 'Shown to fans before they send you a Diem request. Guide them on what context to include so you can give the best answer.', tab: 'instructions' as const, highlight: 'instructions' },
    { title: 'Auto-Reply Message', desc: 'Sent automatically the moment a fan pays — a warm acknowledgment while you prepare your response.', tab: 'reply' as const, highlight: 'reply' },
    { title: 'Links & Products', desc: 'Switch to the Links tab to add links to your social profiles, website, or resources. You can also upload digital products fans can purchase directly.', tab: null, highlight: 'links' },
    { title: 'Custom Sections', desc: 'Still in the Links tab — group your links under named sections like "My Work" or "Resources". Type a section name and hit Add to create one.', tab: null, highlight: 'sections' },
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
              if (['INBOX', 'BOARD', 'FINANCE', 'ANALYTICS', 'STATISTICS', 'SETTINGS', 'NOTIFICATIONS', 'REVIEWS', 'SUPPORT'].includes(view)) {
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
    if (nextStep === 4 || nextStep === 5) setSettingsMainTab('links');
    if (nextStep === 4) setTimeout(() => tutorialLinksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    if (nextStep === 5) setTimeout(() => tutorialSectionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
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
    } else if (currentView === 'BOARD') {
        setBoardLoading(true);
        getBoardPosts(creator.id).then(posts => {
            setBoardPosts(posts);
            setBoardLoading(false);
        });
        // Scroll handled by the boardViewportH effect below
    }
  }, [currentView, statsTimeFrame, statsDate]);

  useEffect(() => {
    if (pendingLinksRef.current !== null) {
      // A board link change is in-flight; keep the intended links, sync everything else from backend.
      setEditedCreator({ ...creator, links: pendingLinksRef.current });
      pendingLinksRef.current = null;
    } else {
      setEditedCreator(creator);
    }
  }, [creator]);

  // Measure board canvas viewport and scroll to center the guide whenever the board mounts
  useEffect(() => {
    if (currentView !== 'BOARD') return;
    const el = boardScrollContainerRef.current;
    if (!el) return;
    const measure = () => {
      setBoardViewportW(el.offsetWidth);
      setBoardViewportH(el.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [currentView]);

  // Reset camera init flag when leaving / re-entering the board view
  useEffect(() => {
    if (currentView !== 'BOARD') { dashCamInitRef.current = false; }
  }, [currentView]);

  // Init camera: eagle-eye → focus animation once viewport dimensions are known
  useEffect(() => {
    if (boardViewportW === 0 || boardViewportH === 0 || dashCamInitRef.current) return;
    dashCamInitRef.current = true;

    const GUIDE_DESKTOP_W = 640, GUIDE_H = 440;
    const gX = Math.max(0, (boardViewportW - GUIDE_DESKTOP_W) / 2);
    const gY = Math.max(0, (boardViewportH - GUIDE_H) / 2);

    // Compute content bounding box from saved positions
    const links = (editedCreator?.links || []).filter((l: AffiliateLink) => l.id !== '__diem_config__' && !l.hidden);
    const posts = boardPosts.filter(p => p.isPinned);
    let minX = gX, maxX = gX + GUIDE_DESKTOP_W;
    let minY = gY, maxY = gY + GUIDE_H;
    links.forEach(l => {
        if (l.positionX != null) { minX = Math.min(minX, l.positionX + gX); maxX = Math.max(maxX, l.positionX + gX + 220); }
        if (l.positionY != null) { minY = Math.min(minY, l.positionY + gY); maxY = Math.max(maxY, l.positionY + gY + 80); }
    });
    posts.forEach(p => {
        if (p.positionX != null) { minX = Math.min(minX, p.positionX + gX); maxX = Math.max(maxX, p.positionX + gX + 252); }
        if (p.positionY != null) { minY = Math.min(minY, p.positionY + gY); maxY = Math.max(maxY, p.positionY + gY + 272); }
    });

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const contentW = maxX - minX + 80;
    const contentH = maxY - minY + 80;

    // Eagle-eye: fit all content
    const eagleZoom = Math.min(boardViewportW / contentW, boardViewportH / contentH, 0.9);
    setDashCamTransition('none');
    setDashCamera({ x: cx, y: cy, zoom: eagleZoom });

    // Animate to focus (zoom=1, same center)
    const t = setTimeout(() => {
        setDashCamTransition('transform 0.85s cubic-bezier(0.25, 0.46, 0.45, 0.94)');
        setDashCamera({ x: cx, y: cy, zoom: 1 });
        setTimeout(() => setDashCamTransition('none'), 950);
    }, 60);
    return () => clearTimeout(t);
  }, [boardViewportW, boardViewportH]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wheel handler for board pan / zoom (passive:false required to prevent page scroll)
  useEffect(() => {
    const el = boardScrollContainerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
        e.preventDefault();
        if (e.metaKey || e.altKey || e.ctrlKey) {
            const rect = el.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            setDashCamera(prev => {
                const newZoom = Math.min(3, Math.max(0.15, prev.zoom * factor));
                const wx = prev.x + (cx - el.clientWidth / 2) / prev.zoom;
                const wy = prev.y + (cy - el.clientHeight / 2) / prev.zoom;
                return { x: wx + (el.clientWidth / 2 - cx) / newZoom, y: wy + (el.clientHeight / 2 - cy) / newZoom, zoom: newZoom };
            });
        } else {
            setDashCamera(prev => ({ ...prev, x: prev.x + e.deltaX / prev.zoom, y: prev.y + e.deltaY / prev.zoom }));
        }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [currentView]); // re-attach when view changes (ref may be remounted)

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
    const threadMsgs = messages.filter(m =>
        (m.creatorId === creator.id && m.senderEmail === selectedSenderEmail) ||
        (m.senderEmail === currentUser?.email && (m.creatorEmail === selectedSenderEmail || m.creatorId === selectedSenderEmail))
    );
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
        const threadMsgs = msgs.filter(m => {
          if (m.content.startsWith('Purchased Product:') || m.content.startsWith('Fan Tip:')) return false;
          const isIncoming = m.creatorId === creator.id && m.senderEmail === openEmail;
          const isOutgoing = m.senderEmail === currentUser?.email && (m.creatorEmail === openEmail || m.creatorId === openEmail);
          return isIncoming || isOutgoing;
        });
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

  // Filter messages: incoming requests (where I am the creator) + outgoing messages I sent (e.g. welcome messages)
  const incomingMessages = useMemo(() => messages.filter(m => m.creatorId === creator.id || m.senderEmail === currentUser?.email), [messages, creator.id, currentUser?.email]);

  // Group messages by counterpart for Inbox List
  // For incoming messages (I am creator_id): group by sender
  // For outgoing messages (I am sender): group by recipient (creator)
  const conversationGroups = useMemo(() => {
      if (incomingMessages.length === 0) return [];

      const groups: Record<string, { senderEmail: string, senderName: string, latestMessage: Message, messageCount: number, sessionCount: number }> = {};

      incomingMessages.forEach(msg => {
          if (msg.content.startsWith('Purchased Product:')) return;
          if (msg.content.startsWith('Fan Tip:')) return;

          // For outgoing messages (I sent this), group by recipient email
          const isOutgoing = msg.senderEmail === currentUser?.email && msg.creatorId !== creator.id;
          const email = isOutgoing ? (msg.creatorEmail || msg.creatorId || 'unknown') : msg.senderEmail;
          const name = isOutgoing ? (msg.creatorName || 'User') : msg.senderName;
          if (!groups[email]) {
              groups[email] = { senderEmail: email, senderName: name, latestMessage: msg, messageCount: 0, sessionCount: 0 };
          }
          groups[email].sessionCount++;
          if (msg.status === 'PENDING' && !isOutgoing) groups[email].messageCount++;
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

    const pendingCount = messageOnly.filter(m => m.status === 'PENDING' && m.creatorId === creator.id).length;
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

  // Thread messages for the selected sender/recipient
  const threadMessages = useMemo(() => {
      if (!selectedSenderEmail) return [];
      const leftAt = leftChatrooms[selectedSenderEmail];
      return incomingMessages
          .filter(m => {
              if (m.content.startsWith('Purchased Product:') || m.content.startsWith('Fan Tip:')) return false;
              // Match by senderEmail (incoming) or creatorEmail/creatorId (outgoing admin messages)
              return m.senderEmail === selectedSenderEmail || (m.senderEmail === currentUser?.email && (m.creatorEmail === selectedSenderEmail || m.creatorId === selectedSenderEmail));
          })
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

    const isSupportMode = selectedSenderEmail === 'abe7340@gmail.com';

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
        const wasSessionClosed = activeMessage.status !== 'PENDING';
        await replyToMessage(activeMessage.id, replyText, isComplete, combinedAttachment);

        // If the session was already closed, a new one was created — jump to it
        if (wasSessionClosed) {
            setChatSessionIndex(Infinity);
        }

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

  const executeNavigate = (view: DashboardView) => {
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

  const handleNavigate = (view: DashboardView) => {
    if (hasUnsavedChanges() && view !== 'SETTINGS') {
      setPendingNavigateView(view);
      return;
    }
    executeNavigate(view);
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

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_W = 1200, MAX_H = 600;
              let { width, height } = img;
              if (width > MAX_W) { height = height * MAX_W / width; width = MAX_W; }
              if (height > MAX_H) { width = width * MAX_H / height; height = MAX_H; }
              canvas.width = width; canvas.height = height;
              canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              setEditedCreator(prev => ({ ...prev, bannerPhotoUrl: dataUrl }));
          };
          img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
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

  // Save link changes immediately from the board (auto-save without full profile form)
  const saveBoardLinkChange = async (updatedLinks: AffiliateLink[]) => {
      pendingLinksRef.current = updatedLinks;
      setEditedCreator(prev => ({ ...prev, links: updatedLinks }));
      try { await updateCreatorProfile({ ...editedCreator, links: updatedLinks }); } catch (e) { console.error('saveBoardLinkChange save failed', e); }
      try { await onRefreshData(); } catch (e) { console.error('saveBoardLinkChange refresh failed', e); }
  };

  const handleProductFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploadingProduct(true);
      try {
          const url = await uploadPremiumContent(file, creator.id);
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
          const url = await uploadPremiumContent(file, creator.id);
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
          const url = await uploadPremiumContent(file, creator.id);
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
          const url = await uploadPremiumContent(file, creator.id);
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
          return [...filtered].sort((a, b) => b.sessionCount - a.sessionCount);
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
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col font-sans text-stone-900 overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true" style={{
        backgroundImage: 'linear-gradient(to right, rgba(168,162,158,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(168,162,158,0.08) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 100%)',
      }} />
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
                <SidebarItem icon={LayoutGrid} label="Board" view="BOARD" badge={boardPosts.filter(p => !p.reply).length || undefined} />
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
        <div className={`flex-1 ${currentView === 'INBOX' ? 'overflow-hidden p-0' : currentView === 'BOARD' ? 'overflow-hidden p-0' : 'overflow-auto p-6'} relative`}>
            
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
                                            {tf === 'DAILY' ? t('creator.daily') : tf === 'WEEKLY' ? t('creator.weekly') : t('creator.monthly')}
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
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 animate-in fade-in zoom-in-95 duration-300">

                                {/* 1. Available Balance Card (primary) */}
                                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/60 hover:shadow-sm transition-all">
                                    <div className="flex items-center gap-2 mb-2 sm:mb-3">
                                        <div className="p-1.5 bg-emerald-50 text-emerald-500 rounded-lg"><Wallet size={14}/></div>
                                        <span className="text-[10px] sm:text-[11px] font-semibold text-stone-400 uppercase tracking-wider leading-tight">{t('creator.availableBalanceLabel')}</span>
                                    </div>
                                    {isLoading ? (
                                        <div className="flex items-center gap-2 text-stone-400">
                                            <RefreshCw size={14} className="animate-spin" />
                                            <span className="text-xs font-medium">{t('creator.calculatingBalance') || 'Calculating...'}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight flex items-baseline gap-1">
                                                {/* @ts-ignore */}
                                                {stats.availableBalance.toLocaleString()}
                                                <span className="text-xs sm:text-sm font-medium text-stone-400">{t('common.credits').toLowerCase()}</span>
                                            </div>
                                            <p className="text-[10px] sm:text-[11px] text-emerald-600 mt-1 sm:mt-1.5 font-medium">{t('creator.readyToPayout')}</p>
                                            {/* @ts-ignore */}
                                            {stats.holdEarnings > 0 && (
                                                <div className="mt-2 pt-2 border-t border-stone-100">
                                                    <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                                                        <span>⏳</span>
                                                        {/* @ts-ignore */}
                                                        {stats.holdEarnings.toLocaleString()} on hold
                                                    </p>
                                                    {/* @ts-ignore */}
                                                    {stats.nextReleaseAt && (
                                                        <p className="text-[9px] text-stone-400 mt-0.5">
                                                            {/* @ts-ignore */}
                                                            Releases: {new Date(stats.nextReleaseAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* 2. Lifetime Revenue Card */}
                                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/60 hover:shadow-sm transition-all">
                                    <div className="flex items-center gap-2 mb-2 sm:mb-3">
                                        <div className="p-1.5 bg-stone-100 text-stone-400 rounded-lg"><TrendingUp size={14}/></div>
                                        <span className="text-[10px] sm:text-[11px] font-semibold text-stone-400 uppercase tracking-wider leading-tight">{t('creator.lifetimeRevenue')}</span>
                                    </div>
                                    <div className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight flex items-baseline gap-1">
                                        {stats.totalEarnings.toLocaleString()}
                                        <span className="text-xs sm:text-sm font-medium text-stone-400">{t('common.credits').toLowerCase()}</span>
                                    </div>
                                    <p className="text-[10px] sm:text-[11px] text-emerald-600 mt-1 sm:mt-1.5 font-medium">{t('creator.approxUsd', { amount: (stats.totalEarnings / 100).toFixed(2) })}</p>
                                </div>

                                {/* 3. Withdraw Action Card */}
                                <div className="col-span-2 md:col-span-1 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/60 flex flex-col justify-center hover:shadow-sm transition-all">
                                    <div className="text-center">
                                        <p className="text-xs sm:text-sm font-semibold text-stone-600 mb-3 sm:mb-4">{t('creator.convertWithdraw')}</p>
                                        <Button
                                            onClick={handleWithdraw}
                                            isLoading={isWithdrawing}
                                            // @ts-ignore
                                            disabled={isLoading || stats.availableBalance === 0}
                                            fullWidth
                                            className="bg-stone-900 text-white hover:bg-stone-800 h-11 sm:h-12 shadow-md flex items-center justify-center gap-2"
                                        >
                                            <CreditCard size={16} />
                                            {isLoading
                                                ? (t('creator.loadingBalance') || 'Loading...')
                                                // @ts-ignore
                                                : t('creator.withdrawAmount', { amount: (stats.availableBalance / 100).toFixed(2) })
                                            }
                                        </Button>
                                        <p className="text-[10px] text-stone-400 mt-2 sm:mt-3 text-center">
                                            {t('creator.transferDays')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Payout Method (Stripe) */}
                            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isStripeConnected ? 'bg-green-100 text-green-600' : 'bg-stone-100 text-stone-500'}`}>
                                        {isStripeConnected ? <Check size={24} /> : <CreditCard size={24} />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-stone-900">{t('creator.payoutMethod')}</h3>
                                        <p className="text-sm text-stone-500">
                                            {isStripeConnected
                                                ? stripeLast4
                                                    ? t('creator.stripeConnectedLast4', { last4: stripeLast4 })
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
                                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-stone-100 flex items-center justify-between">
                                     <h3 className="text-sm font-bold text-stone-900">{t('creator.creditHistory')}</h3>
                                     <Button variant="ghost" size="sm" className="text-xs hidden sm:flex"><ExternalLink size={14} className="mr-1"/> {t('creator.exportCsv')}</Button>
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
                    <div className="flex flex-wrap justify-between items-center gap-3 mb-6 sm:mb-8">
                        <div className="flex items-center gap-2 min-w-0">
                            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0"><Menu size={24} /></button>
                            <div className="min-w-0">
                                <h2 className="text-xl sm:text-2xl font-bold text-stone-900 truncate">{t('creator.analyticsOverview')}</h2>
                                <p className="text-stone-500 text-xs sm:text-sm">{t('creator.performanceMetrics')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1">
                                {(['1D', '7D', '30D', 'ALL'] as const).map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setAnalyticsRange(r)}
                                        className={`px-2 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all ${analyticsRange === r ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                                    >
                                        {r === '1D' ? 'Today' : r === '7D' ? '7D' : r === '30D' ? '30D' : 'All'}
                                    </button>
                                ))}
                            </div>
                            <button className="hidden sm:block px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-600 shadow-sm hover:bg-stone-50">{t('creator.exportReport')}</button>
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

            {currentView === 'BOARD' && (
                <div className="h-full flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-[#F5F3EE]/95 backdrop-blur-sm border-b border-stone-200/60 px-4 sm:px-6 py-4">
                        <div className="flex items-center justify-between max-w-4xl mx-auto">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0"><Menu size={24} /></button>
                                <div>
                                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-0.5">Ask Me Anything</p>
                                    <h1 className="text-xl font-bold text-stone-900">Community Board</h1>
                                </div>
                            </div>
                            <TopNav hideBurger />
                        </div>
                        {/* Filter tabs */}
                        <div className="flex gap-2 mt-4 max-w-4xl mx-auto overflow-x-auto">
                            {(['ALL', 'PENDING', 'LINKS'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setBoardFilter(f)}
                                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${boardFilter === f ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'}`}
                                >
                                    {f === 'ALL' ? `Community Board (${boardPosts.filter(p => p.isPinned).length})` : f === 'PENDING' ? `From Chat (${boardPosts.filter(p => p.isAddedToChat && !p.isPinned).length})` : `Links (${(editedCreator.links || []).filter(l => l.id !== '__diem_config__' && !l.hidden).length})`}
                                </button>
                            ))}
                        </div>
                        {/* Focus Zone button */}
                        <div className="flex justify-end mt-2 max-w-4xl mx-auto">
                            <button
                                onClick={() => {
                                    const BOARD_MAX_H = 440, CREATOR_CARD_ZONE = 300, DESKTOP_VW = 640;
                                    const sd = editedCreator.boardFocusDesktop;
                                    if (sd) {
                                        setBoardFocusAnchor({ x: sd.x - 320, y: Math.max(CREATOR_CARD_ZONE, sd.y - BOARD_MAX_H / 2) });
                                    } else {
                                        // No saved focus — default to horizontally centered over content
                                        const BOARD_PAD = 32, NOTE_W = 252, NOTE_GAP_X = 28, GUIDE_COLS = 3, LINK_W = 220;
                                        const LINK_AUTO_X = BOARD_PAD + GUIDE_COLS * (NOTE_W + NOTE_GAP_X) + 32;
                                        const visLinks = (editedCreator.links || []).filter(l => l.id !== '__diem_config__' && !l.hidden);
                                        const maxLR = visLinks.reduce((m, l) => Math.max(m, (l.positionX ?? LINK_AUTO_X) + LINK_W), DESKTOP_VW);
                                        const cWest = Math.max(DESKTOP_VW, maxLR + 32);
                                        const defaultX = (cWest - DESKTOP_VW) / 2;
                                        setBoardFocusAnchor({ x: defaultX, y: CREATOR_CARD_ZONE });
                                    }
                                    setBoardFocusModeOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
                            >
                                <Eye size={12} /> Focus Zone
                            </button>
                        </div>
                    </div>

                    {/* Freeform corkboard canvas — infinite camera */}
                    <div
                        ref={boardScrollContainerRef}
                        className="relative flex-1 overflow-hidden"
                    >
                        {boardLoading ? (
                            <div className="flex items-center justify-center py-20 text-stone-400">
                                <Loader2 size={24} className="animate-spin" />
                            </div>
                        ) : (() => {
                            const visibleBoardLinks = (editedCreator.links || []).filter(l => l.id !== '__diem_config__' && !l.hidden);
                            const filtered = boardFilter === 'LINKS' ? [] : boardPosts.filter(p =>
                                boardFilter === 'PENDING' ? (p.isAddedToChat && !p.isPinned) : p.isPinned
                            ).sort((a, b) => {
                                if (a.displayOrder !== null && b.displayOrder !== null) return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
                                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                            });
                            const showLinks = boardFilter === 'ALL' || boardFilter === 'LINKS';
                            if (filtered.length === 0 && (boardFilter !== 'LINKS' ? visibleBoardLinks.length === 0 : visibleBoardLinks.length === 0)) return (
                                <div className="text-center py-20 text-stone-400">
                                    <div className="text-4xl mb-3">📋</div>
                                    <p className="text-sm font-medium">{boardFilter === 'PENDING' ? 'Nothing in From Chat yet' : boardFilter === 'LINKS' ? 'No links added yet' : 'No pinned posts yet'}</p>
                                </div>
                            );

                            const NOTE_W = 252;
                            const NOTE_H_EST = 272;
                            const NOTE_GAP_X = 28;
                            const getPostNoteSize = (p: BoardPost): 'S' | 'M' | 'L' => boardPostSizes[p.id] ?? p.noteSize ?? 'M';
                            const getPostH = (p: BoardPost) => { const s = getPostNoteSize(p); return s === 'S' ? 110 : s === 'M' ? 190 : NOTE_H_EST; };
                            const getPostW = (p: BoardPost) => { const s = getPostNoteSize(p); return s === 'S' ? 160 : s === 'M' ? 210 : NOTE_W; };
                            const NOTE_GAP_Y = 36;
                            const COLS = 3;
                            const stableIdx = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xFFFFFF; return Math.abs(h); };
                            const BOARD_PAD = 32;
                            const GUIDE_DESKTOP_W = 640;
                            const GUIDE_H = 440;
                            const guideOffsetX = Math.max(0, (boardViewportW - GUIDE_DESKTOP_W) / 2);
                            const guideOffsetY = Math.max(0, (boardViewportH - GUIDE_H) / 2);

                            // Compute positions: saved positions are fixed; unsaved use adjacent-slot finder
                            const DB_MARGIN = 8;
                            type _BP = { x: number; y: number };
                            const _bpOverlaps = (a: _BP, b: _BP) =>
                                Math.abs(a.x - b.x) < NOTE_W + DB_MARGIN &&
                                Math.abs(a.y - b.y) < NOTE_H_EST + DB_MARGIN;

                            // First pass: collect all saved positions
                            const savedPositions = new Map<string, _BP>();
                            filtered.forEach(p => {
                                if (boardPositions[p.id]) savedPositions.set(p.id, boardPositions[p.id]);
                                else if (p.positionX != null && p.positionY != null) savedPositions.set(p.id, { x: p.positionX + guideOffsetX, y: p.positionY + guideOffsetY });
                            });

                            // Max columns that fit inside the guide width (with padding)
                            const GUIDE_COLS = Math.max(1, Math.floor((GUIDE_DESKTOP_W - BOARD_PAD) / (NOTE_W + NOTE_GAP_X)));
                            // Max rows that fit inside the guide height (with padding)
                            const GUIDE_ROWS = Math.max(1, Math.floor((GUIDE_H - BOARD_PAD) / (NOTE_H_EST + NOTE_GAP_Y)));

                            // Second pass: assign positions for unsaved posts via adjacent-slot finder
                            const computedPositions = new Map<string, _BP>(savedPositions);
                            filtered.forEach((p, idx) => {
                                if (computedPositions.has(p.id)) return;
                                // Default grid slot — capped to guide columns so it never overflows right
                                const col = idx % GUIDE_COLS;
                                const row = Math.floor(idx / GUIDE_COLS);
                                const gridPos: _BP = {
                                    x: guideOffsetX + BOARD_PAD + col * (NOTE_W + NOTE_GAP_X),
                                    y: guideOffsetY + BOARD_PAD + row * (NOTE_H_EST + NOTE_GAP_Y),
                                };
                                const placed = Array.from(computedPositions.values());
                                if (!placed.some(op => _bpOverlaps(gridPos, op))) {
                                    computedPositions.set(p.id, gridPos);
                                    return;
                                }
                                // Find nearest non-colliding slot, preferring positions inside the guide
                                const gx = guideOffsetX + BOARD_PAD;
                                const gy = guideOffsetY + BOARD_PAD;
                                // Sort: Y-closeness to guide first, then X-closeness
                                const distToGuide = (c: _BP) => Math.abs(c.y - gy) * 10000 + Math.abs(c.x - gx);
                                // Seed candidates: every slot within the guide boundary
                                const cands: _BP[] = [];
                                for (let r = 0; r < GUIDE_ROWS; r++) {
                                    for (let cl = 0; cl < GUIDE_COLS; cl++) {
                                        cands.push({ x: guideOffsetX + BOARD_PAD + cl * (NOTE_W + NOTE_GAP_X), y: guideOffsetY + BOARD_PAD + r * (NOTE_H_EST + NOTE_GAP_Y) });
                                    }
                                }
                                // Overflow candidates: below the guide, column-aligned
                                for (let r = GUIDE_ROWS; r < GUIDE_ROWS + 10; r++) {
                                    for (let cl = 0; cl < GUIDE_COLS; cl++) {
                                        cands.push({ x: guideOffsetX + BOARD_PAD + cl * (NOTE_W + NOTE_GAP_X), y: guideOffsetY + BOARD_PAD + r * (NOTE_H_EST + NOTE_GAP_Y) });
                                    }
                                }
                                // Also add adjacency candidates from placed posts as a last resort
                                for (const op of placed) {
                                    cands.push({ x: op.x + NOTE_W + DB_MARGIN, y: op.y });
                                    cands.push({ x: op.x, y: op.y + NOTE_H_EST + DB_MARGIN });
                                    cands.push({ x: op.x - NOTE_W - DB_MARGIN, y: op.y });
                                    cands.push({ x: op.x, y: op.y - NOTE_H_EST - DB_MARGIN });
                                }
                                cands.sort((a, b) => distToGuide(a) - distToGuide(b));
                                for (const c of cands) {
                                    if (c.x < 0 || c.y < 0) continue;
                                    if (!placed.some(op => _bpOverlaps(c, op))) {
                                        computedPositions.set(p.id, c);
                                        return;
                                    }
                                }
                                computedPositions.set(p.id, gridPos); // fallback
                            });

                            const getPos = (post: BoardPost, _idx: number): _BP =>
                                computedPositions.get(post.id) ?? { x: guideOffsetX + BOARD_PAD, y: guideOffsetY + BOARD_PAD };

                            // Extra buffer during drag so canvas always extends below the dragged card
                            const dragBuffer = boardDragging ? 500 : 160;
                            const maxY = filtered.reduce((max, post, idx) => {
                                const pos = getPos(post, idx);
                                return Math.max(max, pos.y + getPostH(post) + dragBuffer);
                            }, guideOffsetY + GUIDE_H + dragBuffer);

                            const noteColors = ['#FFFEF0', '#F0FDF4', '#FFF7ED', '#F5F3FF', '#EFF6FF', '#FDF2F8'];
                            const stickers = ['⭐','❤️','✨','🌟','💙','🎯','🔥','💬','🌙','🌸'];
                            const rotations = [-2.1, 1.3, -0.8, 1.7, -1.4, 0.6, -1.9, 1.1, -0.5, 1.4];

                            const handleTapeMouseDown = (e: React.MouseEvent, postId: string, currentPos: {x: number, y: number}) => {
                                e.preventDefault();
                                e.stopPropagation();
                                pendingDragRef.current = { id: postId, startMouseX: e.clientX, startMouseY: e.clientY, startNoteX: currentPos.x, startNoteY: currentPos.y };
                            };

                            // Link sticker layout constants
                            const LINK_W = 220;
                            const LINK_START_X = BOARD_PAD + COLS * (NOTE_W + NOTE_GAP_X) + 32;
                            const _getLinkSize = (l: AffiliateLink) => {
                                const effStyle = l.displayStyle || (l.iconShape ? 'icon' : 'wide');
                                if (effStyle !== 'icon') return null;
                                if (l.iconShape === 'square-s') return 32;
                                if (l.iconShape === 'square-m') return 44;
                                if (l.iconShape === 'square-l' || l.iconShape === 'square') return 64;
                                return null;
                            };
                            const _getLinkH = (l: AffiliateLink) => {
                                if (l.type === 'PANEL') return (l.height ?? 64);
                                if (l.type === 'PHOTO') return (boardLinkSizes[l.id]?.h ?? l.height ?? 160);
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
                            const _getLinkW = (l: AffiliateLink) => {
                                if (l.type === 'PANEL') return (l.width ?? 200);
                                if (l.type === 'PHOTO') return (boardLinkSizes[l.id]?.w ?? l.width ?? 220);
                                return null;
                            };
                            const getLinkPos = (link: AffiliateLink, idx: number): {x: number, y: number} => {
                                if (boardLinkPositions[link.id]) return boardLinkPositions[link.id];
                                if (link.positionX !== null && link.positionX !== undefined && link.positionY !== null && link.positionY !== undefined) {
                                    return { x: link.positionX + guideOffsetX, y: link.positionY + guideOffsetY };
                                }
                                let y = guideOffsetY + BOARD_PAD;
                                for (let i = 0; i < idx; i++) {
                                    const l = visibleBoardLinks[i];
                                    if (!l.positionY && !boardLinkPositions[l.id]) {
                                        y += _getLinkH(l) + 14;
                                    }
                                }
                                return { x: LINK_START_X, y };
                            };

                            const handleLinkTapeMouseDown = (e: React.MouseEvent, linkId: string, currentPos: {x: number, y: number}) => {
                                e.preventDefault();
                                e.stopPropagation();
                                pendingLinkDragRef.current = { id: linkId, startMouseX: e.clientX, startMouseY: e.clientY, startNoteX: currentPos.x, startNoteY: currentPos.y };
                            };

                            // --- Mobile Touch Handlers (Long Press to Drag) ---
                            const cancelLongPress = () => {
                                if (longPressTimerRef.current) {
                                    clearTimeout(longPressTimerRef.current);
                                    longPressTimerRef.current = null;
                                }
                            };

                            const handleNoteTouchStart = (e: React.TouchEvent, id: string, currentPos: {x: number, y: number}, type: 'POST' | 'LINK') => {
                                if (e.touches.length > 1) return;
                                const touch = e.touches[0];
                                touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

                                longPressTimerRef.current = setTimeout(() => {
                                    if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback
                                    if (type === 'POST') {
                                        setBoardDragging({ id, startMouseX: touch.clientX, startMouseY: touch.clientY, startNoteX: currentPos.x, startNoteY: currentPos.y });
                                        setSelectedBoardId(id);
                                    } else {
                                        setBoardLinkDragging({ id, startMouseX: touch.clientX, startMouseY: touch.clientY, startNoteX: currentPos.x, startNoteY: currentPos.y });
                                    }
                                }, 400); // 400ms to trigger pick-up
                            };

                            const handleNoteTouchMove = (e: React.TouchEvent) => {
                                if (!touchStartPosRef.current || !longPressTimerRef.current) return;
                                const touch = e.touches[0];
                                const dx = touch.clientX - touchStartPosRef.current.x;
                                const dy = touch.clientY - touchStartPosRef.current.y;
                                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                                    cancelLongPress(); // Cancel drag if user is just scrolling
                                }
                            };

                            const handleCanvasTouchMove = (e: React.TouchEvent) => {
                                if (!boardDragging && !boardLinkDragging) return;
                                const touch = e.touches[0];
                                if (boardDragging) {
                                    const dx = (touch.clientX - boardDragging.startMouseX) / dashCamera.zoom;
                                    const dy = (touch.clientY - boardDragging.startMouseY) / dashCamera.zoom;
                                    setBoardPositions(prev => ({ ...prev, [boardDragging.id]: { x: Math.max(0, boardDragging.startNoteX + dx), y: Math.max(0, boardDragging.startNoteY + dy) } }));
                                }
                                if (boardLinkDragging) {
                                    const dx = (touch.clientX - boardLinkDragging.startMouseX) / dashCamera.zoom;
                                    const dy = (touch.clientY - boardLinkDragging.startMouseY) / dashCamera.zoom;
                                    setBoardLinkPositions(prev => ({ ...prev, [boardLinkDragging.id]: { x: Math.max(0, boardLinkDragging.startNoteX + dx), y: Math.max(0, boardLinkDragging.startNoteY + dy) } }));
                                }
                            };

                            const handleCanvasMouseMove = (e: React.MouseEvent) => {
                                // Commit pending drags only once mouse moves beyond threshold
                                if (pendingDragRef.current && !boardDragging) {
                                    const p = pendingDragRef.current;
                                    if (Math.hypot(e.clientX - p.startMouseX, e.clientY - p.startMouseY) > DRAG_THRESHOLD) {
                                        setDashCamTransition('none');
                                        setBoardDragging({ id: p.id, startMouseX: p.startMouseX, startMouseY: p.startMouseY, startNoteX: p.startNoteX, startNoteY: p.startNoteY });
                                        setSelectedBoardId(p.id);
                                        dashPanRef.current = null; // cancel any pan that started simultaneously
                                        pendingDragRef.current = null;
                                    }
                                }
                                if (pendingLinkDragRef.current && !boardLinkDragging) {
                                    const p = pendingLinkDragRef.current;
                                    if (Math.hypot(e.clientX - p.startMouseX, e.clientY - p.startMouseY) > DRAG_THRESHOLD) {
                                        setDashCamTransition('none');
                                        setBoardLinkDragging({ id: p.id, startMouseX: p.startMouseX, startMouseY: p.startMouseY, startNoteX: p.startNoteX, startNoteY: p.startNoteY });
                                        dashPanRef.current = null;
                                        pendingLinkDragRef.current = null;
                                    }
                                }
                                if (boardDragging) {
                                    const dx = (e.clientX - boardDragging.startMouseX) / dashCamera.zoom;
                                    const dy = (e.clientY - boardDragging.startMouseY) / dashCamera.zoom;
                                    setBoardPositions(prev => ({
                                        ...prev,
                                        [boardDragging.id]: {
                                            x: Math.max(0, boardDragging.startNoteX + dx),
                                            y: Math.max(0, boardDragging.startNoteY + dy),
                                        },
                                    }));
                                } else if (boardLinkDragging) {
                                    const dx = (e.clientX - boardLinkDragging.startMouseX) / dashCamera.zoom;
                                    const dy = (e.clientY - boardLinkDragging.startMouseY) / dashCamera.zoom;
                                    setBoardLinkPositions(prev => ({
                                        ...prev,
                                        [boardLinkDragging.id]: {
                                            x: Math.max(0, boardLinkDragging.startNoteX + dx),
                                            y: Math.max(0, boardLinkDragging.startNoteY + dy),
                                        },
                                    }));
                                } else if (dashPanRef.current && !pendingDragRef.current && !pendingLinkDragRef.current) {
                                    const pan = dashPanRef.current;
                                    const dx = e.clientX - pan.startX;
                                    const dy = e.clientY - pan.startY;
                                    setDashCamera(prev => ({ ...prev, x: pan.camX - dx / prev.zoom, y: pan.camY - dy / prev.zoom }));
                                }
                                if (boardLinkResizing) {
                                    dashPanRef.current = null;
                                    const dx = (e.clientX - boardLinkResizing.startMouseX) / dashCamera.zoom;
                                    const dy = (e.clientY - boardLinkResizing.startMouseY) / dashCamera.zoom;
                                    const wDelta = boardLinkResizing.flipX ? -dx : dx;
                                    setBoardLinkSizes(prev => ({
                                        ...prev,
                                        [boardLinkResizing.id]: {
                                            w: Math.max(80, boardLinkResizing.startW + wDelta),
                                            h: Math.max(60, boardLinkResizing.startH + dy),
                                        },
                                    }));
                                }
                            };

                            const handleCanvasMouseUp = async () => {
                                pendingDragRef.current = null;
                                pendingLinkDragRef.current = null;
                                dashPanRef.current = null;
                                if (boardDragging) {
                                    const rawPos = boardPositions[boardDragging.id];
                                    if (rawPos) {
                                        const allPositioned = filtered.map((p, idx) => ({
                                            id: p.id,
                                            pos: boardPositions[p.id] || getPos(p, idx),
                                        })).sort((a, b) => a.pos.y !== b.pos.y ? a.pos.y - b.pos.y : a.pos.x - b.pos.x);
                                        const order = allPositioned.findIndex(item => item.id === boardDragging.id);
                                        try {
                                            const pX = rawPos.x - guideOffsetX;
                                            const pY = rawPos.y - guideOffsetY;
                                            await updateBoardPostPosition(boardDragging.id, pX, pY, order);
                                            setBoardPosts(prev => prev.map(p => p.id === boardDragging.id ? { ...p, positionX: pX, positionY: pY, displayOrder: order } : p));
                                        } catch {}
                                    }
                                    setBoardDragging(null);
                                }
                                if (boardLinkDragging) {
                                    const pos = boardLinkPositions[boardLinkDragging.id];
                                    if (pos) {
                                        const updatedLinks = (editedCreator.links || []).map(l =>
                                            l.id === boardLinkDragging.id ? { ...l, positionX: pos.x - guideOffsetX, positionY: pos.y - guideOffsetY } : l
                                        );
                                        await saveBoardLinkChange(updatedLinks);
                                    }
                                    const droppedId = boardLinkDragging.id;
                                    setLinkZOrder(prev => [...prev.filter(id => id !== droppedId), droppedId]);
                                    setBoardLinkDragging(null);
                                }
                                if (boardLinkResizing) {
                                    // Size is kept live in boardLinkSizes; Done button persists to backend.
                                    setBoardLinkResizing(null);
                                }
                            };

                            const linkMaxY = visibleBoardLinks.reduce((max, link, idx) => {
                                const pos = getLinkPos(link, idx);
                                return Math.max(max, pos.y + _getLinkH(link) + (boardLinkDragging ? 500 : 160));
                            }, 0);
                            const canvasH = Math.max(maxY, linkMaxY, 3000);

                            const linkMaxX = visibleBoardLinks.reduce((max, link, idx) => {
                                const pos = getLinkPos(link, idx);
                                const isIconMode = link.displayStyle === 'icon' || (!link.thumbnailUrl && link.type !== 'PHOTO' && link.type !== 'DIGITAL_PRODUCT' && !link.url?.match(/youtube\.com|youtu\.be/));
                                const isThumbnailMode = !isIconMode && (link.displayStyle === 'thumbnail' || !!link.thumbnailUrl || link.type === 'DIGITAL_PRODUCT' || !!link.url?.match(/youtube\.com|youtu\.be/));
                                const cardSize = !isIconMode ? (link.iconShape === 'square-s' ? 'S' : link.iconShape === 'square-l' ? 'L' : 'M') : 'M';
                                const w = isIconMode ? (_getLinkSize(link) || LINK_W) : isThumbnailMode ? (cardSize === 'S' ? 120 : cardSize === 'L' ? LINK_W : 160) : (cardSize === 'S' ? 110 : cardSize === 'L' ? getWideWidth(link.title) : 140);
                                return Math.max(max, pos.x + w);
                            }, 0);
                            const canvasW = Math.max(guideOffsetX + GUIDE_DESKTOP_W, linkMaxX, 3000) + BOARD_PAD;

                            // Camera transform
                            const bTx = boardViewportW / 2 - dashCamera.x * dashCamera.zoom;
                            const bTy = boardViewportH / 2 - dashCamera.y * dashCamera.zoom;

                            const linkColors = ['#FFF7ED', '#F0FDF4', '#EFF6FF', '#FDF2F8', '#FFFEF0', '#F5F3FF'];


                            return (
                                <div
                                    ref={boardCanvasRef}
                                    className="absolute select-none"
                                    style={{
                                        left: 0, top: 0,
                                        width: `${canvasW}px`,
                                        height: `${canvasH}px`,
                                        transformOrigin: '0 0',
                                        transform: `translate(${bTx}px, ${bTy}px) scale(${dashCamera.zoom})`,
                                        transition: dashCamTransition,
                                        background: 'linear-gradient(135deg, #FAFAF8 0%, #F5F3EF 100%)',
                                        backgroundImage: 'radial-gradient(circle, rgba(168,162,158,0.15) 1px, transparent 1px)',
                                        backgroundSize: '24px 24px',
                                        cursor: boardDragging || boardLinkDragging ? 'grabbing' : boardLinkResizing ? 'se-resize' : 'grab',
                                    }}
                                    onMouseDown={e => {
                                        if (e.button !== 0) return;
                                        setDashCamTransition('none');
                                        dashPanRef.current = { startX: e.clientX, startY: e.clientY, camX: dashCamera.x, camY: dashCamera.y };
                                    }}
                                    onMouseMove={handleCanvasMouseMove}
                                    onMouseUp={handleCanvasMouseUp}
                                    onMouseLeave={handleCanvasMouseUp}
                                    onTouchMove={handleCanvasTouchMove}
                                    onTouchEnd={handleCanvasMouseUp}
                                    onTouchCancel={handleCanvasMouseUp}
                                >
                                    {/* Focus zone guidelines — always visible, live-updating when focus modal is open */}
                                    {(() => {
                                        const CREATOR_CARD_ZONE_R = 300;
                                        const FOCUS_H = 440;
                                        const DESKTOP_VW = 640, MOBILE_VW = 390;
                                        // When modal is open use live anchor; otherwise derive from saved profile
                                        const anchor = boardFocusModeOpen ? boardFocusAnchor : (() => {
                                            const sd = editedCreator.boardFocusDesktop;
                                            return sd
                                                ? { x: sd.x - DESKTOP_VW / 2, y: Math.max(0, sd.y - FOCUS_H / 2) }
                                                : { x: 0, y: CREATOR_CARD_ZONE_R };
                                        })();
                                        const fLeft = guideOffsetX + anchor.x;
                                        const fTop  = guideOffsetY + (anchor.y - CREATOR_CARD_ZONE_R);
                                        const editing = boardFocusModeOpen;
                                        return (
                                            <div className="absolute pointer-events-none" style={{ left: fLeft, top: fTop, zIndex: editing ? 60 : 0 }}>
                                                {/* Desktop — solid indigo */}
                                                <div className="absolute" style={{ left: 0, top: 0, width: DESKTOP_VW, height: FOCUS_H, border: `2px solid rgba(99,102,241,${editing ? 0.8 : 0.45})`, borderRadius: 2, background: `rgba(99,102,241,${editing ? 0.06 : 0.02})` }}>
                                                    <div className="absolute top-0 right-0 flex items-center gap-1 px-1.5 py-0.5 rounded-bl" style={{ background: 'rgba(99,102,241,0.12)', borderLeft: '1px solid rgba(99,102,241,0.3)', borderBottom: '1px solid rgba(99,102,241,0.3)' }}>
                                                        <span className="text-[8px] font-bold uppercase tracking-wider select-none text-indigo-500">Computer</span>
                                                    </div>
                                                </div>
                                                {/* Mobile — dashed orange, centered within desktop */}
                                                <div className="absolute" style={{ left: (DESKTOP_VW - MOBILE_VW) / 2, top: 0, width: MOBILE_VW, height: FOCUS_H, border: `2px dashed rgba(251,146,60,${editing ? 0.9 : 0.55})`, borderRadius: 2, background: `rgba(251,146,60,${editing ? 0.05 : 0.01})` }}>
                                                    <div className="absolute top-0 left-0 flex items-center gap-1 px-1.5 py-0.5 rounded-br" style={{ background: 'rgba(251,146,60,0.12)', borderRight: '1px solid rgba(251,146,60,0.3)', borderBottom: '1px solid rgba(251,146,60,0.3)' }}>
                                                        <span className="text-[8px] font-bold uppercase tracking-wider select-none text-orange-500">Mobile</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {/* Link stickers */}
                                    {showLinks && visibleBoardLinks.map((link, i) => {
                                        const lc = i % linkColors.length;
                                        const rot = rotations[(stableIdx(link.id) + 3) % rotations.length];
                                        const currentPos = boardLinkPositions[link.id] || getLinkPos(link, i);
                                        const isDraggingLink = boardLinkDragging?.id === link.id;
                                        const isEditingLink = boardLinkEditId === link.id;
                                        const typeIcon = link.type === 'DIGITAL_PRODUCT' ? '📦' : link.type === 'SUPPORT' ? '💝' : '🔗';
                                            const effectiveStyle = link.displayStyle || (link.iconShape ? 'icon' : 'wide');
                                            const isIconMode = effectiveStyle === 'icon';
                                            const isYouTubeLink = link.type === 'EXTERNAL' && !!link.url?.match(/youtube\.com|youtu\.be/);
                                            const isThumbnailMode = effectiveStyle === 'thumbnail';
                                            const isWideMode = effectiveStyle === 'wide';
                                        const sqSize = _getLinkSize(link);
                                        // Wide/thumb size: S=minimal, M=compact(old S), L=auto(old M)
                                        const cardSize = !isIconMode ? (link.iconShape === 'square-s' ? 'S' : link.iconShape === 'square-l' ? 'L' : 'M') : 'M';
                                        const wideCardW = cardSize === 'S' ? 110 : cardSize === 'L' ? getWideWidth(link.title) : 140;
                                        const thumbCardW = cardSize === 'S' ? 120 : cardSize === 'L' ? LINK_W : 160;
                                        // Thumbnail style forces wide card regardless of iconShape
                                        let detectedPlatform: string | null = null;
                                        if (link.type === 'EXTERNAL' && link.url) {
                                            try {
                                                const hostname = new URL(link.url.startsWith('http') ? link.url : `https://${link.url}`).hostname;
                                                detectedPlatform = PLATFORM_DOMAINS_PREVIEW.find(p => p.pattern.test(hostname))?.id || null;
                                            } catch {}
                                        }
                                        const _ytIdLink = (() => {
                                            if (link.type !== 'EXTERNAL') return null;
                                            try {
                                                const u = new URL(link.url.startsWith('http') ? link.url : `https://${link.url}`);
                                                if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
                                                if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
                                            } catch {}
                                            return null;
                                        })();
                                        // ── Panel (wooden section label) ──
                                        if (link.type === 'PANEL') {
                                            const panelW = link.width ?? 200;
                                            const panelH = link.height ?? 64;
                                            const woodStyle = link.buttonColor ?? 'light';
                                            const woodBg = woodStyle === 'dark'
                                                ? 'linear-gradient(160deg,#7c5a38 0%,#5c3d20 40%,#6e4f2c 70%,#4a2e14 100%)'
                                                : woodStyle === 'warm'
                                                ? 'linear-gradient(160deg,#d4845a 0%,#b05a30 40%,#c86c40 70%,#8c3a14 100%)'
                                                : 'linear-gradient(160deg,#e8d5b0 0%,#c9a870 35%,#dfc090 65%,#b8885a 100%)';
                                            const textColor = woodStyle === 'light' ? '#5c3d20' : '#f5e8d0';
                                            const nailColor = woodStyle === 'light' ? 'rgba(92,61,32,0.35)' : 'rgba(245,232,208,0.35)';
                                            return (
                                                <div
                                                    key={link.id}
                                                    className="absolute group"
                                                    style={{
                                                        left: currentPos.x,
                                                        top: currentPos.y,
                                                        width: panelW,
                                                        height: panelH,
                                                        zIndex: 50 + i,
                                                        transform: isDraggingLink ? 'rotate(0deg) scale(1.04)' : `rotate(${rot}deg)`,
                                                        transition: isDraggingLink ? 'none' : 'transform 0.2s ease',
                                                    }}
                                                    onTouchStart={e => handleNoteTouchStart(e, link.id, currentPos, 'LINK')}
                                                    onTouchMove={handleNoteTouchMove}
                                                >
                                                    {/* Drag handle — full panel surface */}
                                                    <div
                                                        className="absolute inset-0 rounded-lg overflow-hidden"
                                                        style={{
                                                            background: woodBg,
                                                            backgroundImage: 'repeating-linear-gradient(88deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 6px), repeating-linear-gradient(92deg, transparent, transparent 8px, rgba(255,255,255,0.06) 8px, rgba(255,255,255,0.06) 9px)',
                                                            boxShadow: '0 3px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
                                                            cursor: isDraggingLink ? 'grabbing' : 'grab',
                                                            touchAction: 'none',
                                                        }}
                                                        onMouseDown={e => handleLinkTapeMouseDown(e, link.id, currentPos)}
                                                    >
                                                        {/* Left nail */}
                                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full" style={{ background: nailColor, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)' }}>
                                                            <div className="absolute inset-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
                                                        </div>
                                                        {/* Right nail */}
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full" style={{ background: nailColor, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)' }}>
                                                            <div className="absolute inset-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
                                                        </div>
                                                        {/* Label */}
                                                        <div className="absolute inset-0 flex items-center justify-center px-8">
                                                            <span className="font-black tracking-widest uppercase text-sm leading-none select-none" style={{ color: textColor, textShadow: woodStyle === 'light' ? 'none' : '0 1px 3px rgba(0,0,0,0.4)', letterSpacing: '0.15em' }}>{link.title}</span>
                                                        </div>
                                                    </div>
                                                    {/* Delete button */}
                                                    <button
                                                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-stone-700 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
                                                        onClick={e => { e.stopPropagation(); saveBoardLinkChange((editedCreator.links || []).filter(l => l.id !== link.id)); }}
                                                    ><Trash2 size={10} /></button>
                                                </div>
                                            );
                                        }

                                        // ── Photo (plain image, free resize via edit mode) ──
                                        if (link.type === 'PHOTO') {
                                            const phW = boardLinkSizes[link.id]?.w ?? link.width ?? 220;
                                            const phH = boardLinkSizes[link.id]?.h ?? link.height ?? 160;
                                            const isResizing = boardLinkResizing?.id === link.id;
                                            const isEditingPhoto = boardPhotoEditId === link.id;
                                            return (
                                                <div
                                                    key={link.id}
                                                    className="absolute group"
                                                    style={{
                                                        left: currentPos.x,
                                                        top: currentPos.y,
                                                        width: phW,
                                                        height: phH,
                                                        zIndex: isDraggingLink ? 1000 : isResizing ? 900 : isEditingPhoto ? 800 : (10 + i),
                                                        transition: isDraggingLink || isResizing ? 'none' : undefined,
                                                        borderRadius: 8,
                                                        overflow: isEditingPhoto ? 'visible' : 'hidden',
                                                        boxShadow: isEditingPhoto ? '0 0 0 2px #6366f1, 0 8px 32px rgba(0,0,0,0.18)' : isDraggingLink ? '0 16px 40px rgba(0,0,0,0.2)' : '0 2px 12px rgba(0,0,0,0.12)',
                                                    }}
                                                    onTouchStart={e => handleNoteTouchStart(e, link.id, currentPos, 'LINK')}
                                                    onTouchMove={handleNoteTouchMove}
                                                    onTouchEnd={cancelLongPress}
                                                    onTouchCancel={cancelLongPress}
                                                >
                                                    {/* Image clipped to box */}
                                                    <div className="absolute inset-0 rounded-lg overflow-hidden">
                                                        {link.thumbnailUrl && (
                                                            <img src={link.thumbnailUrl} alt={link.title || 'photo'} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                                                        )}
                                                    </div>
                                                    {/* Drag overlay — active when NOT in edit mode */}
                                                    {!isEditingPhoto && (
                                                        <div
                                                            className="absolute inset-0"
                                                            style={{ cursor: isDraggingLink ? 'grabbing' : 'grab', touchAction: 'none' }}
                                                            onMouseDown={e => handleLinkTapeMouseDown(e, link.id, currentPos)}
                                                        />
                                                    )}
                                                    {/* Hover toolbar — shown when NOT editing */}
                                                    {!isEditingPhoto && (
                                                        <div className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center gap-1 z-10">
                                                            <button
                                                                className="p-1 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all shadow-sm"
                                                                title="Resize"
                                                                onClick={e => { e.stopPropagation(); setBoardPhotoEditId(link.id); }}
                                                            ><Pencil size={10} /></button>
                                                            <button
                                                                className="p-1 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all shadow-sm"
                                                                onClick={async e => {
                                                                    e.stopPropagation();
                                                                    await saveBoardLinkChange((editedCreator.links || []).filter(l => l.id !== link.id));
                                                                }}
                                                                title="Delete"
                                                            ><Trash2 size={10} /></button>
                                                        </div>
                                                    )}
                                                    {/* Edit mode: corner resize handles + Done button */}
                                                    {isEditingPhoto && (
                                                        <>
                                                            {/* Done button */}
                                                            <div className="absolute -top-7 left-0 flex items-center gap-1.5 z-20">
                                                                <button
                                                                    className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500 text-white hover:bg-indigo-600 shadow"
                                                                    onClick={async e => {
                                                                        e.stopPropagation();
                                                                        setBoardPhotoEditId(null);
                                                                        const sz = boardLinkSizes[link.id];
                                                                        if (sz) {
                                                                            const updatedLinks = (editedCreator.links || []).map(l =>
                                                                                l.id === link.id ? { ...l, width: sz.w, height: sz.h } : l
                                                                            );
                                                                            await saveBoardLinkChange(updatedLinks);
                                                                        }
                                                                    }}
                                                                >Done</button>
                                                                <span className="text-[9px] text-stone-400 select-none">{phW} × {phH}</span>
                                                            </div>
                                                            {/* Bottom-right resize grip */}
                                                            <div
                                                                className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-indigo-500 border-2 border-white cursor-se-resize z-20 flex items-center justify-center shadow"
                                                                style={{ touchAction: 'none' }}
                                                                onMouseDown={e => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setBoardLinkResizing({ id: link.id, startMouseX: e.clientX, startMouseY: e.clientY, startW: phW, startH: phH });
                                                                }}
                                                            >
                                                                <svg width="8" height="8" viewBox="0 0 8 8" fill="white"><path d="M2 8 L8 2 M5 8 L8 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                                            </div>
                                                            {/* Bottom-left resize grip */}
                                                            <div
                                                                className="absolute -bottom-2 -left-2 w-5 h-5 rounded-full bg-indigo-500 border-2 border-white cursor-sw-resize z-20 flex items-center justify-center shadow"
                                                                style={{ touchAction: 'none' }}
                                                                onMouseDown={e => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setBoardLinkResizing({ id: link.id, startMouseX: e.clientX, startMouseY: e.clientY, startW: phW, startH: phH, flipX: true });
                                                                }}
                                                            >
                                                                <svg width="8" height="8" viewBox="0 0 8 8" fill="white"><path d="M6 8 L0 2 M3 8 L0 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        }

                                        return (
                                            <div
                                                key={link.id}
                                                className="absolute flex flex-col group"
                                                style={{
                                                    left: currentPos.x,
                                                    top: currentPos.y,
                                                    width: isEditingLink ? Math.max(isIconMode ? (sqSize || LINK_W) : LINK_W, 220) : (isIconMode ? (sqSize || LINK_W) : (isThumbnailMode || isYouTubeLink ? thumbCardW : wideCardW)),
                                                    transform: isDraggingLink ? 'rotate(0deg) scale(1.04)' : `rotate(${rot}deg)`,
                                                    transition: isDraggingLink ? 'none' : 'transform 0.2s ease',
                                                    zIndex: isDraggingLink ? 1000 : isEditingLink ? 500 : linkZOrder.includes(link.id) ? (100 + linkZOrder.indexOf(link.id)) : (50 + i),
                                                }}
                                                onMouseDown={e => e.stopPropagation()}
                                                onTouchStart={e => handleNoteTouchStart(e, link.id, currentPos, 'LINK')}
                                                onTouchMove={handleNoteTouchMove}
                                                onTouchEnd={cancelLongPress}
                                                onTouchCancel={cancelLongPress}
                                            >
                                                {/* Drag grip */}
                                                <div
                                                    className="h-5 flex items-center justify-center flex-shrink-0"
                                                    style={{ cursor: 'grab', touchAction: 'none' }}
                                                    onMouseDown={e => handleLinkTapeMouseDown(e, link.id, currentPos)}
                                                    onTouchStart={e => {
                                                        e.stopPropagation();
                                                        const touch = e.touches[0];
                                                        setBoardLinkDragging({
                                                            id: link.id,
                                                            startMouseX: touch.clientX,
                                                            startMouseY: touch.clientY,
                                                            startNoteX: currentPos.x,
                                                            startNoteY: currentPos.y,
                                                        });
                                                    }}
                                                    title="Drag to reposition"
                                                >
                                                    <div className="w-8 h-1 rounded-full bg-black/15" />
                                                </div>
                                                {isEditingLink ? (
                                                    <div className="rounded-lg p-3 shadow-lg" style={{ backgroundColor: boardLinkDraft.color || linkColors[lc], border: '2px solid rgba(0,0,0,0.15)' }}>
                                                        <input
                                                            className="w-full text-xs font-semibold bg-white/70 border border-stone-200 rounded px-2 py-1 mb-1.5 outline-none"
                                                            placeholder="Title"
                                                            value={boardLinkDraft.title}
                                                            onChange={e => setBoardLinkDraft(p => ({ ...p, title: e.target.value }))}
                                                            onClick={e => e.stopPropagation()}
                                                            autoFocus
                                                        />
                                                        <input
                                                            className="w-full text-xs bg-white/70 border border-stone-200 rounded px-2 py-1 mb-2 outline-none"
                                                            placeholder="URL"
                                                            value={boardLinkDraft.url}
                                                            onChange={e => setBoardLinkDraft(p => ({ ...p, url: e.target.value }))}
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                        {/* Color swatches + palette picker */}
                                                        <div className="flex items-center gap-1 mb-2.5" onClick={e => e.stopPropagation()}>
                                                            {['#FFFEF0','#F0FDF4','#FFF7ED'].map(c => (
                                                                <button
                                                                    key={c}
                                                                    onClick={e => { e.stopPropagation(); setBoardLinkDraft(p => ({ ...p, color: c })); }}
                                                                    className="w-4 h-4 rounded-full flex-shrink-0 transition-transform hover:scale-110"
                                                                    style={{
                                                                        backgroundColor: c,
                                                                        border: (boardLinkDraft.color || linkColors[lc]) === c ? '2px solid rgba(0,0,0,0.4)' : '1.5px solid rgba(0,0,0,0.12)',
                                                                        transform: (boardLinkDraft.color || linkColors[lc]) === c ? 'scale(1.25)' : undefined,
                                                                    }}
                                                                />
                                                            ))}
                                                            {/* Custom color picker */}
                                                            <label
                                                                className="w-4 h-4 rounded-full flex-shrink-0 cursor-pointer flex items-center justify-center hover:scale-110 transition-transform overflow-hidden"
                                                                style={{
                                                                    background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                                                                    border: '1.5px solid rgba(0,0,0,0.15)',
                                                                }}
                                                                title="Pick a color"
                                                                onClick={e => e.stopPropagation()}
                                                            >
                                                                <input
                                                                    type="color"
                                                                    className="opacity-0 absolute w-0 h-0"
                                                                    value={boardLinkDraft.color || linkColors[lc]}
                                                                    onChange={e => setBoardLinkDraft(p => ({ ...p, color: e.target.value }))}
                                                                    onClick={e => e.stopPropagation()}
                                                                />
                                                            </label>
                                                        </div>
                                                        {/* Size Swatches */}
                                                        <div className="mb-2.5 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                                            <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">Size</span>
                                                            <div className="flex gap-1">
                                                            {([['square-s', 'S'], ['square-m', 'M'], ['square-l', 'L']] as const).map(([sVal, sLabel]) => {
                                                                const isSelected = link.iconShape === sVal || (link.iconShape === 'square' && sVal === 'square-l') || (!link.iconShape && sVal === 'square-m');
                                                                return (
                                                                    <button
                                                                        key={sVal}
                                                                        onClick={async e => {
                                                                            e.stopPropagation();
                                                                            const updatedLinks = (editedCreator.links || []).map(l => l.id === link.id ? {
                                                                                ...l, iconShape: sVal
                                                                            } : l);
                                                                            setBoardLinkDraft(p => ({ ...p, iconShape: sVal }));
                                                                            await saveBoardLinkChange(updatedLinks);
                                                                        }}
                                                                        className={`flex-1 py-0.5 text-[10px] font-bold rounded border transition-colors ${isSelected ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}
                                                                    >
                                                                        {sLabel}
                                                                    </button>
                                                                );
                                                            })}
                                                            </div>
                                                        </div>
                                                        {/* Style picker — Icon vs Thumbnail */}
                                                        <div className="mb-2.5" onClick={e => e.stopPropagation()}>
                                                            <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">Style</span>
                                                            <div className="flex gap-1">
                                                                {([
                                                                    ['icon', 'Icon', '▤'],
                                                                        ['wide', 'Wide', '▭'],
                                                                    ['thumbnail', 'Thumb', '▣'],
                                                                ] as const).map(([val, label, icon]) => {
                                                                    const isSelected = effectiveStyle === val;
                                                                    return (
                                                                        <button
                                                                            key={val}
                                                                            onClick={async e => {
                                                                                e.stopPropagation();
                                                                                const updatedLinks = (editedCreator.links || []).map(l => l.id === link.id ? {
                                                                                    ...l,
                                                                                    displayStyle: val as any,
                                                                                    ...(val === 'icon' && !l.iconShape ? { iconShape: 'square-s' } : {})
                                                                                } : l);
                                                                                setBoardLinkDraft(p => ({
                                                                                    ...p,
                                                                                    displayStyle: val as 'icon' | 'wide' | 'thumbnail',
                                                                                    ...(val === 'icon' && !p.iconShape ? { iconShape: 'square-s' } : {})
                                                                                }));
                                                                                await saveBoardLinkChange(updatedLinks);
                                                                            }}
                                                                            className={`flex-1 py-0.5 text-[10px] font-bold rounded border transition-colors flex items-center justify-center gap-0.5 ${isSelected ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}
                                                                        >
                                                                            <span className="text-[11px]">{icon}</span> {label}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        {/* Photo preview upload */}
                                                        <div className="mb-2.5" onClick={e => e.stopPropagation()}>
                                                            <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">Photo</span>
                                                            <label className="flex items-center gap-2 cursor-pointer" onClick={e => e.stopPropagation()}>
                                                                {boardLinkDraft.thumbnailUrl ? (
                                                                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-stone-200 flex-shrink-0">
                                                                        <img src={boardLinkDraft.thumbnailUrl} className="w-full h-full object-cover" alt="preview" />
                                                                        <button
                                                                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                                                                            onClick={e => { e.preventDefault(); e.stopPropagation(); setBoardLinkDraft(p => ({ ...p, thumbnailUrl: undefined })); }}
                                                                        ><span className="text-white text-[10px]">✕</span></button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded-lg border border-dashed border-stone-300 flex items-center justify-center bg-white/60 flex-shrink-0 text-stone-400 text-xs">+</div>
                                                                )}
                                                                <span className="text-[10px] text-stone-400">{boardLinkDraft.thumbnailUrl ? 'Change photo' : 'Add photo'}</span>
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    onClick={e => e.stopPropagation()}
                                                                    onChange={e => {
                                                                        const file = e.target.files?.[0];
                                                                        if (!file) return;
                                                                        const reader = new FileReader();
                                                                        reader.onload = ev => setBoardLinkDraft(p => ({ ...p, thumbnailUrl: ev.target?.result as string }));
                                                                        reader.readAsDataURL(file);
                                                                    }}
                                                                />
                                                            </label>
                                                        </div>
                                                        <div className="flex gap-1.5">
                                                            <button
                                                                className="flex-1 py-1 text-[10px] font-bold rounded bg-stone-800 text-white hover:bg-stone-700 transition-colors"
                                                                onClick={async e => {
                                                                    e.stopPropagation();
                                                                    const updatedLinks = (editedCreator.links || []).map(l =>
                                                                        l.id === link.id ? {
                                                                            ...l,
                                                                            title: boardLinkDraft.title || l.title,
                                                                            url: boardLinkDraft.url || l.url,
                                                                            ...(boardLinkDraft.color ? { buttonColor: boardLinkDraft.color } : {}),
                                                                            ...(boardLinkDraft.thumbnailUrl !== undefined ? { thumbnailUrl: boardLinkDraft.thumbnailUrl } : {}),
                                                                            ...(boardLinkDraft.displayStyle !== undefined ? { 
                                                                                displayStyle: boardLinkDraft.displayStyle,
                                                                                ...(boardLinkDraft.displayStyle === 'thumbnail' ? { iconShape: undefined } : {})
                                                                            } : {}),
                                                                                ...(boardLinkDraft.displayStyle !== undefined ? { displayStyle: boardLinkDraft.displayStyle } : {}),
                                                                                ...(boardLinkDraft.iconShape !== undefined ? { iconShape: boardLinkDraft.iconShape } : {}),
                                                                        } : l
                                                                    );
                                                                    await saveBoardLinkChange(updatedLinks);
                                                                    setBoardLinkEditId(null);
                                                                }}
                                                            >Save</button>
                                                            <button
                                                                className="flex-1 py-1 text-[10px] font-bold rounded border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors"
                                                                onClick={e => { e.stopPropagation(); setBoardLinkEditId(null); }}
                                                            >Cancel</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={`relative rounded-lg ${isThumbnailMode ? (cardSize === 'S' ? 'p-1' : cardSize === 'L' ? 'p-3' : 'p-2') : isIconMode ? (sqSize === 32 ? 'p-0.5 aspect-square flex items-center justify-center' : sqSize === 44 ? 'p-1 aspect-square flex items-center justify-center' : 'p-1.5 aspect-square flex items-center justify-center') : (cardSize === 'S' ? 'p-1' : cardSize === 'L' ? 'p-2.5' : 'p-2')}`}
                                                        style={{
                                                            backgroundColor: link.buttonColor || linkColors[lc],
                                                            border: isDraggingLink ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                                                            boxShadow: isDraggingLink ? '0 16px 40px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.07)',
                                                        }}
                                                    >
                                                        {/* Action buttons — show on hover */}
                                                        <div className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center gap-1 z-10">
                                                            <button
                                                                className="p-1 rounded-full bg-white/80 text-stone-500 hover:text-stone-800 hover:bg-white transition-all shadow-sm"
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    setBoardLinkEditId(link.id);
                                                                    setBoardLinkDraft({ title: link.title, url: link.url, price: link.price?.toString() || '', type: (link.type as any) || 'EXTERNAL', color: link.buttonColor, thumbnailUrl: link.thumbnailUrl, displayStyle: link.displayStyle });
                                                                }}
                                                                title="Edit"
                                                            ><Pencil size={10} /></button>
                                                            <button
                                                                className="p-1 rounded-full bg-white/80 text-red-400 hover:text-red-600 hover:bg-white transition-all shadow-sm"
                                                                onClick={async e => {
                                                                    e.stopPropagation();
                                                                    const updatedLinks = (editedCreator.links || []).filter(l => l.id !== link.id);
                                                                    await saveBoardLinkChange(updatedLinks);
                                                                }}
                                                                title="Delete"
                                                            ><Trash2 size={10} /></button>
                                                        </div>
                                                        {isThumbnailMode && !_ytIdLink ? (() => {
                                                            const hasRealPhoto = link.thumbnailUrl && !link.thumbnailUrl.startsWith('data:emoji,');
                                                            const thumbBg = detectedPlatform ? '#0f0f0f' : link.type === 'DIGITAL_PRODUCT' ? '#ede9fe' : link.type === 'SUPPORT' ? '#fdf2f8' : '#e5e7eb';
                                                            const typeIcon = link.type === 'DIGITAL_PRODUCT'
                                                                ? <ShoppingBag size={10} className="text-violet-500 flex-shrink-0" />
                                                                : link.type === 'SUPPORT'
                                                                    ? <Heart size={10} className="text-pink-500 flex-shrink-0" />
                                                                    : detectedPlatform
                                                                        ? <span className="w-3 h-3 flex-shrink-0">{getPreviewPlatformIcon(detectedPlatform)}</span>
                                                                        : <LinkIcon size={10} className="text-stone-400 flex-shrink-0" />;
                                                            return (
                                                                <div className="flex flex-col w-full">
                                                                    <div className="relative w-full rounded-md overflow-hidden mb-2" style={{ paddingBottom: '56.25%', backgroundColor: thumbBg }}>
                                                                        {hasRealPhoto
                                                                            ? <img src={link.thumbnailUrl} className="absolute inset-0 w-full h-full object-cover" alt={link.title} />
                                                                            : <div className="absolute inset-0 flex items-center justify-center">
                                                                                {detectedPlatform
                                                                                    ? <div className="scale-[2.5]">{getPreviewPlatformIcon(detectedPlatform)}</div>
                                                                                    : link.type === 'DIGITAL_PRODUCT' ? <ShoppingBag size={28} className="text-violet-300" />
                                                                                    : link.type === 'SUPPORT' ? <Heart size={28} className="text-pink-300" />
                                                                                    : <LinkIcon size={28} className="text-stone-300" />}
                                                                              </div>}
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        {typeIcon}
                                                                        <p className="text-[10px] font-bold text-stone-700 truncate">{link.title}</p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })() : _ytIdLink && !isIconMode ? (
                                                            <>
                                                                {/* YouTube thumbnail */}
                                                                <div className="relative w-full rounded-md overflow-hidden -mx-0 mb-2" style={{ paddingBottom: '56.25%' }}>
                                                                    <img
                                                                        src={`https://img.youtube.com/vi/${_ytIdLink}/hqdefault.jpg`}
                                                                        className="absolute inset-0 w-full h-full object-cover"
                                                                        alt={link.title}
                                                                    />
                                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                                        <div className="w-8 h-6 bg-[#FF0000] rounded-md flex items-center justify-center shadow opacity-90">
                                                                            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white ml-0.5"><path d="M8 5v14l11-7z"/></svg>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="#FF0000"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.03 0 12 0 12s0 3.97.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.97 24 12 24 12s0-3.97-.5-5.81zM9.75 15.52V8.48L15.5 12l-5.75 3.52z"/></svg>
                                                                    <p className="text-[10px] font-bold text-stone-700 truncate">{link.title}</p>
                                                                </div>
                                                            </>
                                                        ) : isIconMode && sqSize === 32 ? (
                                                            /* S: tiny icon, no padding */
                                                            <div className="w-6 h-6 rounded-md bg-white/60 shadow-sm border border-black/5 flex items-center justify-center mx-auto">
                                                                {detectedPlatform ? (
                                                                    <div className="scale-[0.75]">{getPreviewPlatformIcon(detectedPlatform)}</div>
                                                                ) : link.thumbnailUrl?.startsWith('data:emoji,') ? (
                                                                    <span className="text-xs leading-none">{link.thumbnailUrl.replace('data:emoji,', '')}</span>
                                                                ) : link.thumbnailUrl ? (
                                                                    <img src={link.thumbnailUrl} className="w-full h-full object-cover rounded-md" alt={link.title} />
                                                                ) : link.type === 'DIGITAL_PRODUCT' ? <ShoppingBag size={11} className="text-violet-500" /> : link.type === 'SUPPORT' ? <Heart size={11} className="text-pink-500" /> : <LinkIcon size={11} className="text-stone-500" />}
                                                            </div>
                                                        ) : isIconMode && sqSize === 44 ? (
                                                            /* M: small square icon */
                                                            <div className="w-7 h-7 rounded-lg bg-white/60 shadow-sm border border-black/5 flex items-center justify-center mx-auto">
                                                                {detectedPlatform ? (
                                                                    <div className="scale-[0.85]">{getPreviewPlatformIcon(detectedPlatform)}</div>
                                                                ) : link.thumbnailUrl?.startsWith('data:emoji,') ? (
                                                                    <span className="text-base leading-none">{link.thumbnailUrl.replace('data:emoji,', '')}</span>
                                                                ) : link.thumbnailUrl ? (
                                                                    <img src={link.thumbnailUrl} className="w-full h-full object-cover rounded-lg" alt={link.title} />
                                                                ) : link.type === 'DIGITAL_PRODUCT' ? <ShoppingBag size={14} className="text-violet-500" /> : link.type === 'SUPPORT' ? <Heart size={14} className="text-pink-500" /> : <LinkIcon size={14} className="text-stone-500" />}
                                                            </div>
                                                        ) : isIconMode && sqSize === 64 ? (
                                                            /* L: medium square icon */
                                                            <div className="w-10 h-10 rounded-xl bg-white/60 shadow-sm border border-black/5 flex items-center justify-center mx-auto">
                                                                {detectedPlatform ? (
                                                                    <div className="scale-[1.25]">{getPreviewPlatformIcon(detectedPlatform)}</div>
                                                                ) : link.thumbnailUrl?.startsWith('data:emoji,') ? (
                                                                    <span className="text-xl">{link.thumbnailUrl.replace('data:emoji,', '')}</span>
                                                                ) : link.thumbnailUrl ? (
                                                                    <img src={link.thumbnailUrl} className="w-full h-full object-cover rounded-xl" alt={link.title} />
                                                                ) : link.type === 'DIGITAL_PRODUCT' ? <ShoppingBag size={18} className="text-violet-500" /> : link.type === 'SUPPORT' ? <Heart size={18} className="text-pink-500" /> : <LinkIcon size={18} className="text-stone-500" />}
                                                            </div>
                                                        ) : (() => {
                                                            // Wide format: thumbnail style when explicitly set OR auto-detected (real photo)
                                                            const hasRealPhoto = link.thumbnailUrl && !link.thumbnailUrl.startsWith('data:emoji,');
                                                            const isThumbnailStyle = link.displayStyle === 'thumbnail' || (!link.displayStyle && hasRealPhoto);
                                                            if (isThumbnailStyle) {
                                                                const thumbBg = detectedPlatform ? '#0f0f0f' : link.type === 'DIGITAL_PRODUCT' ? '#ede9fe' : link.type === 'SUPPORT' ? '#fdf2f8' : '#e5e7eb';
                                                                const typeIcon = link.type === 'DIGITAL_PRODUCT'
                                                                    ? <ShoppingBag size={10} className="text-violet-500 flex-shrink-0" />
                                                                    : link.type === 'SUPPORT'
                                                                        ? <Heart size={10} className="text-pink-500 flex-shrink-0" />
                                                                        : detectedPlatform
                                                                            ? <span className="w-3 h-3 flex-shrink-0">{getPreviewPlatformIcon(detectedPlatform)}</span>
                                                                            : <LinkIcon size={10} className="text-stone-400 flex-shrink-0" />;
                                                                return (
                                                                    <div className="flex flex-col w-full">
                                                                        {/* Thumbnail image — same style as YouTube card */}
                                                                        <div className="relative w-full rounded-md overflow-hidden mb-2" style={{ paddingBottom: '56.25%', backgroundColor: thumbBg }}>
                                                                            {hasRealPhoto
                                                                                ? <img src={link.thumbnailUrl} className="absolute inset-0 w-full h-full object-cover" alt={link.title} />
                                                                                : <div className="absolute inset-0 flex items-center justify-center">
                                                                                    {detectedPlatform
                                                                                        ? <div className="scale-[2.5]">{getPreviewPlatformIcon(detectedPlatform)}</div>
                                                                                        : link.type === 'DIGITAL_PRODUCT' ? <ShoppingBag size={28} className="text-violet-300" />
                                                                                        : link.type === 'SUPPORT' ? <Heart size={28} className="text-pink-300" />
                                                                                        : <LinkIcon size={28} className="text-stone-300" />}
                                                                                  </div>}
                                                                        </div>
                                                                        {/* Bottom row — same layout as YouTube card */}
                                                                        <div className="flex items-center gap-1">
                                                                            {typeIcon}
                                                                            <p className="text-[10px] font-bold text-stone-700 truncate">{link.title}</p>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                            if (link.type === 'DIGITAL_PRODUCT') return (
                                                                <div className="flex flex-col h-full w-full">
                                                                    <div className="flex items-center gap-2.5 pb-2.5">
                                                                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/60 border border-black/5">
                                                                            {link.thumbnailUrl?.startsWith('data:emoji,') ? <span className="text-xl leading-none">{link.thumbnailUrl.replace('data:emoji,', '')}</span> : <ShoppingBag size={16} className="text-violet-400" />}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0 text-left">
                                                                            <p className="text-xs font-bold text-stone-800 truncate">{link.title}</p>
                                                                            {link.price != null && <p className="text-[10px] text-stone-400 font-medium">{link.price} credits</p>}
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-auto py-1.5 rounded-md text-[10px] font-bold text-center text-violet-600 bg-violet-50">
                                                                        <ShoppingBag size={9} className="inline mr-1" />Buy
                                                                    </div>
                                                                </div>
                                                            );
                                                            if (link.type === 'SUPPORT') return (
                                                                <div className="flex items-center gap-2.5 h-full w-full">
                                                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/60 border border-black/5">
                                                                        {link.thumbnailUrl?.startsWith('data:emoji,') ? <span className="text-xl leading-none">{link.thumbnailUrl.replace('data:emoji,', '')}</span> : <Heart size={16} className="text-pink-400" />}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0 text-left">
                                                                        <p className="text-xs font-bold text-stone-800 truncate">{link.title}</p>
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-pink-500 bg-pink-50 px-2 py-1 rounded-full flex-shrink-0">Tip ♥</span>
                                                                </div>
                                                            );
                                                            return (
                                                                <div className="flex items-center gap-2 h-full w-full">
                                                                    <div className={`${cardSize === 'S' ? 'w-4 h-4' : cardSize === 'L' ? 'w-7 h-7' : 'w-5 h-5'} rounded-lg flex items-center justify-center flex-shrink-0 bg-white/60 border border-black/5 text-stone-600`}>
                                                                        {link.thumbnailUrl?.startsWith('data:emoji,') ? <span className={cardSize === 'S' ? 'text-[9px] leading-none' : cardSize === 'L' ? 'text-base leading-none' : 'text-xs leading-none'}>{link.thumbnailUrl.replace('data:emoji,', '')}</span> : detectedPlatform ? <div className={cardSize === 'S' ? 'scale-[0.7]' : cardSize === 'L' ? 'scale-[0.95]' : 'scale-[0.8]'}>{getPreviewPlatformIcon(detectedPlatform)}</div> : <LinkIcon size={cardSize === 'S' ? 8 : cardSize === 'L' ? 13 : 10} />}
                                                                    </div>
                                                                    <span className={`${cardSize === 'S' ? 'text-[9px]' : cardSize === 'L' ? 'text-xs' : 'text-[10px]'} font-semibold text-stone-700 ${cardSize === 'L' ? 'overflow-hidden' : 'truncate'} flex-1 text-left`}>{link.title}</span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {/* Fan post stickers */}
                                    {filtered.map((post, i) => {
                                        const nc = stableIdx(post.id) % noteColors.length;
                                        const rot = rotations[stableIdx(post.id) % rotations.length];
                                        const pos = getPos(post, i);
                                        const isDragging = boardDragging?.id === post.id;
                                        const isHovered = !isDragging && !boardDragging && selectedBoardId === post.id;
                                        const isActive = isDragging || isHovered;
                                        const currentPos = boardPositions[post.id] || pos;
                                        const noteSize = getPostNoteSize(post);
                                        const noteW = getPostW(post);

                                        return (
                                            <div
                                                key={post.id}
                                                className="absolute flex flex-col group/note"
                                                style={{
                                                    left: currentPos.x,
                                                    top: currentPos.y,
                                                    width: noteW,
                                                    transform: isActive ? 'rotate(0deg) scale(1.04)' : `rotate(${rot}deg)`,
                                                    transition: isDragging ? 'none' : 'transform 0.2s ease',
                                                    zIndex: isDragging ? 1000 : isActive ? 100 : 30 + i,
                                                    cursor: isDragging ? 'grabbing' : 'pointer',
                                                }}
                                                onMouseDown={e => e.stopPropagation()}
                                                onMouseEnter={() => !boardDragging && setSelectedBoardId(post.id)}
                                                onMouseLeave={() => !boardDragging && setSelectedBoardId(null)}
                                                onClick={() => !isDragging && setBoardPopupPost(post)}
                                                onTouchStart={e => handleNoteTouchStart(e, post.id, currentPos, 'POST')}
                                                onTouchMove={handleNoteTouchMove}
                                                onTouchEnd={cancelLongPress}
                                                onTouchCancel={cancelLongPress}
                                            >
                                                {/* Drag grip */}
                                                <div
                                                    className="h-5 flex items-center justify-center flex-shrink-0"
                                                    style={{ cursor: 'grab', touchAction: 'none' }}
                                                    onMouseDown={e => handleTapeMouseDown(e, post.id, currentPos)}
                                                    onTouchStart={e => {
                                                        e.stopPropagation();
                                                        const touch = e.touches[0];
                                                        setBoardDragging({
                                                            id: post.id,
                                                            startMouseX: touch.clientX,
                                                            startMouseY: touch.clientY,
                                                            startNoteX: currentPos.x,
                                                            startNoteY: currentPos.y,
                                                        });
                                                        setSelectedBoardId(post.id);
                                                    }}
                                                    title="Drag to reposition"
                                                >
                                                    <div className="w-8 h-1 rounded-full bg-black/15" />
                                                </div>
                                                {/* Note card */}
                                                <div
                                                    className={`relative rounded-lg overflow-hidden ${noteSize === 'S' ? 'p-2' : noteSize === 'M' ? 'p-2.5' : 'p-3'}`}
                                                    style={{
                                                        backgroundColor: post.noteColor ?? noteColors[nc],
                                                        backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 23px, rgba(0,0,0,0.04) 23px, rgba(0,0,0,0.04) 24px)',
                                                        backgroundPositionY: '36px',
                                                        border: isActive ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                                                        boxShadow: isDragging ? '0 16px 40px rgba(0,0,0,0.2)' : isActive ? '0 6px 20px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.07)',
                                                    }}
                                                >
                                                    {/* Size picker — shown on hover */}
                                                    <div
                                                        className="absolute top-1.5 right-1.5 opacity-0 group-hover/note:opacity-100 transition-opacity flex gap-0.5 z-10"
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        {(['S', 'M', 'L'] as const).map(sz => (
                                                            <button
                                                                key={sz}
                                                                className={`w-5 h-5 rounded text-[8px] font-bold transition-colors ${noteSize === sz ? 'bg-stone-700 text-white' : 'bg-black/10 text-stone-500 hover:bg-black/20'}`}
                                                                onClick={async () => {
                                                                    setBoardPostSizes(prev => ({ ...prev, [post.id]: sz }));
                                                                    setBoardPosts(prev => prev.map(p => p.id === post.id ? { ...p, noteSize: sz } : p));
                                                                    await updateBoardPostSize(post.id, sz);
                                                                }}
                                                            >{sz}</button>
                                                        ))}
                                                    </div>
                                                    {/* Avatar + Name row */}
                                                    <div className={`flex items-center ${noteSize === 'S' ? 'gap-1.5 mb-1' : 'gap-2 mb-1.5'}`}>
                                                        <div className={`${noteSize === 'S' ? 'w-5 h-5' : noteSize === 'M' ? 'w-6 h-6' : 'w-8 h-8'} rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0 overflow-hidden border border-stone-200/60`}>
                                                            {post.fanAvatarUrl
                                                                ? <img src={post.fanAvatarUrl} className="w-full h-full object-cover" alt={post.fanName} />
                                                                : <span className={`text-white font-bold ${noteSize === 'S' ? 'text-[8px]' : 'text-[10px]'}`}>{post.fanName.charAt(0).toUpperCase()}</span>}
                                                        </div>
                                                        <p className={`${noteSize === 'S' ? 'text-[10px]' : noteSize === 'M' ? 'text-xs' : 'text-sm'} font-bold text-stone-800 truncate`}>{post.fanName}</p>
                                                    </div>
                                                    {/* Message preview */}
                                                    <p className={`${noteSize === 'S' ? 'text-[9px] line-clamp-1' : 'text-[10px] line-clamp-2'} text-stone-500 ${noteSize === 'S' ? 'mb-1.5' : 'mb-2'} leading-relaxed`}>{post.content}</p>
                                                    {/* Footer */}
                                                    {noteSize !== 'S' && (
                                                        <div className="flex items-center justify-between gap-1 flex-wrap">
                                                            {post.reply
                                                                ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Answered</span>
                                                                : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">Awaiting reply</span>}
                                                            {post.isPinned && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 flex items-center gap-0.5"><Pin size={8} className="fill-current" /> Pinned</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>

                    {(() => {
                        const isAddingSticker = boardAddingLink || boardAddingProduct || boardAddingSupport || boardAddingPhoto || boardAddingPanel;
                        return (
                    <div className="sticky bottom-0 z-20 pb-4 pt-2 pointer-events-none">
                        <div className="pointer-events-auto flex items-end justify-center gap-3 flex-wrap px-4" style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.12))' }}>

                            {/* ── 🔗 Link (with platform picker) ── */}
                            {boardAddingLink && (
                                <div className="flex flex-col" style={{ width: 260 }}>
                                    <div className="rounded-xl p-3 shadow-lg" style={{ backgroundColor: '#FFFEF0', border: '2px solid rgba(0,0,0,0.12)' }}>
                                        {!boardSelectedPlatform ? (
                                            <>
                                                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2">🔗 Add Link</p>
                                                <div className="grid grid-cols-5 gap-1.5 mb-2">
                                                    {/* Generic link icon first */}
                                                    <button
                                                        onClick={() => setBoardSelectedPlatform('EXTERNAL')}
                                                        className="w-full aspect-square flex items-center justify-center rounded-lg bg-white border-2 border-stone-300 hover:bg-stone-50 hover:border-stone-500 transition-colors"
                                                        title="External Link"
                                                    >
                                                        <span className="text-base">🔗</span>
                                                    </button>
                                                    {/* Platform icons */}
                                                    {SUPPORTED_PLATFORMS.map(p => (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => {
                                                                const existing = (editedCreator.platforms || []).find(ep => (typeof ep === 'string' ? ep : ep.id) === p.id);
                                                                const url = typeof existing === 'object' ? existing.url : '';
                                                                setBoardPlatformUrlDraft(url);
                                                                setBoardSelectedPlatform(p.id);
                                                            }}
                                                            className="w-full aspect-square flex items-center justify-center rounded-lg bg-white border border-stone-100 hover:bg-stone-50 hover:border-stone-300 transition-colors"
                                                            title={p.label}
                                                        >
                                                            {getPreviewPlatformIcon(p.id)}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button className="w-full py-1.5 text-[10px] font-bold rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors" onClick={_closeAllBoardAdding}>Cancel</button>
                                            </>
                                        ) : boardSelectedPlatform === 'EXTERNAL' ? (
                                            <>
                                                <div className="flex items-center gap-1.5 mb-2">
                                                    <span className="text-sm">🔗</span>
                                                    <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">External Link</p>
                                                </div>
                                                <input
                                                    className="w-full text-xs font-semibold bg-white/70 border border-stone-200 rounded px-2 py-1.5 mb-1.5 outline-none focus:ring-1 focus:ring-stone-400"
                                                    placeholder="Title"
                                                    value={boardLinkDraft.title}
                                                    autoFocus
                                                    onChange={e => setBoardLinkDraft(p => ({ ...p, title: e.target.value }))}
                                                />
                                                <input
                                                    className="w-full text-xs bg-white/70 border border-stone-200 rounded px-2 py-1.5 mb-2 outline-none focus:ring-1 focus:ring-stone-400"
                                                    placeholder="Paste URL (https://...)"
                                                    value={boardLinkDraft.url}
                                                    onChange={e => {
                                                        const url = e.target.value;
                                                        setBoardLinkDraft(p => {
                                                            let autoTitle = p.title;
                                                            if (!p.title) {
                                                                try {
                                                                    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '');
                                                                    autoTitle = hostname.charAt(0).toUpperCase() + hostname.slice(1).split('.')[0];
                                                                } catch {}
                                                            }
                                                            return { ...p, url, title: autoTitle };
                                                        });
                                                    }}
                                                />
                                                <div className="flex gap-1.5">
                                                    <button
                                                        className="flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-40"
                                                        disabled={!boardLinkDraft.url.trim() || !boardLinkDraft.title.trim()}
                                                        onClick={async () => {
                                                            const url = boardLinkDraft.url.trim();
                                                            if (!url) return;
                                                            let title = boardLinkDraft.title.trim();
                                                            if (!title) {
                                                                try {
                                                                    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '');
                                                                    title = hostname.charAt(0).toUpperCase() + hostname.slice(1).split('.')[0];
                                                                } catch { title = url; }
                                                            }
                                                            await saveBoardLinkChange([...(editedCreator.links || []), { id: `link_${Date.now()}`, title, url, type: 'EXTERNAL', iconShape: 'square-s', displayStyle: 'icon' }]);
                                                            _closeAllBoardAdding();
                                                        }}
                                                    >Add Link</button>
                                                    <button className="flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors" onClick={() => { setBoardSelectedPlatform(null); setBoardLinkDraft({ title: '', url: '', price: '', type: 'EXTERNAL', color: undefined }); }}>Back</button>
                                                </div>
                                            </>
                                        ) : (() => {
                                            const platformDef = SUPPORTED_PLATFORMS.find(p => p.id === boardSelectedPlatform);
                                            return (
                                                <>
                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        {getPreviewPlatformIcon(boardSelectedPlatform)}
                                                        <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">{platformDef?.label}</p>
                                                    </div>
                                                    <input
                                                        className="w-full text-xs bg-white/70 border border-stone-200 rounded px-2 py-1.5 mb-2 outline-none focus:ring-1 focus:ring-stone-400"
                                                        placeholder="Paste URL..."
                                                        value={boardPlatformUrlDraft}
                                                        autoFocus
                                                        onChange={e => setBoardPlatformUrlDraft(e.target.value)}
                                                        onKeyDown={async e => {
                                                            if (e.key === 'Enter') {
                                                                const url = boardPlatformUrlDraft.trim();
                                                                if (url) {
                                                                    _closeAllBoardAdding();
                                                                    await saveBoardLinkChange([...(editedCreator.links || []), { id: `link_${Date.now()}`, title: platformDef?.label || 'Platform', url, type: 'EXTERNAL', iconShape: 'square-s', displayStyle: 'icon' }]);
                                                                }
                                                            }
                                                        }}
                                                    />
                                                    <div className="flex gap-1.5">
                                                        <button
                                                            className="flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-40"
                                                            disabled={!boardPlatformUrlDraft.trim()}
                                                            onClick={async () => {
                                                                const url = boardPlatformUrlDraft.trim();
                                                                if (!url) return;
                                                                _closeAllBoardAdding();
                                                                await saveBoardLinkChange([...(editedCreator.links || []), { id: `link_${Date.now()}`, title: platformDef?.label || 'Platform', url, type: 'EXTERNAL', iconShape: 'square-s', displayStyle: 'icon' }]);
                                                            }}
                                                        >Add Link</button>
                                                        <button
                                                            className="flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors"
                                                            onClick={() => { setBoardSelectedPlatform(null); setBoardPlatformUrlDraft(''); }}
                                                        >Back</button>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* ── 📦 Digital Product ── */}
                            {boardAddingProduct && (
                                <div className="flex flex-col" style={{ width: 240 }}>
                                    <div className="rounded-xl p-3 shadow-lg" style={{ backgroundColor: '#F5F3FF', border: '2px solid rgba(139,92,246,0.25)' }}>
                                        <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-2">📦 Digital Product</p>
                                        <input
                                            className="w-full text-xs font-semibold bg-white/70 border border-violet-200 rounded px-2 py-1.5 mb-1.5 outline-none focus:ring-1 focus:ring-violet-400"
                                            placeholder="Product name"
                                            value={boardLinkDraft.title}
                                            autoFocus
                                            onChange={e => setBoardLinkDraft(p => ({ ...p, title: e.target.value }))}
                                        />
                                        <input
                                            className="w-full text-xs bg-white/70 border border-violet-200 rounded px-2 py-1.5 mb-1.5 outline-none focus:ring-1 focus:ring-violet-400"
                                            placeholder="URL or file link"
                                            value={boardLinkDraft.url}
                                            onChange={e => setBoardLinkDraft(p => ({ ...p, url: e.target.value }))}
                                        />
                                        <input
                                            className="w-full text-xs bg-white/70 border border-violet-200 rounded px-2 py-1.5 mb-2 outline-none focus:ring-1 focus:ring-violet-400"
                                            placeholder="Price (credits)"
                                            value={boardLinkDraft.price}
                                            onChange={e => setBoardLinkDraft(p => ({ ...p, price: e.target.value }))}
                                        />
                                        <div className="flex gap-1.5">
                                            <button
                                                className="flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-40"
                                                disabled={!boardLinkDraft.title.trim() || !boardLinkDraft.url.trim()}
                                                onClick={async () => {
                                                    const title = boardLinkDraft.title.trim();
                                                    const url = boardLinkDraft.url.trim();
                                                    if (!title || !url) return;
                                                    await saveBoardLinkChange([...(editedCreator.links || []), {
                                                        id: `link_${Date.now()}`, title, url, type: 'DIGITAL_PRODUCT', iconShape: 'square-s', displayStyle: 'icon',
                                                        price: boardLinkDraft.price ? parseInt(boardLinkDraft.price) : undefined,
                                                    }]);
                                                    _closeAllBoardAdding();
                                                }}
                                            >Add Product</button>
                                            <button className="flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-violet-200 text-violet-500 hover:bg-violet-50 transition-colors" onClick={_closeAllBoardAdding}>Cancel</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── 💝 Support / Tip ── */}
                            {boardAddingSupport && (
                                <div className="flex flex-col" style={{ width: 220 }}>
                                    <div className="rounded-xl p-3 shadow-lg" style={{ backgroundColor: '#FDF2F8', border: '2px solid rgba(236,72,153,0.2)' }}>
                                        <p className="text-[10px] font-bold text-pink-500 uppercase tracking-wider mb-2">💝 Support / Tip</p>
                                        <input
                                            className="w-full text-xs font-semibold bg-white/70 border border-pink-200 rounded px-2 py-1.5 mb-1.5 outline-none focus:ring-1 focus:ring-pink-400"
                                            placeholder="Label (e.g. Buy me a coffee)"
                                            value={boardLinkDraft.title}
                                            autoFocus
                                            onChange={e => setBoardLinkDraft(p => ({ ...p, title: e.target.value }))}
                                        />
                                        <input
                                            className="w-full text-xs bg-white/70 border border-pink-200 rounded px-2 py-1.5 mb-2 outline-none focus:ring-1 focus:ring-pink-400"
                                            placeholder="Amount (credits)"
                                            value={boardLinkDraft.price}
                                            onChange={e => setBoardLinkDraft(p => ({ ...p, price: e.target.value }))}
                                        />
                                        <div className="flex gap-1.5">
                                            <button
                                                className="flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors disabled:opacity-40"
                                                disabled={!boardLinkDraft.title.trim()}
                                                onClick={async () => {
                                                    const title = boardLinkDraft.title.trim();
                                                    if (!title) return;
                                                    await saveBoardLinkChange([...(editedCreator.links || []), {
                                                        id: `link_${Date.now()}`, title, url: '#', type: 'SUPPORT', iconShape: 'square-s', displayStyle: 'icon',
                                                        price: boardLinkDraft.price ? parseInt(boardLinkDraft.price) : undefined,
                                                    }]);
                                                    _closeAllBoardAdding();
                                                }}
                                            >Add Support</button>
                                            <button className="flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-pink-200 text-pink-400 hover:bg-pink-50 transition-colors" onClick={_closeAllBoardAdding}>Cancel</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── 🖼 Photo ── */}
                            {boardAddingPhoto && (
                                <div className="flex flex-col" style={{ width: 240 }}>
                                    <div className="rounded-xl p-3 shadow-lg" style={{ backgroundColor: '#F0FDF4', border: '2px solid rgba(16,185,129,0.25)' }}>
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2">🖼 Photo</p>
                                        {boardPhotoDraft.previewUrl ? (
                                            <div className="relative rounded-md overflow-hidden mb-2 bg-stone-100" style={{ height: 120 }}>
                                                <img src={boardPhotoDraft.previewUrl} className="absolute inset-0 w-full h-full object-cover" alt="preview" />
                                                <button
                                                    className="absolute top-1 right-1 p-0.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                                                    onClick={() => setBoardPhotoDraft(p => ({ ...p, file: null, previewUrl: null }))}
                                                ><X size={10} /></button>
                                            </div>
                                        ) : (
                                            <label className="block w-full rounded-md border-2 border-dashed border-emerald-300 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer mb-2" style={{ height: 80 }}>
                                                <div className="h-full flex flex-col items-center justify-center gap-1">
                                                    <span className="text-lg">🖼</span>
                                                    <span className="text-[10px] text-emerald-600 font-semibold">Click to choose photo</span>
                                                </div>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        const reader = new FileReader();
                                                        reader.onload = ev => setBoardPhotoDraft(p => ({ ...p, file, previewUrl: ev.target?.result as string }));
                                                        reader.readAsDataURL(file);
                                                    }}
                                                />
                                            </label>
                                        )}
                                        <div className="flex gap-1.5">
                                            <button
                                                className="flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40"
                                                disabled={!boardPhotoDraft.file || boardPhotoDraft.isUploading}
                                                onClick={async () => {
                                                    if (!boardPhotoDraft.file) return;
                                                    setBoardPhotoDraft(p => ({ ...p, isUploading: true }));
                                                    try {
                                                        const url = await uploadPremiumContent(boardPhotoDraft.file, creator.id);
                                                        const newLink: AffiliateLink = { id: `link_${Date.now()}`, title: boardPhotoDraft.file!.name.replace(/\.[^.]+$/, '') || 'Photo', url, thumbnailUrl: url, type: 'PHOTO', width: 220, height: 160 };
                                                        await saveBoardLinkChange([...(editedCreator.links || []), newLink]);
                                                        _closeAllBoardAdding();
                                                    } catch {
                                                        setBoardPhotoDraft(p => ({ ...p, isUploading: false }));
                                                    }
                                                }}
                                            >{boardPhotoDraft.isUploading ? 'Uploading…' : 'Add Photo'}</button>
                                            <button
                                                className="flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-emerald-200 text-emerald-500 hover:bg-emerald-50 transition-colors"
                                                onClick={_closeAllBoardAdding}
                                            >Cancel</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── 🪵 Panel ── */}
                            {boardAddingPanel && (
                                <div className="flex flex-col" style={{ width: 240 }}>
                                    <div className="rounded-xl p-3 shadow-lg" style={{ backgroundColor: '#FDF8F0', border: '2px solid rgba(161,110,60,0.3)' }}>
                                        <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-2">🪵 Section Panel</p>
                                        <input
                                            className="w-full text-sm font-bold bg-white/70 border border-amber-200 rounded px-2 py-1.5 mb-2 outline-none focus:ring-1 focus:ring-amber-400"
                                            placeholder="e.g. FASHION, OUTFITS, Q&A…"
                                            value={boardPanelDraft.label}
                                            autoFocus
                                            onChange={e => setBoardPanelDraft(p => ({ ...p, label: e.target.value }))}
                                        />
                                        <p className="text-[9px] text-stone-400 font-semibold uppercase tracking-wider mb-1.5">Wood Style</p>
                                        <div className="flex gap-1.5 mb-3">
                                            {([
                                                { id: 'light', label: 'Light', bg: 'linear-gradient(160deg,#e8d5b0,#c9a870,#dfc090,#b8885a)', border: '#c9a870' },
                                                { id: 'dark',  label: 'Dark',  bg: 'linear-gradient(160deg,#7c5a38,#5c3d20,#6e4f2c,#4a2e14)', border: '#7c5a38' },
                                                { id: 'warm',  label: 'Warm',  bg: 'linear-gradient(160deg,#d4845a,#b05a30,#c86c40,#8c3a14)', border: '#b05a30' },
                                            ] as const).map(s => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => setBoardPanelDraft(p => ({ ...p, style: s.id }))}
                                                    className="flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all"
                                                    style={{
                                                        background: s.bg,
                                                        color: s.id === 'light' ? '#5c3d20' : '#f5e8d0',
                                                        border: boardPanelDraft.style === s.id ? `2px solid ${s.border}` : '2px solid transparent',
                                                        boxShadow: boardPanelDraft.style === s.id ? '0 0 0 2px rgba(0,0,0,0.15)' : 'none',
                                                    }}
                                                >{s.label}</button>
                                            ))}
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button
                                                className="flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-amber-700 text-white hover:bg-amber-800 transition-colors disabled:opacity-40"
                                                disabled={!boardPanelDraft.label.trim()}
                                                onClick={async () => {
                                                    const label = boardPanelDraft.label.trim();
                                                    if (!label) return;
                                                    const newPanel: AffiliateLink = {
                                                        id: `panel_${Date.now()}`,
                                                        title: label,
                                                        url: '',
                                                        type: 'PANEL',
                                                        buttonColor: boardPanelDraft.style,
                                                        width: Math.max(160, Math.min(360, label.length * 18 + 80)),
                                                        height: 64,
                                                    };
                                                    await saveBoardLinkChange([...(editedCreator.links || []), newPanel]);
                                                    setBoardPanelDraft({ label: '', style: 'light' });
                                                    _closeAllBoardAdding();
                                                }}
                                            >Add Panel</button>
                                            <button className="flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors" onClick={_closeAllBoardAdding}>Cancel</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* DESKTOP BUTTONS */}
                        {!isAddingSticker && (
                            <div className="hidden md:flex pointer-events-auto items-center justify-center gap-2 flex-wrap px-4 mt-3" style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.12))' }}>
                                <button className="rounded-xl py-2.5 px-3 border-2 border-dashed border-stone-300 text-stone-500 hover:border-stone-500 hover:text-stone-700 hover:bg-white/80 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }} onClick={() => { _closeAllBoardAdding(); setBoardAddingLink(true); }}>
                                    🔗 Link
                                </button>
                                <button className="rounded-xl py-2.5 px-3 border-2 border-dashed border-stone-300 text-stone-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50/60 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }} onClick={() => { _closeAllBoardAdding(); setBoardAddingProduct(true); setBoardLinkDraft({ title: '', url: '', price: '', type: 'DIGITAL_PRODUCT' }); }}>
                                    📦 Product
                                </button>
                                <button className="rounded-xl py-2.5 px-3 border-2 border-dashed border-stone-300 text-stone-500 hover:border-pink-400 hover:text-pink-600 hover:bg-pink-50/60 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }} onClick={() => { _closeAllBoardAdding(); setBoardAddingSupport(true); setBoardLinkDraft({ title: '', url: '', price: '', type: 'SUPPORT' }); }}>
                                    💝 Support
                                </button>
                                <button className="rounded-xl py-2.5 px-3 border-2 border-dashed border-stone-300 text-stone-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/60 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }} onClick={() => { _closeAllBoardAdding(); setBoardAddingPhoto(true); }}>
                                    🖼 Photo
                                </button>
                                <button className="rounded-xl py-2.5 px-3 border-2 border-dashed border-stone-300 text-stone-500 hover:border-amber-500 hover:text-amber-700 hover:bg-amber-50/60 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }} onClick={() => { _closeAllBoardAdding(); setBoardAddingPanel(true); }}>
                                    🪵 Panel
                                </button>
                                <button className={`rounded-xl py-2.5 px-4 border-2 border-dashed text-xs font-semibold transition-all flex items-center justify-center gap-2 ${boardChatPickerOpen ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-stone-300 text-stone-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/60'}`} style={{ backgroundColor: boardChatPickerOpen ? undefined : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }} onClick={() => { _closeAllBoardAdding(); setBoardChatPickerOpen(p => !p); }}>
                                    <MessageSquare size={13} /> From Chat
                                </button>
                            </div>
                        )}

                        {/* MOBILE FAB MENU */}
                        {!isAddingSticker && (
                            <div className="md:hidden pointer-events-auto flex flex-col items-end px-4 w-full mt-2">
                                {mobileAddMenuOpen && (
                                    <div className="flex flex-col gap-1.5 bg-white/90 backdrop-blur-xl p-3 rounded-2xl border border-stone-200 shadow-2xl mb-3 w-48 ml-auto animate-in slide-in-from-bottom-2">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 px-2">Add Sticker</p>
                                        <button className="flex items-center gap-3 text-sm font-semibold text-stone-700 py-2.5 px-3 hover:bg-stone-100 rounded-xl transition-colors" onClick={() => { _closeAllBoardAdding(); setBoardAddingLink(true); }}>
                                            <span className="text-lg leading-none">🔗</span> Link
                                        </button>
                                        <button className="flex items-center gap-3 text-sm font-semibold text-violet-700 py-2.5 px-3 hover:bg-violet-100 rounded-xl transition-colors" onClick={() => { _closeAllBoardAdding(); setBoardAddingProduct(true); setBoardLinkDraft({ title: '', url: '', price: '', type: 'DIGITAL_PRODUCT' }); }}>
                                            <span className="text-lg leading-none">📦</span> Product
                                        </button>
                                        <button className="flex items-center gap-3 text-sm font-semibold text-pink-600 py-2.5 px-3 hover:bg-pink-100 rounded-xl transition-colors" onClick={() => { _closeAllBoardAdding(); setBoardAddingSupport(true); setBoardLinkDraft({ title: '', url: '', price: '', type: 'SUPPORT' }); }}>
                                            <span className="text-lg leading-none">💝</span> Support / Tip
                                        </button>
                                        <button className="flex items-center gap-3 text-sm font-semibold text-emerald-600 py-2.5 px-3 hover:bg-emerald-100 rounded-xl transition-colors" onClick={() => { _closeAllBoardAdding(); setBoardAddingPhoto(true); }}>
                                            <span className="text-lg leading-none">🖼</span> Photo
                                        </button>
                                        <button className="flex items-center gap-3 text-sm font-semibold text-amber-700 py-2.5 px-3 hover:bg-amber-100 rounded-xl transition-colors" onClick={() => { _closeAllBoardAdding(); setBoardAddingPanel(true); }}>
                                            <span className="text-lg leading-none">🪵</span> Panel
                                        </button>
                                        <button className="flex items-center gap-3 text-sm font-semibold text-emerald-600 py-2.5 px-3 hover:bg-emerald-100 rounded-xl transition-colors" onClick={() => { _closeAllBoardAdding(); setBoardChatPickerOpen(true); }}>
                                            <span className="text-lg leading-none">💬</span> From Chat
                                        </button>
                                    </div>
                                )}
                                <button
                                    onClick={() => setMobileAddMenuOpen(!mobileAddMenuOpen)}
                                    className="bg-stone-900 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-transform ml-auto border-2 border-white/10"
                                >
                                    {mobileAddMenuOpen ? <X size={24} /> : <Plus size={24} />}
                                </button>
                            </div>
                        )}
                    </div>
                    );
                    })()}

                    {/* Chat history picker panel */}
                    {boardChatPickerOpen && (() => {
                        const repliedDMs = messages.filter(m => m.status === 'REPLIED' && m.replyContent);
                        const answeredBoardPosts = boardPosts.filter(p => p.isAddedToChat && !p.isPinned);
                        const totalItems = repliedDMs.length + answeredBoardPosts.length;
                        return (
                            <div
                                className="sticky bottom-0 z-10 mx-4 mb-4 rounded-2xl border border-stone-200 overflow-hidden"
                                style={{ background: 'rgba(250,249,246,0.97)', backdropFilter: 'blur(12px)', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)' }}
                            >
                                <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200/60">
                                    <div>
                                        <p className="text-xs font-bold text-stone-800">Pull from Answered</p>
                                        <p className="text-[10px] text-stone-400 mt-0.5">Pick an answered Q&A to feature on the board</p>
                                    </div>
                                    <button onClick={() => setBoardChatPickerOpen(false)} className="p-1.5 rounded-full text-stone-400 hover:bg-stone-200/60 transition-colors"><X size={14} /></button>
                                </div>
                                {totalItems === 0 ? (
                                    <div className="py-8 text-center text-stone-400 text-xs">No answered posts yet</div>
                                ) : (
                                    <div className="flex gap-3 overflow-x-auto p-4" style={{ scrollbarWidth: 'none' }}>
                                        {/* Answered board posts first */}
                                        {answeredBoardPosts.map(post => (
                                            <div
                                                key={post.id}
                                                className="flex-shrink-0 w-52 rounded-xl border p-3 cursor-pointer hover:border-stone-400 hover:shadow-md transition-all"
                                                style={{ backgroundColor: '#F0FDF4', border: '1px solid rgba(0,0,0,0.09)' }}
                                                onClick={async () => {
                                                    try {
                                                        await pinBoardPost(post.id, true);
                                                        setBoardPosts(prev => prev.map(p => p.id === post.id ? { ...p, isPinned: true } : p));
                                                    } catch {}
                                                }}
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                        {post.fanAvatarUrl
                                                            ? <img src={post.fanAvatarUrl} className="w-full h-full object-cover" alt={post.fanName} />
                                                            : <span className="text-white text-[9px] font-bold">{(post.fanName || '?').charAt(0).toUpperCase()}</span>}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-stone-700 truncate">{post.fanName || 'Fan'}</span>
                                                    <span className="ml-auto text-[9px] text-emerald-600 font-semibold flex-shrink-0 bg-emerald-50 px-1.5 py-0.5 rounded-full">Answered</span>
                                                </div>
                                                <p className="text-[10px] text-stone-600 line-clamp-2 mb-1.5 leading-relaxed">{post.content}</p>
                                                <div className="pt-1.5 border-t border-black/5">
                                                    <p className="text-[9px] text-stone-400 font-semibold uppercase tracking-wide mb-0.5">Reply</p>
                                                    <p className="text-[10px] text-stone-500 line-clamp-2 leading-relaxed">{post.reply}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {/* Replied DMs */}
                                        {repliedDMs.map(msg => {
                                            const alreadyOnBoard = boardPosts.some(p => p.content === msg.content && p.reply === msg.replyContent);
                                            return (
                                                <div
                                                    key={msg.id}
                                                    className={`flex-shrink-0 w-52 rounded-xl border p-3 transition-all ${alreadyOnBoard ? 'opacity-40 cursor-default' : 'cursor-pointer hover:border-stone-400 hover:shadow-md'}`}
                                                    style={{ backgroundColor: '#FFFEF0', border: alreadyOnBoard ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(0,0,0,0.09)' }}
                                                    onClick={async () => {
                                                        if (alreadyOnBoard) return;
                                                        try {
                                                            const newPost = await promoteMessageToBoardPost(
                                                                creator.id,
                                                                msg.senderName,
                                                                msg.senderAvatarUrl || null,
                                                                msg.content,
                                                                msg.replyContent!,
                                                            );
                                                            setBoardPosts(prev => [newPost, ...prev]);
                                                        } catch {}
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                            {msg.senderAvatarUrl
                                                                ? <img src={msg.senderAvatarUrl} className="w-full h-full object-cover" alt={msg.senderName} />
                                                                : <span className="text-white text-[9px] font-bold">{msg.senderName.charAt(0).toUpperCase()}</span>}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-stone-700 truncate">{msg.senderName}</span>
                                                        {alreadyOnBoard && <span className="ml-auto text-[9px] text-emerald-600 font-semibold flex-shrink-0">On board</span>}
                                                    </div>
                                                    <p className="text-[10px] text-stone-600 line-clamp-2 mb-1.5 leading-relaxed">{msg.content}</p>
                                                    <div className="pt-1.5 border-t border-black/5">
                                                        <p className="text-[9px] text-stone-400 font-semibold uppercase tracking-wide mb-0.5">Reply</p>
                                                        <p className="text-[10px] text-stone-500 line-clamp-2 leading-relaxed">{msg.replyContent}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

                    {/* Focus Zone Modal */}
                    {boardFocusModeOpen && (() => {
                        const CREATOR_CARD_ZONE = 300;
                        const BOARD_PAD = 32;
                        const GUIDE_COLS = 3;
                        const NOTE_W = 252;
                        const NOTE_H_EST = 272;
                        const NOTE_GAP_X = 28;
                        const NOTE_GAP_Y = 36;
                        const LINK_W = 220;
                        const LINK_AUTO_X = BOARD_PAD + GUIDE_COLS * (NOTE_W + NOTE_GAP_X) + 32;

                        const getLSz = (l: AffiliateLink): number | null => {
                            const effStyle = l.displayStyle || (l.iconShape ? 'icon' : 'wide');
                            if (effStyle !== 'icon') return null;
                            if (l.iconShape === 'square-s') return 32;
                            if (l.iconShape === 'square-m') return 44;
                            if (l.iconShape === 'square-l' || l.iconShape === 'square') return 64;
                            return null;
                        };
                        const getLH = (l: AffiliateLink): number => {
                            const sq = getLSz(l);
                            if (sq) return sq;
                            if (l.iconShape === 'square-xxs') return 44;
                            if (l.iconShape === 'square-s') return 40;
                            if (l.iconShape === 'square-m') return 56;
                            if (l.iconShape === 'square-l') return 84;
                            if (l.type === 'DIGITAL_PRODUCT') return 104;
                            if (l.url?.match(/youtube\.com|youtu\.be/)) return 162;
                            return 56;
                        };

                        const fposts = boardPosts.filter(p => p.isPinned);
                        const flinks = (editedCreator.links || []).filter(l => l.id !== '__diem_config__' && !l.hidden);

                        const fpostPos = fposts.map((p, idx) => {
                            if (p.positionX != null && p.positionY != null) return { x: p.positionX, y: p.positionY };
                            const col = idx % GUIDE_COLS, row = Math.floor(idx / GUIDE_COLS);
                            return { x: BOARD_PAD + col * (NOTE_W + NOTE_GAP_X), y: BOARD_PAD + row * (NOTE_H_EST + NOTE_GAP_Y) };
                        });
                        let aly = BOARD_PAD;
                        const flinkPos = flinks.map(l => {
                            if (l.positionX != null && l.positionY != null) return { x: l.positionX, y: l.positionY };
                            const pos = { x: LINK_AUTO_X, y: aly }; aly += getLH(l) + 14; return pos;
                        });

                        const maxPB = fpostPos.reduce((m, p) => Math.max(m, p.y + NOTE_H_EST), 440);
                        const maxLR = flinkPos.reduce((m, p, i) => {
                            const l = flinks[i];
                            const effStyle = l.displayStyle || (l.iconShape ? 'icon' : 'wide');
                            const cs = l.iconShape === 'square-s' ? 'S' : l.iconShape === 'square-l' ? 'L' : 'M';
                            const w = effStyle === 'icon' ? (getLSz(l) || LINK_W) : effStyle === 'thumbnail' ? (cs === 'S' ? 120 : cs === 'L' ? LINK_W : 160) : (cs === 'S' ? 110 : cs === 'L' ? getWideWidth(l.title) : 140);
                            return Math.max(m, p.x + w);
                        }, 640);
                        const maxLB = flinkPos.reduce((m, p, i) => Math.max(m, p.y + getLH(flinks[i])), 0);
                        const cH = Math.max(maxPB, maxLB) + 80;
                        const cW = Math.max(640, maxLR + 32);
                        const tH = CREATOR_CARD_ZONE + cH;

                        const MMAP_W = Math.min(typeof window !== 'undefined' ? window.innerWidth - 80 : 480, 500);
                        const MMAP_H = 200;
                        // guideOffsetX mirrors the actual board's horizontal centering margin
                        const GUIDE_DESKTOP_W = 640;
                        const mmGuideX = Math.max(0, (boardViewportW - GUIDE_DESKTOP_W) / 2);
                        const cWeff = cW + 2 * mmGuideX; // effective canvas width including centering margins
                        const mmScale = Math.min(MMAP_W / cWeff, MMAP_H / tH);

                        const DESKTOP_VW = 640, MOBILE_VW = 390, FOCUS_H = 440;

                        // anchor = top-left of viewport in content coords; shift by mmGuideX so minimap matches board
                        const aL = (mmGuideX + boardFocusAnchor.x) * mmScale;
                        const aT = boardFocusAnchor.y * mmScale;
                        const dW = DESKTOP_VW * mmScale;
                        const mW = MOBILE_VW * mmScale;
                        const fH = FOCUS_H * mmScale;

                        const startDrag = (e: React.MouseEvent) => {
                            e.preventDefault();
                            const sx = e.clientX, sy = e.clientY;
                            const sax = boardFocusAnchor.x, say = boardFocusAnchor.y;
                            const onMove = (ev: MouseEvent) => {
                                const dx = (ev.clientX - sx) / mmScale;
                                const dy = (ev.clientY - sy) / mmScale;
                                setBoardFocusAnchor({ x: Math.max(-DESKTOP_VW / 2, Math.min(cW - DESKTOP_VW / 2, sax + dx)), y: Math.max(CREATOR_CARD_ZONE, Math.min(tH - FOCUS_H, say + dy)) });
                            };
                            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                            document.addEventListener('mousemove', onMove);
                            document.addEventListener('mouseup', onUp);
                        };

                        return (
                            <div className="fixed inset-0 z-[500] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
                                <div className="w-full max-w-2xl bg-white rounded-t-2xl p-5 shadow-2xl animate-in slide-in-from-bottom-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <h3 className="font-bold text-stone-900 text-sm">Focus Zone</h3>
                                            <p className="text-[11px] text-stone-400 mt-0.5">Drag the frame to set where visitors zoom in after the eagle-eye overview</p>
                                        </div>
                                        <button onClick={() => setBoardFocusModeOpen(false)} className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 transition-colors"><X size={16} /></button>
                                    </div>

                                    {/* Legend */}
                                    <div className="flex gap-4 mb-3">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-sm border-2 border-indigo-400 bg-indigo-50 flex-shrink-0" />
                                            <span className="text-[11px] font-semibold text-stone-600">🖥 Computer (640px)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-sm border-2 border-orange-400 bg-orange-50 flex-shrink-0" style={{ borderStyle: 'dashed' }} />
                                            <span className="text-[11px] font-semibold text-stone-600">📱 Mobile (390px)</span>
                                        </div>
                                    </div>

                                    {/* Minimap */}
                                    <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider mb-1.5">Drag the frame or click to reposition</p>
                                    <div
                                        className="relative rounded-lg overflow-hidden border border-stone-200 mb-4 cursor-crosshair"
                                        style={{ width: MMAP_W, height: Math.max(100, tH * mmScale), background: 'linear-gradient(135deg,#FAFAF8 0%,#F5F3EF 100%)', backgroundImage: 'radial-gradient(circle,rgba(168,162,158,0.18) 1px,transparent 1px)', backgroundSize: `${Math.max(4, 24 * mmScale)}px ${Math.max(4, 24 * mmScale)}px` }}
                                        onClick={e => {
                                            const r = e.currentTarget.getBoundingClientRect();
                                            // subtract mmGuideX to convert minimap pixel → content coord
                                            const cx = (e.clientX - r.left) / mmScale - mmGuideX;
                                            const cy = (e.clientY - r.top) / mmScale;
                                            setBoardFocusAnchor({ x: Math.max(-DESKTOP_VW / 2, Math.min(cW - DESKTOP_VW / 2, cx - DESKTOP_VW / 2)), y: Math.max(CREATOR_CARD_ZONE, Math.min(tH - FOCUS_H, cy)) });
                                        }}
                                    >
                                        {/* Creator card placeholder — centered like the actual board */}
                                        <div style={{ position: 'absolute', left: (mmGuideX + cW / 2 - 130) * mmScale, top: 40 * mmScale, width: 260 * mmScale, height: (CREATOR_CARD_ZONE - 60) * mmScale, background: '#fff', borderRadius: 3, opacity: 0.9, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                                            <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', width: '60%', height: Math.max(2, 8 * mmScale), background: 'rgba(0,0,0,0.08)', borderRadius: 2 }} />
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translateX(-50%)', width: '40%', height: Math.max(2, 6 * mmScale), background: 'rgba(0,0,0,0.06)', borderRadius: 2 }} />
                                        </div>
                                        {/* Posts — offset by mmGuideX to match board centering */}
                                        {fpostPos.map((pos, i) => {
                                            const NC = ['#FFFEF0','#F0FDF4','#FFF7ED','#F5F3FF','#EFF6FF','#FDF2F8'];
                                            const TC = ['rgba(200,193,185,0.65)','rgba(110,200,140,0.55)','rgba(240,160,80,0.5)','rgba(180,150,240,0.5)','rgba(110,170,240,0.5)','rgba(240,140,180,0.5)'];
                                            let h = 0; for (let c = 0; c < fposts[i].id.length; c++) h = (h * 31 + fposts[i].id.charCodeAt(c)) & 0xFFFFFF;
                                            const ci = Math.abs(h) % NC.length;
                                            return (
                                                <div key={i} style={{ position: 'absolute', left: (mmGuideX + pos.x) * mmScale, top: (CREATOR_CARD_ZONE + pos.y) * mmScale, width: NOTE_W * mmScale, height: NOTE_H_EST * mmScale, background: NC[ci], borderRadius: 2, opacity: 0.93, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                                                    <div style={{ position: 'absolute', top: 0, left: '20%', width: '60%', height: Math.max(2.5, 10 * mmScale), background: TC[ci], borderRadius: 1 }} />
                                                </div>
                                            );
                                        })}
                                        {/* Links — offset by mmGuideX */}
                                        {flinkPos.map((pos, i) => {
                                            const LC = ['#FFF7ED','#F0FDF4','#EFF6FF','#FDF2F8','#FFFEF0','#F5F3FF'];
                                            const LT = ['rgba(240,160,80,0.5)','rgba(110,200,140,0.5)','rgba(110,170,240,0.45)','rgba(240,140,180,0.45)','rgba(200,193,185,0.6)','rgba(180,150,240,0.45)'];
                                            const ci = i % LC.length;
                                            const effStyle = flinks[i].displayStyle || (flinks[i].iconShape ? 'icon' : 'wide');
                                            return (
                                                <div key={i} style={{ position: 'absolute', left: (mmGuideX + pos.x) * mmScale, top: (CREATOR_CARD_ZONE + pos.y) * mmScale, width: (() => { const l = flinks[i]; const cs = l.iconShape === 'square-s' ? 'S' : l.iconShape === 'square-l' ? 'L' : 'M'; return effStyle === 'icon' ? (getLSz(l) || LINK_W) : effStyle === 'thumbnail' ? (cs === 'S' ? 120 : cs === 'L' ? LINK_W : 160) : (cs === 'S' ? 110 : cs === 'L' ? getWideWidth(l.title) : 140); })() * mmScale, height: getLH(flinks[i]) * mmScale, background: LC[ci], borderRadius: 2, opacity: 0.93, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                                                    <div style={{ position: 'absolute', top: 0, left: '20%', width: '60%', height: Math.max(2.5, 10 * mmScale), background: LT[ci], borderRadius: 1 }} />
                                                </div>
                                            );
                                        })}
                                        {/* Desktop box (blue, wider) */}
                                        <div
                                            style={{ position: 'absolute', left: aL, top: aT, width: dW, height: fH, border: '2px solid rgba(99,102,241,0.8)', background: 'rgba(99,102,241,0.08)', borderRadius: 2, cursor: 'move', boxShadow: '0 0 0 1px rgba(255,255,255,0.3)' }}
                                            onMouseDown={startDrag}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 8, fontWeight: 700, color: 'rgba(99,102,241,0.9)', textTransform: 'uppercase', letterSpacing: 1 }}>Desktop</span>
                                        </div>
                                        {/* Mobile box (orange, narrower, dashed) — centered within desktop */}
                                        <div
                                            style={{ position: 'absolute', left: aL + (dW - mW) / 2, top: aT, width: mW, height: fH, border: '2px dashed rgba(251,146,60,0.9)', background: 'rgba(251,146,60,0.06)', borderRadius: 2, pointerEvents: 'none' }}
                                        >
                                            <span style={{ position: 'absolute', top: 14, left: 4, fontSize: 8, fontWeight: 700, color: 'rgba(251,146,60,0.9)', textTransform: 'uppercase', letterSpacing: 1 }}>Mobile</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button onClick={() => setBoardFocusModeOpen(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-50 transition-colors">Cancel</button>
                                        <button
                                            onClick={async () => {
                                                // Camera center = anchor top-left + half viewport size
                                                const updated = {
                                                    ...editedCreator,
                                                    boardFocusDesktop: { x: boardFocusAnchor.x + DESKTOP_VW / 2, y: boardFocusAnchor.y + FOCUS_H / 2, zoom: 1.0 },
                                                    boardFocusMobile:  { x: boardFocusAnchor.x + DESKTOP_VW / 2, y: boardFocusAnchor.y + FOCUS_H / 2, zoom: 1.0 },
                                                };
                                                setEditedCreator(updated);
                                                setBoardFocusModeOpen(false);
                                                try { await updateCreatorProfile(updated); await onRefreshData(); } catch {}
                                            }}
                                            className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-stone-900 text-white hover:bg-stone-700 transition-colors"
                                        >Save Focus</button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

            {/* Board post popup modal */}
            {boardPopupPost && (() => {
                const post = boardPopupPost;
                const noteColors = ['#FFFEF0', '#F0FDF4', '#FFF7ED', '#F5F3FF', '#EFF6FF', '#FDF2F8'];
                const _stableIdx = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xFFFFFF; return Math.abs(h); };
                const nc = _stableIdx(post.id) % noteColors.length;
                const isReplying = boardReplyingId === post.id;
                const livePost = boardPosts.find(p => p.id === post.id) || post;
                return (
                    <div
                        className="fixed inset-0 z-[300] flex items-center justify-center p-4"
                        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
                        onClick={() => { setBoardPopupPost(null); setBoardReplyingId(null); }}
                    >
                        <div
                            className="animate-in fade-in zoom-in-95 duration-200 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
                            style={{
                                background: '#FAF9F6',
                                backgroundImage: 'linear-gradient(to right, rgba(168,162,158,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(168,162,158,0.08) 1px, transparent 1px)',
                                backgroundSize: '64px 64px',
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/60">
                                <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1 text-stone-400"><DiemLogo size={16} /></span>
                                    {livePost.isPinned
                                        ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100"><Pin size={8} className="fill-current" /> Pinned</span>
                                        : livePost.reply
                                            ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100"><CheckCircle2 size={8} className="fill-current" /> Answered</span>
                                            : null}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            const next = !livePost.isPinned;
                                            setBoardPosts(prev => prev.map(p => p.id === livePost.id ? { ...p, isPinned: next } : p));
                                            setBoardPopupPost(prev => prev ? { ...prev, isPinned: next } : null);
                                            pinBoardPost(livePost.id, next);
                                        }}
                                        className="flex items-center gap-2 text-xs font-medium hover:opacity-80 transition-opacity"
                                    >
                                        <span className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${livePost.isPinned ? 'bg-amber-400' : 'bg-stone-200'}`}>
                                            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${livePost.isPinned ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                        </span>
                                        <Pin size={10} className={livePost.isPinned ? 'text-amber-600 fill-current' : 'text-stone-400'} />
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await markBoardPostAsAddedToChat(livePost.id, false);
                                                if (livePost.isPinned) await pinBoardPost(livePost.id, false);
                                            } catch {}
                                            setBoardPosts(prev => prev.map(p => p.id === livePost.id ? { ...p, isAddedToChat: false, isPinned: false } : p));
                                            setBoardPopupPost(null);
                                        }}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-stone-500 hover:bg-stone-100 transition-colors text-[11px] font-medium"
                                        title="Remove from Chat"
                                    >
                                        <Trash2 size={12} /> Remove from Chat
                                    </button>
                                    <button onClick={() => { setBoardPopupPost(null); setBoardReplyingId(null); }} className="p-1.5 rounded-full text-stone-400 hover:bg-stone-200/60 transition-colors">
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Sticker color picker */}
                            <div className="flex items-center gap-2 px-5 py-2.5 border-b border-stone-100">
                                <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mr-1">Color</span>
                                {['#FFFEF0','#F0FDF4','#FFF7ED','#F5F3FF','#EFF6FF','#FDF2F8','#FFF1F2','#ECFDF5','#FFFBEB','#F0F9FF'].map(color => (
                                    <button
                                        key={color}
                                        onClick={() => {
                                            setBoardPosts(prev => prev.map(p => p.id === livePost.id ? { ...p, noteColor: color } : p));
                                            setBoardPopupPost(prev => prev ? { ...prev, noteColor: color } : null);
                                            updateBoardNoteColor(livePost.id, color);
                                        }}
                                        className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 flex-shrink-0"
                                        style={{
                                            backgroundColor: color,
                                            borderColor: (livePost.noteColor ?? noteColors[nc]) === color ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)',
                                            transform: (livePost.noteColor ?? noteColors[nc]) === color ? 'scale(1.2)' : undefined,
                                        }}
                                        title={color}
                                    />
                                ))}
                            </div>

                            {/* Thread content */}
                            <div className="px-5 py-5 space-y-1">
                                {/* Fan message */}
                                <div className="flex relative z-10">
                                    <div className="flex flex-col items-center mr-3 relative flex-shrink-0">
                                        {(livePost.reply || isReplying) && <div className="absolute left-[17px] top-11 -bottom-1 w-0.5 bg-stone-200" />}
                                        <div className="w-9 h-9 rounded-full overflow-hidden bg-stone-800 flex items-center justify-center flex-shrink-0">
                                            {livePost.fanAvatarUrl
                                                ? <img src={livePost.fanAvatarUrl} className="w-full h-full object-cover" alt={livePost.fanName} />
                                                : <div className="w-full h-full bg-stone-200 flex items-center justify-center"><User size={16} className="text-stone-500" /></div>}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0 pb-4">
                                        <div className="flex items-center gap-2 mb-2 ml-1 flex-wrap">
                                            <span className="font-semibold text-sm text-stone-900">{livePost.fanName}</span>
                                            <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                                <User size={9} className="fill-current" />
                                                <span className="text-[9px] font-semibold uppercase tracking-wide">Fan</span>
                                            </div>
                                            <span className="text-xs font-medium text-stone-400">• {new Date(livePost.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="bg-white p-3 sm:p-4 rounded-2xl rounded-tl-lg border border-stone-200/60">
                                            <p className="text-sm text-stone-700 leading-relaxed">{livePost.content}</p>
                                            {livePost.attachmentUrl && (
                                                /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(livePost.attachmentUrl)
                                                    ? <img src={livePost.attachmentUrl} className="mt-2 w-full max-h-48 object-cover rounded-xl" alt="attachment" />
                                                    : <a href={livePost.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 text-xs text-stone-500 hover:text-stone-800 font-medium transition-colors"><Paperclip size={12} /> {livePost.attachmentUrl.split('/').pop()}</a>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Creator reply */}
                                {livePost.reply ? (
                                    <div className="flex mt-1 relative z-10">
                                        <div className="flex flex-col items-center mr-3 flex-shrink-0">
                                            <div className="w-9 h-9 rounded-full overflow-hidden bg-stone-200 flex items-center justify-center">
                                                {creator.avatarUrl
                                                    ? <img src={creator.avatarUrl} className="w-full h-full object-cover" alt={creator.displayName} />
                                                    : <div className="w-full h-full bg-stone-200 flex items-center justify-center"><User size={16} className="text-stone-500" /></div>}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2 ml-1 flex-wrap">
                                                <span className="font-semibold text-sm text-stone-900">{creator.displayName}</span>
                                                <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                                    <CheckCircle2 size={10} className="text-blue-500" />
                                                    <span className="text-[9px] font-semibold uppercase tracking-wide">Creator</span>
                                                </div>
                                                {livePost.replyAt && <span className="text-xs font-medium text-stone-400">• {new Date(livePost.replyAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
                                            </div>
                                            <div className="bg-white p-3 sm:p-4 rounded-2xl rounded-tl-lg border border-stone-200/60">
                                                <p className="text-sm text-stone-700 leading-relaxed">{livePost.reply}</p>
                                                {livePost.replyAttachmentUrl && (
                                                    /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(livePost.replyAttachmentUrl)
                                                        ? <img src={livePost.replyAttachmentUrl} className="mt-2 w-full max-h-48 object-cover rounded-xl" alt="attachment" />
                                                        : <a href={livePost.replyAttachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 text-xs text-stone-500 hover:text-stone-800 font-medium transition-colors"><Paperclip size={12} /> {livePost.replyAttachmentUrl.split('/').pop()}</a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : isReplying ? (
                                    <div className="flex mt-4 relative z-10">
                                        <div className="w-9 h-9 rounded-full overflow-hidden bg-stone-200 flex items-center justify-center flex-shrink-0 mr-3">
                                            {creator.avatarUrl
                                                ? <img src={creator.avatarUrl} className="w-full h-full object-cover" alt="" />
                                                : <User size={16} className="text-stone-500" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <textarea
                                                autoFocus
                                                className="w-full text-sm bg-white border border-stone-200 rounded-2xl rounded-tl-lg p-3 outline-none resize-none focus:ring-1 focus:ring-stone-400 placeholder-stone-300"
                                                placeholder="Write your reply…"
                                                rows={3}
                                                value={boardReplyDraft[livePost.id] || ''}
                                                onChange={e => setBoardReplyDraft(prev => ({ ...prev, [livePost.id]: e.target.value }))}
                                            />
                                            {/* Attachment picker */}
                                            <input
                                                ref={boardReplyAttachmentInputRef}
                                                type="file"
                                                accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                                                className="hidden"
                                                onChange={e => {
                                                    const file = e.target.files?.[0] ?? null;
                                                    setBoardReplyAttachmentFile(file);
                                                    if (file && file.type.startsWith('image/')) {
                                                        const reader = new FileReader();
                                                        reader.onload = ev => setBoardReplyAttachmentPreview(ev.target?.result as string);
                                                        reader.readAsDataURL(file);
                                                    } else {
                                                        setBoardReplyAttachmentPreview(null);
                                                    }
                                                    e.target.value = '';
                                                }}
                                            />
                                            {boardReplyAttachmentFile ? (
                                                <div className="flex items-center gap-2 bg-stone-100 rounded-xl px-3 py-2 mt-2">
                                                    {boardReplyAttachmentPreview
                                                        ? <img src={boardReplyAttachmentPreview} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" alt="preview" />
                                                        : <div className="w-10 h-10 rounded-lg bg-stone-200 flex items-center justify-center flex-shrink-0"><Paperclip size={16} className="text-stone-500" /></div>}
                                                    <span className="text-xs text-stone-600 font-medium truncate flex-1">{boardReplyAttachmentFile.name}</span>
                                                    <button
                                                        onClick={() => { setBoardReplyAttachmentFile(null); setBoardReplyAttachmentPreview(null); }}
                                                        className="p-1 rounded-full hover:bg-stone-200 transition-colors text-stone-400"
                                                    ><X size={12} /></button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => boardReplyAttachmentInputRef.current?.click()}
                                                    className="mt-2 flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 font-medium transition-colors px-1"
                                                >
                                                    <Paperclip size={13} /> Add attachment
                                                </button>
                                            )}
                                            <div className="flex gap-2 mt-2">
                                                <button onClick={() => { setBoardReplyingId(null); setBoardReplyAttachmentFile(null); setBoardReplyAttachmentPreview(null); }} className="flex-1 py-2 text-xs font-semibold rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors">Cancel</button>
                                                <button
                                                    onClick={async () => {
                                                        const reply = boardReplyDraft[livePost.id]?.trim();
                                                        if (!reply) return;
                                                        try {
                                                            let replyAttachmentUrl: string | null = null;
                                                            if (boardReplyAttachmentFile && currentUser) {
                                                                replyAttachmentUrl = await uploadBoardAttachment(boardReplyAttachmentFile, currentUser.id);
                                                            }
                                                            await replyToBoardPost(livePost.id, reply, replyAttachmentUrl);
                                                            const updated = { ...livePost, reply, replyAt: new Date().toISOString(), replyAttachmentUrl };
                                                            setBoardPosts(prev => prev.map(p => p.id === livePost.id ? updated : p));
                                                            setBoardPopupPost(updated);
                                                            setBoardReplyingId(null);
                                                            setBoardReplyDraft(prev => { const n = { ...prev }; delete n[livePost.id]; return n; });
                                                            setBoardReplyAttachmentFile(null);
                                                            setBoardReplyAttachmentPreview(null);
                                                        } catch {}
                                                    }}
                                                    className="flex-1 py-2 text-xs font-semibold rounded-xl bg-stone-900 text-white hover:bg-stone-700 transition-colors"
                                                >Post Reply</button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-4">
                                        <button
                                            onClick={() => setBoardReplyingId(livePost.id)}
                                            className="w-full py-2.5 text-sm font-semibold rounded-xl bg-stone-900 text-white hover:bg-stone-700 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <MessageSquare size={14} /> Answer this question
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {currentView === 'INBOX' && (() => {
                const allBoardPostsSorted = boardPosts
                    .slice()
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                const inboxFiltered = allBoardPostsSorted.filter(p => {
                    if (inboxBoardFilter === 'PUBLIC') return !p.isPrivate;
                    if (inboxBoardFilter === 'PRIVATE') return p.isPrivate;
                    if (inboxBoardFilter === 'PENDING') return !p.reply;
                    if (inboxBoardFilter === 'ANSWERED') return !!p.reply;
                    return true; // ALL
                });
                const inboxPost = inboxSelectedPostId ? boardPosts.find(p => p.id === inboxSelectedPostId) ?? null : null;
                const noteColors = ['#FFFEF0', '#F0FDF4', '#FFF7ED', '#F5F3FF', '#EFF6FF', '#FDF2F8'];
                const rotations = [-1.8, 0.9, -0.7, 1.4, -1.1, 0.6];
                const stableIdx = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xFFFFFF; return Math.abs(h); };
                const isReplying = inboxPost ? boardReplyingId === inboxPost.id : false;
                return (
                <div className="h-full flex flex-col bg-[#FAF9F6] animate-in fade-in">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0">
                                <Menu size={24} />
                            </button>
                            <div>
                                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-0.5">All Posts</p>
                                <h2 className="text-xl sm:text-2xl font-bold text-stone-900">Inbox</h2>
                            </div>
                        </div>
                        <TopNav hideBurger />
                    </div>
                    <div className="flex flex-1 min-h-0 overflow-x-hidden">
                        {/* List Column */}
                        <div className={`w-full md:w-80 lg:w-96 border-r border-stone-200/60 flex flex-col ${inboxPost ? 'hidden md:flex' : 'flex'}`}
                            style={{ background: 'linear-gradient(135deg, #FAFAF8 0%, #F5F3EF 100%)', backgroundImage: 'linear-gradient(to right, rgba(168,162,158,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(168,162,158,0.07) 1px, transparent 1px)', backgroundSize: '28px 28px' }}>
                            <div className="p-2 border-b border-stone-200/40 bg-white/60 backdrop-blur-sm flex flex-wrap gap-1">
                                {([
                                    { key: 'ALL', label: 'All', count: allBoardPostsSorted.length },
                                    { key: 'PUBLIC', label: 'Public', count: allBoardPostsSorted.filter(p => !p.isPrivate).length },
                                    { key: 'PRIVATE', label: 'Private', count: allBoardPostsSorted.filter(p => p.isPrivate).length },
                                    { key: 'PENDING', label: 'Pending', count: allBoardPostsSorted.filter(p => !p.reply).length },
                                    { key: 'ANSWERED', label: 'Answered', count: allBoardPostsSorted.filter(p => !!p.reply).length },
                                ] as { key: 'ALL' | 'PUBLIC' | 'PRIVATE' | 'PENDING' | 'ANSWERED'; label: string; count: number }[]).map(f => (
                                    <button
                                        key={f.key}
                                        onClick={() => setInboxBoardFilter(f.key)}
                                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${inboxBoardFilter === f.key ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                                    >
                                        {f.label} <span className={`${inboxBoardFilter === f.key ? 'text-stone-300' : 'text-stone-400'}`}>({f.count})</span>
                                    </button>
                                ))}
                            </div>
                            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
                                {boardLoading ? (
                                    <div className="p-8 text-center text-sm text-stone-400 flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading…</div>
                                ) : inboxFiltered.length === 0 ? (
                                    <div className="p-8 text-center space-y-2">
                                        <div className="text-3xl">📭</div>
                                        <p className="text-sm text-stone-400 font-medium">
                                            {inboxBoardFilter === 'ALL' ? 'No posts yet' :
                                             inboxBoardFilter === 'PUBLIC' ? 'No public posts' :
                                             inboxBoardFilter === 'PRIVATE' ? 'No private posts' :
                                             inboxBoardFilter === 'PENDING' ? 'No pending posts' :
                                             'No answered posts yet'}
                                        </p>
                                        <p className="text-xs text-stone-300">
                                            {inboxBoardFilter === 'ANSWERED' ? 'Answer questions in inbox to see them here' : 'Board posts will appear here'}
                                        </p>
                                    </div>
                                ) : (
                                    inboxFiltered.map((post, noteIdx) => {
                                        const nc = stableIdx(post.id) % noteColors.length;
                                        const rot = rotations[nc];
                                        const isActive = inboxSelectedPostId === post.id;
                                        return (
                                            <div
                                                key={post.id}
                                                onClick={() => setInboxSelectedPostId(post.id)}
                                                className="relative cursor-pointer"
                                                style={{ transform: isActive ? 'rotate(0deg) scale(1.02)' : `rotate(${rot}deg)`, transition: 'transform 0.2s ease', zIndex: isActive ? 10 : 1 }}
                                            >
                                                <div
                                                    className="relative rounded-lg p-3 overflow-hidden"
                                                    style={{
                                                        backgroundColor: post.noteColor ?? noteColors[nc],
                                                        backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 23px, rgba(0,0,0,0.04) 23px, rgba(0,0,0,0.04) 24px)',
                                                        backgroundPositionY: '36px',
                                                        border: isActive ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                                                        boxShadow: isActive ? '0 6px 20px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.07)',
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-7 h-7 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0 overflow-hidden border border-stone-200/60">
                                                            {post.fanAvatarUrl
                                                                ? <img src={post.fanAvatarUrl} className="w-full h-full object-cover" alt={post.fanName} />
                                                                : <span className="text-white text-[10px] font-bold">{post.fanName.charAt(0).toUpperCase()}</span>}
                                                        </div>
                                                        <p className="text-sm font-bold truncate text-stone-700 flex-1">{post.fanName}</p>
                                                        {post.isPrivate && <Lock size={9} className="text-stone-400 flex-shrink-0" />}
                                                        {post.reply
                                                            ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">Answered</span>
                                                            : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 flex-shrink-0">Pending</span>}
                                                    </div>
                                                    <p className="text-xs text-stone-600 line-clamp-2 mb-1.5 leading-relaxed">{post.content}</p>
                                                    {post.reply && (
                                                        <div className="flex items-start gap-1.5 bg-black/5 rounded-lg px-2 py-1.5">
                                                            <CheckCircle2 size={9} className="text-blue-500 mt-0.5 flex-shrink-0" />
                                                            <p className="text-[10px] text-stone-500 line-clamp-2 leading-relaxed">{post.reply}</p>
                                                        </div>
                                                    )}
                                                    <p className="text-[9px] text-stone-400 mt-1.5">{getRelativeTime(post.replyAt ?? post.createdAt)}</p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Detail Column */}
                        <div className={`flex-1 flex flex-col bg-[#FAF9F6] ${!inboxPost ? 'hidden md:flex' : 'flex'}`}>
                            {!inboxPost ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-stone-400 relative">
                                    <div className="absolute inset-0 pointer-events-none" style={{
                                        backgroundImage: 'linear-gradient(to right, rgba(168,162,158,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(168,162,158,0.08) 1px, transparent 1px)',
                                        backgroundSize: '64px 64px',
                                        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 100%)',
                                        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 100%)',
                                    }} />
                                    <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4 relative z-10">
                                        <MessageSquare size={32} className="text-stone-300" />
                                    </div>
                                    <p className="text-sm font-medium relative z-10">Select a conversation</p>
                                    <p className="text-xs text-stone-300 mt-1 relative z-10">Answered board posts appear here</p>
                                </div>
                            ) : (() => {
                                const post = inboxPost;
                                const nc = stableIdx(post.id) % noteColors.length;
                                return (
                                    <div className="flex-1 flex flex-col overflow-hidden">
                                        {/* Thread header */}
                                        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200/60 bg-white/60 backdrop-blur-sm shrink-0">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setInboxSelectedPostId(null)}
                                                    className="md:hidden p-1.5 rounded-full hover:bg-stone-100 text-stone-400 transition-colors"
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>
                                                <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                    {post.fanAvatarUrl
                                                        ? <img src={post.fanAvatarUrl} className="w-full h-full object-cover" alt={post.fanName} />
                                                        : <span className="text-white text-xs font-bold">{post.fanName.charAt(0).toUpperCase()}</span>}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-stone-900">{post.fanName}</p>
                                                    <p className="text-[10px] text-stone-400">{new Date(post.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={async () => {
                                                        if (!window.confirm('Delete this post permanently?')) return;
                                                        try {
                                                            await deleteBoardPost(post.id);
                                                            setBoardPosts(prev => prev.filter(p => p.id !== post.id));
                                                            setInboxSelectedPostId(null);
                                                        } catch {}
                                                    }}
                                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-red-400 hover:bg-red-50 transition-colors text-[11px] font-medium"
                                                >
                                                    <Trash2 size={12} /> Delete permanently
                                                </button>
                                            </div>
                                        </div>

                                        {/* Thread content */}
                                        <div className="flex-1 overflow-y-auto px-5 py-5">
                                        <div className="max-w-2xl mx-auto space-y-1">
                                            {/* Fan message */}
                                            <div className="flex relative z-10">
                                                <div className="flex flex-col items-center mr-3 relative flex-shrink-0">
                                                    {post.reply && <div className="absolute left-[17px] top-11 -bottom-1 w-0.5 bg-stone-200" />}
                                                    <div className="w-9 h-9 rounded-full overflow-hidden bg-stone-800 flex items-center justify-center flex-shrink-0">
                                                        {post.fanAvatarUrl
                                                            ? <img src={post.fanAvatarUrl} className="w-full h-full object-cover" alt={post.fanName} />
                                                            : <div className="w-full h-full bg-stone-200 flex items-center justify-center"><User size={16} className="text-stone-500" /></div>}
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0 pb-4">
                                                    <div className="flex items-center gap-2 mb-2 ml-1 flex-wrap">
                                                        <span className="font-semibold text-sm text-stone-900">{post.fanName}</span>
                                                        <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                                            <User size={9} className="fill-current" />
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
                                                <div className="flex mt-1 relative z-10">
                                                    <div className="flex flex-col items-center mr-3 flex-shrink-0">
                                                        <div className="w-9 h-9 rounded-full overflow-hidden bg-stone-200 flex items-center justify-center">
                                                            {creator.avatarUrl
                                                                ? <img src={creator.avatarUrl} className="w-full h-full object-cover" alt={creator.displayName} />
                                                                : <div className="w-full h-full bg-stone-200 flex items-center justify-center"><User size={16} className="text-stone-500" /></div>}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-2 ml-1 flex-wrap">
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
                                                        {/* Add to Chat callout */}
                                                        <div className="mt-2 ml-1">
                                                            {post.isPrivate ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] text-stone-400 font-medium"><Lock size={9} /> Private — cannot be added to board</span>
                                                            ) : post.isAddedToChat ? (
                                                                <span className="inline-flex items-center gap-2 text-[10px] font-medium">
                                                                    <span className="text-emerald-600 flex items-center gap-1">
                                                                        <MessageSquare size={9} />
                                                                        {post.isPinned ? 'Pinned to Community Board' : 'In From Chat — ready to pin'}
                                                                    </span>
                                                                    <button
                                                                        onClick={async () => {
                                                                            try {
                                                                                await markBoardPostAsAddedToChat(post.id, false);
                                                                                if (post.isPinned) await pinBoardPost(post.id, false);
                                                                                setBoardPosts(prev => prev.map(p => p.id === post.id ? { ...p, isAddedToChat: false, isPinned: false } : p));
                                                                            } catch {}
                                                                        }}
                                                                        className="text-stone-400 hover:text-red-400 transition-colors underline"
                                                                    >Remove</button>
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={async () => {
                                                                        try {
                                                                            await markBoardPostAsAddedToChat(post.id, true);
                                                                            setBoardPosts(prev => prev.map(p => p.id === post.id ? { ...p, isAddedToChat: true } : p));
                                                                        } catch {}
                                                                    }}
                                                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-stone-500 hover:text-stone-800 bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-full transition-colors"
                                                                >
                                                                    <MessageSquare size={9} /> Add to Chat
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : isReplying ? (
                                                <div className="flex mt-4 relative z-10">
                                                    <div className="w-9 h-9 rounded-full overflow-hidden bg-stone-200 flex items-center justify-center flex-shrink-0 mr-3">
                                                        {creator.avatarUrl
                                                            ? <img src={creator.avatarUrl} className="w-full h-full object-cover" alt="" />
                                                            : <User size={16} className="text-stone-500" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <textarea
                                                            autoFocus
                                                            className="w-full text-sm bg-white border border-stone-200 rounded-2xl rounded-tl-lg p-3 outline-none resize-none focus:ring-1 focus:ring-stone-400 placeholder-stone-300"
                                                            placeholder="Write your reply…"
                                                            rows={3}
                                                            value={boardReplyDraft[post.id] || ''}
                                                            onChange={e => setBoardReplyDraft(prev => ({ ...prev, [post.id]: e.target.value }))}
                                                        />
                                                        <div className="flex gap-2 mt-2">
                                                            <button onClick={() => setBoardReplyingId(null)} className="flex-1 py-2 text-xs font-semibold rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors">Cancel</button>
                                                            <button
                                                                onClick={async () => {
                                                                    const reply = boardReplyDraft[post.id]?.trim();
                                                                    if (!reply) return;
                                                                    try {
                                                                        await replyToBoardPost(post.id, reply, null);
                                                                        const updated = { ...post, reply, replyAt: new Date().toISOString(), replyAttachmentUrl: null };
                                                                        setBoardPosts(prev => prev.map(p => p.id === post.id ? updated : p));
                                                                        setBoardReplyingId(null);
                                                                        setBoardReplyDraft(prev => { const n = { ...prev }; delete n[post.id]; return n; });
                                                                    } catch {}
                                                                }}
                                                                className="flex-1 py-2 text-xs font-semibold rounded-xl bg-stone-900 text-white hover:bg-stone-700 transition-colors"
                                                            >Post Reply</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-4">
                                                    <button
                                                        onClick={() => setBoardReplyingId(post.id)}
                                                        className="w-full py-2.5 text-sm font-semibold rounded-xl bg-stone-900 text-white hover:bg-stone-700 transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        <MessageSquare size={14} /> Answer this question
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* --- VIEW: SETTINGS (Profile) --- */}
            {currentView === 'SETTINGS' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 xl:max-w-[1200px] mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-stone-500 p-2 -ml-2 flex-shrink-0"><Menu size={24} /></button>
                            <h2 className="text-xl sm:text-2xl font-bold text-stone-900">{t('creator.profileSettings')}</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <TopNav hideBurger />
                        </div>
                    </div>
                    <div className="space-y-6">
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
                            {/* Avatar + Display Name — always visible above tabs */}
                            <div className={`flex items-center gap-4 ${showTutorial && tutorialStep === 0 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-xl p-3 -m-3' : ''}`}>
                                <div
                                    className="relative w-14 h-14 rounded-full bg-stone-100 flex-shrink-0 overflow-hidden border border-stone-200 cursor-pointer group"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <img
                                        src={editedCreator.avatarUrl || DEFAULT_AVATAR}
                                        alt="Avatar Preview"
                                        className="w-full h-full object-cover"
                                        onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                                    />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                                        <Camera size={18} className="text-white" />
                                    </div>
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarFileChange} />
                                <input
                                    type="text"
                                    value={editedCreator.displayName}
                                    onChange={e => setEditedCreator({...editedCreator, displayName: e.target.value})}
                                    placeholder="Display Name"
                                    className="flex-1 px-3 py-2 border border-stone-300 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none"
                                />
                            </div>

                            {/* Main tab switcher: General | Links | Style */}
                            <div className="flex bg-stone-100 rounded-xl p-1 gap-0.5">
                                {([{ key: 'general', label: 'General' }, { key: 'style', label: 'Style' }] as const).map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setSettingsMainTab(tab.key)}
                                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${settingsMainTab === tab.key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* STYLE TAB */}
                            {settingsMainTab === 'style' && (<>
                                {/* Profile Font Selector */}
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-2">Profile Font</label>
                                    <p className="text-[10px] text-stone-400 mb-2">Choose a font style for your public profile page.</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {([
                                            { id: 'inter', label: 'Inter', style: 'font-sans', sample: 'Clean & Modern' },
                                            { id: 'playfair', label: 'Playfair Display', style: "font-['Playfair_Display',serif]", sample: 'Elegant & Classic' },
                                            { id: 'space-grotesk', label: 'Space Grotesk', style: "font-['Space_Grotesk',sans-serif]", sample: 'Tech & Bold' },
                                            { id: 'dm-serif', label: 'DM Serif Text', style: "font-['DM_Serif_Text',serif]", sample: 'Warm & Editorial' },
                                        ] as const).map(font => (
                                            <button
                                                key={font.id}
                                                type="button"
                                                onClick={() => setEditedCreator({...editedCreator, profileFont: font.id})}
                                                className={`p-3 rounded-xl border text-left transition-all ${
                                                    (editedCreator.profileFont || 'inter') === font.id
                                                        ? 'bg-stone-50 border-stone-900 ring-1 ring-stone-900'
                                                        : 'bg-white border-stone-200 hover:border-stone-300'
                                                }`}
                                            >
                                                <span className={`block text-base font-semibold text-stone-900 mb-0.5 ${font.style}`}>{font.label}</span>
                                                <span className={`block text-xs text-stone-400 ${font.style}`}>{font.sample}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Corner Roundness */}
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-2">Corner Style</label>
                                    <p className="text-[10px] text-stone-400 mb-2">Controls the roundness of cards and link blocks on your profile.</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {([
                                            { id: 'soft', label: 'Soft', radius: '8px' },
                                            { id: 'rounded', label: 'Rounded', radius: '16px' },
                                            { id: 'pill', label: 'Pill', radius: '999px' },
                                        ] as const).map(opt => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => setEditedCreator({...editedCreator, cornerRadius: opt.id})}
                                                className={`p-3 flex flex-col items-center gap-2 border transition-all ${
                                                    (editedCreator.cornerRadius || 'rounded') === opt.id
                                                        ? 'bg-stone-50 border-stone-900 ring-1 ring-stone-900'
                                                        : 'bg-white border-stone-200 hover:border-stone-300'
                                                }`}
                                                style={{ borderRadius: '12px' }}
                                            >
                                                <div className="w-8 h-5 bg-stone-200" style={{ borderRadius: opt.radius }} />
                                                <span className="text-[10px] text-stone-500 font-medium">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Card Color */}
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-2">Card Color</label>
                                    <p className="text-[10px] text-stone-400 mb-2">Choose a background color for your public profile card.</p>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { label: 'White', value: undefined, bg: '#ffffff', border: '#e7e5e4' },
                                            { label: 'Stone', value: '#f5f4f2', bg: '#f5f4f2', border: '#d6d3d1' },
                                            { label: 'Slate', value: '#f1f5f9', bg: '#f1f5f9', border: '#cbd5e1' },
                                            { label: 'Rose', value: '#fff1f2', bg: '#fff1f2', border: '#fecdd3' },
                                            { label: 'Amber', value: '#fffbeb', bg: '#fffbeb', border: '#fde68a' },
                                            { label: 'Emerald', value: '#ecfdf5', bg: '#ecfdf5', border: '#a7f3d0' },
                                            { label: 'Sky', value: '#f0f9ff', bg: '#f0f9ff', border: '#bae6fd' },
                                            { label: 'Violet', value: '#f5f3ff', bg: '#f5f3ff', border: '#ddd6fe' },
                                            { label: 'Black', value: '#1c1917', bg: '#1c1917', border: '#44403c' },
                                        ].map(opt => {
                                            const current = editedCreator.bannerGradient;
                                            const isSelected = opt.value === undefined ? !current : current === opt.value;
                                            return (
                                                <button
                                                    key={opt.label}
                                                    type="button"
                                                    title={opt.label}
                                                    onClick={() => setEditedCreator({...editedCreator, bannerGradient: opt.value})}
                                                    className={`w-8 h-8 rounded-full transition-all border-2 ${isSelected ? 'scale-110 ring-2 ring-offset-2 ring-stone-500' : 'hover:scale-105'}`}
                                                    style={{ backgroundColor: opt.bg, borderColor: opt.border }}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Banner Design */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <label className="block text-sm font-medium text-stone-700">Banner Design</label>
                                            <p className="text-[10px] text-stone-400 mt-0.5">Show a wide cover photo at the top of your profile card.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setEditedCreator(p => ({ ...p, bannerDesign: !p.bannerDesign }))}
                                            className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${editedCreator.bannerDesign ? 'bg-stone-800' : 'bg-stone-200'}`}
                                            style={{ width: 40, height: 22 }}
                                        >
                                            <span
                                                className="absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform"
                                                style={{ width: 18, height: 18, transform: editedCreator.bannerDesign ? 'translateX(18px)' : 'translateX(0)' }}
                                            />
                                        </button>
                                    </div>
                                    {editedCreator.bannerDesign && (
                                        <div
                                            className="relative w-full h-32 rounded-xl overflow-hidden border-2 border-dashed border-stone-300 cursor-pointer hover:border-stone-500 transition-colors flex items-center justify-center bg-stone-50"
                                            onClick={() => bannerFileInputRef.current?.click()}
                                        >
                                            {editedCreator.bannerPhotoUrl ? (
                                                <>
                                                    <img src={editedCreator.bannerPhotoUrl} className="absolute inset-0 w-full h-full object-cover" alt="Banner" />
                                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                        <span className="text-white text-xs font-semibold flex items-center gap-1.5"><Camera size={14} /> Change Photo</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-stone-400">
                                                    <Camera size={20} />
                                                    <span className="text-xs font-medium">Upload Banner Photo</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <input type="file" ref={bannerFileInputRef} className="hidden" accept="image/*" onChange={handleBannerFileChange} />
                                </div>
                            </>)}

                            {/* GENERAL TAB */}
                            {settingsMainTab === 'general' && (<>
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
                            <div className={showTutorial && tutorialStep >= 1 && tutorialStep <= 3 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-xl p-1 -m-1' : ''}>
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
                            </>)}

                        </div>

                        <div className="mt-8 flex justify-center">
                            <Button onClick={handleSaveProfile} isLoading={isSavingProfile} className="px-8">Save Changes</Button>
                        </div>
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
                            <h3 className="text-sm font-bold text-stone-900">{t('creator.notificationsTitle')}</h3>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-stone-500">{t('creator.items', { count: notifications.length })}</span>
                                {notifications.length > 0 && (
                                    <button onClick={handleClearAllNotifications} className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors flex items-center gap-1">
                                        <Trash size={12} /> {t('creator.clearAll')}
                                    </button>
                                )}
                            </div>
                        </div>
                        {/* Mobile: all items */}
                        <div className="md:hidden divide-y divide-stone-100">
                            {notifications.length === 0 ? <div className="p-10 text-center text-stone-400 text-sm">{t('creator.noNotifications')}</div> : notifications.map(renderRow)}
                        </div>
                        {/* Desktop: paginated */}
                        <div className="hidden md:block divide-y divide-stone-100">
                            {displayedDesktop.length === 0 ? <div className="p-12 text-center text-stone-400 text-sm">{t('creator.noNotifications')}</div> : displayedDesktop.map(renderRow)}
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
                            <h3 className="text-sm font-bold text-stone-900">{t('creator.allReviews')}</h3>
                            <span className="text-xs text-stone-500">{t('creator.reviewsCount', { count: reviews.length })}</span>
                        </div>
                        <div className="divide-y divide-stone-100">
                            {displayedReviews.length === 0 ? (
                                <div className="p-12 text-center text-stone-400 text-sm">{t('creator.noReviewsYet')}</div>
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
                                        <p className="text-sm text-stone-600 italic mb-2">"{review.reviewContent || t('creator.noWrittenReview')}"</p>
                                        <div className="text-xs text-stone-400">
                                            {t('creator.sessionAmount')} <span className="font-medium text-stone-600">{review.amount} {t('common.credits')}</span>
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
                            <span className="text-xs font-bold text-stone-600">{t('common.page', { current: reviewsPage, total: Math.max(1, totalPages) })}</span>
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
                            <h3 className="text-2xl font-black text-stone-900 mb-2">{t('creator.creatorSupport')}</h3>
                            <p className="text-stone-500 text-sm leading-relaxed">
                                {t('creator.supportDesc')}
                            </p>
                         </div>

                         <div className="space-y-3 pt-2">
                             <Button fullWidth className="h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-stone-900/10" onClick={() => { setCurrentView('INBOX'); setSelectedSenderEmail('abe7340@gmail.com'); }}>
                                <MessageSquare size={18}/> {t('creator.contactSupport')}
                             </Button>
                             <Button fullWidth variant="secondary" className="h-12 rounded-xl flex items-center justify-center gap-2 bg-stone-50 hover:bg-stone-100 border border-stone-200">
                                <FileText size={18}/> {t('creator.creatorGuide')}
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
      {/* Unsaved Changes Modal */}
      {pendingNavigateView && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-lg">⚠️</span>
            </div>
            <h3 className="text-base font-bold text-stone-900 mb-1">Unsaved Changes</h3>
            <p className="text-sm text-stone-500 mb-5">You have unsaved changes to your profile. What would you like to do?</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  await handleSaveProfile();
                  const dest = pendingNavigateView;
                  setPendingNavigateView(null);
                  executeNavigate(dest);
                }}
                disabled={isSavingProfile}
                className="w-full px-4 py-2.5 bg-stone-900 hover:bg-stone-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingProfile ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/> Saving…</> : 'Save & Continue'}
              </button>
              <button
                onClick={() => {
                  const dest = pendingNavigateView;
                  setPendingNavigateView(null);
                  setEditedCreator(creator);
                  executeNavigate(dest!);
                }}
                className="w-full px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold rounded-xl transition-colors"
              >
                Discard & Leave
              </button>
              <button
                onClick={() => setPendingNavigateView(null)}
                className="w-full px-4 py-2 text-stone-400 hover:text-stone-600 text-sm transition-colors"
              >
                Stay on Page
              </button>
            </div>
          </div>
        </div>
      )}

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
                    {['📸', '✍️', '📋', '💬', '🔗', '📂'][tutorialStep]}
                  </span>
                  <span className="font-bold text-stone-900 text-sm">{TUTORIAL_STEPS[tutorialStep].title}</span>
                </div>
                <span className="text-[11px] text-stone-400 font-medium shrink-0 ml-2">{tutorialStep + 1} / {TUTORIAL_STEPS.length}</span>
              </div>
              <p className="text-sm text-stone-500 leading-relaxed mb-4">{TUTORIAL_STEPS[tutorialStep].desc}</p>
              {tutorialStep === 0 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full mb-3 px-4 py-2 bg-amber-400 hover:bg-amber-500 text-stone-900 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Camera size={15} /> Upload Photo Now
                </button>
              )}
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
