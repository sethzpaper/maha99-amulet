# Migration Notes: Cloudflare Worker → Supabase (browser-direct)

The frontend now calls Supabase directly via `@supabase/supabase-js`. The Cloudflare Worker backend and `VITE_API_URL` are removed. This document lists everything you must provision in your Supabase project.

## 1. SQL: tables

Run the following SQL in the Supabase SQL editor. Enable `pgcrypto` first for `crypt()`/`gen_salt()`.

```sql
create extension if not exists pgcrypto;

-- Employees + auth
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text unique not null,
  nickname text not null,
  full_name text,
  avatar_url text,
  birthday date,
  email text,
  phone text,
  position text,
  start_date date,
  role text not null default 'user' check (role in ('super_admin','admin','user')),
  is_active boolean not null default true,
  password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text,
  color text
);

create table if not exists public.employee_badges (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  note text
);

create table if not exists public.tracked_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('facebook','tiktok')),
  account_name text not null,
  account_url text not null,
  account_handle text,
  is_active boolean not null default true,
  is_competitor boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

-- Attendance
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_name text not null,
  work_date date not null,
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_photo_url text,
  check_out_photo_url text,
  total_hours numeric,
  overtime_hours numeric,
  status text not null default 'working' check (status in ('working','out','late','leave','auto-leave','auto-out')),
  note text,
  unique (user_id, work_date)
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_name text not null,
  user_email text,
  leave_date date not null,
  leave_type text not null default 'personal' check (leave_type in ('personal','sick','vacation','other')),
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  manager_email text,
  manager_note text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Best-effort content tables (leave empty if unused; UI will show empty state)
create table if not exists public.amulets (
  id uuid primary key default gen_random_uuid(),
  name text, type text, popularity int, posts int, likes int, shares int,
  trend text, image text
);
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  entryDate date, fileName text, productName text, productImage text,
  driveLink text, creator text,
  isPostedFB boolean default false, isPostedTT boolean default false,
  fbPostDate date, ttPostDate date,
  fbViews int, fbLikes int, ttViews int, ttLikes int
);
create table if not exists public.line_logs (
  id uuid primary key default gen_random_uuid(),
  userName text, action text, timestamp timestamptz, groupName text
);
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  platform text check (platform in ('facebook','tiktok')),
  content text, link text, engagement int, timestamp timestamptz
);
create table if not exists public.competitor_facebook (like public.social_posts including all);
create table if not exists public.competitor_tiktok (like public.social_posts including all);
create table if not exists public.competitor_analysis (
  id uuid primary key default gen_random_uuid(),
  facebook jsonb, tiktok jsonb, timestamp timestamptz default now(),
  created_at timestamptz default now()
);
-- Leaderboards: one table per metric
create table if not exists public.leaderboard_views (rank int, creator text, name text, value numeric);
create table if not exists public.leaderboard_likes_fb (rank int, creator text, name text, value numeric);
create table if not exists public.leaderboard_likes_tt (rank int, creator text, name text, value numeric);
create table if not exists public.leaderboard_hours (rank int, creator text, name text, value numeric);
```

## 2. Employee login RPC

```sql
create or replace function public.employee_login(p_code text, p_password text)
returns table (
  id uuid,
  employee_code text,
  nickname text,
  full_name text,
  avatar_url text,
  email text,
  role text,
  is_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select e.id, e.employee_code, e.nickname, e.full_name, e.avatar_url,
           e.email, e.role, e.is_active
    from public.employees e
    where e.employee_code = p_code
      and e.is_active = true
      and e.password_hash is not null
      and e.password_hash = crypt(p_password, e.password_hash);
end;
$$;

grant execute on function public.employee_login(text, text) to anon, authenticated;
```

Add a companion RPC so the web app can hash passwords correctly when creating or editing employees:

```sql
create or replace function public.set_employee_password(p_code text, p_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.employees
  set password_hash = crypt(p_password, gen_salt('bf', 10)),
      updated_at = now()
  where employee_code = p_code;

  if not found then
    raise exception 'employee not found for code %', p_code;
  end if;
end;
$$;

grant execute on function public.set_employee_password(text, text) to anon, authenticated;
```

Seed employee passwords with bcrypt:

```sql
insert into public.employees (employee_code, nickname, role, password_hash)
values ('EMP001', 'Ploy', 'admin', crypt('initial-password', gen_salt('bf', 10)));

-- update password later
update public.employees
set password_hash = crypt('new-password', gen_salt('bf', 10))
where employee_code = 'EMP001';
```

## 3. Storage bucket: attendance-photos

Create bucket `attendance-photos` (public read):

```sql
insert into storage.buckets (id, name, public)
values ('attendance-photos', 'attendance-photos', true)
on conflict (id) do nothing;

-- allow anon uploads (tighten to authenticated if you add Supabase Auth for employees)
create policy "attendance upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'attendance-photos');

create policy "attendance read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'attendance-photos');
```

## 4. RLS recommendations

Since the app currently uses the anon key from the browser (no Supabase Auth session for employees), you have two choices:

### Option A — Pragmatic (match old worker semantics)

Enable RLS, allow `anon` read on most tables, and gate writes via RPCs that check a passed admin token. Simplest short-term:

