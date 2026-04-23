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
VITE_ADMIN_GITHUB_IDS=github_username1,github_username2
VITE_MANAGER_EMAIL=manager@example.com
```

## Deployment

Set the same `VITE_*` variables in Cloudflare Pages (or your static host). All data access now goes through the Supabase client — no separate API worker is required. See `MIGRATION_NOTES.md` for required Supabase schema/RPC/storage setup.
