
import React, { useState } from 'react';
import { Button } from './Button';
import { BlueCheckLogo, CheckCircle2, MessageSquare, ArrowRight, Clock, Sparkles, User, Heart, Lock, Check, ShoppingBag, FileText, Coins, Star } from './Icons';

interface Props {
  onLoginClick: () => void;
  onDemoClick: () => void;
}

// Featured creators for the landing page
const FEATURED_CONVERSATIONS = [
  {
    id: '1',
    creator: {
      name: 'Sarah Chen',
      role: 'Fashion Stylist',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
    },
    request: "I am sincerely looking forward to your suggestions for my look tomorrow. Every time I open my closet, I feel a bit overwhelmed, so I’ve been waiting to see things through your artistic lens instead. ✨\n\nIt would be so meaningful to me if my everyday clothes could be transformed into a special style with your help. Could you guide me with your signature aesthetic and warm perspective so I can look my absolute best? 😊\n\nI’ll be waiting for your style proposal with an open heart. 🤗\n(Attachment: Outfit_Options.png)",
    response: "I can really feel how important this occasion is to you from your message. I’ll look through everything very carefully.\n\nLooking at your options, I see you prefer a clean, minimal mood. But like you said, we need that 'extra 10%' to make it pop. ✨\n\nI’m putting together the best combination to highlight your charm while keeping it professional.\n\nJust a moment! I’ll send over the final guide so you can walk in there feeling confident and radiant tomorrow. 😊",
    gradient: 'from-rose-100 to-orange-50',
    time: '2h ago'
  },
  {
    id: '2',
    creator: {
      name: 'Marcus Lee',
      role: 'Career Mentor',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
    },
    request: "I have been so looking forward to the moment I could receive your professional career insights. My resume feels a bit lost on its own, but I’ve been eagerly waiting for the day I could experience your warm guidance and expertise. 😊\n\nIt would mean so much to me if my humble career history could be reborn through your touch. ⌛️💗 With a mix of nerves and excitement, I’m sending this over. Could you help me prepare for my future with the keen eye and encouraging smile you’re known for? ✨\n\nI am sincerely—and very patiently—waiting for your feedback. 🤗\n(Attachment: Resume_Draft.pdf)",
    response: "What a heartfelt request... Reading this truly warmed my heart! ✨\n\nI can feel exactly how much you want this role in every single sentence. ⌛️💗\n\nDon't worry! As your mentor, I’ll make sure your sincerity shines through in this resume.\n\nI’m opening the file now. I'll get my feedback to you shortly so we can get you that 'Accepted' letter! 😊",
    gradient: 'from-sky-100 to-indigo-50',
    time: '4h ago'
  },
  {
    id: '3',
    creator: {
      name: 'Emma Wilson',
      role: 'Investment Advisor',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
    },
    request: "It’s not easy to stay grounded in such a volatile market lately. Rather than struggling with charts on my own, I have been genuinely looking forward to this chance to receive your sharp insights and wisdom.\n\nIf my portfolio could be refined into something more solid and healthy through your perspective, it would mean so much more to me than just a simple investment tip. ✨ Could you help correct my shortcomings with the vision you’ve built over the years and be the guide I need to move forward with confidence?\n\nI am sincerely looking forward to your thoughts. 🤗\n(Attachment: Portfolio_Status.xlsx)",
    response: "I know how uneasy it feels when the market is shaking, so thank you for reaching out and trusting me.\n\nI see a lot of thought went into your portfolio, but your tech exposure seems a bit at odds with current macro trends.\n\nThis isn't just about buying or selling; I’ll give you feedback focused on risk management so you can stay in the game for the long run. ✨\n\nI’m currently calculating the optimal rebalancing based on the data. I’ll message you back very soon. 😊",
    gradient: 'from-violet-100 to-purple-50',
    time: '5h ago'
  },
];

const TESTIMONIALS = [
  {
    quote: "Finally, a way to help my community without burning out. I can actually respond thoughtfully now.",
    author: "Fitness Creator",
    followers: "850K followers"
  },
  {
    quote: "My fans love knowing they'll get a real response. The guarantee builds so much trust.",
    author: "Life Coach",
    followers: "1.2M followers"
  },
  {
    quote: "Turned my DMs from a burden into my favorite part of the day. And the income is nice too.",
    author: "Career Mentor",
    followers: "420K followers"
  }
];

