
import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  MessageSquare, 
  DollarSign, 
  User, 
  Send, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  AlertCircle, 
  LogOut, 
  Menu, 
  Home, 
  ExternalLink, 
  ArrowRight, 
  Lock, 
  Check, 
  Mail, 
  Heart, 
  Save, 
  Settings, 
  Plus, 
  Trash, 
  Camera, 
  Paperclip, 
  BarChart3, 
  Wallet, 
  Users, 
  Bell, 
  Search, 
  ChevronDown, 
  Ban, 
  Star, 
  Eye, 
  Share, 
  TrendingUp, 
  ShoppingBag, 
  FileText, 
  Image, 
  Video, 
  Link, 
  Tag, 
  CreditCard, 
  HelpCircle, 
  Receipt, 
  Download, 
  Play, 
  Trophy, 
  MonitorPlay, 
  LayoutGrid, 
  Flame, 
  Twitter, 
  Youtube, 
  Twitch, 
  Music2,
  Phone,
  PieChart,
  Calendar,
  RefreshCw,
  MousePointerClick
} from 'lucide-react';

export const GoogleLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export const InstagramLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

export const TikTokLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.394 6.394 0 0 0-5.394 9.365 6.394 6.394 0 0 0 10.964-2.413V8.25c1.2.918 2.726 1.46 4.366 1.46v-3.027a4.76 4.76 0 0 1-1.704-.007z" />
  </svg>
);

export const XLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const YouTubeLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export const Coins = ({ className, size = 24, ...props }: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 7c0 2.5 2 5 5 5-3 0-5 2.5-5 5 0-2.5-2-5-5-5 3 0 5-2.5 5-5z" />
  </svg>
);

export const BlueCheckLogo = ({ className, size = 24, ...props }: any) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" />
    <path d="M7.5 12L10.5 15L16.5 9" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export {
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  MessageSquare, 
  DollarSign, 
  User, 
  Send, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  AlertCircle, 
  LogOut, 
  Menu, 
  Home, 
  ExternalLink, 
  ArrowRight, 
  Lock, 
  Check, 
  Mail, 
  Heart, 
  Save, 
  Settings, 
  Plus, 
  Trash, 
  Camera, 
  Paperclip, 
  BarChart3, 
  Wallet, 
  Users, 
  Bell, 
  Search, 
  ChevronDown, 
  Ban, 
  Star, 
  Eye, 
  Share, 
  TrendingUp, 
  ShoppingBag, 
  FileText, 
  Image, 
  Video, 
  Link, 
  Tag, 
  CreditCard, 
  HelpCircle, 
  Receipt, 
  Download, 
  Play, 
  Trophy, 
  MonitorPlay, 
  LayoutGrid, 
  Flame, 
  Twitter, 
  Youtube, 
  Twitch, 
  Music2,
  Phone,
  PieChart,
  Calendar,
  RefreshCw,
  MousePointerClick
};
