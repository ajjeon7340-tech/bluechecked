import { supabase, isConfigured as isSupabaseConfigured } from './supabaseClient';
import { CreatorProfile, Message, MessageStatus, CurrentUser, UserRole, ChatMessage, StatTimeFrame, DetailedStat, DetailedFinancialStat, MonthlyStat, ProAnalyticsData } from '../types';
import * as MockBackend from './mockBackend';

// Allow forcing mock mode via environment variable (VITE_USE_MOCK=true)
const isConfigured = isSupabaseConfigured && import.meta.env.VITE_USE_MOCK !== 'true';

export const DEFAULT_AVATAR = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

export const isBackendConfigured = () => isConfigured;

// --- IN-MEMORY CACHES ---
// Message list cache (stale-while-revalidate: return immediately, refresh in background)
let _msgCache: Message[] | null = null;
let _msgCacheTime = 0;
let _msgCacheUserId = '';
let _msgCacheRefreshing = false;
const MSG_CACHE_TTL = 60000; // 60 seconds (subscription handles real-time updates)

// Per-message chat_lines cache (longer TTL since chat content rarely changes)
const _chatLinesCache = new Map<string, { lines: ChatMessage[]; ts: number }>();
const CHAT_LINES_TTL = 300000; // 5 minutes (invalidated on reply/edit)

export const invalidateMsgCache = () => { _msgCache = null; _msgCacheRefreshing = false; };
export const invalidateChatLinesCache = (messageId: string) => { _chatLinesCache.delete(messageId); };

// Cached Diem admin user ID
let _diemAdminId: string | null = null;
const getDiemAdminId = async (): Promise<string | null> => {
    if (_diemAdminId) return _diemAdminId;
    try {
        const { data } = await supabase.rpc('get_diem_user_id');
        if (data) _diemAdminId = data as string;
        return _diemAdminId;
    } catch { return null; }
};

const getColorForSource = (source: string) => {
    const s = source.toLowerCase();
    if (s.includes('youtube')) return '#FF0000';
    if (s.includes('instagram')) return '#E1306C';
    if (s.includes('x') || s.includes('twitter')) return '#000000';
    if (s.includes('tiktok')) return '#000000';
    if (s.includes('twitch')) return '#9146FF';
    if (s.includes('google')) return '#4285F4';
    if (s.includes('bing')) return '#00809D';
    if (s.includes('search')) return '#4285F4';
    if (s.includes('direct')) return '#64748b';
    if (s.includes('shared')) return '#10B981';
    return '#94a3b8';
};

// Helper to enforce timeouts on Supabase calls that might hang (like SMTP issues)
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error("TIMEOUT")), ms)
        )
    ]);
};

const getSiteUrl = () => {
    // If running locally, use the current window origin to ensure redirects return to localhost
    // This overrides VITE_SITE_URL which might be set to production
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return window.location.origin;
    }
    // Allow overriding the site URL via environment variable (e.g. VITE_SITE_URL=https://diem.ee)
    if (import.meta.env.VITE_SITE_URL) {
        return import.meta.env.VITE_SITE_URL.replace(/\/$/, "");
    }
    return window.location.origin;
};

// --- HELPER: MAP DB OBJECTS TO TYPES ---

const mapProfileToUser = (profile: any): CurrentUser => ({
    id: profile.id,
    name: profile.display_name || 'User',
    email: profile.email,
    role: (profile.role as UserRole) || 'FAN',
    avatarUrl: profile.avatar_url || DEFAULT_AVATAR,
    phoneNumber: '', 
    credits: profile.credits || 0,
    bio: profile.bio
});

// Helper to safely save user to local storage without exceeding quota
const saveUserToLocalStorage = (user: CurrentUser) => {
    try {
        const userToStore = { ...user };
        // If avatar is a large base64 string, revert to default for local storage cache to prevent QuotaExceededError
        if (userToStore.avatarUrl && userToStore.avatarUrl.startsWith('data:')) {
            userToStore.avatarUrl = DEFAULT_AVATAR;
        }
        localStorage.setItem('diem_current_user', JSON.stringify(userToStore));
    } catch (e) {
        console.warn("LocalStorage Quota Exceeded - skipping cache update", e);
    }
};

const mapDbMessageToAppMessage = (m: any, currentUserId: string): Message => {
    // Construct conversation from chat_lines
    // If chat_lines is empty (legacy or new msg), build default from content
    let conversation: ChatMessage[] = [];
    
    // 1. Parse chat_lines if available
    let lines: ChatMessage[] = [];
    if (m.chat_lines && m.chat_lines.length > 0) {
        lines = m.chat_lines.map((line: any) => {
            let content = line.content;
            let attachmentUrl = line.attachment_url;

            // Workaround for missing attachment_url column in chat_lines
            if (!attachmentUrl && content && content.includes('[Attachment](')) {
                const match = content.match(/\[Attachment\]\((.*?)\)/);
                if (match) {
                    attachmentUrl = match[1];
                    content = content.replace(match[0], '').trim();
                }
            }

            return {
                id: line.id,
                role: line.role, // 'FAN' or 'CREATOR' stored in DB
                content: content,
                timestamp: line.created_at,
                attachmentUrl: attachmentUrl,
                isEdited: line.updated_at && line.updated_at !== line.created_at
            };
        });
    }

    // 2. Check if the initial message (stored in parent row) is already in chat_lines
    const initialMsg: ChatMessage = {
        id: `${m.id}-init`,
        role: 'FAN',
        content: m.content,
        timestamp: m.created_at,
        attachmentUrl: m.attachment_url
    };

    const hasInitial = lines.some(l =>
        l.role === 'FAN' &&
        (l.content?.trim() === m.content?.trim() ||
          Math.abs(new Date(l.timestamp).getTime() - new Date(m.created_at).getTime()) < 8000)
    );

    conversation = hasInitial ? lines : [initialMsg, ...lines];

    // 3. Sort & Deduplicate (trimmed content, within 5s window)
    conversation.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    conversation = conversation.filter((msg, index, self) =>
        index === self.findIndex((t) => (
            t.role === msg.role && t.content?.trim() === msg.content?.trim() &&
            Math.abs(new Date(t.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 5000
        ))
    );

    return {
        id: m.id,
        senderName: m.sender?.display_name || 'Fan',
        senderEmail: m.sender?.email || '',
        senderAvatarUrl: m.sender?.avatar_url,
        content: m.content,
        amount: m.amount,
        creatorId: m.creator_id,
        creatorName: m.creator?.display_name || 'Creator',
        creatorEmail: m.creator?.email,
        creatorAvatarUrl: m.creator?.avatar_url || DEFAULT_AVATAR,
        createdAt: m.created_at,
        expiresAt: m.expires_at,
        status: m.status as MessageStatus,
        replyContent: conversation.find(c => c.role === 'CREATOR')?.content, // Legacy support
        replyAt: m.reply_at,
        isRead: m.is_read,
        attachmentUrl: m.attachment_url,
        conversation: conversation,
        rating: m.rating,
        reviewContent: m.review_content
    };
};

// --- AUTH ---

export const loginUser = async (role: UserRole, identifier: string, password?: string, method: 'EMAIL' | 'PHONE' = 'EMAIL', name?: string): Promise<CurrentUser> => {
    if (!isConfigured) return MockBackend.loginUser(role, identifier, method, name); // Mock doesn't use password yet

    const cleanIdentifier = identifier.trim();
    const authPassword = password || 'password123'; // Fallback for safety, but UI should provide it
    
    // 1. Determine if we are Signing Up or Signing In based on 'name' presence
    // If 'name' is provided, it's a Sign Up attempt. If not, it's a Sign In attempt.
    // This relies on the UI passing 'name' only during Sign Up.
    
    let data;
    let error;

    if (name) {
        // Check if account exists before attempting signup to prevent sending confirmation email to existing users
        if (method === 'EMAIL') {
             const { data: existingProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', cleanIdentifier)
                .maybeSingle();
             
             if (existingProfile) {
                 throw new Error("Account already exists. Please sign in.");
             }
        }

        // --- SIGN UP FLOW ---
        const signUpOptions = {
            password: authPassword,
            options: {
                emailRedirectTo: getSiteUrl(),
                data: {
                    name: name || 'New User',
                    role: role
                }
            }
        };

        let signUpData, signUpError;
        
        try {
            const result = await withTimeout(supabase.auth.signUp(
                method === 'EMAIL' 
                    ? { email: cleanIdentifier, ...signUpOptions }
                    : { phone: cleanIdentifier, ...signUpOptions }
            ), 15000); // 15s timeout
            signUpData = result.data;
            signUpError = result.error;
        } catch (e: any) {
            if (e.message === 'TIMEOUT' || e.name === 'AuthRetryableFetchError' || e.status === 504) {
                throw new Error("Sign up timed out. This is likely due to incorrect SMTP settings in Supabase.");
            }
            throw e;
        }

        if (signUpError) throw signUpError;
        data = signUpData;
        
        if (!data.session) {
            // Email confirmation is enabled. We cannot create the profile yet (RLS blocks it).
            // Throw specific error for UI to handle.
            throw new Error("CONFIRMATION_REQUIRED");
        }

        // 2b. Create Profile Row manually (Required since we aren't using SQL Triggers)
        if (data.user) {
            // Check if profile exists first to avoid error on duplicate insert and check role
            const { data: existingProfile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
            
            if (existingProfile) {
                if (existingProfile.role !== role) {
                     throw new Error(`This account already exists as a ${existingProfile.role}. Please sign in as a ${existingProfile.role}.`);
                }
                throw new Error("Account already exists. Please sign in.");
            } else {
                await supabase.from('profiles').insert({
                    id: data.user.id,
                    email: cleanIdentifier,
                    display_name: name || 'New User',
                    role: role,
                    credits: role === 'FAN' ? 500 : 0, // Give fans starting credits
                    price_per_message: 50,
                    response_window_hours: 48
                });
            }
        }
    } else {
        // --- SIGN IN FLOW ---
        const result = await supabase.auth.signInWithPassword(
            method === 'EMAIL'
                ? { email: cleanIdentifier, password: authPassword }
                : { phone: cleanIdentifier, password: authPassword }
        );
        data = result.data;
        error = result.error;

        if (error) {
            // Do NOT auto-signup. Throw error if user not found or password wrong.
            if (error.message.includes("Invalid login credentials")) {
                throw new Error("Invalid email or password. If you haven't created an account, please Sign Up first.");
            }
            throw error;
        }
    }

    if (!data.user) throw new Error("Login Failed");

    // 3. Fetch the Profile
    let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

    if (profileError) throw profileError;
    
    // LAZY PROFILE CREATION
    // If profile is missing (e.g. user confirmed email and is logging in for first time), create it now.
    if (!profile) {
        // Try to get data from user metadata (saved during signup) or fallback to args
        const metaName = data.user.user_metadata?.name;
        
        const { error: insertError } = await supabase.from('profiles').insert({
            id: data.user.id,
            email: cleanIdentifier,
            display_name: name || metaName || 'New User',
            role: role,
            credits: role === 'FAN' ? 500 : 0,
            price_per_message: 50,
            response_window_hours: 48
        });
        
        if (insertError) throw insertError;
        
        // Fetch again
        const { data: newProfile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        profile = newProfile;
    } else {
        // Check Role Mismatch for existing profile
        if (profile.role !== role) {
            // Sign out first to prevent stale session from triggering auto-navigation
            await supabase.auth.signOut();
            throw new Error(`This account already exists as a ${profile.role}. Please sign in as a ${profile.role}.`);
        }
    }

    const user = mapProfileToUser(profile);
    saveUserToLocalStorage(user);
    return user;
};

export const updateCurrentUser = async (user: CurrentUser): Promise<void> => {
    if (!isConfigured) return MockBackend.updateCurrentUser(user);

    const { error } = await supabase
        .from('profiles')
        .update({
            display_name: user.name,
            avatar_url: user.avatarUrl,
            bio: user.bio
        })
        .eq('id', user.id);
        
    if (error) throw error;
};

export const resendConfirmationEmail = async (email: string) => {
    if (!isConfigured) return; // Mock mode doesn't send emails
    console.log("Resending confirmation email to:", email);
    const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: getSiteUrl() }
    });
    if (error) throw error;
};

export const sendPasswordResetEmail = async (email: string) => {
    if (!isConfigured) {
        console.log(`[Mock] Sending password reset to ${email}`);
        await new Promise(r => setTimeout(r, 1000));
        return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getSiteUrl(),
    });
    if (error) throw error;
};

export const updatePassword = async (newPassword: string) => {
    if (!isConfigured) return;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
};

export const subscribeToAuthChanges = (callback: (event: string, session: any) => void) => {
    if (!isConfigured) return { unsubscribe: () => {} };
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
    return data.subscription;
};

export const signInWithSocial = async (provider: 'google' | 'instagram', role: UserRole) => {
    if (!isConfigured) {
        return MockBackend.signInWithSocial(provider, role);
    }

    // Store role preference to persist through redirect (Fallback if URL param is lost)
    // We also clear the current user cache to ensure we have space and don't mix sessions
    try {
        localStorage.removeItem('diem_current_user');
        localStorage.removeItem('diem_skip_setup');
        localStorage.setItem('diem_oauth_role', role);
    } catch (e) {
        console.warn("Failed to save role preference to local storage", e);
    }

    // Supabase supports 'google'. For 'instagram', usually 'facebook' (Meta) is used.
    // We map instagram to facebook for this implementation.
    // Note: You must enable Google/Facebook providers in Supabase Dashboard.
    const supabaseProvider = provider === 'instagram' ? 'facebook' : provider;
    
    // Use the current window origin. This ensures:
    // 1. Localhost -> Localhost
    // 2. Production -> Production
    const redirectBase = getSiteUrl();

    console.log("Redirecting to:", `${redirectBase}?role=${role}`);
    console.log(`[Auth] OAuth Redirect: ${redirectBase}?role=${role}`);

    const { error } = await supabase.auth.signInWithOAuth({
        provider: supabaseProvider as any,
        options: {
            redirectTo: `${redirectBase}?role=${role}`,
        }
    });
    if (error) throw error;
};

export const signOut = async () => {
    if (!isConfigured) {
        localStorage.removeItem('diem_current_user');
        window.location.reload();
        return;
    }
    await supabase.auth.signOut();
    localStorage.removeItem('diem_current_user');
    localStorage.removeItem('diem_skip_setup');
};

export const checkAndSyncSession = async (): Promise<CurrentUser | null> => {
    if (!isConfigured) return MockBackend.checkAndSyncSession();

    // 1. Check Supabase Session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        localStorage.removeItem('diem_current_user');
        localStorage.removeItem('diem_skip_setup');
        return null;
    }

    // 2. Get Profile
    let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

    // 3. Handle First Time OAuth Login (Profile Creation)
    if (!profile) {
        // Always throw PROFILE_MISSING so the UI shows Terms before creating the account.
        // The stored diem_oauth_role (if any) will be read by App.tsx to pre-select the role.
        const error: any = new Error("PROFILE_MISSING");
        error.code = 'PROFILE_MISSING';
        throw error;
    }

    if (profile) {
        // Check for role mismatch from OAuth intent
        const storedRole = localStorage.getItem('diem_oauth_role');
        if (storedRole && storedRole !== profile.role) {
            localStorage.removeItem('diem_oauth_role');
            const error: any = new Error(`This account already exists as a ${profile.role}. Please sign in as a ${profile.role}.`);
            error.code = 'ROLE_MISMATCH';
            throw error;
        }
        localStorage.removeItem('diem_oauth_role');

        const user = mapProfileToUser(profile);
        saveUserToLocalStorage(user);
        return user;
    }
    
    // If we reach here, we have a session but no profile (and failed to create one)
    localStorage.removeItem('diem_current_user');
    localStorage.removeItem('diem_skip_setup');
    return null;
};

