
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
            status: MessageStatus.PENDING,
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
            status: MessageStatus.REPLIED,
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
    return [...messages];
};

export const sendMessage = async (creatorId: string, name: string, email: string, content: string, amount: number, attachmentUrl?: string): Promise<Message> => {
    
    // Check balance if currentUser is defined
    if (currentUser) {
        if (currentUser.credits < amount) {
            throw new Error("Insufficient credits. Please top up.");
        }
        // Deduct credits
        currentUser.credits -= amount;
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
        status: MessageStatus.PENDING,
        isRead: false,
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
        msg.status = MessageStatus.REPLIED;
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
        if (msg.status === MessageStatus.PENDING) {
            currentUser.credits += msg.amount;
        }
    }
    messages = messages.map(m => m.id === messageId ? { ...m, status: MessageStatus.CANCELLED } : m);
    saveMessages();
};

export const loginUser = async (role: UserRole, identifier: string, method: 'EMAIL' | 'PHONE', name?: string): Promise<CurrentUser> => {
    // Mock user with a credit balance
    currentUser = {
        id: `u${Date.now()}`,
        name: name || (method === 'EMAIL' ? identifier.split('@')[0] : 'User'),
        email: method === 'EMAIL' ? identifier : undefined,
        phoneNumber: method === 'PHONE' ? identifier : undefined,
        role,
        credits: role === 'FAN' ? 1000 : 5000 // Give initial credits for testing
    };
    return currentUser;
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

export const getHistoricalStats = (): MonthlyStat[] => {
    return [
        { month: 'Jul', earnings: 15000, views: 12000, messages: 150 },
        { month: 'Aug', earnings: 22000, views: 15000, messages: 180 },
        { month: 'Sep', earnings: 18000, views: 14000, messages: 160 },
        { month: 'Oct', earnings: 25000, views: 18000, messages: 210 },
        { month: 'Nov', earnings: 35000, views: 22000, messages: 250 },
        { month: 'Dec', earnings: 42000, views: 25000, messages: 280 },
    ];
};

export const getProAnalytics = async (): Promise<ProAnalyticsData> => {
    return {
        trafficSources: [
            { name: 'YouTube', value: 45, color: '#FF0000' },
            { name: 'X', value: 25, color: '#000000' },
            { name: 'Instagram', value: 20, color: '#E1306C' },
            { name: 'Direct', value: 10, color: '#64748b' }
        ],
        funnel: [
            { name: 'Profile Views', count: 12400, fill: '#6366F1' },
            { name: 'Request Clicks', count: 3200, fill: '#818CF8' },
            { name: 'Successful Payments', count: 850, fill: '#4ADE80' }
        ],
        topAssets: [
            { id: 'l1', title: 'Discord Community', type: 'LINK', clicks: 1200, revenue: 0, ctr: '9.6%' },
            { id: 'p1', title: 'React Performance Masterclass', type: 'PRODUCT', clicks: 850, revenue: 85000, ctr: '6.8%' }
        ],
        audienceType: { new: 75, returning: 25 }
    };
};

export const getDetailedStatistics = async (timeFrame: StatTimeFrame, date: Date): Promise<DetailedStat[]> => {
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

        return {
            date: label,
            views: 500 + (i * 50) + (label.length * 10),
            likes: 50 + (i * 5),
            rating: 4.5 + ((i % 5) * 0.1)
        };
    }).reverse();
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

export const rateMessage = async (messageId: string, rating: number): Promise<void> => {
    messages = messages.map(m => m.id === messageId ? { ...m, rating } : m);
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
    } else {
        likes.add(currentUser.id);
    }
    
    return { likes: likes.size, hasLiked: !hasLiked };
};

export const getCreatorLikeStatus = async (creatorId: string): Promise<boolean> => {
    if (!currentUser) return false;
    return creatorLikes.get(creatorId)?.has(currentUser.id) || false;
};
