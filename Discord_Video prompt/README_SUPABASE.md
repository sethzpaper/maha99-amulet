# Supabase migration

The Discord bot and Worktime admin can use either SQLite or Supabase through
the same repository interface. Keep SQLite enabled until the cloud schema and
data migration have completed.

## 1. Create the schema

1. Create a Supabase project.
2. Open SQL Editor in the Supabase Dashboard.
3. Run `supabase/migrations/20260613_initial.sql`.

The migration creates:

- Attendance employees and entries
- Video projects, assets, costs, and events
- Private `attendance-reports` and `video-assets` Storage buckets
- RLS policies restricted to authenticated users whose
  `app_metadata.role` is `admin`
- Realtime publication entries for all workflow tables

The Discord bot and server-side admin use the service role key. Never put that
key in Discord messages or browser JavaScript.

## 2. Configure the server

Add these values to `.env`:

```env
DATABASE_BACKEND=sqlite
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
SUPABASE_REPORTS_BUCKET=attendance-reports
SUPABASE_ASSETS_BUCKET=video-assets
```

Install dependencies:

```powershell
.\.python-3.12.4\python.exe -m pip install -r requirements.txt
```

## 3. Copy existing SQLite data

Keep `DATABASE_BACKEND=sqlite` while running:

```powershell
.\.python-3.12.4\python.exe scripts\migrate_sqlite_to_supabase.py
```

The script copies employees, attendance entries, projects, assets, costs, and
events. It then synchronizes Postgres identity sequences so new records cannot
reuse migrated IDs.

## 4. Switch production to Supabase

Change:

```env
DATABASE_BACKEND=supabase
```

Restart both processes:

```powershell
.\.python-3.12.4\python.exe bot.py
.\.python-3.12.4\python.exe admin_web.py
```

Run `/clockin`, `/clockout`, `/summary`, and `/new-video-project` once and
verify the new rows in Supabase Table Editor.

Monthly PDF reports are uploaded to the private `attendance-reports` bucket.
The file path is:

```text
DISCORD_USER_ID/YYYY/MM.pdf
```

## Realtime access

The migration adds all six workflow tables to `supabase_realtime`. A browser
dashboard must sign in with Supabase Auth and have this server-controlled
metadata:

```json
{
  "role": "admin"
}
```

Do not place authorization roles in user-editable `user_metadata`.

## Rollback

Set `DATABASE_BACKEND=sqlite` and restart the bot/admin web. The original
SQLite files remain untouched under `runtime/`.