export const LandingPage: React.FC<Props> = ({ onLoginClick, onDemoClick }) => {
  const [activeCreator, setActiveCreator] = useState(0);
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

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
      `}</style>

      {/* Navigation - Minimal & Warm */}
      <nav className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => window.location.reload()}>
          <BlueCheckLogo size={28} className="text-stone-800" />
          <span className="font-semibold text-lg text-stone-800 tracking-tight">bluechecked</span>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={onDemoClick}
            className="hidden sm:block text-sm text-stone-500 hover:text-stone-800 transition-colors font-medium"
          >
            View Demo
          </button>
          <button
            onClick={onLoginClick}
            className="bg-stone-900 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-stone-800 transition-all"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero - Intimate & Editorial */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 lg:pt-24 lg:pb-32">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Soft Badge */}
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-700 px-4 py-2 rounded-full text-sm font-medium">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse-soft"></span>
            Now welcoming creators
          </div>

          {/* Main Headline - Editorial Typography */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-stone-900 tracking-tight leading-[1.15]">
            A quieter space for
            <br />
            <span className="text-stone-400">meaningful conversations.</span>
          </h1>

          {/* Subtext - Generous Line Height */}
          <p className="text-lg sm:text-xl text-stone-500 leading-relaxed max-w-2xl mx-auto font-normal">
            Connect with your community through paid messages.
            They get your undivided attention. You get compensated for your time.
            <span className="text-stone-400"> Everyone wins.</span>
          </p>

          {/* CTA Buttons - Soft & Rounded */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={onLoginClick}
              className="w-full sm:w-auto bg-stone-900 text-white px-8 py-4 rounded-full font-medium text-base hover:bg-stone-800 transition-all flex items-center justify-center gap-2 group"
            >
              Start as Creator
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={onDemoClick}
              className="w-full sm:w-auto bg-white text-stone-700 border border-stone-200 px-8 py-4 rounded-full font-medium text-base hover:bg-stone-50 transition-all"
            >
              Explore Demo
            </button>
          </div>
        </div>
      </section>

      {/* Featured Conversations - Weverse Magazine Style */}
      <section className="bg-white py-24 border-t border-stone-100">
        <div className="max-w-6xl mx-auto px-6">
          {/* Section Header */}
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-stone-400 uppercase tracking-wider mb-4">From the Community</p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-stone-900 tracking-tight">
              Real conversations. Real value.
            </h2>
          </div>

          {/* Creator Cards - Editorial Grid */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {FEATURED_CONVERSATIONS.map((item, idx) => (
              <div
                key={item.id}
                className="group bg-white rounded-3xl p-6 border border-stone-200 shadow-sm hover:shadow-xl hover:shadow-stone-200/50 hover:-translate-y-1 transition-all duration-500 cursor-pointer flex flex-col"
                onClick={() => setActiveCreator(idx)}
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
                            <span className="font-semibold text-sm text-stone-900">Anonymous Fan</span>
                            <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                <User size={10} className="fill-current" />
                                <span className="text-[9px] font-semibold uppercase tracking-wide">Fan</span>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl rounded-tl-lg border border-stone-200 shadow-sm">
                            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{item.request}</p>
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
                            <div className="flex items-center gap-1 bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                <CheckCircle2 size={10} className="fill-current" />
                                <span className="text-[9px] font-semibold uppercase tracking-wide">Creator</span>
                            </div>
                            <span className="text-xs font-medium text-stone-400">• {item.time}</span>
                        </div>
                        <div className="bg-stone-50 p-4 rounded-2xl rounded-tl-lg border border-stone-200/60">
                            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{item.response}</p>
                        </div>
                    </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Clean & Warm */}
      <section className="py-24 bg-[#FAFAF9]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-stone-400 uppercase tracking-wider mb-4">Simple & Transparent</p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-stone-900 tracking-tight">
              How it works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                step: '01',
                title: 'Set your rate',
                desc: 'Choose what your time is worth. $5 or $500 - you decide. No subscriptions, just pay-per-message.',
                icon: Coins
              },
              {
                step: '02',
                title: 'Receive questions',
                desc: 'Fans pay upfront to send you a message. Their payment is held safely until you respond.',
                icon: MessageSquare
              },
              {
                step: '03',
                title: 'Reply & earn',
                desc: 'Respond within your window and the payment is yours. Miss it? They get an automatic refund.',
                icon: Check
              }
            ].map((item, idx) => (
              <div
                key={idx}
                className="relative group"
                onMouseEnter={() => setHoveredFeature(idx)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                {/* Connecting Line */}
                {idx < 2 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-stone-200"></div>
                )}

                <div className="relative bg-white rounded-3xl p-8 border border-stone-100 transition-all duration-300 hover:shadow-lg hover:shadow-stone-100 hover:border-stone-200">
                  {/* Step Number */}
                  <div className="text-sm font-semibold text-stone-300 mb-6">{item.step}</div>

                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 ${
                    hoveredFeature === idx
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600'
                  }`}>
                    <item.icon size={24} />
                  </div>

                  <h3 className="text-xl font-semibold text-stone-900 mb-3">{item.title}</h3>
                  <p className="text-stone-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
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
                    <span className="text-sm font-medium text-stone-500">Payment Status</span>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">Held in Escrow</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                      <Lock size={20} className="text-amber-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-semibold text-stone-900">500 Credits</div>
                      <div className="text-sm text-stone-500">Protected until response</div>
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
                      <div className="text-sm text-stone-500 mb-1">Response Guarantee</div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full w-3/4 bg-emerald-500 rounded-full"></div>
                        </div>
                        <span className="text-sm font-medium text-stone-700">36h left</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Text */}
            <div className="space-y-8">
              <div>
                <p className="text-sm font-medium text-amber-600 uppercase tracking-wider mb-4">Built on Trust</p>
                <h2 className="text-3xl sm:text-4xl font-semibold text-stone-900 tracking-tight leading-tight">
                  Guaranteed response,
                  <br />
                  or your money back.
                </h2>
              </div>

              <p className="text-lg text-stone-500 leading-relaxed">
                We hold payments in escrow until the creator responds. If they miss their window,
                you get an automatic, full refund. No questions asked.
              </p>

              <div className="space-y-4">
                {[
                  'Payments protected until response',
                  'Automatic refunds if deadline missed',
                  'Creators set their own response windows',
                  'Full transparency on expected wait times'
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

      {/* Testimonials - Cozy & Intimate */}
      <section className="py-24 bg-stone-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider mb-4">Creator Stories</p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
              Loved by creators worldwide
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((item, idx) => (
              <div
                key={idx}
                className="bg-stone-800/50 rounded-3xl p-8 border border-stone-700/50 hover:bg-stone-800 transition-all"
              >
                {/* Stars */}
                <div className="flex gap-1 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>

                <p className="text-white/90 leading-relaxed mb-8 text-[15px]">
                  "{item.quote}"
                </p>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-stone-700 flex items-center justify-center">
                    <User size={18} className="text-stone-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium text-sm">{item.author}</div>
                    <div className="text-stone-500 text-sm">{item.followers}</div>
                  </div>
                </div>
              </div>
            ))}
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
                <p className="text-sm font-medium text-violet-600 uppercase tracking-wider mb-4">Beyond Messages</p>
                <h2 className="text-3xl sm:text-4xl font-semibold text-stone-900 tracking-tight leading-tight">
                  Sell your expertise,
                  <br />
                  not just your time.
                </h2>
              </div>

              <p className="text-lg text-stone-500 leading-relaxed">
                Create a digital storefront alongside your inbox. Sell guides, courses,
                templates, and exclusive content — all in one beautiful profile.
              </p>

              <div className="flex flex-wrap gap-3">
                {['PDF Guides', 'Video Courses', 'Templates', 'Exclusive Content'].map((tag, idx) => (
                  <span key={idx} className="bg-violet-50 text-violet-700 px-4 py-2 rounded-full text-sm font-medium border border-violet-100">
                    {tag}
                  </span>
                ))}
              </div>

              <button
                onClick={onLoginClick}
                className="bg-stone-900 text-white px-6 py-3 rounded-full font-medium hover:bg-stone-800 transition-all inline-flex items-center gap-2 group"
              >
                Start Selling
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Right: Visual */}
            <div className="relative">
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-[2.5rem] p-8">
                <div className="space-y-4">
                  {[
                    { icon: FileText, title: '30-Day Fitness Plan', price: 1200, sold: 847, color: 'emerald' },
                    { icon: ShoppingBag, title: 'Complete Meal Prep Guide', price: 800, sold: 1.2, suffix: 'K', color: 'blue' },
                    { icon: Sparkles, title: 'VIP Coaching Call', price: 5000, sold: 156, color: 'violet' },
                  ].map((product, idx) => (
                    <div key={idx} className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 flex items-center gap-4 hover:shadow-md transition-all cursor-pointer group">
                      <div className={`w-12 h-12 rounded-xl bg-${product.color}-100 text-${product.color}-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                        <product.icon size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-stone-900 truncate">{product.title}</div>
                        <div className="text-sm text-stone-500">{product.sold}{product.suffix || ''} sold</div>
                      </div>
                      <div className="flex items-center gap-1 text-stone-900 font-semibold">
                        <Coins size={14} className="text-amber-500" />
                        {product.price.toLocaleString()}
                      </div>
                    </div>
                  ))}
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
            Ready to create something meaningful?
          </h2>
          <p className="text-lg text-stone-500 leading-relaxed mb-10 max-w-xl mx-auto">
            Join thousands of creators building deeper relationships with their community.
            Your fans are waiting.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onLoginClick}
              className="w-full sm:w-auto bg-stone-900 text-white px-10 py-4 rounded-full font-medium text-lg hover:bg-stone-800 transition-all flex items-center justify-center gap-2 group"
            >
              Get Started Free
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <p className="text-sm text-stone-400 mt-6">
            No credit card required. Set up in 2 minutes.
          </p>
        </div>
      </section>

      {/* Footer - Minimal & Clean */}
      <footer className="bg-white border-t border-stone-100 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <BlueCheckLogo size={22} className="text-stone-800" />
              <span className="font-semibold text-stone-800">bluechecked</span>
            </div>

            <div className="flex items-center gap-8 text-sm text-stone-500">
              <a href="#" className="hover:text-stone-900 transition-colors">Privacy</a>
              <a href="#" className="hover:text-stone-900 transition-colors">Terms</a>
              <a href="#" className="hover:text-stone-900 transition-colors">Twitter</a>
              <a href="#" className="hover:text-stone-900 transition-colors">Contact</a>
            </div>

            <p className="text-sm text-stone-400">© 2024 Bluechecked</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
