
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { BlueCheckLogo, CheckCircle2, ShieldCheck, MessageSquare, ArrowRight, DollarSign, Clock, Sparkles, User, Heart, Lock, Check, ShoppingBag, FileText, ExternalLink, Download, Play, Image as ImageIcon, TrendingUp, BarChart3, Coins, Wallet } from './Icons';

interface Props {
  onLoginClick: () => void;
  onDemoClick: () => void;
}

const THEMES = [
  {
    id: 'creator',
    gradient: 'from-indigo-200 via-purple-200 to-blue-200',
    headlineStart: 'The payments layer for',
    headlineHighlight: 'creator attention.',
    headlineGradient: 'from-indigo-600 to-violet-600',
    subText: 'Bluechecked handles the messaging, payments, and deadlines so you can monetize your inbox without the administrative burden.',
    accent: 'indigo',
    secondaryAccent: 'purple'
  },
  {
    id: 'trust',
    gradient: 'from-emerald-200 via-teal-200 to-cyan-200',
    headlineStart: 'The trust layer for',
    headlineHighlight: 'digital consulting.',
    headlineGradient: 'from-emerald-600 to-teal-600',
    subText: 'Guaranteed replies or automatic refunds. We build the infrastructure of trust so fans and experts can connect with confidence.',
    accent: 'teal',
    secondaryAccent: 'cyan'
  },
  {
    id: 'growth',
    gradient: 'from-blue-200 via-sky-200 to-indigo-200',
    headlineStart: 'The growth engine for',
    headlineHighlight: 'your expertise.',
    headlineGradient: 'from-blue-600 to-indigo-600',
    subText: 'Stop giving away value for free. Turn your DMs into a streamlined, profitable channel that respects your time.',
    accent: 'blue',
    secondaryAccent: 'indigo'
  }
];

const DEMO_MESSAGES = [
  {
    id: 'msg-creator',
    avatarColor: 'bg-purple-100 text-purple-600',
    initial: 'S',
    name: 'Sarah (Creator)',
    time: '2m ago',
    amount: 500, // Credits
    question: "Views are down 40% since the algo update. Should I pivot to Shorts only?",
    reply: "Don't chase the algorithm. Chase connection. Shorts are for reach, long-form is for loyalty. Expand, don't switch. 📈"
  },
  {
    id: 'msg-trust',
    avatarColor: 'bg-emerald-100 text-emerald-600',
    initial: 'L',
    name: 'Relationship Coach',
    time: 'Just now',
    amount: 1000, // Credits
    question: "He liked my story but left me on read yesterday. Double text?",
    reply: "Silence is an answer. Invest in those who invest in you. You are the prize, act like it. ✨"
  },
  {
    id: 'msg-growth',
    avatarColor: 'bg-blue-100 text-blue-600',
    initial: 'M',
    name: 'Career Coach',
    time: '5m ago',
    amount: 1500, // Credits
    question: "Big Tech offer ($180k) vs Series B Startup ($150k + Equity)?",
    reply: "Optimize for learning, not earnings in your 20s. The startup equity is a lottery ticket, but the skills are guaranteed wealth. 🚀"
  }
];

// Dynamic Chart Data Configuration
type TimePeriod = '1D' | '1W' | '1M' | '1Y';

