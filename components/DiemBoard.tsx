import React, { useState, useEffect, useCallback } from 'react';
import { CreatorProfile, CurrentUser } from '../types';
import { getBoardPosts, createBoardPost, BoardPost } from '../services/realBackend';
import { ArrowLeft, Lock, Globe, CheckCircle, ExternalLink, X, Loader2, ShoppingBag, Heart, Link as LinkIcon } from 'lucide-react';

interface Props {
    creator: CreatorProfile | null;
    currentUser: CurrentUser | null;
    onLoginRequest: () => void;
    onBack: () => void;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const timeAgo = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

const noteRot = (id: string, i: number) => {
    const s = id ? id.charCodeAt(0) + id.charCodeAt(id.length - 1) + i * 7 : i;
    return [-3.1, -2.0, -1.1, -0.4, 0.3, 1.0, 1.8, 2.6, 3.2, -0.7, 1.4, -1.6][s % 12];
};

const pinColors = ['#dc2626','#1d4ed8','#15803d','#b45309','#be185d','#6d28d9','#0f766e','#c2410c'];
const getPinColor  = (id: string, i: number) => pinColors[(id ? id.charCodeAt(0) + i : i) % pinColors.length];

const stickyPalette = [
    { bg: '#fde68a', strip: '#f59e0b', text: '#78350f' },
    { bg: '#bbf7d0', strip: '#34d399', text: '#064e3b' },
    { bg: '#bfdbfe', strip: '#60a5fa', text: '#1e3a5f' },
    { bg: '#fecdd3', strip: '#f87171', text: '#7f1d1d' },
    { bg: '#ddd6fe', strip: '#a78bfa', text: '#3b0764' },
    { bg: '#fed7aa', strip: '#fb923c', text: '#7c2d12' },
    { bg: '#a7f3d0', strip: '#10b981', text: '#064e3b' },
];
const getStickyStyle = (i: number) => stickyPalette[i % stickyPalette.length];

// ── CSS injected once ─────────────────────────────────────────────────────────

const BOARD_STYLES = `
  @keyframes noteIn {
    0%   { opacity: 0; transform: translateY(-18px) scale(0.9); }
    65%  { transform: translateY(3px) scale(1.02); }
    100% { opacity: 1; transform: translateY(0)   scale(1);    }
  }
  @keyframes pinDrop {
    0%   { opacity: 0; transform: translateY(-12px) scale(0.8); }
    70%  { transform: translateY(2px) scale(1.1); }
    100% { opacity: 1; transform: translateY(0)   scale(1);    }
  }
  @keyframes boardFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .note-in   { animation: noteIn  0.45s cubic-bezier(0.34,1.56,0.64,1) both; }
  .pin-drop  { animation: pinDrop 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
  .board-in  { animation: boardFadeIn 0.6s ease both; }
  .note-hover:hover { filter: drop-shadow(0 8px 18px rgba(0,0,0,0.28)); }
  .note-hover:hover .note-lift { transform: translateY(-5px) !important; }
  .note-lift { transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1); }
`;

// ── 3-D pushpin ───────────────────────────────────────────────────────────────

const PushPin: React.FC<{ color: string; delay?: number }> = ({ color, delay = 0 }) => (
    <div
        className="pin-drop absolute -top-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center select-none"
        style={{ animationDelay: `${delay}ms` }}
    >
        {/* Shiny head */}
        <div
            className="w-7 h-7 rounded-full"
            style={{
                background: `radial-gradient(circle at 38% 32%, rgba(255,255,255,0.75) 0%, ${color} 38%, rgba(0,0,0,0.45) 100%)`,
                boxShadow: `0 3px 7px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3), inset 0 1px 4px rgba(255,255,255,0.5)`,
            }}
        >
            <div className="w-2 h-2 rounded-full bg-white/50 ml-1.5 mt-1" />
        </div>
        {/* Stem shadow on cork */}
        <div className="w-1 h-2.5 rounded-b-full opacity-30 bg-stone-900" />
    </div>
);

// ── creator "about" card ──────────────────────────────────────────────────────

const CreatorCard: React.FC<{ creator: CreatorProfile; delay: number }> = ({ creator, delay }) => (
    <div className="relative note-hover" style={{ transform: 'rotate(-0.8deg)' }}>
        <PushPin color="#dc2626" delay={delay} />
        <div
            className="note-in note-lift mt-4 w-72 rounded-sm overflow-hidden"
            style={{
                animationDelay: `${delay}ms`,
                background: '#fefef0',
                boxShadow: '3px 6px 18px rgba(0,0,0,0.22), 0 1px 4px rgba(0,0,0,0.1)',
                backgroundImage: 'repeating-linear-gradient(transparent 0px, transparent 27px, rgba(0,0,0,0.045) 27px, rgba(0,0,0,0.045) 28px)',
            }}
        >
            {/* Tape strip across top */}
            <div className="h-5 w-24 mx-auto -mt-2 mb-1 rounded-sm opacity-60"
                style={{ background: 'rgba(253,230,138,0.8)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }} />

            <div className="px-5 pb-5">
                <div className="flex items-center gap-3 mb-3">
                    {creator.avatarUrl ? (
                        <img src={creator.avatarUrl}
                            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2), 0 0 0 3px #fff, 0 0 0 5px rgba(0,0,0,0.1)' }} />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-stone-200 flex-shrink-0"
                            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2), 0 0 0 3px #fff, 0 0 0 5px rgba(0,0,0,0.1)' }} />
                    )}
                    <div>
                        <h2 style={{ fontFamily: "'Caveat', cursive", fontSize: 22, fontWeight: 700, color: '#1c1917', lineHeight: 1.2 }}>
                            {creator.displayName}
                        </h2>
                        {creator.handle && creator.handle !== '@user' && (
                            <p className="text-xs text-stone-400 mt-0.5">{creator.handle}</p>
                        )}
                    </div>
                </div>
                {creator.bio && (
                    <p style={{ fontFamily: "'Kalam', cursive", fontSize: 13.5, color: '#44403c', lineHeight: 1.7 }}
                        className="line-clamp-4">
                        {creator.bio}
                    </p>
                )}
                <div className="mt-4 flex gap-5 text-xs text-stone-400 border-t border-stone-200/80 pt-3">
                    <span>{creator.stats?.replyRate || '—'} reply rate</span>
                    <span>{creator.stats?.responseTimeAvg || '—'} avg reply</span>
                </div>
            </div>
        </div>
    </div>
);

// ── platform helpers (mirrors CreatorDashboard) ───────────────────────────────

const PUB_PLATFORM_DOMAINS: { pattern: RegExp; id: string }[] = [
    { pattern: /youtube\.com|youtu\.be/, id: 'youtube' },
    { pattern: /instagram\.com/, id: 'instagram' },
    { pattern: /twitter\.com|x\.com/, id: 'twitter' },
    { pattern: /tiktok\.com/, id: 'tiktok' },
    { pattern: /spotify\.com/, id: 'spotify' },
    { pattern: /twitch\.tv/, id: 'twitch' },
    { pattern: /github\.com/, id: 'github' },
    { pattern: /discord\.gg|discord\.com/, id: 'discord' },
];

const pubPlatformIcon = (platform: string) => {
    switch (platform) {
        case 'youtube':  return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#FF0000"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.03 0 12 0 12s0 3.97.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.97 24 12 24 12s0-3.97-.5-5.81zM9.75 15.52V8.48L15.5 12l-5.75 3.52z"/></svg>;
        case 'instagram': return <svg viewBox="0 0 24 24" className="w-4 h-4"><defs><radialGradient id="ig" cx="30%" cy="107%" r="150%"><stop offset="0%" stopColor="#ffd600"/><stop offset="50%" stopColor="#ff0069"/><stop offset="100%" stopColor="#6e00ff"/></radialGradient></defs><rect width="24" height="24" rx="6" fill="url(#ig)"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="white" strokeWidth="1.8"/><circle cx="17.5" cy="6.5" r="1" fill="white"/></svg>;
        case 'twitter':  return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.23H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.629L18.244 2.25z"/></svg>;
        case 'tiktok':   return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#000"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.35 6.35 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>;
        case 'spotify':  return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>;
        case 'twitch':   return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#9146FF"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>;
        default:         return <ExternalLink size={14} className="text-stone-400" />;
    }
};

const pubGetYtId = (url: string): string | null => {
    try {
        const u = new URL(url.startsWith('http') ? url : `https://${url}`);
        if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
        if (u.hostname === 'youtu.be') return u.pathname.slice(1);
    } catch {}
    return null;
};

const pubDetectPlatform = (url: string): string | null => {
    try {
        const h = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
        return PUB_PLATFORM_DOMAINS.find(p => p.pattern.test(h))?.id || null;
    } catch { return null; }
};

// ── link sticker (matches creator board style) ────────────────────────────────

const LinkSticker: React.FC<{ link: any; idx: number }> = ({ link, idx }) => {
    const linkColors = ['#FFF7ED', '#F0FDF4', '#EFF6FF', '#FDF2F8', '#FFFEF0', '#F5F3FF'];
    const linkTapes  = ['rgba(240,160,80,0.45)', 'rgba(110,200,140,0.45)', 'rgba(110,170,240,0.4)', 'rgba(240,140,180,0.4)', 'rgba(200,193,185,0.55)', 'rgba(180,150,240,0.4)'];
    const lc = idx % linkColors.length;

    const getLinkSize = (l: any): number | null => {
        if (l.iconShape === 'square-l') return 220;
        if (l.iconShape === 'square-m') return 160;
        if (l.iconShape === 'square-s' || l.iconShape === 'square') return 110;
        if (l.iconShape === 'square-xs') return 64;
        return null;
    };

    const sqSize = getLinkSize(link);
    const LINK_W = 220;
    const width = sqSize || LINK_W;
    const tapeW = sqSize === 220 ? 'w-12' : sqSize === 160 ? 'w-10' : sqSize === 64 ? 'w-5' : sqSize ? 'w-8' : 'w-12';
    const bgColor = link.buttonColor || linkColors[lc];

    const ytId = link.url ? pubGetYtId(link.url) : null;
    const detectedPlatform = link.url ? pubDetectPlatform(link.url) : null;
    const hasRealPhoto = link.thumbnailUrl && !link.thumbnailUrl.startsWith('data:emoji,');
    const isThumbnailStyle = link.displayStyle === 'thumbnail' || (!link.displayStyle && hasRealPhoto);

    const handleClick = () => {
        if (link.url && link.url !== '#') window.open(link.url.startsWith('http') ? link.url : `https://${link.url}`, '_blank');
    };

    return (
        <div
            className="flex flex-col cursor-pointer hover:scale-[1.02] transition-transform"
            style={{ width }}
            onClick={handleClick}
        >
            {/* Tape */}
            <div className={`h-4 mx-auto rounded-b-sm flex-shrink-0 ${tapeW}`} style={{ background: linkTapes[lc] }} />
            {/* Card body */}
            <div
                className={`rounded-lg shadow-md ${sqSize === 64 ? 'p-1.5 aspect-square flex items-center justify-center' : sqSize ? 'p-3 aspect-square flex flex-col items-center justify-center text-center' : 'p-3'}`}
                style={{
                    backgroundColor: bgColor,
                    border: '1px solid rgba(0,0,0,0.08)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                }}
            >
                {ytId && link.displayStyle !== 'icon' ? (
                    <>
                        <div className="relative w-full rounded-md overflow-hidden mb-2" style={{ paddingBottom: '56.25%' }}>
                            <img src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} className="absolute inset-0 w-full h-full object-cover" alt={link.title} />
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
                ) : sqSize === 64 ? (
                    <div className="w-10 h-10 rounded-xl bg-white/60 shadow-sm border border-black/5 flex items-center justify-center mx-auto">
                        {detectedPlatform ? <div className="scale-[1.25]">{pubPlatformIcon(detectedPlatform)}</div>
                            : link.thumbnailUrl?.startsWith('data:emoji,') ? <span className="text-xl">{link.thumbnailUrl.replace('data:emoji,', '')}</span>
                            : hasRealPhoto ? <img src={link.thumbnailUrl} className="w-full h-full object-cover rounded-xl" alt={link.title} />
                            : link.type === 'DIGITAL_PRODUCT' ? <ShoppingBag size={18} className="text-violet-500" />
                            : link.type === 'SUPPORT' ? <Heart size={18} className="text-pink-500" />
                            : <LinkIcon size={18} className="text-stone-500" />}
                    </div>
                ) : sqSize ? (
                    <>
                        <div className={`${sqSize === 220 ? 'w-16 h-16 rounded-2xl mb-3' : sqSize === 160 ? 'w-14 h-14 rounded-2xl mb-2' : 'w-12 h-12 rounded-xl mb-1.5'} bg-white/60 shadow-sm border border-black/5 flex items-center justify-center mx-auto`}>
                            {detectedPlatform ? <div className={sqSize === 220 ? "scale-[2]" : sqSize === 160 ? "scale-[1.75]" : "scale-[1.5]"}>{pubPlatformIcon(detectedPlatform)}</div>
                                : link.thumbnailUrl?.startsWith('data:emoji,') ? <span className={sqSize === 220 ? "text-4xl" : sqSize === 160 ? "text-3xl" : "text-2xl"}>{link.thumbnailUrl.replace('data:emoji,', '')}</span>
                                : hasRealPhoto ? <img src={link.thumbnailUrl} className={`w-full h-full object-cover ${sqSize >= 160 ? 'rounded-2xl' : 'rounded-xl'}`} alt={link.title} />
                                : link.type === 'DIGITAL_PRODUCT' ? <ShoppingBag size={sqSize === 220 ? 24 : 20} className="text-violet-500" />
                                : link.type === 'SUPPORT' ? <Heart size={sqSize === 220 ? 24 : 20} className="text-pink-500" />
                                : <LinkIcon size={sqSize === 220 ? 24 : 20} className="text-stone-500" />}
                        </div>
                        <p className={`${sqSize === 220 ? 'text-lg mb-1 px-4' : sqSize === 160 ? 'text-base mb-1 px-2' : 'text-xs mb-0.5 px-1'} font-bold text-stone-800 leading-tight w-full truncate`}>{link.title}</p>
                        <p className="text-[8px] text-stone-500 uppercase tracking-wider font-semibold">{link.type === 'DIGITAL_PRODUCT' ? 'Buy' : link.type === 'SUPPORT' ? 'Tip' : 'Visit'}</p>
                    </>
                ) : isThumbnailStyle ? (
                    <div className="flex flex-col h-full w-full">
                        {(() => {
                            const thumbBg = detectedPlatform ? '#0f0f0f' : link.type === 'DIGITAL_PRODUCT' ? '#ede9fe' : link.type === 'SUPPORT' ? '#fdf2f8' : '#e5e7eb';
                            const typeIcon = link.type === 'DIGITAL_PRODUCT'
                                ? <ShoppingBag size={10} className="text-violet-500 flex-shrink-0" />
                                : link.type === 'SUPPORT'
                                    ? <Heart size={10} className="text-pink-500 flex-shrink-0" />
                                    : detectedPlatform
                                        ? <span className="w-3 h-3 flex-shrink-0">{pubPlatformIcon(detectedPlatform)}</span>
                                        : <LinkIcon size={10} className="text-stone-400 flex-shrink-0" />;
                            const typeLabel = link.type === 'DIGITAL_PRODUCT' ? 'Digital Product'
                                : link.type === 'SUPPORT' ? 'Support'
                                : detectedPlatform ? detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1) + ' Video'
                                : 'Link';
                            return (
                                <>
                                    <div className="relative w-full rounded-md overflow-hidden mb-2" style={{ paddingBottom: '56.25%', backgroundColor: thumbBg }}>
                                        {hasRealPhoto
                                            ? <img src={link.thumbnailUrl} className="absolute inset-0 w-full h-full object-cover" alt={link.title} />
                                            : <div className="absolute inset-0 flex items-center justify-center">
                                                {detectedPlatform ? <div className="scale-[2.5]">{pubPlatformIcon(detectedPlatform)}</div>
                                                    : link.type === 'DIGITAL_PRODUCT' ? <ShoppingBag size={28} className="text-violet-300" />
                                                    : link.type === 'SUPPORT' ? <Heart size={28} className="text-pink-300" />
                                                    : <LinkIcon size={28} className="text-stone-300" />}
                                              </div>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {typeIcon}
                                        <p className="text-[10px] font-bold text-stone-700 truncate">{link.title}</p>
                                    </div>
                                    <p className="text-[9px] text-stone-400 mt-0.5">{typeLabel}</p>
                                </>
                            );
                        })()}
                    </div>
                ) : link.type === 'DIGITAL_PRODUCT' ? (
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
                ) : link.type === 'SUPPORT' ? (
                    <div className="flex items-center gap-2.5 h-full w-full">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/60 border border-black/5">
                            {link.thumbnailUrl?.startsWith('data:emoji,') ? <span className="text-xl leading-none">{link.thumbnailUrl.replace('data:emoji,', '')}</span> : <Heart size={16} className="text-pink-400" />}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                            <p className="text-xs font-bold text-stone-800 truncate">{link.title}</p>
                        </div>
                        <span className="text-[10px] font-bold text-pink-500 bg-pink-50 px-2 py-1 rounded-full flex-shrink-0">Tip ♥</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2.5 h-full w-full">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/60 border border-black/5 text-stone-600">
                            {link.thumbnailUrl?.startsWith('data:emoji,') ? <span className="text-base leading-none">{link.thumbnailUrl.replace('data:emoji,', '')}</span>
                                : detectedPlatform ? pubPlatformIcon(detectedPlatform)
                                : <LinkIcon size={13} />}
                        </div>
                        <span className="text-xs font-semibold text-stone-700 truncate flex-1 text-left">{link.title}</span>
                        <ExternalLink size={9} className="text-stone-300 flex-shrink-0" />
                    </div>
                )}
            </div>
        </div>
    );
};

// ── board post paper note ─────────────────────────────────────────────────────

const PaperNote: React.FC<{
    post: BoardPost; idx: number; isOwn: boolean; isCreator: boolean;
    delay: number; onClick: () => void;
}> = ({ post, idx, isOwn, isCreator, delay, onClick }) => {
    const isPending    = !post.reply;
    const canSee       = !isPending || isOwn || isCreator;
    const rot          = noteRot(post.id, idx);
    const pc           = getPinColor(post.id, idx);

    return (
        <div
            className={`relative note-hover mb-5 w-full ${isPending && !canSee ? '' : 'cursor-pointer'}`}
            style={{ transform: `rotate(${rot}deg)` }}
            onClick={onClick}
        >
            <PushPin color={pc} delay={delay} />
            <div
                className="note-in note-lift mt-4 rounded-sm overflow-hidden"
                style={{
                    animationDelay: `${delay}ms`,
                    background: '#fefef0',
                    backgroundImage: 'repeating-linear-gradient(transparent 0px, transparent 23px, rgba(0,0,0,0.04) 23px, rgba(0,0,0,0.04) 24px)',
                    boxShadow: '2px 5px 14px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.08)',
                    opacity: isPending && !canSee ? 0.82 : 1,
                }}
            >
                {/* Red left margin line — like real lined paper */}
                <div className="absolute top-0 left-9 w-px h-full bg-red-200/60" />

                <div className="pl-12 pr-4 pt-3 pb-4">
                    {/* Author line */}
                    <div className="flex items-center gap-1.5 mb-2.5">
                        {post.fanAvatarUrl ? (
                            <img src={post.fanAvatarUrl} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                        ) : (
                            <div className="w-5 h-5 rounded-full bg-stone-300 flex-shrink-0" />
                        )}
                        <span style={{ fontFamily: "'Caveat', cursive", fontSize: 13, fontWeight: 600, color: '#57534e' }}
                            className="truncate flex-1">
                            {post.fanName}
                        </span>
                        {post.isPrivate && <Lock size={9} className="text-stone-400 flex-shrink-0" />}
                    </div>

                    {/* Message content */}
                    <div className="relative min-h-[48px]">
                        <p
                            style={{
                                fontFamily: "'Kalam', cursive",
                                fontSize: 13.5,
                                color: '#1c1917',
                                lineHeight: 1.65,
                                filter: !canSee ? 'blur(5px) sepia(0.2)' : 'none',
                                userSelect: !canSee ? 'none' : 'auto',
                                WebkitFilter: !canSee ? 'blur(5px) sepia(0.2)' : 'none',
                            }}
                            className="line-clamp-5"
                        >
                            {canSee ? post.content : 'This message is waiting for a response from the creator and will appear here once replied to...'}
                        </p>

                        {!canSee && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                                {/* Wax-seal look */}
                                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                                    style={{
                                        background: 'radial-gradient(circle at 38% 32%, rgba(255,255,255,0.4) 0%, rgba(180,60,60,0.85) 100%)',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                    }}>
                                    <Lock size={13} color="rgba(255,255,255,0.9)" />
                                </div>
                                <span className="text-[9px] text-stone-400 font-medium tracking-wider uppercase"
                                    style={{ background: 'rgba(254,254,240,0.85)', padding: '2px 6px', borderRadius: 3 }}>
                                    awaiting reply
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="mt-3 flex items-center justify-between border-t border-stone-200/60 pt-2">
                        <span className="text-[10px] text-stone-400">{timeAgo(post.createdAt)}</span>
                        {post.reply ? (
                            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                                <CheckCircle size={9} /> replied
                            </span>
                        ) : (
                            <span className="text-[10px] text-amber-500 font-medium">pending</span>
                        )}
                    </div>
                </div>

                {/* Bottom-right fold corner */}
                <div className="absolute bottom-0 right-0 w-6 h-6"
                    style={{ background: 'linear-gradient(225deg, rgba(0,0,0,0.10) 45%, transparent 45%)' }} />
            </div>
        </div>
    );
};

// ── thread modal ──────────────────────────────────────────────────────────────

const ThreadModal: React.FC<{ post: BoardPost; creator: CreatorProfile; onClose: () => void }> =
    ({ post, creator, onClose }) => (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(28,25,23,0.72)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}>
            <div
                className="w-full max-w-md overflow-hidden rounded-sm board-in"
                style={{
                    background: '#fefef0',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.15)',
                    border: '1px solid rgba(0,0,0,0.06)',
                }}
                onClick={e => e.stopPropagation()}>

                {/* Fan message */}
                <div style={{
                    backgroundImage: 'repeating-linear-gradient(transparent 0px, transparent 27px, rgba(0,0,0,0.04) 27px, rgba(0,0,0,0.04) 28px)',
                    borderLeft: '4px solid rgba(59,130,246,0.4)',
                }} className="p-5">
                    <div className="flex items-start gap-3">
                        {post.fanAvatarUrl
                            ? <img src={post.fanAvatarUrl} className="w-11 h-11 rounded-full object-cover flex-shrink-0 mt-0.5"
                                style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.18)' }} />
                            : <div className="w-11 h-11 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span style={{ fontFamily: "'Caveat', cursive", fontSize: 18, fontWeight: 700, color: '#78716c' }}>
                                    {post.fanName[0]}
                                </span>
                              </div>
                        }
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span style={{ fontFamily: "'Caveat', cursive", fontSize: 17, fontWeight: 700, color: '#1c1917' }}>
                                    {post.fanName}
                                </span>
                                <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-medium tracking-wider">
                                    FAN
                                </span>
                                {post.isPrivate && (
                                    <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                                        <Lock size={8} /> Private
                                    </span>
                                )}
                                <span className="text-[10px] text-stone-400 ml-auto">· {timeAgo(post.createdAt)}</span>
                            </div>
                            <p style={{ fontFamily: "'Kalam', cursive", fontSize: 14.5, color: '#292524', lineHeight: 1.7 }}>
                                {post.content}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Creator reply */}
                {post.reply && (
                    <div style={{
                        background: '#f0fdf4',
                        backgroundImage: 'repeating-linear-gradient(transparent 0px, transparent 27px, rgba(0,0,0,0.035) 27px, rgba(0,0,0,0.035) 28px)',
                        borderTop: '1px solid rgba(0,0,0,0.06)',
                        borderLeft: '4px solid rgba(16,185,129,0.5)',
                    }} className="p-5">
                        <div className="flex items-start gap-3">
                            {creator.avatarUrl
                                ? <img src={creator.avatarUrl} className="w-11 h-11 rounded-full object-cover flex-shrink-0 mt-0.5"
                                    style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.18)' }} />
                                : <div className="w-11 h-11 rounded-full bg-stone-200 flex-shrink-0 mt-0.5" />
                            }
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span style={{ fontFamily: "'Caveat', cursive", fontSize: 17, fontWeight: 700, color: '#1c1917' }}>
                                        {creator.displayName}
                                    </span>
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                                        <CheckCircle size={9} /> CREATOR
                                    </span>
                                    <span className="text-[10px] text-stone-400 ml-auto">
                                        · {post.replyAt ? timeAgo(post.replyAt) : ''}
                                    </span>
                                </div>
                                <p style={{ fontFamily: "'Kalam', cursive", fontSize: 14.5, color: '#292524', lineHeight: 1.7 }}>
                                    {post.reply}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="px-5 py-3 flex justify-end" style={{ background: '#faf9f0', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                    <button onClick={onClose}
                        className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                        style={{ fontFamily: "'Kalam', cursive", fontSize: 13 }}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );

// ── compose modal — looks like a fresh sticky note ────────────────────────────

const ComposeModal: React.FC<{
    creator: CreatorProfile;
    onClose: () => void;
    onSubmit: (content: string, isPrivate: boolean) => Promise<void>;
}> = ({ creator, onClose, onSubmit }) => {
    const [content, setContent]       = useState('');
    const [isPrivate, setIsPrivate]   = useState(false);
    const [isSubmitting, setSubmitting] = useState(false);

    const submit = async () => {
        if (!content.trim() || isSubmitting) return;
        setSubmitting(true);
        try { await onSubmit(content.trim(), isPrivate); onClose(); }
        catch (e: any) { alert(e.message || 'Failed to post'); }
        finally { setSubmitting(false); }
    };

    const { bg, strip, text } = getStickyStyle(isPrivate ? 2 : 0); // blue if private, yellow if public

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(28,25,23,0.70)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}>
            <div
                className="w-full max-w-md rounded-sm overflow-hidden board-in"
                style={{
                    background: bg,
                    backgroundImage: `linear-gradient(to bottom, ${strip} 9%, ${bg} 9%)`,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.15)',
                    transition: 'background 0.25s, background-image 0.25s',
                }}
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-2">
                    <div>
                        <h3 style={{ fontFamily: "'Caveat', cursive", fontSize: 22, fontWeight: 700, color: text }}>
                            Post a Diem
                        </h3>
                        <p style={{ fontFamily: "'Kalam', cursive", fontSize: 12.5, color: text, opacity: 0.65 }}>
                            to {creator.displayName}
                        </p>
                    </div>
                    <button onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-black/10">
                        <X size={16} style={{ color: text, opacity: 0.6 }} />
                    </button>
                </div>

                <div className="px-5 pb-5 space-y-4">
                    {/* Lined textarea */}
                    <div className="relative rounded-sm overflow-hidden">
                        <textarea
                            autoFocus
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder={`Write a note to ${creator.displayName}...`}
                            maxLength={500}
                            rows={6}
                            className="w-full resize-none px-4 py-3 text-sm focus:outline-none"
                            style={{
                                fontFamily: "'Kalam', cursive",
                                fontSize: 14.5,
                                lineHeight: '28px',
                                color: '#1c1917',
                                background: 'transparent',
                                backgroundImage: 'repeating-linear-gradient(transparent 0px, transparent 27px, rgba(0,0,0,0.07) 27px, rgba(0,0,0,0.07) 28px)',
                                caretColor: text,
                            }}
                        />
                        {/* Margin line */}
                        <div className="absolute top-0 left-9 w-px h-full" style={{ background: 'rgba(255,100,100,0.25)' }} />
                    </div>

                    {/* Bottom row: char count + privacy toggle + post button */}
                    <div className="flex items-center gap-3">
                        {/* Privacy toggle */}
                        <button
                            onClick={() => setIsPrivate(p => !p)}
                            className="flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity"
                        >
                            <span
                                className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200"
                                style={{ background: isPrivate ? 'rgba(0,0,0,0.40)' : 'rgba(0,0,0,0.18)' }}
                            >
                                <span
                                    className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                                    style={{ transform: isPrivate ? 'translateX(18px)' : 'translateX(2px)' }}
                                />
                            </span>
                            <span className="flex items-center gap-1" style={{ fontFamily: "'Caveat', cursive", fontSize: 14, fontWeight: 700, color: text }}>
                                {isPrivate ? <Lock size={12} /> : <Globe size={12} />}
                                {isPrivate ? 'Private' : 'Public'}
                            </span>
                        </button>

                        <span className="flex-1" />

                        <span style={{ fontFamily: "'Kalam', cursive", fontSize: 11, color: text, opacity: 0.4 }}>
                            {content.length}/500
                        </span>

                        {/* Submit */}
                        <button
                            onClick={submit}
                            disabled={!content.trim() || isSubmitting}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-sm transition-all active:scale-95 disabled:opacity-40"
                            style={{
                                background: 'rgba(0,0,0,0.18)',
                                fontFamily: "'Caveat', cursive",
                                fontSize: 16,
                                fontWeight: 700,
                                color: text,
                                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                            }}>
                            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <span>📌</span>}
                            {isSubmitting ? 'Posting…' : 'Post'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── main ──────────────────────────────────────────────────────────────────────

export const DiemBoard: React.FC<Props> = ({ creator, currentUser, onLoginRequest, onBack }) => {
    const [posts, setPosts]             = useState<BoardPost[]>([]);
    const [isLoading, setIsLoading]     = useState(true);
    const [showCompose, setCompose]     = useState(false);
    const [selectedPost, setSelected]   = useState<BoardPost | null>(null);
    const isCreator = !!(currentUser && creator && currentUser.id === creator.id);

    const loadPosts = useCallback(async () => {
        if (!creator) return;
        setIsLoading(true);
        const all = await getBoardPosts(creator.id);
        setPosts(all.filter(p => !p.isPrivate));
        setIsLoading(false);
    }, [creator]);

    useEffect(() => { loadPosts(); }, [loadPosts]);

    const handlePost = async (content: string, isPrivate: boolean) => {
        if (!creator) return;
        const newPost = await createBoardPost(creator.id, content, isPrivate);
        setPosts(prev => [newPost, ...prev]);
    };

    const handleNoteClick = (post: BoardPost) => {
        if (!post.reply) return;
        setSelected(post);
    };

    const handleDiemClick = () => {
        if (!currentUser) { onLoginRequest(); return; }
        setCompose(true);
    };

    const visibleLinks = (creator?.links || []).filter((l: any) => l.id !== '__diem_config__' && !l.hidden);

    // ── shared layout constants (must match CreatorDashboard exactly) ──
    const NOTE_W = 252;
    const NOTE_H_EST = 272;
    const NOTE_GAP_X = 28;
    const NOTE_GAP_Y = 36;
    const BOARD_PAD = 32;
    const GUIDE_W = 640;
    const GUIDE_COLS = Math.max(1, Math.floor((GUIDE_W - BOARD_PAD) / (NOTE_W + NOTE_GAP_X))); // = 2
    const LINK_W = 220;
    // Auto-placed links go to the right of the 2-column note grid (same as creator)
    const LINK_AUTO_X = BOARD_PAD + GUIDE_COLS * (NOTE_W + NOTE_GAP_X) + 20;

    const getLinkSize = (l: any): number | null => {
        if (l.iconShape === 'square-l') return 220;
        if (l.iconShape === 'square-m') return 160;
        if (l.iconShape === 'square-s' || l.iconShape === 'square') return 110;
        if (l.iconShape === 'square-xs') return 64;
        return null;
    };
    const getLinkH = (l: any): number => {
        const sq = getLinkSize(l);
        if (sq) return sq;
        if (l.type === 'DIGITAL_PRODUCT') return 104;
        if (l.url && pubGetYtId(l.url)) return 162;
        return 84;
    };

    // Post positions (guide-relative coords from DB, or 2-col grid fallback)
    const postPositions = posts.map((post, idx) => {
        if (post.positionX != null && post.positionY != null) return { x: post.positionX, y: post.positionY };
        const col = idx % GUIDE_COLS;
        const row = Math.floor(idx / GUIDE_COLS);
        return { x: BOARD_PAD + col * (NOTE_W + NOTE_GAP_X), y: BOARD_PAD + row * (NOTE_H_EST + NOTE_GAP_Y) };
    });

    // Link positions (guide-relative coords from DB, or auto-stack on right)
    let autoLinkY = BOARD_PAD;
    const linkPositions = visibleLinks.map((link: any) => {
        if (link.positionX != null && link.positionY != null) return { x: link.positionX, y: link.positionY };
        const pos = { x: LINK_AUTO_X, y: autoLinkY };
        autoLinkY += getLinkH(link) + 14;
        return pos;
    });

    // Canvas dimensions
    const maxPostBottom = postPositions.reduce((m, p) => Math.max(m, p.y + NOTE_H_EST), 440);
    const maxLinkRight  = linkPositions.reduce((m, p, i) => Math.max(m, p.x + (getLinkSize(visibleLinks[i]) || LINK_W)), GUIDE_W);
    const maxLinkBottom = linkPositions.reduce((m, p, i) => Math.max(m, p.y + getLinkH(visibleLinks[i])), 0);
    const canvasH = Math.max(maxPostBottom, maxLinkBottom) + 80;
    const canvasW = Math.max(GUIDE_W, maxLinkRight + 32);

    return (
        <>
            {/* Inject animation keyframes once */}
            <style>{BOARD_STYLES}</style>

            <div
                className="min-h-screen"
                style={{
                    /* Wooden outer frame */
                    padding: '14px',
                    backgroundImage: `
                        repeating-linear-gradient(92deg, transparent 0px, transparent 3px, rgba(0,0,0,0.025) 3px, rgba(0,0,0,0.025) 4px),
                        repeating-linear-gradient(2deg,  transparent 0px, transparent 8px, rgba(255,255,255,0.015) 8px, rgba(255,255,255,0.015) 9px),
                        linear-gradient(160deg, #9a7050 0%, #6b4a2a 30%, #7a5535 60%, #5a3820 100%)
                    `,
                    boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5)',
                }}
            >
                {/* Cork board surface */}
                <div
                    className="relative min-h-[calc(100vh-28px)] rounded-sm"
                    style={{
                        backgroundColor: '#c9a76b',
                        backgroundImage: `
                            radial-gradient(ellipse at 10% 10%, rgba(220,180,95,0.55) 0%, transparent 45%),
                            radial-gradient(ellipse at 90% 90%, rgba(155,105,35,0.40) 0%, transparent 45%),
                            radial-gradient(ellipse at 50% 50%, rgba(200,155,70,0.20) 0%, transparent 65%),
                            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6'%3E%3Ccircle cx='1.5' cy='1.5' r='0.8' fill='rgba(90,50,0,0.07)'/%3E%3Ccircle cx='4.5' cy='4.5' r='0.7' fill='rgba(255,200,80,0.06)'/%3E%3Ccircle cx='1' cy='4.5' r='0.5' fill='rgba(80,40,0,0.05)'/%3E%3Ccircle cx='4.5' cy='1.5' r='0.6' fill='rgba(200,150,50,0.06)'/%3E%3C/svg%3E")
                        `,
                        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.25), inset 4px 4px 12px rgba(0,0,0,0.15)',
                    }}
                >
                    {/* ── sticky top nav ── */}
                    <div
                        className="sticky top-0 z-40 flex items-center justify-between px-5 py-3"
                        style={{
                            background: 'rgba(90,56,32,0.78)',
                            backdropFilter: 'blur(10px)',
                            borderBottom: '1px solid rgba(255,255,255,0.07)',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
                        }}
                    >
                        <button onClick={onBack}
                            className="flex items-center gap-1.5 transition-opacity hover:opacity-100 opacity-70"
                            style={{ fontFamily: "'Kalam', cursive", fontSize: 14, color: '#fde68a' }}>
                            <ArrowLeft size={15} /> Back
                        </button>

                        <span style={{ fontFamily: "'Caveat', cursive", fontSize: 17, fontWeight: 700, color: '#fef9c3', letterSpacing: '0.02em' }}>
                            {creator ? `${creator.displayName}'s Board` : 'Diem Board'}
                        </span>

                        <button
                            onClick={handleDiemClick}
                            className="flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
                            style={{
                                fontFamily: "'Caveat', cursive",
                                fontSize: 14,
                                fontWeight: 700,
                                background: '#fde68a',
                                color: '#78350f',
                                padding: '5px 14px',
                                borderRadius: 3,
                                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                            }}>
                            📌 Post a Diem
                        </button>
                    </div>

                    {/* ── board content ── */}
                    <div className="pt-8 pb-32 overflow-x-auto">

                        {/* Creator card — centered above canvas */}
                        {creator && (
                            <div className="flex justify-center mb-10" style={{ minWidth: canvasW }}>
                                <CreatorCard creator={creator} delay={80} />
                            </div>
                        )}

                        {isLoading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 size={30} className="animate-spin" style={{ color: 'rgba(254,249,195,0.6)' }} />
                            </div>
                        ) : (
                            /* Unified absolute canvas — same coordinate space as creator board */
                            <div className="relative mx-auto" style={{ width: canvasW, height: canvasH }}>
                                {/* Link stickers */}
                                {visibleLinks.map((link: any, i: number) => {
                                    const { x, y } = linkPositions[i];
                                    const sqSize = getLinkSize(link);
                                    return (
                                        <div key={link.id || i} style={{ position: 'absolute', left: x, top: y, width: sqSize || LINK_W }}>
                                            <LinkSticker link={link} idx={i} />
                                        </div>
                                    );
                                })}
                                {/* Post stickers */}
                                {posts.length === 0 ? (
                                    <div style={{ position: 'absolute', left: BOARD_PAD, top: BOARD_PAD }}>
                                        <div className="relative note-hover" style={{ transform: 'rotate(-1.2deg)' }}>
                                            <PushPin color="#1d4ed8" delay={400} />
                                            <div className="note-in mt-4 rounded-sm p-6 w-64 text-center"
                                                style={{
                                                    animationDelay: '400ms',
                                                    background: '#fefef0',
                                                    backgroundImage: 'repeating-linear-gradient(transparent 0px, transparent 23px, rgba(0,0,0,0.04) 23px, rgba(0,0,0,0.04) 24px)',
                                                    boxShadow: '2px 5px 14px rgba(0,0,0,0.18)',
                                                }}>
                                                <p style={{ fontFamily: "'Kalam', cursive", fontSize: 14, color: '#57534e', lineHeight: 1.7 }}>
                                                    No posts yet. Be the first to pin a Diem on the board!
                                                </p>
                                                <button onClick={handleDiemClick}
                                                    style={{ fontFamily: "'Caveat', cursive", fontSize: 15, fontWeight: 700, color: '#1d4ed8' }}
                                                    className="mt-3 hover:underline">
                                                    Post a Diem →
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : posts.map((post, i) => {
                                    const { x, y } = postPositions[i];
                                    return (
                                        <div key={post.id} style={{ position: 'absolute', left: x, top: y, width: NOTE_W }}>
                                            <PaperNote
                                                post={post} idx={i}
                                                isOwn={currentUser?.id === post.fanId} isCreator={isCreator}
                                                delay={200 + i * 55}
                                                onClick={() => handleNoteClick(post)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Floating pin button */}
                    <button
                        onClick={handleDiemClick}
                        className="fixed bottom-8 right-7 z-30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                        style={{
                            background: 'radial-gradient(circle at 38% 32%, rgba(255,255,255,0.4) 0%, #dc2626 40%, #7f1d1d 100%)',
                            width: 60, height: 60,
                            borderRadius: '50%',
                            boxShadow: '0 5px 20px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.25), inset 0 1px 4px rgba(255,255,255,0.4)',
                            color: 'white',
                            fontSize: 24,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        title="Post a Diem"
                    >
                        📌
                    </button>
                </div>
            </div>

            {showCompose && creator && (
                <ComposeModal creator={creator} onClose={() => setCompose(false)} onSubmit={handlePost} />
            )}
            {selectedPost && creator && (
                <ThreadModal post={selectedPost} creator={creator} onClose={() => setSelected(null)} />
            )}
        </>
    );
};
