import {
  Amulet,
  LineLog,
  DailyStat,
  SocialPost,
  VideoRecord,
  CompetitorAnalysisResponse,
  LeaderboardEntry,
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Type for API response with fallback
interface APIResponse<T> {
  data?: T;
  error?: string;
}

class DataService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private getCacheKey(endpoint: string): string {
    return endpoint;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async fetchFromGoogleSheet(): Promise<any[]> {
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbwClml-S-O5-SiS2YYeFTADnw3Zi8i1W52phhIdKo2GVSoTTh-pYmd_UG_wuTg59g_f/exec';
    try {
      const response = await fetch(GAS_URL);
      if (!response.ok) throw new Error('Failed to fetch from Google Sheet');
      const data = await response.json();
      return data;
    } catch (error) {
      console.warn('Error fetching from Google Sheet:', error);
      return [];
    }
  }

  async fetchAmulets(): Promise<Amulet[]> {
    const cacheKey = this.getCacheKey('amulets');
    const cached = this.getFromCache<Amulet[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${API_BASE_URL}/amulets`);
      if (!response.ok) throw new Error('Failed to fetch amulets');
      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.warn('Error fetching amulets from API:', error);
      // Return empty array and let component handle fallback
      return [];
    }
  }

  async fetchVideos(): Promise<VideoRecord[]> {
    const cacheKey = this.getCacheKey('videos');
    const cached = this.getFromCache<VideoRecord[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${API_BASE_URL}/videos`);
      if (!response.ok) throw new Error('Failed to fetch videos');
      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.warn('Error fetching videos from API:', error);
      return [];
    }
  }

  async createVideo(video: Partial<VideoRecord>): Promise<VideoRecord | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(video),
      });
      if (!response.ok) throw new Error('Failed to create video');
      const data = await response.json();
      this.cache.delete(this.getCacheKey('videos'));
      return data.video;
    } catch (error) {
      console.warn('Error creating video:', error);
      return null;
    }
  }

  async updateVideo(id: string, video: Partial<VideoRecord>): Promise<VideoRecord | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/videos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(video),
      });
      if (!response.ok) throw new Error('Failed to update video');
      const data = await response.json();
      this.cache.delete(this.getCacheKey('videos'));
      return data.video;
    } catch (error) {
      console.warn('Error updating video:', error);
      return null;
    }
  }

  async deleteVideo(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/videos/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete video');
      this.cache.delete(this.getCacheKey('videos'));
      return true;
    } catch (error) {
      console.warn('Error deleting video:', error);
      return false;
    }
  }

  async fetchLineLogs(): Promise<LineLog[]> {
    const cacheKey = this.getCacheKey('line-logs');
    const cached = this.getFromCache<LineLog[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${API_BASE_URL}/line-logs`);
      if (!response.ok) throw new Error('Failed to fetch line logs');
      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.warn('Error fetching line logs from API:', error);
      return [];
    }
  }

  async fetchFacebookPosts(): Promise<SocialPost[]> {
    const cacheKey = this.getCacheKey('facebook-posts');
    const cached = this.getFromCache<SocialPost[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${API_BASE_URL}/social-posts?platform=facebook`);
      if (!response.ok) throw new Error('Failed to fetch facebook posts');
      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.warn('Error fetching facebook posts from API:', error);
      return [];
    }
  }

  async fetchTikTokPosts(): Promise<SocialPost[]> {
    const cacheKey = this.getCacheKey('tiktok-posts');
    const cached = this.getFromCache<SocialPost[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${API_BASE_URL}/social-posts?platform=tiktok`);
      if (!response.ok) throw new Error('Failed to fetch tiktok posts');
      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.warn('Error fetching tiktok posts from API:', error);
      return [];
    }
  }

  async fetchCompetitorFacebook(): Promise<SocialPost[]> {
    const cacheKey = this.getCacheKey('competitor-facebook');
    const cached = this.getFromCache<SocialPost[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${API_BASE_URL}/competitor-facebook`);
      if (!response.ok) throw new Error('Failed to fetch competitor facebook posts');
      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.warn('Error fetching competitor facebook posts from API:', error);
      return [];
    }
  }

  async fetchCompetitorTikTok(): Promise<SocialPost[]> {
    const cacheKey = this.getCacheKey('competitor-tiktok');
    const cached = this.getFromCache<SocialPost[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${API_BASE_URL}/competitor-tiktok`);
      if (!response.ok) throw new Error('Failed to fetch competitor tiktok posts');
      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.warn('Error fetching competitor tiktok posts from API:', error);
      return [];
    }
  }

  async fetchCompetitorAnalysis(): Promise<CompetitorAnalysisResponse | null> {
    const cacheKey = this.getCacheKey('competitor-analysis');
    const cached = this.getFromCache<CompetitorAnalysisResponse>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${API_BASE_URL}/competitor-analysis`);
      if (!response.ok) throw new Error('Failed to fetch competitor analysis');
      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.warn('Error fetching competitor analysis from API:', error);
      return null;
    }
  }

  async fetchLeaderboard(metric: 'views' | 'likes-fb' | 'likes-tt' | 'hours'): Promise<LeaderboardEntry[]> {
    const cacheKey = this.getCacheKey(`leaderboard-${metric}`);
    const cached = this.getFromCache<LeaderboardEntry[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${API_BASE_URL}/leaderboard/${metric}`);
      if (!response.ok) throw new Error(`Failed to fetch leaderboard ${metric}`);
      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.warn(`Error fetching leaderboard ${metric}:`, error);
      return [];
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  async checkAPIHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL.replace('/api', '')}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const dataService = new DataService();
