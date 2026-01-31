
import React, { useState, useEffect, useRef } from 'react';
import { CreatorPublicProfile } from './components/CreatorPublicProfile';
import { CreatorDashboard } from './components/CreatorDashboard';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { FanDashboard } from './components/FanDashboard';
import { getCreatorProfile, checkAndSyncSession, isBackendConfigured, completeOAuthSignup, signOut } from './services/realBackend';
import { CreatorProfile, CurrentUser, UserRole } from './types';

type PageState = 'LANDING' | 'LOGIN' | 'DASHBOARD' | 'PROFILE' | 'FAN_DASHBOARD' | 'SETUP_PROFILE';

function App() {
  const [currentPage, setCurrentPage] = useState<PageState>('LANDING');
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSignUpConfirm, setShowSignUpConfirm] = useState(false);

  const currentUserRef = useRef<CurrentUser | null>(null);
  useEffect(() => {
      currentUserRef.current = currentUser;
  }, [currentUser]);

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
          localStorage.removeItem('bluechecked_current_user');
      }

      try {
        const creatorData = await getCreatorProfile(specificCreatorId);
        setCreator(creatorData);
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
          setShowSignUpConfirm(true);
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
        // Fallback if state is missing (e.g. initial entry popped)
        if (user) {
             setCurrentPage(user.role === 'CREATOR' ? 'DASHBOARD' : 'FAN_DASHBOARD');
        } else {
             setCurrentPage('LANDING');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);

    console.log("Bluechecked App Version: 3.6.32");
    console.log("Backend Connection:", isBackendConfigured() ? "✅ Connected to Supabase" : "⚠️ Using Mock Data");
    
    // Optimistically load session from local storage
    // const storedUser = localStorage.getItem('bluechecked_current_user');
    // if (storedUser) {
    //     const user = JSON.parse(storedUser);
    //     setCurrentUser(user);
    //     setCurrentPage(user.role === 'CREATOR' ? 'DASHBOARD' : 'FAN_DASHBOARD');
    // }

    // Check for existing session
    const initSession = async () => {
        try {
            const user = await checkAndSyncSession();
            if (user) {
                setCurrentUser(user);
                
                if (user.role === 'CREATOR') {
                    const profile = await loadCreatorData(user.id, false);
                    
                    if (!profile) {
                        setIsLoading(false);
                        return;
                    }

                    // Check if profile setup is needed (empty bio is a good indicator of fresh account)
                    const hasSkippedSetup = localStorage.getItem('bluechecked_skip_setup') === 'true';
                    if (profile && !profile.bio && !hasSkippedSetup) {
                        setCurrentPage('SETUP_PROFILE');
                        window.history.replaceState({ page: 'SETUP_PROFILE' }, '', '');
                    } else {
                        setCurrentPage('DASHBOARD');
                        window.history.replaceState({ page: 'DASHBOARD' }, '', '');
                    }
                    setIsLoading(false);
                } else {
                    // Fan Dashboard
                    setCurrentPage('FAN_DASHBOARD');
                    window.history.replaceState({ page: 'FAN_DASHBOARD' }, '', '');
                    setIsLoading(false);
                }
            } else {
                window.history.replaceState({ page: 'LANDING' }, '', '');
                setIsLoading(false);
            }
        } catch (err: any) {
            if (err.code === 'PROFILE_MISSING') {
                setShowSignUpConfirm(true);
            } else if (err.code === 'ROLE_MISMATCH') {
                alert(err.message);
                await signOut();
                window.history.replaceState({ page: 'LANDING' }, '', '');
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
    return () => window.removeEventListener('popstate', handlePopState);
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
    <div className="min-h-screen flex items-center justify-center bg-white text-slate-900 p-4">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">Connection Error</h2>
        <p className="text-slate-600">{error}</p>
        <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-500 text-left">
            <p className="font-bold mb-1">Troubleshooting:</p>
            <ul className="list-disc pl-4 space-y-1">
                <li>Check your internet connection</li>
                <li>Ensure Supabase project is active</li>
                <li>Run the database seed script in Supabase SQL Editor</li>
            </ul>
        </div>
        <button 
          onClick={() => loadCreatorData()}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
        >
          Retry Connection
        </button>
      </div>
    </div>
  );

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-white text-slate-400">
      <div className="flex flex-col items-center gap-2">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
        <span className="text-sm font-medium">Loading Bluechecked...</span>
      </div>
    </div>
  );

  const navigateToDashboard = async (user: CurrentUser) => {
      if (user.role === 'CREATOR') {
          setIsLoading(true);
          const profile = await loadCreatorData(user.id, false);
          
          if (!profile) {
              setIsLoading(false);
              return;
          }

          const hasSkippedSetup = localStorage.getItem('bluechecked_skip_setup') === 'true';
          if (!profile.bio && !hasSkippedSetup) {
              window.history.pushState({ page: 'SETUP_PROFILE' }, '', '');
              setCurrentPage('SETUP_PROFILE');
          } else {
              window.history.pushState({ page: 'DASHBOARD' }, '', '');
              setCurrentPage('DASHBOARD');
          }
          setIsLoading(false);
      } else {
          window.history.pushState({ page: 'FAN_DASHBOARD' }, '', '');
          setCurrentPage('FAN_DASHBOARD');
      }
  };

  const handleLoginSuccess = async (user: CurrentUser) => {
    setCurrentUser(user);
    await navigateToDashboard(user);
  };

  const handleCreatorSelect = async (creatorId: string) => {
    try {
      setIsLoading(true);
      await loadCreatorData(creatorId, false);
      window.history.pushState({ page: 'PROFILE', creatorId }, '', '');
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
      await signOut();
      setShowSignUpConfirm(false);
      setCurrentPage('LANDING');
  };

  return (
    <div className="font-sans text-slate-900">
      
      {currentPage === 'LANDING' && (
        <LandingPage
          onLoginClick={() => {
              window.history.pushState({ page: 'LOGIN' }, '', '');
              setCurrentPage('LOGIN');
          }}
          onDemoClick={() => {
            if (creator) {
                window.history.pushState({ page: 'PROFILE', creatorId: creator.id }, '', '');
                setCurrentPage('PROFILE');
            }
            else alert("No creators found. Please sign up as a creator first!");
          }}
        />
      )}

      {currentPage === 'LOGIN' && (
        <LoginPage 
          onLoginSuccess={handleLoginSuccess}
          onBack={() => {
              window.history.pushState({ page: 'LANDING' }, '', '');
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
              await signOut();
              setCurrentUser(null);
              window.history.pushState({ page: 'LANDING' }, '', '');
              setCurrentPage('LANDING');
          }}
        />
      )}

      {currentPage === 'PROFILE' && creator && (
        <CreatorPublicProfile 
          creator={creator} 
          currentUser={currentUser}
          onMessageSent={() => {
            setRefreshTrigger(p => p + 1);
            loadCreatorData(); // Refresh credits after sending
          }} 
          onCreateOwn={async () => {
            if (currentUser) {
              if (currentUser.role === 'CREATOR') {
                setIsLoading(true);
                await loadCreatorData(currentUser.id);
                window.history.pushState({ page: 'DASHBOARD' }, '', '');
                setCurrentPage('DASHBOARD');
              } else {
                window.history.pushState({ page: 'FAN_DASHBOARD' }, '', '');
                setCurrentPage('FAN_DASHBOARD');
              }
            } else {
              window.history.pushState({ page: 'LANDING' }, '', '');
              setCurrentPage('LANDING');
            }
          }}
          onLoginRequest={() => {
              window.history.pushState({ page: 'LOGIN' }, '', '');
              setCurrentPage('LOGIN');
          }}
          onNavigateToDashboard={async () => {
            if (currentUser?.role === 'CREATOR') {
              setIsLoading(true);
              await loadCreatorData(currentUser.id);
              window.history.pushState({ page: 'DASHBOARD' }, '', '');
              setCurrentPage('DASHBOARD');
            } else {
              window.history.pushState({ page: 'FAN_DASHBOARD' }, '', '');
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
          onLogout={() => {
            setCurrentUser(null);
            localStorage.removeItem('bluechecked_current_user'); // Ensure session clear
            window.history.pushState({ page: 'LANDING' }, '', '');
            setCurrentPage('LANDING');
          }}
          onViewProfile={() => {
              window.history.pushState({ page: 'PROFILE', creatorId: creator.id }, '', '');
              setCurrentPage('PROFILE');
          }}
          onRefreshData={() => loadCreatorData(creator?.id)}
        />
      )}

      {currentPage === 'FAN_DASHBOARD' && (
         <FanDashboard 
            currentUser={currentUser}
            onUpdateUser={(u) => setCurrentUser(u)}
            onLogout={() => {
              setCurrentUser(null);
              localStorage.removeItem('bluechecked_current_user'); // Ensure session clear
              window.history.pushState({ page: 'LANDING' }, '', '');
              setCurrentPage('LANDING');
            }}
            onBrowseCreators={handleCreatorSelect}
         />
      )}

      {/* Sign Up Confirmation Modal */}
      {showSignUpConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Create Account?</h3>
                <p className="text-slate-500 mb-6">
                    We couldn't find an account linked to this email. Please select your account type to continue.
                </p>
                <div className="flex flex-col gap-3">
                    <button onClick={() => handleConfirmSignUp('CREATOR')} className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">Create Creator Account</button>
                    <button onClick={() => handleConfirmSignUp('FAN')} className="w-full px-4 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/20">Create Fan Account</button>
                    <button onClick={handleCancelSignUp} className="w-full px-4 py-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors mt-2">Cancel</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;
