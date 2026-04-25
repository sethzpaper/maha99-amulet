-- ============================================================
-- Activity Logs (audit trail)
-- รันใน Supabase → SQL Editor
-- ============================================================

create table if not exists public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.employees(id) on delete set null,
  user_name   text not null,
  action      text not null,
  details     text,
  type        text not null default 'update'
              check (type in ('create','update','delete','system')),
  ref_table   text,
  ref_id      text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_activity_logs_created_at
  on public.activity_logs (created_at desc);

create index if not exists idx_activity_logs_user
  on public.activity_logs (user_id, created_at desc);

-- RLS: อ่านได้ (ทุก authenticated/anon ถ้าใช้ anon key) เขียนได้แค่ผ่าน RPC หรือ service role
alter table public.activity_logs enable row level security;

drop policy if exists "activity_logs read" on public.activity_logs;
create policy "activity_logs read"
  on public.activity_logs for select
  to anon, authenticated
  using (true);

drop policy if exists "activity_logs insert" on public.activity_logs;
create policy "activity_logs insert"
  on public.activity_logs for insert
  to anon, authenticated
  with check (true);
