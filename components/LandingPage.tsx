
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
  const [howItWorksVisible, setHowItWorksVisible] = useState(false);
  const howItWorksRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const t = setInterval(() => setConvIdx(i => (i + 1) % FEATURED_CONVERSATIONS.length), 3500);
    return () => clearInterval(t);
  }, [FEATURED_CONVERSATIONS.length]);

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
                <button
                  key={i}
                  onClick={() => setConvIdx(i)}
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ width: convIdx === i ? '20px' : '8px', background: convIdx === i ? '#1c1917' : '#d6d3d1' }}
                />
              ))}
            </div>
          </div>

          {/* Creator Cards - Desktop Grid */}
          <div className="hidden md:grid md:grid-cols-3 gap-6 lg:gap-8">
            {FEATURED_CONVERSATIONS.map((item, i) => (
              <div
                key={item.id}
                className="group bg-white rounded-3xl p-6 border border-stone-200 flex flex-col cursor-pointer"
                style={{
                  transition: 'opacity 0.5s ease, transform 0.5s ease, box-shadow 0.5s ease',
                  opacity: convIdx === i ? 1 : 0.45,
                  transform: convIdx === i ? 'translateY(-6px) scale(1.02)' : 'scale(0.97)',
                  boxShadow: convIdx === i ? '0 20px 40px -12px rgba(28,25,23,0.12)' : 'none',
                }}
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

      {/* How It Works */}
      <section ref={howItWorksRef} className="py-28 bg-gradient-to-b from-stone-50 to-[#FAFAF9]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-[0.18em] mb-4">{t('landing.simpleTransparent')}</p>
            <h2 className="text-3xl sm:text-5xl font-semibold text-stone-900 tracking-tight mb-4">
              {t('landing.howItWorks')}
            </h2>
            <svg viewBox="0 0 200 12" width="200" height="12" className="mx-auto" fill="none">
              <path d="M 10 8 C 50 4 100 10 160 6 C 175 5 185 7 192 8"
                stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" fill="none"
                pathLength={1} strokeDasharray="1" strokeDashoffset={1}
                style={howItWorksVisible ? { animation: 'lp-sketch 0.8s ease forwards 0.3s' } : {}} />
            </svg>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">

            {/* Step 1: Find your creator */}
            <div
              className="bg-amber-50 rounded-3xl border border-amber-100 p-8 flex flex-col"
              style={{
                opacity: howItWorksVisible ? 1 : 0,
                transform: howItWorksVisible ? 'translateY(0)' : 'translateY(24px)',
                transition: 'opacity 0.6s ease 0.15s, transform 0.6s ease 0.15s',
                boxShadow: '0 8px 32px -8px rgba(245,158,11,0.10)',
              }}
            >
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-xs font-black tracking-widest mb-6 self-start bg-amber-100 text-amber-700">
                {t('landing.step01')}
              </span>
              <div className="flex-1 flex items-center justify-center py-2">
                <div className="w-full max-w-[200px] bg-white rounded-2xl border border-amber-100 p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <User size={15} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-stone-800">Alex Chen</div>
                      <div className="text-[10px] text-stone-400">@alexcode</div>
                    </div>
                    <Verified size={12} className="text-amber-400 flex-shrink-0" />
                  </div>
                  <div className="bg-amber-50 rounded-lg px-2.5 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Coins size={11} className="text-amber-600" />
                      <span className="text-[11px] font-semibold text-amber-800">500 credits</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={10} className="text-stone-400" />
                      <span className="text-[10px] text-stone-500">48h reply</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-0.5">
                    <div className="h-1.5 bg-stone-100 rounded-full w-full" />
                    <div className="h-1.5 bg-stone-100 rounded-full w-4/5" />
                    <div className="h-1.5 bg-stone-100 rounded-full w-2/3" />
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-amber-100/60">
                <h3 className="text-xl font-bold text-stone-900 mb-2 tracking-tight">{t('landing.setYourRate')}</h3>
                <p className="text-stone-500 leading-relaxed text-sm">{t('landing.setYourRateDesc')}</p>
              </div>
            </div>

            {/* Step 2: Send a Diem */}
            <div
              className="bg-indigo-50 rounded-3xl border border-indigo-100 p-8 flex flex-col"
              style={{
                opacity: howItWorksVisible ? 1 : 0,
                transform: howItWorksVisible ? 'translateY(0)' : 'translateY(24px)',
                transition: 'opacity 0.6s ease 0.30s, transform 0.6s ease 0.30s',
                boxShadow: '0 8px 32px -8px rgba(99,102,241,0.10)',
              }}
            >
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-xs font-black tracking-widest mb-6 self-start bg-indigo-100 text-indigo-700">
                {t('landing.step02')}
              </span>
              <div className="flex-1 flex items-center justify-center py-2">
                <div className="w-full max-w-[200px] bg-white rounded-2xl border border-indigo-100 p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-stone-100">
                    <span className="text-[10px] text-stone-400 font-medium">To:</span>
                    <div className="flex items-center gap-1.5 bg-indigo-50 rounded-md px-2 py-1">
                      <div className="w-4 h-4 rounded-full bg-indigo-200 flex items-center justify-center">
                        <User size={9} className="text-indigo-700" />
                      </div>
                      <span className="text-[10px] font-semibold text-indigo-700">Alex Chen</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-1.5 bg-stone-100 rounded-full w-full" />
                    <div className="h-1.5 bg-stone-100 rounded-full w-11/12" />
                    <div className="h-1.5 bg-stone-100 rounded-full w-3/4" />
                    <div className="h-1.5 bg-stone-100 rounded-full w-1/2" />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      <Lock size={10} className="text-indigo-400" />
                      <span className="text-[10px] text-indigo-600 font-medium">500 credits</span>
                    </div>
                    <div className="bg-indigo-600 rounded-lg px-2.5 py-1.5 flex items-center gap-1">
                      <span className="text-[10px] text-white font-bold">Send</span>
                      <ArrowRight size={9} className="text-white" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-indigo-100/60">
                <h3 className="text-xl font-bold text-stone-900 mb-2 tracking-tight">{t('landing.receiveQuestions')}</h3>
                <p className="text-stone-500 leading-relaxed text-sm">{t('landing.receiveQuestionsDesc')}</p>
              </div>
            </div>

            {/* Step 3: A real reply */}
            <div
              className="bg-emerald-50 rounded-3xl border border-emerald-100 p-8 flex flex-col"
              style={{
                opacity: howItWorksVisible ? 1 : 0,
                transform: howItWorksVisible ? 'translateY(0)' : 'translateY(24px)',
                transition: 'opacity 0.6s ease 0.45s, transform 0.6s ease 0.45s',
                boxShadow: '0 8px 32px -8px rgba(16,185,129,0.10)',
              }}
            >
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-xs font-black tracking-widest mb-6 self-start bg-emerald-100 text-emerald-700">
                {t('landing.step03')}
              </span>
              <div className="flex-1 flex items-center justify-center py-2">
                <div className="w-full max-w-[200px] bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <User size={12} className="text-emerald-600" />
                    </div>
                    <span className="text-[10px] font-bold text-stone-700">Alex replied</span>
                    <div className="ml-auto flex items-center gap-0.5 bg-emerald-50 rounded-md px-1.5 py-0.5">
                      <Check size={9} className="text-emerald-500" />
                      <span className="text-[9px] text-emerald-600 font-semibold">6h</span>
                    </div>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 space-y-1.5">
                    <div className="h-1.5 bg-emerald-200 rounded-full w-full" />
                    <div className="h-1.5 bg-emerald-200 rounded-full w-10/12" />
                    <div className="h-1.5 bg-emerald-200 rounded-full w-7/12" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Coins size={10} className="text-stone-300" />
                    <span className="text-[10px] text-stone-400">Credits released to creator</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-emerald-100/60">
                <h3 className="text-xl font-bold text-stone-900 mb-2 tracking-tight">{t('landing.replyAndEarn')}</h3>
                <p className="text-stone-500 leading-relaxed text-sm">{t('landing.replyAndEarnDesc')}</p>
              </div>
            </div>

          </div>
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
                      <h4 className="font-semibold sm:font-bold text-stone-900 text-sm sm:text-base truncate">30-Day Fitness Plan</h4>
                      <p className="text-[10px] sm:text-xs text-stone-400 mt-0.5 font-medium truncate">Digital Download</p>
                    </div>
                    <div className="px-3 sm:px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap bg-purple-400 text-white">
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
                      <h4 className="font-semibold sm:font-bold text-stone-900 text-sm sm:text-base truncate">Support My Work</h4>
                      <p className="text-[10px] sm:text-xs text-stone-400 mt-0.5 font-medium truncate">Send a tip</p>
                    </div>
                    <div className="px-3 sm:px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap bg-pink-300 text-white">
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
