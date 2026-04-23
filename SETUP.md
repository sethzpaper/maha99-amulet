# Setup

## Local Frontend

```bash
npm install
npm run dev
```

## Required Environment

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_API_URL=https://maha999-stat.lynxzmile.workers.dev
VITE_ADMIN_GITHUB_IDS=github_username1,github_username2
VITE_MANAGER_EMAIL=manager@example.com
```

## Cloudflare

Set the same `VITE_*` variables in Cloudflare Pages or your deployment environment. If the API is mounted on the same domain, `/api` is the frontend fallback.