```sql
alter table public.employees enable row level security;
alter table public.badges enable row level security;
alter table public.employee_badges enable row level security;
alter table public.tracked_accounts enable row level security;
alter table public.time_entries enable row level security;
alter table public.leave_requests enable row level security;

-- Read policies
create policy "public read employees" on public.employees for select using (true);
create policy "public read badges"    on public.badges    for select using (true);
create policy "public read emp_badges" on public.employee_badges for select using (true);
create policy "public read tracked"   on public.tracked_accounts for select using (true);
create policy "public read time"      on public.time_entries    for select using (true);
create policy "public read leaves"    on public.leave_requests  for select using (true);

-- Permissive writes (TEMP — tighten before production)
create policy "anon write time"   on public.time_entries   for insert with check (true);
create policy "anon update time"  on public.time_entries   for update using (true);
create policy "anon write leave"  on public.leave_requests for insert with check (true);
```

Do NOT expose `employees.password_hash` through a generic public-read policy. Use a view or column-level grant:

```sql
revoke select on public.employees from anon, authenticated;
grant select (id, employee_code, nickname, full_name, avatar_url, birthday,
              email, phone, position, start_date, role, is_active,
              created_at, updated_at) on public.employees to anon, authenticated;
```

### Option B — Proper (recommended)

Issue each employee a real Supabase Auth account (or sign them in via a custom JWT minted from `employee_login`), then write RLS policies that check `auth.uid()` / `auth.jwt() ->> 'role'`. This is a larger project; defer until after launch.

## 5. Environment variables

Removed: `VITE_API_URL` (worker URL).

Required:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_MANAGER_EMAIL=manager@example.com      # used as default manager_email for leave requests
VITE_ADMIN_GITHUB_IDS=...                    # unchanged
```

## 6. What breaks / operational checklist

- **Employee logins**: every row in `employees` needs `password_hash = crypt(plaintext, gen_salt('bf', 10))`. Existing rows that had passwords on the old worker DB must be re-seeded.
- **Super-admin** hardcoded login (`admin` / `11221122`) still works client-side (unchanged in `authStore.ts`).
- **Check-in/out photos** are now uploaded to the Supabase Storage bucket `attendance-photos`; create it first or uploads silently fail (entry still saves without photo URL).
- **Monthly report export** is now computed client-side — response shape changed to `{ month, entries, summary[] }`. Any component that previously relied on a worker-specific payload may need tweaks.
- **Leave quota** is hardcoded at 2 per calendar month in the client (`LEAVE_MONTHLY_LIMIT`). Move this into the DB if policy changes.
- **Content tables** (`amulets`, `videos`, `line_logs`, `social_posts`, `competitor_*`, `leaderboard_*`) are best-effort: if a table is missing the UI falls back to empty arrays/null. Create the ones you actually need.
- **No build-time dependency changes** — `@supabase/supabase-js` was already present.
- After seeding, verify `supabase.rpc('employee_login', { p_code, p_password })` returns a row for a known employee.


## 7. Auto-Checkout (เพิ่มใหม่)

ระบบจะเปลี่ยนสถานะ `working` ที่ค้างจากวันก่อน → `auto-out` พร้อมกำหนด
`check_out_time = 23:59:59 ของ work_date` โดยอัตโนมัติ ครอบคลุม 2 เคส:

1. **เกินเวลา 23:59 ของวันนั้น** → ปิดให้ทุกคนผ่าน `pg_cron` ที่รันทุกคืน
2. **ลงเวลาย้อนหลังของวันก่อน ๆ** → ปิด row เก่าค้างของผู้ใช้คนนั้นทันทีผ่าน DB trigger

### ติดตั้ง

รัน `sql/auto_checkout.sql` ใน Supabase → SQL Editor ทีละบล็อก
(ต้องเป็น Pro plan ขึ้นไปถึงจะมี `pg_cron` — ถ้าเป็น Free tier ให้ข้ามบล็อก 3-4
แล้วใช้ Edge Function ในข้อถัดไปแทน)

### Edge Function สำรอง / ใช้แทน pg_cron

ดู `supabase/functions/auto-checkout/README.md` — deploy แล้วตั้ง schedule
ผ่าน cron-job.org หรือ GitHub Actions ที่เรียก endpoint ทุกคืน 00:01 (เวลาไทย)

### สิ่งที่เปลี่ยน

- เพิ่ม `'auto-out'` ใน check constraint ของ `time_entries.status`
- TypeScript types (`src/types.ts`, `src/lib/attendanceApi.ts`, `src/lib/driveUpload.ts`)
- UI mapping ใน `LineLogs.tsx`: badge สีอำพัน + ป้าย "ออกงานอัตโนมัติ"
- Admin dropdown มีตัวเลือก `auto-out` / `auto-leave` ให้แก้มือได้
- `gas/DriveFileManager.gs` เพิ่มโฟลเดอร์ `auto-out`

### คอลัมน์ที่ถูกเขียนทับ

ถ้า row มี `check_in_time` → จะคำนวณ `total_hours` กับ `overtime_hours` ใหม่จาก
ระยะเวลาตั้งแต่ check-in จนถึง 23:59:59 ของวันนั้น และเพิ่ม note ต่อท้ายว่า
`[auto-out @ YYYY-MM-DD HH:MM]` หรือ `[auto-out by trigger @ ...]`
