import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { DiemLogo, CheckCircle2, Lock, GoogleLogo, InstagramLogo, Mail, User, MessageSquare, Camera, X, Plus, YouTubeLogo, XLogo, TikTokLogo, Twitch, Check, Phone } from './Icons';
import { CurrentUser } from '../types';
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

  // Setup / Onboarding State
  const [step, setStep] = useState<'LOGIN' | 'SETUP_PROFILE' | 'RESET_PASSWORD'>(initialStep);
  const [tempUser, setTempUser] = useState<CurrentUser | null>(currentUser || null);

  // Creator Config
  const [price, setPrice] = useState(20);
  const [responseHours, setResponseHours] = useState(48);
  const [platforms, setPlatforms] = useState<(string | { id: string, url: string })[]>([]);
  const [handle, setHandle] = useState('');

  // Shared Profile Config
  const [displayName, setDisplayName] = useState(currentUser?.name || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newPassword, setNewPassword] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
        // Determine Identifier
        const identifier = email.trim();

        // Only pass name if signing up. This tells the backend to use the SignUp flow.
        const user = await loginUser(role, identifier, password, 'EMAIL', isSignUp ? fullName.trim() : undefined);

        if (isSignUp) {
            setTempUser(user);
            setDisplayName(fullName); // Pre-fill display name
            setStep('SETUP_PROFILE');
        } else {
            onLoginSuccess(user);
        }
    } catch (error: any) {
        if (error.message === "CONFIRMATION_REQUIRED") {
            alert(t('auth.confirmationSent'));
            setIsSignUp(false); // Switch back to login mode so they are ready to sign in after clicking link
            setShowResend(true);
        } else {
            console.error("Login Error:", error);
            let msg = error.message || t('auth.loginFailed');
            if (msg.includes("timed out") || error.name === 'AuthRetryableFetchError' || error.status === 504) {
                msg = t('auth.connectionTimeout');
            }
            alert(msg);
        }
    } finally {
        setIsLoading(false);
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
    localStorage.setItem('bluechecked_skip_setup', 'true');
    if (tempUser) {
      onLoginSuccess(tempUser);
    }
  };

  const handleCompleteSetup = async () => {
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
        if (!handle.trim()) {
            alert("User ID (Handle) is required.");
            setIsLoading(false);
            return;
        }

        try {
            const currentProfile = await getCreatorProfile();
            // We update the newly created blank profile with the setup details
            await updateCreatorProfile({
                ...currentProfile,
                displayName: finalUser.name,
                handle: handle.startsWith('@') ? handle : `@${handle}`,
                bio: bio || currentProfile.bio,
                avatarUrl: finalUser.avatarUrl || currentProfile.avatarUrl,
                pricePerMessage: price,
                responseWindowHours: responseHours,
                platforms: platforms.length > 0 ? platforms : (currentProfile.platforms || [])
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
     localStorage.setItem('bluechecked_skip_setup', 'true');

     if (finalUser) {
         onLoginSuccess(finalUser);
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

  if (step === 'SETUP_PROFILE') {
    return (
       <div className="min-h-screen bg-[#FAFAF9] flex flex-col items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white p-8 rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100 animate-in slide-in-from-bottom-4 duration-500">
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
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                />
                <h2 className="text-2xl font-bold text-stone-900">
                    {role === 'CREATOR' ? t('auth.setupCreatorProfile') : t('auth.completeProfile')}
                </h2>
                <p className="text-stone-500 text-sm">{t('auth.profileStandOut')}</p>
             </div>

             <div className="space-y-6">

                {/* Name Field */}
                <div>
                   <label className="block text-sm font-medium text-stone-700 mb-1">{t('auth.displayName')}</label>
                   <input
                     type="text"
                     value={displayName}
                     onChange={e => setDisplayName(e.target.value)}
                     placeholder={t('auth.yourName')}
                     className="w-full border border-stone-200 rounded-xl p-3 focus:ring-2 focus:ring-stone-500 outline-none transition-all"
                    />
                </div>

                {/* Common Fields */}
                <div>
                   <label className="block text-sm font-medium text-stone-700 mb-1">{t('auth.bioAbout')}</label>
                   <textarea
                     value={bio}
                     onChange={e => setBio(e.target.value)}
                     placeholder={role === 'CREATOR' ? t('auth.creatorBioPlaceholder') : t('auth.fanBioPlaceholder')}
                     className="w-full border border-stone-200 rounded-xl p-3 h-24 focus:ring-2 focus:ring-stone-500 outline-none resize-none transition-all"
                    />
                </div>

                {/* Creator Specific Fields */}
                {role === 'CREATOR' && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">User ID (Handle)</label>
                            <input 
                                type="text" 
                                value={handle} 
                                onChange={e => setHandle(e.target.value)} 
                                placeholder="@username"
                                className="w-full border border-stone-200 rounded-xl p-3 focus:ring-2 focus:ring-stone-500 outline-none transition-all" 
                            />
                            {handle && (
                                <p className="text-[10px] text-stone-400 mt-1 ml-1">
                                    Your public page: <span className="font-mono text-stone-600">{window.location.host}/{handle.replace('@', '')}</span>
                                </p>
                            )}
                        </div>
                        <div className="bg-stone-50 p-5 rounded-2xl border border-stone-100 space-y-4">
                            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide flex items-center gap-2">
                                <MessageSquare size={16} className="text-stone-500"/> {t('auth.messageSettings')}
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">{t('auth.priceLabel')}</label>
                                    <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full border border-stone-200 rounded-xl p-2 focus:ring-2 focus:ring-stone-500 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">{t('auth.replyTime')}</label>
                                    <select value={responseHours} onChange={e => setResponseHours(Number(e.target.value))} className="w-full border border-stone-200 rounded-xl p-2 bg-white focus:ring-2 focus:ring-stone-500 outline-none transition-all">
                                        <option value={24}>{t('auth.hours24')}</option>
                                        <option value={48}>{t('auth.hours48')}</option>
                                        <option value={72}>{t('auth.hours72')}</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">{t('auth.connectedPlatforms')}</label>
                            <p className="text-xs text-stone-500 mb-3">{t('auth.platformsDesc')}</p>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {SUPPORTED_PLATFORMS.map(platform => {
                                    const platformData = platforms.find(p => (typeof p === 'string' ? p : p.id) === platform.id);
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
                        </div>
                    </>
                )}

                <div className="space-y-3 pt-4">
                    <Button fullWidth onClick={handleCompleteSetup} isLoading={isLoading} size="lg">{t('auth.saveProfileContinue')}</Button>
                    <button onClick={handleSkipForNow} className="w-full text-center text-stone-400 text-sm hover:text-stone-600 font-medium transition-colors">
                        {t('auth.skipForNow')}
                    </button>
                    <button onClick={onBack} className="w-full text-center text-stone-300 hover:text-red-500 text-xs font-medium transition-colors mt-2">
                        {t('auth.cancelSignOut')}
                    </button>
                </div>
             </div>
          </div>
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
          <DiemLogo size={80} className="text-stone-800" />
          <span className="font-semibold text-lg tracking-tight text-stone-800">diem</span>
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
