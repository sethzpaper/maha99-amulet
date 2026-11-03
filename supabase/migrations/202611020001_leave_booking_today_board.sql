-- Apply after 202609060001_verified_auth_rls.sql.
-- Leave booking tied to QR attendance:
--   * employees book leave IN ADVANCE (tomorrow or later) -> pending, admin approves
--   * managers (admin/super_admin) record leave for any date, incl. retroactive -> approved immediately
--   * approved leave writes a 'leave' row into time_entries (if the person has not scanned in)
--   * the QR scan RPC (phase 3) must reject check-in on a day with approved leave
-- Also: a read-only "today board" RPC for the home page that every logged-in employee may call.
begin;

alter table public.leave_requests
  add column if not exists source text not null default 'employee',
  add column if not exists recorded_by uuid;
do $$ begin
  alter table public.leave_requests
    add constraint leave_requests_source_check check (source in ('employee','manager'));
exception when duplicate_object then null; end $$;

-- One active (pending/approved) leave per person per day.
create unique index if not exists leave_requests_one_active_per_day
  on public.leave_requests (user_id, leave_date) where status in ('pending','approved');

create or replace function public.app_today()
returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'Asia/Bangkok')::date $$;

create or replace function public.app_current_employee()
returns public.employees language sql stable security definer set search_path = ''
as $$ select e.* from public.employees e where e.auth_user_id = auth.uid() and e.is_active limit 1 $$;
revoke all on function public.app_current_employee() from public, anon;

-- Employee: book leave in advance (at least tomorrow, Bangkok time). Max 2 per month (existing rule).
create or replace function public.request_leave(p_date date, p_type text default 'personal', p_reason text default null)
returns public.leave_requests language plpgsql security definer set search_path = ''
as $$
declare
  me public.employees;
  used integer;
  row public.leave_requests;
begin
  me := public.app_current_employee();
  if me.id is null then raise exception 'ไม่พบข้อมูลพนักงานของบัญชีนี้'; end if;
  if p_date <= public.app_today() then
    raise exception 'ต้องลาล่วงหน้าอย่างน้อย 1 วัน ถ้าลาวันนี้หรือย้อนหลัง ให้ผู้จัดการบันทึกให้';
  end if;
  select count(*) into used from public.leave_requests
  where user_id = me.id::text and status in ('pending','approved')
    and date_trunc('month', leave_date) = date_trunc('month', p_date);
  if used >= 2 then raise exception 'โควตาลาเดือนนี้ครบ 2 ครั้งแล้ว'; end if;
  insert into public.leave_requests (user_id, user_name, user_email, leave_date, leave_type, reason, status, source, recorded_by)
  values (me.id::text, me.nickname, me.email, p_date, coalesce(p_type, 'personal'), p_reason, 'pending', 'employee', auth.uid())
  returning * into row;
  return row;
end $$;
revoke all on function public.request_leave(date, text, text) from public, anon;
grant execute on function public.request_leave(date, text, text) to authenticated;

-- Manager: record leave for any date (incl. retroactive). Approved immediately.
create or replace function public.manager_record_leave(
  p_employee_id uuid, p_date date, p_type text default 'personal', p_reason text default null)
returns public.leave_requests language plpgsql security definer set search_path = ''
as $$
declare
  emp public.employees;
  row public.leave_requests;
