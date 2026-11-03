-- Run after the setup SQL and all migrations. Everything rolls back.
-- Uses auth.uid(); in local tests auth.uid() reads current_setting('test.uid').
begin;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'boss@example.com', '{"role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'staff@example.com', '{}');
insert into public.employees (id, employee_code, nickname, role, is_active, auth_user_id) values
  ('10000000-0000-0000-0000-000000000001', 'T-BOSS', 'บอส', 'admin', true, '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-000000000002', 'T-STAFF', 'น้องทดสอบ', 'user', true, '00000000-0000-0000-0000-0000000000e1');

create temp table d as
select public.app_today() as today,
       (date_trunc('month', public.app_today() + 62) + interval '1 day')::date as f1;
grant select on d to authenticated;

set local role authenticated;

-- 1) Employee cannot book today or the past.
select set_config('test.uid', '00000000-0000-0000-0000-0000000000e1', true);
do $$ begin
  perform public.request_leave((select today from d), 'personal', 'วันนี้');
  raise exception 'FAIL: same-day request accepted';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;

-- 2) Employee books in advance -> pending, source employee.
do $$ declare r public.leave_requests; begin
  r := public.request_leave((select f1 from d), 'vacation', 'เที่ยว');
  assert r.status = 'pending' and r.source = 'employee', 'advance request should be pending/employee';
  perform public.request_leave((select f1 + 1 from d), 'personal', null);
end $$;

-- 3) Monthly quota (2) is enforced.
do $$ begin
  perform public.request_leave((select f1 + 2 from d), 'personal', null);
  raise exception 'FAIL: quota not enforced';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;

-- 4) Employee may read only own leave; cannot call the manager RPC.
do $$ begin
  assert (select count(*) from public.leave_requests) = 2, 'employee should see own 2 requests';
  perform public.manager_record_leave('10000000-0000-0000-0000-000000000002', (select today from d), 'sick', null);
  raise exception 'FAIL: employee used manager RPC';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;

-- 5) Today board works for an employee and exposes names only.
do $$ declare b jsonb; begin
  b := public.today_board();
  assert (b->'employees')::text like '%น้องทดสอบ%' and (b->'employees')::text like '%บอส%', 'board should list active employees';
  assert not (b::text like '%staff@example.com%'), 'board must not leak emails';
end $$;

-- 6) Admin approves the advance request -> time_entries gets a leave row.
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', true);
update public.leave_requests set status = 'approved', approved_at = now()
where leave_date = (select f1 from d);
do $$ begin
  assert (select status from public.time_entries
          where user_id = '10000000-0000-0000-0000-000000000002' and work_date = (select f1 from d)) = 'leave',
         'approved leave should create a leave time entry';
end $$;

-- 7) Manager records retroactive leave (yesterday) -> approved immediately + leave entry.
do $$ declare r public.leave_requests; begin
  r := public.manager_record_leave('10000000-0000-0000-0000-000000000002', (select today - 1 from d), 'sick', 'ป่วย');
  assert r.status = 'approved' and r.source = 'manager', 'manager record should be approved/manager';
  assert exists (select 1 from public.time_entries where user_id = '10000000-0000-0000-0000-000000000002'
                 and work_date = (select today - 1 from d) and status = 'leave'), 'backfill should write leave entry';
end $$;

-- 8) Manager cannot record leave on a day the person already scanned in.
insert into public.time_entries (user_id, user_name, work_date, check_in_time, status)
values ('10000000-0000-0000-0000-000000000002', 'น้องทดสอบ', (select today - 3 from d), now() - interval '3 days', 'working');
do $$ begin
  perform public.manager_record_leave('10000000-0000-0000-0000-000000000002', (select today - 3 from d), 'personal', null);
  raise exception 'FAIL: leave recorded over a scanned day';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;

-- 9) Cancelling approved leave removes the auto-created leave entry.
update public.leave_requests set status = 'cancelled' where leave_date = (select f1 from d);
do $$ begin
  assert not exists (select 1 from public.time_entries where user_id = '10000000-0000-0000-0000-000000000002'
                     and work_date = (select f1 from d)), 'cancelled leave should clear the leave entry';
end $$;

-- 10) A signed-in user with no employee record gets an empty board.
select set_config('test.uid', '00000000-0000-0000-0000-00000000dead', true);
do $$ begin
  assert jsonb_array_length(public.today_board()->'employees') = 0, 'unknown user should get empty board';
end $$;

select 'leave_booking tests passed' as result;
rollback;
