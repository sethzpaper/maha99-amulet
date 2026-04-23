import {
  Amulet,
  LineLog,
  SocialPost,
  VideoRecord,
  CompetitorAnalysisResponse,
  LeaderboardEntry,
} from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';

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

  private async safeSelect<T>(table: string, build?: (q: any) => any): Promise<T[]> {
    if (!isSupabaseConfigured) return [];
    try {
      let q: any = supabase.from(table).select('*');
      if (build) q = build(q);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data || []) as T[];
    } catch (error) {
      console.warn(`Error fetching ${table}:`, error);
      return [];
    }
  }

  async fetchAmulets(): Promise<Amulet[]> {
    const cacheKey = this.getCacheKey('amulets');
    const cached = this.getFromCache<Amulet[]>(cacheKey);
    if (cached) return cached;
    const data = await this.safeSelect<Amulet>('amulets');
    this.setCache(cacheKey, data);
    return data;
  }

  async fetchVideos(): Promise<VideoRecord[]> {
    const cacheKey = this.getCacheKey('videos');
    const cached = this.getFromCache<VideoRecord[]>(cacheKey);
    if (cached) return cached;
    const data = await this.safeSelect<VideoRecord>('videos');
    this.setCache(cacheKey, data);
    return data;
  }

  async createVideo(video: Partial<VideoRecord>): Promise<VideoRecord | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase.from('videos').insert(video).select().single();
      if (error) throw new Error(error.message);
      this.cache.delete(this.getCacheKey('videos'));
      return data as VideoRecord;
    } catch (error) {
      console.warn('Error creating video:', error);
      return null;
    }
  }

  async updateVideo(id: string, video: Partial<VideoRecord>): Promise<VideoRecord | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase.from('videos').update(video).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      this.cache.delete(this.getCacheKey('videos'));
      return data as VideoRecord;
    } catch (error) {
      console.warn('Error updating video:', error);
      return null;
    }
  }

  async deleteVideo(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase.from('videos').delete().eq('id', id);
      if (error) throw new Error(error.message);
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
    const data = await this.safeSelect<LineLog>('line_logs');
    this.setCache(cacheKey, data);
    return data;
  }

  async fetchFacebookPosts(): Promise<SocialPost[]> {
    const cacheKey = this.getCacheKey('facebook-posts');
    const cached = this.getFromCache<SocialPost[]>(cacheKey);
    if (cached) return cached;
    const data = await this.safeSelect<SocialPost>('social_posts', (q) => q.eq('platform', 'facebook'));
    this.setCache(cacheKey, data);
    return data;
  }

  async fetchTikTokPosts(): Promise<SocialPost[]> {
    const cacheKey = this.getCacheKey('tiktok-posts');
    const cached = this.getFromCache<SocialPost[]>(cacheKey);
    if (cached) return cached;
    const data = await this.safeSelect<SocialPost>('social_posts', (q) => q.eq('platform', 'tiktok'));
    this.setCache(cacheKey, data);
    return data;
  }

  async fetchCompetitorFacebook(): Promise<SocialPost[]> {
    const cacheKey = this.getCacheKey('competitor-facebook');
    const cached = this.getFromCache<SocialPost[]>(cacheKey);
    if (cached) return cached;
    const data = await this.safeSelect<SocialPost>('competitor_facebook');
    this.setCache(cacheKey, data);
    return data;
  }

  async fetchCompetitorTikTok(): Promise<SocialPost[]> {
    const cacheKey = this.getCacheKey('competitor-tiktok');
    const cached = this.getFromCache<SocialPost[]>(cacheKey);
    if (cached) return cached;
    const data = await this.safeSelect<SocialPost>('competitor_tiktok');
    this.setCache(cacheKey, data);
    return data;
  }

  async fetchCompetitorAnalysis(): Promise<CompetitorAnalysisResponse | null> {
    const cacheKey = this.getCacheKey('competitor-analysis');
    const cached = this.getFromCache<CompetitorAnalysisResponse>(cacheKey);
    if (cached) return cached;
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase
        .from('competitor_analysis')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      this.setCache(cacheKey, data);
      return data as unknown as CompetitorAnalysisResponse;
    } catch (error) {
      console.warn('Error fetching competitor analysis:', error);
      return null;
    }
  }

  async fetchLeaderboard(metric: 'views' | 'likes-fb' | 'likes-tt' | 'hours'): Promise<LeaderboardEntry[]> {
    const cacheKey = this.getCacheKey(`leaderboard-${metric}`);
    const cached = this.getFromCache<LeaderboardEntry[]>(cacheKey);
    if (cached) return cached;
    // Map metric -> table name convention: leaderboard_<metric> (with underscores)
    const table = `leaderboard_${metric.replace(/-/g, '_')}`;
    const data = await this.safeSelect<LeaderboardEntry>(table);
    this.setCache(cacheKey, data);
    return data;
  }

  clearCache(): void {
    this.cache.clear();
  }

  async checkAPIHealth(): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase.from('employees').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }
}

export const dataService = new DataService();