const CHART_CONFIG: Record<TimePeriod, { 
    data: { label: string; amount: number }[]; 
    total: string; 
    growth: string;
    maxVal: number;
}> = {
  '1D': {
    data: [
        { label: '0-4am', amount: 350 }, 
        { label: '4-8am', amount: 850 }, 
        { label: '8-12pm', amount: 2600 },
        { label: '12-4pm', amount: 3200 }, 
        { label: '4-8pm', amount: 2900 }, 
        { label: '8-12am', amount: 1500 }
    ],
    total: '11,400 Credits',
    growth: '+8.2%',
    maxVal: 3500
  },
  '1W': {
    data: [
      { label: 'Mon', amount: 1450 }, { label: 'Tue', amount: 2800 }, { label: 'Wed', amount: 1900 },
      { label: 'Thu', amount: 3200 }, { label: 'Fri', amount: 2400 }, { label: 'Sat', amount: 1800 }, { label: 'Sun', amount: 3500 }
    ],
    total: '16,800 Credits',
    growth: '+12.5%',
    maxVal: 4000
  },
  '1M': {
    data: [
        { label: 'W1', amount: 12000 }, { label: 'W2', amount: 18500 }, { label: 'W3', amount: 16000 }, { label: 'W4', amount: 21000 },
        { label: 'W5', amount: 19000 }
    ],
    total: '86,500 Credits',
    growth: '+24.0%',
    maxVal: 25000
  },
  '1Y': {
    data: [
        { label: 'Jan', amount: 120000 }, { label: 'Mar', amount: 152000 }, { label: 'Jun', amount: 185000 }, { label: 'Sep', amount: 220000 }, { label: 'Dec', amount: 280000 }
    ],
    total: '957,000 Credits',
    growth: '+145%',
    maxVal: 300000
  }
};

const ConnectionArcs = () => {
  const [arcs, setArcs] = useState<any[]>([]);

  useEffect(() => {
    const newArcs = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      startX: Math.random() * 100,
      startY: Math.random() * 100,
      endX: Math.random() * 100,
      endY: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 2
    }));
    setArcs(newArcs);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      <svg className="w-full h-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="arc-gradient" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(99, 102, 241, 0)" />
            <stop offset="50%" stopColor="rgba(99, 102, 241, 0.8)" />
            <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
          </linearGradient>
        </defs>
        {arcs.map(arc => {
           const midX = (arc.startX + arc.endX) / 2;
           const midY = Math.min(arc.startY, arc.endY) - 20;
           return (
             <path
               key={arc.id}
               d={`M${arc.startX.toFixed(1)} ${arc.startY.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${arc.endX.toFixed(1)} ${arc.endY.toFixed(1)}`}
               fill="none"
               stroke="url(#arc-gradient)"
               strokeWidth="2"
               vectorEffect="non-scaling-stroke"
               className="animate-draw-line"
               style={{
                 animationDelay: `${arc.delay}s`,
                 animationDuration: `${arc.duration}s`
               }}
             />
           )
        })}
      </svg>
    </div>
  );
};

