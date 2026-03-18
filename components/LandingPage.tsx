
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { LanguageSwitcher } from './LanguageSwitcher';
import { DiemLogo, CheckCircle2, MessageSquare, ArrowRight, Clock, Sparkles, User, Heart, Lock, Check, ShoppingBag, FileText, Coins, X, Download, Verified, ExternalLink } from './Icons';
interface Props {
  onLoginClick: () => void;
  onDemoClick: () => void;
}

// Featured creators for the landing page
const getFeaturedConversations = (t: (key: string) => string) => [
  {
    id: '1',
    creator: {
      name: t('landing.conv1CreatorName'),
      role: t('landing.conv1CreatorRole'),
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=face',
    },
    request: t('landing.conv1Request'),
    response: t('landing.conv1Response'),
    gradient: 'from-purple-100 to-violet-50',
    time: t('landing.conv1Time'),
    fullThread: [
        { role: 'FAN', content: t('landing.conv1Thread1'), attachment: { name: 'My_Resume_2025.pdf', type: 'PDF' }, time: t('landing.conv1Thread1Time') },
        { role: 'CREATOR', content: t('landing.conv1Thread2'), time: t('landing.conv1Thread2Time') },
        { role: 'CREATOR', content: t('landing.conv1Thread2b'), attachment: { name: 'Ji-won_Revised_Resume.pdf', type: 'PDF' }, time: t('landing.conv1Thread2bTime') },
        { role: 'CREATOR', content: t('landing.conv1Thread3'), attachment: { name: 'Expected_Interview_Questions.pdf', type: 'PDF' }, time: t('landing.conv1Thread3Time') },
        { role: 'CREATOR', content: t('landing.conv1Thread4'), time: t('landing.conv1Thread4Time') }
    ]
  },
  {
    id: '2',
    creator: {
      name: t('landing.conv2CreatorName'),
      role: t('landing.conv2CreatorRole'),
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face',
    },
    request: t('landing.conv2Request'),
    response: t('landing.conv2Response'),
    gradient: 'from-pink-100 to-rose-50',
    time: t('landing.conv2Time'),
    fullThread: [
        { role: 'FAN', content: t('landing.conv2Thread1'), image: '/fan-outfit.png', time: t('landing.conv2Thread1Time') },
        { role: 'CREATOR', content: t('landing.conv2Thread2'), attachment: { name: 'Chloe_Jewelry_Styling_Guide.pdf', type: 'PDF' }, time: t('landing.conv2Thread2Time') }
    ]
  },
  {
    id: '3',
    creator: {
      name: t('landing.conv3CreatorName'),
      role: t('landing.conv3CreatorRole'),
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    },
    request: t('landing.conv3Request'),
    response: t('landing.conv3Response'),
    gradient: 'from-emerald-100 to-teal-50',
    time: t('landing.conv3Time'),
    fullThread: [
        { role: 'FAN', content: t('landing.conv3Thread1'), image: '/stock-chart.png', time: t('landing.conv3Thread1Time') },
        { role: 'CREATOR', content: t('landing.conv3Thread2'), attachment: { name: 'David_Portfolio_Strategy.pdf', type: 'PDF' }, time: t('landing.conv3Thread2Time') }
    ]
  },
];

