import React, { useState, useRef } from 'react';
import { Button } from './Button';
import { BlueCheckLogo, CheckCircle2, Lock, GoogleLogo, InstagramLogo, Mail, User, MessageSquare, Camera, X, Plus, YouTubeLogo, XLogo, TikTokLogo, Twitch, Check, Phone } from './Icons';
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
            alert("Confirmation email sent! Please check your inbox (and spam folder) and click the link to activate your account.");
            setIsSignUp(false); // Switch back to login mode so they are ready to sign in after clicking link
            setShowResend(true);
        } else {
            console.error("Login Error:", error);
            let msg = error.message || "Login failed. Please try again.";
            if (msg.includes("timed out") || error.name === 'AuthRetryableFetchError' || error.status === 504) {
                msg = "Connection Timeout: The email service is not responding. Please check Supabase SMTP settings.";
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
            alert(`Login Failed: The '${provider}' provider is not enabled in your Supabase Project.\n\nPlease go to Authentication > Providers in your Supabase Dashboard to enable it.`);
        } else if (errorMessage.includes("missing OAuth secret")) {
            alert(`Login Failed: The '${provider}' provider is missing its Client Secret in Supabase.\n\nPlease go to Authentication > Providers, enter the Client Secret, and click Save.`);
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
        alert("Confirmation email resent! Please check your inbox.");
    } catch (e: any) {
        alert(e.message || "Failed to resend email.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleTogglePlatform = (platformId: string) => {
      const existingIndex = platforms.findIndex(p => (typeof p === 'string' ? p : p.id) === platformId);
      if (existingIndex >= 0) {
          setPlatforms(prev => prev.filter((_, i) => i !== existingIndex));
      } else {
          const url = window.prompt(`Enter URL for ${platformId}:`);
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
        try {
            const currentProfile = await getCreatorProfile();
            // We update the newly created blank profile with the setup details
            await updateCreatorProfile({
                ...currentProfile,
                displayName: finalUser.name,
                bio: bio || currentProfile.bio,
                avatarUrl: finalUser.avatarUrl || currentProfile.avatarUrl,
                pricePerMessage: price,
                responseWindowHours: responseHours,
                platforms: platforms.length > 0 ? platforms : (currentProfile.platforms || [])
            });
        } catch (e) {
            console.error(e);
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
          alert("Please enter your email address.");
          return;
      }
      setIsLoading(true);
      try {
          await sendPasswordResetEmail(email.trim());
          alert("Password reset email sent! Please check your inbox.");
          setIsForgotPassword(false);
      } catch (error: any) {
          console.error("Reset Password Error:", error);
          alert(error.message || "Failed to send reset email.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword.length < 6) {
          alert("Password must be at least 6 characters.");
          return;
      }
      setIsLoading(true);
      try {
          await updatePassword(newPassword);
          alert("Password updated successfully! Please log in again.");
          
          await signOut();
          onBack();
      } catch (error: any) {
          console.error("Update Password Error:", error);
          alert(error.message || "Failed to update password.");
      } finally {
          setIsLoading(false);
      }
  };

  if (step === 'RESET_PASSWORD') {
      return (
          <div className="min-h-screen bg-[#FAFAF9] relative flex flex-col items-center justify-center p-4 font-sans">
              <div className="relative z-10 w-full max-w-md bg-white p-8 rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100">
                  <h2 className="text-2xl font-bold text-stone-900 mb-2 text-center">Set New Password</h2>
                  <form onSubmit={handleUpdatePassword} className="space-y-4 mt-6">
                      <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1.5 ml-1">New Password</label>
                          <input type="password" required className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-500 outline-none transition-all" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                      </div>
                      <Button fullWidth size="lg" type="submit" isLoading={isLoading}>Update Password</Button>
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
                        <span className="text-white text-xs font-bold">Upload</span>
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
                    {role === 'CREATOR' ? 'Setup Creator Profile' : 'Complete Profile'}
                </h2>
                <p className="text-stone-500 text-sm">Let's make your profile stand out.</p>
             </div>

             <div className="space-y-6">

                {/* Name Field */}
                <div>
                   <label className="block text-sm font-medium text-stone-700 mb-1">Display Name</label>
                   <input
                     type="text"
                     value={displayName}
                     onChange={e => setDisplayName(e.target.value)}
                     placeholder="Your Name"
                     className="w-full border border-stone-200 rounded-xl p-3 focus:ring-2 focus:ring-stone-500 outline-none transition-all"
                    />
                </div>

                {/* Common Fields */}
                <div>
                   <label className="block text-sm font-medium text-stone-700 mb-1">Bio / About</label>
                   <textarea
                     value={bio}
                     onChange={e => setBio(e.target.value)}
                     placeholder={role === 'CREATOR' ? "I help startups with..." : "Tell us a bit about yourself..."}
                     className="w-full border border-stone-200 rounded-xl p-3 h-24 focus:ring-2 focus:ring-stone-500 outline-none resize-none transition-all"
                    />
                </div>

                {/* Creator Specific Fields */}
                {role === 'CREATOR' && (
                    <>
                        <div className="bg-stone-50 p-5 rounded-2xl border border-stone-100 space-y-4">
                            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide flex items-center gap-2">
                                <MessageSquare size={16} className="text-stone-500"/> Message Settings
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Price ($)</label>
                                    <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full border border-stone-200 rounded-xl p-2 focus:ring-2 focus:ring-stone-500 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Reply Time</label>
                                    <select value={responseHours} onChange={e => setResponseHours(Number(e.target.value))} className="w-full border border-stone-200 rounded-xl p-2 bg-white focus:ring-2 focus:ring-stone-500 outline-none transition-all">
                                        <option value={24}>24 Hours</option>
                                        <option value={48}>48 Hours</option>
                                        <option value={72}>72 Hours</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">Connected Platforms</label>
                            <p className="text-xs text-stone-500 mb-3">Select the platforms where you have an audience.</p>

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
                    <Button fullWidth onClick={handleCompleteSetup} isLoading={isLoading} size="lg">Save Profile & Continue</Button>
                    <button onClick={handleSkipForNow} className="w-full text-center text-stone-400 text-sm hover:text-stone-600 font-medium transition-colors">
                        Skip for now
                    </button>
                    <button onClick={onBack} className="w-full text-center text-stone-300 hover:text-red-500 text-xs font-medium transition-colors mt-2">
                        Cancel & Sign Out
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
                      <h2 className="text-2xl font-bold text-stone-900 mb-2 text-center">Reset Password</h2>
                      <p className="text-stone-500 text-center mb-6">Enter your email to receive a reset link.</p>

                      <form onSubmit={handleForgotPassword} className="space-y-4">
                          <div>
                              <label className="block text-sm font-medium text-stone-700 mb-1.5 ml-1">Email Address</label>
                              <div className="relative">
                                  <Mail className="absolute left-3.5 top-3 text-stone-400" size={18} />
                                  <input
                                      type="email"
                                      required
                                      className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-500 focus:border-stone-500 outline-none transition-all"
                                      placeholder="you@example.com"
                                      value={email}
                                      onChange={(e) => setEmail(e.target.value)}
                                  />
                              </div>
                          </div>
                          <Button fullWidth size="lg" type="submit" isLoading={isLoading} className="mt-2 h-11 shadow-lg shadow-stone-900/20">
                              Send Reset Link
                          </Button>
                      </form>

                      <div className="mt-6 text-center">
                          <button
                              onClick={() => setIsForgotPassword(false)}
                              className="text-sm font-semibold text-stone-500 hover:text-stone-700 transition-colors"
                          >
                              Back to Sign In
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
          <BlueCheckLogo size={28} className="text-stone-800" />
          <span className="font-semibold text-lg tracking-tight text-stone-800">bluechecked</span>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100">
          <h2 className="text-2xl font-bold text-stone-900 mb-2 text-center">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-stone-500 text-center mb-6">
            {isSignUp ? 'Join the guaranteed response marketplace.' : 'Sign in to access your dashboard.'}
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
                <span className="text-sm font-semibold">I'm a Creator</span>
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
                <span className="text-sm font-semibold">I'm a Fan</span>
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
                <span className="text-sm">{role === 'CREATOR' ? 'Log in as Creator' : 'Log in as Fan'}</span>
                </button>
            </div>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-stone-400">Or continue with</span>
              </div>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {isSignUp && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                  <label className="block text-sm font-medium text-stone-700 mb-1.5 ml-1">Full Name</label>
                  <input
                    type="text"
                    required={isSignUp}
                    className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-500 focus:border-stone-500 outline-none transition-all"
                    placeholder={role === 'CREATOR' ? "Creator Name" : "Your Name"}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              )}

              <div className="animate-in fade-in zoom-in-95 duration-200">
                <label className="block text-sm font-medium text-stone-700 mb-1.5 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 text-stone-400" size={18} />
                  <input
                    type="email"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-500 focus:border-stone-500 outline-none transition-all"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5 ml-1">
                    <label className="block text-sm font-medium text-stone-700">Password</label>
                    {!isSignUp && (
                        <button
                            type="button"
                            onClick={() => setIsForgotPassword(true)}
                            className="text-xs font-semibold text-stone-500 hover:text-stone-700"
                        >
                            Forgot Password?
                        </button>
                    )}
                </div>
                <div className="relative">
                   <Lock className="absolute left-3.5 top-3 text-stone-400" size={18} />
                   <input
                    type="password"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-500 focus:border-stone-500 outline-none transition-all"
                    placeholder="••••••••"
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
                  ? (role === 'CREATOR' ? 'Continue' : 'Create Fan Account')
                  : (role === 'CREATOR' ? 'Creator Sign In' : 'Fan Sign In')
                }
              </Button>
            </form>

            {showResend && (
                <button onClick={handleResend} className="w-full text-center text-xs text-stone-600 hover:underline mt-2">
                    Didn't receive the email? Click to resend.
                </button>
            )}
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-stone-500">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setEmail('');
                  setPassword('');
                }}
                className={`ml-1.5 font-semibold transition-colors ${role === 'FAN' ? 'text-amber-600 hover:text-amber-700' : 'text-stone-700 hover:text-stone-900'}`}
              >
                {isSignUp ? 'Sign in' : 'Sign up'}
              </button>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
             <button onClick={onBack} className="text-stone-400 hover:text-stone-600 text-sm transition-colors">
               &larr; Back to Home
             </button>
        </div>
      </div>
    </div>
  );
};