begin
  if not public.app_is_admin() then raise exception 'เฉพาะผู้จัดการ/แอดมินเท่านั้น'; end if;
  select * into emp from public.employees where id = p_employee_id;
  if emp.id is null then raise exception 'ไม่พบพนักงาน'; end if;
  if exists (select 1 from public.time_entries
             where user_id = emp.id::text and work_date = p_date and check_in_time is not null) then
    raise exception 'วันนั้นพนักงานสแกนเข้างานแล้ว แก้ไขรายการลงเวลาแทน';
  end if;
  if exists (select 1 from public.leave_requests
             where user_id = emp.id::text and leave_date = p_date and status = 'approved') then
    raise exception 'วันนั้นมีวันลาที่อนุมัติแล้ว';
  end if;
  -- Replace any pending request for that day with the manager's record.
  update public.leave_requests set status = 'cancelled'
  where user_id = emp.id::text and leave_date = p_date and status = 'pending';
  insert into public.leave_requests (user_id, user_name, user_email, leave_date, leave_type, reason,
                                     status, approved_at, source, recorded_by)
  values (emp.id::text, emp.nickname, emp.email, p_date, coalesce(p_type, 'personal'), p_reason,
          'approved', now(), 'manager', auth.uid())
  returning * into row;
  return row;
end $$;
revoke all on function public.manager_record_leave(uuid, date, text, text) from public, anon;
grant execute on function public.manager_record_leave(uuid, date, text, text) to authenticated;

-- Keep time_entries in sync with approved / cancelled leave.
create or replace function public.sync_leave_to_time_entries()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'approved' then
    insert into public.time_entries (user_id, user_name, work_date, status, note)
    values (new.user_id, new.user_name, new.leave_date, 'leave', coalesce(new.reason, 'ลา'))
    on conflict (user_id, work_date) do update
      set status = 'leave', note = excluded.note
      where public.time_entries.check_in_time is null;
  elsif tg_op = 'UPDATE' and old.status = 'approved' and new.status in ('cancelled','rejected') then
    delete from public.time_entries
    where user_id = new.user_id and work_date = new.leave_date
      and status = 'leave' and check_in_time is null;
  end if;
  return new;
end $$;
drop trigger if exists trg_leave_sync on public.leave_requests;
create trigger trg_leave_sync after insert or update of status on public.leave_requests
for each row execute function public.sync_leave_to_time_entries();

-- Employees may read their own leave history.
drop policy if exists own_leaves on public.leave_requests;
create policy own_leaves on public.leave_requests for select to authenticated
using (user_id = (select e.id::text from public.employees e where e.auth_user_id = auth.uid() limit 1));

-- Home page board: today's scans + approved leave + active roster, names only (no notes/emails).
create or replace function public.today_board()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when public.app_current_employee() is null and not public.app_is_admin() then
    jsonb_build_object('entries', '[]'::jsonb, 'leaves', '[]'::jsonb, 'employees', '[]'::jsonb)
  else jsonb_build_object(
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'user_id', t.user_id, 'user_name', t.user_name, 'work_date', t.work_date,
        'check_in_time', t.check_in_time, 'check_out_time', t.check_out_time, 'status', t.status))
      from public.time_entries t where t.work_date = public.app_today()), '[]'::jsonb),
    'leaves', coalesce((select jsonb_agg(jsonb_build_object(
        'id', l.id, 'user_id', l.user_id, 'user_name', l.user_name, 'leave_date', l.leave_date,
        'leave_type', l.leave_type, 'status', l.status))
      from public.leave_requests l where l.leave_date = public.app_today() and l.status = 'approved'), '[]'::jsonb),
    'employees', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nickname', e.nickname, 'is_active', e.is_active))
      from public.employees e where e.is_active), '[]'::jsonb))
  end
$$;
revoke all on function public.today_board() from public, anon;
grant execute on function public.today_board() to authenticated;

-- Realtime updates for the home page (admins receive row events; employees fall back to polling).
do $$ begin
  alter publication supabase_realtime add table public.time_entries;
exception when duplicate_object or undefined_object then null; end $$;

-- Company channels: Facebook + website only (TikTok removed), no competitor flag.
delete from public.tracked_accounts where platform = 'tiktok';
alter table public.tracked_accounts drop constraint if exists tracked_accounts_platform_check;
alter table public.tracked_accounts add constraint tracked_accounts_platform_check
  check (platform in ('facebook','website'));
alter table public.tracked_accounts drop column if exists is_competitor;
drop table if exists public.competitor_facebook, public.competitor_tiktok, public.competitor_analysis;

commit;
