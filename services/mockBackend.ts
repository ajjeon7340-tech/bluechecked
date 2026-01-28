
import { CreatorProfile, Message, MessageStatus, CurrentUser, UserRole, ChatMessage, MonthlyStat, ProAnalyticsData, DetailedStat, DetailedFinancialStat, StatTimeFrame } from '../types';

export const DEFAULT_AVATAR = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

// Initial Mock Creator
const INITIAL_CREATOR: CreatorProfile = {
  id: 'c1',
  handle: '@alexcode',
  displayName: 'Alex The Dev',
  bio: 'Senior React Engineer helping you break into tech. Ask me about code reviews, career advice, or startup CTO roles.',
  avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=400',
  pricePerMessage: 250, // 250 Credits (~$2.50)
  responseWindowHours: 48,
  welcomeMessage: "Thanks so much for your support! 👋 I've received your message. I usually reply within 24-48 hours.",
  intakeInstructions: "Please provide your current codebase link (GitHub/GitLab) or a snippet if you want a code review. Be specific about what you are stuck on.",
  customQuestions: [
    "What is your current role or tech stack?",
    "What specific outcome do you want from this message?"
  ],
  tags: ['Career', 'Tech', 'Startups', 'React', 'Mentorship'],
  links: [
    { id: 'l1', title: 'Join my Discord Community', url: '#', isPromoted: true },
    { id: 'l2', title: 'My VS Code Setup & Theme', url: '#' },
    { id: 'l3', title: 'Weekly Newsletter', url: '#' },
    { 
      id: 'p1', 
      title: 'React Performance Masterclass', 
      url: '#', 
      type: 'DIGITAL_PRODUCT', 
      price: 1500,
      isPromoted: false 
    }
  ],
  products: [],
  likesCount: 124,
  isPremium: false,
  stats: {
    responseTimeAvg: 'Expert',
    replyRate: '100%',
    profileViews: 8432,
    averageRating: 4.9
  },
  platforms: ['youtube', 'x', 'twitch'],
  bannerGradient: 'from-red-500 to-orange-500',
  rankingTitle: '2.4M Subscriber Growth Secrets'
};

const ADDITIONAL_CREATORS: CreatorProfile[] = [
    {
        ...INITIAL_CREATOR,
        id: 'c2',
        handle: '@fitwithjen',
        displayName: 'Jen Fitness',
        bio: 'Certified Personal Trainer & Nutritionist. Helping busy professionals stay fit without the burnout.',
        avatarUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=400&q=80',
        pricePerMessage: 300,
        tags: ['Fitness', 'Health', 'Nutrition', 'Lifestyle'],
        likesCount: 89,
    }
];

// Mock In-Memory DB
let creatorProfile: CreatorProfile = (() => {
    try {
        const saved = localStorage.getItem('bluechecked_mock_creator_profile');
        return saved ? JSON.parse(saved) : { ...INITIAL_CREATOR };
    } catch (e) {
        return { ...INITIAL_CREATOR };
    }
})();

