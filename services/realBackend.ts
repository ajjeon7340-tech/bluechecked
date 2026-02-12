import { supabase, isConfigured } from './supabaseClient';
import { CreatorProfile, Message, MessageStatus, CurrentUser, UserRole, ChatMessage, StatTimeFrame, DetailedStat, DetailedFinancialStat, MonthlyStat, ProAnalyticsData } from '../types';
import * as MockBackend from './mockBackend';

export const DEFAULT_AVATAR = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

export const isBackendConfigured = () => isConfigured;

const getColorForSource = (source: string) => {
    const s = source.toLowerCase();
    if (s.includes('youtube')) return '#FF0000';
    if (s.includes('instagram')) return '#E1306C';
    if (s.includes('x') || s.includes('twitter')) return '#000000';
    if (s.includes('tiktok')) return '#000000';
    if (s.includes('linkedin')) return '#0077B5';
    if (s.includes('facebook')) return '#1877F2';
    if (s.includes('google')) return '#4285F4';
    if (s.includes('direct')) return '#64748b';
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
    // Allow overriding the site URL via environment variable (e.g. VITE_SITE_URL=https://telepossible.com)
    if (import.meta.env.VITE_SITE_URL) {
        return import.meta.env.VITE_SITE_URL;
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
        localStorage.setItem('bluechecked_current_user', JSON.stringify(userToStore));
    } catch (e) {
        console.warn("LocalStorage Quota Exceeded - skipping cache update", e);
    }
};

const mapDbMessageToAppMessage = (m: any, currentUserId: string): Message => {
    // Construct conversation from chat_lines
    // If chat_lines is empty (legacy or new msg), build default from content
    let conversation: ChatMessage[] = [];
    
    if (m.chat_lines && m.chat_lines.length > 0) {
        conversation = m.chat_lines.map((line: any) => ({
            id: line.id,
            role: line.role, // 'FAN' or 'CREATOR' stored in DB
            content: line.content,
            timestamp: line.created_at
        }));
        // Sort by time
        conversation.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } else {
        // Fallback for initial message if no chat lines yet
        conversation = [{ 
            id: `${m.id}-init`, 
            role: 'FAN', 
            content: m.content, 
            timestamp: m.created_at 
        }];
    }

    return {
        id: m.id,
        senderName: m.sender?.display_name || 'Fan',
        senderEmail: m.sender?.email || '',
        senderAvatarUrl: m.sender?.avatar_url,
        content: m.content,
        amount: m.amount,
        creatorId: m.creator_id,
        creatorName: m.creator?.display_name || 'Creator',
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
        localStorage.removeItem('bluechecked_current_user');
        localStorage.removeItem('bluechecked_skip_setup');
        localStorage.setItem('bluechecked_oauth_role', role);
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
        localStorage.removeItem('bluechecked_current_user');
        window.location.reload();
        return;
    }
    await supabase.auth.signOut();
    localStorage.removeItem('bluechecked_current_user');
    localStorage.removeItem('bluechecked_skip_setup');
};

export const checkAndSyncSession = async (): Promise<CurrentUser | null> => {
    if (!isConfigured) return MockBackend.checkAndSyncSession();

    // 1. Check Supabase Session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        localStorage.removeItem('bluechecked_current_user');
        localStorage.removeItem('bluechecked_skip_setup');
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
        // Check for role intent from localStorage or URL
        const storedRole = localStorage.getItem('bluechecked_oauth_role');
        const params = new URLSearchParams(window.location.search);
        const urlRole = params.get('role');
        
        // If we have a role intent, we complete the signup automatically
        if (storedRole || urlRole) {
            return await completeOAuthSignup();
        }

        // Instead of auto-creating, we throw a specific error to prompt the user in the UI
        const error: any = new Error("PROFILE_MISSING");
        error.code = 'PROFILE_MISSING';
        throw error;
    }

    if (profile) {
        // Check for role mismatch from OAuth intent
        const storedRole = localStorage.getItem('bluechecked_oauth_role');
        if (storedRole && storedRole !== profile.role) {
            localStorage.removeItem('bluechecked_oauth_role');
            const error: any = new Error(`This account already exists as a ${profile.role}. Please sign in as a ${profile.role}.`);
            error.code = 'ROLE_MISMATCH';
            throw error;
        }
        localStorage.removeItem('bluechecked_oauth_role');

        const user = mapProfileToUser(profile);
        saveUserToLocalStorage(user);
        return user;
    }
    
    // If we reach here, we have a session but no profile (and failed to create one)
    localStorage.removeItem('bluechecked_current_user');
    localStorage.removeItem('bluechecked_skip_setup');
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

    const storedRole = localStorage.getItem('bluechecked_oauth_role');
    
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
    localStorage.removeItem('bluechecked_oauth_role');

    // Fetch again
    const { data: newProfile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    
    const user = mapProfileToUser(newProfile);
    saveUserToLocalStorage(user);
    return user;
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

    // Calculate Real Stats from Messages
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
        links: data.links || [],
        products: data.products || [],
        platforms: data.platforms || [],
        isPremium: data.is_premium || false
    };
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
        links: data.links || [],
        products: data.products || [],
        platforms: data.platforms || [],
        isPremium: data.is_premium || false
    };
};