export const completeOAuthSignup = async (roleOverride?: UserRole): Promise<CurrentUser> => {
    if (!isConfigured) throw new Error("Backend not configured");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No session found");

    // Determine role from URL param OR localStorage (fallback)
    const params = new URLSearchParams(window.location.search);
    let urlRole = params.get('role');
    
    // Also check hash params (Supabase sometimes puts custom params in hash)
    if (!urlRole && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        urlRole = hashParams.get('role');
    }

    const storedRole = localStorage.getItem('diem_oauth_role');
    
    // Prioritize localStorage (user intent before redirect), fallback to URL param, default to FAN
    const roleParam = roleOverride 
        ? roleOverride
        : (storedRole === 'CREATOR' || storedRole === 'FAN') ? storedRole
        : (urlRole === 'CREATOR' || urlRole === 'FAN') ? urlRole 
        : 'FAN';
        
    const role = roleParam as UserRole;
    
    const meta = session.user.user_metadata;
    const name = meta?.full_name || meta?.name || 'New User';
    const avatar = meta?.avatar_url || meta?.picture;

    // Check if profile exists first to avoid error on duplicate insert (409 Conflict)
    const { data: existingProfile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();

    if (!existingProfile) {
        // Create Profile
        const { error } = await supabase.from('profiles').insert({
            id: session.user.id,
            email: session.user.email,
            display_name: name,
            role: role,
            avatar_url: avatar,
            credits: role === 'FAN' ? 500 : 0,
            price_per_message: 50,
            response_window_hours: 48
        });
        if (error) throw error;
    } else {
        // Profile already exists, just ensure we return it.
        // We could update it here if needed, but for now just proceed.
        console.log("Profile already exists, skipping creation.");
        if (existingProfile.role !== role) {
             throw new Error(`This account already exists as a ${existingProfile.role}. Please sign in as a ${existingProfile.role}.`);
        }
    }

    // Clean up only after success
    localStorage.removeItem('diem_oauth_role');

    // Fetch again
    const { data: newProfile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    
    const user = mapProfileToUser(newProfile);
    saveUserToLocalStorage(user);
    return user;
};

// --- HELPER: ENRICH PROFILE WITH STATS ---
const enrichCreatorProfile = async (data: any): Promise<CreatorProfile> => {
    let responseTimeAvg = 'N/A';
    let replyRate = '100%';
    let totalRequests = 0;
    let averageRating = 5.0;

    // 1. Try RPC for accurate public stats (bypassing RLS)
    const { data: rpcStats, error: rpcError } = await supabase.rpc('get_creator_stats', { target_creator_id: data.id });

    if (!rpcError && rpcStats) {
        averageRating = rpcStats.averageRating;
        totalRequests = rpcStats.totalRequests;
        replyRate = `${rpcStats.replyRate}%`;
        
        const hours = rpcStats.avgResponseHours;
        if (hours === null || hours === undefined) responseTimeAvg = 'Standard';
        else if (hours < 1) responseTimeAvg = 'Lightning';
        else if (hours < 4) responseTimeAvg = 'Very Fast';
        else if (hours < 24) responseTimeAvg = 'Fast';
        else responseTimeAvg = 'Standard';
    } else {
        // 2. Fallback: Client-side calculation (Subject to RLS, mostly for Creator's own view if RPC fails)
        const { data: statMessages } = await supabase
            .from('messages')
            .select('created_at, reply_at, status, rating')
            .eq('creator_id', data.id);

        if (statMessages && statMessages.length > 0) {
            totalRequests = statMessages.length;

            const repliedMsgs = statMessages.filter(m => m.status === 'REPLIED' && m.reply_at);
            if (repliedMsgs.length > 0) {
                const totalTimeMs = repliedMsgs.reduce((acc, m) => acc + (new Date(m.reply_at).getTime() - new Date(m.created_at).getTime()), 0);
                const avgHours = totalTimeMs / repliedMsgs.length / (1000 * 60 * 60);
                
                if (avgHours < 1) responseTimeAvg = 'Lightning';
                else if (avgHours < 4) responseTimeAvg = 'Very Fast';
                else if (avgHours < 24) responseTimeAvg = 'Fast';
                else responseTimeAvg = 'Standard';
            } else {
                responseTimeAvg = 'Standard';
            }

            const repliedCount = statMessages.filter(m => m.status === 'REPLIED').length;
            const expiredCount = statMessages.filter(m => m.status === 'EXPIRED').length;
            const totalProcessed = repliedCount + expiredCount;
            if (totalProcessed > 0) {
                replyRate = `${Math.round((repliedCount / totalProcessed) * 100)}%`;
            }

            const ratedMessages = statMessages.filter(m => m.rating && m.rating > 0);
            if (ratedMessages.length > 0) {
                const totalRating = ratedMessages.reduce((sum, m) => sum + m.rating, 0);
                averageRating = parseFloat((totalRating / ratedMessages.length).toFixed(1));
            }
        }
    }

    // 4. Get Real Likes Count
    const { count: realLikesCount, error: likesError } = await supabase.from('creator_likes').select('*', { count: 'exact', head: true }).eq('creator_id', data.id);

    if (likesError && likesError.code !== '42P01') {
        console.warn("Failed to fetch likes count:", likesError);
    }

    return {
        id: data.id,
        handle: data.handle || '@user',
        displayName: data.display_name,
        bio: data.bio || '',
        intakeInstructions: data.intake_instructions,
        welcomeMessage: data.welcome_message,
        avatarUrl: data.avatar_url || DEFAULT_AVATAR,
        pricePerMessage: data.price_per_message || 50,
        responseWindowHours: data.response_window_hours || 48,
        likesCount: realLikesCount || 0,
        stats: { 
            responseTimeAvg,
            replyRate, 
            profileViews: totalRequests, // Using Total Requests as a proxy for views/activity
            averageRating 
        },
        customQuestions: [],
        tags: [],
        links: (data.links || []).filter((l: any) => !l.id?.startsWith('__')),
        linkSections: (data.links || [])
            .filter((l: any) => l.id?.startsWith('__section__'))
            .map((l: any) => ({ id: l.id.replace('__section__', ''), title: l.title, order: l.order ?? 0 })),
        linksSectionTitle: (data.links || []).find((l: any) => l.id === '__links_title__')?.title || undefined,
        products: data.products || [],
        platforms: data.platforms || [],
        isPremium: data.is_premium || false,
        showLikes: data.show_likes !== false,
        showRating: data.show_rating !== false,
        showBio: data.show_bio !== false,
        isDiemHighlighted: (data.links || []).find((l: any) => l.id === '__diem_config__')?.isPromoted || false,
        diemButtonColor: (data.links || []).find((l: any) => l.id === '__diem_config__')?.buttonColor || undefined,
        profileFont: data.profile_font || 'inter',
    };
};

// --- PROFILES ---

export const getCreatorProfile = async (creatorId?: string): Promise<CreatorProfile> => {
    if (!isConfigured) {
        console.log("%c[Backend] Using Mock Data (Supabase not configured)", "background: #f59e0b; color: black; padding: 2px 4px; border-radius: 2px; font-weight: bold;");
        return MockBackend.getCreatorProfile(creatorId);
    }

    let query = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'CREATOR');

    if (creatorId) {
        query = query.eq('id', creatorId);
    } else {
        query = query.limit(1);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        console.error("Supabase Error:", error);
        throw new Error(`Database Error: ${error.message}`);
    }

    if (!data) {
        throw new Error("No creator profile found. Please run the Seed Script in Supabase.");
    }

    return enrichCreatorProfile(data);
};

export const getCreatorProfileByHandle = async (handle: string): Promise<CreatorProfile> => {
    if (!isConfigured) return MockBackend.getCreatorProfile();

    const decodedHandle = decodeURIComponent(handle);
    // Handle potential @ prefix
    const cleanHandle = decodedHandle.startsWith('@') ? decodedHandle : decodedHandle;
    const handleWithAt = decodedHandle.startsWith('@') ? decodedHandle : `@${decodedHandle}`;

    let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'CREATOR')
        .or(`handle.eq.${cleanHandle},handle.eq.${handleWithAt}`)
        .maybeSingle();

    if (!data) {
         // Fallback: Search by display name
         const { data: nameData } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'CREATOR')
            .ilike('display_name', cleanHandle)
            .maybeSingle();
         
         if (nameData) data = nameData;
    }

    if (error && !data) {
        console.error("Supabase Error:", error);
        throw new Error(`Database Error: ${error.message}`);
    }

    if (!data) throw new Error("Creator not found");

    return enrichCreatorProfile(data);
};

