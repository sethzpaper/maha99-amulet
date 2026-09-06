import { create } from 'zustand';
import type { User as AuthUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user' | 'super_admin';
  provider?: string;
  isAuthenticated: boolean;
  nickname?: string;
  avatarUrl?: string;
  email?: string;
}
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  getUser: () => User | null;
}
function mapUser(user: AuthUser): User {
  // Privileges must come exclusively from server-managed metadata.
  const role = user.app_metadata?.role;
  return {
    id: user.id, username: user.user_metadata?.name || user.email || 'User',
    nickname: user.user_metadata?.nickname, avatarUrl: user.user_metadata?.avatar_url,
    email: user.email, provider: user.app_metadata?.provider,
    role: role === 'admin' || role === 'super_admin' ? role : 'user',
    isAuthenticated: true,
  };
}
let subscribed = false;
let revision = 0;
let signingIn = false;
export const useAuthStore = create<AuthState>((set, get) => {
  const verify = async () => {
    const current = ++revision;
    if (!get().isAuthenticated) set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.getUser();
      if (current !== revision) return;
      const user = !error && data.user ? mapUser(data.user) : null;
      set({ user, isAuthenticated: !!user, isLoading: false });
    } catch {
      if (current === revision) set({ user: null, isAuthenticated: false, isLoading: false });
    }
  };
  return {
    user: null, isAuthenticated: false, isLoading: isSupabaseConfigured,
    login: async (email, password) => {
      if (!isSupabaseConfigured) return false;
      signingIn = true;
      set({ user: null, isAuthenticated: false });
      try {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) return false;
        await verify();
        return get().isAuthenticated;
      } catch { return false; }
      finally { signingIn = false; }
    },
    logout: async () => {
      ++revision;
      set({ user: null, isAuthenticated: false, isLoading: false });
      if (isSupabaseConfigured) await supabase.auth.signOut();
    },
    loadSession: async () => {
      localStorage.removeItem('auth-storage');
      if (!isSupabaseConfigured) return;
      if (!subscribed) {
        subscribed = true;
        supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN' && signingIn) return;
          if (event === 'SIGNED_OUT') {
            ++revision;
            set({ user: null, isAuthenticated: false, isLoading: false });
          } else if (event !== 'INITIAL_SESSION') {
            // Defer API calls until the auth callback releases its lock.
            setTimeout(() => { void verify(); }, 0);
          }
        });
      }
      await verify();
    },
    getUser: () => get().user,
  };
});
