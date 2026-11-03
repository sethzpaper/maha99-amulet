-- Apply after 202611020002_qr_attendance.sql.
-- 1) Team calendar: religious days / live events, highlighted yellow in the web app.
-- 2) Monthly clip log laid out like the team's Google Sheet: dates down, editors across.
--    The sheet has no timestamps, so every cell records when (and by whom) it was added/edited.
begin;

-- ---------------------------------------------------------------- calendar
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  title text not null check (length(trim(title)) > 0),
  kind text not null default 'religious' check (kind in ('religious','live','other')),
  needs_live boolean not null default true,   -- team must go live on this day
  start_time time,
  location text,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calendar_events_date on public.calendar_events (event_date);

alter table public.calendar_events enable row level security;
revoke all on public.calendar_events from public, anon;
grant select, insert, update, delete on public.calendar_events to authenticated;
drop policy if exists calendar_read on public.calendar_events;
create policy calendar_read on public.calendar_events for select to authenticated using (true);
drop policy if exists calendar_admin on public.calendar_events;
create policy calendar_admin on public.calendar_events for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

-- ---------------------------------------------------------------- clips
-- Which employees appear as columns of the clip table, and in what order.
alter table public.employees
  add column if not exists clip_column integer;  -- null = not an editor column
create index if not exists employees_clip_column on public.employees (clip_column) where clip_column is not null;

create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  clip_date date not null,
  editor_id uuid not null references public.employees(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create index if not exists clips_month on public.clips (clip_date, editor_id);

-- Server-side timestamps: the browser cannot backdate or fake them.
create or replace function public.trg_clip_stamp()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := auth.uid();
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists trg_clip_stamp on public.clips;
create trigger trg_clip_stamp before insert or update on public.clips
for each row execute function public.trg_clip_stamp();

drop trigger if exists trg_calendar_stamp on public.calendar_events;
create or replace function public.trg_calendar_stamp()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;
create trigger trg_calendar_stamp before update on public.calendar_events
for each row execute function public.trg_calendar_stamp();

alter table public.clips enable row level security;
revoke all on public.clips from public, anon;
grant select, insert, update, delete on public.clips to authenticated;
drop policy if exists clips_read on public.clips;
create policy clips_read on public.clips for select to authenticated using (true);
drop policy if exists clips_admin on public.clips;
create policy clips_admin on public.clips for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
-- Editors manage the cells in their own column.
drop policy if exists clips_own on public.clips;
create policy clips_own on public.clips for all to authenticated
  using (editor_id = (select e.id from public.employees e where e.auth_user_id = auth.uid() and e.clip_column is not null limit 1))
  with check (editor_id = (select e.id from public.employees e where e.auth_user_id = auth.uid() and e.clip_column is not null limit 1));

-- Column headers for everyone (employees table itself is admin-only + own row).
create or replace function public.clip_editors()
returns table (id uuid, nickname text, clip_column integer)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.nickname, e.clip_column from public.employees e
  where e.clip_column is not null and e.is_active
    and ((public.app_current_employee()).id is not null or public.app_is_admin())
  order by e.clip_column, e.nickname
$$;
revoke all on function public.clip_editors() from public, anon;
grant execute on function public.clip_editors() to authenticated;

-- Readable names for "updated by" (anyone signed in; names only).
create or replace function public.clip_people()
returns table (auth_user_id uuid, nickname text)
language sql stable security definer set search_path = ''
as $$
  select e.auth_user_id, e.nickname from public.employees e
  where e.auth_user_id is not null
    and ((public.app_current_employee()).id is not null or public.app_is_admin())
$$;
revoke all on function public.clip_people() from public, anon;
grant execute on function public.clip_people() to authenticated;

commit;
