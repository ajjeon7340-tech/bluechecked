
import React, { useState, useEffect, useRef } from 'react';
import { CreatorPublicProfile } from './components/CreatorPublicProfile';
import { CreatorDashboard } from './components/CreatorDashboard';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { FanDashboard } from './components/FanDashboard';
import { TermsOfService } from './components/TermsOfService';
import { BoardDashboard } from './components/BoardDashboard';
import { getCreatorProfile, getCreatorProfileByHandle, checkAndSyncSession, completeOAuthSignup, signOut, subscribeToAuthChanges, getDiemPublicProfileId } from './services/realBackend';
import { CreatorProfile, CurrentUser, UserRole } from './types';
import { DiemLogo } from './components/Icons';
import { useTranslation } from 'react-i18next';

type PageState = 'LANDING' | 'LOGIN' | 'DASHBOARD' | 'PROFILE' | 'FAN_DASHBOARD' | 'SETUP_PROFILE' | 'TERMS' | 'BOARD_DASHBOARD';

function App() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState<PageState>('LANDING');
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoadingUI, setShowLoadingUI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignUpConfirm, setShowSignUpConfirm] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [pendingOAuthRole, setPendingOAuthRole] = useState<UserRole | null>(null);
  const [showOAuthTerms, setShowOAuthTerms] = useState(false);
  const [oauthTermsScrolled, setOauthTermsScrolled] = useState(false);
  const [startProfileTutorial, setStartProfileTutorial] = useState(false);
  const [pendingLoginRole, setPendingLoginRole] = useState<'CREATOR' | 'FAN'>('CREATOR');

  const currentUserRef = useRef<CurrentUser | null>(null);
  useEffect(() => {
      currentUserRef.current = currentUser;
  }, [currentUser]);

  // Only show the loading UI after 300ms — fast loads skip the spinner entirely
  useEffect(() => {
      if (!isLoading) { setShowLoadingUI(false); return; }
      const t = setTimeout(() => setShowLoadingUI(true), 300);
      return () => clearTimeout(t);
  }, [isLoading]);

  const loadCreatorData = async (specificCreatorId?: string, stopLoading = true): Promise<CreatorProfile | null> => {
    try {
      // Don't set isLoading(true) here to avoid flashing the loading screen on background refreshes
      setError(null);
      
      // Fetch Creator Profile AND Refresh User Session (to update credits)
      const userData = await checkAndSyncSession();
      if (userData) {
          setCurrentUser(userData);
      } else {
          // Session is invalid (e.g. user deleted from DB), clear local state
          setCurrentUser(null);
          localStorage.removeItem('diem_current_user');
      }

      try {
        const creatorData = await getCreatorProfile(specificCreatorId);
        setCreator(creatorData);
        localStorage.setItem('diem_cached_creator', JSON.stringify(creatorData));
        return creatorData;
      } catch (e: any) {
        // Only ignore error if we are NOT looking for a specific creator (i.e. app init)
        // BUT if we are logged in as a CREATOR, we expect to find our profile, so don't ignore.
        const role = userData?.role || currentUserRef.current?.role;
        if (!specificCreatorId && role !== 'CREATOR') {
             console.warn("No creator profile found (DB might be empty). App running in setup mode.");
             setCreator(null);
             return null;
        }
        throw e;
      }

    } catch (err: any) {
      if (err.code === 'PROFILE_MISSING') {
          const _sr = localStorage.getItem('diem_oauth_role') as UserRole | null;
          if (_sr === 'CREATOR' || _sr === 'FAN') { setPendingOAuthRole(_sr); setOauthTermsScrolled(false); setShowOAuthTerms(true); }
          else { setShowSignUpConfirm(true); }
          if (stopLoading) setIsLoading(false);
          return null;
      }
      console.error("Failed to load creator:", err);
      setError(err.message || "Failed to load application data. Please ensure the database is seeded.");
      return null;
    } finally {
      if (stopLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    // Handle Browser Back Button
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      const user = currentUserRef.current;
      if (state && state.page) {
        if (state.page === 'PROFILE' && state.creatorId) {
             setIsLoading(true);
             loadCreatorData(state.creatorId);
        } else if (state.page === 'DASHBOARD' && user?.role === 'CREATOR') {
             setIsLoading(true);
             loadCreatorData(user.id);
        }
        setCurrentPage(state.page);
      } else {
        // No state means we've hit the edge of app history.
        // Instead of leaving the app, push back to the appropriate home page.
        const homePage = user
          ? (user.role === 'CREATOR' ? 'DASHBOARD' : 'FAN_DASHBOARD')
          : 'LANDING';
        window.history.pushState({ page: homePage }, '', homePage === 'LANDING' ? '/' : '/dashboard');
        setCurrentPage(homePage);
      }
    };

    window.addEventListener('popstate', handlePopState);

    // Listen for Password Recovery Event
    const authSubscription = subscribeToAuthChanges((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            setIsPasswordRecovery(true);
        }
    });

    // Check for existing session
    const initSession = async () => {
        // Fast path: restore from cache to show page immediately
        try {
            const cachedUserStr = localStorage.getItem('diem_current_user');
            if (cachedUserStr) {
                const cachedUser = JSON.parse(cachedUserStr);
                setCurrentUser(cachedUser);
                if (cachedUser.role === 'CREATOR') {
                    const cachedCreatorStr = localStorage.getItem('diem_cached_creator');
                    if (cachedCreatorStr) {
                        setCreator(JSON.parse(cachedCreatorStr));
                        setCurrentPage('DASHBOARD');
                        setIsLoading(false);
                    }
                } else {
                    setCurrentPage('FAN_DASHBOARD');
                    setIsLoading(false);
                }
            }
        } catch { /* ignore stale cache errors */ }

        try {
            // 1. Check URL for Creator Handle (e.g. diem.ee/alexcode)
            const path = window.location.pathname;
            const potentialHandle = path.substring(1); // remove leading /
            const isSystemRoute = ['login', 'dashboard', 'setup', 'reset-password', 'terms', 'dashboard-test'].some(route =>
                potentialHandle.toLowerCase() === route || potentialHandle.toLowerCase().startsWith(route + '/')
            );

            if (path === '/dashboard-test') {
                const user = await checkAndSyncSession();
                if (user) {
                    setCurrentUser(user);
                    if (user.role === 'CREATOR') {
                        await loadCreatorData(user.id, false);
                    }
                }
                setCurrentPage('BOARD_DASHBOARD');
                setIsLoading(false);
                return;
            }

            if (path === '/terms') {
                setCurrentPage('TERMS');
                setIsLoading(false);
                return;
            }

            if (potentialHandle && !isSystemRoute && path !== '/') {
                try {
                    const profile = await getCreatorProfileByHandle(potentialHandle);
                    setCreator(profile);
                    setCurrentPage('PROFILE');
                    
                    // Also sync session in background
                    const user = await checkAndSyncSession();
                    if (user) setCurrentUser(user);
                    
                    setIsLoading(false);
                    return;
                } catch (e) {
                    console.log("Not a creator handle, checking session...");
                }
            }

            const user = await checkAndSyncSession();
            if (user) {
                localStorage.setItem('diem_current_user', JSON.stringify(user));
                setCurrentUser(user);

                // If the user came from a creator's profile page, return them there
                const returnToCreator = localStorage.getItem('diem_return_to_creator');
                if (returnToCreator) {
                    localStorage.removeItem('diem_return_to_creator');
                    try {
                        const profile = await getCreatorProfileByHandle(returnToCreator);
                        setCreator(profile);
                        window.history.replaceState({ page: 'PROFILE', creatorId: profile.id }, '', `/${returnToCreator}`);
                        setCurrentPage('PROFILE');
                        setIsLoading(false);
                        return;
                    } catch (e) {
                        // Creator not found — fall through to normal navigation
                    }
                }

                if (user.role === 'CREATOR') {
                    const profile = await loadCreatorData(user.id, false);

                    if (!profile) {
                        setIsLoading(false);
                        return;
                    }

                    localStorage.setItem('diem_cached_creator', JSON.stringify(profile));

                    // Check if profile setup is needed (empty bio is a good indicator of fresh account)
                    const hasSkippedSetup = localStorage.getItem('diem_skip_setup') === 'true';
                    if (profile && !profile.bio && !hasSkippedSetup) {
                        setCurrentPage('SETUP_PROFILE');
                        window.history.replaceState({ page: 'SETUP_PROFILE' }, '', '');
                    } else {
                        setCurrentPage('DASHBOARD');
                        if (!window.location.pathname.startsWith('/dashboard')) {
                            window.history.replaceState({ page: 'DASHBOARD' }, '', '/dashboard');
                        }
                    }
                    setIsLoading(false);
                } else {
                    // Fan Dashboard
                    setCurrentPage('FAN_DASHBOARD');
                    if (!window.location.pathname.startsWith('/dashboard')) {
                        window.history.replaceState({ page: 'FAN_DASHBOARD' }, '', '/dashboard');
                    }
                    setIsLoading(false);
                }
            } else {
                // Session invalid — clear any stale cache
                localStorage.removeItem('diem_current_user');
                localStorage.removeItem('diem_cached_creator');
                window.history.replaceState({ page: 'LANDING' }, '', '/');
                setIsLoading(false);
            }
        } catch (err: any) {
            if (err.code === 'PROFILE_MISSING') {
                const _sr = localStorage.getItem('diem_oauth_role') as UserRole | null;
                if (_sr === 'CREATOR' || _sr === 'FAN') { setPendingOAuthRole(_sr); setOauthTermsScrolled(false); setShowOAuthTerms(true); }
                else { setShowSignUpConfirm(true); }
            } else if (err.code === 'ROLE_MISMATCH') {
                alert(err.message);
                clearSessionCache();
                await signOut();
                window.history.replaceState({ page: 'LANDING' }, '', '/');
                setCurrentPage('LANDING');
            } else {
                // Handle generic errors (e.g. Network, DB) by showing the Error UI
                console.error("Session initialization failed:", err);
                setError(err.message || "Failed to initialize session.");
            }
            setIsLoading(false);
        }
    };
    initSession();
    return () => {
        window.removeEventListener('popstate', handlePopState);
        authSubscription.unsubscribe();
    };
  }, []); // Removed currentUser dependency to prevent infinite loop

  // Redirect to Landing if we are on a creator page but have no creator data (e.g. empty DB)
  useEffect(() => {
    if (!isLoading && !creator) {
      if (currentPage === 'DASHBOARD' || currentPage === 'PROFILE') {
        setCurrentPage('LANDING');
      }
    }
  }, [isLoading, creator, currentPage]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9] text-stone-900 p-4">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold text-stone-900">Connection Error</h2>
        <p className="text-stone-600">{error}</p>
        <div className="bg-stone-50 p-4 rounded-2xl text-sm text-stone-500 text-left border border-stone-100">
            <p className="font-bold mb-1">Troubleshooting:</p>
            <ul className="list-disc pl-4 space-y-1">
                <li>Check your internet connection</li>
                <li>Ensure Supabase project is active</li>
                <li>Run the database seed script in Supabase SQL Editor</li>
            </ul>
        </div>
        <button
          onClick={() => loadCreatorData()}
          className="px-6 py-3 bg-stone-900 text-white rounded-full font-medium hover:bg-stone-800 transition-colors shadow-lg shadow-stone-900/20"
        >
          Retry Connection
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    if (!showLoadingUI) return null;
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9]" style={{ animation: 'fadeIn 0.3s ease both' }}>
        <div className="flex flex-col items-center gap-4">
          <DiemLogo size={32} />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-sm font-semibold text-stone-700">Carpe Diem</span>
            <span className="text-xs text-stone-400">Seize your day from your favorite creator</span>
          </div>
        </div>
      </div>
    );
  }

  const navigateToDashboard = async (user: CurrentUser) => {
      // If the user came from a creator's profile page, return them there
      const returnToCreator = localStorage.getItem('diem_return_to_creator');
      if (returnToCreator) {
          localStorage.removeItem('diem_return_to_creator');
          try {
              setIsLoading(true);
              const profile = await getCreatorProfileByHandle(returnToCreator);
              setCreator(profile);
              window.history.replaceState({ page: 'PROFILE', creatorId: profile.id }, '', `/${returnToCreator}`);
              setCurrentPage('PROFILE');
              setIsLoading(false);
              return;
          } catch (e) {
              // Creator not found — fall through to normal navigation
          }
      }

      if (user.role === 'CREATOR') {
          setIsLoading(true);
          const profile = await loadCreatorData(user.id, false);

          if (!profile) {
              setIsLoading(false);
              return;
          }

          localStorage.setItem('diem_cached_creator', JSON.stringify(profile));
          localStorage.setItem('diem_current_user', JSON.stringify(user));

          const hasSkippedSetup = localStorage.getItem('diem_skip_setup') === 'true';
          if (!profile.bio && !hasSkippedSetup) {
              window.history.replaceState({ page: 'SETUP_PROFILE' }, '', '');
              setCurrentPage('SETUP_PROFILE');
          } else {
              window.history.replaceState({ page: 'DASHBOARD' }, '', '');
              setCurrentPage('DASHBOARD');
          }
          setIsLoading(false);
      } else {
          localStorage.setItem('diem_current_user', JSON.stringify(user));
          // New fan: navigate to Diem's profile with tutorial
          const tutorialDoneKey = `diem_fan_tutorial_done_${user.id}`;
          const isNewFan = !localStorage.getItem(tutorialDoneKey);
          if (isNewFan) {
              const diemId = await getDiemPublicProfileId();
              if (diemId) {
                  setIsLoading(true);
                  const profile = await loadCreatorData(diemId, false);
                  if (profile) {
                      const handle = (profile.handle && profile.handle !== '@user')
                          ? profile.handle.replace('@', '')
                          : profile.displayName;
                      window.history.replaceState({ page: 'PROFILE', creatorId: diemId }, '', `/${handle}`);
                      setStartProfileTutorial(true);
                      setCurrentPage('PROFILE');
                      setIsLoading(false);
                      return;
                  }
                  setIsLoading(false);
              }
          }
          window.history.replaceState({ page: 'FAN_DASHBOARD' }, '', '');
          setCurrentPage('FAN_DASHBOARD');
      }
  };

  const clearSessionCache = () => {
      localStorage.removeItem('diem_current_user');
      localStorage.removeItem('diem_cached_creator');
  };

  const handleLoginSuccess = async (user: CurrentUser) => {
    setCurrentUser(user);
    await navigateToDashboard(user);
  };

  const handleCreatorSelect = async (creatorId: string) => {
    try {
      setIsLoading(true);
      const profile = await loadCreatorData(creatorId, false);
      if (profile) {
          const handle = (profile.handle && profile.handle !== '@user') 
              ? profile.handle.replace('@', '') 
              : profile.displayName;
          window.history.pushState({ page: 'PROFILE', creatorId }, '', `/${handle}`);
      } else {
          window.history.pushState({ page: 'PROFILE', creatorId }, '', '');
      }
      setCurrentPage('PROFILE');
      setIsLoading(false);
    } catch (e) {
      setIsLoading(false);
    }
  };

  const handleConfirmSignUp = async (role: UserRole) => {
      setIsLoading(true);
      try {
          const user = await completeOAuthSignup(role);
          handleLoginSuccess(user);
          setShowSignUpConfirm(false);
      } catch (e) {
          console.error(e);
          alert("Failed to create account.");
          await handleCancelSignUp();
      } finally {
          setIsLoading(false);
      }
  };

  const handleCancelSignUp = async () => {
      clearSessionCache();
      await signOut();
      setShowSignUpConfirm(false);
      setCurrentPage('LANDING');
  };

  return (
    <div className="font-sans text-stone-900">
      
      {currentPage === 'TERMS' && (
        <TermsOfService
          onBack={() => {
            window.history.pushState({ page: 'LANDING' }, '', '/');
            setCurrentPage('LANDING');
          }}
        />
      )}


      {currentPage === 'BOARD_DASHBOARD' && (
        <BoardDashboard
          creator={creator}
          currentUser={currentUser}
          onBack={() => {
            if (currentUser?.role === 'CREATOR') {
              window.history.pushState({ page: 'DASHBOARD' }, '', '/dashboard');
              setCurrentPage('DASHBOARD');
            } else {
              window.history.pushState({ page: 'LANDING' }, '', '/');
              setCurrentPage('LANDING');
            }
          }}
          onLogout={async () => {
            clearSessionCache();
            await signOut();
            setCurrentUser(null);
            window.history.pushState({ page: 'LANDING' }, '', '/');
            setCurrentPage('LANDING');
          }}
        />
      )}

      {currentPage === 'LANDING' && (
        <LandingPage
          onLoginClick={() => {
              window.history.pushState({ page: 'LOGIN' }, '', '/login');
              setCurrentPage('LOGIN');
          }}
          onDemoClick={async () => {
            const diemId = await getDiemPublicProfileId();
            const targetId = diemId || creator?.id;
            if (targetId) {
                setIsLoading(true);
                const profile = await loadCreatorData(targetId, false);
                if (profile) {
                    const handle = (profile.handle && profile.handle !== '@user')
                        ? profile.handle.replace('@', '')
                        : profile.displayName;
                    window.history.pushState({ page: 'PROFILE', creatorId: targetId }, '', `/${handle}`);
                }
                setStartProfileTutorial(true);
                setCurrentPage('PROFILE');
                setIsLoading(false);
            } else {
                alert("No creators found. Please sign up as a creator first!");
            }
          }}
        />
      )}

      {(currentPage === 'LOGIN' || isPasswordRecovery) && (
        <LoginPage
          onLoginSuccess={(user) => { setPendingLoginRole('CREATOR'); handleLoginSuccess(user); }}
          initialStep={isPasswordRecovery ? 'RESET_PASSWORD' : 'LOGIN'}
          initialRole={pendingLoginRole}
          currentUser={currentUser}
          onBack={() => {
              setIsPasswordRecovery(false);
              setPendingLoginRole('CREATOR');
              window.history.pushState({ page: 'LANDING' }, '', '/');
              setCurrentPage('LANDING');
          }}
        />
      )}

      {currentPage === 'SETUP_PROFILE' && (
        <LoginPage 
          initialStep="SETUP_PROFILE"
          currentUser={currentUser}
          onLoginSuccess={handleLoginSuccess}
          onBack={async () => {
              clearSessionCache();
              await signOut();
              setCurrentUser(null);
              window.history.pushState({ page: 'LANDING' }, '', '/');
              setCurrentPage('LANDING');
          }}
        />
      )}

      {currentPage === 'PROFILE' && creator && (
        <CreatorPublicProfile
          creator={creator}
          currentUser={currentUser}
          startTutorial={startProfileTutorial}
          onTutorialDone={() => {
            setStartProfileTutorial(false);
            if (currentUser) {
              localStorage.setItem(`diem_fan_tutorial_done_${currentUser.id}`, '1');
            }
          }}
          onMessageSent={() => {
            setRefreshTrigger(p => p + 1);
            loadCreatorData(creator.id); // Refresh credits after sending
          }} 
          onCreateOwn={async () => {
            if (currentUser) {
              if (currentUser.role === 'CREATOR') {
                setIsLoading(true);
                await loadCreatorData(currentUser.id);
                window.history.pushState({ page: 'DASHBOARD' }, '', '/dashboard');
                setCurrentPage('DASHBOARD');
              } else {
                window.history.pushState({ page: 'FAN_DASHBOARD' }, '', '/dashboard');
                setCurrentPage('FAN_DASHBOARD');
              }
            } else {
              window.history.pushState({ page: 'LANDING' }, '', '/');
              setCurrentPage('LANDING');
            }
          }}
          onLoginRequest={(preferredRole) => {
              if (creator) {
                  const handle = (creator.handle && creator.handle !== '@user')
                      ? creator.handle.replace('@', '')
                      : creator.displayName;
                  localStorage.setItem('diem_return_to_creator', handle);
              }
              if (preferredRole) setPendingLoginRole(preferredRole);
              window.history.pushState({ page: 'LOGIN' }, '', '/login');
              setCurrentPage('LOGIN');
          }}
          onNavigateToDashboard={async (creatorId?: string) => {
            if (currentUser?.role === 'CREATOR') {
              setIsLoading(true);
              await loadCreatorData(currentUser.id);
              window.history.pushState({ page: 'DASHBOARD' }, '', '/dashboard');
              setCurrentPage('DASHBOARD');
            } else {
              if (creatorId) localStorage.setItem('diem_open_creator', creatorId);
              window.history.pushState({ page: 'FAN_DASHBOARD' }, '', '/dashboard');
              setCurrentPage('FAN_DASHBOARD');
            }
          }}
          onRefreshData={() => loadCreatorData(creator?.id)}
        />
      )}

      {currentPage === 'DASHBOARD' && creator && (
        <CreatorDashboard 
          creator={creator} 
          currentUser={currentUser}
          key={refreshTrigger} // Force re-render on dashboard when messages update via refreshTrigger
          onLogout={async () => {
            clearSessionCache();
            await signOut();
            setCurrentUser(null);
            window.history.pushState({ page: 'LANDING' }, '', '/');
            setCurrentPage('LANDING');
          }}
          onViewProfile={() => {
              const handle = (creator.handle && creator.handle !== '@user') 
                  ? creator.handle.replace('@', '') 
                  : creator.displayName;
              window.history.pushState({ page: 'PROFILE', creatorId: creator.id }, '', `/${handle}`);
              setCurrentPage('PROFILE');
          }}
          onRefreshData={() => loadCreatorData(creator?.id)}
        />
      )}

      {currentPage === 'FAN_DASHBOARD' && (
         <FanDashboard 
            currentUser={currentUser}
            onUpdateUser={(u) => setCurrentUser(u)}
            onLogout={async () => {
              clearSessionCache();
              await signOut();
              setCurrentUser(null);
              window.history.pushState({ page: 'LANDING' }, '', '/');
              setCurrentPage('LANDING');
            }}
            onBrowseCreators={handleCreatorSelect}
         />
      )}

      {/* OAuth Terms Modal */}
      {showOAuthTerms && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="p-6 border-b border-stone-100">
              <h2 className="text-lg font-bold text-stone-900">{t('terms.title')}</h2>
              <p className="text-xs text-stone-500 mt-1">{t('terms.readScroll')}</p>
            </div>
            <div
              className="flex-1 overflow-y-auto p-6 text-sm text-stone-700 space-y-4"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) setOauthTermsScrolled(true);
              }}
            >
              <div>
                <p className="font-semibold text-stone-900 mb-1">{t('terms.welcomeTitle')}</p>
                <p>{t('terms.welcomeBody')}</p>
              </div>
              <div>
                <p className="font-semibold text-stone-900 mb-1">{t('terms.s1title')}</p>
                <p>{t('terms.s1body')}</p>
                <ul className="mt-2 space-y-1 list-disc list-inside text-stone-600">
                  <li>{t('terms.s1i1')}</li>
                  <li>{t('terms.s1i2')}</li>
                  <li>{t('terms.s1i3')}</li>
                  <li>{t('terms.s1i4')}</li>
                  <li>{t('terms.s1i5')}</li>
                  <li>{t('terms.s1i6')}</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-stone-900 mb-1">{t('terms.s2title')}</p>
                <p>{t('terms.s2body')}</p>
              </div>
              <div>
                <p className="font-semibold text-stone-900 mb-1">{t('terms.s3title')}</p>
                <p>{t('terms.s3body')}</p>
              </div>
              <div>
                <p className="font-semibold text-stone-900 mb-1">{t('terms.s4title')}</p>
                <p>{t('terms.s4body')}</p>
              </div>
              <div>
                <p className="font-semibold text-stone-900 mb-1">{t('terms.s5title')}</p>
                <p>{t('terms.s5body')}</p>
              </div>
              <div>
                <p className="font-semibold text-stone-900 mb-1">{t('terms.s6title')}</p>
                <p>{t('terms.s6body')}</p>
              </div>
              <div>
                <p className="font-semibold text-stone-900 mb-1">{t('terms.s7title')}</p>
                <p>{t('terms.s7body')}</p>
              </div>
              <div className="pt-2 border-t border-stone-100">
                <p className="text-xs text-stone-400">{t('terms.footer')}</p>
              </div>
            </div>
            <div className="p-5 border-t border-stone-100 space-y-2">
              {!oauthTermsScrolled && (
                <p className="text-xs text-center text-stone-400">{t('terms.scrollToEnable')}</p>
              )}
              <button
                onClick={() => { if (oauthTermsScrolled && pendingOAuthRole) { setShowOAuthTerms(false); setShowSignUpConfirm(false); handleConfirmSignUp(pendingOAuthRole); } }}
                disabled={!oauthTermsScrolled || isLoading}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-colors ${oauthTermsScrolled && !isLoading ? 'bg-stone-900 text-white hover:bg-stone-700' : 'bg-stone-100 text-stone-400 cursor-not-allowed'}`}
              >
                {isLoading ? t('terms.creating') : t('terms.agree')}
              </button>
              <button
                onClick={async () => { setShowOAuthTerms(false); setPendingOAuthRole(null); await handleCancelSignUp(); }}
                className="w-full py-2 text-xs text-stone-400 hover:text-stone-600 transition-colors"
              >
                {t('terms.decline')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign Up Confirmation Modal */}
      {showSignUpConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center border border-stone-100">
                <h3 className="text-xl font-bold text-stone-900 mb-2">{t('auth.createAccount')}</h3>
                <p className="text-stone-500 mb-6">
                    {t('auth.noAccountFound')}
                </p>
                <div className="flex flex-col gap-3">
                    <button onClick={() => { setPendingOAuthRole('CREATOR'); setShowOAuthTerms(true); setOauthTermsScrolled(false); }} className="w-full px-4 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-colors shadow-lg shadow-stone-900/20">{t('auth.createCreatorAccount')}</button>
                    <button onClick={() => { setPendingOAuthRole('FAN'); setShowOAuthTerms(true); setOauthTermsScrolled(false); }} className="w-full px-4 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-500/20">{t('auth.createFanAccount')}</button>
                    <button onClick={handleCancelSignUp} className="w-full px-4 py-2 text-sm font-bold text-stone-400 hover:text-stone-600 transition-colors mt-2">{t('common.cancel')}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;
