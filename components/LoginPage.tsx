import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/config';
import { Button } from './Button';
import { DiemLogo, CheckCircle2, Lock, GoogleLogo, InstagramLogo, Mail, User, MessageSquare, Camera, X, Plus, YouTubeLogo, XLogo, TikTokLogo, Twitch, Check, Phone, FileText, Heart, ExternalLink, Coins, Trash } from './Icons';
import { CurrentUser, AffiliateLink, LinkSection } from '../types';
import { loginUser, updateCreatorProfile, getCreatorProfile, updateCurrentUser, signInWithSocial, resendConfirmationEmail, sendPasswordResetEmail, updatePassword, signOut } from '../services/realBackend';

interface Props {
  onLoginSuccess: (user: CurrentUser) => void;
  onBack: () => void;
  initialStep?: 'LOGIN' | 'SETUP_PROFILE' | 'RESET_PASSWORD';
  currentUser?: CurrentUser | null;
}

const SUPPORTED_PLATFORMS = [
    { id: 'youtube', label: 'YouTube', icon: YouTubeLogo },
    { id: 'instagram', label: 'Instagram', icon: InstagramLogo },
    { id: 'x', label: 'X (Twitter)', icon: XLogo },
    { id: 'tiktok', label: 'TikTok', icon: TikTokLogo },
    { id: 'twitch', label: 'Twitch', icon: Twitch },
];

