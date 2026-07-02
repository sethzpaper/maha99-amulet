-- ============================================================
-- Project Amulet Base - Supabase setup step by step
-- Run in Supabase SQL Editor one section at a time.
-- Safe for repeat runs: uses IF NOT EXISTS / DROP POLICY IF EXISTS.
-- Dashboard workload OT threshold: 11 hours.
-- ============================================================

-- ============================================================
-- STEP 00: Extensions
-- ============================================================
create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- STEP 01: employees
-- Used by: login, employee directory, attendance employee picker
-- ============================================================
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

create index if not exists idx_employees_active on public.employees (is_active, created_at desc);
create index if not exists idx_employees_role on public.employees (role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

-- ============================================================
-- STEP 02: employee auth RPCs
-- Used by: employee_login(), set_employee_password()
-- ============================================================
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
set search_path = public, extensions
as $$
begin
  return query
    select e.id, e.employee_code, e.nickname, e.full_name, e.avatar_url,
           e.email, e.role, e.is_active
    from public.employees e
    where e.employee_code = p_code
      and e.is_active = true
      and e.password_hash is not null
      and e.password_hash = extensions.crypt(p_password, e.password_hash);
end;
$$;

grant execute on function public.employee_login(text, text) to anon, authenticated;

create or replace function public.set_employee_password(p_code text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.employees
  set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where employee_code = p_code;

  if not found then
    raise exception 'employee not found for code %', p_code;
  end if;
end;
$$;

grant execute on function public.set_employee_password(text, text) to anon, authenticated;

-- ============================================================
-- STEP 03: badges + employee_badges
-- Used by: employee profile badge area
-- ============================================================
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text,
  color text,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_badges (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  note text,
  unique (employee_id, badge_id, awarded_at)
);

create index if not exists idx_employee_badges_employee on public.employee_badges (employee_id, awarded_at desc);

-- ============================================================
-- STEP 04: tracked_accounts
-- Used by: dashboard social cards, competitor/company account tracking
-- ============================================================
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

create index if not exists idx_tracked_accounts_platform on public.tracked_accounts (platform, is_competitor, is_active);

-- ============================================================
-- STEP 05: time_entries
-- Used by: attendance page, dashboard workload cards/charts
-- OT rule: overtime starts after 11 total hours.
-- ============================================================
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_name text not null,
  work_date date not null,
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_photo_url text,
  check_out_photo_url text,
  total_hours numeric(8,2),
  overtime_hours numeric(8,2),
  status text not null default 'working'
    check (status in ('working','out','late','leave','auto-leave','auto-out')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);

create index if not exists idx_time_entries_month on public.time_entries (work_date desc);
create index if not exists idx_time_entries_user_month on public.time_entries (user_id, work_date desc);
create index if not exists idx_time_entries_status on public.time_entries (status, work_date desc);

drop trigger if exists trg_time_entries_updated_at on public.time_entries;
create trigger trg_time_entries_updated_at
  before update on public.time_entries
  for each row execute function public.set_updated_at();

-- Keep manual/admin updates consistent when both check-in/out exist.
create or replace function public.set_time_entry_hours()
returns trigger
language plpgsql
as $$
declare
  v_total numeric;
begin
  if new.check_in_time is not null and new.check_out_time is not null then
    v_total := round((extract(epoch from (new.check_out_time - new.check_in_time)) / 3600.0)::numeric, 2);
    new.total_hours := greatest(0::numeric, v_total);
    new.overtime_hours := greatest(0::numeric, round((v_total - 11)::numeric, 2));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_time_entries_hours on public.time_entries;
create trigger trg_time_entries_hours
  before insert or update of check_in_time, check_out_time on public.time_entries
  for each row execute function public.set_time_entry_hours();

-- ============================================================
-- STEP 06: leave_requests
-- Used by: leave request tab and monthly leave quota
-- ============================================================
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

create index if not exists idx_leave_requests_user_date on public.leave_requests (user_id, leave_date desc);
create index if not exists idx_leave_requests_status on public.leave_requests (status, created_at desc);

-- ============================================================
-- STEP 07: attendance workload views for the new dashboard
-- App currently aggregates client-side, but these views prepare DB reporting.
-- ============================================================
create or replace view public.workload_daily as
select
  work_date,
  count(*) filter (where total_hours is not null) as entry_count,
  count(distinct user_id) as active_people,
  round(coalesce(sum(total_hours), 0)::numeric, 2) as total_hours,
  round(coalesce(sum(greatest(0::numeric, coalesce(total_hours, 0) - 11)), 0)::numeric, 2) as overtime_hours,
  count(*) filter (where coalesce(total_hours, 0) > 11) as overtime_days
from public.time_entries
group by work_date;

create or replace view public.workload_employee_monthly as
select
  date_trunc('month', work_date)::date as month,
  user_id,
  max(user_name) as user_name,
  count(*) filter (where total_hours is not null) as work_days,
  round(coalesce(sum(total_hours), 0)::numeric, 2) as total_hours,
  round(coalesce(sum(greatest(0::numeric, coalesce(total_hours, 0) - 11)), 0)::numeric, 2) as overtime_hours,
  count(*) filter (where coalesce(total_hours, 0) > 11) as overtime_days,
  count(*) filter (where status = 'late') as late_days,
  count(*) filter (where status in ('leave','auto-leave')) as leave_days
from public.time_entries
group by date_trunc('month', work_date)::date, user_id;

-- ============================================================
-- STEP 08: attendance-photos storage bucket
-- Used by: check-in/out photo uploads
-- ============================================================
insert into storage.buckets (id, name, public)
values ('attendance-photos', 'attendance-photos', true)
on conflict (id) do nothing;

drop policy if exists "attendance photos read" on storage.objects;
create policy "attendance photos read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'attendance-photos');

drop policy if exists "attendance photos upload" on storage.objects;
create policy "attendance photos upload"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'attendance-photos');

-- ============================================================
-- STEP 09: videos
-- Used by: video/content board. IMPORTANT: quoted camelCase columns.
-- ============================================================
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  "entryDate" date,
  "fileName" text,
  "productName" text,
  "productImage" text,
  "driveLink" text,
  creator text,
  "isPostedFB" boolean not null default false,
  "isPostedTT" boolean not null default false,
  "fbPostDate" text,
  "ttPostDate" text,
  "fbViews" integer not null default 0,
  "fbLikes" integer not null default 0,
  "ttViews" integer not null default 0,
  "ttLikes" integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_videos_entry_date on public.videos ("entryDate" desc);

drop trigger if exists trg_videos_updated_at on public.videos;
create trigger trg_videos_updated_at
  before update on public.videos
  for each row execute function public.set_updated_at();

-- ============================================================
-- STEP 10: social/content tables
-- Used by: Facebook/TikTok pages, dashboard, competitor page
-- ============================================================
create table if not exists public.amulets (
  id uuid primary key default gen_random_uuid(),
  name text,
  type text,
  popularity integer not null default 0,
  posts integer not null default 0,
  likes integer not null default 0,
  shares integer not null default 0,
  trend text check (trend in ('up','down','stable')),
  image text,
  created_at timestamptz not null default now()
);

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('facebook','tiktok')),
  content text,
  link text,
  engagement integer not null default 0,
  timestamp timestamptz default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_social_posts_platform_time on public.social_posts (platform, timestamp desc);

