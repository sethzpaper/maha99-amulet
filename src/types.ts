export interface Amulet {
  id: string;
  name: string;
  type: string;
  popularity: number;
  posts: number;
  likes: number;
  shares: number;
  trend: 'up' | 'down' | 'stable';
  image: string;
}

export interface LineLog {
  id: string;
  userName: string;
  action: 'check-in' | 'check-out';
  timestamp: string;
  groupName: string;
}

export interface SocialPost {
  id: string;
  platform: 'facebook' | 'tiktok';
  content: string;
  link: string;
  engagement: number;
  timestamp: string;
}

export interface AdminStats {
  id: string;
  name: string;
  avatar: string; // Google Drive or URL
  daily: number;
  weekly: number;
  monthly: number;
  performance: number; // 0-100
}

export interface DailyStat {
  date: string;
  popularity: number;
  mentions: number;
}

export interface VideoRecord {
  id: string;
  entryDate: string;
  fileName: string;
  productName: string;
  productImage?: string; // Google Drive or URL
  driveLink: string;
  creator: string;
  isPostedFB: boolean;
  isPostedTT: boolean;
  fbPostDate?: string;
  ttPostDate?: string;
}

export interface AttendanceRecord {
  id: string;
  adminId: string;
  adminName: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  totalHours: number;
  overtime: string;
  status: 'working' | 'out' | 'late' | 'leave' | 'auto-leave';
}

export interface PriceTrack {
  date: string;
  amuletName: string;
  price: number;
}

export interface DailyTag {
  tag: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ActivityLog {
  id: string;
  user: string;
  action: string;
  details: string;
  timestamp: string;
  type: 'update' | 'create' | 'delete' | 'system';
}

export interface GoogleTrend {
  keyword: string;
  searchVolume: number;
  growth: string;
}

export interface CompetitorAnalysis {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  trends: string[];
  recommendations: string[];
  marketPosition: string;
}

export interface CompetitorAnalysisResponse {
  facebook: CompetitorAnalysis;
  tiktok: CompetitorAnalysis;
  timestamp: string;
}
