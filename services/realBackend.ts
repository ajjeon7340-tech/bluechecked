import { supabase, isConfigured } from './supabaseClient';
import { CreatorProfile, Message, MessageStatus, CurrentUser, UserRole, ChatMessage, StatTimeFrame, DetailedStat, DetailedFinancialStat, MonthlyStat, ProAnalyticsData } from '../types';

export const DEFAULT_AVATAR = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

// --- HELPER: MAP DB OBJECTS TO TYPES ---

const mapProfileToUser = (profile: any): CurrentUser => ({
    id: profile.id,
    name: profile.display_name || 'User',
    email: profile.email,
    role: (profile.role as UserRole) || 'FAN',
    avatarUrl: profile.avatar_url || DEFAULT_AVATAR,
    phoneNumber: '', 
    credits: profile.credits || 0
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
        content: m.content,
        amount: m.amount,
        creatorId: m.creator_id,
        creatorName: m.creator?.display_name || 'Creator',
        createdAt: m.created_at,
        expiresAt: m.expires_at,
        status: m.status as MessageStatus,
        replyContent: conversation.find(c => c.role === 'CREATOR')?.content, // Legacy support
        replyAt: m.reply_at,
        isRead: m.is_read,
        attachmentUrl: m.attachment_url,
        conversation: conversation,
        rating: m.rating
    };
};

// --- AUTH ---

export const loginUser = async (role: UserRole, identifier: string, method: 'EMAIL' | 'PHONE' = 'EMAIL', name?: string): Promise<CurrentUser> => {
    const cleanIdentifier = identifier.trim();
    // 1. Try to sign in
    let { data, error } = await supabase.auth.signInWithPassword({
        email: cleanIdentifier,
        password: 'password123', // Hardcoded for prototype simplicity.
    });

    // 2. If user doesn't exist, Sign Up 
    if (error) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: cleanIdentifier,
            password: 'password123',
            options: {
                data: {
                    name: name || 'New User',
                    role: role
                }
            }
        });
        if (signUpError) throw signUpError;
        data = signUpData;
        
        if (!data.session) {
            // Email confirmation is enabled. We cannot create the profile yet (RLS blocks it).
            // Throw specific error for UI to handle.
            throw new Error("CONFIRMATION_REQUIRED");
        }

        // 2b. Create Profile Row manually (Required since we aren't using SQL Triggers)
        if (data.user) {
            // We attempt to insert the profile. If it exists (rare race condition), we ignore the error.
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
    }

    const user = mapProfileToUser(profile);
    saveUserToLocalStorage(user);
    return user;
};

export const updateCurrentUser = async (user: CurrentUser): Promise<void> => {
    const { error } = await supabase
        .from('profiles')
        .update({
            display_name: user.name,
            avatar_url: user.avatarUrl
        })
        .eq('id', user.id);
        
    if (error) throw error;
};

export const signInWithSocial = async (provider: 'google' | 'instagram', role: UserRole) => {
    if (!isConfigured) {
        throw new Error("Supabase is not configured. Please check your .env.local file for VITE_SUPABASE_URL.");
    }

    // Store role preference to persist through redirect (Fallback if URL param is lost)
    // We also clear the current user cache to ensure we have space and don't mix sessions
    try {
        localStorage.removeItem('bluechecked_current_user');
        localStorage.setItem('bluechecked_oauth_role', role);
    } catch (e) {
        console.warn("Failed to save role preference to local storage", e);
    }

    // Supabase supports 'google'. For 'instagram', usually 'facebook' (Meta) is used.
    // We map instagram to facebook for this implementation.
    // Note: You must enable Google/Facebook providers in Supabase Dashboard.
    const supabaseProvider = provider === 'instagram' ? 'facebook' : provider;
    
    const { error } = await supabase.auth.signInWithOAuth({
        provider: supabaseProvider as any,
        options: {
            redirectTo: `${window.location.origin}?role=${role}`,
        }
    });
    if (error) throw error;
};

