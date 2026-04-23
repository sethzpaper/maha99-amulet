# Amulet Dashboard Notes

This repository is now frontend-only.

All data access goes through the Supabase JS client directly from the browser — configure with:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

See `MIGRATION_NOTES.md` for the required tables, RPC functions, and policies.

Use these commands for the frontend:

```bash
npm run dev
npm run build
npm run preview
npm run lint
```