export const getCreatorProfileFast = async (creatorId?: string): Promise<CreatorProfile> => {
    if (!isConfigured) return MockBackend.getCreatorProfile(creatorId);

    let query = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'CREATOR');

    if (creatorId) {
        query = query.eq('id', creatorId);
    } else {
        query = query.limit(1);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        console.error("Supabase Error:", error);
        throw new Error(`Database Error: ${error.message}`);
    }

    if (!data) {
        throw new Error("No creator profile found.");
    }

    return {
        id: data.id,
        handle: data.handle || '@user',
        displayName: data.display_name,
        bio: data.bio || '',
        intakeInstructions: data.intake_instructions,
        welcomeMessage: data.welcome_message,
        avatarUrl: data.avatar_url || DEFAULT_AVATAR,
        pricePerMessage: data.price_per_message || 50,
        responseWindowHours: data.response_window_hours || 48,
        likesCount: 0, // Placeholder for speed
        stats: { 
            responseTimeAvg: 'Standard',
            replyRate: '100%', 
            profileViews: 0, 
            averageRating: 5.0 
        },
        customQuestions: [],
        tags: [],
        links: (data.links || []).filter((l: any) => !l.id?.startsWith('__')),
        linkSections: (data.links || [])
            .filter((l: any) => l.id?.startsWith('__section__'))
            .map((l: any) => ({ id: l.id.replace('__section__', ''), title: l.title, order: l.order ?? 0 })),
        linksSectionTitle: (data.links || []).find((l: any) => l.id === '__links_title__')?.title || undefined,
        products: data.products || [],
        platforms: data.platforms || [],
        isPremium: data.is_premium || false,
        showLikes: data.show_likes !== false,
        showRating: data.show_rating !== false,
        showBio: data.show_bio !== false,
        isDiemHighlighted: (data.links || []).find((l: any) => l.id === '__diem_config__')?.isPromoted || false,
        diemButtonColor: (data.links || []).find((l: any) => l.id === '__diem_config__')?.buttonColor || undefined,
        profileFont: data.profile_font || 'inter',
    };
};

export const updateCreatorProfile = async (profile: CreatorProfile): Promise<CreatorProfile> => {
    if (!isConfigured) return MockBackend.updateCreatorProfile(profile);

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Not logged in");

    const linksToSave = [
        { id: '__diem_config__', title: '', url: '', isPromoted: profile.isDiemHighlighted || false, ...(profile.diemButtonColor ? { buttonColor: profile.diemButtonColor } : {}) },
        ...(profile.linkSections || []).map(s => ({ id: `__section__${s.id}`, title: s.title, url: '', order: s.order })),
        ...(profile.linksSectionTitle ? [{ id: '__links_title__', title: profile.linksSectionTitle, url: '' }] : []),
        ...(profile.links || []),
    ];

    const { error } = await supabase
        .from('profiles')
        .update({
            handle: profile.handle,
            display_name: profile.displayName,
            bio: profile.bio,
            intake_instructions: profile.intakeInstructions,
            welcome_message: profile.welcomeMessage,
            price_per_message: profile.pricePerMessage,
            avatar_url: profile.avatarUrl,
            response_window_hours: profile.responseWindowHours,
            platforms: profile.platforms,
            links: linksToSave,
            products: profile.products,
            is_premium: profile.isPremium,
            show_likes: profile.showLikes ?? true,
            show_rating: profile.showRating ?? true,
            show_bio: profile.showBio ?? true,
            profile_font: profile.profileFont || 'inter'
        })
        .eq('id', session.session.user.id);

    if (error) throw error;
    return profile;
};

// --- MESSAGES & TRANSACTIONS ---

export const getMessages = async (): Promise<Message[]> => {
    if (!isConfigured) return MockBackend.getMessages();

    const now = Date.now();

    // Fast path: return cache immediately without auth round-trip, refresh in background (once)
    if (_msgCache && _msgCacheUserId && now - _msgCacheTime < MSG_CACHE_TTL) {
        if (!_msgCacheRefreshing) {
            _msgCacheRefreshing = true;
            fetchMessagesFromDb(_msgCacheUserId).then(fresh => {
                _msgCache = fresh;
                _msgCacheTime = Date.now();
            }).catch(() => {}).finally(() => { _msgCacheRefreshing = false; });
        }
        return _msgCache;
    }

    // Cache miss: need auth to identify user
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return [];
    const userId = session.session.user.id;

    const fresh = await fetchMessagesFromDb(userId);
    _msgCache = fresh;
    _msgCacheTime = now;
    _msgCacheUserId = userId;
    return fresh;
};