export const updateCreatorProfile = async (profile: CreatorProfile): Promise<CreatorProfile> => {
    if (!isConfigured) return MockBackend.updateCreatorProfile(profile);

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Not logged in");

    const { error } = await supabase
        .from('profiles')
        .update({
            display_name: profile.displayName,
            bio: profile.bio,
            price_per_message: profile.pricePerMessage,
            avatar_url: profile.avatarUrl,
            response_window_hours: profile.responseWindowHours,
            platforms: profile.platforms,
            links: profile.links,
            products: profile.products,
            is_premium: profile.isPremium
        })
        .eq('id', session.session.user.id);

    if (error) throw error;
    return profile;
};

// --- MESSAGES & TRANSACTIONS ---

export const getMessages = async (): Promise<Message[]> => {
    if (!isConfigured) return MockBackend.getMessages();

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return [];

    // Check for expired pending messages and process refunds (Lazy Expiration)
    const now = new Date().toISOString();
    const { data: expiredMessages } = await supabase
        .from('messages')
        .select('id, amount, sender_id')
        .eq('status', 'PENDING')
        .lt('expires_at', now)
        .or(`sender_id.eq.${session.session.user.id},creator_id.eq.${session.session.user.id}`);

    if (expiredMessages && expiredMessages.length > 0) {
        for (const msg of expiredMessages) {
            // 1. Refund the sender
            const { data: sender } = await supabase.from('profiles').select('credits').eq('id', msg.sender_id).single();
            if (sender) {
                await supabase.from('profiles').update({ credits: sender.credits + msg.amount }).eq('id', msg.sender_id);
            }
            // 2. Mark as expired
            await supabase.from('messages').update({ status: 'EXPIRED' }).eq('id', msg.id);
        }
    }

    const { data, error } = await supabase
        .from('messages')
        .select(`
            *,
            sender:profiles!sender_id(display_name, email, avatar_url),
            creator:profiles!creator_id(display_name, avatar_url),
            chat_lines(*)
        `)
        .or(`sender_id.eq.${session.session.user.id},creator_id.eq.${session.session.user.id}`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching messages:", error);
        return [];
    }

    return data.map(m => mapDbMessageToAppMessage(m, session.session!.user.id));
};

