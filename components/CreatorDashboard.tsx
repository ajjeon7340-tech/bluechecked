
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/config';
import { CreatorProfile, Message, DashboardStats, MonthlyStat, AffiliateLink, LinkSection, ProAnalyticsData, StatTimeFrame, DetailedStat, DetailedFinancialStat, CurrentUser } from '../types';
import { getMessages, getChatLines, invalidateChatLinesCache, replyToMessage, updateCreatorProfile, markMessageAsRead, cancelMessage, getHistoricalStats, getProAnalytics, getDetailedStatistics, getFinancialStatistics, DEFAULT_AVATAR, subscribeToMessages, uploadProductFile, uploadPremiumContent, editChatMessage, deleteChatLine, connectStripeAccount, getStripeConnectionStatus, requestWithdrawal, getWithdrawalHistory, sendWelcomeMessage, sendSupportMessage, Withdrawal, isBackendConfigured, getBoardPosts, getPendingBoardPosts, replyToBoardPost, deleteBoardPost, updateBoardPostVisibility, pinBoardPost, updateBoardNoteColor, updateBoardPostPosition, promoteMessageToBoardPost, uploadBoardAttachment, BoardPost} from '../services/realBackend';
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
            <div className="border border-stone-200/60 relative" style={{ backgroundColor: creator.bannerGradient || '#ffffff', borderRadius: cardRadius }}>
                    <div className="absolute top-3 left-3 z-30">
                        <DiemLogo size={compact ? 16 : 18} className="text-stone-800" />
                    </div>
                    <div className="absolute top-3 right-3 z-30">
                        <div className="w-6 h-6 bg-stone-100 rounded-full flex items-center justify-center">
                            <ExternalLink size={10} className="text-stone-400" />
                        </div>
                    </div>
                    {/* Avatar + bio + name */}
                    <div className="px-3 pt-6 pb-4 flex flex-col items-center text-center gap-2">
                    {/* Bio bubble is absolutely positioned above avatar — add top padding to make room */}
                    <div className={`relative flex flex-col items-center ${(creator.showBio ?? true) && creator.bio ? (compact ? 'mt-10' : 'mt-14') : ''}`}>
                        {/* Bio thought bubble — absolute, floats above avatar */}
                        {(creator.showBio ?? true) && creator.bio && (
                            <div className="absolute bottom-[80%] left-1/2 -translate-x-1/2 z-30" style={{ width: 'max-content', maxWidth: compact ? '160px' : '200px' }}>
                                <div className="bg-white rounded-[16px] px-3 py-2 shadow-sm border border-stone-200/60">
                                    <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-stone-800 leading-snug font-medium text-center`}>
                                        {creator.bio.length > (compact ? 60 : 100) ? creator.bio.slice(0, compact ? 60 : 100) + '…' : creator.bio}
                                    </p>
                                </div>
                                <div className="relative h-3 mt-0.5">
                                    <div className="absolute left-3 top-0 w-2 h-2 bg-white rounded-full shadow-sm border border-stone-200/60"></div>
                                    <div className="absolute left-5 top-1.5 w-1.5 h-1.5 bg-white rounded-full shadow-sm border border-stone-200/60"></div>
                                </div>
                            </div>
                        )}
                        {/* Avatar */}
                        <div className={`${compact ? 'w-14 h-14' : 'w-20 h-20'} rounded-full p-0.5 border border-stone-100 shadow-sm bg-white overflow-hidden`}>
                            {creator.avatarUrl
                                ? <img src={creator.avatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
                                : <div className="w-full h-full rounded-full bg-stone-100 flex items-center justify-center"><User size={compact ? 18 : 28} className="text-stone-300" /></div>
                            }
                        </div>
                        {/* Like / rating badges — overlap bottom of avatar */}
                        <div className="flex items-center gap-1.5 -mt-3 relative z-10">
                            {(creator.showLikes ?? true) && (
                                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-full border border-stone-100 text-[10px] font-bold text-stone-500 shadow-sm">
                                    <Heart size={10} /> <span>{creator.stats?.totalMessages || 0}</span>
                                </div>
                            )}
                            {(creator.showRating ?? true) && (
                                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-full border border-stone-100 text-[10px] font-bold text-stone-500 shadow-sm">
                                    <Star size={10} className="text-yellow-400 fill-yellow-400" /> <span>{(creator.stats?.averageRating || 0).toFixed(1)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Name + handle — shown clearly below badges */}
                    <div className="mt-1">
                        <p className={`${compact ? 'text-sm' : 'text-base'} font-bold text-stone-900 leading-tight`}>{creator.displayName || 'Your Name'}</p>
                        {creator.handle && creator.handle !== '@user' && (
                            <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-stone-500 mt-0.5`}>{creator.handle}</p>
                        )}
                    </div>
                    {/* Social platforms */}
                    {platforms.length > 0 && (
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                            {platforms.slice(0, compact ? 5 : 8).map(p => {
                                const pid = typeof p === 'string' ? p : p.id;
                                return (
                                    <div key={pid} className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} flex items-center justify-center rounded-full bg-stone-50 border border-stone-100`}>
                                        {getPreviewPlatformIcon(pid)}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
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
  const [boardFilter, setBoardFilter] = useState<'ALL' | 'PENDING' | 'ANSWERED' | 'LINKS'>('ALL');
  const [boardLinkEditId, setBoardLinkEditId] = useState<string | null>(null);
  const [boardAddingLink, setBoardAddingLink] = useState(false);
  const [boardAddingProduct, setBoardAddingProduct] = useState(false);
  const [boardAddingSupport, setBoardAddingSupport] = useState(false);
  const [boardAddingYoutube, setBoardAddingYoutube] = useState(false);
  const [boardAddingPlatform, setBoardAddingPlatform] = useState(false);
  const [boardSelectedPlatform, setBoardSelectedPlatform] = useState<string | null>(null);
  const [boardPlatformUrlDraft, setBoardPlatformUrlDraft] = useState('');
  const [boardYoutubeDraft, setBoardYoutubeDraft] = useState('');

  const _closeAllBoardAdding = () => {
    setBoardAddingLink(false);
    setBoardAddingProduct(false);
    setBoardAddingSupport(false);
    setBoardAddingYoutube(false);
    setBoardAddingPlatform(false);
    setBoardSelectedPlatform(null);
    setBoardPlatformUrlDraft('');
    setBoardChatPickerOpen(false);
    setBoardLinkDraft({ title: '', url: '', price: '', type: 'EXTERNAL', color: undefined });
    setBoardYoutubeDraft('');
  };
  const [boardLinkDraft, setBoardLinkDraft] = useState<{ title: string; url: string; price: string; type: 'EXTERNAL' | 'DIGITAL_PRODUCT' | 'SUPPORT'; color?: string }>({ title: '', url: '', price: '', type: 'EXTERNAL' });
  const [boardReplyDraft, setBoardReplyDraft] = useState<Record<string, string>>({});
  const [boardReplyingId, setBoardReplyingId] = useState<string | null>(null);
  const [boardReplyAttachmentFile, setBoardReplyAttachmentFile] = useState<File | null>(null);
  const [boardReplyAttachmentPreview, setBoardReplyAttachmentPreview] = useState<string | null>(null);
  const boardReplyAttachmentInputRef = useRef<HTMLInputElement>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [boardPopupPost, setBoardPopupPost] = useState<BoardPost | null>(null);
  const [inboxSelectedPostId, setInboxSelectedPostId] = useState<string | null>(null);
  const [inboxBoardFilter, setInboxBoardFilter] = useState<'ALL' | 'PINNED' | 'UNPINNED'>('ALL');
  const [boardPositions, setBoardPositions] = useState<Record<string, {x: number, y: number}>>({});
  const [boardDragging, setBoardDragging] = useState<{
      id: string;
      startMouseX: number;
      startMouseY: number;
      startNoteX: number;
      startNoteY: number;
  } | null>(null);
  const [boardChatPickerOpen, setBoardChatPickerOpen] = useState(false);
  const [boardLinkPositions, setBoardLinkPositions] = useState<Record<string, {x: number, y: number}>>({});
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

  // Long Press Drag State (Mobile)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{x: number, y: number} | null>(null);

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
  const [settingsMainTab, setSettingsMainTab] = useState<'general' | 'links' | 'style'>('general');

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
      setEditedCreator(prev => ({ ...prev, links: updatedLinks }));
      try { await updateCreatorProfile({ ...editedCreator, links: updatedLinks }); } catch {}
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
                <div className="h-full overflow-auto">
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
                            {(['ALL', 'PENDING', 'ANSWERED', 'LINKS'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setBoardFilter(f)}
                                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${boardFilter === f ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'}`}
                                >
                                    {f === 'ALL' ? `All (${boardPosts.length})` : f === 'PENDING' ? `Pending (${boardPosts.filter(p => !p.reply && !p.isPinned).length})` : f === 'ANSWERED' ? `Answered (${boardPosts.filter(p => !!p.reply || p.isPinned).length})` : `Links (${(editedCreator.links || []).filter(l => l.id !== '__diem_config__' && !l.hidden).length})`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Freeform corkboard canvas */}
                    <div
                        ref={el => {
                            (boardScrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                            if (el && boardViewportW === 0) {
                                setBoardViewportW(el.offsetWidth);
                                const ro = new ResizeObserver(() => setBoardViewportW(el.offsetWidth));
                                ro.observe(el);
                            }
                        }}
                        className="relative flex-1 overflow-auto"
                    >
                        {boardLoading ? (
                            <div className="flex items-center justify-center py-20 text-stone-400">
                                <Loader2 size={24} className="animate-spin" />
                            </div>
                        ) : (() => {
                            const visibleBoardLinks = (editedCreator.links || []).filter(l => l.id !== '__diem_config__' && !l.hidden);
                            const filtered = boardFilter === 'LINKS' ? [] : boardPosts.filter(p =>
                                boardFilter === 'ALL' ? true : boardFilter === 'PENDING' ? (!p.reply && !p.isPinned) : (!!p.reply || p.isPinned)
                            );
                            const showLinks = boardFilter === 'ALL' || boardFilter === 'LINKS';
                            if (filtered.length === 0 && (boardFilter !== 'LINKS' ? visibleBoardLinks.length === 0 : visibleBoardLinks.length === 0)) return (
                                <div className="text-center py-20 text-stone-400">
                                    <div className="text-4xl mb-3">📋</div>
                                    <p className="text-sm font-medium">{boardFilter === 'PENDING' ? 'No pending questions' : boardFilter === 'ANSWERED' ? 'No answered questions yet' : boardFilter === 'LINKS' ? 'No links added yet' : 'No posts on the board yet'}</p>
                                </div>
                            );

                            const NOTE_W = 252;
                            const NOTE_H_EST = 272;
                            const NOTE_GAP_X = 28;
                            const NOTE_GAP_Y = 36;
                            const COLS = 3;
                            const stableIdx = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xFFFFFF; return Math.abs(h); };
                            const BOARD_PAD = 32;

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
                                else if (p.positionX != null && p.positionY != null) savedPositions.set(p.id, { x: p.positionX, y: p.positionY });
                            });

                            // Second pass: assign positions for unsaved posts via adjacent-slot finder
                            const computedPositions = new Map<string, _BP>(savedPositions);
                            filtered.forEach((p, idx) => {
                                if (computedPositions.has(p.id)) return;
                                // Default grid slot
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
                                // Find adjacent non-colliding slot
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
                                computedPositions.set(p.id, gridPos); // fallback
                            });

                            const getPos = (post: BoardPost, _idx: number): _BP =>
                                computedPositions.get(post.id) ?? { x: BOARD_PAD, y: BOARD_PAD };

                            // Collision uses sticker body only (excludes tape strip at top)
                            const TAPE_H = 16;
                            // Actual rendered card body is ~140px — much shorter than NOTE_H_EST grid spacing
                            const COLLISION_BODY_H = 140;
                            const bodiesOverlap = (pos: {x: number, y: number}, op: {x: number, y: number}) =>
                                Math.abs(pos.x - op.x) < NOTE_W &&
                                Math.abs((pos.y + TAPE_H) - (op.y + TAPE_H)) < COLLISION_BODY_H;

                            // Find nearest non-colliding position via binary search along 8 directions
                            const resolveCollision = (droppedId: string, rawPos: {x: number, y: number}): {x: number, y: number} => {
                                const others = filtered.filter(p => p.id !== droppedId);
                                const isOverlapping = (pos: {x: number, y: number}) =>
                                    others.some((p) => {
                                        const op = boardPositions[p.id] || getPos(p, filtered.findIndex(f => f.id === p.id));
                                        return bodiesOverlap(pos, op);
                                    });
                                if (!isOverlapping(rawPos)) return rawPos;
                                const MAX_R = Math.max(NOTE_W, NOTE_H_EST) * 4;
                                const dirs = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]
                                    .map(([dx, dy]) => { const l = Math.sqrt(dx*dx+dy*dy); return [dx/l, dy/l]; });
                                let best: {x: number, y: number} | null = null;
                                let bestDist = Infinity;
                                for (const [dx, dy] of dirs) {
                                    let lo = 0, hi = MAX_R;
                                    while (hi - lo > 1) {
                                        const mid = (lo + hi) / 2;
                                        const c = { x: Math.max(0, rawPos.x + dx * mid), y: Math.max(0, rawPos.y + dy * mid) };
                                        if (isOverlapping(c)) lo = mid; else hi = mid;
                                    }
                                    const c = { x: Math.max(0, rawPos.x + dx * hi), y: Math.max(0, rawPos.y + dy * hi) };
                                    if (hi < bestDist && !isOverlapping(c)) { bestDist = hi; best = c; }
                                }
                                return best ?? rawPos;
                            };

                            // Extra buffer during drag so canvas always extends below the dragged card
                            const dragBuffer = boardDragging ? 500 : 160;
                            const maxY = filtered.reduce((max, post, idx) => {
                                const pos = getPos(post, idx);
                                return Math.max(max, pos.y + NOTE_H_EST + dragBuffer);
                            }, 400 + dragBuffer);

                            const noteColors = ['#FFFEF0', '#F0FDF4', '#FFF7ED', '#F5F3FF', '#EFF6FF', '#FDF2F8'];
                            const tapeColors = ['rgba(200,193,185,0.55)', 'rgba(110,200,140,0.45)', 'rgba(240,160,80,0.4)', 'rgba(180,150,240,0.4)', 'rgba(110,170,240,0.4)', 'rgba(240,140,180,0.4)'];
                            const stickers = ['⭐','❤️','✨','🌟','💙','🎯','🔥','💬','🌙','🌸'];
                            const rotations = [-2.1, 1.3, -0.8, 1.7, -1.4, 0.6, -1.9, 1.1, -0.5, 1.4];

                            const handleTapeMouseDown = (e: React.MouseEvent, postId: string, currentPos: {x: number, y: number}) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setBoardDragging({
                                    id: postId,
                                    startMouseX: e.clientX,
                                    startMouseY: e.clientY,
                                    startNoteX: currentPos.x,
                                    startNoteY: currentPos.y,
                                });
                                setSelectedBoardId(postId);
                            };

                            // Link sticker layout constants
                            const LINK_W = 220;
                            const LINK_START_X = BOARD_PAD + COLS * (NOTE_W + NOTE_GAP_X) + 32;
                            const _getLinkSize = (l: AffiliateLink) => {
                                if (l.iconShape === 'square-l') return 220;
                                if (l.iconShape === 'square-m') return 160;
                                if (l.iconShape === 'square-s' || l.iconShape === 'square') return 110;
                                return null;
                            };
                            const _getLinkH = (l: AffiliateLink) => {
                                const sqSize = _getLinkSize(l);
                                if (sqSize) return sqSize;
                                if (l.type === 'DIGITAL_PRODUCT') return 104;
                                try {
                                    const h = new URL(l.url.startsWith('http') ? l.url : `https://${l.url}`).hostname;
                                    if (h.includes('youtube.com') || h === 'youtu.be') return 162;
                                } catch {}
                                return 84;
                            };
                            const getLinkPos = (link: AffiliateLink, idx: number): {x: number, y: number} => {
                                if (boardLinkPositions[link.id]) return boardLinkPositions[link.id];
                                if (link.positionX !== null && link.positionX !== undefined && link.positionY !== null && link.positionY !== undefined) {
                                    return { x: link.positionX, y: link.positionY };
                                }
                                let y = BOARD_PAD;
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
                                setBoardLinkDragging({
                                    id: linkId,
                                    startMouseX: e.clientX,
                                    startMouseY: e.clientY,
                                    startNoteX: currentPos.x,
                                    startNoteY: currentPos.y,
                                });
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
                                    const dx = touch.clientX - boardDragging.startMouseX;
                                    const dy = touch.clientY - boardDragging.startMouseY;
                                    setBoardPositions(prev => ({ ...prev, [boardDragging.id]: { x: Math.max(0, boardDragging.startNoteX + dx), y: Math.max(0, boardDragging.startNoteY + dy) } }));
                                }
                                if (boardLinkDragging) {
                                    const dx = touch.clientX - boardLinkDragging.startMouseX;
                                    const dy = touch.clientY - boardLinkDragging.startMouseY;
                                    setBoardLinkPositions(prev => ({ ...prev, [boardLinkDragging.id]: { x: Math.max(0, boardLinkDragging.startNoteX + dx), y: Math.max(0, boardLinkDragging.startNoteY + dy) } }));
                                }
                            };

                            const handleCanvasMouseMove = (e: React.MouseEvent) => {
                                if (boardDragging) {
                                    const dx = e.clientX - boardDragging.startMouseX;
                                    const dy = e.clientY - boardDragging.startMouseY;
                                    setBoardPositions(prev => ({
                                        ...prev,
                                        [boardDragging.id]: {
                                            x: Math.max(0, boardDragging.startNoteX + dx),
                                            y: Math.max(0, boardDragging.startNoteY + dy),
                                        },
                                    }));
                                }
                                if (boardLinkDragging) {
                                    const dx = e.clientX - boardLinkDragging.startMouseX;
                                    const dy = e.clientY - boardLinkDragging.startMouseY;
                                    setBoardLinkPositions(prev => ({
                                        ...prev,
                                        [boardLinkDragging.id]: {
                                            x: Math.max(0, boardLinkDragging.startNoteX + dx),
                                            y: Math.max(0, boardLinkDragging.startNoteY + dy),
                                        },
                                    }));
                                }
                            };

                            const handleCanvasMouseUp = async () => {
                                if (boardDragging) {
                                    const rawPos = boardPositions[boardDragging.id];
                                    if (rawPos) {
                                        const finalPos = resolveCollision(boardDragging.id, rawPos);
                                        const moved = finalPos.x !== rawPos.x || finalPos.y !== rawPos.y;
                                        if (moved) {
                                            setBoardPositions(prev => ({ ...prev, [boardDragging.id]: finalPos }));
                                        }
                                        const allPositioned = filtered.map((p, idx) => ({
                                            id: p.id,
                                            pos: boardPositions[p.id] || getPos(p, idx),
                                        })).sort((a, b) => a.pos.y !== b.pos.y ? a.pos.y - b.pos.y : a.pos.x - b.pos.x);
                                        const order = allPositioned.findIndex(item => item.id === boardDragging.id);
                                        try {
                                            await updateBoardPostPosition(boardDragging.id, finalPos.x, finalPos.y, order);
                                            setBoardPosts(prev => prev.map(p => p.id === boardDragging.id ? { ...p, positionX: finalPos.x, positionY: finalPos.y, displayOrder: order } : p));
                                        } catch {}
                                    }
                                    setBoardDragging(null);
                                }
                                if (boardLinkDragging) {
                                    const pos = boardLinkPositions[boardLinkDragging.id];
                                    if (pos) {
                                        const updatedLinks = (editedCreator.links || []).map(l =>
                                            l.id === boardLinkDragging.id ? { ...l, positionX: pos.x, positionY: pos.y } : l
                                        );
                                        await saveBoardLinkChange(updatedLinks);
                                    }
                                    setBoardLinkDragging(null);
                                }
                            };

                            const linkMaxY = visibleBoardLinks.reduce((max, link, idx) => {
                                const pos = getLinkPos(link, idx);
                                return Math.max(max, pos.y + _getLinkH(link) + (boardLinkDragging ? 500 : 160));
                            }, 0);
                            const canvasH = Math.max(maxY, linkMaxY);

                            const linkColors = ['#FFF7ED', '#F0FDF4', '#EFF6FF', '#FDF2F8', '#FFFEF0', '#F5F3FF'];
                            const linkTapes = ['rgba(240,160,80,0.45)', 'rgba(110,200,140,0.45)', 'rgba(110,170,240,0.4)', 'rgba(240,140,180,0.4)', 'rgba(200,193,185,0.55)', 'rgba(180,150,240,0.4)'];

                            return (
                                <div
                                    ref={boardCanvasRef}
                                    className="relative w-full select-none"
                                    style={{
                                        minHeight: `${canvasH}px`,
                                        background: 'linear-gradient(135deg, #FAFAF8 0%, #F5F3EF 100%)',
                                        backgroundImage: 'radial-gradient(circle, rgba(168,162,158,0.15) 1px, transparent 1px)',
                                        backgroundSize: '24px 24px',
                                        cursor: boardDragging || boardLinkDragging ? 'grabbing' : 'default',
                                    }}
                                    onMouseMove={handleCanvasMouseMove}
                                    onMouseUp={handleCanvasMouseUp}
                                    onMouseLeave={handleCanvasMouseUp}
                                    onTouchMove={handleCanvasTouchMove}
                                    onTouchEnd={handleCanvasMouseUp}
                                    onTouchCancel={handleCanvasMouseUp}
                                >
                                    {/* Viewport guidelines — two rectangles showing exact visible area per device */}
                                    {boardViewportW > 0 && (() => {
                                        const BOARD_MAX_H = 440; // matches public profile max-height
                                        // Desktop: actual public board container = max-w-2xl(672) - px-4*2(32) = 640px
                                        const desktopVW = Math.min(640, boardViewportW);
                                        // Mobile: 390px screen - 32px padding = 358px
                                        const mobileVW = Math.min(358, desktopVW);
                                        const GuideRect = ({ w, h, color, dash, label }: { w: number; h: number; color: string; dash?: boolean; label: string }) => (
                                            <div className="absolute pointer-events-none" style={{ left: 0, top: 0, width: w, height: h, zIndex: 0 }}>
                                                <div className="absolute inset-0" style={{ border: `2px ${dash ? 'dashed' : 'solid'} ${color}`, borderRadius: 2 }} />
                                                {/* Top-right label */}
                                                <div className="absolute top-0 right-0 flex items-center gap-1 px-1.5 py-0.5 rounded-bl" style={{ background: `${color}22`, borderLeft: `1px solid ${color}55`, borderBottom: `1px solid ${color}55` }}>
                                                    <span className="text-[8px] font-bold uppercase tracking-wider select-none" style={{ color }}>{label}</span>
                                                </div>
                                                {/* Bottom-center scroll hint */}
                                                <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: `${color}22`, border: `1px solid ${color}55` }}>
                                                    <span className="text-[8px] font-bold select-none" style={{ color }}>↓ scroll to view more</span>
                                                </div>
                                                {/* Right-center scroll hint */}
                                                <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: `${color}22`, border: `1px solid ${color}55` }}>
                                                    <span className="text-[8px] font-bold select-none" style={{ color, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>→ scroll to view more</span>
                                                </div>
                                            </div>
                                        );
                                        return (
                                            <>
                                                {/* Desktop frame */}
                                                <GuideRect w={desktopVW} h={BOARD_MAX_H} color="rgba(99,102,241,0.5)" label="Computer" />
                                                {/* Mobile frame */}
                                                <GuideRect w={mobileVW} h={BOARD_MAX_H} color="rgba(251,146,60,0.6)" dash label="Mobile" />
                                            </>
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
                                        const sqSize = _getLinkSize(link);
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
                                        return (
                                            <div
                                                key={link.id}
                                                className="absolute flex flex-col group"
                                                style={{
                                                    left: currentPos.x,
                                                    top: currentPos.y,
                                                    width: sqSize || LINK_W,
                                                    transform: isDraggingLink ? 'rotate(0deg) scale(1.04)' : `rotate(${rot}deg)`,
                                                    transition: isDraggingLink ? 'none' : 'transform 0.2s ease',
                                                    zIndex: isDraggingLink ? 1000 : isEditingLink ? 50 : 2,
                                                }}
                                            >
                                                {/* Tape — drag handle */}
                                                <div
                                                    className={`h-4 mx-auto rounded-b-sm flex-shrink-0 ${sqSize ? (sqSize === 220 ? 'w-12' : sqSize === 160 ? 'w-10' : 'w-8') : 'w-12'}`}
                                                    style={{ background: linkTapes[lc], cursor: 'grab' }}
                                                    onMouseDown={e => handleLinkTapeMouseDown(e, link.id, currentPos)}
                                                    title="Drag to reposition"
                                                />
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
                                                        {/* Color swatches */}
                                                        <div className="flex items-center gap-1 mb-2.5" onClick={e => e.stopPropagation()}>
                                                            {['#FFFEF0','#F0FDF4','#FFF7ED','#F5F3FF','#EFF6FF','#FDF2F8','#FFF1F2','#ECFDF5','#FFFBEB','#F0F9FF'].map(c => (
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
                                                        </div>
                                                        {/* Size Swatches (Always visible for all links) */}
                                                        <div className="flex items-center gap-1 mb-2.5" onClick={e => e.stopPropagation()}>
                                                            <span className="text-[10px] font-bold text-stone-400 uppercase mr-1">Size</span>
                                                            {([['wide', 'Wide'], ['square-s', 'S'], ['square-m', 'M'], ['square-l', 'L']] as const).map(([sVal, sLabel]) => {
                                                                const isSelected = link.iconShape === sVal || (link.iconShape === 'square' && sVal === 'square-s') || (sVal === 'wide' && !['square-s', 'square-m', 'square-l', 'square'].includes(link.iconShape || ''));
                                                                return (
                                                                    <button
                                                                        key={sVal}
                                                                        onClick={async e => {
                                                                            e.stopPropagation();
                                                                            const shapeToSet = sVal === 'wide' ? undefined : sVal;
                                                                            const updatedLinks = (editedCreator.links || []).map(l => l.id === link.id ? { ...l, iconShape: shapeToSet } : l);
                                                                            await saveBoardLinkChange(updatedLinks);
                                                                        }}
                                                                        className={`flex-1 py-0.5 text-[10px] font-bold rounded border transition-colors ${isSelected ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}
                                                                    >
                                                                        {sLabel}
                                                                    </button>
                                                                );
                                                            })}
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
                                                        className={`relative rounded-lg p-3 ${sqSize ? 'aspect-square flex flex-col items-center justify-center text-center' : ''}`}
                                                        style={{
                                                            backgroundColor: link.buttonColor || linkColors[lc],
                                                            border: isDraggingLink ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                                                            boxShadow: isDraggingLink ? '0 16px 40px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.07)',
                                                        }}
                                                    >
                                                        {/* Action buttons — show on hover */}
                                                        <div className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center gap-1">
                                                            <button
                                                                className="p-1 rounded-full bg-white/80 text-stone-500 hover:text-stone-800 hover:bg-white transition-all shadow-sm"
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    setBoardLinkEditId(link.id);
                                                                    setBoardLinkDraft({ title: link.title, url: link.url, price: link.price?.toString() || '', type: (link.type as any) || 'EXTERNAL', color: link.buttonColor });
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
                                                        {_ytIdLink ? (
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
                                                        ) : sqSize ? (
                                                            <>
                                                                <div className={`${sqSize === 220 ? 'w-16 h-16 rounded-2xl mb-3' : sqSize === 160 ? 'w-14 h-14 rounded-2xl mb-2' : 'w-12 h-12 rounded-xl mb-1.5'} bg-white/60 shadow-sm border border-black/5 flex items-center justify-center mx-auto`}>
                                                                    {detectedPlatform ? (
                                                                        <div className={sqSize === 220 ? "scale-[2]" : sqSize === 160 ? "scale-[1.75]" : "scale-[1.5]"}>{getPreviewPlatformIcon(detectedPlatform)}</div>
                                                                    ) : link.thumbnailUrl?.startsWith('data:emoji,') ? (
                                                                        <span className={sqSize === 220 ? "text-4xl" : sqSize === 160 ? "text-3xl" : "text-2xl"}>{link.thumbnailUrl.replace('data:emoji,', '')}</span>
                                                                    ) : link.thumbnailUrl ? (
                                                                        <img src={link.thumbnailUrl} className={`w-full h-full object-cover ${sqSize >= 160 ? 'rounded-2xl' : 'rounded-xl'}`} alt={link.title} />
                                                                        ) : link.type === 'DIGITAL_PRODUCT' ? <ShoppingBag size={sqSize === 220 ? 24 : 20} className="text-violet-500" /> : link.type === 'SUPPORT' ? <Heart size={sqSize === 220 ? 24 : 20} className="text-pink-500" /> : <LinkIcon size={sqSize === 220 ? 24 : 20} className="text-stone-500" />}
                                                                </div>
                                                                <p className={`${sqSize === 220 ? 'text-lg mb-1 px-4' : sqSize === 160 ? 'text-base mb-1 px-2' : 'text-xs mb-0.5 px-1'} font-bold text-stone-800 leading-tight w-full truncate`}>{link.title}</p>
                                                                    <p className="text-[8px] text-stone-500 uppercase tracking-wider font-semibold">{link.type === 'DIGITAL_PRODUCT' ? 'Buy' : link.type === 'SUPPORT' ? 'Tip' : 'Visit'}</p>
                                                            </>
                                                        ) : link.type === 'DIGITAL_PRODUCT' ? (
                                                            <div className="flex flex-col h-full w-full">
                                                                <div className="flex items-center gap-2.5 pb-2.5">
                                                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/60 border border-black/5">
                                                                        {link.thumbnailUrl?.startsWith('data:emoji,') ? <span className="text-xl leading-none">{link.thumbnailUrl.replace('data:emoji,', '')}</span> : link.thumbnailUrl ? <img src={link.thumbnailUrl} className="w-full h-full object-cover rounded-lg" alt={link.title} /> : <ShoppingBag size={16} className="text-violet-400" />}
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
                                                        ) : link.type === 'SUPPORT' ? (
                                                            <div className="flex items-center gap-2.5 h-full w-full">
                                                                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/60 border border-black/5">
                                                                    {link.thumbnailUrl?.startsWith('data:emoji,') ? <span className="text-xl leading-none">{link.thumbnailUrl.replace('data:emoji,', '')}</span> : link.thumbnailUrl ? <img src={link.thumbnailUrl} className="w-full h-full object-cover rounded-lg" alt={link.title} /> : <Heart size={16} className="text-pink-400" />}
                                                                </div>
                                                                <div className="flex-1 min-w-0 text-left">
                                                                    <p className="text-xs font-bold text-stone-800 truncate">{link.title}</p>
                                                                </div>
                                                                <span className="text-[10px] font-bold text-pink-500 bg-pink-50 px-2 py-1 rounded-full flex-shrink-0">Tip ♥</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2.5 h-full w-full">
                                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/60 border border-black/5 text-stone-600">
                                                                    {link.thumbnailUrl?.startsWith('data:emoji,') ? <span className="text-base leading-none">{link.thumbnailUrl.replace('data:emoji,', '')}</span> : link.thumbnailUrl ? <img src={link.thumbnailUrl} className="w-full h-full object-cover rounded-lg" alt={link.title} /> : detectedPlatform ? getPreviewPlatformIcon(detectedPlatform) : <LinkIcon size={13} />}
                                                                </div>
                                                                <span className="text-xs font-semibold text-stone-700 truncate flex-1 text-left">{link.title}</span>
                                                                <ExternalLink size={9} className="text-stone-300 flex-shrink-0" />
                                                            </div>
                                                        )}
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
                                        // Expiry: 7 days from createdAt, unless pinned
                                        const _expMs = new Date(post.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000;
                                        const _msLeft = _expMs - Date.now();
                                        const _daysLeft = Math.floor(_msLeft / (24 * 60 * 60 * 1000));
                                        const _hoursLeft = Math.floor(_msLeft / (60 * 60 * 1000));
                                        const expiry = post.isPinned || post.reply
                                            ? null
                                            : _msLeft <= 0
                                                ? { text: 'Expired', cls: 'text-red-500 bg-red-50 border border-red-100' }
                                                : _daysLeft >= 2
                                                    ? { text: `${_daysLeft}d left`, cls: 'text-stone-400 bg-stone-50' }
                                                    : _daysLeft === 1
                                                        ? { text: '1d left', cls: 'text-amber-600 bg-amber-50 border border-amber-100' }
                                                        : { text: `${_hoursLeft}h left`, cls: 'text-red-500 bg-red-50 border border-red-100' };
                                        const isDragging = boardDragging?.id === post.id;
                                        const isHovered = !isDragging && !boardDragging && selectedBoardId === post.id;
                                        const isActive = isDragging || isHovered;
                                        const isReplying = boardReplyingId === post.id;
                                        const currentPos = boardPositions[post.id] || pos;

                                        return (
                                            <div
                                                key={post.id}
                                                className="absolute flex flex-col"
                                                style={{
                                                    left: currentPos.x,
                                                    top: currentPos.y,
                                                    width: NOTE_W,
                                                    transform: isActive ? 'rotate(0deg) scale(1.04)' : `rotate(${rot}deg)`,
                                                    transition: isDragging ? 'none' : 'transform 0.2s ease',
                                                    zIndex: isDragging ? 1000 : isActive ? 10 : 1,
                                                    cursor: isDragging ? 'grabbing' : 'pointer',
                                                }}
                                                onMouseEnter={() => !boardDragging && setSelectedBoardId(post.id)}
                                                onMouseLeave={() => !boardDragging && setSelectedBoardId(null)}
                                                onClick={() => !isDragging && setBoardPopupPost(post)}
                                                onTouchStart={e => handleNoteTouchStart(e, post.id, currentPos, 'POST')}
                                                onTouchMove={handleNoteTouchMove}
                                                onTouchEnd={cancelLongPress}
                                                onTouchCancel={cancelLongPress}
                                            >
                                                {/* Tape strip — drag handle */}
                                                <div
                                                    className="h-4 w-14 mx-auto rounded-b-sm flex-shrink-0"
                                                    style={{ background: tapeColors[nc], cursor: 'grab' }}
                                                    onMouseDown={e => handleTapeMouseDown(e, post.id, currentPos)}
                                                    title="Drag to reposition"
                                                />
                                                {/* Note card — use fan-chosen color if available */}
                                                <div
                                                    className="relative rounded-lg p-3 overflow-hidden"
                                                    style={{
                                                        backgroundColor: post.noteColor ?? noteColors[nc],
                                                        backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 23px, rgba(0,0,0,0.04) 23px, rgba(0,0,0,0.04) 24px)',
                                                        backgroundPositionY: '36px',
                                                        border: isActive ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                                                        boxShadow: isDragging ? '0 16px 40px rgba(0,0,0,0.2)' : isActive ? '0 6px 20px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.07)',
                                                    }}
                                                >
                                                    {/* Avatar + Name row */}
                                                    <div className="flex items-center gap-2.5 mb-2">
                                                        <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0 overflow-hidden border border-stone-200/60">
                                                            {post.fanAvatarUrl
                                                                ? <img src={post.fanAvatarUrl} className="w-full h-full object-cover" alt={post.fanName} />
                                                                : <span className="text-white text-xs font-bold">{post.fanName.charAt(0).toUpperCase()}</span>}
                                                        </div>
                                                        <p className="text-sm font-bold text-stone-800 truncate">{post.fanName}</p>
                                                    </div>
                                                    {/* Message preview */}
                                                    <p className="text-xs text-stone-500 line-clamp-2 mb-2.5 leading-relaxed">{post.content}</p>
                                                    {/* Footer */}
                                                    <div className="flex items-center justify-between gap-1 flex-wrap">
                                                        {post.reply
                                                            ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Answered</span>
                                                            : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">Awaiting reply</span>}
                                                        {post.isPinned
                                                            ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 flex items-center gap-0.5"><Pin size={8} className="fill-current" /> Pinned</span>
                                                            : expiry && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${expiry.cls}`}>{expiry.text}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Sticky bottom toolbar */}
                    <div className="sticky bottom-0 z-20 pb-4 pt-2 pointer-events-none">
                        <div className="pointer-events-auto flex items-end justify-center gap-3 flex-wrap px-4" style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.12))' }}>

                            {/* ── 🔗 External Link ── */}
                            {boardAddingLink ? (
                                <div className="flex flex-col" style={{ width: 240 }}>
                                    <div className="h-4 w-12 mx-auto rounded-b-sm flex-shrink-0" style={{ background: 'rgba(200,193,185,0.55)' }} />
                                    <div className="rounded-xl p-3 shadow-lg" style={{ backgroundColor: '#FFFEF0', border: '2px solid rgba(0,0,0,0.12)' }}>
                                        <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2">🔗 External Link</p>
                                        <input
                                            className="w-full text-xs bg-white/70 border border-stone-200 rounded px-2 py-1.5 mb-1.5 outline-none focus:ring-1 focus:ring-stone-400"
                                            placeholder="Paste URL (https://...)"
                                            value={boardLinkDraft.url}
                                            autoFocus
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
                                        <input
                                            className="w-full text-xs font-semibold bg-white/70 border border-stone-200 rounded px-2 py-1.5 mb-2 outline-none focus:ring-1 focus:ring-stone-400"
                                            placeholder="Title (auto-filled from URL)"
                                            value={boardLinkDraft.title}
                                            onChange={e => setBoardLinkDraft(p => ({ ...p, title: e.target.value }))}
                                        />
                                        <div className="flex gap-1.5">
                                            <button
                                                className="flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-40"
                                                disabled={!boardLinkDraft.url.trim()}
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
                                                    await saveBoardLinkChange([...(editedCreator.links || []), { id: `link_${Date.now()}`, title, url, type: 'EXTERNAL' }]);
                                                    _closeAllBoardAdding();
                                                }}
                                            >Add Link</button>
                                            <button className="flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors" onClick={_closeAllBoardAdding}>Cancel</button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col" style={{ width: 130 }}>
                                    <div className="h-4 w-10 mx-auto rounded-b-sm flex-shrink-0" style={{ background: 'rgba(200,193,185,0.45)' }} />
                                    <button
                                        className="rounded-xl py-2.5 px-3 border-2 border-dashed border-stone-300 text-stone-500 hover:border-stone-500 hover:text-stone-700 hover:bg-white/80 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold"
                                        style={{ backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }}
                                        onClick={() => { _closeAllBoardAdding(); setBoardAddingLink(true); }}
                                    >
                                        🔗 Link
                                    </button>
                                </div>
                            )}

                            {/* ── 📦 Digital Product ── */}
                            {boardAddingProduct ? (
                                <div className="flex flex-col" style={{ width: 240 }}>
                                    <div className="h-4 w-12 mx-auto rounded-b-sm flex-shrink-0" style={{ background: 'rgba(139,92,246,0.35)' }} />
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
                                                        id: `link_${Date.now()}`, title, url, type: 'DIGITAL_PRODUCT',
                                                        price: boardLinkDraft.price ? parseInt(boardLinkDraft.price) : undefined,
                                                    }]);
                                                    _closeAllBoardAdding();
                                                }}
                                            >Add Product</button>
                                            <button className="flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-violet-200 text-violet-500 hover:bg-violet-50 transition-colors" onClick={_closeAllBoardAdding}>Cancel</button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col" style={{ width: 130 }}>
                                    <div className="h-4 w-10 mx-auto rounded-b-sm flex-shrink-0" style={{ background: 'rgba(139,92,246,0.35)' }} />
                                    <button
                                        className="rounded-xl py-2.5 px-3 border-2 border-dashed border-stone-300 text-stone-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50/60 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold"
                                        style={{ backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }}
                                        onClick={() => { _closeAllBoardAdding(); setBoardAddingProduct(true); setBoardLinkDraft({ title: '', url: '', price: '', type: 'DIGITAL_PRODUCT' }); }}
                                    >
                                        📦 Product
                                    </button>
                                </div>
                            )}

                            {/* ── 💝 Support / Tip ── */}
                            {boardAddingSupport ? (
                                <div className="flex flex-col" style={{ width: 220 }}>
                                    <div className="h-4 w-12 mx-auto rounded-b-sm flex-shrink-0" style={{ background: 'rgba(236,72,153,0.3)' }} />
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
                                                        id: `link_${Date.now()}`, title, url: '#', type: 'SUPPORT',
                                                        price: boardLinkDraft.price ? parseInt(boardLinkDraft.price) : undefined,
                                                    }]);
                                                    _closeAllBoardAdding();
                                                }}
                                            >Add Support</button>
                                            <button className="flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-pink-200 text-pink-400 hover:bg-pink-50 transition-colors" onClick={_closeAllBoardAdding}>Cancel</button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col" style={{ width: 130 }}>
                                    <div className="h-4 w-10 mx-auto rounded-b-sm flex-shrink-0" style={{ background: 'rgba(236,72,153,0.3)' }} />
                                    <button
                                        className="rounded-xl py-2.5 px-3 border-2 border-dashed border-stone-300 text-stone-500 hover:border-pink-400 hover:text-pink-600 hover:bg-pink-50/60 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold"
                                        style={{ backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }}
                                        onClick={() => { _closeAllBoardAdding(); setBoardAddingSupport(true); setBoardLinkDraft({ title: '', url: '', price: '', type: 'SUPPORT' }); }}
                                    >
                                        💝 Support
                                    </button>
                                </div>
                            )}

                            {/* ── ▶ YouTube ── */}
                            {boardAddingYoutube ? (
                                <div className="flex flex-col" style={{ width: 240 }}>
                                    <div className="h-4 w-12 mx-auto rounded-b-sm flex-shrink-0" style={{ background: 'rgba(220,50,50,0.35)' }} />
                                    <div className="rounded-xl p-3 shadow-lg" style={{ backgroundColor: '#0f0f0f', border: '2px solid rgba(255,0,0,0.3)' }}>
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="#FF0000"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.03 0 12 0 12s0 3.97.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.97 24 12 24 12s0-3.97-.5-5.81zM9.75 15.52V8.48L15.5 12l-5.75 3.52z"/></svg>
                                            <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider">YouTube Video</p>
                                        </div>
                                        <input
                                            className="w-full text-xs bg-white/10 border border-white/20 rounded px-2 py-1.5 mb-2 outline-none text-white placeholder-white/40 focus:border-red-500/60"
                                            placeholder="Paste YouTube URL…"
                                            value={boardYoutubeDraft}
                                            autoFocus
                                            onChange={e => setBoardYoutubeDraft(e.target.value)}
                                            onKeyDown={async e => {
                                                if (e.key !== 'Enter') return;
                                                const url = boardYoutubeDraft.trim();
                                                if (!url) return;
                                                const newLink: AffiliateLink = { id: `link_${Date.now()}`, title: 'YouTube Video', url, type: 'EXTERNAL' };
                                                await saveBoardLinkChange([...(editedCreator.links || []), newLink]);
                                                setBoardAddingYoutube(false);
                                                setBoardYoutubeDraft('');
                                            }}
                                        />
                                        {/* Thumbnail preview */}
                                        {(() => {
                                            try {
                                                const u = new URL(boardYoutubeDraft.startsWith('http') ? boardYoutubeDraft : `https://${boardYoutubeDraft}`);
                                                const vid = u.hostname.includes('youtube.com') ? u.searchParams.get('v') : u.hostname === 'youtu.be' ? u.pathname.slice(1).split('?')[0] : null;
                                                if (vid) return (
                                                    <div className="relative rounded-md overflow-hidden mb-2" style={{ paddingBottom: '56.25%' }}>
                                                        <img src={`https://img.youtube.com/vi/${vid}/hqdefault.jpg`} className="absolute inset-0 w-full h-full object-cover" alt="thumbnail" />
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="w-8 h-6 bg-[#FF0000] rounded-md flex items-center justify-center shadow opacity-90">
                                                                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white ml-0.5"><path d="M8 5v14l11-7z"/></svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            } catch {}
                                            return null;
                                        })()}
                                        <div className="flex gap-1.5">
                                            <button
                                                className="flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-[#FF0000] text-white hover:bg-red-700 transition-colors disabled:opacity-40"
                                                disabled={!boardYoutubeDraft.trim()}
                                                onClick={async () => {
                                                    const url = boardYoutubeDraft.trim();
                                                    if (!url) return;
                                                    const newLink: AffiliateLink = { id: `link_${Date.now()}`, title: 'YouTube Video', url, type: 'EXTERNAL' };
                                                    await saveBoardLinkChange([...(editedCreator.links || []), newLink]);
                                                    setBoardAddingYoutube(false);
                                                    setBoardYoutubeDraft('');
                                                }}
                                            >Add Video</button>
                                            <button
                                                className="flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-white/20 text-white/60 hover:bg-white/10 transition-colors"
                                                onClick={() => { setBoardAddingYoutube(false); setBoardYoutubeDraft(''); }}
                                            >Cancel</button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col" style={{ width: 160 }}>
                                    <div className="h-4 w-10 mx-auto rounded-b-sm flex-shrink-0" style={{ background: 'rgba(220,50,50,0.35)' }} />
                                    <button
                                        className="rounded-xl py-2.5 px-4 border-2 border-dashed border-stone-300 text-stone-500 hover:border-red-400 hover:text-red-600 hover:bg-red-50/60 transition-all flex items-center justify-center gap-2 text-xs font-semibold"
                                        style={{ backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }}
                                        onClick={() => { setBoardAddingYoutube(true); setBoardAddingLink(false); setBoardChatPickerOpen(false); setBoardYoutubeDraft(''); }}
                                    >
                                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="#FF0000"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.03 0 12 0 12s0 3.97.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.97 24 12 24 12s0-3.97-.5-5.81zM9.75 15.52V8.48L15.5 12l-5.75 3.52z"/></svg>
                                        YouTube
                                    </button>
                                </div>
                            )}

                            {/* ── 📱 Platform ── */}
                            {boardAddingPlatform ? (
                                <div className="flex flex-col" style={{ width: 240 }}>
                                    <div className="h-4 w-12 mx-auto rounded-b-sm flex-shrink-0" style={{ background: 'rgba(59,130,246,0.35)' }} />
                                    <div className="rounded-xl p-3 shadow-lg" style={{ backgroundColor: '#EFF6FF', border: '2px solid rgba(59,130,246,0.25)' }}>
                                        {boardSelectedPlatform ? (() => {
                                            const platformDef = SUPPORTED_PLATFORMS.find(p => p.id === boardSelectedPlatform);
                                            return (
                                                <>
                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        {getPreviewPlatformIcon(boardSelectedPlatform)}
                                                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">{platformDef?.label}</p>
                                                    </div>
                                                    <input
                                                        className="w-full text-xs bg-white/70 border border-blue-200 rounded px-2 py-1.5 mb-2 outline-none focus:ring-1 focus:ring-blue-400"
                                                        placeholder="Paste URL..."
                                                        value={boardPlatformUrlDraft}
                                                        autoFocus
                                                        onChange={e => setBoardPlatformUrlDraft(e.target.value)}
                                                        onKeyDown={async e => {
                                                            if (e.key === 'Enter') {
                                                                const url = boardPlatformUrlDraft.trim();
                                                                if (url) {
                                                                    _closeAllBoardAdding();
                                                                    await saveBoardLinkChange([...(editedCreator.links || []), { id: `link_${Date.now()}`, title: platformDef?.label || 'Platform', url, type: 'EXTERNAL', iconShape: 'square-s' }]);
                                                                }
                                                            }
                                                        }}
                                                    />
                                                    <div className="flex gap-1.5">
                                                        <button
                                                            className="flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-40"
                                                            disabled={!boardPlatformUrlDraft.trim()}
                                                            onClick={async () => {
                                                                const url = boardPlatformUrlDraft.trim();
                                                                if (!url) return;
                                                                _closeAllBoardAdding();
                                                                await saveBoardLinkChange([...(editedCreator.links || []), { id: `link_${Date.now()}`, title: platformDef?.label || 'Platform', url, type: 'EXTERNAL', iconShape: 'square-s' }]);
                                                            }}
                                                        >Add Link</button>
                                                        <button
                                                            className="flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-blue-200 text-blue-500 hover:bg-blue-50 transition-colors"
                                                            onClick={() => { setBoardSelectedPlatform(null); setBoardPlatformUrlDraft(''); }}
                                                        >Back</button>
                                                    </div>
                                                </>
                                            );
                                        })() : (
                                            <>
                                                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2">📱 Platform</p>
                                                <div className="grid grid-cols-5 gap-1.5 mb-2">
                                                    {SUPPORTED_PLATFORMS.map(p => (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => {
                                                                const existing = (editedCreator.platforms || []).find(ep => (typeof ep === 'string' ? ep : ep.id) === p.id);
                                                                let url = typeof existing === 'object' ? existing.url : '';
                                                                setBoardPlatformUrlDraft(url);
                                                                setBoardSelectedPlatform(p.id);
                                                            }}
                                                            className="w-full aspect-square flex items-center justify-center rounded-lg bg-white border border-blue-100 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                                            title={p.label}
                                                        >
                                                            {getPreviewPlatformIcon(p.id)}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button className="w-full py-1.5 text-[10px] font-bold rounded-lg border border-blue-200 text-blue-500 hover:bg-blue-50 transition-colors" onClick={_closeAllBoardAdding}>Cancel</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col" style={{ width: 110 }}>
                                    <div className="h-4 w-10 mx-auto rounded-b-sm flex-shrink-0" style={{ background: 'rgba(59,130,246,0.35)' }} />
                                    <button
                                        className="rounded-xl py-2.5 px-3 border-2 border-dashed border-stone-300 text-stone-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/60 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold"
                                        style={{ backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }}
                                        onClick={() => { _closeAllBoardAdding(); setBoardAddingPlatform(true); }}
                                    >
                                        📱 Platform
                                    </button>
                                </div>
                            )}

                            {/* Pull from Chat button */}
                            <div className="flex flex-col" style={{ width: 160 }}>
                                <div className="h-4 w-10 mx-auto rounded-b-sm flex-shrink-0" style={{ background: 'rgba(110,170,240,0.45)' }} />
                                <button
                                    className={`rounded-xl py-2.5 px-4 border-2 border-dashed text-xs font-semibold transition-all flex items-center justify-center gap-2 ${boardChatPickerOpen ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-stone-300 text-stone-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/60'}`}
                                    style={{ backgroundColor: boardChatPickerOpen ? undefined : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }}
                                    onClick={() => { setBoardChatPickerOpen(p => !p); setBoardAddingLink(false); setBoardAddingYoutube(false); }}
                                >
                                    <MessageSquare size={13} /> From Chat
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Chat history picker panel */}
                    {boardChatPickerOpen && (() => {
                        const repliedMessages = messages.filter(m => m.status === 'REPLIED' && m.replyContent);
                        const alreadyPinned = new Set(boardPosts.map(p => p.fanId).filter(Boolean));
                        return (
                            <div
                                className="sticky bottom-0 z-10 mx-4 mb-4 rounded-2xl border border-stone-200 overflow-hidden"
                                style={{ background: 'rgba(250,249,246,0.97)', backdropFilter: 'blur(12px)', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)' }}
                            >
                                <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200/60">
                                    <div>
                                        <p className="text-xs font-bold text-stone-800">Pull from Chat History</p>
                                        <p className="text-[10px] text-stone-400 mt-0.5">Pick a replied DM to pin as a public Q&A sticker</p>
                                    </div>
                                    <button onClick={() => setBoardChatPickerOpen(false)} className="p-1.5 rounded-full text-stone-400 hover:bg-stone-200/60 transition-colors"><X size={14} /></button>
                                </div>
                                {repliedMessages.length === 0 ? (
                                    <div className="py-8 text-center text-stone-400 text-xs">No replied messages yet</div>
                                ) : (
                                    <div className="flex gap-3 overflow-x-auto p-4" style={{ scrollbarWidth: 'none' }}>
                                        {repliedMessages.map(msg => {
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
                                                        {alreadyOnBoard && <span className="ml-auto text-[9px] text-emerald-600 font-semibold flex-shrink-0">Pinned</span>}
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

            {/* Board post popup modal */}
            {boardPopupPost && (() => {
                const post = boardPopupPost;
                const noteColors = ['#FFFEF0', '#F0FDF4', '#FFF7ED', '#F5F3FF', '#EFF6FF', '#FDF2F8'];
                const tapeColors = ['rgba(200,193,185,0.55)', 'rgba(110,200,140,0.45)', 'rgba(240,160,80,0.4)', 'rgba(180,150,240,0.4)', 'rgba(110,170,240,0.4)', 'rgba(240,140,180,0.4)'];
                const _stableIdx = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xFFFFFF; return Math.abs(h); };
                const nc = _stableIdx(post.id) % noteColors.length;
                const isReplying = boardReplyingId === post.id;
                const livePost = boardPosts.find(p => p.id === post.id) || post;
                // Expiry for popup
                const _popExpMs = new Date(livePost.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000;
                const _popMsLeft = _popExpMs - Date.now();
                const _popDaysLeft = Math.floor(_popMsLeft / (24 * 60 * 60 * 1000));
                const _popHoursLeft = Math.floor(_popMsLeft / (60 * 60 * 1000));
                const popExpiry = livePost.isPinned || livePost.reply
                    ? null
                    : _popMsLeft <= 0
                        ? { text: 'Expired', cls: 'text-red-500 bg-red-50' }
                        : _popDaysLeft >= 2
                            ? { text: `Expires in ${_popDaysLeft}d`, cls: 'text-stone-400' }
                            : _popDaysLeft === 1
                                ? { text: 'Expires in 1d', cls: 'text-amber-600' }
                                : { text: `Expires in ${_popHoursLeft}h`, cls: 'text-red-500' };
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
                                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">{livePost.isPrivate ? 'Private Post' : 'Public Post'}</span>
                                    {livePost.isPinned
                                        ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100"><Pin size={8} className="fill-current" /> Pinned</span>
                                        : livePost.reply 
                                            ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100"><CheckCircle2 size={8} className="fill-current" /> Answered</span>
                                            : popExpiry && <span className={`text-[10px] font-semibold ${popExpiry.cls}`}>{popExpiry.text}</span>}
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
                                        <span className={livePost.isPinned ? 'text-amber-700 font-semibold' : 'text-stone-500'}>Pin post</span>
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!window.confirm('Delete this post?')) return;
                                            try {
                                                await deleteBoardPost(livePost.id);
                                                setBoardPosts(prev => prev.filter(p => p.id !== livePost.id));
                                                setBoardPopupPost(null);
                                            } catch {}
                                        }}
                                        className="p-1.5 rounded-full text-red-400 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 size={14} />
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
                const answeredBoardPosts = boardPosts
                    .filter(p => p.reply !== null)
                    .sort((a, b) => new Date(b.replyAt ?? b.createdAt).getTime() - new Date(a.replyAt ?? a.createdAt).getTime());
                const inboxFiltered = answeredBoardPosts.filter(p =>
                    inboxBoardFilter === 'ALL' ? true :
                    inboxBoardFilter === 'PINNED' ? p.isPinned :
                    !p.isPinned
                );
                const inboxPost = inboxSelectedPostId ? boardPosts.find(p => p.id === inboxSelectedPostId) ?? null : null;
                const noteColors = ['#FFFEF0', '#F0FDF4', '#FFF7ED', '#F5F3FF', '#EFF6FF', '#FDF2F8'];
                const tapeColors = ['rgba(200,193,185,0.55)', 'rgba(110,200,140,0.45)', 'rgba(240,160,80,0.4)', 'rgba(180,150,240,0.4)', 'rgba(110,170,240,0.4)', 'rgba(240,140,180,0.4)'];
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
                                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-0.5">Q&amp;A History</p>
                                <h2 className="text-xl sm:text-2xl font-bold text-stone-900">Inbox</h2>
                            </div>
                        </div>
                        <TopNav hideBurger />
                    </div>
                    <div className="flex flex-1 min-h-0 overflow-x-hidden">
                        {/* List Column */}
                        <div className={`w-full md:w-80 lg:w-96 border-r border-stone-200/60 flex flex-col ${inboxPost ? 'hidden md:flex' : 'flex'}`}
                            style={{ background: 'linear-gradient(135deg, #FAFAF8 0%, #F5F3EF 100%)', backgroundImage: 'linear-gradient(to right, rgba(168,162,158,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(168,162,158,0.07) 1px, transparent 1px)', backgroundSize: '28px 28px' }}>
                            <div className="p-3 border-b border-stone-200/40 bg-white/60 backdrop-blur-sm">
                                <div className="flex gap-1 bg-stone-100/60 p-1 rounded-lg">
                                    {(['ALL', 'PINNED', 'UNPINNED'] as const).map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setInboxBoardFilter(f)}
                                            className={`flex-1 px-2 py-1.5 text-[10px] font-semibold rounded transition-all whitespace-nowrap ${inboxBoardFilter === f ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                                        >
                                            {f === 'ALL' ? `All (${answeredBoardPosts.length})` : f === 'PINNED' ? `Pinned (${answeredBoardPosts.filter(p => p.isPinned).length})` : `Unpinned (${answeredBoardPosts.filter(p => !p.isPinned).length})`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
                                {boardLoading ? (
                                    <div className="p-8 text-center text-sm text-stone-400 flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading…</div>
                                ) : inboxFiltered.length === 0 ? (
                                    <div className="p-8 text-center space-y-2">
                                        <div className="text-3xl">📭</div>
                                        <p className="text-sm text-stone-400 font-medium">{inboxBoardFilter === 'PINNED' ? 'No pinned posts yet' : inboxBoardFilter === 'UNPINNED' ? 'All answered posts are pinned' : 'No answered posts yet'}</p>
                                        <p className="text-xs text-stone-300">Answer questions on the Board to see them here</p>
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
                                                <div className="h-4 w-14 mx-auto rounded-b-sm" style={{ background: tapeColors[nc] }} />
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
                                                    {post.isPinned && (
                                                        <span className="absolute top-2 right-2"><Pin size={10} className="text-amber-500 fill-amber-400" /></span>
                                                    )}
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-7 h-7 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0 overflow-hidden border border-stone-200/60">
                                                            {post.fanAvatarUrl
                                                                ? <img src={post.fanAvatarUrl} className="w-full h-full object-cover" alt={post.fanName} />
                                                                : <span className="text-white text-[10px] font-bold">{post.fanName.charAt(0).toUpperCase()}</span>}
                                                        </div>
                                                        <p className="text-sm font-bold truncate text-stone-700">{post.fanName}</p>
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
                                                    onClick={() => {
                                                        const next = !post.isPinned;
                                                        setBoardPosts(prev => prev.map(p => p.id === post.id ? { ...p, isPinned: next } : p));
                                                        pinBoardPost(post.id, next);
                                                    }}
                                                    className="flex items-center gap-2 text-xs font-medium hover:opacity-80 transition-opacity"
                                                >
                                                    <span className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${post.isPinned ? 'bg-amber-400' : 'bg-stone-200'}`}>
                                                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${post.isPinned ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                                    </span>
                                                    <Pin size={10} className={post.isPinned ? 'text-amber-600 fill-current' : 'text-stone-400'} />
                                                    <span className={post.isPinned ? 'text-amber-700 font-semibold' : 'text-stone-500'}>Pin post</span>
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (!window.confirm('Delete this post?')) return;
                                                        try {
                                                            await deleteBoardPost(post.id);
                                                            setBoardPosts(prev => prev.filter(p => p.id !== post.id));
                                                            setInboxSelectedPostId(null);
                                                        } catch {}
                                                    }}
                                                    className="p-1.5 rounded-full text-red-400 hover:bg-red-50 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Thread content */}
                                        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-1">
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
                                                        {/* Pin callout */}
                                                        <div className="mt-2 ml-1">
                                                            {post.isPinned ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium"><Pin size={9} className="fill-current" /> Visible on public Community Board</span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-[10px] text-stone-400 font-medium"><Pin size={9} /> Not pinned — only visible here</span>
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
                            {/* Mobile preview button */}
                            <button
                                onClick={() => setShowMobilePreview(true)}
                                className="xl:hidden flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-semibold hover:bg-stone-700 transition-colors"
                            >
                                <Eye size={14} /> Preview
                            </button>
                            <TopNav hideBurger />
                        </div>
                    </div>
                    {/* Two-column layout: settings left, live preview right (desktop only) */}
                    <div className="xl:grid xl:grid-cols-[minmax(0,640px)_340px] xl:gap-8 xl:items-start">
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
                                {([{ key: 'general', label: 'General' }, { key: 'links', label: 'Links' }, { key: 'style', label: 'Style' }] as const).map(tab => (
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
                            
                            {/* Enable DIEM Feature Toggle */}
                            <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${editedCreator.diemEnabled !== false ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-stone-400 border border-stone-200'}`}>
                                        <MessageSquare size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-stone-800">Enable DIEM Feature</p>
                                        <p className="text-xs text-stone-400">Show the DIEM messaging block on your public profile</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditedCreator({ ...editedCreator, diemEnabled: editedCreator.diemEnabled === false ? true : false })}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${editedCreator.diemEnabled !== false ? 'bg-emerald-500' : 'bg-stone-200'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${editedCreator.diemEnabled !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {editedCreator.diemEnabled !== false && (<>
                            {/* DIEM Icon */}
                            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                <p className="text-sm font-semibold text-stone-800 mb-1">DIEM Icon</p>
                                <p className="text-xs text-stone-400 mb-3">Customize the icon shown on the DIEM block</p>
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-shrink-0">
                                        {(() => {
                                            const ds = editedCreator.diemIconShape;
                                            const dsc = ds === 'square' ? 'rounded-none' : ds === 'rounded' ? 'rounded-xl' : 'rounded-full';
                                            return (
                                            <div className="relative group/diemthumb cursor-pointer" onClick={() => setDiemIconPickerOpen(!diemIconPickerOpen)}>
                                                {editedCreator.diemIcon?.startsWith('data:emoji,') ? (
                                                    <div className={`w-10 h-10 ${dsc} flex items-center justify-center bg-stone-100 border border-stone-200 text-xl`}>{editedCreator.diemIcon.replace('data:emoji,', '')}</div>
                                                ) : editedCreator.diemIcon ? (
                                                    <img src={editedCreator.diemIcon} className={`w-10 h-10 ${dsc} object-cover border border-stone-200 bg-white`} />
                                                ) : (
                                                    <div className={`w-10 h-10 ${dsc} overflow-hidden border border-stone-200 bg-white`}>
                                                        <img src="/favicon.svg" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className={`absolute inset-0 bg-black/50 ${dsc} flex items-center justify-center opacity-0 group-hover/diemthumb:opacity-100 transition-opacity`}>
                                                    <Camera size={14} className="text-white"/>
                                                </div>
                                            </div>
                                            );
                                        })()}
                                        {diemIconPickerOpen && (
                                            <>
                                            <div className="fixed inset-0 z-10" onClick={() => setDiemIconPickerOpen(false)} />
                                            <div className="absolute z-20 mt-1 p-2 bg-white border border-stone-200 rounded-xl shadow-lg w-56">
                                                <div className="flex flex-wrap gap-1 mb-2">
                                                    {['🔗','📺','📸','🎵','🎮','📝','💼','🛒','📧','💬','🌐','🎨','📱','🎬','🏆','🎯','🚀','✨','💡','🎁'].map(em => (
                                                        <button key={em} onClick={() => { setEditedCreator({ ...editedCreator, diemIcon: `data:emoji,${em}` }); setDiemIconPickerOpen(false); }} className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center text-lg transition-colors">{em}</button>
                                                    ))}
                                                </div>
                                                <div className="flex gap-1 pt-1 border-t border-stone-100">
                                                    <button onClick={() => { document.getElementById('diem-icon-upload')?.click(); setDiemIconPickerOpen(false); }} className="flex-1 px-2 py-1 text-[10px] bg-stone-100 hover:bg-stone-200 rounded-lg font-medium text-stone-600 flex items-center justify-center gap-1 transition-colors"><Camera size={10}/> Upload</button>
                                                    <button onClick={() => { setEditedCreator({ ...editedCreator, diemIcon: undefined }); setDiemIconPickerOpen(false); }} className="px-2 py-1 text-[10px] bg-red-50 hover:bg-red-100 rounded-lg font-medium text-red-500 transition-colors">Reset</button>
                                                </div>
                                                {/* Shape Selector */}
                                                <div className="flex gap-1 pt-1 mt-1 border-t border-stone-100">
                                                    {([['circle','●'],['rounded','▢'],['square','■']] as const).map(([shape, icon]) => (
                                                        <button key={shape} onClick={() => setEditedCreator({ ...editedCreator, diemIconShape: shape })} className={`flex-1 py-1 text-[10px] rounded-lg font-medium transition-colors ${(editedCreator.diemIconShape || 'circle') === shape ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>{icon}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            </>
                                        )}
                                        <input type="file" id="diem-icon-upload" className="hidden" accept="image/*" onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const reader = new FileReader();
                                            reader.onload = (ev) => setEditedCreator({ ...editedCreator, diemIcon: ev.target?.result as string });
                                            reader.readAsDataURL(file);
                                        }} />
                                    </div>
                                    <p className="text-xs text-stone-400">Click to choose an emoji or upload an image</p>
                                </div>
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
                            </>)}
                            </>)}

                            {/* LINKS TAB */}
                            {settingsMainTab === 'links' && (<>

                            {/* Links & Products Section */}
                            <div ref={tutorialLinksRef} className={showTutorial && tutorialStep === 4 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-xl p-1 -m-1' : ''}>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Links & Products</label>

                                {/* Section Management */}
                                <div ref={tutorialSectionsRef} className={`mb-4 p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-3${showTutorial && tutorialStep === 5 ? ' ring-2 ring-amber-400' : ''}`}>
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
                                                    {(() => {
                                                        const iconShapeClass = link.iconShape === 'circle' ? 'rounded-full' : link.iconShape === 'rounded' ? 'rounded-xl' : 'rounded-none';
                                                        return (
                                                        <div className="relative group/thumb">
                                                        {link.thumbnailUrl?.startsWith('data:emoji,') ? (
                                                            <div className={`w-10 h-10 ${iconShapeClass} flex items-center justify-center bg-stone-100 border border-stone-200 text-xl cursor-pointer`} onClick={() => setOpenIconPickerId(openIconPickerId === link.id ? null : link.id)}>
                                                                {link.thumbnailUrl.replace('data:emoji,', '')}
                                                            </div>
                                                        ) : link.thumbnailUrl ? (
                                                            <img src={link.thumbnailUrl} className={`w-10 h-10 ${iconShapeClass} object-cover border border-stone-200 bg-white cursor-pointer`} onClick={() => setOpenIconPickerId(openIconPickerId === link.id ? null : link.id)} />
                                                        ) : (
                                                            <div className={`w-10 h-10 ${iconShapeClass} flex items-center justify-center border cursor-pointer ${isProduct ? 'bg-purple-100 text-purple-600 border-purple-200' : isSupport ? 'bg-pink-100 text-pink-600 border-pink-200' : 'bg-stone-100 text-stone-500 border-stone-200'}`} onClick={() => setOpenIconPickerId(openIconPickerId === link.id ? null : link.id)}>
                                                                {isProduct ? <FileText size={20}/> : isSupport ? <Heart size={20}/> : <LinkIcon size={20}/>}
                                                            </div>
                                                        )}
                                                        <div className={`absolute inset-0 bg-black/50 ${iconShapeClass} flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 cursor-pointer transition-opacity`} onClick={() => setOpenIconPickerId(openIconPickerId === link.id ? null : link.id)}>
                                                            <Camera size={14} className="text-white"/>
                                                        </div>
                                                        </div>
                                                        );
                                                    })()}
                                                    {openIconPickerId === link.id && (
                                                        <>
                                                        <div className="fixed inset-0 z-10" onClick={() => setOpenIconPickerId(null)} />
                                                        <div className="absolute z-20 mt-1 p-2 bg-white border border-stone-200 rounded-xl shadow-lg w-56">
                                                            <div className="flex flex-wrap gap-1 mb-2">
                                                                {['🔗','📺','📸','🎵','🎮','📝','💼','🛒','📧','💬','🌐','🎨','📱','🎬','🏆','🎯','🚀','✨','💡','🎁'].map(em => (
                                                                    <button key={em} onClick={() => { handleUpdateLink(link.id, 'thumbnailUrl', `data:emoji,${em}`); setOpenIconPickerId(null); }} className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center text-lg transition-colors">{em}</button>
                                                                ))}
                                                            </div>
                                                            <div className="flex gap-1 pt-1 border-t border-stone-100">
                                                                <button onClick={() => { document.getElementById(`thumb-${link.id}`)?.click(); setOpenIconPickerId(null); }} className="flex-1 px-2 py-1 text-[10px] bg-stone-100 hover:bg-stone-200 rounded-lg font-medium text-stone-600 flex items-center justify-center gap-1 transition-colors"><Camera size={10}/> Upload</button>
                                                                <button onClick={() => { handleUpdateLink(link.id, 'thumbnailUrl', ''); setOpenIconPickerId(null); }} className="px-2 py-1 text-[10px] bg-red-50 hover:bg-red-100 rounded-lg font-medium text-red-500 transition-colors">Remove</button>
                                                            </div>
                                                            {/* Shape Selector */}
                                                            <div className="flex gap-1 pt-1 mt-1 border-t border-stone-100">
                                                                {([['circle','●'],['rounded','▢'],['square','■']] as const).map(([shape, icon]) => (
                                                                    <button key={shape} onClick={() => handleUpdateLink(link.id, 'iconShape', link.iconShape === shape ? undefined : shape)} className={`flex-1 py-1 text-[10px] rounded-lg font-medium transition-colors ${link.iconShape === shape || (!link.iconShape && shape === 'square') ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>{icon}</button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        </>
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

                            {/* Profile Display Toggles */}
                            <div className="border-t border-stone-100 pt-6 space-y-3">
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
                            </>)}
                        </div>

                        <div className="mt-8 flex justify-center">
                            <Button onClick={handleSaveProfile} isLoading={isSavingProfile} className="px-8">Save Changes</Button>
                        </div>
                    </div>
                </div>

                    {/* Desktop Live Preview Panel */}
                    <div className="hidden xl:block xl:sticky xl:top-6">
                        <div className="bg-stone-100 rounded-2xl p-3">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2 text-center">Live Preview</p>
                            {/* Browser chrome */}
                            <div className="bg-stone-200 rounded-t-xl px-3 py-1.5 flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-red-400/70" />
                                <div className="w-2 h-2 rounded-full bg-yellow-400/70" />
                                <div className="w-2 h-2 rounded-full bg-green-400/70" />
                                <div className="flex-1 bg-white rounded text-[9px] text-stone-400 text-center py-0.5 truncate px-2">
                                    diem.ee/{(editedCreator.handle || '').replace('@', '')}
                                </div>
                            </div>
                            <div className="overflow-y-auto rounded-b-xl bg-[#FAF9F6]" style={{ maxHeight: 'calc(100vh - 180px)' }}>
                                <div className="p-3">
                                    <ProfilePreviewCard creator={editedCreator} compact />
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>{/* end two-col grid */}

                    {/* Mobile Preview Sheet */}
                    {showMobilePreview && (
                        <div className="fixed inset-0 z-[100] bg-black/60 flex items-end xl:hidden animate-in fade-in" onClick={() => setShowMobilePreview(false)}>
                            <div className="bg-[#FAF9F6] w-full max-h-[90vh] overflow-y-auto rounded-t-3xl animate-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
                                <div className="sticky top-0 bg-white/90 backdrop-blur-sm border-b border-stone-100 px-4 py-3 flex items-center justify-between rounded-t-3xl">
                                    <p className="font-bold text-stone-900 text-sm">Profile Preview</p>
                                    <button onClick={() => setShowMobilePreview(false)} className="p-1 rounded-full hover:bg-stone-100"><X size={18} /></button>
                                </div>
                                <div className="p-4 max-w-lg mx-auto pb-10">
                                    <ProfilePreviewCard creator={editedCreator} />
                                </div>
                            </div>
                        </div>
                    )}
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