const fetchMessagesFromDb = async (userId: string): Promise<Message[]> => {
    // Fire-and-forget expiration processing (doesn't block message list)
    // Uses status guard to prevent double-refund: only updates if still PENDING
    const now = new Date().toISOString();
    supabase
        .from('messages')
        .select('id, amount, sender_id')
        .eq('status', 'PENDING')
        .lt('expires_at', now)
        .or(`sender_id.eq.${userId},creator_id.eq.${userId}`)
        .then(({ data: expiredMessages }) => {
            if (expiredMessages && expiredMessages.length > 0) {
                Promise.all(expiredMessages.map(async (msg) => {
                    // Atomically mark as EXPIRED first — only succeeds if still PENDING (prevents double-refund)
                    const { data: updated, error: updateErr } = await supabase
                        .from('messages')
                        .update({ status: 'EXPIRED' })
                        .eq('id', msg.id)
                        .eq('status', 'PENDING')
                        .select('id')
                        .single();

                    if (updateErr || !updated) return; // Already processed by another call

                    // Refund sender
                    const { data: sender } = await supabase.from('profiles').select('credits').eq('id', msg.sender_id).single();
                    if (sender) {
                        await supabase.from('profiles').update({ credits: sender.credits + msg.amount }).eq('id', msg.sender_id);
                    }
                })).catch(console.error);
            }
        }).catch(console.error);

    // Fetch message headers only (no chat_lines — loaded lazily per conversation)
    const { data, error } = await supabase
        .from('messages')
        .select(`
            *,
            sender:profiles!sender_id(display_name, email, avatar_url),
            creator:profiles!creator_id(display_name, email, avatar_url)
        `)
        .or(`sender_id.eq.${userId},creator_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error("Error fetching messages:", error);
        return [];
    }

    return data.map(m => mapDbMessageToAppMessage(m, userId));
};

// Lazy-load chat lines for a specific conversation (cached)
export const getChatLines = async (messageId: string): Promise<ChatMessage[]> => {
    if (!isConfigured) return [];

    const cached = _chatLinesCache.get(messageId);
    if (cached && Date.now() - cached.ts < CHAT_LINES_TTL) {
        return cached.lines;
    }

    const { data, error } = await supabase
        .from('chat_lines')
        .select('*')
        .eq('message_id', messageId)
        .order('created_at', { ascending: true });

    if (error || !data) return [];

    const lines: ChatMessage[] = data.map((line: any) => {
        let content = line.content;
        let attachmentUrl = line.attachment_url;
        if (!attachmentUrl && content?.includes('[Attachment](')) {
            const match = content.match(/\[Attachment\]\((.*?)\)/);
            if (match) { attachmentUrl = match[1]; content = content.replace(match[0], '').trim(); }
        }
        return {
            id: line.id,
            role: line.role as 'CREATOR' | 'FAN',
            content,
            timestamp: line.created_at,
            attachmentUrl: attachmentUrl ?? undefined,
            isEdited: line.updated_at && line.updated_at !== line.created_at,
        };
    });

    _chatLinesCache.set(messageId, { lines, ts: Date.now() });
    return lines;
};

export const sendMessage = async (creatorId: string, senderName: string, senderEmail: string, content: string, amount: number, attachments?: {url: string, type: 'IMAGE' | 'FILE', name: string}[]): Promise<Message> => {
    if (!isConfigured) return MockBackend.sendMessage(creatorId, senderName, senderEmail, content, amount, attachments);

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Must be logged in");

    const userId = session.session.user.id;
    const isProductPurchase = content.startsWith('Purchased Product:');
    const isTip = content.startsWith('Fan Tip:');

    // Check if sending to the Diem admin — special handling (no credits, reuse thread)
    const adminId = await getDiemAdminId();
    const isToAdmin = creatorId === adminId;

    if (isToAdmin) {
        // Find the most recent PENDING thread with admin (either direction)
        const { data: existingThread } = await supabase
            .from('messages')
            .select('id, status')
            .or(`and(sender_id.eq.${userId},creator_id.eq.${creatorId}),and(sender_id.eq.${creatorId},creator_id.eq.${userId})`)
            .eq('status', 'PENDING')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingThread) {
            // Add as chat_line to the open session — no credit charge
            await supabase.from('chat_lines').insert({
                message_id: existingThread.id,
                sender_id: userId,
                role: 'FAN',
                content,
            });
            await supabase.from('messages').update({
                is_read: false,
                updated_at: new Date().toISOString(),
            }).eq('id', existingThread.id);

            invalidateMsgCache();
            invalidateChatLinesCache(existingThread.id);

            const { data: message } = await supabase
                .from('messages')
                .select(`*, sender:profiles!sender_id(display_name, email, avatar_url), creator:profiles!creator_id(display_name, avatar_url)`)
                .eq('id', existingThread.id)
                .single();
            return mapDbMessageToAppMessage(message, userId);
        }

        // No open session — create a new one with no credit charge
        const { data: message, error: msgError } = await supabase
            .from('messages')
            .insert({
                sender_id: userId,
                creator_id: creatorId,
                content,
                amount: 0,
                status: 'PENDING',
                expires_at: new Date(Date.now() + 365 * 24 * 3600000).toISOString(),
                is_read: false,
            })
            .select(`*, sender:profiles!sender_id(display_name, email, avatar_url), creator:profiles!creator_id(display_name, avatar_url)`)
            .single();
        if (msgError) throw msgError;
        invalidateMsgCache();
        return mapDbMessageToAppMessage(message, userId);
    }

    // Validate amount — prevent negative, zero, or non-finite values
    if (!isToAdmin && (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount))) {
        throw new Error("Invalid transaction amount.");
    }
    if (!isToAdmin && amount > 100000) {
        throw new Error("Transaction amount exceeds maximum allowed.");
    }

    // 1. Check Balance (skip for admin messages)
    const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single();
    if (!isToAdmin && (!profile || profile.credits < amount)) {
        throw new Error("Insufficient credits. Please top up.");
    }

    // Check for existing pending request
    // Skip check if this is a product purchase or message to admin
    if (!isProductPurchase && !isTip && !isToAdmin) {
        const { data: pendingMessages } = await supabase
            .from('messages')
            .select('id, content')
            .eq('sender_id', userId)
            .eq('creator_id', creatorId)
            .eq('status', 'PENDING');

        if (pendingMessages && pendingMessages.length > 0) {
            // Only block if there is a pending REGULAR message.
            // Pending product purchases should not block new regular messages.
            const hasPendingRegularMessage = pendingMessages.some(m => !m.content || !m.content.startsWith('Purchased Product:'));

            if (hasPendingRegularMessage) {
                throw new Error("You already have a pending request with this creator. Please wait for a reply.");
            }
        }
    } else if (isProductPurchase) {
        // Check for duplicate purchase
        const { count } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('sender_id', userId)
            .eq('creator_id', creatorId)
            .eq('content', content);

        if (count && count > 0) {
            throw new Error("You have already purchased this product.");
        }
    }

    // 2. Get Creator
    const { data: creatorProfile } = await supabase.from('profiles').select('response_window_hours, email').eq('id', creatorId).single();
    if (!creatorProfile) throw new Error("Creator not found");
    const responseWindow = creatorProfile.response_window_hours || 48;

    // 3. Perform Transaction — atomic deduction with .gte() guard to prevent race condition overdraw
    // A. Deduct Credits (will fail if balance dropped below amount between check and update)
    const { data: deductResult, error: deductError } = await supabase
        .from('profiles')
        .update({ credits: profile.credits - amount })
        .eq('id', userId)
        .gte('credits', amount)
        .select('credits')
        .single();

    if (deductError || !deductResult) {
        throw new Error("Insufficient credits. Please top up.");
    }

    // If product purchase or tip, immediately transfer credits to creator (since it's instant delivery)
    if (isProductPurchase || isTip) {
         const { data: creator } = await supabase.from('profiles').select('credits').eq('id', creatorId).single();
         if (creator) {
             const { error: creditError } = await supabase.from('profiles').update({ credits: creator.credits + amount }).eq('id', creatorId);
             if (creditError) {
                 // Rollback sender deduction if creator credit fails
                 await supabase.from('profiles').update({ credits: deductResult.credits + amount }).eq('id', userId);
                 throw new Error("Transaction failed. Credits have been refunded.");
             }
         }
    }

    // Handle Attachments — join all URLs with ||| into one column
    const combinedAttachmentUrl = attachments && attachments.length > 0
        ? attachments.map(att => att.url).join('|||')
        : undefined;
    let finalContent = content;

    // B. Create Message
    const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert({
            sender_id: userId,
            creator_id: creatorId,
            content: finalContent,
            amount: amount,
            status: (isProductPurchase || isTip) ? 'REPLIED' : 'PENDING',
            attachment_url: combinedAttachmentUrl,
            expires_at: new Date(Date.now() + (responseWindow * 3600000)).toISOString(),
            reply_at: (isProductPurchase || isTip) ? new Date().toISOString() : null,
            is_read: (isProductPurchase || isTip) // Mark as read if product purchase or tip
        })
        .select()
        .single();

    if (msgError) throw msgError;

    // D. Send Email Notification to Creator (via Edge Function)
    // We don't await this to keep the UI responsive
    // NOTE: This will log an error to the console if the 'send-email' Edge Function is not deployed.
    // We attempt to send even if email is missing on client (RLS), hoping Edge Function can resolve it via creatorId
    if (session.session) {
        console.log(`[Email] Triggering notification for Creator ID: ${creatorId}`);
        
        let emailSubject = `New Request from ${senderName}`;
        let emailHeader = "New Priority Request";
        let emailBody = `<p><strong>${senderName}</strong> has sent you a request for <strong>${amount} credits</strong>.</p>`;
        let emailContent = `<div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;"><p style="margin: 0; font-style: italic;">"${content}"</p></div>`;

        if (isProductPurchase) {
            const productName = content.replace('Purchased Product: ', '');
            emailSubject = `New Sale: ${productName}`;
            emailHeader = "New Digital Product Sale";
            emailBody = `<p><strong>${senderName}</strong> purchased <strong>${productName}</strong> for <strong>${amount} credits</strong>.</p>`;
            emailContent = "";
        } else if (isTip) {
            const tipMessage = content.replace('Fan Tip: ', '');
            emailSubject = `New Tip from ${senderName}`;
            emailHeader = "You Received a Tip!";
            emailBody = `<p><strong>${senderName}</strong> sent you a tip of <strong>${amount} credits</strong>.</p>`;
            emailContent = `<div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;"><p style="margin: 0; font-style: italic;">"${tipMessage}"</p></div>`;
        }

        supabase.functions.invoke('send-email', {
            body: {
                creatorId: creatorId,
                // to: creatorProfile.email, // Let Edge Function resolve email via Service Role to ensure accuracy
                subject: emailSubject,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #4f46e5;">${emailHeader}</h1>
                        ${emailBody}
                        ${emailContent}
                        <a href="${getSiteUrl()}" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Dashboard</a>
                    </div>
                `
            },
            headers: {
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            }
        }).then(async ({ error }) => {
            if (error) {
                console.error("Failed to send email notification (Edge Function):", error);
                // Try to read the specific error message from the response body
                if (error instanceof Error && 'context' in error) {
                    const response = (error as any).context as Response;
                    if (response && typeof response.json === 'function') {
                        const body = await response.json().catch(() => ({}));
                        console.error("Edge Function Error Details:", body);
                    }
                }
            } else {
                console.log("[Email] Notification sent successfully");
            }
        });
    }

    // Invalidate message cache so next fetch is fresh
    invalidateMsgCache();

    // Return formatted
    return mapDbMessageToAppMessage(message, userId);
};

export const replyToMessage = async (messageId: string, replyText: string, isComplete: boolean, attachmentUrl?: string | null): Promise<void> => {
    if (!isConfigured) return MockBackend.replyToMessage(messageId, replyText, isComplete, attachmentUrl);
    invalidateMsgCache();
    invalidateChatLinesCache(messageId);

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Not logged in");

    // Check status before replying
    const { data: msgCheck } = await supabase.from('messages').select('status, expires_at, sender_id, creator_id').eq('id', messageId).single();
    if (!msgCheck) throw new Error("Message not found");

    const adminId = await getDiemAdminId();
    const isAdminThread = msgCheck.sender_id === adminId || msgCheck.creator_id === adminId;

    // If the admin session is already closed, start a fresh one instead of appending to it
    if (isAdminThread && msgCheck.status === 'REPLIED') {
        const currentUserId = session.session.user.id;
        const otherPartyId = msgCheck.creator_id === currentUserId ? msgCheck.sender_id : msgCheck.creator_id;
        const { error: newMsgError } = await supabase.from('messages').insert({
            sender_id: currentUserId,
            creator_id: otherPartyId,
            content: replyText,
            amount: 0,
            status: 'PENDING',
            expires_at: new Date(Date.now() + 365 * 24 * 3600000).toISOString(),
            is_read: false,
        });
        if (newMsgError) throw newMsgError;
        invalidateMsgCache();
        return;
    }

    if (!isAdminThread) {
        if (msgCheck.status !== 'PENDING') {
             throw new Error(`Cannot reply. Message is ${msgCheck.status}`);
        }
        if (new Date(msgCheck.expires_at) < new Date()) {
            throw new Error("Message has expired and cannot be replied to.");
        }
    }

    // 1. Add Chat Line
    if (replyText.trim() || attachmentUrl) {
        // If the current user is the original sender (e.g. Diem Official replying to a welcome
        // message they sent), use 'FAN' so the reply displays on the correct side in both views.
        const currentUserId = session.session.user.id;
        const replyRole = msgCheck.creator_id === currentUserId ? 'CREATOR' : 'FAN';

        const payload: any = {
            message_id: messageId,
            sender_id: currentUserId,
            role: replyRole,
            content: replyText
        };
        if (attachmentUrl) {
            payload.attachment_url = attachmentUrl;
        }

        const { error: chatError } = await supabase.from('chat_lines').insert(payload);

        if (chatError) {
            // Fallback for missing column (PGRST204)
            if ((chatError.code === 'PGRST204' || chatError.code === '42703') && attachmentUrl) {
                 const fallbackContent = `${replyText.trim()}\n\nAttachment`;
                 const { error: retryError } = await supabase.from('chat_lines').insert({
                    message_id: messageId,
                    sender_id: currentUserId,
                    role: replyRole,
                    content: fallbackContent
                 });
                 if (retryError) throw retryError;
            } else {
                throw chatError;
            }
        }

        // Touch message to trigger realtime + mark unread (merged with status update below if isComplete)
        if (!isComplete) {
            await supabase.from('messages').update({ is_read: false, updated_at: new Date().toISOString() }).eq('id', messageId);
        }
    }

    // For admin threads: honour session completion and send email — no credit transfer
    if (isAdminThread) {
        if (isComplete) {
            await supabase.from('messages').update({
                status: 'REPLIED',
                reply_at: new Date().toISOString(),
                is_read: false,
                updated_at: new Date().toISOString(),
            })
            .eq('id', messageId)
            .eq('status', 'PENDING');
        } else {
            await supabase.from('messages').update({ is_read: false, updated_at: new Date().toISOString() }).eq('id', messageId);
        }

        // Send email notification to the other party when there is new content
        if (replyText.trim() || attachmentUrl) {
            const currentUserId = session.session.user.id;
            const isCurrentUserCreator = msgCheck.creator_id === currentUserId;
            const { data: fullMsg } = await supabase
                .from('messages')
                .select('sender:profiles!sender_id(email, display_name), creator:profiles!creator_id(email, display_name)')
                .eq('id', messageId)
                .single();

            if (fullMsg) {
                const recipientEmail = isCurrentUserCreator
                    ? (fullMsg.sender as any)?.email
                    : (fullMsg.creator as any)?.email;
                const recipientName = isCurrentUserCreator
                    ? ((fullMsg.sender as any)?.display_name || 'Diem')
                    : ((fullMsg.creator as any)?.display_name || 'Creator');
                const replierName = isCurrentUserCreator
                    ? ((fullMsg.creator as any)?.display_name || 'Creator')
                    : 'Diem Official';

                if (recipientEmail) {
                    supabase.functions.invoke('send-email', {
                        body: {
                            to: recipientEmail,
                            subject: `${replierName} replied to your message`,
                            html: `
                                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                                    <h1 style="color: #4f46e5;">New Reply</h1>
                                    <p>Hi <strong>${recipientName}</strong>,</p>
                                    <p><strong>${replierName}</strong> replied to your message.</p>
                                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                                        <p style="margin: 0; font-style: italic;">"${replyText || 'Check the dashboard for the attachment.'}"</p>
                                    </div>
                                    <a href="${getSiteUrl()}" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Dashboard</a>
                                </div>
                            `
                        },
                        headers: {
                            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                        }
                    }).then(({ error }) => {
                        if (error) console.error('[Email] Admin thread notification failed:', error);
                    });
                }
            }
        }

        invalidateMsgCache();
        return;
    }

    // 2. Status update for complete replies — atomic guard prevents double-payout
    if (isComplete) {
        const { data: statusUpdate, error: msgError } = await supabase.from('messages').update({
            status: 'REPLIED',
            reply_at: new Date().toISOString(),
            is_read: false,
            updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .eq('status', 'PENDING')
        .select('id, amount')
        .single();

        if (msgError || !statusUpdate) {
            // Message already replied or processed — skip credit transfer
            console.warn('Message already processed, skipping credit transfer for:', messageId);
        } else {
            // 3. Credit transfer for complete replies (only if status transition succeeded)
            const { data: creator } = await supabase.from('profiles').select('credits').eq('id', session.session.user.id).single();
            if (creator && statusUpdate.amount > 0) {
                await supabase.from('profiles').update({ credits: creator.credits + statusUpdate.amount }).eq('id', session.session.user.id);
            }
        }

        // Send Email Notification to Fan
        const { data: fullMsg } = await supabase
            .from('messages')
            .select(`
                sender:profiles!sender_id(email, display_name),
                creator:profiles!creator_id(display_name)
            `)
            .eq('id', messageId)
            .single();

        if (fullMsg && fullMsg.sender?.email) {
            const fanEmail = fullMsg.sender.email;
            const fanName = fullMsg.sender.display_name || 'Fan';
            const creatorName = fullMsg.creator?.display_name || 'Creator';
            
            console.log(`[Email] Sending reply notification to Fan: ${fanEmail}`);

            supabase.functions.invoke('send-email', {
                body: {
                    to: fanEmail,
                    subject: `${creatorName} replied to your request!`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                            <h1 style="color: #4f46e5;">Response Received!</h1>
                            <p>Hi <strong>${fanName}</strong>,</p>
                            <p><strong>${creatorName}</strong> has replied to your request.</p>
                            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 0; font-style: italic;">"${replyText || 'Check the dashboard for the attachment.'}"</p>
                            </div>
                            <a href="${getSiteUrl()}" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Reply</a>
                        </div>
                    `
                },
                headers: {
                    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                }
            }).then(({ error }) => {
                if (error) console.error("Failed to send fan email:", error);
            });
        }
    }
};

