
import React, { useState, useEffect } from 'react';
import { CreatorPublicProfile } from './components/CreatorPublicProfile';
import { CreatorDashboard } from './components/CreatorDashboard';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { FanDashboard } from './components/FanDashboard';
import { getCreatorProfile, checkAndSyncSession, isBackendConfigured } from './services/realBackend';
import { CreatorProfile, CurrentUser } from './types';

type PageState = 'LANDING' | 'LOGIN' | 'DASHBOARD' | 'PROFILE' | 'FAN_DASHBOARD';

function App() {
  const [currentPage, setCurrentPage] = useState<PageState>('LANDING');
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCreatorData = async (specificCreatorId?: string) => {
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
      } catch (e: any) {
        // If DB is empty, ignore error so we can load Landing Page and allow Sign Up
        console.warn("No creator profile found (DB might be empty). App running in setup mode.");
        setCreator(null);
      }

    } catch (err: any) {
      console.error("Failed to load creator:", err);
      setError(err.message || "Failed to load application data. Please ensure the database is seeded.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Handle Browser Back Button
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state && state.page) {
        if (state.page === 'PROFILE' && state.creatorId) {
             setIsLoading(true);
             loadCreatorData(state.creatorId);
        } else if (state.page === 'DASHBOARD' && currentUser?.role === 'CREATOR') {
             setIsLoading(true);
             loadCreatorData(currentUser.id);
        }
        setCurrentPage(state.page);
      } else {
        // Fallback if state is missing (e.g. initial entry popped)
        if (currentUser) {
             setCurrentPage(currentUser.role === 'CREATOR' ? 'DASHBOARD' : 'FAN_DASHBOARD');
        } else {
             setCurrentPage('LANDING');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);

    console.log("Bluechecked App Version: 3.6.16");
    console.log("Backend Connection:", isBackendConfigured() ? "✅ Connected to Supabase" : "⚠️ Using Mock Data");
    loadCreatorData();
    
    // Optimistically load session from local storage
    const storedUser = localStorage.getItem('bluechecked_current_user');
    if (storedUser) {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
        setCurrentPage(user.role === 'CREATOR' ? 'DASHBOARD' : 'FAN_DASHBOARD');
    }

    // Check for existing session
    const initSession = async () => {
        const user = await checkAndSyncSession();
        if (user) {
            setCurrentUser(user);
            if (user.role === 'CREATOR') {
                setIsLoading(true);
                await loadCreatorData(user.id); // Ensure we load the correct creator profile
                setCurrentPage('DASHBOARD');
                window.history.replaceState({ page: 'DASHBOARD' }, '', '');
            } else {
                setCurrentPage('FAN_DASHBOARD');
                window.history.replaceState({ page: 'FAN_DASHBOARD' }, '', '');
            }
        } else {
            window.history.replaceState({ page: 'LANDING' }, '', '');
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
          onClick={loadCreatorData}
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

  const handleLoginSuccess = async (user: CurrentUser) => {
    setCurrentUser(user);
    
    if (user.role === 'CREATOR') {
      setIsLoading(true); // Show loading while switching to your profile
      await loadCreatorData(user.id); // Load YOUR specific profile
      window.history.pushState({ page: 'DASHBOARD' }, '', '');
      setCurrentPage('DASHBOARD');
    } else {
       await loadCreatorData(); // Load default/featured profile for fan view
       window.history.pushState({ page: 'FAN_DASHBOARD' }, '', '');
       setCurrentPage('FAN_DASHBOARD');
    }
  };

  const handleCreatorSelect = async (creatorId: string) => {
    try {
      setIsLoading(true);
      await loadCreatorData(creatorId);
      window.history.pushState({ page: 'PROFILE', creatorId }, '', '');
      setCurrentPage('PROFILE');
    } catch (e) {
      setIsLoading(false);
    }
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
    </div>
  );
}

export default App;
