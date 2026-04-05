import React, { useState, useEffect, useCallback } from 'react';
import { CreatorProfile, CurrentUser } from '../types';
import { getPendingBoardPosts, getBoardPosts, replyToBoardPost, BoardPost } from '../services/realBackend';
import { ArrowLeft, Lock, Globe, CheckCircle, Clock, Loader2, Send, X, MessageSquare } from 'lucide-react';

interface Props {
    creator: CreatorProfile | null;
    currentUser: CurrentUser | null;
    onBack: () => void;
    onLogout: () => void;
}

const timeAgo = (d: string): string => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

// ── reply panel ───────────────────────────────────────────────────────────────

const ReplyPanel: React.FC<{
    post: BoardPost; creator: CreatorProfile;
    onClose: () => void; onReplied: (id: string, reply: string) => void;
}> = ({ post, creator, onClose, onReplied }) => {
    const [replyText, setReply]     = useState('');
    const [isSubmitting, setSubmit] = useState(false);

    const submit = async () => {
        if (!replyText.trim() || isSubmitting) return;
        setSubmit(true);
        try { await replyToBoardPost(post.id, replyText.trim()); onReplied(post.id, replyText.trim()); onClose(); }
        catch (e: any) { alert(e.message || 'Failed to reply'); }
        finally { setSubmit(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(28,25,23,0.72)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}>
            <div
                className="bg-white w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
                style={{ maxHeight: '92vh', boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
                    <h3 style={{ fontFamily: "'Caveat', cursive", fontSize: 20, fontWeight: 700, color: '#1c1917' }}>
                        Reply to Post
                    </h3>
                    <button onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-100 transition-colors">
                        <X size={16} className="text-stone-400" />
                    </button>
                </div>

                {/* Fan's message */}
                <div className="p-5 border-b border-stone-100"
                    style={{ background: '#fefef8', borderLeft: '4px solid rgba(59,130,246,0.35)' }}>
                    <div className="flex items-start gap-3">
                        {post.fanAvatarUrl
                            ? <img src={post.fanAvatarUrl} className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5"
                                style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} />
                            : <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span style={{ fontFamily: "'Caveat', cursive", fontSize: 16, fontWeight: 700, color: '#78716c' }}>
                                    {post.fanName[0]}
                                </span>
                              </div>
                        }
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <span style={{ fontFamily: "'Caveat', cursive", fontSize: 16, fontWeight: 700, color: '#1c1917' }}>
                                    {post.fanName}
                                </span>
                                <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-medium">FAN</span>
                                {post.isPrivate
                                    ? <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5"><Lock size={8} /> Private</span>
                                    : <span className="text-[10px] bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5"><Globe size={8} /> Public</span>
                                }
                                <span className="text-xs text-stone-400 ml-auto">· {timeAgo(post.createdAt)}</span>
                            </div>
                            <p style={{ fontFamily: "'Kalam', cursive", fontSize: 14, color: '#292524', lineHeight: 1.65 }}>
                                {post.content}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Creator reply area */}
                <div className="p-5 flex-1 overflow-y-auto">
                    <div className="flex items-start gap-3">
                        {creator.avatarUrl
                            ? <img src={creator.avatarUrl} className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-1"
                                style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} />
                            : <div className="w-10 h-10 rounded-full bg-stone-200 flex-shrink-0 mt-1" />
                        }
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span style={{ fontFamily: "'Caveat', cursive", fontSize: 16, fontWeight: 700, color: '#1c1917' }}>
                                    {creator.displayName}
                                </span>
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                                    <CheckCircle size={9} /> CREATOR
                                </span>
                            </div>
                            <textarea
                                autoFocus
                                value={replyText}
                                onChange={e => setReply(e.target.value)}
                                placeholder="Write your reply..."
                                maxLength={1000}
                                rows={5}
                                className="w-full resize-none rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 leading-relaxed"
                                style={{ fontFamily: "'Kalam', cursive", fontSize: 14 }}
                            />
                            <div className="text-right text-xs text-stone-400 mt-1">{replyText.length}/1000</div>
                        </div>
                    </div>

                    {!post.isPrivate && (
                        <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-700 leading-relaxed">
                            <Globe size={11} className="inline mr-1" />
                            Replying will make this thread <strong>publicly visible</strong> on your board.
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="px-5 pb-5 pt-2 flex gap-3 border-t border-stone-100">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-medium text-sm hover:bg-stone-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={!replyText.trim() || isSubmitting}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
                        style={{ background: '#1c1917', color: '#fef9c3' }}>
                        {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                        {isSubmitting ? 'Sending...' : 'Reply'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── post card ─────────────────────────────────────────────────────────────────

const PostCard: React.FC<{ post: BoardPost; isReplied?: boolean; onClick: () => void }> =
    ({ post, isReplied, onClick }) => (
        <div
            onClick={onClick}
            className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all hover:shadow-sm"
            style={{
                background: isReplied ? '#fff' : '#fffbef',
                borderColor: isReplied ? '#e7e5e4' : '#fde68a',
            }}
        >
            {post.fanAvatarUrl
                ? <img src={post.fanAvatarUrl} className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-0.5"
                    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }} />
                : <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span style={{ fontFamily: "'Caveat', cursive", fontSize: 14, fontWeight: 700, color: '#78716c' }}>
                        {post.fanName[0]}
                    </span>
                  </div>
            }
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span style={{ fontFamily: "'Caveat', cursive", fontSize: 15, fontWeight: 700, color: '#1c1917' }}>
                        {post.fanName}
                    </span>
                    {post.isPrivate
                        ? <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Lock size={8} /> Private</span>
                        : <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Globe size={8} /> Public</span>
                    }
                    <span className="text-xs text-stone-400 ml-auto">{timeAgo(post.createdAt)}</span>
                </div>
                <p className="text-sm text-stone-600 line-clamp-2 leading-relaxed"
                    style={{ fontFamily: "'Kalam', cursive", fontSize: 13 }}>
                    {post.content}
                </p>
                {isReplied && post.reply && (
                    <p className="text-xs text-emerald-600 mt-1.5 line-clamp-1 flex items-center gap-1"
                        style={{ fontFamily: "'Kalam', cursive" }}>
                        <CheckCircle size={10} /> {post.reply}
                    </p>
                )}
            </div>
            {!isReplied && (
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                    style={{ background: 'radial-gradient(circle at 38% 32%, rgba(255,255,255,0.6) 0%, #f59e0b 50%, rgba(0,0,0,0.3) 100%)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            )}
        </div>
    );

// ── main ──────────────────────────────────────────────────────────────────────

export const BoardDashboard: React.FC<Props> = ({ creator, currentUser, onBack, onLogout }) => {
    const [pendingPosts, setPending]    = useState<BoardPost[]>([]);
    const [repliedPosts, setReplied]    = useState<BoardPost[]>([]);
    const [isLoading, setLoading]       = useState(true);
    const [activeTab, setTab]           = useState<'pending' | 'replied'>('pending');
    const [selectedPost, setSelected]   = useState<BoardPost | null>(null);

    const load = useCallback(async () => {
        if (!creator) return;
        setLoading(true);
        const [pending, all] = await Promise.all([getPendingBoardPosts(creator.id), getBoardPosts(creator.id)]);
        setPending(pending);
        setReplied(all.filter(p => p.reply));
        setLoading(false);
    }, [creator]);

    useEffect(() => { load(); }, [load]);

    const handleReplied = (postId: string, reply: string) => {
        const post = pendingPosts.find(p => p.id === postId);
        if (post) {
            const updated = { ...post, reply, replyAt: new Date().toISOString() };
            setPending(prev => prev.filter(p => p.id !== postId));
            setReplied(prev => [updated, ...prev]);
        }
    };

    if (!currentUser || currentUser.role !== 'CREATOR') {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#faf9f5' }}>
                <div className="text-center p-8">
                    <p className="text-stone-500 mb-4" style={{ fontFamily: "'Kalam', cursive" }}>Creator access required.</p>
                    <button onClick={onBack} className="text-sm text-stone-700 underline">Go back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col" style={{ background: '#faf9f5' }}>
            {/* Header — warm cork-toned */}
            <div className="sticky top-0 z-40 border-b flex items-center justify-between px-5 py-3.5"
                style={{
                    background: 'linear-gradient(to bottom, #9a7050, #7a5535)',
                    borderColor: 'rgba(0,0,0,0.15)',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                }}>
                <button onClick={onBack}
                    className="flex items-center gap-1.5 opacity-75 hover:opacity-100 transition-opacity"
                    style={{ fontFamily: "'Kalam', cursive", fontSize: 14, color: '#fde68a' }}>
                    <ArrowLeft size={15} /> Back
                </button>
                <div className="flex items-center gap-2.5">
                    {creator?.avatarUrl
                        ? <img src={creator.avatarUrl} className="w-7 h-7 rounded-full object-cover"
                            style={{ boxShadow: '0 0 0 2px rgba(255,255,255,0.3)' }} />
                        : <div className="w-7 h-7 rounded-full bg-amber-200/30" />
                    }
                    <span style={{ fontFamily: "'Caveat', cursive", fontSize: 17, fontWeight: 700, color: '#fef9c3' }}>
                        {creator?.displayName} — Board
                    </span>
                </div>
                <button onClick={onLogout}
                    className="opacity-50 hover:opacity-80 transition-opacity"
                    style={{ fontFamily: "'Kalam', cursive", fontSize: 12, color: '#fde68a' }}>
                    Sign out
                </button>
            </div>

            <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="rounded-2xl border p-5 text-center"
                        style={{ background: '#fffbef', borderColor: '#fde68a', boxShadow: '0 2px 8px rgba(245,158,11,0.08)' }}>
                        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 36, fontWeight: 700, color: '#b45309', lineHeight: 1 }}>
                            {pendingPosts.length}
                        </p>
                        <p className="text-xs font-medium mt-1 flex items-center justify-center gap-1" style={{ color: '#92400e' }}>
                            <Clock size={10} /> Awaiting reply
                        </p>
                    </div>
                    <div className="rounded-2xl border p-5 text-center"
                        style={{ background: '#f0fdf4', borderColor: '#bbf7d0', boxShadow: '0 2px 8px rgba(16,185,129,0.06)' }}>
                        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 36, fontWeight: 700, color: '#15803d', lineHeight: 1 }}>
                            {repliedPosts.length}
                        </p>
                        <p className="text-xs font-medium mt-1 flex items-center justify-center gap-1" style={{ color: '#166534' }}>
                            <CheckCircle size={10} /> Replied
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex rounded-xl overflow-hidden mb-4 border"
                    style={{ borderColor: '#e7e5e4', background: '#fff' }}>
                    {[
                        { key: 'pending', icon: <Clock size={13} />, label: 'Pending', count: pendingPosts.length },
                        { key: 'replied', icon: <CheckCircle size={13} />, label: 'Replied', count: null },
                    ].map(({ key, icon, label, count }) => (
                        <button key={key}
                            onClick={() => setTab(key as any)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors"
                            style={{
                                fontFamily: "'Caveat', cursive",
                                fontSize: 15,
                                background: activeTab === key ? '#1c1917' : 'transparent',
                                color: activeTab === key ? '#fef9c3' : '#78716c',
                            }}>
                            {icon} {label}
                            {count != null && count > 0 && (
                                <span className="text-[10px] rounded-full px-1.5 py-0.5 font-bold"
                                    style={{ background: activeTab === key ? 'rgba(255,255,255,0.15)' : '#fef9c3', color: activeTab === key ? '#fef9c3' : '#b45309' }}>
                                    {count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 size={24} className="animate-spin text-stone-300" />
                    </div>
                ) : activeTab === 'pending' ? (
                    pendingPosts.length === 0
                        ? <div className="text-center py-20">
                            <MessageSquare size={36} className="mx-auto mb-3 text-stone-200" />
                            <p style={{ fontFamily: "'Kalam', cursive", fontSize: 14 }} className="text-stone-400">
                                All caught up — no pending posts!
                            </p>
                          </div>
                        : <div className="space-y-2">
                            {pendingPosts.map(p => <PostCard key={p.id} post={p} onClick={() => setSelected(p)} />)}
                          </div>
                ) : (
                    repliedPosts.length === 0
                        ? <div className="text-center py-20">
                            <CheckCircle size={36} className="mx-auto mb-3 text-stone-200" />
                            <p style={{ fontFamily: "'Kalam', cursive", fontSize: 14 }} className="text-stone-400">
                                No replied posts yet.
                            </p>
                          </div>
                        : <div className="space-y-2">
                            {repliedPosts.map(p => <PostCard key={p.id} post={p} isReplied onClick={() => setSelected(p)} />)}
                          </div>
                )}
            </div>

            {selectedPost && creator && (
                <ReplyPanel post={selectedPost} creator={creator}
                    onClose={() => setSelected(null)} onReplied={handleReplied} />
            )}
        </div>
    );
};