export const editChatMessage = async (chatLineId: string, newContent: string, attachmentUrl?: string | null): Promise<void> => {
    if (!isConfigured) return;
    invalidateMsgCache();

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Not logged in");

    // Handle synthetic init IDs (e.g. "msgId-init") — these are parent message rows, not chat_lines
    if (chatLineId.endsWith('-init')) {
        const parentId = chatLineId.replace(/-init$/, '');
        const updatePayload: any = { content: newContent };
        if (attachmentUrl !== undefined) {
            updatePayload.attachment_url = attachmentUrl;
        }
        const { error } = await supabase
            .from('messages')
            .update(updatePayload)
            .eq('id', parentId);
        if (error) throw error;
        return;
    }

    // Try updating with updated_at + attachment_url
    const updatePayload: any = {
        content: newContent,
        updated_at: new Date().toISOString()
    };
    if (attachmentUrl !== undefined) {
        updatePayload.attachment_url = attachmentUrl;
    }

    const { error } = await supabase
        .from('chat_lines')
        .update(updatePayload)
        .eq('id', chatLineId)
        .eq('sender_id', session.session.user.id);

    if (error) {
        // Fallback: column may not exist — try minimal update
        let fallbackContent = newContent;
        if (attachmentUrl) {
            fallbackContent = `${newContent.trim()}\n\n[Attachment](${attachmentUrl})`;
        }

        const { error: retryError } = await supabase
            .from('chat_lines')
            .update({ content: fallbackContent })
            .eq('id', chatLineId)
            .eq('sender_id', session.session.user.id);

        if (retryError) throw retryError;
    }
};

export const deleteChatLine = async (chatLineId: string): Promise<void> => {
    if (!isConfigured) return;

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Not logged in");

    const { error } = await supabase
        .from('chat_lines')
        .delete()
        .eq('id', chatLineId)
        .eq('sender_id', session.session.user.id);

    if (error) throw error;
};

export const cancelMessage = async (messageId: string): Promise<void> => {
    if (!isConfigured) return MockBackend.cancelMessage(messageId);
    invalidateMsgCache();
    invalidateChatLinesCache(messageId);

    // 1. Get Message to check amount
    const { data: msg } = await supabase.from('messages').select('*').eq('id', messageId).single();
    if (!msg) return;

    // 2. Atomically mark as CANCELLED (only if still PENDING — prevents double-refund)
    if (msg.status === 'PENDING') {
        const { data: updated, error: cancelErr } = await supabase
            .from('messages')
            .update({ status: 'CANCELLED' })
            .eq('id', messageId)
            .eq('status', 'PENDING')
            .select('id')
            .single();

        if (cancelErr || !updated) return; // Already processed

        // 3. Refund Sender
        const { data: sender } = await supabase.from('profiles').select('credits').eq('id', msg.sender_id).single();
        if (sender) {
            await supabase.from('profiles').update({ credits: sender.credits + msg.amount }).eq('id', msg.sender_id);
        }
    }
};

export const markMessageAsRead = async (messageId: string): Promise<void> => {
    if (!isConfigured) return MockBackend.markMessageAsRead(messageId);

    await supabase.from('messages').update({ is_read: true }).eq('id', messageId);
};

export const addCredits = async (amount: number): Promise<CurrentUser> => {
    if (!isConfigured) return MockBackend.addCredits(amount);

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("No user");

    // amount=0 means just refresh balance — don't write to DB
    if (amount > 0) {
        const { data: profile } = await supabase.from('profiles').select('credits').eq('id', session.session.user.id).single();
        const newBalance = (profile?.credits || 0) + amount;
        await supabase.from('profiles').update({ credits: newBalance }).eq('id', session.session.user.id);
    }

    // Return updated user object
    const { data: updated } = await supabase.from('profiles').select('*').eq('id', session.session.user.id).single();
    return mapProfileToUser(updated);
};

export const createCheckoutSession = async (credits: number, returnUrl?: string): Promise<{ url: string | null }> => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error('Not authenticated');

    try {
        const testMode = !import.meta.env.PROD || !import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_LIVE;
        const resolvedReturnUrl = returnUrl || (typeof window !== 'undefined' ? window.location.origin + '/dashboard' : undefined);
        const res = await supabase.functions.invoke('create-payment-intent', {
            body: { credits, testMode, returnUrl: resolvedReturnUrl },
            headers: {
                Authorization: `Bearer ${session.session.access_token}`,
            },
        });

        if (res.error) throw new Error(res.error.message || 'Failed to create checkout session');
        return { url: res.data.url };
    } catch (e) {
        console.error('Create Checkout Session Error:', e);
        throw e;
    }
};

