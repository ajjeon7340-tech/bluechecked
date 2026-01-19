
export enum MessageStatus {
  PENDING = 'PENDING',
  REPLIED = 'REPLIED',
  EXPIRED = 'EXPIRED', // Refunded (Time out)
  CANCELLED = 'CANCELLED', // Refunded (User action)
}

export type UserRole = 'CREATOR' | 'FAN';

export interface CurrentUser {
  id: string;
  email?: string;
  phoneNumber?: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  age?: number; 
  credits: number; // New field for internal currency balance
}

export interface AffiliateLink {
  id: string;
  title: string;
  url: string;
  isPromoted?: boolean;
  type?: 'EXTERNAL' | 'DIGITAL_PRODUCT';
  price?: number; // In Credits
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  price: number; // In Credits
  imageUrl?: string;
  url: string; 
  buttonText?: string;
}

export interface CreatorProfile {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  pricePerMessage: number; // In Credits
  responseWindowHours: number; 
  welcomeMessage?: string; 
  intakeInstructions?: string; 
  customQuestions: string[]; 
  tags: string[];
  links: AffiliateLink[];
  products: Product[]; 
  likesCount: number;
  isPremium?: boolean; 
  platforms?: string[]; 
  rankingTitle?: string; 
  bannerGradient?: string; 
  stats: {
    responseTimeAvg: string;
    replyRate: string;
    profileViews: number;
    averageRating: number;
  };
}

export interface ChatMessage {
  id: string;
  role: 'CREATOR' | 'FAN';
  content: string;
  timestamp: string;
}

export interface Message {
  id: string;
  senderName: string;
  senderEmail: string;
  content: string;
  attachmentUrl?: string; 
  amount: number; // In Credits
  creatorId?: string;
  creatorName?: string;
  creatorAvatarUrl?: string;
  createdAt: string; 
  expiresAt: string; 
  status: MessageStatus;
  replyContent?: string;
  replyAt?: string;
  isRead: boolean;
  conversation: ChatMessage[];
  rating?: number; 
  review?: string;
}

export interface MonthlyStat {
  month: string;
  earnings: number; // Credits
  views: number;
  messages: number;
}

// --- NEW ANALYTICS TYPES ---
export interface TrafficSource {
  name: string;
  value: number; // percentage
  color: string;
}

export interface FunnelStep {
  name: string;
  count: number;
  fill: string;
}

export interface TopAsset {
  id: string;
  title: string;
  type: 'LINK' | 'PRODUCT';
  clicks: number;
  revenue: number; // Credits
  ctr: string;
}

export interface ProAnalyticsData {
  trafficSources: TrafficSource[];
  funnel: FunnelStep[];
  topAssets: TopAsset[];
  audienceType: { new: number; returning: number };
}

// --- NEW STATISTICS TYPES ---
export type StatTimeFrame = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface DetailedStat {
    date: string;
    views: number;
    likes: number;
    rating: number;
}

export interface DetailedFinancialStat {
    date: string;
    totalRevenue: number; // Credits
    messageRevenue: number;
    productRevenue: number;
    tips: number;
}

export interface DashboardStats {
  totalEarnings: number; // Credits
  pendingCount: number;
  responseRate: number;
  // Historical Data
  monthlyStats: MonthlyStat[];
  // Pro Data (Optional until fetched)
  proAnalytics?: ProAnalyticsData;
}
