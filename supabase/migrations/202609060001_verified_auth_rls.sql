-- Apply after sql/supabase_setup_step_by_step.sql. Never rerun its open policies.
begin;

create or replace function public.app_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and raw_app_meta_data->>'role' in ('admin', 'super_admin')
  );
$$;
revoke all on function public.app_is_admin() from public, anon;
grant execute on function public.app_is_admin() to authenticated;

alter table public.employees
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

-- Link only unambiguous email matches. Review unmatched employees before rollout.
update public.employees e set auth_user_id = u.id
from auth.users u
where lower(e.email) = lower(u.email) and e.auth_user_id is null
  and (select count(*) from public.employees x where lower(x.email) = lower(e.email)) = 1
  and not exists (select 1 from public.employees x where x.auth_user_id = u.id);

-- Replace permissive policies instead of adding policies alongside them.
do $$
declare t text; p record;
begin
  foreach t in array array[
    'employees', 'badges', 'employee_badges', 'tracked_accounts',
    'time_entries', 'leave_requests', 'videos', 'amulets', 'social_posts',
    'competitor_facebook', 'competitor_tiktok', 'competitor_analysis',
    'leaderboard_views', 'leaderboard_likes_fb', 'leaderboard_likes_tt',
    'leaderboard_hours', 'activity_logs', 'password_reset_requests'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy admin_access on public.%I for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin())', t);
  end loop;
end $$;

-- Employees can read only their own profile. Management remains admin-only.
create policy own_profile on public.employees for select to authenticated
using (auth_user_id = auth.uid());

-- Public trend pages may read only these aggregate/content datasets.
do $$
declare t text;
begin
  foreach t in array array[
    'amulets', 'social_posts', 'competitor_facebook', 'competitor_tiktok',
    'competitor_analysis', 'leaderboard_views', 'leaderboard_likes_fb',
    'leaderboard_likes_tt', 'leaderboard_hours'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('grant select on public.%I to anon', t);
    execute format('create policy public_trends on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- Security-definer legacy RPCs bypass RLS and cannot issue Auth sessions.
-- Revoke all browser execution, including grants inherited through PUBLIC.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'employee_login', 'set_employee_password', 'request_password_reset',
      'approve_password_reset', 'reject_password_reset'
    )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
  end loop;
end $$;

-- Views otherwise run with their owner's privileges on older configurations.
do $$
begin
  if to_regclass('public.leaderboard_hours_live') is not null then
    alter view public.leaderboard_hours_live set (security_invoker = true);
    revoke all on public.leaderboard_hours_live from public, anon;
    grant select on public.leaderboard_hours_live to authenticated;
  end if;
end $$;

commit;