export const uploadProductFile = async (file: File, creatorId: string): Promise<string> => {
    if (!isConfigured) return MockBackend.uploadProductFile(file, creatorId);

    console.log(`[RealBackend] Uploading file to Supabase: ${file.name} for creator: ${creatorId}`);

    const fileExt = file.name.split('.').pop();
    const fileName = `${creatorId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('products').getPublicUrl(fileName);
    console.log(`[RealBackend] File uploaded successfully: ${data.publicUrl}`);
    return data.publicUrl;
};

export const getPurchasedProducts = async (): Promise<any[]> => {
    if (!isConfigured) return MockBackend.getPurchasedProducts();

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return [];
    const userId = session.session.user.id;

    // 1. Find messages that look like purchases
    const { data: messages, error } = await supabase
        .from('messages')
        .select('id, content, creator_id, created_at, amount')
        .eq('sender_id', userId)
        .ilike('content', 'Purchased Product:%');

    if (error || !messages || messages.length === 0) return [];

    // 2. Get unique creator IDs and fetch their profiles (including products AND links)
    const creatorIds = [...new Set(messages.map(m => m.creator_id))];
    const { data: creators } = await supabase.from('profiles').select('id, display_name, avatar_url, products, links').in('id', creatorIds);
    if (!creators) return [];

    const products: any[] = [];
    
    for (const msg of messages) {
        const productName = msg.content.replace('Purchased Product: ', '').trim();
        const creator = creators.find(c => c.id === msg.creator_id);
        
        if (creator) {
            // Try to find product details in 'products' column OR 'links' column (where dashboard saves them)
            let productDetails = (creator.products as any[])?.find((p: any) => p.title === productName);
            
            if (!productDetails && creator.links) {
                productDetails = (creator.links as any[]).find((l: any) => l.title === productName && l.type === 'DIGITAL_PRODUCT');
            }

            if (productDetails) {
                products.push({
                    purchaseId: msg.id, 
                    purchaseDate: msg.created_at, 
                    creatorName: creator.display_name, 
                    creatorAvatar: creator.avatar_url,
                    creatorId: creator.id,
                    title: productDetails.title, 
                    description: productDetails.description || 'Digital Download', 
                    url: productDetails.url, // Store original URL, signed URL generated on demand
                    price: msg.amount, 
                    type: 'DIGITAL_PRODUCT'
                });
            }
        }
    }
    return products.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
};

export const getSecureDownloadUrl = async (productId: string, productUrl: string, creatorId: string): Promise<string> => {
    if (!isConfigured) {
        // In mock mode, the URL is already a Base64 Data URL, so it's directly usable
        return MockBackend.getSecureDownloadUrl(productId, productUrl, creatorId);
    }

    if (!creatorId) throw new Error("Creator ID is missing.");

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Must be logged in to download.");
    const userId = session.session.user.id;

    // 1. Verify purchase record
    const { count, error: purchaseError } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', userId)
        .eq('creator_id', creatorId)
        .eq('content', `Purchased Product: ${productId}`); // Use eq for exact match to avoid 400 errors

    if (purchaseError) {
        console.error("Purchase verification failed:", purchaseError);
        throw new Error(`Verification failed: ${purchaseError.message}`);
    }
    if (count === 0) throw new Error("Purchase not found or not authorized.");

    // 2. Generate Signed URL for Supabase Storage file
    if (productUrl && productUrl.includes('/storage/v1/object/public/products/')) {
        try {
            const path = productUrl.split('/products/')[1];
            if (path) {
                const decodedPath = decodeURIComponent(path);
                // Download directly as Blob to avoid time-limited signed URLs and ensure privacy
                const { data: blob, error: downloadError } = await supabase.storage.from('products').download(decodedPath);
                if (downloadError) throw downloadError;
                if (blob) {
                    return URL.createObjectURL(blob);
                }
            }
        } catch (e: any) {
            console.error("Failed to download file:", e);
            throw new Error(e.message || "Failed to download file.");
        }
    }
    
    // If it's not a Supabase Storage URL, or signing failed, return original URL (e.g., external link)
    return productUrl;
};

export const logAnalyticsEvent = async (creatorId: string, eventType: 'VIEW' | 'CLICK' | 'CONVERSION', metadata: any = {}) => {
    if (!isConfigured) return MockBackend.logAnalyticsEvent(creatorId, eventType, metadata);

    const params = new URLSearchParams(window.location.search);
    let rawSource = params.get('utm_source') || params.get('source');
    let source = 'Direct Link';
    
    if (rawSource) {
        const s = rawSource.toLowerCase();
        if (s.includes('youtube') || s === 'yt_desc') source = 'YouTube';
        else if (s.includes('instagram') || s === 'ig_bio' || s === 'ig_story') source = 'Instagram';
        else if (s.includes('twitter') || s === 'x' || s === 'tw_bio') source = 'X (Twitter)';
        else if (s.includes('tiktok') || s === 'tt_bio') source = 'TikTok';
        else if (s.includes('twitch')) source = 'Twitch';
        else if (s === 'search') source = 'Google Search';
        else source = 'Shared Link';
    } else {
        const referrer = document.referrer;
        if (referrer) {
            try {
                const url = new URL(referrer);
                const hostname = url.hostname.toLowerCase();

                if (hostname.includes('youtube') || hostname.includes('youtu.be')) source = 'YouTube';
                else if (hostname.includes('instagram')) source = 'Instagram';
                else if (hostname.includes('twitter') || hostname.includes('x.com') || hostname.includes('t.co')) source = 'X (Twitter)';
                else if (hostname.includes('tiktok')) source = 'TikTok';
                else if (hostname.includes('twitch')) source = 'Twitch';
                else if (hostname.includes('google')) source = 'Google Search';
                else if (hostname.includes('bing')) source = 'Bing Search';
                else if (hostname.includes('yahoo') || hostname.includes('duckduckgo') || hostname.includes('baidu')) source = 'Web Search';
                else source = 'Shared Link';
            } catch {
                source = 'Shared Link';
            }
        } else {
            source = 'Direct Link';
        }
    }

    const { error } = await supabase.from('analytics_events').insert({
        creator_id: creatorId,
        event_type: eventType,
        source: source,
        metadata
    });

    if (error) {
        // Suppress 404/missing table errors to avoid console noise
        if (error.code !== '42P01' && error.code !== '404' && error.code !== 'PGRST205') {
             console.warn("Failed to log analytics event:", error);
        }
    }
};

export const getCreatorTrendingStatus = async (creatorId: string): Promise<{ isTrending: boolean; interactionCount: number }> => {
    if (!isConfigured) {
        // Mock: use profileViews as a rough proxy
        return { isTrending: false, interactionCount: 0 };
    }

    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const { count, error } = await supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', creatorId)
        .gte('created_at', oneDayAgo.toISOString());

    if (error) {
        console.warn('Failed to check trending status:', error);
        return { isTrending: false, interactionCount: 0 };
    }

    const interactionCount = count || 0;
    // Trending threshold: 5+ interactions in 24 hours
    return { isTrending: interactionCount >= 5, interactionCount };
};

export const getProAnalytics = async (range: '1D' | '7D' | '30D' | 'ALL' = '30D'): Promise<ProAnalyticsData | null> => {
    if (!isConfigured) return MockBackend.getProAnalytics();

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return null;
    const creatorId = session.session.user.id;

    const cutoff = new Date();
    if (range === '1D') cutoff.setDate(cutoff.getDate() - 1);
    else if (range === '7D') cutoff.setDate(cutoff.getDate() - 7);
    else if (range === '30D') cutoff.setDate(cutoff.getDate() - 30);
    else cutoff.setFullYear(2000); // ALL

    const eventsQuery = supabase
        .from('analytics_events')
        .select('*')
        .eq('creator_id', creatorId)
        .gte('created_at', cutoff.toISOString());

    const messagesQuery = supabase
        .from('messages')
        .select('amount, content')
        .eq('creator_id', creatorId)
        .eq('status', 'COLLECTED')
        .gte('created_at', cutoff.toISOString());

    const [{ data: events }, { data: collectedMessages }] = await Promise.all([eventsQuery, messagesQuery]);

    if (!events || events.length === 0) {
        // Return empty real data structure instead of mock data if configured
        return {
            trafficSources: [],
            funnel: [
                { name: 'Profile Views', count: 0, fill: '#6366F1' },
                { name: 'Interactions', count: 0, fill: '#818CF8' },
                { name: 'Conversions', count: 0, fill: '#4ADE80' }
            ],
            topAssets: [],
            audienceType: { new: 100, returning: 0 }
        };
    }

    // 1. Traffic Sources — normalize into 5 fixed categories
    const normalizeSource = (raw: string): string => {
        const s = (raw || '').toLowerCase();
        if (s.includes('google') || s.includes('bing') || s.includes('search')) return 'Google Search';
        if (s.includes('instagram')) return 'Instagram';
        if (s.includes('tiktok')) return 'TikTok';
        if (s.includes('twitter') || s.includes('x.com')) return 'Twitter';
        return 'Direct Link';
    };
    const SOURCE_COLORS: Record<string, string> = {
        'Google Search': '#4285F4',
        'Instagram': '#E1306C',
        'TikTok': '#000000',
        'Twitter': '#1DA1F2',
        'Direct Link': '#64748b',
    };

    const views = events.filter(e => e.event_type === 'VIEW');
    const sources: Record<string, number> = {};
    views.forEach(v => {
        const s = normalizeSource(v.source || '');
        sources[s] = (sources[s] || 0) + 1;
    });

    const trafficSources = Object.entries(sources)
        .map(([name, value]) => ({ name, value, color: SOURCE_COLORS[name] || '#64748b' }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    // 2. Funnel
    const clicks = events.filter(e => e.event_type === 'CLICK').length;
    const conversions = events.filter(e => e.event_type === 'CONVERSION').length;

    const funnel = [
        { name: 'Profile Views', count: views.length, fill: '#6366F1' },
        { name: 'Interactions', count: clicks + conversions, fill: '#818CF8' },
        { name: 'Conversions', count: conversions, fill: '#4ADE80' }
    ];

    // 3. Top Assets (Real Aggregation)
    const assetStats: Record<string, { clicks: number, revenue: number, type: string, title: string }> = {};

    // Track links (CLICK/CONVERSION with id)
    events.filter(e => (e.event_type === 'CLICK' || e.event_type === 'CONVERSION') && e.metadata?.id).forEach(e => {
        const id = e.metadata.id;
        if (!assetStats[id]) {
            assetStats[id] = { clicks: 0, revenue: 0, type: e.metadata.type || 'LINK', title: e.metadata.title || 'Unknown Asset' };
        }
        assetStats[id].clicks++;
        // Links have no revenue; products log price on CONVERSION
        if (e.event_type === 'CONVERSION' && e.metadata?.price) {
            assetStats[id].revenue += e.metadata.price;
        }
    });

    // Use collected messages for reliable revenue attribution
    const msgs = collectedMessages || [];
    const diemMsgs = msgs.filter(m => !m.content?.startsWith('Purchased Product:') && !m.content?.startsWith('Fan Tip:'));
    const productMsgs = msgs.filter(m => m.content?.startsWith('Purchased Product:'));
    const tipMsgs = msgs.filter(m => m.content?.startsWith('Fan Tip:'));

    // Attribute product revenue to matching assetStats entries
    productMsgs.forEach(m => {
        const title = m.content.replace('Purchased Product: ', '');
        const entry = Object.values(assetStats).find(s => s.type === 'PRODUCT' && s.title === title);
        if (entry) entry.revenue += m.amount || 0;
    });

    // DIEM messages
    const diemConversions = events.filter(e => e.event_type === 'CONVERSION' && e.metadata?.type === 'MESSAGE');
    if (diemConversions.length > 0 || diemMsgs.length > 0) {
        assetStats['__diem__'] = {
            clicks: diemConversions.length,
            revenue: diemMsgs.reduce((sum, m) => sum + (m.amount || 0), 0),
            type: 'DIEM',
            title: 'DIEM Messages',
        };
    }

    // Tips
    const tipConversions = events.filter(e => e.event_type === 'CONVERSION' && e.metadata?.type === 'TIP');
    if (tipConversions.length > 0 || tipMsgs.length > 0) {
        assetStats['__tip__'] = {
            clicks: tipConversions.length,
            revenue: tipMsgs.reduce((sum, m) => sum + (m.amount || 0), 0),
            type: 'TIP',
            title: 'Fan Tips',
        };
    }

    const profileViews = views.length || 1;
    const topAssets = Object.entries(assetStats)
        .map(([id, stat]) => ({ id, title: stat.title, type: stat.type, clicks: stat.clicks, revenue: stat.revenue, ctr: stat.clicks > 0 ? `${(stat.clicks / profileViews * 100).toFixed(1)}%` : '0%' }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5);

    return {
        trafficSources,
        funnel,
        topAssets,
        audienceType: { new: 100, returning: 0 } // Placeholder
    };
};

export const getHistoricalStats = (): MonthlyStat[] => MockBackend.getHistoricalStats();

export const getDetailedStatistics = async (timeFrame: StatTimeFrame, date: Date): Promise<DetailedStat[]> => {
    if (!isConfigured) return MockBackend.getDetailedStatistics(timeFrame, date);

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return [];
    const creatorId = session.session.user.id;

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    if (timeFrame === 'DAILY') {
        startDate.setDate(endDate.getDate() - 6);
    } else if (timeFrame === 'WEEKLY') {
        startDate.setDate(endDate.getDate() - 27); // 4 weeks
    } else if (timeFrame === 'MONTHLY') {
        startDate.setMonth(endDate.getMonth() - 5); // 6 months
        startDate.setDate(1);
    } else {
        startDate.setMonth(endDate.getMonth() - 11); // 12 months
        startDate.setDate(1);
    }

    // Fetch Data
    const [viewsResult, likesResult, ratingsResult, repliedResult] = await Promise.all([
        supabase.from('analytics_events').select('created_at').eq('creator_id', creatorId).eq('event_type', 'VIEW').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
        supabase.from('creator_likes').select('created_at').eq('creator_id', creatorId).gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
        supabase.from('messages').select('created_at, rating').eq('creator_id', creatorId).gt('rating', 0).gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
        supabase.from('messages').select('created_at, reply_at').eq('creator_id', creatorId).eq('status', 'REPLIED').not('reply_at', 'is', null).gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString())
    ]);

    const views = viewsResult.data || [];
    const likes = likesResult.data || [];
    const ratings = ratingsResult.data || [];
    const repliedMessages = repliedResult.data || [];

    // Initialize Buckets
    const stats: DetailedStat[] = [];
    const count = timeFrame === 'DAILY' ? 7 : timeFrame === 'WEEKLY' ? 4 : timeFrame === 'MONTHLY' ? 6 : 12;

    for (let i = 0; i < count; i++) {
        let label = '';
        let bucketStart = new Date();
        let bucketEnd = new Date();

        if (timeFrame === 'DAILY') {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            label = d.toLocaleDateString('en-US', { weekday: 'short' });
            bucketStart = new Date(d.setHours(0,0,0,0));
            bucketEnd = new Date(d.setHours(23,59,59,999));
        } else if (timeFrame === 'WEEKLY') {
            label = `Wk ${i + 1}`;
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + (i * 7));
            bucketStart = new Date(d.setHours(0,0,0,0));
            const e = new Date(d);
            e.setDate(d.getDate() + 6);
            bucketEnd = new Date(e.setHours(23,59,59,999));
        } else {
            const d = new Date(startDate);
            d.setMonth(startDate.getMonth() + i);
            label = d.toLocaleDateString('en-US', { month: 'short' });
            bucketStart = new Date(d.getFullYear(), d.getMonth(), 1);
            bucketEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        }

        const bucketViews = views.filter(v => new Date(v.created_at) >= bucketStart && new Date(v.created_at) <= bucketEnd).length;
        const bucketLikes = likes.filter(l => new Date(l.created_at) >= bucketStart && new Date(l.created_at) <= bucketEnd).length;
        const bucketRatings = ratings.filter(r => new Date(r.created_at) >= bucketStart && new Date(r.created_at) <= bucketEnd);
        const avgRating = bucketRatings.length > 0 ? bucketRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / bucketRatings.length : 0;

        const bucketReplied = repliedMessages.filter(m => new Date(m.created_at) >= bucketStart && new Date(m.created_at) <= bucketEnd);
        let avgResponseTime = 0;
        if (bucketReplied.length > 0) {
             const totalTime = bucketReplied.reduce((acc, m) => acc + (new Date(m.reply_at).getTime() - new Date(m.created_at).getTime()), 0);
             avgResponseTime = totalTime / bucketReplied.length / (1000 * 60 * 60);
        }

        stats.push({ date: label, views: bucketViews, likes: bucketLikes, rating: parseFloat(avgRating.toFixed(1)), responseTime: parseFloat(avgResponseTime.toFixed(1)) });
    }

    return stats;
};

export const getFinancialStatistics = async (timeFrame: StatTimeFrame, date: Date): Promise<DetailedFinancialStat[]> => {
    if (!isConfigured) return MockBackend.getFinancialStatistics(timeFrame, date);

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return [];
    const creatorId = session.session.user.id;

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    let count = 0;

    if (timeFrame === 'DAILY') {
        startDate.setDate(endDate.getDate() - 6);
        count = 7;
    } else if (timeFrame === 'WEEKLY') {
        startDate.setDate(endDate.getDate() - 27); // 4 weeks
        count = 4;
    } else if (timeFrame === 'MONTHLY') {
        startDate.setMonth(endDate.getMonth() - 5); // 6 months
        startDate.setDate(1);
        count = 6;
    } else { // YEARLY
        startDate.setFullYear(endDate.getFullYear(), 0, 1); // Jan 1st of current year
        startDate.setHours(0, 0, 0, 0);
        count = 12;
    }

    // Fetch messages (Earnings)
    // We include 'REPLIED' messages. Product purchases are 'REPLIED' immediately.
    const { data: messages } = await supabase
        .from('messages')
        .select('created_at, amount, content')
        .eq('creator_id', creatorId)
        .eq('status', 'REPLIED')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

    const msgs = messages || [];

    // Bucketing
    const stats: DetailedFinancialStat[] = [];

    for (let i = 0; i < count; i++) {
        let label = '';
        let bucketStart = new Date();
        let bucketEnd = new Date();

        if (timeFrame === 'DAILY') {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            label = d.toLocaleDateString('en-US', { weekday: 'short' });
            bucketStart = new Date(d.setHours(0,0,0,0));
            bucketEnd = new Date(d.setHours(23,59,59,999));
        } else if (timeFrame === 'WEEKLY') {
            label = `Wk ${i + 1}`;
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + (i * 7));
            bucketStart = new Date(d.setHours(0,0,0,0));
            const e = new Date(d);
            e.setDate(d.getDate() + 6);
            bucketEnd = new Date(e.setHours(23,59,59,999));
        } else { // MONTHLY or YEARLY
            const d = new Date(startDate);
            d.setMonth(startDate.getMonth() + i);
            label = d.toLocaleDateString('en-US', { month: 'short' });
            bucketStart = new Date(d.getFullYear(), d.getMonth(), 1);
            bucketEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        }

        const bucketMsgs = msgs.filter(m => new Date(m.created_at) >= bucketStart && new Date(m.created_at) <= bucketEnd);
        
        const totalRevenue = bucketMsgs.reduce((sum, m) => sum + m.amount, 0);
        const productRevenue = bucketMsgs.filter(m => m.content.startsWith('Purchased Product:')).reduce((sum, m) => sum + m.amount, 0);
        const messageRevenue = totalRevenue - productRevenue;
        
        stats.push({
            date: label,
            totalRevenue,
            messageRevenue,
            productRevenue,
            tips: 0 // Not tracking tips in this query yet
        });
    }

    return stats;
};

export const rateMessage = async (messageId: string, rating: number, reviewContent?: string): Promise<void> => {
    if (!isConfigured) return MockBackend.rateMessage(messageId, rating, reviewContent);

    const { error } = await supabase
        .from('messages')
        .update({ rating, review_content: reviewContent })
        .eq('id', messageId);
    if (error) throw error;
};

export const sendFanAppreciation = async (messageId: string, text: string): Promise<void> => {
    if (!isConfigured) return MockBackend.sendFanAppreciation(messageId, text);

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Not logged in");

    // Check for existing appreciation to enforce "once only"
    const { count } = await supabase
        .from('chat_lines')
        .select('*', { count: 'exact', head: true })
        .eq('message_id', messageId)
        .eq('role', 'FAN')
        .ilike('content', 'Fan Appreciation:%');

    if (count && count > 0) {
        throw new Error("You have already sent appreciation for this message.");
    }

    const userId = session.session.user.id;
    
    // Fetch sender name for email
    const { data: senderProfile } = await supabase.from('profiles').select('display_name').eq('id', userId).single();
    
    // Deduct credits (50) for the tip — atomic with .gte() guard
    const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single();
    if (!profile || profile.credits < 50) {
        throw new Error("Insufficient credits to send appreciation (50 credits).");
    }

    const { data: deductResult, error: deductErr } = await supabase
        .from('profiles')
        .update({ credits: profile.credits - 50 })
        .eq('id', userId)
        .gte('credits', 50)
        .select('credits')
        .single();

    if (deductErr || !deductResult) {
        throw new Error("Insufficient credits to send appreciation (50 credits).");
    }

    // Add credits to creator
    const { data: msg } = await supabase.from('messages').select('creator_id').eq('id', messageId).single();
    if (msg) {
         const { data: creator } = await supabase.from('profiles').select('credits').eq('id', msg.creator_id).single();
         if (creator) {
             const { error: creditErr } = await supabase.from('profiles').update({ credits: creator.credits + 50 }).eq('id', msg.creator_id);
             if (creditErr) {
                 // Rollback sender deduction
                 await supabase.from('profiles').update({ credits: deductResult.credits + 50 }).eq('id', userId);
                 throw new Error("Failed to send appreciation. Credits have been refunded.");
             }
         }
    }

    // Insert chat line
    await supabase.from('chat_lines').insert({
        message_id: messageId,
        sender_id: userId,
        role: 'FAN',
        content: `Fan Appreciation: ${text}`
    });

    // Touch message to trigger realtime update for Creator
    await supabase.from('messages').update({ 
        updated_at: new Date().toISOString() 
    }).eq('id', messageId);

    // Send Email Notification
    if (msg && msg.creator_id) {
        const senderName = senderProfile?.display_name || 'Fan';
        console.log(`[Email] Triggering tip notification for Creator ID: ${msg.creator_id}`);
        
        supabase.functions.invoke('send-email', {
            body: {
                creatorId: msg.creator_id,
                subject: `New Tip from ${senderName}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #4f46e5;">You Received a Tip!</h1>
                        <p><strong>${senderName}</strong> sent you a tip of <strong>50 credits</strong> on an existing conversation.</p>
                        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0; font-style: italic;">"${text}"</p>
                        </div>
                        <a href="${getSiteUrl()}" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Conversation</a>
                    </div>
                `
            },
            headers: {
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            }
        });
    }
};

export const subscribeToMessages = (userId: string, onUpdate: () => void) => {
    if (!isConfigured) return { unsubscribe: () => {} };

    const subscription = supabase
        .channel('public:messages')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'messages', 
            filter: `sender_id=eq.${userId}` 
        }, onUpdate)
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'messages', 
            filter: `creator_id=eq.${userId}` 
        }, onUpdate)
        .subscribe();

    return { unsubscribe: () => {
        supabase.removeChannel(subscription);
    }};
};

export const getFeaturedCreators = async (): Promise<CreatorProfile[]> => {
    if (!isConfigured) return MockBackend.getFeaturedCreators();

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'CREATOR')
        .order('display_name', { ascending: true })
        .limit(20);

    if (error || !data) return [];

    // Fetch real likes (Publicly readable)
    const creatorIds = data.map(p => p.id);
    const { data: allLikes } = await supabase.from('creator_likes').select('creator_id').in('creator_id', creatorIds);

    const likesMap: Record<string, number> = {};
    if (allLikes) {
        allLikes.forEach(l => {
            likesMap[l.creator_id] = (likesMap[l.creator_id] || 0) + 1;
        });
    }

    // Fetch stats securely for each creator using RPC to bypass RLS
    const creatorsWithStats = await Promise.all(data.map(async (p) => {
        let averageRating = 5.0;
        let reviewCount = 0;
        let responseTimeAvg = 'Standard';
        
        // Try RPC
        const { data: rpcStats, error: rpcError } = await supabase.rpc('get_creator_stats', { target_creator_id: p.id });

        if (!rpcError && rpcStats) {
            averageRating = rpcStats.averageRating;
            reviewCount = rpcStats.reviewCount;
            
            const hours = rpcStats.avgResponseHours;
            if (hours === null || hours === undefined) responseTimeAvg = 'Standard';
            else if (hours < 1) responseTimeAvg = 'Lightning';
            else if (hours < 4) responseTimeAvg = 'Very Fast';
            else if (hours < 24) responseTimeAvg = 'Fast';
            else responseTimeAvg = 'Standard';
        } else {
            // Fallback (RLS restricted)
             const { count, data: msgs } = await supabase
                .from('messages')
                .select('rating', { count: 'exact' })
                .eq('creator_id', p.id)
                .gt('rating', 0);
             
             if (msgs && msgs.length > 0) {
                 const sum = msgs.reduce((acc, m) => acc + m.rating, 0);
                 averageRating = parseFloat((sum / msgs.length).toFixed(1));
             }
             reviewCount = count || 0;
        }

        return {
            id: p.id,
            handle: p.handle || '@user',
            displayName: p.display_name || 'Creator',
            bio: p.bio || '',
            avatarUrl: p.avatar_url || DEFAULT_AVATAR,
            pricePerMessage: p.price_per_message || 50,
            responseWindowHours: p.response_window_hours || 48,
            welcomeMessage: p.welcome_message,
            likesCount: likesMap[p.id] || 0,
            stats: { 
                responseTimeAvg, 
                replyRate: '98%', 
                profileViews: reviewCount * 15 + 100, 
                averageRating: averageRating 
            },
            customQuestions: [],
            tags: [],
            links: (p.links || []).filter((l: any) => !l.id?.startsWith('__')),
            linkSections: (p.links || [])
                .filter((l: any) => l.id?.startsWith('__section__'))
                .map((l: any) => ({ id: l.id.replace('__section__', ''), title: l.title, order: l.order ?? 0 })),
            linksSectionTitle: (p.links || []).find((l: any) => l.id === '__links_title__')?.title || undefined,
            products: p.products || [],
            platforms: p.platforms || []
        };
    }));

    return creatorsWithStats;
};

export const toggleCreatorLike = async (creatorId: string): Promise<{ likes: number, hasLiked: boolean }> => {
    if (!isConfigured) return MockBackend.toggleCreatorLike(creatorId);
    
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Must be logged in to like");
    const userId = session.session.user.id;
    
    // Check existence
    const { data: existing, error: fetchError } = await supabase.from('creator_likes').select('id').eq('creator_id', creatorId).eq('fan_id', userId).maybeSingle();
    
    if (fetchError && fetchError.code !== '42P01') throw fetchError;
    
    if (existing) {
        const { error } = await supabase.from('creator_likes').delete().eq('id', existing.id);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('creator_likes').insert({ creator_id: creatorId, fan_id: userId });
        if (error) throw error;
    }
    
    // Get new count
    const { count, error: countError } = await supabase.from('creator_likes').select('*', { count: 'exact', head: true }).eq('creator_id', creatorId);
    
    if (countError && countError.code !== '42P01') throw countError;
    
    return { likes: count || 0, hasLiked: !existing };
};

export const getCreatorLikeStatus = async (creatorId: string): Promise<boolean> => {
    if (!isConfigured) return MockBackend.getCreatorLikeStatus(creatorId);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return false;
    
    const { data } = await supabase.from('creator_likes').select('id').eq('creator_id', creatorId).eq('fan_id', session.session.user.id).maybeSingle();
    return !!data;
};

// --- STRIPE & PAYOUTS ---

export type Withdrawal = MockBackend.Withdrawal;

const callStripeConnect = async (body: Record<string, unknown>) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error('Not authenticated');

    const testMode = !import.meta.env.PROD || !import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_LIVE;
    const res = await supabase.functions.invoke('stripe-connect', {
        body: { ...body, testMode },
        headers: {
            Authorization: `Bearer ${session.session.access_token}`,
        },
    });

    // Log full response for debugging
    console.log('[stripe-connect] res.error:', res.error, 'res.data:', res.data);

    if (res.error) {
        // Try to extract actual error body from FunctionsHttpError
        let message = res.error.message || 'Edge function error';
        try {
            const context = (res.error as any).context;
            if (context) {
                const errBody = await context.json().catch(() => null);
                console.log('[stripe-connect] error body:', errBody);
                if (errBody?.error) message = errBody.error;
            }
        } catch (_) {}
        throw new Error(message);
    }
    if (res.data?.error) {
        throw new Error(res.data.error);
    }

    return res.data;
};

const WELCOME_MESSAGES: Record<string, string> = {
    en: `Hey! 👋 Welcome to Diem — I'm so glad you're here.\n\nHere's how it works: fans pay to send you a message, and you reply when you're ready. Once you reply and tap Collect, the credits hit your balance.\n\nYou can keep the conversation going as long as you like — reply as many times as you want. But remember, fans get one message per session, so your reply really matters to them.\n\nGo ahead and reply to this message to collect your first credits. Then head to Settings to set up your profile. Good luck! 🚀`,
    ko: `안녕하세요! 👋 Diem에 오신 것을 환영합니다 — 함께하게 되어 정말 기뻐요.\n\n이렇게 작동해요: 팬들이 메시지를 보내기 위해 크레딧을 지불하고, 준비가 되면 답장을 보내면 됩니다. 답장하고 '수령' 버튼을 누르면 크레딧이 잔액에 적립됩니다.\n\n원하는 만큼 대화를 이어갈 수 있어요 — 몇 번이든 답장할 수 있습니다. 하지만 팬들은 세션당 한 번의 메시지만 보낼 수 있으니, 여러분의 답장이 그들에게 정말 소중합니다.\n\n이 메시지에 답장해서 첫 크레딧을 받아보세요. 그런 다음 설정에서 프로필을 완성해보세요. 행운을 빕니다! 🚀`,
    ja: `こんにちは！👋 Diemへようこそ — ご参加いただけて嬉しいです。\n\n仕組みはこうです：ファンがメッセージを送るためにクレジットを支払い、準備ができたら返信します。返信して「受け取る」をタップすると、クレジットが残高に反映されます。\n\n何度でも返信できます — 会話を続けることができます。ただし、ファンはセッションあたり1つのメッセージしか送れないので、あなたの返信はとても大切です。\n\nこのメッセージに返信して最初のクレジットを受け取りましょう。その後、設定でプロフィールを整えてください。頑張ってください！🚀`,
    zh: `你好！👋 欢迎来到 Diem — 很高兴你的加入。\n\n工作原理如下：粉丝付费向你发送消息，你准备好后回复即可。一旦你回复并点击"领取"，积分就会进入你的余额。\n\n你可以随时继续对话 — 想回复多少次都可以。但请记住，粉丝每次会话只能发一条消息，所以你的回复对他们来说非常重要。\n\n现在回复这条消息，领取你的第一批积分。然后前往设置完善你的个人资料。祝你好运！🚀`,
    es: `¡Hola! 👋 Bienvenido/a a Diem — me alegra mucho que estés aquí.\n\nAsí funciona: los fans pagan para enviarte un mensaje, y tú respondes cuando estés listo/a. Una vez que respondas y toques Cobrar, los créditos llegarán a tu saldo.\n\nPuedes continuar la conversación todo lo que quieras — responde tantas veces como desees. Pero recuerda, los fans tienen un solo mensaje por sesión, así que tu respuesta les importa mucho.\n\nAdelante, responde a este mensaje para recibir tus primeros créditos. Luego ve a Configuración para completar tu perfil. ¡Buena suerte! 🚀`,
};

export const sendWelcomeMessage = async (lang = 'en'): Promise<void> => {
    if (!isConfigured) return;
    try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) return;
        const content = WELCOME_MESSAGES[lang] ?? WELCOME_MESSAGES['en'];
        const { error } = await supabase.rpc('send_welcome_message', {
            p_creator_id: session.session.user.id,
            p_content: content,
        });
        if (error) console.warn('[welcome] RPC error:', error.message);
        else console.log('[welcome] Welcome message sent in:', lang);
    } catch (e: any) {
        console.warn('[welcome] Failed:', e.message);
    }
};

const FAN_WELCOME_MESSAGES: Record<string, string> = {
    en: `Hey! 👋 Welcome to Diem — great to have you here.\n\nHere's how it works: browse creators, pay to send one a message, and get a personal reply just for you. The creator has a set time to respond — if they don't reply in time, your credits are automatically refunded.\n\nHead to the Explore tab to find a creator you'd love to hear from. Good luck! 🚀`,
    ko: `안녕하세요! 👋 Diem에 오신 것을 환영합니다.\n\n이렇게 작동해요: 크리에이터를 탐색하고, 크레딧을 지불해 메시지를 보내면, 당신만을 위한 개인 답장을 받을 수 있어요. 크리에이터가 정해진 시간 안에 답장하지 않으면 크레딧은 자동으로 환불됩니다.\n\n탐색 탭에서 원하는 크리에이터를 찾아보세요. 행운을 빕니다! 🚀`,
    ja: `こんにちは！👋 Diemへようこそ。\n\n仕組みはこうです：クリエイターを探して、クレジットを支払ってメッセージを送ると、あなただけへの個人的な返信が届きます。クリエイターが期限内に返信しない場合、クレジットは自動的に返金されます。\n\n探索タブからお気に入りのクリエイターを見つけてみましょう。頑張ってください！🚀`,
    zh: `你好！👋 欢迎来到 Diem。\n\n工作原理如下：浏览创作者，付费发送消息，获得专属个人回复。如果创作者在规定时间内未回复，积分将自动退还。\n\n前往探索标签，找到你想联系的创作者吧。祝你好运！🚀`,
    es: `¡Hola! 👋 Bienvenido/a a Diem.\n\nAsí funciona: explora creadores, paga para enviarles un mensaje y recibe una respuesta personal solo para ti. Si el creador no responde a tiempo, tus créditos se devuelven automáticamente.\n\nVe a la pestaña Explorar para encontrar un creador con quien conectar. ¡Buena suerte! 🚀`,
};