create table if not exists public.competitor_facebook (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'facebook' check (platform in ('facebook','tiktok')),
  content text,
  link text,
  engagement integer not null default 0,
  timestamp timestamptz default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.competitor_tiktok (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'tiktok' check (platform in ('facebook','tiktok')),
  content text,
  link text,
  engagement integer not null default 0,
  timestamp timestamptz default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.competitor_analysis (
  id uuid primary key default gen_random_uuid(),
  facebook jsonb,
  tiktok jsonb,
  timestamp timestamptz default now(),
  created_at timestamptz not null default now()
);

-- ============================================================
-- STEP 11: leaderboard tables
-- Used by: dashboard and admin stats cards
-- ============================================================
create table if not exists public.leaderboard_views (
  rank integer,
  creator text,
  name text,
  value numeric not null default 0
);

create table if not exists public.leaderboard_likes_fb (
  rank integer,
  creator text,
  name text,
  value numeric not null default 0
);

create table if not exists public.leaderboard_likes_tt (
  rank integer,
  creator text,
  name text,
  value numeric not null default 0
);

create table if not exists public.leaderboard_hours (
  rank integer,
  creator text,
  name text,
  value numeric not null default 0
);

-- Optional: refresh leaderboard_hours from attendance workload.
create or replace view public.leaderboard_hours_live as
select
  row_number() over (order by sum(total_hours) desc)::integer as rank,
  max(user_name) as creator,
  max(user_name) as name,
  round(sum(coalesce(total_hours, 0))::numeric, 2) as value
from public.time_entries
where total_hours is not null
group by user_id;

-- ============================================================
-- STEP 12: activity_logs
-- Used by: audit trail / system activity
-- ============================================================
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.employees(id) on delete set null,
  user_name text not null,
  action text not null,
  details text,
  type text not null default 'update' check (type in ('create','update','delete','system')),
  ref_table text,
  ref_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_created_at on public.activity_logs (created_at desc);
create index if not exists idx_activity_logs_user on public.activity_logs (user_id, created_at desc);

-- ============================================================
-- STEP 13: password_reset_requests + RPCs
-- Used by: forgot password / admin approval
-- ============================================================
create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null,
  user_name text,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  approved_by text,
  approver_note text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_prr_status_created on public.password_reset_requests (status, created_at desc);
create index if not exists idx_prr_code on public.password_reset_requests (employee_code);

create or replace function public.request_password_reset(p_code text, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
begin
  select nickname into v_name
  from public.employees
  where employee_code = p_code
    and is_active = true;

  if v_name is null then
    raise exception 'employee % not found or inactive', p_code;
  end if;

  select id into v_id
  from public.password_reset_requests
  where employee_code = p_code
    and status = 'pending'
  order by created_at desc
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.password_reset_requests (employee_code, user_name, reason)
  values (p_code, v_name, p_reason)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.request_password_reset(text, text) to anon, authenticated;

create or replace function public.approve_password_reset(
  p_request_id uuid,
  p_new_password text,
  p_approver text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
begin
  if length(coalesce(p_new_password, '')) < 4 then
    raise exception 'new password must be at least 4 characters';
  end if;

  select employee_code into v_code
  from public.password_reset_requests
  where id = p_request_id and status = 'pending'
  for update;

  if v_code is null then
    raise exception 'pending request not found';
  end if;

  update public.employees
  set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where employee_code = v_code;

  if not found then
    raise exception 'employee % not found', v_code;
  end if;

  update public.password_reset_requests
  set status = 'approved',
      approved_by = p_approver,
      approver_note = p_note,
      approved_at = now()
  where id = p_request_id;
end;
$$;

grant execute on function public.approve_password_reset(uuid, text, text, text) to authenticated, anon;

create or replace function public.reject_password_reset(
  p_request_id uuid,
  p_approver text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.password_reset_requests
  set status = 'rejected',
      approved_by = p_approver,
      approver_note = p_note,
      approved_at = now()
  where id = p_request_id and status = 'pending';

  if not found then
    raise exception 'pending request not found';
  end if;
end;
$$;

grant execute on function public.reject_password_reset(uuid, text, text) to authenticated, anon;

-- ============================================================
-- STEP 14: RLS policies for current browser-direct app
-- NOTE: Current app uses anon key directly, so these are permissive.
-- Tighten before production if you move to Supabase Auth/JWT roles.
-- ============================================================
alter table public.employees enable row level security;
alter table public.badges enable row level security;
alter table public.employee_badges enable row level security;
alter table public.tracked_accounts enable row level security;
alter table public.time_entries enable row level security;
alter table public.leave_requests enable row level security;
alter table public.videos enable row level security;
alter table public.amulets enable row level security;
alter table public.social_posts enable row level security;
alter table public.competitor_facebook enable row level security;
alter table public.competitor_tiktok enable row level security;
alter table public.competitor_analysis enable row level security;
alter table public.leaderboard_views enable row level security;
alter table public.leaderboard_likes_fb enable row level security;
alter table public.leaderboard_likes_tt enable row level security;
alter table public.leaderboard_hours enable row level security;
alter table public.activity_logs enable row level security;
alter table public.password_reset_requests enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'employees','badges','employee_badges','tracked_accounts','time_entries','leave_requests',
    'videos','amulets','social_posts','competitor_facebook','competitor_tiktok','competitor_analysis',
    'leaderboard_views','leaderboard_likes_fb','leaderboard_likes_tt','leaderboard_hours',
    'activity_logs','password_reset_requests'
  ] loop
    execute format('drop policy if exists "%s read" on public.%I', t, t);
    execute format('create policy "%s read" on public.%I for select to anon, authenticated using (true)', t, t);
    execute format('drop policy if exists "%s insert" on public.%I', t, t);
    execute format('create policy "%s insert" on public.%I for insert to anon, authenticated with check (true)', t, t);
    execute format('drop policy if exists "%s update" on public.%I', t, t);
    execute format('create policy "%s update" on public.%I for update to anon, authenticated using (true) with check (true)', t, t);
    execute format('drop policy if exists "%s delete" on public.%I', t, t);
    execute format('create policy "%s delete" on public.%I for delete to anon, authenticated using (true)', t, t);
  end loop;
end $$;

-- Keep password_hash away from direct anon SELECT when possible.
-- If the generic policy above is too open for your project, replace employees table reads with a safe view.

-- ============================================================
-- STEP 15: seed minimum super admin / sample accounts
-- Change codes/passwords before production.
-- ============================================================
insert into public.employees (employee_code, nickname, full_name, role, is_active, password_hash)
values ('SUPER001', 'Super Admin', 'System Super Admin', 'super_admin', true, extensions.crypt('11221122', extensions.gen_salt('bf', 10)))
on conflict (employee_code) do nothing;

insert into public.tracked_accounts (platform, account_name, account_url, account_handle, is_competitor, note)
values
  ('facebook', 'Mahaniyom999 Fanpage', 'https://facebook.com/mahaniyom999', '@mahaniyom999', false, 'Main Facebook page'),
  ('tiktok', 'Mahaniyom999 TikTok', 'https://www.tiktok.com/@mahaniyom999', '@mahaniyom999', false, 'Main TikTok channel'),
  ('facebook', 'Competitor Facebook Example', 'https://facebook.com/competitor-page', '@competitor', true, 'Competitor tracking'),
  ('tiktok', 'Competitor TikTok Example', 'https://www.tiktok.com/@competitor', '@competitor', true, 'Competitor tracking')
on conflict do nothing;

-- ============================================================
-- STEP 16: verification queries
-- ============================================================
select 'employees' as table_name, count(*) from public.employees
union all select 'time_entries', count(*) from public.time_entries
union all select 'leave_requests', count(*) from public.leave_requests
union all select 'tracked_accounts', count(*) from public.tracked_accounts
union all select 'videos', count(*) from public.videos
union all select 'social_posts', count(*) from public.social_posts;

select * from public.employee_login('SUPER001', '11221122');
select * from public.workload_daily order by work_date desc limit 14;
select * from public.workload_employee_monthly order by month desc, total_hours desc limit 20;