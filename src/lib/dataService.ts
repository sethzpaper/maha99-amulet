import {
  Amulet,
  SocialPost,
  VideoRecord,
  LeaderboardEntry,
} from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';

class DataService {
  invalidateVideos() { this.cache.delete(this.getCacheKey('videos')); }
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
      // The asset editor must not overwrite workflow fields from a stale row.
      const fields: (keyof VideoRecord)[] = ['entryDate', 'fileName', 'productName', 'productImage', 'driveLink', 'creator', 'isPostedFB', 'isPostedTT', 'fbPostDate', 'ttPostDate', 'fbViews', 'fbLikes', 'ttViews', 'ttLikes'];
      const payload = Object.fromEntries(fields.filter((field) => field in video).map((field) => [field, video[field]]));
      const { data, error } = await supabase.from('videos').update(payload).eq('id', id).select().single();
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

  async fetchFacebookPosts(): Promise<SocialPost[]> {
    const cacheKey = this.getCacheKey('facebook-posts');
    const cached = this.getFromCache<SocialPost[]>(cacheKey);
    if (cached) return cached;
    const data = await this.safeSelect<SocialPost>('social_posts', (q) => q.eq('platform', 'facebook'));
    this.setCache(cacheKey, data);
    return data;
  }

  async fetchLeaderboard(metric: 'views' | 'likes-fb' | 'hours'): Promise<LeaderboardEntry[]> {
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