export const sendFanWelcomeMessage = async (lang = 'en'): Promise<void> => {
    if (!isConfigured) return;
    try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) return;
        const content = FAN_WELCOME_MESSAGES[lang] ?? FAN_WELCOME_MESSAGES['en'];
        const { error } = await supabase.rpc('send_fan_welcome_message', {
            p_fan_id: session.session.user.id,
            p_content: content,
        });
        if (error) console.warn('[fan-welcome] RPC error:', error.message);
        else console.log('[fan-welcome] Welcome message sent in:', lang);
    } catch (e: any) {
        console.warn('[fan-welcome] Failed:', e.message);
    }
};

// Returns the Diem admin's user/creator ID by finding the sender of any Diem→fan welcome message.
export const getDiemCreatorId = async (): Promise<string | null> => {
    if (!isConfigured) return null;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;
        const { data } = await supabase
            .from('messages')
            .select('sender_id')
            .eq('creator_id', session.user.id)
            .neq('sender_id', session.user.id)
            .limit(1)
            .maybeSingle();
        return data?.sender_id ?? null;
    } catch {
        return null;
    }
};

export const getDiemPublicProfileId = async (): Promise<string | null> => {
    if (!isConfigured) return null;
    try {
        const { data, error } = await supabase.rpc('get_diem_user_id');
        if (error || !data) return null;
        return data as string;
    } catch { return null; }
};

