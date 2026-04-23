# Amulet Dashboard

Frontend dashboard built with React, TypeScript, Vite, Tailwind CSS, Supabase, and Cloudflare-hosted API services.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
```

## Environment

Copy `.env.example` to your local env file and configure Supabase:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_ADMIN_GITHUB_IDS=github_username1,github_username2
VITE_MANAGER_EMAIL=manager@example.com
```

All data access now goes through the Supabase client directly from the browser. See `MIGRATION_NOTES.md` for the required tables, RPC functions, storage buckets, and RLS policies.

## Project Shape

```text
src/
  components/     React UI components
  data/           Mock and fallback data
  lib/            API clients, auth store, utilities
  App.tsx         Main app shell
  main.tsx        Vite entry point
  types.ts        Shared frontend types
public/
  _redirects      Static hosting redirects
```

The old local Express server has been removed. Backend behavior now lives outside this repository, so Cloudflare environment variables must provide the correct API endpoint before production deploys.
