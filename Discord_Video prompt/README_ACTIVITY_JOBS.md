# Discord Activity, Queues, and Cron

## Supabase jobs

After applying `supabase/migrations/20260613_initial.sql`, run:

```text
supabase/migrations/20260613_jobs.sql
```

This migration:

- Enables Supabase Queues (`pgmq`) and Cron (`pg_cron`)
- Creates durable `ai_jobs` and `report_jobs` queues
- Creates `job_runs` for monitoring and Realtime updates
- Schedules monthly Worktime reports at 00:10 Asia/Bangkok on day 1
- Retries failed worker jobs through queue visibility, archiving after attempt 3

The Supabase project must support `pgmq` and `pg_cron`. They can also be
enabled from Dashboard > Integrations before running the migration.

Start the worker:

```powershell
.\.python-3.12.4\python.exe job_worker.py
```

`AI_JOB_WEBHOOK_URL` receives AI job payloads. It can point to Manus,
n8n, an Edge Function, or another renderer/orchestrator. A successful HTTP
response completes the job. Monthly reports are generated locally and uploaded
to the private `attendance-reports` bucket.

## Activity build

```powershell
cd activity
npm install
npm run build
cd ..
.\.python-3.12.4\python.exe activity_server.py
```

Local browser preview:

```env
ACTIVITY_DEV_BYPASS=true
DATABASE_BACKEND=sqlite
```

Production:

```env
ACTIVITY_DEV_BYPASS=false
DATABASE_BACKEND=supabase
DISCORD_CLIENT_ID=your_application_id
DISCORD_CLIENT_SECRET=your_oauth_client_secret
```

## Discord Developer Portal

1. Open the same Discord application used by the bot.
2. Under OAuth2, add `https://127.0.0.1` as the Activity redirect placeholder.
3. Under Activities > URL Mappings, map `/` to the public HTTPS host serving
   `activity_server.py`.
4. Enable Activities. Discord creates the default `Launch` entry point.
5. Install the application to the `Mahaniyom Workflow` server.
6. Launch it from Discord's App Launcher in a text or voice channel.

The Activity authenticates with the Discord Embedded App SDK. The browser never
receives the Supabase service role key. The backend validates Discord access
tokens and bridges live board updates over WebSocket.

## Kanban behavior

- Drag cards between the seven Video Pipeline stages.
- Click the sparkle icon on a card to enqueue an AI job.
- Project changes made by the bot or another Activity session appear live.
- Job status is read from `job_runs`.

Do not enable `ACTIVITY_DEV_BYPASS` on a public deployment.