export const sendMessage = async (creatorId: string, senderName: string, senderEmail: string, content: string, amount: number, attachmentUrl?: string): Promise<Message> => {
    if (!isConfigured) return MockBackend.sendMessage(creatorId, senderName, senderEmail, content, amount, attachmentUrl);

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Must be logged in");
    
    const userId = session.session.user.id;
    const isProductPurchase = content.startsWith('Purchased Product:');
    const isTip = content.startsWith('Fan Tip:');

    // 1. Check Balance
    const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single();
    if (!profile || profile.credits < amount) {
        throw new Error("Insufficient credits. Please top up.");
    }

    // Check for existing pending request
    // Skip check if this is a product purchase
    if (!isProductPurchase && !isTip) {
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

    // 3. Perform Transaction (Ideally this should be a Postgres Function/RPC for atomicity)
    // A. Deduct Credits
    await supabase.from('profiles').update({ credits: profile.credits - amount }).eq('id', userId);

    // If product purchase, immediately transfer credits to creator (since it's instant delivery)
    if (isProductPurchase || isTip) {
         const { data: creator } = await supabase.from('profiles').select('credits').eq('id', creatorId).single();
         if (creator) {
             await supabase.from('profiles').update({ credits: creator.credits + amount }).eq('id', creatorId);
         }
    }

    // B. Create Message
    const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert({
            sender_id: userId,
            creator_id: creatorId,
            content: content,
            amount: amount,
            status: (isProductPurchase || isTip) ? 'REPLIED' : 'PENDING',
            attachment_url: attachmentUrl,
            expires_at: new Date(Date.now() + (responseWindow * 3600000)).toISOString(),
            reply_at: (isProductPurchase || isTip) ? new Date().toISOString() : null,
            is_read: (isProductPurchase || isTip) // Mark as read if product purchase or tip
        })
        .select()
        .single();

    if (msgError) throw msgError;

    // C. Add Initial Chat Line
    await supabase.from('chat_lines').insert({
        message_id: message.id,
        sender_id: userId,
        role: 'FAN',
        content: content
    });

    // D. Send Email Notification to Creator (via Edge Function)
    // We don't await this to keep the UI responsive
    // NOTE: This will log an error to the console if the 'send-email' Edge Function is not deployed.
    // We attempt to send even if email is missing on client (RLS), hoping Edge Function can resolve it via creatorId
    if (session.session) {
        supabase.functions.invoke('send-email', {
            body: {
                creatorId: creatorId,
                to: creatorProfile.email,
                subject: `New Request from ${senderName}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #4f46e5;">New Priority Request</h1>
                        <p><strong>${senderName}</strong> has sent you a request for <strong>${amount} credits</strong>.</p>
                        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0; font-style: italic;">"${content}"</p>
                        </div>
                        <a href="${getSiteUrl()}" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Request</a>
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
            }
        });
    }

    // Return formatted
    return mapDbMessageToAppMessage(message, userId);
};

export const replyToMessage = async (messageId: string, replyText: string, isComplete: boolean): Promise<void> => {
    if (!isConfigured) return MockBackend.replyToMessage(messageId, replyText, isComplete);

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Not logged in");

    // Check status before replying
    const { data: msgCheck } = await supabase.from('messages').select('status, expires_at').eq('id', messageId).single();
    if (!msgCheck) throw new Error("Message not found");
    
    if (msgCheck.status !== 'PENDING') {
         throw new Error(`Cannot reply. Message is ${msgCheck.status}`);
    }
    if (new Date(msgCheck.expires_at) < new Date()) {
        throw new Error("Message has expired and cannot be replied to.");
    }

    // 1. Add Chat Line
    if (replyText.trim()) {
        const { error: chatError } = await supabase.from('chat_lines').insert({
            message_id: messageId,
            sender_id: session.session.user.id,
            role: 'CREATOR',
            content: replyText
        });
        if (chatError) throw chatError;

        // Touch the message to trigger realtime updates for listeners (Fan Dashboard)
        // Also set is_read to false so the recipient (Fan) sees it as unread
        await supabase.from('messages').update({ 
            is_read: false,
            updated_at: new Date().toISOString()
        }).eq('id', messageId);
    }

    // 2. Update Status if Complete
    if (isComplete) {
        // In a real app, use RPC to atomically transfer held credits to Creator's balance here
        // For now, just update status
        const { error: msgError } = await supabase
            .from('messages')
            .update({ 
                status: 'REPLIED', 
                reply_at: new Date().toISOString() 
            })
            .eq('id', messageId);
            
        if (msgError) throw msgError;
        
        // Add credits to creator
        const { data: creator } = await supabase.from('profiles').select('credits').eq('id', session.session.user.id).single();
        if (creator) {
             // Retrieve message amount to add
             const { data: msg } = await supabase.from('messages').select('amount').eq('id', messageId).single();
             if (msg) {
                 await supabase.from('profiles').update({ credits: creator.credits + msg.amount }).eq('id', session.session.user.id);
             }
        }
    }
};

export const cancelMessage = async (messageId: string): Promise<void> => {
    if (!isConfigured) return MockBackend.cancelMessage(messageId);

    // 1. Get Message to check amount
    const { data: msg } = await supabase.from('messages').select('*').eq('id', messageId).single();
    if (!msg) return;

    // 2. Refund Sender
    if (msg.status === 'PENDING') {
        const { data: sender } = await supabase.from('profiles').select('credits').eq('id', msg.sender_id).single();
        if (sender) {
            await supabase.from('profiles').update({ credits: sender.credits + msg.amount }).eq('id', msg.sender_id);
        }
    }

    // 3. Mark Cancelled
    await supabase.from('messages').update({ status: 'CANCELLED' }).eq('id', messageId);
};

export const markMessageAsRead = async (messageId: string): Promise<void> => {
    if (!isConfigured) return MockBackend.markMessageAsRead(messageId);

    await supabase.from('messages').update({ is_read: true }).eq('id', messageId);
};

export const addCredits = async (amount: number): Promise<CurrentUser> => {
    if (!isConfigured) return MockBackend.addCredits(amount);

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("No user");

    const { data: profile } = await supabase.from('profiles').select('credits').eq('id', session.session.user.id).single();
    
    const newBalance = (profile?.credits || 0) + amount;
    
    await supabase.from('profiles').update({ credits: newBalance }).eq('id', session.session.user.id);
    
    // Return updated user object
    const { data: updated } = await supabase.from('profiles').select('*').eq('id', session.session.user.id).single();
    return mapProfileToUser(updated);
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
    let source = params.get('utm_source') || params.get('source');
    
    if (!source) {
        const referrer = document.referrer;
        if (referrer) {
            try {
                const url = new URL(referrer);
                const hostname = url.hostname.toLowerCase();

                if (hostname.includes('youtube') || hostname.includes('youtu.be')) source = 'YouTube';
                else if (hostname.includes('instagram')) source = 'Instagram';
                else if (hostname.includes('twitter') || hostname.includes('x.com') || hostname.includes('t.co')) source = 'X (Twitter)';
                else if (hostname.includes('tiktok')) source = 'TikTok';
                else if (hostname.includes('linkedin')) source = 'LinkedIn';
                else if (hostname.includes('facebook') || hostname.includes('fb.com')) source = 'Facebook';
                else if (hostname.includes('google')) source = 'Google Search';
                else if (hostname.includes('bing')) source = 'Bing Search';
                else source = hostname.replace(/^www\./, '');
            } catch {
                source = 'Other Website';
            }
        } else {
            source = 'Direct Link / Bookmark';
        }
    } else {
        // Make technical UTM tags friendlier
        const s = source.toLowerCase();
        if (s === 'ig_bio') source = 'Instagram Bio';
        else if (s === 'ig_story') source = 'Instagram Story';
        else if (s === 'yt_desc') source = 'YouTube Description';
        else if (s === 'tw_bio') source = 'X (Twitter) Bio';
        else if (s === 'tt_bio') source = 'TikTok Bio';
        else if (s === 'ln_bio') source = 'LinkedIn Bio';
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

export const getProAnalytics = async (): Promise<ProAnalyticsData | null> => {
    if (!isConfigured) return MockBackend.getProAnalytics();

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return null;
    const creatorId = session.session.user.id;

    // Fetch analytics data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: events } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('creator_id', creatorId)
        .gte('created_at', thirtyDaysAgo.toISOString());

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

    // 1. Traffic Sources
    const views = events.filter(e => e.event_type === 'VIEW');
    const sources: Record<string, number> = {};
    views.forEach(v => {
        const s = v.source || 'Direct Link / Bookmark';
        sources[s] = (sources[s] || 0) + 1;
    });

    const trafficSources = Object.entries(sources)
        .map(([name, value]) => ({ name, value, color: getColorForSource(name) }))
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
    const assetStats: Record<string, { clicks: number, revenue: number, type: 'LINK' | 'PRODUCT', title: string }> = {};
    
    // Initialize with known links from profile if available, or build dynamically from events
    // Here we build dynamically from events to capture deleted links too
    events.filter(e => (e.event_type === 'CLICK' || e.event_type === 'CONVERSION') && e.metadata?.id).forEach(e => {
        const id = e.metadata.id;
        if (!assetStats[id]) {
            assetStats[id] = { 
                clicks: 0, 
                revenue: 0, 
                type: e.metadata.type || 'LINK', 
                title: e.metadata.title || 'Unknown Asset' 
            };
        }
        assetStats[id].clicks++;
    });

    // Calculate revenue from messages (for products)
    // Note: We need to fetch messages to attribute revenue to products
    // For MVP, we'll skip revenue attribution here or do a separate query if needed.
    // Assuming revenue is 0 for links.

    const topAssets = Object.entries(assetStats)
        .map(([id, stat]) => ({ id, title: stat.title, type: stat.type, clicks: stat.clicks, revenue: stat.revenue, ctr: stat.clicks > 0 ? `${((stat.revenue > 0 ? 1 : 0) / stat.clicks * 100).toFixed(1)}%` : '0%' }))
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
    
    // Deduct credits (50) for the tip
    const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single();
    if (!profile || profile.credits < 50) {
        throw new Error("Insufficient credits to send appreciation (50 credits).");
    }
    
    await supabase.from('profiles').update({ credits: profile.credits - 50 }).eq('id', userId);
    
    // Add credits to creator
    const { data: msg } = await supabase.from('messages').select('creator_id').eq('id', messageId).single();
    if (msg) {
         const { data: creator } = await supabase.from('profiles').select('credits').eq('id', msg.creator_id).single();
         if (creator) {
             await supabase.from('profiles').update({ credits: creator.credits + 50 }).eq('id', msg.creator_id);
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
            links: p.links || [],
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