export const checkAndSyncSession = async (): Promise<CurrentUser | null> => {
    // 1. Check Supabase Session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        localStorage.removeItem('bluechecked_current_user');
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
        // Determine role from URL param OR localStorage (fallback)
        const params = new URLSearchParams(window.location.search);
        const urlRole = params.get('role');
        const storedRole = localStorage.getItem('bluechecked_oauth_role');
        
        // Prioritize localStorage (user intent before redirect), fallback to URL param, default to FAN
        const roleParam = (storedRole === 'CREATOR' || storedRole === 'FAN') ? storedRole
            : (urlRole === 'CREATOR' || urlRole === 'FAN') ? urlRole 
            : 'FAN';
            
        const role = roleParam as UserRole;
        
        // Clean up
        localStorage.removeItem('bluechecked_oauth_role');

        const meta = session.user.user_metadata;
        const name = meta?.full_name || meta?.name || 'New User';
        const avatar = meta?.avatar_url || meta?.picture;

        // Create Profile
        await supabase.from('profiles').insert({
            id: session.user.id,
            email: session.user.email,
            display_name: name,
            role: role,
            avatar_url: avatar,
            credits: role === 'FAN' ? 500 : 0,
            price_per_message: 50,
            response_window_hours: 48
        });

        // Fetch again
        const { data: newProfile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        profile = newProfile;
    }

    if (profile) {
        const user = mapProfileToUser(profile);
        saveUserToLocalStorage(user);
        return user;
    }
    
    // If we reach here, we have a session but no profile (and failed to create one)
    localStorage.removeItem('bluechecked_current_user');
    return null;
};

// --- PROFILES ---

export const getCreatorProfile = async (creatorId?: string): Promise<CreatorProfile> => {
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
    const { data: statMessages } = await supabase
        .from('messages')
        .select('created_at, reply_at, status, rating')
        .eq('creator_id', data.id);

    let responseTimeAvg = 'N/A';
    let replyRate = '100%';
    let totalRequests = 0;
    let averageRating = 5.0;
    let reviewCount = 0;

    if (statMessages && statMessages.length > 0) {
        totalRequests = statMessages.length;

        // 1. Avg Response Time
        const repliedMsgs = statMessages.filter(m => m.status === 'REPLIED' && m.reply_at);
        if (repliedMsgs.length > 0) {
            const totalTimeMs = repliedMsgs.reduce((acc, m) => acc + (new Date(m.reply_at).getTime() - new Date(m.created_at).getTime()), 0);
            const avgHours = Math.round(totalTimeMs / repliedMsgs.length / (1000 * 60 * 60));
            responseTimeAvg = `${avgHours}h`;
        }

        // 2. Reply Rate (Replied / (Replied + Expired))
        const repliedCount = statMessages.filter(m => m.status === 'REPLIED').length;
        const expiredCount = statMessages.filter(m => m.status === 'EXPIRED').length;
        const totalProcessed = repliedCount + expiredCount;
        if (totalProcessed > 0) {
            replyRate = `${Math.round((repliedCount / totalProcessed) * 100)}%`;
        }

        // 3. Average Rating
        const ratedMessages = statMessages.filter(m => m.rating && m.rating > 0);
        if (ratedMessages.length > 0) {
            const totalRating = ratedMessages.reduce((sum, m) => sum + m.rating, 0);
            averageRating = parseFloat((totalRating / ratedMessages.length).toFixed(1));
            reviewCount = ratedMessages.length;
        }
    }

    return {
        id: data.id,
        handle: data.handle || '@user',
        displayName: data.display_name,
        bio: data.bio || '',
        avatarUrl: data.avatar_url || DEFAULT_AVATAR,
        pricePerMessage: data.price_per_message || 50,
        responseWindowHours: data.response_window_hours || 48,
        likesCount: reviewCount,
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
        platforms: data.platforms || []
    };
};

export const updateCreatorProfile = async (profile: CreatorProfile): Promise<CreatorProfile> => {
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
            products: profile.products
        })
        .eq('id', session.session.user.id);

    if (error) throw error;
    return profile;
};

// --- MESSAGES & TRANSACTIONS ---