// Creates a support message directly in the Diem account's inbox so the support
// team can see and respond to it. Used when a creator or fan contacts support.
export const sendSupportMessage = async (content: string): Promise<void> => {
    if (!isConfigured) return MockBackend.sendSupportMessage(content);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not logged in');
        const diemId = await getDiemAdminId();
        if (!diemId) throw new Error('Support unavailable');
        const userId = session.user.id;

        // Find existing thread with admin (either direction)
        const { data: existingThread } = await supabase
            .from('messages')
            .select('id')
            .or(`and(sender_id.eq.${userId},creator_id.eq.${diemId}),and(sender_id.eq.${diemId},creator_id.eq.${userId})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingThread) {
            // Add as chat_line to existing thread
            await supabase.from('chat_lines').insert({
                message_id: existingThread.id,
                sender_id: userId,
                role: 'FAN',
                content,
            });
            await supabase.from('messages').update({
                is_read: false,
                updated_at: new Date().toISOString(),
            }).eq('id', existingThread.id);
            invalidateMsgCache();
            invalidateChatLinesCache(existingThread.id);
        } else {
            // No existing thread — create one
            const { error } = await supabase.from('messages').insert({
                sender_id: userId,
                creator_id: diemId,
                content,
                amount: 0,
                status: 'PENDING',
                expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                is_read: false,
            });
            if (error) throw error;
            invalidateMsgCache();
        }
    } catch (e: any) {
        console.error('[support] Failed to send support message:', e.message);
        throw e;
    }
};

export const connectStripeAccount = async (): Promise<string | null> => {
    if (!isConfigured) {
        console.log("[Stripe] Backend not configured, using mock mode (returning null URL)");
        await MockBackend.connectStripeAccount();
        return null;
    }

    try {
        const data = await callStripeConnect({ action: 'create-account' });
        return data.url || null;
    } catch (e) {
        console.error('Stripe Connect Error:', e);
        throw e;
    }
};

export const getStripeConnectionStatus = async (): Promise<{ connected: boolean; last4: string | null }> => {
    if (!isConfigured) return { connected: await MockBackend.getStripeConnectionStatus(), last4: null };

    try {
        const data = await callStripeConnect({ action: 'check-status' });
        const last4 = data.last4 ?? null;
        return { connected: data.connected === true || !!last4, last4 };
    } catch (e: any) {
        console.warn('Stripe check-status failed:', e.message);
        return { connected: false, last4: null };
    }
};

export const requestWithdrawal = async (amount: number): Promise<Withdrawal> => {
    if (!isConfigured) return MockBackend.requestWithdrawal(amount);

    const data = await callStripeConnect({ action: 'create-payout', amount });
    const w = data.withdrawal;
    return {
        id: w.id,
        amount: w.amount,
        status: w.status,
        createdAt: w.created_at,
    };
};

export const getWithdrawalHistory = async (): Promise<Withdrawal[]> => {
    if (!isConfigured) return MockBackend.getWithdrawalHistory();

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return MockBackend.getWithdrawalHistory();

    try {
        const { data, error } = await supabase
            .from('withdrawals')
            .select('id, amount, status, created_at')
            .eq('creator_id', session.session.user.id)
            .order('created_at', { ascending: false });

        const dbWithdrawals = (error || !data) ? [] : data.map((w: { id: string; amount: number; status: string; created_at: string }) => ({
            id: w.id,
            amount: w.amount,
            status: w.status as 'PENDING' | 'COMPLETED',
            createdAt: w.created_at,
        }));

        // Merge with any mock withdrawals (from fallback mode)
        const mockWithdrawals = await MockBackend.getWithdrawalHistory();
        const allWithdrawals = [...dbWithdrawals, ...mockWithdrawals];
        return allWithdrawals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
        return MockBackend.getWithdrawalHistory();
    }
};