export const LandingPage: React.FC<Props> = ({ onLoginClick, onDemoClick }) => {
  const [activeThemeIndex, setActiveThemeIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activePeriod, setActivePeriod] = useState<TimePeriod>('1W');

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveThemeIndex((prev) => (prev + 1) % THEMES.length);
        setIsTransitioning(false);
      }, 500); // Faster transition duration (500ms fade out)
    }, 8000); // 8s cycle

    return () => clearInterval(interval);
  }, [activeThemeIndex]); 

  const theme = THEMES[activeThemeIndex];
  const activeMessage = DEMO_MESSAGES[activeThemeIndex];
  
  // Get current chart data
  const currentChart = CHART_CONFIG[activePeriod];

  return (
    <div className="min-h-screen font-sans selection:bg-indigo-100 selection:text-indigo-900 bg-white text-slate-900 overflow-x-hidden">
        <style>{`
          @keyframes fillBar {
            from { transform: scaleX(0); }
            to { transform: scaleX(1); }
          }
          @keyframes growUp {
            from { height: 0%; }
            to { height: 100%; }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeOutDown {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-12px); }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }
           @keyframes shimmer-slow {
            0% { transform: translateX(-100%); opacity: 0; }
            50% { opacity: 0.5; }
            100% { transform: translateX(100%); opacity: 0; }
          }
           @keyframes float-delayed {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          @keyframes drawLine {
            0% { stroke-dasharray: 0, 1000; stroke-dashoffset: 0; opacity: 0; }
            10% { opacity: 1; }
            100% { stroke-dasharray: 1000, 1000; stroke-dashoffset: -1000; opacity: 0; }
          }
          .animate-fill-bar {
            animation: fillBar 8000ms linear forwards;
          }
          .animate-grow-up {
            animation: growUp 1s ease-out forwards;
          }
          .animate-fade-in-up {
            animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .animate-float {
            animation: float 6s ease-in-out infinite;
          }
          .animate-float-delayed {
            animation: float-delayed 5s ease-in-out infinite;
          }
           .animate-shimmer-slow {
            animation: shimmer-slow 3s infinite linear;
          }
          .animate-draw-line {
            animation: drawLine 4s ease-in-out infinite;
          }
          .transition-smooth {
             transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          }
        `}</style>

        {/* Global Noise Texture */}
        <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none z-50 mix-blend-darken"></div>
        
        <ConnectionArcs />

        {/* Navigation */}
        <nav className="relative z-50 max-w-7xl mx-auto px-6 py-6 flex items-center justify-between transition-colors duration-1000">
            <div className="flex items-center gap-2 font-bold text-xl tracking-tight cursor-pointer select-none" onClick={() => window.location.reload()}>
                <BlueCheckLogo size={32} className="text-slate-900" />
                <div className="flex flex-col leading-none">
                    <span className="text-slate-900">BLUECHECKED</span>
                    <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1 rounded w-fit mt-0.5">BETA</span>
                </div>
            </div>
            <div className="flex gap-4">
                <button 
                    onClick={onDemoClick} 
                    className="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
                >
                    View Demo <ArrowRight size={14} />
                </button>
                <button 
                    onClick={onLoginClick} 
                    className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20 px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:-translate-y-0.5"
                >
                    Sign In
                </button>
            </div>
        </nav>

        {/* Hero Section */}
        <div className="relative pt-12 pb-24 lg:pt-20 lg:pb-40 overflow-hidden transition-all duration-1000 ease-in-out">
            {/* Background Gradient Mesh */}
            <div className={`absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] bg-gradient-to-br ${theme.gradient} rounded-full blur-[100px] opacity-60 animate-pulse duration-[4000ms] mix-blend-multiply transition-colors duration-1000`}></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-pink-100 rounded-full blur-[100px] opacity-60 mix-blend-multiply"></div>

            <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
                {/* Text Content */}
                <div className="space-y-8">
                    <div className="space-y-3">
                         <div className="inline-flex items-center gap-2 bg-white/60 border border-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md shadow-sm">
                            <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Now Recruiting Creators for Beta
                        </div>
                    </div>

                    <div className="min-h-[160px] lg:min-h-[240px] p-2 pb-4">
                      <h1 className="text-5xl lg:text-7xl font-black tracking-tighter leading-[1.15] text-slate-900 transition-smooth">
                          {theme.headlineStart} <br/>
                          <span className={`text-transparent bg-clip-text bg-gradient-to-r ${theme.headlineGradient} inline-block transition-opacity duration-500 pb-2 ${isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`} key={`hl-${theme.id}`}>
                            {theme.headlineHighlight}
                          </span>
                      </h1>
                    </div>

                    <p className={`text-lg lg:text-xl text-slate-500 max-w-xl leading-relaxed font-medium min-h-[84px] transition-all duration-500 ${isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`} key={`desc-${theme.id}`}>
                        {theme.subText}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 pt-2">
                        <button 
                            onClick={onLoginClick}
                            className="bg-slate-900 text-white hover:bg-slate-800 px-8 py-4 rounded-full font-bold text-base transition-all shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 group hover:-translate-y-1"
                        >
                            Join as Creator <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button 
                            onClick={onDemoClick}
                            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-8 py-4 rounded-full font-bold text-base transition-all flex items-center justify-center shadow-sm hover:shadow-md"
                        >
                            See live demo
                        </button>
                    </div>

                    <p className="text-xs text-slate-400 font-medium">
                        * Limited beta spots available.
                    </p>

                    {/* Progress Indicators */}
                    <div className="flex gap-2 pt-4">
                      {THEMES.map((t, i) => (
                        <button
                          key={t.id}
                          onClick={() => setActiveThemeIndex(i)}
                          className="group relative h-1.5 w-12 bg-slate-200 rounded-full overflow-hidden transition-all"
                        >
                          {i === activeThemeIndex && (
                            <div className="absolute top-0 left-0 h-full bg-slate-900 w-full origin-left animate-fill-bar" />
                          )}
                          {i < activeThemeIndex && (
                             <div className="absolute top-0 left-0 h-full bg-slate-400 w-full" />
                          )}
                        </button>
                      ))}
                    </div>
                </div>

                {/* Abstract UI Visual - VERIFIED DM FEED */}
                <div className="relative hidden lg:block" style={{ perspective: '1000px' }}>
                     <div 
                        className="relative w-full max-w-md mx-auto aspect-[4/5] animate-float"
                        style={{ transform: 'rotateY(-12deg) rotateX(6deg)' }}
                    >
                        {/* Main Glass App Container */}
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-2xl rounded-[2.5rem] border border-white/80 shadow-[0_30px_80px_-15px_rgba(0,0,0,0.15)] flex flex-col ring-1 ring-white/50 overflow-hidden transition-all duration-500">

                            {/* App Header */}
                            <div className="relative z-20 flex justify-between items-center px-8 pt-8 pb-4 border-b border-white/40 bg-white/40 backdrop-blur-sm">
                                <div className="flex flex-col">
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Verified Inbox</h3>
                                    <div className="flex items-center gap-1.5">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Live Updates</span>
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center">
                                    <MessageSquare size={18} className="text-slate-400" />
                                </div>
                            </div>

                            {/* Dynamic Messages Feed */}
                            <div className="relative z-10 flex-1 px-6 overflow-hidden">
                                <div key={activeThemeIndex} className="space-y-4 pt-6">
                                    {/* User Question - Immediate */}
                                    <div className="animate-fade-in-up" style={{ opacity: 0, animationDelay: '0.1s' }}>
                                        <div className="relative bg-white/90 rounded-2xl rounded-tl-sm p-4 shadow-sm border border-slate-100 transition-all hover:scale-[1.01]">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${activeMessage.avatarColor}`}>
                                                        {activeMessage.initial}
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-500">{activeMessage.name}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-300">{activeMessage.time}</span>
                                            </div>
                                            <p className="text-sm text-slate-700 pl-8 leading-relaxed min-h-[40px] font-medium break-words">"{activeMessage.question}"</p>
                                        </div>
                                    </div>

                                    {/* Creator Reply - UPDATED to match fan format */}
                                    <div className="flex gap-3 pl-8 animate-fade-in-up" style={{ opacity: 0, animationDelay: '2.5s' }}>
                                        <div className="relative bg-white/90 rounded-2xl rounded-tr-sm p-4 shadow-md shadow-indigo-100/50 border border-indigo-50 transition-all hover:scale-[1.01] w-full">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-indigo-100 text-indigo-600">
                                                        {activeMessage.initial}
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-500">{activeMessage.name}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-300">Just now</span>
                                            </div>
                                            <p className="text-sm font-medium text-slate-800 pl-8 leading-relaxed min-h-[60px] break-words">
                                                {activeMessage.reply}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Magical Bluechecked Animation - Last - CENTERED & SIMPLE */}
                                    <div className="pt-4 pb-2 flex justify-center animate-fade-in-up" style={{ opacity: 0, animationDelay: '3.5s' }}>
                                        <div className="relative group cursor-default transform transition-transform hover:scale-105 duration-300">
                                            <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20"></div>
                                            
                                            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 rounded-xl px-5 py-3 shadow-2xl shadow-indigo-500/40 ring-1 ring-white/20 flex items-center gap-3">
                                                {/* Particles/Noise */}
                                                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                                                
                                                {/* Simple Icon */}
                                                <div className="relative z-10 bg-white/20 p-1.5 rounded-full backdrop-blur-md">
                                                     <Check size={16} className="text-white" strokeWidth={3} />
                                                </div>
                                                
                                                {/* Text */}
                                                <div className="relative z-10 text-left">
                                                    <h3 className="font-black text-white text-sm tracking-tight leading-none mb-0.5 drop-shadow-sm">Bluechecked</h3>
                                                    <p className="text-indigo-100 font-medium text-[9px] tracking-wide uppercase opacity-90">Credits Released</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                            
                            {/* Bottom Funds Bar (Static Container - Dynamic Value) */}
                            <div className="h-16 border-t border-slate-200/60 bg-white/40 backdrop-blur-md flex items-center justify-between px-6 z-20 relative">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 border border-emerald-500/20">
                                        <Coins size={16} />
                                    </div>
                                    <div className="flex flex-col leading-none gap-0.5">
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">In Escrow</span>
                                        <div className="text-sm font-black text-slate-900 tabular-nums transition-all">
                                            {activeMessage.amount}
                                        </div>
                                    </div>
                                </div>
                                <button className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-slate-900/10 hover:scale-105 transition-transform flex items-center gap-2 group">
                                    Withdraw <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform"/>
                                </button>
                            </div>
                        </div>
                        
                        {/* Floating elements behind */}
                        <div className={`absolute -z-10 top-20 -right-12 w-48 h-48 bg-gradient-to-br ${theme.gradient} rounded-full blur-[60px] opacity-60 animate-pulse`}></div>
                        <div className="absolute -z-10 -bottom-10 -left-10 w-40 h-40 bg-pink-200 rounded-full blur-[50px] opacity-60"></div>
                     </div>
                </div>
            </div>
        </div>

        {/* Feature Grid */}
        <div className="max-w-7xl mx-auto px-6 py-32 bg-white">
            <div className="text-center mb-20">
                <h2 className="text-3xl lg:text-5xl font-black text-slate-900 tracking-tight mb-6">Built for certainty.</h2>
                <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                    We removed the ambiguity from DMs. Creators get paid for their time, and fans get the response they paid for.
                </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                    { icon: Lock, title: 'Secure Escrow', desc: 'Credits are held safely in escrow. You only pay when you get a reply.', color: 'indigo' },
                    { icon: Clock, title: 'Auto-Refunds', desc: 'If the 48h deadline is missed, you get a 100% refund instantly.', color: 'cyan' },
                    { icon: Sparkles, title: 'AI Drafting', desc: 'Creators use Gemini AI to draft personalized, high-quality replies faster.', color: 'purple', isBeta: true },
                    { icon: User, title: 'Creator Controlled', desc: 'Creators set their own rates and response windows. No subscriptions.', color: 'emerald' }
                ].map((feature, idx) => (
                    <div key={idx} className="group p-8 rounded-[2rem] bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300">
                        <div className={`w-14 h-14 rounded-2xl bg-${feature.color}-50 text-${feature.color}-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm`}>
                            <feature.icon size={26} />
                        </div>
                        <h3 className="font-bold text-slate-900 text-xl mb-3 flex items-center gap-2">
                            {feature.title}
                            {/* @ts-ignore */}
                            {feature.isBeta && <span className="bg-purple-100 text-purple-600 text-[10px] px-2 py-0.5 rounded-full border border-purple-200 uppercase tracking-wide">Beta</span>}
                        </h3>
                        <p className="text-slate-500 leading-relaxed text-sm font-medium">
                            {feature.desc}
                        </p>
                    </div>
                ))}
            </div>
        </div>

        {/* Digital Shop & Links Section */}
        <div className="py-24 bg-slate-50 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex flex-col lg:flex-row items-center gap-16">
                    
                    {/* Visual: Content Access Management Mockup - UPDATED */}
                    <div className="flex-1 w-full relative">
                        {/* Abstract Background blob */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-purple-100 rounded-full blur-[100px] opacity-60 transform -rotate-12"></div>
                        
                        {/* Main Container - "My Links & Content" View */}
                        <div className="relative z-10 bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 max-w-md mx-auto rotate-[-2deg] hover:rotate-0 transition-transform duration-500 overflow-hidden">
                            {/* Browser-like Header */}
                            <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">My Store</div>
                            </div>

                            <div className="p-6 bg-[#FAFAFA] space-y-3">
                                
                                {/* Item 1: Unlocked Content (Diet Plan) */}
                                <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-4 relative overflow-hidden group cursor-pointer hover:border-emerald-300 transition-colors">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400"></div>
                                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                                        <FileText size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-900 text-sm">30-Day Diet Plan</h4>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <Check size={10} className="text-emerald-500" />
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">Purchased</span>
                                        </div>
                                    </div>
                                    <div className="text-emerald-600 hover:scale-110 transition-transform">
                                        <Download size={16} />
                                    </div>
                                </div>

                                {/* Item 2: Locked Content (Workout) */}
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 group cursor-pointer hover:border-indigo-300 transition-all hover:shadow-md">
                                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                        <Play size={18} className="ml-0.5" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-900 text-sm">Full Body Workout</h4>
                                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Video Course • 45m</p>
                                    </div>
                                    <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold group-hover:bg-indigo-600 transition-colors flex items-center gap-1">
                                        <Coins size={10} /> 1200
                                    </div>
                                </div>

                                {/* Item 3: Affiliate Link (Amazon) */}
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 group cursor-pointer hover:border-amber-300 transition-all">
                                    <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                                        <ShoppingBag size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-900 text-sm">My Supplements</h4>
                                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Amazon Recommendation</p>
                                    </div>
                                    <ExternalLink size={14} className="text-slate-300 group-hover:text-amber-500 transition-colors" />
                                </div>

                                {/* Item 4: Gallery (Locked with Hover Effect) */}
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 group cursor-pointer hover:ring-2 hover:ring-purple-500/20 transition-all relative overflow-hidden">
                                    {/* Hover Reveal Background */}
                                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=400&q=80')] bg-cover bg-center opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                    <div className="absolute inset-0 bg-white/100 group-hover:bg-purple-900/80 transition-colors duration-500"></div>

                                    <div className="relative z-10 w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 group-hover:bg-white group-hover:text-purple-600 transition-colors">
                                        <ImageIcon size={18} />
                                    </div>
                                    <div className="relative z-10 flex-1">
                                        <h4 className="font-bold text-slate-900 text-sm group-hover:text-white transition-colors">Transformation Photos</h4>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <Lock size={10} className="text-slate-400 group-hover:text-white/70" />
                                            <span className="text-[10px] text-slate-400 font-medium group-hover:text-white/70">Premium Gallery</span>
                                        </div>
                                    </div>
                                     <div className="relative z-10 bg-slate-100 text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold group-hover:bg-white group-hover:text-purple-600 transition-colors flex items-center gap-1">
                                        <Coins size={10} /> 500
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Text Content */}
                    <div className="flex-1 space-y-6">
                        <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                            <ShoppingBag size={12} />
                            <span>DIGITAL SHOP</span>
                        </div>
                        
                        <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.1]">
                            Monetize more than <br/> just your replies.
                        </h2>
                        
                        <p className="text-lg text-slate-500 leading-relaxed">
                            Don't send your fans to a link tree. Sell digital products, PDFs, and showcase high-converting affiliate links directly on your Bluechecked profile.
                        </p>

                        <ul className="space-y-4 pt-2">
                            {[
                                { title: "Gate Premium Content", desc: "Lock exclusive videos or files. Fans pay to unlock access instantly." },
                                { title: "Manage Multiple Links", desc: "Organize affiliate links, resources, and downloads in one clean list." },
                                { title: "Instant Delivery", desc: "We handle the file hosting and access permissions automatically." }
                            ].map((item, i) => (
                                <li key={i} className="flex gap-4 items-start">
                                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 flex-shrink-0 mt-0.5">
                                        <Check size={14} strokeWidth={3} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                                        <p className="text-sm text-slate-500 leading-snug">{item.desc}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                </div>
            </div>
        </div>

        {/* Premium Analytics Section - Modernized Chart with Hover Tooltips */}
        <div className="bg-white py-24 relative overflow-hidden border-t border-slate-100">
            <div className="absolute inset-0 bg-slate-50/50"></div>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-b from-blue-50 to-transparent opacity-60 rounded-full blur-[80px] pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="flex flex-col lg:flex-row items-center gap-16">
                    {/* Text Content */}
                    <div className="flex-1 space-y-8 order-2 lg:order-1">
                         <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
                            <Sparkles size={12} className="text-yellow-400" />
                            <span>BLUECHECKED PRO</span>
                        </div>
                        
                        <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.1]">
                            Unlock the logic <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">behind your growth.</span>
                        </h2>
                        
                        <p className="text-slate-500 text-lg leading-relaxed max-w-xl">
                            Don't fly blind. Our premium analytics suite gives you the granular data you need to optimize your pricing, improve conversion rates, and forecast your monthly income.
                        </p>

                        <div className="space-y-4">
                            {[
                                "Real-time revenue forecasting",
                                "Conversion funnel analysis",
                                "Audience retention metrics",
                                "Exportable financial reports"
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3 text-slate-700 font-medium">
                                     <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0 border border-indigo-100">
                                        <Check size={14} />
                                     </div>
                                     {item}
                                </div>
                            ))}
                        </div>

                        {/* Premium Offer Badge */}
                        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-lg shadow-slate-100 inline-flex flex-col sm:flex-row sm:items-center gap-4 max-w-lg relative overflow-hidden group">
                             <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                            <div className="p-2 bg-indigo-50 rounded-lg shrink-0 w-fit text-indigo-600">
                                <Sparkles size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-0.5">Limited Time Offer</p>
                                <p className="font-bold text-sm text-slate-900">Join the Beta and get <span className="text-indigo-600">0% commission fees</span> for your first 12 months.</p>
                            </div>
                        </div>
                        
                        <div className="pt-2">
                            <button onClick={onLoginClick} className="bg-slate-900 text-white hover:bg-slate-800 px-8 py-3.5 rounded-full font-bold text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                                Explore Pro Features
                            </button>
                        </div>
                    </div>

                    {/* Visual Dashboard Mockup - Trendy, Modern Chart */}
                    <div className="flex-1 w-full relative group order-1 lg:order-2">
                        <div className="relative bg-white rounded-[2.5rem] p-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] border border-slate-100 transition-transform duration-500 group-hover:scale-[1.01]">
                            {/* Card Header - UPDATED */}
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <div className="text-sm text-slate-400 font-medium mb-1">Total Revenue</div>
                                    <div className="text-3xl font-black text-slate-900 tracking-tight mb-2 transition-all">{currentChart.total}</div>
                                    <div className="flex items-center gap-2">
                                        <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-100 transition-all">
                                            <TrendingUp size={10} strokeWidth={3} /> {currentChart.growth}
                                        </span>
                                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">vs last {activePeriod}</span>
                                    </div>
                                </div>
                                
                                {/* Toggle */}
                                <div className="bg-slate-50 p-1 rounded-xl border border-slate-100 flex items-center">
                                    {(['1D', '1W', '1M', '1Y'] as TimePeriod[]).map((period) => (
                                        <button
                                            key={period}
                                            onClick={() => setActivePeriod(period)}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                                activePeriod === period 
                                                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' 
                                                : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                        >
                                            {period}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Interactive Bar Chart - Dynamic Data */}
                            <div className="h-48 w-full relative flex items-end justify-between gap-3 px-1 mb-6 z-20">
                                {currentChart.data.map((item, i) => (
                                    <div key={i + activePeriod} className="group/bar relative flex-1 h-full flex items-end cursor-crosshair animate-grow-up" style={{ animationDelay: `${i * 0.1}s` }}>
                                        <div className="w-full relative transition-all duration-500 ease-out" style={{ height: `${(item.amount / currentChart.maxVal) * 100}%` }}>
                                             {/* Tooltip on Hover */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/bar:opacity-100 transition-all duration-200 pointer-events-none z-50 transform translate-y-2 group-hover/bar:translate-y-0">
                                                <div className="bg-slate-900 text-white text-[10px] font-bold py-1.5 px-2.5 rounded-lg shadow-xl whitespace-nowrap flex flex-col items-center">
                                                    <span className="text-xs">{item.amount.toLocaleString()}</span>
                                                    <span className="text-slate-400 font-normal text-[9px]">{item.label}</span>
                                                    {/* Tooltip Triangle */}
                                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                                                </div>
                                            </div>

                                            {/* Bar Visual */}
                                            <div className="w-full h-full bg-slate-100 rounded-t-xl relative overflow-hidden group-hover/bar:shadow-[0_0_20px_-5px_rgba(99,102,241,0.4)] transition-all duration-300">
                                                <div className="absolute inset-0 bg-gradient-to-t from-indigo-500 to-blue-400 opacity-80 group-hover/bar:opacity-100 transition-opacity"></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                             {/* X-Axis Labels - Dynamic */}
                             <div className="flex justify-between px-1 mb-8">
                                {currentChart.data.map((item, i) => (
                                    <div key={i} className="text-[10px] font-bold text-slate-300 uppercase w-full text-center truncate px-0.5">
                                        {activePeriod === '1D' ? item.label.replace('m', '') : item.label.charAt(0)}
                                    </div>
                                ))}
                            </div>

                            {/* Secondary Metrics Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                 <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 hover:bg-slate-100 transition-colors cursor-default">
                                     <div className="text-xs text-slate-500 font-medium mb-1">Conversion Rate</div>
                                     <div className="text-xl font-bold text-slate-900">4.8%</div>
                                 </div>
                                 <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 hover:bg-slate-100 transition-colors cursor-default">
                                     <div className="text-xs text-slate-500 font-medium mb-1">Avg Response</div>
                                     <div className="text-xl font-bold text-slate-900">2.4h</div>
                                 </div>
                            </div>
                        </div>

                        {/* Floating Badge - Analytics - REPOSITIONED to Top Right (Outside) */}
                        <div className="absolute top-24 -right-6 p-3 rounded-xl animate-float lg:flex items-center gap-3 hidden z-10 pointer-events-none" style={{animationDelay: '1s'}}>
                             <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-xl flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                                    <BarChart3 size={20} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-900">Live Analytics</div>
                                    <div className="text-xs text-slate-500">Real-time data</div>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-100 py-16">
             <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                 <div className="flex flex-col items-center md:items-start gap-4">
                    <div className="flex items-center gap-2">
                        <BlueCheckLogo size={24} className="text-slate-900" />
                        <div className="flex flex-col leading-none">
                            <span className="font-bold text-slate-900 tracking-wide">BLUECHECKED</span>
                            <span className="text-[9px] font-bold text-slate-400">BETA</span>
                        </div>
                    </div>
                    <p className="text-slate-400 text-sm">© 2024 Bluechecked Inc.</p>
                 </div>
                 <div className="flex gap-8 text-sm font-bold text-slate-500">
                     <a href="#" className="hover:text-slate-900 transition-colors">Privacy</a>
                     <a href="#" className="hover:text-slate-900 transition-colors">Terms</a>
                     <a href="#" className="hover:text-slate-900 transition-colors">Twitter</a>
                     <a href="#" className="hover:text-slate-900 transition-colors">Contact</a>
                 </div>
             </div>
        </footer>
    </div>
  );
};