export const getMessages = async (): Promise<Message[]> => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return [];

    const { data, error } = await supabase
        .from('messages')
        .select(`
            *,
            sender:profiles!sender_id(display_name, email),
            creator:profiles!creator_id(display_name),
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
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Must be logged in");
    
    const userId = session.session.user.id;

    // 1. Check Balance
    const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single();
    if (!profile || profile.credits < amount) {
        throw new Error("Insufficient credits. Please top up.");
    }

    // Check for existing pending request
    const { data: pendingMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('sender_id', userId)
        .eq('creator_id', creatorId)
        .eq('status', 'PENDING');

    if (pendingMessages && pendingMessages.length > 0) {
        throw new Error("You already have a pending request with this creator. Please wait for a reply.");
    }

    // 2. Get Creator
    const { data: creatorProfile } = await supabase.from('profiles').select('response_window_hours').eq('id', creatorId).single();
    if (!creatorProfile) throw new Error("Creator not found");
    const responseWindow = creatorProfile.response_window_hours || 48;

    // 3. Perform Transaction (Ideally this should be a Postgres Function/RPC for atomicity)
    // A. Deduct Credits
    await supabase.from('profiles').update({ credits: profile.credits - amount }).eq('id', userId);

    // B. Create Message
    const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert({
            sender_id: userId,
            creator_id: creatorId,
            content: content,
            amount: amount,
            status: 'PENDING',
            attachment_url: attachmentUrl,
            expires_at: new Date(Date.now() + (responseWindow * 3600000)).toISOString()
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

    // Return formatted
    return mapDbMessageToAppMessage(message, userId);
};

export const replyToMessage = async (messageId: string, replyText: string, isComplete: boolean): Promise<void> => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Not logged in");

    // 1. Add Chat Line
    if (replyText.trim()) {
        const { error: chatError } = await supabase.from('chat_lines').insert({
            message_id: messageId,
            sender_id: session.session.user.id,
            role: 'CREATOR',
            content: replyText
        });
        if (chatError) throw chatError;
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
    await supabase.from('messages').update({ is_read: true }).eq('id', messageId);
};

export const addCredits = async (amount: number): Promise<CurrentUser> => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("No user");

    const { data: profile } = await supabase.from('profiles').select('credits').eq('id', session.session.user.id).single();
    
    const newBalance = (profile?.credits || 0) + amount;
    
    await supabase.from('profiles').update({ credits: newBalance }).eq('id', session.session.user.id);
    
    // Return updated user object
    const { data: updated } = await supabase.from('profiles').select('*').eq('id', session.session.user.id).single();
    return mapProfileToUser(updated);
};

// --- MOCK STUBS FOR ANALYTICS (Can remain mock until DB has enough data) ---
export const getHistoricalStats = (): MonthlyStat[] => [];
export const getProAnalytics = async (): Promise<ProAnalyticsData | null> => null;
export const getDetailedStatistics = async (timeFrame: StatTimeFrame, date: Date): Promise<DetailedStat[]> => [];
export const getFinancialStatistics = async (timeFrame: StatTimeFrame, date: Date): Promise<DetailedFinancialStat[]> => [];

export const rateMessage = async (messageId: string, rating: number): Promise<void> => {
    const { error } = await supabase
        .from('messages')
        .update({ rating })
        .eq('id', messageId);
    if (error) throw error;
};

export const sendFanAppreciation = async (messageId: string, text: string): Promise<void> => {
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
};

export const getFeaturedCreators = async (): Promise<CreatorProfile[]> => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'CREATOR')
        .limit(20);

    if (error || !data) return [];

    return data.map(p => ({
        id: p.id,
        handle: p.handle || '@user',
        displayName: p.display_name || 'Creator',
        bio: p.bio || '',
        avatarUrl: p.avatar_url || DEFAULT_AVATAR,
        pricePerMessage: p.price_per_message || 50,
        responseWindowHours: p.response_window_hours || 48,
        likesCount: 0,
        stats: { responseTimeAvg: '4h', replyRate: '98%', profileViews: 0, averageRating: 5.0 },
        customQuestions: [],
        tags: [],
        links: p.links || [],
        products: p.products || [],
        platforms: p.platforms || []
    }));
};
