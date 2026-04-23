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

const normalizeRole = (role: unknown): User['role'] => {
  return role === 'super_admin' || role === 'admin' || role === 'user' ? role : 'user';
};

const mapSupabaseUser = (supabaseUser: any): User => {
  const username =
    supabaseUser.user_metadata?.name ||
    supabaseUser.user_metadata?.user_name ||
    supabaseUser.email ||
    'User';

  return {
    id: supabaseUser.id,
    username,
    role: normalizeRole(supabaseUser.user_metadata?.role || supabaseUser.app_metadata?.role),
    provider: supabaseUser.app_metadata?.provider || 'email',
    isAuthenticated: true,
    email: supabaseUser.email,
    avatarUrl: supabaseUser.user_metadata?.avatar_url,
  };
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        if (username === SUPER_ADMIN.username && password === SUPER_ADMIN.password) {
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
          const apiBase = (import.meta.env.VITE_API_URL as string) || '/api';
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
            role: normalizeRole(emp.role),
            provider: 'employee',
            isAuthenticated: true,
          };
          set({ user, isAuthenticated: true });
          return { ok: true };
        } catch (err: any) {
          return { ok: false, error: err.message };
        }
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