let messages: Message[] = (() => {
    try {
        const saved = localStorage.getItem('bluechecked_mock_messages');
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
})();

let currentUser: CurrentUser | null = null;

// Mock Likes Store: creatorId -> Set of userIds
const creatorLikes = new Map<string, Set<string>>();

// Mock Users Store (Persistent)
let mockUsers: CurrentUser[] = (() => {
    try {
        const saved = localStorage.getItem('bluechecked_mock_users');
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
})();

const saveMockUsers = () => localStorage.setItem('bluechecked_mock_users', JSON.stringify(mockUsers));

// Mock Likes Log (for statistics over time)
interface LikeEvent {
    creatorId: string;
    userId: string;
    timestamp: string;
}
let mockLikesLog: LikeEvent[] = (() => {
    try {
        const saved = localStorage.getItem('bluechecked_mock_likes_log');
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
})();
const saveLikesLog = () => localStorage.setItem('bluechecked_mock_likes_log', JSON.stringify(mockLikesLog));

// Mock Analytics Store
interface AnalyticsEvent {
    id: string;
    creatorId: string;
    eventType: 'VIEW' | 'CLICK' | 'CONVERSION';
    source: string;
    metadata: any;
    createdAt: string;
}

let analyticsEvents: AnalyticsEvent[] = (() => {
    try {
        const saved = localStorage.getItem('bluechecked_mock_analytics');
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
})();

const saveAnalytics = () => {
    localStorage.setItem('bluechecked_mock_analytics', JSON.stringify(analyticsEvents));
};

// Initialize some demo analytics if empty
if (analyticsEvents.length === 0) {
    // We'll generate these on the fly in getProAnalytics if needed, 
    // or just let it start empty. Let's start empty to show "actual" behavior 
    // or maybe just 1 view to avoid empty charts.
}

const saveMessages = () => {
    localStorage.setItem('bluechecked_mock_messages', JSON.stringify(messages));
};

// Helper to generate random messages
const generateDemoMessages = () => {
    if (messages.length > 0) return;
    messages = [
        {
            id: 'm1',
            senderName: 'Jane Doe',
            senderEmail: 'jane@example.com',
            content: 'Hey Alex, could you take a quick look at my React project? I am having issues with re-renders.',
            creatorId: 'c1',
            creatorName: 'Alex The Dev',
            creatorAvatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=400',
            amount: 250,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            expiresAt: new Date(Date.now() + 172800000).toISOString(),
            status: 'PENDING' as MessageStatus,
            isRead: false,
            conversation: [
                { id: 'c1', role: 'FAN', content: 'Hey Alex, could you take a quick look at my React project? I am having issues with re-renders.', timestamp: new Date(Date.now() - 3600000).toISOString() }
            ]
        },
        {
            id: 'm2',
            senderName: 'John Smith',
            senderEmail: 'john@example.com',
            content: 'Great content! Just wanted to say thanks for the VS Code theme recommendation.',
            creatorId: 'c1',
            creatorName: 'Alex The Dev',
            creatorAvatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=400',
            amount: 250,
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            status: 'REPLIED' as MessageStatus,
            isRead: true,
            replyContent: 'You are welcome John! Glad you like it.',
            replyAt: new Date(Date.now() - 82800000).toISOString(),
            conversation: [
                { id: 'c2', role: 'FAN', content: 'Great content! Just wanted to say thanks for the VS Code theme recommendation.', timestamp: new Date(Date.now() - 86400000).toISOString() },
                { id: 'c3', role: 'CREATOR', content: 'You are welcome John! Glad you like it.', timestamp: new Date(Date.now() - 82800000).toISOString() }
            ]
        }
    ];
    saveMessages();
};

generateDemoMessages();

// --- EXPORTED FUNCTIONS ---

export const getCreatorProfile = async (creatorId?: string): Promise<CreatorProfile> => {
    if (creatorId && creatorId !== creatorProfile.id) return ADDITIONAL_CREATORS.find(c => c.id === creatorId) || creatorProfile;
    
    // Sync likes count
    const likes = creatorLikes.get(creatorProfile.id)?.size || creatorProfile.likesCount;
    return { ...creatorProfile, likesCount: likes };
};

export const updateCreatorProfile = async (profile: CreatorProfile): Promise<CreatorProfile> => {
    creatorProfile = { ...profile };
    localStorage.setItem('bluechecked_mock_creator_profile', JSON.stringify(creatorProfile));
    return creatorProfile;
};

export const getMessages = async (): Promise<Message[]> => {
    // Check for expired messages
    const now = new Date();
    let hasChanges = false;

    messages.forEach(msg => {
        if (msg.status === 'PENDING' as MessageStatus && new Date(msg.expiresAt) < now) {
            msg.status = 'EXPIRED' as MessageStatus;
            hasChanges = true;
            // Refund logic for mock: If currentUser is the sender, refund them.
            if (currentUser && currentUser.email === msg.senderEmail) {
                currentUser.credits += msg.amount;
                localStorage.setItem('bluechecked_current_user', JSON.stringify(currentUser));
            }
        }
    });

    if (hasChanges) saveMessages();
    return [...messages];
};

export const sendMessage = async (creatorId: string, name: string, email: string, content: string, amount: number, attachmentUrl?: string): Promise<Message> => {
    
    const isProductPurchase = content.startsWith('Purchased Product:');

    if (isProductPurchase) {
        const hasPurchased = messages.some(m => 
            m.senderEmail === email && 
            m.creatorId === creatorId && 
            m.content === content
        );

        if (hasPurchased) {
            throw new Error("You have already purchased this product.");
        }
    }

    // Check balance if currentUser is defined
    if (currentUser) {
        if (currentUser.credits < amount) {
            throw new Error("Insufficient credits. Please top up.");
        }
        // Deduct credits
        currentUser.credits -= amount;
        localStorage.setItem('bluechecked_current_user', JSON.stringify(currentUser));
    }

    const newMessage: Message = {
        id: `m${Date.now()}`,
        creatorId: creatorId,
        creatorName: 'Alex The Dev', // Mock default
        senderName: name,
        senderEmail: email,
        content,
        attachmentUrl,
        amount,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 172800000).toISOString(),
        status: isProductPurchase ? 'REPLIED' as MessageStatus : 'PENDING' as MessageStatus,
        isRead: isProductPurchase,
        replyAt: isProductPurchase ? new Date().toISOString() : undefined,
        conversation: [
            { id: `c${Date.now()}`, role: 'FAN', content, timestamp: new Date().toISOString() }
        ]
    };
    messages = [newMessage, ...messages];
    saveMessages();
    return newMessage;
};

export const replyToMessage = async (messageId: string, replyText: string, isComplete: boolean): Promise<void> => {
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const msg = messages[msgIndex];
    
    if (replyText.trim()) {
        const newPart: ChatMessage = {
            id: `c${Date.now()}`,
            role: 'CREATOR',
            content: replyText,
            timestamp: new Date().toISOString()
        };
        msg.conversation.push(newPart);
    }

    if (isComplete) {
        msg.status = 'REPLIED' as MessageStatus;
        msg.replyContent = replyText;
        msg.replyAt = new Date().toISOString();
        // Here we would typically add credits to the creator's wallet in a real DB
    }

    messages[msgIndex] = { ...msg, isRead: false };
    saveMessages();
};

export const markMessageAsRead = async (messageId: string): Promise<void> => {
    messages = messages.map(m => m.id === messageId ? { ...m, isRead: true } : m);
    saveMessages();
};

export const cancelMessage = async (messageId: string): Promise<void> => {
    const msg = messages.find(m => m.id === messageId);
    if (msg && currentUser) {
        // Refund credits if pending
        if (msg.status === 'PENDING' as MessageStatus) {
            currentUser.credits += msg.amount;
        }
    }
    messages = messages.map(m => m.id === messageId ? { ...m, status: 'CANCELLED' as MessageStatus } : m);
    saveMessages();
};

export const loginUser = async (role: UserRole, identifier: string, method: 'EMAIL' | 'PHONE', name?: string): Promise<CurrentUser> => {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 600));

    const cleanIdentifier = identifier.trim();

    if (name) {
        // --- SIGN UP ---
        const existing = mockUsers.find(u => u.email === cleanIdentifier || (u.phoneNumber && u.phoneNumber === cleanIdentifier));
        if (existing) {
            throw new Error("User already registered. Please sign in.");
        }

        const newUser: CurrentUser = {
            id: `u-${Date.now()}`,
            name: name,
            email: method === 'EMAIL' ? cleanIdentifier : undefined,
            phoneNumber: method === 'PHONE' ? cleanIdentifier : undefined,
            role,
            credits: role === 'FAN' ? 500 : 0,
            avatarUrl: DEFAULT_AVATAR
        };

        mockUsers.push(newUser);
        saveMockUsers();
        
        currentUser = newUser;
        localStorage.setItem('bluechecked_current_user', JSON.stringify(currentUser));
        return currentUser;
    } else {
        // --- SIGN IN ---
        const existing = mockUsers.find(u => u.email === cleanIdentifier || (u.phoneNumber && u.phoneNumber === cleanIdentifier));
        
        if (!existing) {
            throw new Error("Invalid login credentials. If you haven't created an account, please Sign Up first.");
        }

        // Note: In mock mode we don't check password
        currentUser = existing;
        localStorage.setItem('bluechecked_current_user', JSON.stringify(currentUser));
        return currentUser;
    }
};

export const signInWithSocial = async (provider: 'google' | 'instagram', role: UserRole) => {
    console.log(`[Mock] Signing in with ${provider} as ${role}`);
    const user = await loginUser(role, `mock-${provider}@example.com`, 'EMAIL', `Mock ${provider} User`);
    localStorage.setItem('bluechecked_current_user', JSON.stringify(user));
    window.location.reload();
};

export const checkAndSyncSession = async (): Promise<CurrentUser | null> => {
    const stored = localStorage.getItem('bluechecked_current_user');
    if (stored) {
        currentUser = JSON.parse(stored);
        return currentUser;
    }
    return null;
};

export const updateCurrentUser = async (user: CurrentUser): Promise<void> => {
    currentUser = { ...user };
};

export const addCredits = async (amount: number): Promise<CurrentUser> => {
    if (!currentUser) throw new Error("No user");
    currentUser.credits += amount;
    localStorage.setItem('bluechecked_current_user', JSON.stringify(currentUser));
    return currentUser;
};

export const uploadProductFile = async (file: any, creatorId: string): Promise<string> => {
    // Convert to Base64 to persist across reloads in Mock Mode
    // Note: LocalStorage has size limits (~5MB), so this only works for small files.
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const getPurchasedProducts = async (): Promise<any[]> => {
    if (!currentUser) return [];

    // 1. Find messages that look like purchases
    const purchaseMessages = messages.filter(m => 
        m.senderEmail === currentUser?.email && 
        m.content.startsWith('Purchased Product:')
    );

    const products: any[] = [];
    
    // Combine the main mock creator and additional ones
    const allCreators = [creatorProfile, ...ADDITIONAL_CREATORS];

    purchaseMessages.forEach(msg => {
        const productName = msg.content.replace('Purchased Product: ', '').trim();
        const creator = allCreators.find(c => c.id === msg.creatorId);
        
        if (creator) {
             // Check products array
             let productDetails = creator.products?.find(p => p.title === productName);
             
             // Check links array (where dashboard saves new products)
             if (!productDetails && creator.links) {
                 const link = creator.links.find(l => l.title === productName && l.type === 'DIGITAL_PRODUCT');
                 if (link) {
                     productDetails = {
                         id: link.id,
                         title: link.title,
                         description: 'Digital Download',
                         url: link.url,
                         price: link.price || 0,
                         imageUrl: '',
                         buttonText: 'Download'
                     };
                 }
             }

             if (productDetails) {
                 products.push({
                     purchaseId: msg.id,
                     purchaseDate: msg.createdAt,
                     creatorName: creator.displayName,
                     creatorAvatar: creator.avatarUrl,
                     title: productDetails.title,
                     description: productDetails.description || 'Digital Download',
                     url: productDetails.url,
                     price: msg.amount,
                     type: 'DIGITAL_PRODUCT'
                 });
             }
        }
    });

    return products.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
};

export const getSecureDownloadUrl = async (productId: string, productUrl: string, creatorId: string): Promise<string> => {
    // In mock mode, the URL is already a Base64 Data URL or external, so it's directly usable
    return productUrl;
};

export const logAnalyticsEvent = async (creatorId: string, eventType: 'VIEW' | 'CLICK' | 'CONVERSION', metadata: any = {}) => {
    const params = new URLSearchParams(window.location.search);
    let source = params.get('source') || 'Direct';

    analyticsEvents.push({
        id: `evt-${Date.now()}`,
        creatorId,
        eventType,
        source,
        metadata,
        createdAt: new Date().toISOString()
    });
    saveAnalytics();
};

export const getHistoricalStats = async (): Promise<MonthlyStat[]> => {
    const statsMap: Record<string, MonthlyStat> = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Initialize buckets for last 6 months
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        statsMap[key] = {
            month: months[d.getMonth()],
            earnings: 0,
            views: 0,
            messages: 0
        };
    }

    // Filter messages for current creator
    messages.filter(m => m.creatorId === creatorProfile.id && m.status === 'REPLIED' as MessageStatus).forEach(m => {
        const d = new Date(m.createdAt);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (statsMap[key]) {
            statsMap[key].earnings += m.amount;
            statsMap[key].messages += 1;
        }
    });

    // Filter analytics events
    analyticsEvents.filter(e => e.creatorId === creatorProfile.id && e.eventType === 'VIEW').forEach(e => {
        const d = new Date(e.createdAt);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (statsMap[key]) {
            statsMap[key].views += 1;
        }
    });

    return Object.values(statsMap);
};

export const getProAnalytics = async (): Promise<ProAnalyticsData> => {
    const events = analyticsEvents.filter(e => e.creatorId === creatorProfile.id);
    
    // 1. Traffic Sources
    const views = events.filter(e => e.eventType === 'VIEW');
    const sources: Record<string, number> = {};
    views.forEach(v => {
        const s = v.source || 'Direct';
        sources[s] = (sources[s] || 0) + 1;
    });
    
    // Default if empty
    if (Object.keys(sources).length === 0) sources['Direct'] = 0;

    const trafficSources = Object.entries(sources)
        .map(([name, value]) => ({ 
            name, 
            value, 
            color: name.includes('YouTube') ? '#FF0000' : name.includes('Instagram') ? '#E1306C' : name.includes('X') ? '#000000' : '#64748b' 
        }))
        .sort((a, b) => b.value - a.value);

    // 2. Funnel
    const clicks = events.filter(e => e.eventType === 'CLICK').length;
    const conversions = events.filter(e => e.eventType === 'CONVERSION').length;
    
    const funnel = [
        { name: 'Profile Views', count: views.length, fill: '#6366F1' },
        { name: 'Interactions', count: clicks + conversions, fill: '#818CF8' }, // Interactions = Clicks + Conversions
        { name: 'Conversions', count: conversions, fill: '#4ADE80' }
    ];

    // 3. Top Assets
    const assetStats: Record<string, { clicks: number, revenue: number, type: 'LINK' | 'PRODUCT', title: string }> = {};
    
    (creatorProfile.links || []).forEach(link => {
        assetStats[link.id] = { clicks: 0, revenue: 0, type: link.type || 'LINK', title: link.title };
    });

    events.filter(e => (e.eventType === 'CLICK' || e.eventType === 'CONVERSION') && e.metadata?.id).forEach(e => {
        if (assetStats[e.metadata.id]) assetStats[e.metadata.id].clicks++;
    });

    // Calculate revenue from messages
    messages.forEach(m => {
        if (m.content.startsWith('Purchased Product:')) {
            const productName = m.content.replace('Purchased Product: ', '').trim();
            const link = (creatorProfile.links || []).find(l => l.title === productName);
            if (link && assetStats[link.id]) assetStats[link.id].revenue += m.amount;
        }
    });

    const topAssets = Object.entries(assetStats)
        .map(([id, stat]) => ({ id, title: stat.title, type: stat.type, clicks: stat.clicks, revenue: stat.revenue, ctr: stat.clicks > 0 ? `${((stat.revenue > 0 ? 1 : 0) / stat.clicks * 100).toFixed(1)}%` : '0%' }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5);

    return {
        trafficSources,
        funnel,
        topAssets,
        audienceType: { new: 75, returning: 25 }
    };
};

export const getFinancialStatistics = async (timeFrame: StatTimeFrame, date: Date): Promise<DetailedFinancialStat[]> => {
    const count = timeFrame === 'DAILY' ? 7 : timeFrame === 'WEEKLY' ? 4 : 6;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    return Array.from({ length: count }).map((_, i) => {
        let labelDate = new Date(date);
        let label = '';
        
        if (timeFrame === 'DAILY') {
            labelDate.setDate(date.getDate() - i);
            label = days[labelDate.getDay()];
        } else if (timeFrame === 'WEEKLY') {
            labelDate.setDate(date.getDate() - (i * 7));
            label = `Wk ${count - i}`;
        } else {
            labelDate.setMonth(date.getMonth() - i);
            label = labelDate.toLocaleDateString('en-US', { month: 'short' });
        }

        const msgRev = 1000 + (i * 100);
        const prodRev = 500 + (i * 50);
        const tips = 100 + (i * 10);

        return {
            date: label,
            totalRevenue: msgRev + prodRev + tips,
            messageRevenue: msgRev,
            productRevenue: prodRev,
            tips: tips
        };
    }).reverse();
};

export const rateMessage = async (messageId: string, rating: number, reviewContent?: string): Promise<void> => {
    messages = messages.map(m => m.id === messageId ? { ...m, rating, reviewContent } : m);
    saveMessages();
};

export const sendFanAppreciation = async (messageId: string, text: string): Promise<void> => {
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;
    
    const msg = messages[msgIndex];
    msg.conversation.push({
        id: `c${Date.now()}`,
        role: 'FAN',
        content: `Fan Appreciation: ${text}`,
        timestamp: new Date().toISOString()
    });
    // Add tip credits
    if (currentUser) currentUser.credits -= 50; // Mock tip amount
    
    messages[msgIndex] = { ...msg };
    saveMessages();
};

export const getFeaturedCreators = async (): Promise<CreatorProfile[]> => {
    // Sync likes for all
    const all = [creatorProfile, ...ADDITIONAL_CREATORS].map(c => ({
        ...c,
        likesCount: creatorLikes.get(c.id)?.size || c.likesCount
    }));
    return all;
};

export const toggleCreatorLike = async (creatorId: string): Promise<{ likes: number, hasLiked: boolean }> => {
    if (!currentUser) throw new Error("Must be logged in");
    
    if (!creatorLikes.has(creatorId)) {
        creatorLikes.set(creatorId, new Set());
    }
    
    const likes = creatorLikes.get(creatorId)!;
    const hasLiked = likes.has(currentUser.id);
    
    if (hasLiked) {
        likes.delete(currentUser.id);
        // Remove from log for stats accuracy
        const idx = mockLikesLog.findIndex(l => l.creatorId === creatorId && l.userId === currentUser!.id);
        if (idx !== -1) {
            mockLikesLog.splice(idx, 1);
            saveLikesLog();
        }
    } else {
        likes.add(currentUser.id);
        mockLikesLog.push({
            creatorId,
            userId: currentUser.id,
            timestamp: new Date().toISOString()
        });
        saveLikesLog();
    }
    
    return { likes: likes.size, hasLiked: !hasLiked };
};

export const getCreatorLikeStatus = async (creatorId: string): Promise<boolean> => {
    if (!currentUser) return false;
    return creatorLikes.get(creatorId)?.has(currentUser.id) || false;
};

export const getDetailedStatistics = async (timeFrame: StatTimeFrame, date: Date): Promise<DetailedStat[]> => {
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    if (timeFrame === 'DAILY') {
        startDate.setDate(endDate.getDate() - 6);
    } else if (timeFrame === 'WEEKLY') {
        startDate.setDate(endDate.getDate() - 27); // 4 weeks
    } else {
        startDate.setMonth(endDate.getMonth() - 5); // 6 months
        startDate.setDate(1);
    }

    // Filter Data
    const views = analyticsEvents.filter(e => e.creatorId === creatorProfile.id && e.eventType === 'VIEW' && new Date(e.createdAt) >= startDate && new Date(e.createdAt) <= endDate);
    const likes = mockLikesLog.filter(l => l.creatorId === creatorProfile.id && new Date(l.timestamp) >= startDate && new Date(l.timestamp) <= endDate);
    const ratings = messages.filter(m => m.creatorId === creatorProfile.id && m.rating && m.rating > 0 && new Date(m.createdAt) >= startDate && new Date(m.createdAt) <= endDate);

    // Initialize Buckets
    const stats: DetailedStat[] = [];
    const count = timeFrame === 'DAILY' ? 7 : timeFrame === 'WEEKLY' ? 4 : 6;

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

        const bucketViews = views.filter(v => new Date(v.createdAt) >= bucketStart && new Date(v.createdAt) <= bucketEnd).length;
        const bucketLikes = likes.filter(l => new Date(l.timestamp) >= bucketStart && new Date(l.timestamp) <= bucketEnd).length;
        const bucketRatings = ratings.filter(r => new Date(r.createdAt) >= bucketStart && new Date(r.createdAt) <= bucketEnd);
        const avgRating = bucketRatings.length > 0 ? bucketRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / bucketRatings.length : 0;

        stats.push({ date: label, views: bucketViews, likes: bucketLikes, rating: parseFloat(avgRating.toFixed(1)) });
    }

    return stats;
};
