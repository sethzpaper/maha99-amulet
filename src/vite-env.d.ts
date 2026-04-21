/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_URL: string;
  readonly VITE_ADMIN_GITHUB_IDS: string;
  readonly VITE_MANAGER_EMAIL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