export const LandingPage: React.FC<Props> = ({ onLoginClick, onDemoClick }) => {
  const { t } = useTranslation();
  const FEATURED_CONVERSATIONS = getFeaturedConversations(t);
  const [expandedConversation, setExpandedConversation] = useState<typeof FEATURED_CONVERSATIONS[0] | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
  const [convIdx, setConvIdx] = useState(0);
  const [stepsIdx, setStepsIdx] = useState(0);
  const [howItWorksVisible, setHowItWorksVisible] = useState(false);
  const howItWorksRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const t = setInterval(() => setConvIdx(i => (i + 1) % FEATURED_CONVERSATIONS.length), 3500);
    return () => clearInterval(t);
  }, [FEATURED_CONVERSATIONS.length]);

  useEffect(() => {
    const t = setInterval(() => setStepsIdx(i => (i + 1) % 3), 3500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = howItWorksRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setHowItWorksVisible(true); observer.disconnect(); } },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF9] font-sans selection:bg-amber-100 selection:text-amber-900 overflow-x-hidden">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-soft {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes float-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-pulse-soft {
          animation: pulse-soft 3s ease-in-out infinite;
        }
        .animate-float-gentle {
          animation: float-gentle 6s ease-in-out infinite;
        }
        @keyframes lp-sketch { to { stroke-dashoffset: 0; } }
        @keyframes lp-pop { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes lp-float { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-8px)} }
        @keyframes lp-bounce { 0%,100%{transform:translateY(0px)} 45%{transform:translateY(-11px)} 60%{transform:translateY(-8px)} }
        @keyframes lp-twinkle { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.06;transform:scale(0.25)} }
        @keyframes lp-coin-rise { 0%{transform:translateY(0px);opacity:0} 18%{opacity:1} 82%{opacity:.6} 100%{transform:translateY(-32px);opacity:0} }
      `}</style>

      {/* Navigation - Minimal & Warm */}
      <nav className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => window.location.reload()}>
          <DiemLogo size={24} className="text-stone-800" />
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <button
            onClick={onDemoClick}
            className="hidden sm:block text-sm text-stone-500 hover:text-stone-800 transition-colors font-medium"
          >
            {t('landing.viewDemo')}
          </button>
          <button
            onClick={onLoginClick}
            className="bg-stone-900 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-stone-800 transition-all"
          >
            {t('common.signIn')}
          </button>
        </div>
      </nav>

      {/* Hero - Intimate & Editorial */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 lg:pt-24 lg:pb-32">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Soft Badge */}
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-700 px-4 py-2 rounded-full text-sm font-medium">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse-soft"></span>
            {t('landing.nowWelcoming')}
          </div>

          {/* Main Headline - Editorial Typography */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-stone-900 tracking-tight leading-[1.15]">
            {t('landing.heroTitle1')}
            <br />
            <span className="text-stone-400">{t('landing.heroTitle2')}</span>
          </h1>

          {/* Subtext - Generous Line Height */}
          <p className="text-lg sm:text-xl text-stone-500 leading-relaxed max-w-2xl mx-auto font-normal">
            {t('landing.heroSubtext1')}
            {' '}{t('landing.heroSubtext2')}
            <span className="text-stone-400"> {t('landing.heroSubtext3')}</span>
          </p>

          {/* CTA Buttons - Soft & Rounded */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={onLoginClick}
              className="w-full sm:w-auto bg-stone-900 text-white px-8 py-4 rounded-full font-medium text-base hover:bg-stone-800 transition-all flex items-center justify-center gap-2 group"
            >
              {t('landing.startAsCreator')}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={onDemoClick}
              className="w-full sm:w-auto bg-white text-stone-700 border border-stone-200 px-8 py-4 rounded-full font-medium text-base hover:bg-stone-50 transition-all"
            >
              {t('landing.exploreDemo')}
            </button>
          </div>
        </div>
      </section>

      {/* Featured Conversations - Weverse Magazine Style */}
      <section className="bg-white py-24 border-t border-stone-100">
        <div className="max-w-6xl mx-auto px-6">
          {/* Section Header */}
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-stone-400 uppercase tracking-wider mb-4">{t('landing.fromCommunity')}</p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-stone-900 tracking-tight">
              {t('landing.realConversations')}
            </h2>
          </div>

          {/* Creator Cards - Mobile Carousel */}
          <div className="md:hidden overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${convIdx * 100}%)` }}
            >
              {FEATURED_CONVERSATIONS.map((item) => (
                <div
                  key={item.id}
                  className="w-full flex-shrink-0 group bg-white rounded-3xl p-6 border border-stone-200 shadow-sm cursor-pointer flex flex-col"
                  onClick={() => setExpandedConversation(item)}
                >
                {/* 1. Request (Fan) */}
                <div className="flex relative z-10">
                    {/* Left: Avatar + Thread Line */}
                    <div className="flex flex-col items-center mr-3 relative">
                        <div className="absolute left-[17px] top-10 -bottom-6 w-0.5 bg-stone-200"></div>
                        <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 border border-stone-200 flex-shrink-0">
                            <User size={16} />
                        </div>
                    </div>

                    {/* Right: Content */}
                    <div className="flex-1 min-w-0 pb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-sm text-stone-900">{t('landing.anonymousFan')}</span>
                            <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                <User size={10} className="fill-current" />
                                <span className="text-[9px] font-semibold uppercase tracking-wide">{t('common.fan')}</span>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl rounded-tl-lg border border-stone-200 shadow-sm">
                            <p className="text-sm text-stone-700 leading-relaxed">{item.request}</p>
                        </div>
                    </div>
                </div>

                {/* 2. Response (Creator) */}
                <div className="flex relative z-10">
                    {/* Left: Avatar */}
                    <div className="flex flex-col items-center mr-3 relative">
                        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-stone-200">
                            <img src={item.creator.avatar} alt={item.creator.name} className="w-full h-full object-cover" />
                        </div>
                    </div>

                    {/* Right: Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-sm text-stone-900">{item.creator.name}</span>
                            <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-1 rounded-full flex-shrink-0 overflow-visible">
                                <Verified size={12} />
                                <span className="text-[9px] font-semibold uppercase tracking-wide">{t('common.creator')}</span>
                            </div>
                        </div>
                        <div className="bg-stone-50 p-4 rounded-2xl rounded-tl-lg border border-stone-200/60">
                            <p className="text-sm text-stone-700 leading-relaxed">{item.response}</p>
                        </div>
                    </div>
                </div>
              </div>
              ))}
            </div>
            {/* Dots */}
            <div className="flex justify-center gap-2 mt-6">
              {FEATURED_CONVERSATIONS.map((_, i) => (
                <button key={i} onClick={() => setConvIdx(i)} className={`w-2 h-2 rounded-full transition-all duration-300 ${convIdx === i ? 'bg-stone-900 w-5' : 'bg-stone-300'}`} />
              ))}
            </div>
          </div>

          {/* Creator Cards - Desktop Grid */}
          <div className="hidden md:grid md:grid-cols-3 gap-6 lg:gap-8">
            {FEATURED_CONVERSATIONS.map((item) => (
              <div
                key={item.id}
                className="group bg-white rounded-3xl p-6 border border-stone-200 shadow-sm hover:shadow-xl hover:shadow-stone-200/50 hover:-translate-y-1 transition-all duration-500 cursor-pointer flex flex-col"
                onClick={() => setExpandedConversation(item)}
              >
                {/* 1. Request (Fan) */}
                <div className="flex relative z-10">
                    <div className="flex flex-col items-center mr-3 relative">
                        <div className="absolute left-[17px] top-10 -bottom-6 w-0.5 bg-stone-200"></div>
                        <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 border border-stone-200 flex-shrink-0">
                            <User size={16} />
                        </div>
                    </div>
                    <div className="flex-1 min-w-0 pb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-sm text-stone-900">{t('landing.anonymousFan')}</span>
                            <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                <User size={10} className="fill-current" />
                                <span className="text-[9px] font-semibold uppercase tracking-wide">{t('common.fan')}</span>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl rounded-tl-lg border border-stone-200 shadow-sm">
                            <p className="text-sm text-stone-700 leading-relaxed">{item.request}</p>
                        </div>
                    </div>
                </div>
                {/* 2. Response (Creator) */}
                <div className="flex relative z-10">
                    <div className="flex flex-col items-center mr-3 relative">
                        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-stone-200">
                            <img src={item.creator.avatar} alt={item.creator.name} className="w-full h-full object-cover" />
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-sm text-stone-900">{item.creator.name}</span>
                            <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-1 rounded-full flex-shrink-0 overflow-visible">
                                <Verified size={12} />
                                <span className="text-[9px] font-semibold uppercase tracking-wide">{t('common.creator')}</span>
                            </div>
                        </div>
                        <div className="bg-stone-50 p-4 rounded-2xl rounded-tl-lg border border-stone-200/60">
                            <p className="text-sm text-stone-700 leading-relaxed">{item.response}</p>
                        </div>
                    </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Clean & Warm */}
      <section ref={howItWorksRef} className="py-24 bg-[#FAFAF9]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-stone-400 uppercase tracking-wider mb-4">{t('landing.simpleTransparent')}</p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-stone-900 tracking-tight">
              {t('landing.howItWorks')}
            </h2>
          </div>

          {/* Mobile Carousel */}
          {(() => {
            const v = howItWorksVisible;
            // Per-step sketch SVG illustrations
            const S = (delay: number, dur = 0.5) =>
              v ? { animation: `lp-sketch ${dur}s ease forwards ${delay}s` } : {};
            const ST = (skD: number, skDur: number, twDur: number, twDel: number) =>
              v ? { animation: `lp-sketch ${skDur}s ease forwards ${skD}s, lp-twinkle ${twDur}s ease-in-out infinite ${twDel}s` } : {};

            const sketchIllustrations = [

              /* ── Step 1: Set Your Rate — Price tag with coin ── */
              <svg key="s1" viewBox="0 0 122 96" width="122" height="96" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Main tag group — gentle float after draw */}
                <g style={v ? { animation: 'lp-float 3.6s ease-in-out infinite 2.4s', transformBox: 'fill-box', transformOrigin: 'center' } : {}}>
                  {/* Tag outer shape (left-pointing arrow) */}
                  <path d="M 34 12 L 96 12 Q 108 12 108 24 L 108 72 Q 108 84 96 84 L 34 84 L 12 48 Z"
                    stroke="#1c1917" strokeWidth="2.5" strokeLinejoin="round"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(0.1, 0.7)} />
                  {/* Inner dashed border */}
                  <path d="M 38 18 L 94 18 Q 103 18 103 27 L 103 69 Q 103 78 94 78 L 38 78 L 18 48 Z"
                    stroke="#d6d3d1" strokeWidth="1" strokeLinejoin="round" strokeDasharray="4 3"
                    pathLength={1} strokeDashoffset={1} style={S(0.5, 0.6)} />
                  {/* Punch hole */}
                  <circle cx="34" cy="48" r="7" stroke="#1c1917" strokeWidth="2"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(0.8, 0.3)} />
                  {/* String */}
                  <path d="M 28 43 C 20 35 12 25 6 14" stroke="#a8a29e" strokeWidth="1.5" strokeLinecap="round"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(1.0, 0.4)} />
                  {/* Coin outer */}
                  <circle cx="72" cy="48" r="22" stroke="#f59e0b" strokeWidth="2.5"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(1.2, 0.5)} />
                  {/* Coin inner ring */}
                  <circle cx="72" cy="48" r="17" stroke="#fcd34d" strokeWidth="1"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(1.45, 0.4)} />
                  {/* Dollar vertical */}
                  <line x1="72" y1="36" x2="72" y2="60" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(1.65, 0.3)} />
                  {/* Dollar S-curve */}
                  <path d="M 65 42 C 65 35 79 35 79 42 C 79 48 65 48 65 54 C 65 60 79 60 79 54"
                    stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" fill="none"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(1.85, 0.55)} />
                </g>
                {/* Gold sparkles — twinkle continuously */}
                <line x1="110" y1="8" x2="116" y2="2" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(2.1, 0.2, 1.8, 2.4)} />
                <line x1="118" y1="17" x2="121" y2="11" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(2.2, 0.2, 1.8, 2.7)} />
                <line x1="108" y1="19" x2="108" y2="13" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(2.3, 0.2, 1.8, 3.0)} />
                {/* Green sparkles */}
                <line x1="5" y1="76" x2="1" y2="82" stroke="#10b981" strokeWidth="2" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(2.4, 0.2, 2.1, 2.8)} />
                <line x1="2" y1="70" x2="8" y2="68" stroke="#10b981" strokeWidth="2" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(2.5, 0.2, 2.1, 3.2)} />
                <line x1="11" y1="82" x2="11" y2="88" stroke="#10b981" strokeWidth="2" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(2.6, 0.2, 2.1, 3.6)} />
              </svg>,

              /* ── Step 2: Receive Questions — Envelope + speech bubble ── */
              <svg key="s2" viewBox="0 0 122 96" width="122" height="96" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Envelope group — floats */}
                <g style={v ? { animation: 'lp-float 4s ease-in-out infinite 2.5s', transformBox: 'fill-box', transformOrigin: 'center' } : {}}>
                  <rect x="2" y="40" width="68" height="50" rx="5" stroke="#1c1917" strokeWidth="2.5"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(0.1, 0.5)} />
                  {/* Flap V */}
                  <path d="M 2 40 L 36 66 L 70 40" stroke="#1c1917" strokeWidth="2" strokeLinejoin="round" fill="none"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(0.45, 0.5)} />
                  {/* Corner seams */}
                  <line x1="2" y1="72" x2="27" y2="90" stroke="#d6d3d1" strokeWidth="1.5" strokeLinecap="round"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(0.75, 0.3)} />
                  <line x1="70" y1="72" x2="45" y2="90" stroke="#d6d3d1" strokeWidth="1.5" strokeLinecap="round"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(0.85, 0.3)} />
                  {/* Text lines inside */}
                  <line x1="12" y1="72" x2="52" y2="72" stroke="#a8a29e" strokeWidth="1.5" strokeLinecap="round"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(0.95, 0.3)} />
                  <line x1="12" y1="80" x2="42" y2="80" stroke="#d6d3d1" strokeWidth="1.5" strokeLinecap="round"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(1.05, 0.3)} />
                  <line x1="12" y1="88" x2="34" y2="88" stroke="#d6d3d1" strokeWidth="1.5" strokeLinecap="round"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(1.15, 0.3)} />
                </g>
                {/* Speech bubble group — bounces independently */}
                <g style={v ? { animation: 'lp-bounce 2.5s ease-in-out infinite 2.6s', transformBox: 'fill-box', transformOrigin: 'center' } : {}}>
                  {/* Bubble with tail */}
                  <path d="M 78 4 L 116 4 Q 121 4 121 9 L 121 46 Q 121 51 116 51 L 90 51 L 82 60 L 84 51 L 78 51 Q 73 51 73 46 L 73 9 Q 73 4 78 4 Z"
                    stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" fill="white"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(1.2, 0.6)} />
                  {/* ? arc */}
                  <path d="M 90 25 C 90 15 108 15 108 25 C 108 31 97 32 97 39"
                    stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" fill="none"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(1.65, 0.5)} />
                  {/* ? dot */}
                  <line x1="97" y1="45" x2="97" y2="46" stroke="#6366f1" strokeWidth="5" strokeLinecap="round"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(2.0, 0.1)} />
                </g>
                {/* Sparkles between envelope and bubble */}
                <line x1="57" y1="27" x2="63" y2="21" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(2.2, 0.2, 1.9, 2.5)} />
                <line x1="65" y1="34" x2="71" y2="32" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(2.3, 0.2, 1.9, 2.8)} />
                <line x1="55" y1="36" x2="55" y2="30" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(2.4, 0.2, 1.9, 3.2)} />
                <line x1="4" y1="24" x2="0" y2="30" stroke="#10b981" strokeWidth="2" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(2.5, 0.2, 2.2, 2.9)} />
                <line x1="0" y1="18" x2="6" y2="16" stroke="#10b981" strokeWidth="2" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(2.6, 0.2, 2.2, 3.3)} />
              </svg>,

              /* ── Step 3: Reply & Earn — Money bag + rising coins ── */
              <svg key="s3" viewBox="0 0 122 96" width="122" height="96" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Bag group — floats */}
                <g style={v ? { animation: 'lp-float 3.8s ease-in-out infinite 2.6s', transformBox: 'fill-box', transformOrigin: '52px 62px' } : {}}>
                  {/* Bag body */}
                  <ellipse cx="52" cy="63" rx="30" ry="26" stroke="#1c1917" strokeWidth="2.5"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(0.1, 0.7)} />
                  {/* Neck */}
                  <rect x="40" y="28" width="24" height="16" rx="4" stroke="#1c1917" strokeWidth="2"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(0.65, 0.4)} />
                  {/* Left bow petal */}
                  <path d="M 46 26 C 44 16 30 12 32 20 C 34 26 44 28 46 26 Z"
                    stroke="#1c1917" strokeWidth="2" fill="white" strokeLinejoin="round"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(0.9, 0.4)} />
                  {/* Right bow petal */}
                  <path d="M 58 26 C 60 16 74 12 72 20 C 70 26 60 28 58 26 Z"
                    stroke="#1c1917" strokeWidth="2" fill="white" strokeLinejoin="round"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(1.0, 0.4)} />
                  {/* Bow center knot */}
                  <circle cx="52" cy="26" r="5" stroke="#1c1917" strokeWidth="2" fill="white"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(1.1, 0.3)} />
                  {/* Dollar vertical */}
                  <line x1="52" y1="51" x2="52" y2="75" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(1.3, 0.3)} />
                  {/* Dollar S */}
                  <path d="M 45 56 C 45 50 59 50 59 56 C 59 62 45 62 45 68 C 45 74 59 74 59 68"
                    stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" fill="none"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={S(1.5, 0.55)} />
                </g>
                {/* Rising coins — continuously float up, no sketch draw */}
                <circle cx="90" cy="56" r="10" stroke="#f59e0b" strokeWidth="2"
                  style={v ? { animation: 'lp-coin-rise 2.5s ease-in-out infinite 2.1s', opacity: 0 } : { opacity: 0 }} />
                <line x1="90" y1="50" x2="90" y2="62" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"
                  style={v ? { animation: 'lp-coin-rise 2.5s ease-in-out infinite 2.1s', opacity: 0 } : { opacity: 0 }} />
                <circle cx="98" cy="68" r="8" stroke="#fbbf24" strokeWidth="2"
                  style={v ? { animation: 'lp-coin-rise 2.5s ease-in-out infinite 2.95s', opacity: 0 } : { opacity: 0 }} />
                <line x1="98" y1="63" x2="98" y2="73" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"
                  style={v ? { animation: 'lp-coin-rise 2.5s ease-in-out infinite 2.95s', opacity: 0 } : { opacity: 0 }} />
                <circle cx="86" cy="74" r="9" stroke="#fcd34d" strokeWidth="2"
                  style={v ? { animation: 'lp-coin-rise 2.5s ease-in-out infinite 3.8s', opacity: 0 } : { opacity: 0 }} />
                <line x1="86" y1="69" x2="86" y2="79" stroke="#fcd34d" strokeWidth="1.5" strokeLinecap="round"
                  style={v ? { animation: 'lp-coin-rise 2.5s ease-in-out infinite 3.8s', opacity: 0 } : { opacity: 0 }} />
                {/* Sparkles — green top-left, gold bottom-right */}
                <line x1="10" y1="18" x2="4" y2="12" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(1.85, 0.2, 1.7, 2.2)} />
                <line x1="4" y1="24" x2="0" y2="22" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(1.95, 0.2, 1.7, 2.5)} />
                <line x1="12" y1="26" x2="12" y2="20" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(2.05, 0.2, 1.7, 2.8)} />
                <line x1="112" y1="82" x2="118" y2="88" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(2.15, 0.2, 2.0, 2.6)} />
                <line x1="118" y1="76" x2="121" y2="79" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(2.25, 0.2, 2.0, 3.0)} />
                <line x1="110" y1="78" x2="110" y2="84" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1} style={ST(2.35, 0.2, 2.0, 3.4)} />
              </svg>,
            ];

            const steps = [
              { step: t('landing.step01'), title: t('landing.setYourRate'), desc: t('landing.setYourRateDesc'), icon: Coins },
              { step: t('landing.step02'), title: t('landing.receiveQuestions'), desc: t('landing.receiveQuestionsDesc'), icon: MessageSquare },
              { step: t('landing.step03'), title: t('landing.replyAndEarn'), desc: t('landing.replyAndEarnDesc'), icon: Check },
            ];
            return (
              <>
                <div className="md:hidden overflow-hidden">
                  <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${stepsIdx * 100}%)` }}
                  >
                    {steps.map((item, idx) => (
                      <div key={idx} className="w-full flex-shrink-0">
                        <div className="relative bg-white rounded-3xl p-8 border border-stone-100">
                          <div className="text-sm font-semibold text-stone-300 mb-4">{item.step}</div>
                          <div className="mb-4">{sketchIllustrations[idx]}</div>
                          <h3 className="text-xl font-semibold text-stone-900 mb-3">{item.title}</h3>
                          <p className="text-stone-500 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Dots */}
                  <div className="flex justify-center gap-2 mt-6">
                    {steps.map((_, i) => (
                      <button key={i} onClick={() => setStepsIdx(i)} className={`h-2 rounded-full transition-all duration-300 ${stepsIdx === i ? 'bg-stone-900 w-5' : 'bg-stone-300 w-2'}`} />
                    ))}
                  </div>
                </div>

                {/* Desktop Grid */}
                <div className="hidden md:grid md:grid-cols-3 gap-8 lg:gap-12">
                  {steps.map((item, idx) => (
                    <div
                      key={idx}
                      className="relative group"
                      onMouseEnter={() => setHoveredFeature(idx)}
                      onMouseLeave={() => setHoveredFeature(null)}
                    >
                      {idx < 2 && (
                        <div className="absolute top-8 left-[60%] w-[80%] h-px bg-stone-200"></div>
                      )}
                      <div className="relative bg-white rounded-3xl p-8 border border-stone-100 transition-all duration-300 hover:shadow-lg hover:shadow-stone-100 hover:border-stone-200">
                        <div className="text-sm font-semibold text-stone-300 mb-4">{item.step}</div>
                        <div className="mb-4">{sketchIllustrations[idx]}</div>
                        <h3 className="text-xl font-semibold text-stone-900 mb-3">{item.title}</h3>
                        <p className="text-stone-500 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </section>

      {/* Trust & Safety - Premium Feel */}
      <section className="bg-white py-24 border-t border-stone-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Visual */}
            <div className="relative">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-[2.5rem] p-8 lg:p-12">
                {/* Escrow Visualization */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-stone-500">{t('landing.paymentStatus')}</span>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">{t('landing.heldInEscrow')}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                      <Lock size={20} className="text-amber-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-semibold text-stone-900">{t('landing.fiveHundredCredits')}</div>
                      <div className="text-sm text-stone-500">{t('landing.protectedUntilResponse')}</div>
                    </div>
                  </div>
                </div>

                {/* Timer */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Clock size={20} className="text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-stone-500 mb-1">{t('landing.responseGuarantee')}</div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full w-3/4 bg-emerald-500 rounded-full"></div>
                        </div>
                        <span className="text-sm font-medium text-stone-700">{t('landing.timeLeft')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Text */}
            <div className="space-y-8">
              <div>
                <p className="text-sm font-medium text-amber-600 uppercase tracking-wider mb-4">{t('landing.builtOnTrust')}</p>
                <h2 className="text-3xl sm:text-4xl font-semibold text-stone-900 tracking-tight leading-tight">
                  {t('landing.guaranteedResponse')}
                  <br />
                  {t('landing.orMoneyBack')}
                </h2>
              </div>

              <p className="text-lg text-stone-500 leading-relaxed">
                {t('landing.escrowDesc')}
              </p>

              <div className="space-y-4">
                {[
                  t('landing.paymentsProtected'),
                  t('landing.automaticRefunds'),
                  t('landing.creatorsSetWindows'),
                  t('landing.fullTransparency')
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <Check size={14} className="text-emerald-600" />
                    </div>
                    <span className="text-stone-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Digital Products - Soft Promotion */}
      <section className="py-24 bg-white border-t border-stone-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Text */}
            <div className="space-y-8">
              <div>
                <p className="text-sm font-medium text-violet-600 uppercase tracking-wider mb-4">{t('landing.beyondMessages')}</p>
                <h2 className="text-3xl sm:text-4xl font-semibold text-stone-900 tracking-tight leading-tight">
                  {t('landing.sellExpertise')}
                  <br />
                  {t('landing.notJustTime')}
                </h2>
              </div>

              <p className="text-lg text-stone-500 leading-relaxed">
                {t('landing.digitalStorefront')}
              </p>

              <div className="flex flex-wrap gap-3">
                {[t('landing.pdfGuides'), t('landing.videoCourses'), t('landing.templates'), t('landing.exclusiveContent')].map((tag, idx) => (
                  <span key={idx} className="bg-violet-50 text-violet-700 px-4 py-2 rounded-full text-sm font-medium border border-violet-100">
                    {tag}
                  </span>
                ))}
              </div>

              <button
                onClick={onLoginClick}
                className="bg-stone-900 text-white px-6 py-3 rounded-full font-medium hover:bg-stone-800 transition-all inline-flex items-center gap-2 group"
              >
                {t('landing.startSelling')}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Right: Visual — exact public profile card layout */}
            <div className="relative">
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-[2.5rem] p-8">
                <div className="grid gap-3">
                  {/* Digital Product card */}
                  <div className="w-full text-left p-3 sm:p-4 rounded-2xl border flex items-center gap-3 sm:gap-4 group cursor-pointer transition-all hover:shadow-md relative overflow-hidden bg-gradient-to-r from-purple-50/40 to-violet-50/20 border-purple-100 shadow-sm">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform bg-purple-50 text-purple-400">
                      <FileText size={20} className="sm:hidden" />
                      <FileText size={24} className="hidden sm:block" />
                    </div>
                    <div className="flex-1 relative z-10 min-w-0 text-left">
                      <h4 className="font-semibold sm:font-bold text-stone-900 text-sm sm:text-base group-hover:text-stone-700 transition-colors truncate">30-Day Fitness Plan</h4>
                      <p className="text-[10px] sm:text-xs text-stone-400 mt-0.5 font-medium truncate">Digital Download</p>
                    </div>
                    <div className="px-3 sm:px-5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap bg-purple-400 text-white hover:bg-purple-500">
                      Buy
                    </div>
                  </div>

                  {/* Support / Tip card */}
                  <div className="w-full text-left p-3 sm:p-4 rounded-2xl border flex items-center gap-3 sm:gap-4 group cursor-pointer transition-all hover:shadow-md relative overflow-hidden bg-gradient-to-r from-pink-50/40 to-rose-50/20 border-pink-100 shadow-sm">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform bg-pink-50 text-pink-400">
                      <Heart size={20} className="sm:hidden" />
                      <Heart size={24} className="hidden sm:block" />
                    </div>
                    <div className="flex-1 relative z-10 min-w-0 text-left">
                      <h4 className="font-semibold sm:font-bold text-stone-900 text-sm sm:text-base group-hover:text-stone-700 transition-colors truncate">Support My Work</h4>
                      <p className="text-[10px] sm:text-xs text-stone-400 mt-0.5 font-medium truncate">Send a tip</p>
                    </div>
                    <div className="px-3 sm:px-5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap bg-pink-300 text-white hover:bg-pink-400">
                      <Heart size={12} /> Tip
                    </div>
                  </div>

                  {/* External link card */}
                  <div className="w-full text-left p-3 sm:p-4 rounded-2xl border flex items-center gap-3 sm:gap-4 group cursor-pointer transition-all hover:shadow-md relative overflow-hidden bg-gradient-to-r from-stone-50 to-stone-100/40 border-stone-200 shadow-sm">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform bg-stone-900 text-white">
                      <Sparkles size={20} className="sm:hidden" />
                      <Sparkles size={24} className="hidden sm:block" />
                    </div>
                    <div className="flex-1 relative z-10 min-w-0 text-left">
                      <h4 className="font-semibold sm:font-bold text-stone-900 text-sm sm:text-base group-hover:text-stone-700 transition-colors truncate">My YouTube Channel</h4>
                      <p className="text-[10px] sm:text-xs text-stone-400 mt-0.5 font-medium truncate">Recommended</p>
                    </div>
                    <div className="px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap bg-stone-900 text-white hover:bg-stone-800">
                      Visit <ExternalLink size={12} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA - Warm & Inviting */}
      <section className="py-24 bg-gradient-to-b from-amber-50 to-orange-50">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold text-stone-900 tracking-tight mb-6">
            {t('landing.readyToCreate')}
          </h2>
          <p className="text-lg text-stone-500 leading-relaxed mb-10 max-w-xl mx-auto">
            {t('landing.joinThousands')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onLoginClick}
              className="w-full sm:w-auto bg-stone-900 text-white px-10 py-4 rounded-full font-medium text-lg hover:bg-stone-800 transition-all flex items-center justify-center gap-2 group"
            >
              {t('landing.getStartedFree')}
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <p className="text-sm text-stone-400 mt-6">
            {t('landing.noCreditCard')}
          </p>
        </div>
      </section>

      {/* Footer - Minimal & Clean */}
      <footer className="bg-white border-t border-stone-100 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <DiemLogo size={16} className="text-stone-800" />
            </div>

            <div className="flex items-center gap-8 text-sm text-stone-500">
              <a href="#" className="hover:text-stone-900 transition-colors">{t('landing.privacy')}</a>
              <a href="/terms" className="hover:text-stone-900 transition-colors">{t('landing.terms')}</a>
              <a href="#" className="hover:text-stone-900 transition-colors">{t('landing.twitter')}</a>
              <a href="#" className="hover:text-stone-900 transition-colors">{t('landing.contact')}</a>
            </div>

            <p className="text-sm text-stone-400">{t('landing.copyright')}</p>
          </div>
        </div>
      </footer>

      {/* Expanded Conversation Modal */}
      {expandedConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setExpandedConversation(null)}>
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-white z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-stone-200">
                            <img src={expandedConversation.creator.avatar} className="w-full h-full object-cover" alt="" />
                        </div>
                        <div>
                            <h3 className="font-bold text-stone-900 text-sm">{expandedConversation.creator.name}</h3>
                            <p className="text-xs text-stone-500">{expandedConversation.creator.role}</p>
                        </div>
                    </div>
                    <button onClick={() => setExpandedConversation(null)} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-white">
                    {expandedConversation.fullThread.map((msg: any, idx: number) => {
                        const isLast = idx === expandedConversation.fullThread.length - 1;
                        const isFan = msg.role === 'FAN';

                        return (
                            <div key={idx} className="flex relative z-10 pb-6 last:pb-0">
                                {/* Left: Avatar + Thread Line */}
                                <div className="flex flex-col items-center mr-4 relative">
                                    {!isLast && (
                                        <div className="absolute left-[17px] top-10 -bottom-6 w-0.5 bg-stone-200"></div>
                                    )}
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border border-stone-200 flex-shrink-0 ${isFan ? 'bg-stone-100 text-stone-400' : 'overflow-hidden'}`}>
                                        {isFan ? (
                                            <User size={16} />
                                        ) : (
                                            <img src={expandedConversation.creator.avatar} className="w-full h-full object-cover" alt="" />
                                        )}
                                    </div>
                                </div>

                                {/* Right: Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="font-semibold text-sm text-stone-900">{isFan ? t('landing.anonymousFan') : expandedConversation.creator.name}</span>
                                        {isFan ? (
                                            <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                                <User size={10} className="fill-current" />
                                                <span className="text-[9px] font-semibold uppercase tracking-wide">{t('common.fan')}</span>
                                            </div>
                                        ) : (
                                        <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-1 rounded-full flex-shrink-0 overflow-visible">
                                            <Verified size={12} />
                                            <span className="text-[9px] font-semibold uppercase tracking-wide">{t('common.creator')}</span>
                                        </div>
                                        )}
                                        <span className="text-xs font-medium text-stone-400">• {msg.time}</span>
                                    </div>

                                    <div className={`p-4 rounded-2xl border ${isFan ? 'bg-white border-stone-200 rounded-tl-lg shadow-sm' : 'bg-stone-50 border-stone-200/60 rounded-tl-lg'}`}>
                                        {msg.content && <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{msg.content}</p>}

                                        {msg.image && (
                                            <div className={`${msg.content ? 'mt-3' : ''} rounded-xl overflow-hidden border border-stone-200`}>
                                                <img src={msg.image} alt="outfit" className="w-full max-h-72 object-cover object-top" />
                                            </div>
                                        )}

                                        {msg.attachment && (
                                            <div className="mt-3 flex items-center gap-3 p-3 bg-white rounded-xl border border-stone-200 hover:border-stone-300 transition-colors cursor-pointer group">
                                                <div className="w-10 h-10 bg-stone-50 rounded-lg flex items-center justify-center border border-stone-100 text-red-500">
                                                    <FileText size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-stone-900 truncate group-hover:text-stone-700 transition-colors">{msg.attachment.name}</p>
                                                    <p className="text-[10px] text-stone-500 uppercase">{msg.attachment.type} {t('landing.document')}</p>
                                                </div>
                                                <button className="p-2 text-stone-400 hover:text-stone-600">
                                                    <Download size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
