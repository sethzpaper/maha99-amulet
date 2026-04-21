import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  login: (username: string, password: string) => Promise<boolean>;
  loginEmployee: (employeeId: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signInWithGitHub: () => Promise<string | null>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  getUser: () => User | null;
}

const SUPER_ADMIN = {
  username: 'admin',
  password: '11221122',
  id: 'super-admin',
  role: 'super_admin' as const,
};

// GitHub User IDs ที่ได้รับสิทธิ์ admin โดยตรง
const ADMIN_GITHUB_IDS = import.meta.env.VITE_ADMIN_GITHUB_IDS
  ? import.meta.env.VITE_ADMIN_GITHUB_IDS.split(',').map((id: string) => id.trim())
  : ['sethzpaper']; // fallback default

const mapSupabaseUser = (supabaseUser: any): User => {
  const provider = supabaseUser.app_metadata?.provider || 'github';
  const username = supabaseUser.user_metadata?.user_name || supabaseUser.email || 'GitHub User';

  // ตรวจสอบสิทธิ์ admin สำหรับ GitHub users
  let role: 'super_admin' | 'admin' | 'user' = 'user';
  if (provider === 'github' && ADMIN_GITHUB_IDS.includes(username)) {
    role = 'super_admin'; // GitHub admins = super_admin
  }

  return {
    id: supabaseUser.id,
    username,
    role,
    provider,
    isAuthenticated: true,
  };
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        if (
          username === SUPER_ADMIN.username &&
          password === SUPER_ADMIN.password
        ) {
          const user: User = {
            id: SUPER_ADMIN.id,
            username: SUPER_ADMIN.username,
            role: SUPER_ADMIN.role,
            isAuthenticated: true,
          };
          set({ user, isAuthenticated: true });
          return true;
        }

        if (isSupabaseConfigured) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: username,
            password,
          });

          if (error) {
            console.warn('Supabase sign-in error:', error.message);
            return false;
          }

          if (data.session?.user) {
            set({
              user: mapSupabaseUser(data.session.user),
              isAuthenticated: true,
            });
            return true;
          }
        }

        return false;
      },

      loginEmployee: async (employeeId: string, password: string) => {
        try {
          const apiBase = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000/api';
          const res = await fetch(`${apiBase}/employees/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, password }),
          });
          const data = await res.json();
          if (!res.ok) return { ok: false, error: data.error || 'login failed' };

          const emp = data.employee;
          const user: User = {
            id: emp.id,
            username: emp.nickname,
            nickname: emp.nickname,
            avatarUrl: emp.avatar_url,
            email: emp.email,
            role: (emp.role as 'super_admin' | 'admin' | 'user') || 'user',
            provider: 'employee',
            isAuthenticated: true,
          };
          set({ user, isAuthenticated: true });
          return { ok: true };
        } catch (err: any) {
          return { ok: false, error: err.message };
        }
      },

      signInWithGitHub: async () => {
        if (!isSupabaseConfigured) {
          return 'Supabase ยังไม่ถูกตั้งค่า';
        }

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'github',
          options: {
            scopes: 'read:user',
          },
        });

        if (error) {
          console.warn('Supabase GitHub auth error:', error.message);
          return error.message;
        }

        return null;
      },

      logout: async () => {
        if (isSupabaseConfigured) {
          await supabase.auth.signOut();
        }
        set({ user: null, isAuthenticated: false });
      },

      loadSession: async () => {
        if (!isSupabaseConfigured) return;

        const { data } = await supabase.auth.getSession();

        if (data.session?.user) {
          set({
            user: mapSupabaseUser(data.session.user),
            isAuthenticated: true,
          });
        }

        supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            set({
              user: mapSupabaseUser(session.user),
              isAuthenticated: true,
            });
          } else {
            set({ user: null, isAuthenticated: false });
          }
        });
      },

      getUser: () => get().user,
    }),
    {
      name: 'auth-storage',
    }
  )
);