export const LoginPage: React.FC<Props> = ({ onLoginSuccess, onBack, initialStep = 'LOGIN', currentUser }) => {
  const { t } = useTranslation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<'CREATOR' | 'FAN'>(currentUser?.role || 'CREATOR');
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);

  // Terms of Service State
  const [termsScrolled, setTermsScrolled] = useState(false);
  const [pendingSignup, setPendingSignup] = useState<{ identifier: string; password: string; fullName: string; role: 'CREATOR' | 'FAN' } | null>(null);

  // Setup / Onboarding State
  const [step, setStep] = useState<'LOGIN' | 'TERMS' | 'SETUP_PROFILE' | 'RESET_PASSWORD'>(initialStep);
  const [setupPage, setSetupPage] = useState(1);
  const [tempUser, setTempUser] = useState<CurrentUser | null>(currentUser || null);

  // Creator Config
  const [price, setPrice] = useState(100);
  const [responseHours, setResponseHours] = useState(48);
  const [platforms, setPlatforms] = useState<(string | { id: string, url: string })[]>([]);
  const [handle, setHandle] = useState('');
  const [intakeInstructions, setIntakeInstructions] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [regLinks, setRegLinks] = useState<AffiliateLink[]>([]);
  const [regSections, setRegSections] = useState<LinkSection[]>([]);
  const [regNewSectionTitle, setRegNewSectionTitle] = useState('');
  const [regNewLinkType, setRegNewLinkType] = useState<'EXTERNAL' | 'DIGITAL_PRODUCT' | 'SUPPORT'>('EXTERNAL');
  const [regNewLinkTitle, setRegNewLinkTitle] = useState('');
  const [regNewLinkUrl, setRegNewLinkUrl] = useState('');
  const [regNewLinkPrice, setRegNewLinkPrice] = useState('');
  const [regNewLinkSectionId, setRegNewLinkSectionId] = useState('');
  const [regNewLinkColor, setRegNewLinkColor] = useState('');

  const REG_PRESET_COLORS = ['#1c1917','#6366f1','#8b5cf6','#ec4899','#10b981','#0ea5e9','#f59e0b','#ef4444'];

  const handleRegAddSection = () => {
      if (!regNewSectionTitle.trim()) return;
      setRegSections(prev => [...prev, { id: `s-${Date.now()}`, title: regNewSectionTitle.trim(), order: prev.length }]);
      setRegNewSectionTitle('');
  };

  const handleRegAddLink = () => {
      if (!regNewLinkTitle.trim()) return;
      if (regNewLinkType !== 'SUPPORT' && !regNewLinkUrl.trim()) return;
      const newLink: AffiliateLink = {
          id: `l-${Date.now()}`,
          title: regNewLinkTitle.trim(),
          url: regNewLinkType === 'SUPPORT' ? '#' : regNewLinkUrl.trim(),
          type: regNewLinkType,
          price: (regNewLinkType === 'DIGITAL_PRODUCT' || regNewLinkType === 'SUPPORT') && regNewLinkPrice ? Number(regNewLinkPrice) : undefined,
          sectionId: regNewLinkSectionId || undefined,
          buttonColor: regNewLinkColor || undefined,
          isPromoted: false,
      };
      setRegLinks(prev => [...prev, newLink]);
      setRegNewLinkTitle('');
      setRegNewLinkUrl('');
      setRegNewLinkPrice('');
      setRegNewLinkSectionId('');
      setRegNewLinkColor('');
      setRegNewLinkType('EXTERNAL');
  };

  // Shared Profile Config
  const [displayName, setDisplayName] = useState(currentUser?.name || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newPassword, setNewPassword] = useState('');
  const [regComplete, setRegComplete] = useState(false);
  const [completedUser, setCompletedUser] = useState<CurrentUser | null>(null);
  const [setupTextTab, setSetupTextTab] = useState<'bio' | 'instructions' | 'reply'>('bio');

  // Setup tutorial state
  const [showSetupTutorial, setShowSetupTutorial] = useState(false);
  const [setupTutorialStep, setSetupTutorialStep] = useState(0);
  const setupTutorialRefs = useRef<(HTMLDivElement | null)[]>(Array(9).fill(null));
  const [, setTutorialScrollTick] = useState(0);

  // Re-render tutorial card on scroll so it follows the highlighted element
  useEffect(() => {
    if (!showSetupTutorial) return;
    const onScroll = () => setTutorialScrollTick(n => n + 1);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [showSetupTutorial]);

  const SETUP_TUTORIAL_STEPS = [
    { emoji: '🌐', title: t('tutorial.setup.language.title'),     desc: t('tutorial.setup.language.desc'),     tab: 'bio' as const, page: 1 },
    { emoji: '🔖', title: t('tutorial.setup.handle.title'),       desc: t('tutorial.setup.handle.desc'),       tab: 'bio' as const, page: 1 },
    { emoji: '💰', title: t('tutorial.setup.price.title'),        desc: t('tutorial.setup.price.desc'),        tab: 'bio' as const, page: 1 },
    { emoji: '⏱️', title: t('tutorial.setup.replyTime.title'),   desc: t('tutorial.setup.replyTime.desc'),   tab: 'bio' as const, page: 1 },
    { emoji: '✍️', title: t('tutorial.setup.status.title'),      desc: t('tutorial.setup.status.desc'),      tab: 'bio' as const, page: 1 },
    { emoji: '📋', title: t('tutorial.setup.instructions.title'), desc: t('tutorial.setup.instructions.desc'), tab: 'instructions' as const, page: 1 },
    { emoji: '💬', title: t('tutorial.setup.autoReply.title'),    desc: t('tutorial.setup.autoReply.desc'),    tab: 'reply' as const, page: 1 },
    { emoji: '📱', title: t('tutorial.setup.platforms.title'),    desc: t('tutorial.setup.platforms.desc'),    tab: 'bio' as const, page: 1 },
    { emoji: '🔗', title: t('tutorial.setup.links.title'),        desc: t('tutorial.setup.links.desc'),        tab: 'bio' as const, page: 2 },
  ];

  useEffect(() => {
    if (step === 'SETUP_PROFILE' && (tempUser?.role || role) === 'CREATOR') {
      setSetupTutorialStep(0);
      setSetupTextTab('bio');
      setShowSetupTutorial(true);
    }
  }, [step]);

  const handleSetupTutorialNext = () => {
    const next = setupTutorialStep + 1;
    if (next >= SETUP_TUTORIAL_STEPS.length) {
      setShowSetupTutorial(false);
      return;
    }
    setSetupTutorialStep(next);
    const nextStep = SETUP_TUTORIAL_STEPS[next];
    // Switch text tab when entering bio/instructions/reply steps
    if (nextStep.page === 1 && [4, 5, 6].includes(next)) setSetupTextTab(nextStep.tab);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSignUp) {
        // Show Terms of Service before creating the account
        setPendingSignup({ identifier: email.trim(), password, fullName: fullName.trim(), role });
        setTermsScrolled(false);
        setStep('TERMS');
        return;
    }

    setIsLoading(true);
    try {
        const user = await loginUser(role, email.trim(), password, 'EMAIL');
        onLoginSuccess(user);
    } catch (error: any) {
        console.error("Login Error:", error);
        let msg = error.message || t('auth.loginFailed');
        if (msg.includes("timed out") || error.name === 'AuthRetryableFetchError' || error.status === 504) {
            msg = t('auth.connectionTimeout');
        }
        alert(msg);
    } finally {
        setIsLoading(false);
    }
  };

  const handleAgreeAndSignUp = async () => {
    if (!pendingSignup) return;
    setIsLoading(true);
    try {
        const user = await loginUser(pendingSignup.role, pendingSignup.identifier, pendingSignup.password, 'EMAIL', pendingSignup.fullName);
        setTempUser(user);
        setDisplayName(pendingSignup.fullName);
        setStep('SETUP_PROFILE');
    } catch (error: any) {
        if (error.message === "CONFIRMATION_REQUIRED") {
            alert(t('auth.confirmationSent'));
            setStep('LOGIN');
            setIsSignUp(false);
            setShowResend(true);
        } else {
            console.error("Sign up error:", error);
            let msg = error.message || t('auth.loginFailed');
            if (msg.includes("timed out") || error.name === 'AuthRetryableFetchError' || error.status === 504) {
                msg = t('auth.connectionTimeout');
            }
            alert(msg);
            setStep('LOGIN');
        }
    } finally {
        setIsLoading(false);
        setPendingSignup(null);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'instagram') => {
    setIsSocialLoading(true);
    try {
        await signInWithSocial(provider, role);
        // Note: The app will redirect to the provider, so code below won't run immediately.
    } catch (error: any) {
        console.error("Social Login Error:", error);

        const errorMessage = error.msg || error.message || "";

        // Handle specific Supabase configuration errors
        if (errorMessage.includes("provider is not enabled")) {
            alert(t('auth.providerNotEnabled', { provider }));
        } else if (errorMessage.includes("missing OAuth secret")) {
            alert(t('auth.missingOAuthSecret', { provider }));
        } else {
            alert(errorMessage || "Social login failed");
        }
        setIsSocialLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setIsLoading(true);
    try {
        await resendConfirmationEmail(email.trim());
        alert(t('auth.confirmationResent'));
    } catch (e: any) {
        alert(e.message || t('auth.failedResend'));
    } finally {
        setIsLoading(false);
    }
  };

  const handleTogglePlatform = (platformId: string) => {
      const existingIndex = platforms.findIndex(p => (typeof p === 'string' ? p : p.id) === platformId);
      if (existingIndex >= 0) {
          setPlatforms(prev => prev.filter((_, i) => i !== existingIndex));
      } else {
          const url = window.prompt(t('auth.enterUrlFor', { platform: platformId }));
          if (url && url.trim()) {
              setPlatforms(prev => [...prev, { id: platformId, url: url.trim() }]);
          }
      }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setAvatarUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSkipForNow = () => {
    // Set a flag in local storage to not show the setup screen again.
    localStorage.setItem('diem_skip_setup', 'true');
    if (tempUser) {
      onLoginSuccess(tempUser);
    }
  };

  const handleCompleteSetup = async () => {
     // Page 1 → Page 2 for creators
     if (setupPage === 1 && tempUser?.role === 'CREATOR') {
         if (!handle.trim()) { alert("User ID (Handle) is required."); return; }
         setSetupPage(2);
         return;
     }

     setIsLoading(true);

     let finalUser = tempUser;

     // 1. Update User Object (Fan or Creator)
     if (tempUser) {
         finalUser = {
             ...tempUser,
             name: displayName || tempUser.name,
             avatarUrl: avatarUrl || tempUser.avatarUrl,
             bio: bio
         };
         await updateCurrentUser(finalUser);
     }

     // 2. If Creator, Update Creator Profile
     if (finalUser && finalUser.role === 'CREATOR') {
        try {
            const currentProfile = await getCreatorProfile();
            await updateCreatorProfile({
                ...currentProfile,
                displayName: finalUser.name,
                handle: handle.startsWith('@') ? handle : `@${handle}`,
                bio: bio || currentProfile.bio,
                avatarUrl: finalUser.avatarUrl || currentProfile.avatarUrl,
                pricePerMessage: price,
                responseWindowHours: responseHours,
                platforms: platforms.length > 0 ? platforms : (currentProfile.platforms || []),
                intakeInstructions: intakeInstructions || currentProfile.intakeInstructions,
                welcomeMessage: welcomeMessage || currentProfile.welcomeMessage,
                links: regLinks.length > 0 ? regLinks : (currentProfile.links || []),
                linkSections: regSections.length > 0 ? regSections : (currentProfile.linkSections || []),
            });
        } catch (e) {
            console.error("Failed to setup profile:", e);
            alert("Failed to save profile. User ID might be taken.");
            setIsLoading(false);
            return;
        }
     }
     setIsLoading(false);

     // Also set the flag on save, to prevent re-entry even if bio is empty.
     localStorage.setItem('diem_skip_setup', 'true');

     if (finalUser) {
         setCompletedUser(finalUser);
         setRegComplete(true);
     }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email) {
          alert(t('auth.pleaseEnterEmail'));
          return;
      }
      setIsLoading(true);
      try {
          await sendPasswordResetEmail(email.trim());
          alert(t('auth.passwordResetSent'));
          setIsForgotPassword(false);
      } catch (error: any) {
          console.error("Reset Password Error:", error);
          alert(error.message || t('auth.failedResetEmail'));
      } finally {
          setIsLoading(false);
      }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword.length < 6) {
          alert(t('auth.passwordMinLength'));
          return;
      }
      setIsLoading(true);
      try {
          await updatePassword(newPassword);
          alert(t('auth.passwordUpdated'));

          await signOut();
          onBack();
      } catch (error: any) {
          console.error("Update Password Error:", error);
          alert(error.message || t('auth.failedUpdatePassword'));
      } finally {
          setIsLoading(false);
      }
  };

  if (step === 'TERMS') {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100 overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
          <div className="p-6 border-b border-stone-100">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={18} className="text-stone-700" />
              <h2 className="text-lg font-bold text-stone-900">Terms of Service</h2>
            </div>
            <p className="text-xs text-stone-500">Please read and scroll to the bottom to agree.</p>
          </div>

          <div
            className="flex-1 overflow-y-auto p-6 text-sm text-stone-700 space-y-4"
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) setTermsScrolled(true);
            }}
          >
            <div>
              <p className="font-semibold text-stone-900 mb-1">Welcome to Diem</p>
              <p>By creating an account, you agree to the following Terms of Service. Please read them carefully before proceeding.</p>
            </div>

            <div>
              <p className="font-semibold text-stone-900 mb-1">1. Prohibited Content</p>
              <p>You may <strong>not</strong> post, send, request, or solicit any of the following:</p>
              <ul className="mt-2 space-y-1 list-disc list-inside text-stone-600">
                <li>Adult, sexual, or explicit content of any kind</li>
                <li>Content involving minors in any sexual or inappropriate context</li>
                <li>Hate speech, harassment, or content targeting individuals based on race, religion, gender, or sexuality</li>
                <li>Threats of violence or content that promotes self-harm</li>
                <li>Spam, scams, or deceptive content</li>
                <li>Content that infringes on intellectual property rights</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-stone-900 mb-1">2. Creator Responsibilities</p>
              <p>Creators agree to respond honestly and in good faith. Misrepresenting yourself, your services, or your identity is prohibited. Creators must fulfill paid requests within the stated reply window or fans will receive a full refund.</p>
            </div>

            <div>
              <p className="font-semibold text-stone-900 mb-1">3. Fan Responsibilities</p>
              <p>Fans agree to send messages in good faith. Sending abusive, harassing, or inappropriate content to creators is grounds for immediate account suspension.</p>
            </div>

            <div>
              <p className="font-semibold text-stone-900 mb-1">4. Payments & Refunds</p>
              <p>All transactions are held in escrow until the creator replies or the reply window expires. If a creator does not reply in time, the fan is automatically refunded. Diem does not issue refunds for completed interactions unless fraudulent activity is confirmed.</p>
            </div>

            <div>
              <p className="font-semibold text-stone-900 mb-1">5. Account Termination</p>
              <p>Diem reserves the right to suspend or permanently ban accounts that violate these terms, with or without prior notice. Illegal activity will be reported to relevant authorities.</p>
            </div>

            <div>
              <p className="font-semibold text-stone-900 mb-1">6. Privacy</p>
              <p>We collect and use your data as described in our Privacy Policy. We do not sell your personal information to third parties.</p>
            </div>

            <div>
              <p className="font-semibold text-stone-900 mb-1">7. Changes to Terms</p>
              <p>We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>
            </div>

            <div className="pt-2 border-t border-stone-100">
              <p className="text-xs text-stone-400">Last updated: March 2026. For questions, contact support@diem.app.</p>
            </div>
          </div>

          <div className="p-5 border-t border-stone-100 space-y-2">
            {!termsScrolled && (
              <p className="text-xs text-center text-stone-400">Scroll to the bottom to enable "I Agree"</p>
            )}
            <button
              onClick={() => { if (termsScrolled) handleAgreeAndSignUp(); }}
              disabled={!termsScrolled || isLoading}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-colors ${termsScrolled && !isLoading ? 'bg-stone-900 text-white hover:bg-stone-700' : 'bg-stone-100 text-stone-400 cursor-not-allowed'}`}
            >
              {isLoading ? 'Creating account…' : 'I Agree & Continue'}
            </button>
            <button
              onClick={() => { setStep('LOGIN'); setPendingSignup(null); setTermsScrolled(false); }}
              className="w-full py-2 text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              Decline — go back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'RESET_PASSWORD') {
      return (
          <div className="min-h-screen bg-[#FAFAF9] relative flex flex-col items-center justify-center p-4 font-sans">
              <div className="relative z-10 w-full max-w-md bg-white p-8 rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100">
                  <h2 className="text-2xl font-bold text-stone-900 mb-2 text-center">{t('auth.setNewPassword')}</h2>
                  <form onSubmit={handleUpdatePassword} className="space-y-4 mt-6">
                      <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1.5 ml-1">{t('auth.newPassword')}</label>
                          <input type="password" required className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-500 outline-none transition-all" placeholder={t('auth.passwordPlaceholder')} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                      </div>
                      <Button fullWidth size="lg" type="submit" isLoading={isLoading}>{t('auth.updatePassword')}</Button>
                  </form>
              </div>
          </div>
      );
  }

  if (step === 'SETUP_PROFILE' && regComplete && completedUser) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex flex-col items-center justify-center p-4 font-sans">
        <style>{`
          @keyframes sketch-draw { to { stroke-dashoffset: 0; } }
          @keyframes sketch-pop { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
        <div className="flex flex-col items-center text-center gap-5 max-w-sm w-full">
          <svg viewBox="0 0 240 200" width="220" height="185" xmlns="http://www.w3.org/2000/svg">
            {/* Door / profile card frame */}
            <path d="M 70,160 L 70,50 Q 70,40 80,40 L 160,40 Q 170,40 170,50 L 170,160 Z"
              fill="none" stroke="#1c1917" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              pathLength={1} strokeDasharray="1" strokeDashoffset="1"
              style={{ animation: 'sketch-draw 0.8s cubic-bezier(0.4,0,0.2,1) 0.1s forwards' }} />
            {/* Door handle */}
            <path d="M 152,102 Q 156,100 156,105 Q 156,110 152,108"
              fill="none" stroke="#1c1917" strokeWidth="2" strokeLinecap="round"
              pathLength={1} strokeDasharray="1" strokeDashoffset="1"
              style={{ animation: 'sketch-draw 0.3s ease 0.85s forwards' }} />
            {/* Person head */}
            <circle cx="120" cy="78" r="14"
              fill="none" stroke="#1c1917" strokeWidth="2" strokeLinecap="round"
              pathLength={1} strokeDasharray="1" strokeDashoffset="1"
              style={{ animation: 'sketch-draw 0.5s ease 1.1s forwards' }} />
            {/* Person body */}
            <path d="M 96,138 Q 96,110 120,110 Q 144,110 144,138"
              fill="none" stroke="#1c1917" strokeWidth="2" strokeLinecap="round"
              pathLength={1} strokeDasharray="1" strokeDashoffset="1"
              style={{ animation: 'sketch-draw 0.5s ease 1.55s forwards' }} />
            {/* Welcome star burst lines */}
            <path d="M 185,45 L 192,38" fill="none" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round"
              pathLength={1} strokeDasharray="1" strokeDashoffset="1"
              style={{ animation: 'sketch-draw 0.2s ease 2.0s forwards' }} />
            <path d="M 188,52 L 197,52" fill="none" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round"
              pathLength={1} strokeDasharray="1" strokeDashoffset="1"
              style={{ animation: 'sketch-draw 0.2s ease 2.1s forwards' }} />
            <path d="M 185,59 L 192,66" fill="none" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round"
              pathLength={1} strokeDasharray="1" strokeDashoffset="1"
              style={{ animation: 'sketch-draw 0.2s ease 2.2s forwards' }} />
            <path d="M 45,80 L 38,73" fill="none" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round"
              pathLength={1} strokeDasharray="1" strokeDashoffset="1"
              style={{ animation: 'sketch-draw 0.2s ease 2.15s forwards' }} />
            <path d="M 42,90 L 33,90" fill="none" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round"
              pathLength={1} strokeDasharray="1" strokeDashoffset="1"
              style={{ animation: 'sketch-draw 0.2s ease 2.25s forwards' }} />
            {/* Sparkle dots */}
            <circle cx="195" cy="52" r="3" fill="#1c1917"
              style={{ opacity: 0, animation: 'sketch-pop 0.3s ease 2.3s forwards' }} />
            <circle cx="35" cy="90" r="2" fill="#1c1917"
              style={{ opacity: 0, animation: 'sketch-pop 0.3s ease 2.35s forwards' }} />
            <circle cx="175" cy="155" r="2" fill="#1c1917"
              style={{ opacity: 0, animation: 'sketch-pop 0.3s ease 2.4s forwards' }} />
          </svg>

          <div style={{ opacity: 0, animation: 'sketch-pop 0.5s ease 2.1s forwards' }} className="space-y-1.5">
            <h2 className="text-2xl font-bold text-stone-900">You're in!</h2>
            <p className="text-stone-500 text-sm">Your profile is live. Time to start connecting with fans.</p>
          </div>

          <div style={{ opacity: 0, animation: 'sketch-pop 0.5s ease 2.6s forwards' }} className="w-full">
            <Button fullWidth size="lg" onClick={() => onLoginSuccess(completedUser)}>Go to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'SETUP_PROFILE') {
    const isCreator = (tempUser?.role || role) === 'CREATOR';
    const totalPages = isCreator ? 2 : 1;

    return (
       <div className="min-h-screen bg-[#FAFAF9] flex flex-col items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white p-8 rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100 animate-in slide-in-from-bottom-4 duration-500">

             {/* Progress indicator */}
             {isCreator && (
                 <div className="flex items-center gap-2 mb-6">
                     {[1, 2].map(p => (
                         <div key={p} className={`h-1.5 flex-1 rounded-full transition-all ${p <= setupPage ? 'bg-stone-900' : 'bg-stone-200'}`} />
                     ))}
                     <span className="text-xs text-stone-400 ml-1">{setupPage}/{totalPages}</span>
                 </div>
             )}

             {/* ── PAGE 1 ── */}
             {setupPage === 1 && (
             <>
             <div className="text-center mb-6">
                <div
                    onClick={handleAvatarClick}
                    className="w-24 h-24 bg-stone-100 rounded-full mx-auto mb-3 flex items-center justify-center text-stone-400 border-2 border-dashed border-stone-300 relative overflow-hidden group cursor-pointer hover:border-stone-500 hover:text-stone-600 transition-all"
                >
                    {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <Camera size={32} />}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-bold">{t('auth.upload')}</span>
                    </div>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                <h2 className="text-2xl font-bold text-stone-900">
                    {isCreator ? t('auth.setupCreatorProfile') : t('auth.completeProfile')}
                </h2>
                <p className="text-stone-500 text-sm">{t('auth.profileStandOut')}</p>
             </div>

             <div className="space-y-5">
                <div ref={(el) => { setupTutorialRefs.current[0] = el; }} className={showSetupTutorial && setupTutorialStep === 0 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-xl p-2 -m-2' : ''}>
                   <label className="block text-sm font-medium text-stone-700 mb-2">Language</label>
                   <div className="flex flex-wrap gap-2">
                     {[
                       { code: 'en', label: 'English', flag: '🇺🇸' },
                       { code: 'ko', label: '한국어', flag: '🇰🇷' },
                       { code: 'ja', label: '日本語', flag: '🇯🇵' },
                       { code: 'zh', label: '中文', flag: '🇨🇳' },
                       { code: 'es', label: 'Español', flag: '🇪🇸' },
                     ].map(lang => (
                       <button
                         key={lang.code}
                         type="button"
                         onClick={() => i18n.changeLanguage(lang.code)}
                         className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${i18n.language === lang.code ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'}`}
                       >
                         <span>{lang.flag}</span>
                         <span>{lang.label}</span>
                       </button>
                     ))}
                   </div>
                </div>

                <div>
                   <label className="block text-sm font-medium text-stone-700 mb-1">{t('auth.displayName')}</label>
                   <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={t('auth.yourName')} className="w-full border border-stone-200 rounded-xl p-3 focus:ring-2 focus:ring-stone-500 outline-none transition-all" />
                </div>

                {!isCreator && (
                <div>
                   <label className="block text-sm font-medium text-stone-700 mb-1">{t('auth.bioAbout')}</label>
                   <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder={t('auth.fanBioPlaceholder')} className="w-full border border-stone-200 rounded-xl p-3 h-24 focus:ring-2 focus:ring-stone-500 outline-none resize-none transition-all" />
                </div>
                )}

                {isCreator && (
                    <>
                        <div ref={(el) => { setupTutorialRefs.current[1] = el; }} className={showSetupTutorial && setupTutorialStep === 1 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-xl p-1 -m-1' : ''}>
                            <label className="block text-sm font-medium text-stone-700 mb-1">Public Page ID</label>
                            <p className="text-xs text-stone-400 mb-2">This will be your unique public page address — choose carefully, it can't be changed later.</p>
                            <div className="flex items-center border border-stone-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-stone-500 transition-all">
                                <span className="px-3 py-3 bg-stone-50 text-stone-500 font-medium border-r border-stone-200 select-none">@</span>
                                <input
                                    type="text"
                                    value={handle.replace('@', '')}
                                    onChange={e => setHandle(e.target.value.replace('@', ''))}
                                    placeholder="username"
                                    className="flex-1 p-3 outline-none bg-white"
                                />
                            </div>
                            {handle && (
                                <p className="text-[10px] text-stone-400 mt-1 ml-1">
                                    Your public page: <span className="font-mono text-stone-600">{window.location.host}/{handle.replace('@', '')}</span>
                                </p>
                            )}
                        </div>

                        <div className="bg-stone-50 p-5 rounded-2xl border border-stone-100 space-y-4">
                            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide flex items-center gap-2">
                                <MessageSquare size={16} className="text-stone-500" /> {t('auth.messageSettings')}
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div ref={(el) => { setupTutorialRefs.current[2] = el; }} className={showSetupTutorial && setupTutorialStep === 2 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-xl p-1 -m-1' : ''}>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Price per message (credits)</label>
                                    <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full border border-stone-200 rounded-xl p-2 focus:ring-2 focus:ring-stone-500 outline-none transition-all" />
                                </div>
                                <div ref={(el) => { setupTutorialRefs.current[3] = el; }} className={showSetupTutorial && setupTutorialStep === 3 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-xl p-1 -m-1' : ''}>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">{t('auth.replyTime')}</label>
                                    <select value={responseHours} onChange={e => setResponseHours(Number(e.target.value))} className="w-full border border-stone-200 rounded-xl p-2 bg-white focus:ring-2 focus:ring-stone-500 outline-none transition-all">
                                        <option value={24}>{t('auth.hours24')}</option>
                                        <option value={48}>{t('auth.hours48')}</option>
                                        <option value={72}>{t('auth.hours72')}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Bio / Instructions / Auto-Reply tab switcher */}
                            <div ref={(el) => { setupTutorialRefs.current[4] = setupTutorialRefs.current[5] = setupTutorialRefs.current[6] = el; }} className={showSetupTutorial && setupTutorialStep >= 4 && setupTutorialStep <= 6 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-xl p-1 -m-1' : ''}>
                                <div className="flex bg-stone-100 rounded-xl p-1 mb-3 gap-0.5">
                                    {[
                                        { key: 'bio', label: 'Bio / About' },
                                        { key: 'instructions', label: 'Request Instructions' },
                                        { key: 'reply', label: 'Auto-Reply' },
                                    ].map(tab => (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setSetupTextTab(tab.key as typeof setupTextTab)}
                                            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${setupTextTab === tab.key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                {setupTextTab === 'bio' && (
                                    <textarea
                                        value={bio}
                                        onChange={e => setBio(e.target.value)}
                                        placeholder={t('auth.creatorBioPlaceholder')}
                                        className="w-full border border-stone-200 rounded-xl p-3 h-24 focus:ring-2 focus:ring-stone-500 outline-none resize-none transition-all text-sm"
                                    />
                                )}
                                {setupTextTab === 'instructions' && (
                                    <textarea
                                        value={intakeInstructions}
                                        onChange={e => setIntakeInstructions(e.target.value)}
                                        placeholder="Tell fans what to include in their message (e.g. your question, topic, context...)"
                                        className="w-full border border-stone-200 rounded-xl p-3 h-24 focus:ring-2 focus:ring-stone-500 outline-none resize-none transition-all text-sm"
                                    />
                                )}
                                {setupTextTab === 'reply' && (
                                    <textarea
                                        value={welcomeMessage}
                                        onChange={e => setWelcomeMessage(e.target.value)}
                                        placeholder="Sent automatically when a fan submits a request (e.g. Thanks for reaching out! I'll get back to you within 48 hours.)"
                                        className="w-full border border-stone-200 rounded-xl p-3 h-24 focus:ring-2 focus:ring-stone-500 outline-none resize-none transition-all text-sm"
                                    />
                                )}
                            </div>
                        </div>

                        <div ref={(el) => { setupTutorialRefs.current[7] = el; }} className={showSetupTutorial && setupTutorialStep === 7 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-xl p-1 -m-1' : ''}>
                            <label className="block text-sm font-medium text-stone-700 mb-2">{t('auth.connectedPlatforms')}</label>
                            <p className="text-xs text-stone-500 mb-3">{t('auth.platformsDesc')}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {SUPPORTED_PLATFORMS.map(platform => {
                                    const platformData = platforms.find(p => (typeof p === 'string' ? p : p.id) === platform.id);
                                    const isSelected = !!platformData;
                                    const url = typeof platformData === 'object' ? platformData.url : '';
                                    return (
                                        <button key={platform.id} onClick={() => handleTogglePlatform(platform.id)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-left ${isSelected ? 'bg-stone-900 text-white border-stone-900 shadow-md' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}>
                                            <platform.icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-stone-400'}`} />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-xs font-bold block">{platform.label}</span>
                                                {isSelected && url && <span className="text-[9px] text-stone-300 truncate block">{url.replace(/^https?:\/\/(www\.)?/, '')}</span>}
                                            </div>
                                            {isSelected && <Check size={12} className="ml-auto text-green-400 flex-shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                <div className="space-y-3 pt-2">
                    <Button fullWidth onClick={handleCompleteSetup} isLoading={isLoading} size="lg">
                        {isCreator ? 'Next →' : t('auth.saveProfileContinue')}
                    </Button>
                    <button onClick={handleSkipForNow} className="w-full text-center text-stone-400 text-sm hover:text-stone-600 font-medium transition-colors">{t('auth.skipForNow')}</button>
                    <button onClick={onBack} className="w-full text-center text-stone-300 hover:text-red-500 text-xs font-medium transition-colors mt-2">{t('auth.cancelSignOut')}</button>
                </div>
             </div>
             </>
             )}

             {/* ── PAGE 2: Links & Products ── */}
             {setupPage === 2 && isCreator && (
             <>
             <div className="mb-5">
                 <h2 className="text-2xl font-bold text-stone-900">Links & Products</h2>
                 <p className="text-stone-500 text-sm mt-1">Add links, digital products, or tip buttons to your profile. You can always edit these later.</p>
             </div>

             {/* Existing links */}
             {regLinks.length > 0 && (
                 <div className="space-y-2 mb-4">
                     {regLinks.map(link => {
                         const isProduct = link.type === 'DIGITAL_PRODUCT';
                         const isSupport = link.type === 'SUPPORT';
                         return (
                             <div key={link.id} className={`flex items-center gap-3 p-3 rounded-xl border text-sm ${isProduct ? 'bg-purple-50 border-purple-100' : isSupport ? 'bg-pink-50 border-pink-100' : 'bg-stone-50 border-stone-200'}`}>
                                 <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isProduct ? 'bg-purple-100 text-purple-500' : isSupport ? 'bg-pink-100 text-pink-500' : 'bg-stone-200 text-stone-500'}`}
                                     style={link.buttonColor ? { backgroundColor: `${link.buttonColor}22`, color: link.buttonColor } : undefined}>
                                     {isProduct ? <FileText size={14}/> : isSupport ? <Heart size={14}/> : <ExternalLink size={14}/>}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                     <p className="font-semibold text-stone-800 truncate">{link.title}</p>
                                     <div className="flex items-center gap-1.5 mt-0.5">
                                         <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${isProduct ? 'bg-purple-100 text-purple-600' : isSupport ? 'bg-pink-100 text-pink-600' : 'bg-stone-200 text-stone-500'}`}>
                                             {isProduct ? 'Digital' : isSupport ? 'Tip' : 'Link'}
                                         </span>
                                         {link.buttonColor && <span className="w-3 h-3 rounded-full flex-shrink-0 border border-white shadow-sm" style={{ backgroundColor: link.buttonColor }} />}
                                         <span className="text-[10px] text-stone-400 truncate">{isSupport ? `${link.price ?? 0} credits` : isProduct ? `${link.price ?? 0} credits` : link.url}</span>
                                     </div>
                                 </div>
                                 <button onClick={() => setRegLinks(prev => prev.filter(l => l.id !== link.id))} className="text-stone-300 hover:text-red-400 transition-colors flex-shrink-0">
                                     <Trash size={14}/>
                                 </button>
                             </div>
                         );
                     })}
                 </div>
             )}

             {/* Add new link form */}
             <div ref={(el) => { setupTutorialRefs.current[8] = el; }} className={showSetupTutorial && setupTutorialStep === 8 ? 'relative z-[60] ring-2 ring-amber-400 ring-offset-2 rounded-2xl' : ''}>
             <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4 space-y-3 mb-4">
                 <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Add item</p>

                 {/* Type tabs */}
                 <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
                     {([['EXTERNAL','Link'],['SUPPORT','Support / Tip'],['DIGITAL_PRODUCT','Digital Product']] as const).map(([type, label]) => (
                         <button key={type} onClick={() => setRegNewLinkType(type)}
                             className={`flex-1 px-2 py-1.5 text-[10px] font-bold rounded-md transition-all ${regNewLinkType === type ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}>
                             {label}
                         </button>
                     ))}
                 </div>

                 <input type="text" placeholder={regNewLinkType === 'SUPPORT' ? 'e.g. Buy me a coffee' : 'Title'}
                     className="w-full border border-stone-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-stone-500 outline-none bg-white"
                     value={regNewLinkTitle} onChange={e => setRegNewLinkTitle(e.target.value)} />

                 {regNewLinkType !== 'SUPPORT' && (
                     <input type="url" placeholder="https://"
                         className="w-full border border-stone-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-stone-500 outline-none bg-white"
                         value={regNewLinkUrl} onChange={e => setRegNewLinkUrl(e.target.value)} />
                 )}

                 {(regNewLinkType === 'DIGITAL_PRODUCT' || regNewLinkType === 'SUPPORT') && (
                     <div className="relative">
                         <Coins size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                         <input type="number" placeholder={regNewLinkType === 'SUPPORT' ? 'Default tip (credits)' : 'Price (credits)'}
                             className="w-full pl-8 pr-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-stone-500 outline-none bg-white"
                             value={regNewLinkPrice} onChange={e => setRegNewLinkPrice(e.target.value)} />
                     </div>
                 )}

                 {/* Highlight + Color — inline row */}
                 <div className="flex items-center gap-1.5 flex-wrap">
                     <span className="text-[10px] text-stone-400 font-medium">Button color:</span>
                     {REG_PRESET_COLORS.map(color => (
                         <button key={color} onClick={() => setRegNewLinkColor(regNewLinkColor === color ? '' : color)}
                             className="w-4 h-4 rounded-full flex-shrink-0 transition-all"
                             style={{ backgroundColor: color, outline: regNewLinkColor === color ? `2px solid ${color}` : '2px solid transparent', outlineOffset: '2px' }} />
                     ))}
                     <label className="relative w-4 h-4 rounded-full border border-dashed border-stone-300 cursor-pointer flex items-center justify-center hover:border-stone-500 transition-colors flex-shrink-0">
                         {regNewLinkColor && !REG_PRESET_COLORS.includes(regNewLinkColor) && <span className="absolute inset-0 rounded-full" style={{ backgroundColor: regNewLinkColor }} />}
                         <input type="color" className="absolute opacity-0 w-0 h-0" value={regNewLinkColor || '#000000'} onChange={e => setRegNewLinkColor(e.target.value)} />
                         {(!regNewLinkColor || REG_PRESET_COLORS.includes(regNewLinkColor)) && <span className="text-[7px] text-stone-400 font-bold">+</span>}
                     </label>
                     {regNewLinkColor && <button onClick={() => setRegNewLinkColor('')} className="text-[9px] text-stone-300 hover:text-red-400 underline transition-colors">×</button>}
                 </div>

                 {/* Section selector */}
                 {regSections.length > 0 && (
                     <select value={regNewLinkSectionId} onChange={e => setRegNewLinkSectionId(e.target.value)}
                         className="w-full border border-stone-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-stone-500 outline-none bg-white text-stone-600">
                         <option value="">No section</option>
                         {regSections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                     </select>
                 )}

                 <button onClick={handleRegAddLink} disabled={!regNewLinkTitle.trim() || (regNewLinkType !== 'SUPPORT' && !regNewLinkUrl.trim())}
                     className="w-full py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                     <Plus size={14}/> Add {regNewLinkType === 'DIGITAL_PRODUCT' ? 'Product' : regNewLinkType === 'SUPPORT' ? 'Tip Button' : 'Link'}
                 </button>
             </div>
             </div>

             {/* Section management */}
             <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4 space-y-2 mb-6">
                 <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Custom Sections</p>
                 {regSections.length > 0 && (
                     <div className="flex flex-wrap gap-2">
                         {regSections.map(s => (
                             <div key={s.id} className="flex items-center gap-1 bg-white border border-stone-200 rounded-full px-3 py-1 shadow-sm">
                                 <span className="text-xs font-medium text-stone-700">{s.title}</span>
                                 <button onClick={() => setRegSections(prev => prev.filter(r => r.id !== s.id))} className="text-stone-300 hover:text-red-400 ml-1"><X size={10}/></button>
                             </div>
                         ))}
                     </div>
                 )}
                 <div className="flex gap-2">
                     <input type="text" placeholder="New section name..." value={regNewSectionTitle} onChange={e => setRegNewSectionTitle(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && handleRegAddSection()}
                         className="flex-1 px-3 py-1.5 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-stone-400 outline-none bg-white" />
                     <button onClick={handleRegAddSection} disabled={!regNewSectionTitle.trim()}
                         className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-medium hover:bg-stone-700 disabled:opacity-40 transition-colors flex items-center gap-1">
                         <Plus size={12}/> Add
                     </button>
                 </div>
             </div>

             <div className="space-y-3">
                 <Button fullWidth onClick={handleCompleteSetup} isLoading={isLoading} size="lg">Save & Finish</Button>
                 <button onClick={() => setSetupPage(1)} className="w-full text-center text-stone-400 text-sm hover:text-stone-600 font-medium transition-colors">← Back</button>
                 <button onClick={handleSkipForNow} className="w-full text-center text-stone-300 hover:text-stone-500 text-xs font-medium transition-colors">Skip for now</button>
             </div>
             </>
             )}

          </div>

       {/* Setup Tutorial Overlay */}
       {showSetupTutorial && SETUP_TUTORIAL_STEPS[setupTutorialStep]?.page === setupPage && (() => {
         const stepValidation: Record<number, boolean> = {
           0: true,
           1: handle.trim().length > 0,
           2: true,
           3: true,
           4: bio.trim().length > 0,
           5: intakeInstructions.trim().length > 0,
           6: welcomeMessage.trim().length > 0,
           7: true,
           8: true,
         };
         const canProceed = stepValidation[setupTutorialStep] ?? true;

         // Dynamic positioning near the highlighted element
         const CARD_W = 340;
         const GAP = 12;
         const targetEl = setupTutorialRefs.current[setupTutorialStep];
         const rect = targetEl?.getBoundingClientRect();
         let cardStyle: React.CSSProperties;
         let arrowStyle: React.CSSProperties = {};
         let showArrowAbove = false;

         if (rect) {
           const centerX = rect.left + rect.width / 2;
           const rawLeft = centerX - CARD_W / 2;
           const clampedLeft = Math.max(8, Math.min(rawLeft, window.innerWidth - CARD_W - 8));
           const arrowLeft = Math.max(16, Math.min(centerX - clampedLeft - 8, CARD_W - 32));
           if (rect.bottom + GAP + 240 < window.innerHeight) {
             cardStyle = { top: rect.bottom + GAP, left: clampedLeft, width: CARD_W };
             showArrowAbove = true;
             arrowStyle = { left: arrowLeft };
           } else {
             cardStyle = { bottom: window.innerHeight - rect.top + GAP, left: clampedLeft, width: CARD_W };
             arrowStyle = { left: arrowLeft };
           }
         } else {
           cardStyle = { bottom: 24, left: '50%', transform: 'translateX(-50%)', width: `min(${CARD_W}px, calc(100vw - 32px))` };
         }

         return (
           <>
             <div className="fixed inset-0 bg-black/40 z-50" />
             <div className="fixed z-[70] bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-visible" style={cardStyle}>
               {rect && showArrowAbove && (
                 <div className="absolute -top-2 h-0 w-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-white" style={arrowStyle} />
               )}
               {rect && !showArrowAbove && (
                 <div className="absolute -bottom-2 h-0 w-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-white" style={arrowStyle} />
               )}
               <div className="h-1 bg-stone-100 rounded-t-2xl overflow-hidden">
                 <div className="h-full bg-amber-400 transition-all duration-300" style={{ width: `${((setupTutorialStep + 1) / SETUP_TUTORIAL_STEPS.length) * 100}%` }} />
               </div>
               <div className="p-5">
                 <div className="flex items-start justify-between mb-2">
                   <div className="flex items-center gap-2">
                     <span className="text-base">{SETUP_TUTORIAL_STEPS[setupTutorialStep].emoji}</span>
                     <span className="font-bold text-stone-900 text-sm">{SETUP_TUTORIAL_STEPS[setupTutorialStep].title}</span>
                   </div>
                   <span className="text-[11px] text-stone-400 font-medium shrink-0 ml-2">{setupTutorialStep + 1} / {SETUP_TUTORIAL_STEPS.length}</span>
                 </div>
                 <p className="text-sm text-stone-500 leading-relaxed mb-1">{SETUP_TUTORIAL_STEPS[setupTutorialStep].desc}</p>
                 {!canProceed && (
                   <p className="text-xs text-amber-600 font-medium mb-3">Please fill this in to continue.</p>
                 )}
                 {canProceed && <div className="mb-3" />}
                 <div className="flex items-center justify-between">
                   <button onClick={() => setShowSetupTutorial(false)} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                     Skip tutorial
                   </button>
                   <div className="flex items-center gap-3">
                     <div className="flex gap-1">
                       {SETUP_TUTORIAL_STEPS.map((_, i) => (
                         <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === setupTutorialStep ? 'w-4 bg-amber-500' : i < setupTutorialStep ? 'w-1.5 bg-amber-200' : 'w-1.5 bg-stone-200'}`} />
                       ))}
                     </div>
                     <button
                       onClick={canProceed ? handleSetupTutorialNext : undefined}
                       className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${canProceed ? 'bg-stone-900 text-white hover:bg-stone-700' : 'bg-stone-200 text-stone-400 cursor-not-allowed'}`}
                     >
                       {setupTutorialStep < SETUP_TUTORIAL_STEPS.length - 1 ? 'Next →' : 'Got it ✓'}
                     </button>
                   </div>
                 </div>
               </div>
             </div>
           </>
         );
       })()}
       </div>
    );
  }

  if (isForgotPassword) {
      return (
          <div className="min-h-screen bg-[#FAFAF9] relative flex flex-col items-center justify-center p-4 font-sans">
              <div className="relative z-10 w-full max-w-md">
                  <div className="bg-white p-8 rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100">
                      <h2 className="text-2xl font-bold text-stone-900 mb-2 text-center">{t('auth.resetPassword')}</h2>
                      <p className="text-stone-500 text-center mb-6">{t('auth.resetPasswordDesc')}</p>

                      <form onSubmit={handleForgotPassword} className="space-y-4">
                          <div>
                              <label className="block text-sm font-medium text-stone-700 mb-1.5 ml-1">{t('auth.emailAddress')}</label>
                              <div className="relative">
                                  <Mail className="absolute left-3.5 top-3 text-stone-400" size={18} />
                                  <input
                                      type="email"
                                      required
                                      className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-500 focus:border-stone-500 outline-none transition-all"
                                      placeholder={t('auth.emailPlaceholder')}
                                      value={email}
                                      onChange={(e) => setEmail(e.target.value)}
                                  />
                              </div>
                          </div>
                          <Button fullWidth size="lg" type="submit" isLoading={isLoading} className="mt-2 h-11 shadow-lg shadow-stone-900/20">
                              {t('auth.sendResetLink')}
                          </Button>
                      </form>

                      <div className="mt-6 text-center">
                          <button
                              onClick={() => setIsForgotPassword(false)}
                              className="text-sm font-semibold text-stone-500 hover:text-stone-700 transition-colors"
                          >
                              {t('auth.backToSignIn')}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9] relative flex flex-col items-center justify-center p-4 font-sans">
      <div className="relative z-10 w-full max-w-md">
        <div
          onClick={onBack}
          className="mb-8 flex justify-center items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <DiemLogo size={24} className="text-stone-800" />
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100">
          <h2 className="text-2xl font-bold text-stone-900 mb-2 text-center">
            {isSignUp ? t('auth.createAccountTitle') : t('auth.welcomeBack')}
          </h2>
          <p className="text-stone-500 text-center mb-6">
            {isSignUp ? t('auth.joinMarketplace') : t('auth.signInDashboard')}
          </p>

          <div className="space-y-5">
            {/* Role Selection */}
            <div className="grid grid-cols-2 gap-3 mb-2">
              <button
                type="button"
                onClick={() => setRole('CREATOR')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                  role === 'CREATOR'
                    ? 'bg-stone-50 border-stone-900 text-stone-900 ring-1 ring-stone-900'
                    : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                }`}
              >
                <User size={20} />
                <span className="text-sm font-semibold">{t('auth.imACreator')}</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('FAN')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                  role === 'FAN'
                    ? 'bg-amber-50 border-amber-600 text-amber-700 ring-1 ring-amber-600'
                    : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                }`}
              >
                <MessageSquare size={20} />
                <span className="text-sm font-semibold">{t('auth.imAFan')}</span>
              </button>
            </div>

            {/* Social Login Buttons */}
            <div className="grid grid-cols-1 gap-3">
                <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                disabled={isSocialLoading || isLoading}
                className="flex items-center justify-center gap-2 bg-white border border-stone-200 text-stone-700 font-medium py-2.5 rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-all"
                >
                <GoogleLogo className="w-5 h-5" />
                <span className="text-sm">{role === 'CREATOR' ? t('auth.logInAsCreator') : t('auth.logInAsFan')}</span>
                </button>
            </div>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-stone-400">{t('auth.orContinueWith')}</span>
              </div>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {isSignUp && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                  <label className="block text-sm font-medium text-stone-700 mb-1.5 ml-1">{t('auth.fullName')}</label>
                  <input
                    type="text"
                    required={isSignUp}
                    className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-500 focus:border-stone-500 outline-none transition-all"
                    placeholder={role === 'CREATOR' ? t('auth.creatorName') : t('auth.yourName')}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              )}

              <div className="animate-in fade-in zoom-in-95 duration-200">
                <label className="block text-sm font-medium text-stone-700 mb-1.5 ml-1">{t('auth.emailAddress')}</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 text-stone-400" size={18} />
                  <input
                    type="email"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-500 focus:border-stone-500 outline-none transition-all"
                    placeholder={t('auth.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5 ml-1">
                    <label className="block text-sm font-medium text-stone-700">{t('auth.password')}</label>
                    {!isSignUp && (
                        <button
                            type="button"
                            onClick={() => setIsForgotPassword(true)}
                            className="text-xs font-semibold text-stone-500 hover:text-stone-700"
                        >
                            {t('auth.forgotPassword')}
                        </button>
                    )}
                </div>
                <div className="relative">
                   <Lock className="absolute left-3.5 top-3 text-stone-400" size={18} />
                   <input
                    type="password"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-500 focus:border-stone-500 outline-none transition-all"
                    placeholder={t('auth.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <Button
                fullWidth
                size="lg"
                type="submit"
                isLoading={isLoading}
                className={`mt-2 h-11 shadow-lg ${role === 'FAN' ? 'shadow-amber-500/20 bg-amber-600 hover:bg-amber-700' : 'shadow-stone-900/20'}`}
                disabled={isSocialLoading}
              >
                {isSignUp
                  ? (role === 'CREATOR' ? t('common.continue') : t('auth.createFanAccountBtn'))
                  : (role === 'CREATOR' ? t('auth.creatorSignIn') : t('auth.fanSignIn'))
                }
              </Button>
            </form>

            {showResend && (
                <button onClick={handleResend} className="w-full text-center text-xs text-stone-600 hover:underline mt-2">
                    {t('auth.resendEmail')}
                </button>
            )}
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-stone-500">
              {isSignUp ? t('auth.alreadyHaveAccount') : t('auth.dontHaveAccount')}
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setEmail('');
                  setPassword('');
                }}
                className={`ml-1.5 font-semibold transition-colors ${role === 'FAN' ? 'text-amber-600 hover:text-amber-700' : 'text-stone-700 hover:text-stone-900'}`}
              >
                {isSignUp ? t('common.signIn') : t('common.signUp')}
              </button>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
             <button onClick={onBack} className="text-stone-400 hover:text-stone-600 text-sm transition-colors">
               {t('auth.backToHome')}
             </button>
        </div>
      </div>
    </div>
  );
};
