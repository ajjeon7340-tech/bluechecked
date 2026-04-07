import React, { useState, useEffect, useCallback } from 'react';
import { CreatorProfile, CurrentUser } from '../types';
import { getBoardPosts, createBoardPost, BoardPost } from '../services/realBackend';
import { ArrowLeft, Lock, Globe, CheckCircle, ExternalLink, X, Loader2 } from 'lucide-react';

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

// ── link sticky note ──────────────────────────────────────────────────────────

const LinkNote: React.FC<{ link: any; idx: number; delay: number }> = ({ link, idx, delay }) => {
    const { bg, strip, text } = getStickyStyle(idx);
    const pc   = getPinColor(link.id || String(idx), idx);
    const rot  = noteRot(link.id   || String(idx), idx + 20);

    return (
        <div className="relative note-hover cursor-pointer"
            style={{ transform: `rotate(${rot}deg)` }}
            onClick={() => link.url && window.open(link.url, '_blank')}>
            <PushPin color={pc} delay={delay} />
            <div
                className="note-in note-lift mt-4 w-44 rounded-sm overflow-hidden"
                style={{
                    animationDelay: `${delay}ms`,
                    background: bg,
                    backgroundImage: `linear-gradient(to bottom, ${strip} 10%, ${bg} 10%)`,
                    boxShadow: '2px 5px 14px rgba(0,0,0,0.20), 0 1px 3px rgba(0,0,0,0.08)',
                }}
            >
                <div className="px-3.5 pt-4 pb-4">
                    <p style={{ fontFamily: "'Caveat', cursive", fontSize: 16, fontWeight: 600, color: text, lineHeight: 1.35 }}
                        className="line-clamp-2 mb-1">
                        {link.title || link.label || 'Link'}
                    </p>
                    {link.description && (
                        <p style={{ fontFamily: "'Kalam', cursive", fontSize: 12, color: text, opacity: 0.75, lineHeight: 1.5 }}
                            className="line-clamp-3 mb-2">
                            {link.description}
                        </p>
                    )}
                    {link.price > 0 && (
                        <span className="inline-block text-[11px] font-bold rounded-full px-2 py-0.5"
                            style={{ background: 'rgba(0,0,0,0.12)', color: text }}>
                            {link.price} credits
                        </span>
                    )}
                    {link.url && (
                        <div className="mt-2 flex items-center gap-1" style={{ color: text, opacity: 0.5 }}>
                            <ExternalLink size={9} />
                            <span className="text-[10px] truncate">
                                {link.url.replace(/^https?:\/\//, '').split('/')[0]}
                            </span>
                        </div>
                    )}
                </div>
                {/* Folded corner */}
                <div className="absolute bottom-0 right-0 w-5 h-5"
                    style={{ background: `linear-gradient(225deg, rgba(0,0,0,0.14) 45%, transparent 45%)` }} />
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

                    <div className="flex items-center justify-between">
                        <span style={{ fontFamily: "'Kalam', cursive", fontSize: 12, color: text, opacity: 0.5 }}>
                            {content.length}/500
                        </span>
                    </div>

                    {/* Public / Private toggle */}
                    <button
                        onClick={() => setIsPrivate(p => !p)}
                        className="w-full flex items-center justify-between px-4 py-2.5 rounded-sm transition-all"
                        style={{ background: 'rgba(0,0,0,0.10)', border: '2px solid rgba(0,0,0,0.12)' }}>
                        <span className="flex items-center gap-2" style={{ fontFamily: "'Caveat', cursive", fontSize: 15, fontWeight: 700, color: text }}>
                            {isPrivate ? <Lock size={14} /> : <Globe size={14} />}
                            {isPrivate ? 'Private' : 'Public'}
                        </span>
                        <span className="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200"
                            style={{ background: isPrivate ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.18)' }}>
                            <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                                style={{ transform: isPrivate ? 'translateX(18px)' : 'translateX(2px)' }} />
                        </span>
                    </button>

                    <p style={{ fontFamily: "'Kalam', cursive", fontSize: 12, color: text, opacity: 0.65, lineHeight: 1.6 }}>
                        {isPrivate
                            ? '🔒 Only you and the creator will ever see this.'
                            : `🌐 Becomes public once ${creator.displayName} replies.`}
                    </p>

                    {/* Submit */}
                    <button
                        onClick={submit}
                        disabled={!content.trim() || isSubmitting}
                        className="w-full py-3 rounded-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40"
                        style={{
                            background: 'rgba(0,0,0,0.18)',
                            fontFamily: "'Caveat', cursive",
                            fontSize: 17,
                            fontWeight: 700,
                            color: text,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                        }}>
                        {isSubmitting
                            ? <Loader2 size={16} className="animate-spin" />
                            : <span>📌</span>
                        }
                        {isSubmitting ? 'Pinning to board...' : 'Pin to Board'}
                    </button>
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

    const allLinks = [
        ...(creator?.links    || []),
        ...(creator?.products || []).map((p: any) => ({ ...p, _isProduct: true })),
    ];

    const NOTE_W = 252;
    const NOTE_H_EST = 272;
    const NOTE_GAP_X = 28;
    const NOTE_GAP_Y = 36;
    const BOARD_PAD = 32;
    const PUB_COLS = 2; // 2 cols fit within 640px guide width
    const publicPositions = posts.map((post, idx) => {
        if (post.positionX != null && post.positionY != null) return { x: post.positionX, y: post.positionY };
        const col = idx % PUB_COLS;
        const row = Math.floor(idx / PUB_COLS);
        return { x: BOARD_PAD + col * (NOTE_W + NOTE_GAP_X), y: BOARD_PAD + row * (NOTE_H_EST + NOTE_GAP_Y) };
    });
    const publicCanvasH = Math.max(...publicPositions.map(p => p.y + NOTE_H_EST), 440);

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
                    <div className="max-w-2xl mx-auto px-4 pt-12 pb-32">

                        {/* Creator card — centered at top */}
                        {creator && (
                            <div className="flex justify-center mb-14">
                                <CreatorCard creator={creator} delay={80} />
                            </div>
                        )}

                        {/* Links as sticky notes */}
                        {allLinks.length > 0 && (
                            <div className="mb-14">
                                <div className="flex flex-wrap gap-7 justify-center items-end">
                                    {allLinks.slice(0, 8).map((link: any, i: number) => (
                                        <LinkNote key={link.id || i} link={link} idx={i} delay={150 + i * 60} />
                                    ))}
                                </div>
                                {/* Cork board dividing tack-strip */}
                                <div className="mt-12 flex items-center gap-4">
                                    <div className="flex-1 h-px" style={{ background: 'rgba(90,56,32,0.2)' }} />
                                    <div className="flex gap-3">
                                        {['#dc2626','#1d4ed8','#15803d'].map((c, i) => (
                                            <div key={i} className="w-3 h-3 rounded-full"
                                                style={{ background: `radial-gradient(circle at 38% 32%, rgba(255,255,255,0.6) 0%, ${c} 50%, rgba(0,0,0,0.4) 100%)`, boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
                                        ))}
                                    </div>
                                    <div className="flex-1 h-px" style={{ background: 'rgba(90,56,32,0.2)' }} />
                                </div>
                            </div>
                        )}

                        {/* Board posts */}
                        {isLoading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 size={30} className="animate-spin" style={{ color: 'rgba(254,249,195,0.6)' }} />
                            </div>
                        ) : posts.length === 0 ? (
                            <div className="flex justify-center py-20">
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
                        ) : (
                            <div className="relative" style={{ height: publicCanvasH }}>
                                {posts.map((post, i) => {
                                    const { x, y } = publicPositions[i];
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
