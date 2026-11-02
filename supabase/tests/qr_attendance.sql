-- Run after the setup SQL and all migrations. Everything rolls back.
begin;
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'boss@example.com', '{"role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'staff@example.com', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'staff2@example.com', '{}'),
  ('00000000-0000-0000-0000-0000000000e9', 'nobody@example.com', '{}');
insert into public.employees (id, employee_code, nickname, role, is_active, auth_user_id) values
  ('10000000-0000-0000-0000-000000000001', 'Q-BOSS', 'บอส', 'admin', true, '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-000000000002', 'Q-STAFF', 'น้องสแกน', 'user', true, '00000000-0000-0000-0000-0000000000e1'),
  ('10000000-0000-0000-0000-000000000003', 'Q-LEAVE', 'น้องลา', 'user', true, '00000000-0000-0000-0000-0000000000e2');

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;
set local role authenticated;

-- Admin creates a site and gets its printed token.
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', true);
insert into public.attendance_sites (id, name, lat, lng, radius_m)
values ('20000000-0000-0000-0000-000000000001', 'สาขาหลัก', 13.7563, 100.5018, 100);
insert into ctx values ('token', public.static_site_token('20000000-0000-0000-0000-000000000001'));
do $$ begin
  assert (select v from ctx where k = 'token') ~ '^TD1\.20000000-0000-0000-0000-000000000001\.[0-9a-f]{32}$', 'token format';
end $$;

-- Employee cannot mint tokens or read secrets.
select set_config('test.uid', '00000000-0000-0000-0000-0000000000e1', true);
do $$ begin
  perform public.static_site_token('20000000-0000-0000-0000-000000000001');
  raise exception 'FAIL: employee minted a token';
exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if;
end $$;
do $$ begin
  perform 1 from public.attendance_site_secrets;
  raise exception 'FAIL: employee read secrets';
exception when insufficient_privilege then null;
end $$;

-- Validation failures.
do $$ declare t text := (select v from ctx where k = 'token'); r jsonb; begin
  r := public.preview_scan('hello', 13.7563, 100.5018, 10);
  assert not (r->>'ok')::boolean and r->>'reason' like '%ไม่ใช่ QR%', 'foreign QR rejected';
  r := public.preview_scan(left(t, -1) || case when right(t, 1) = '0' then '1' else '0' end, 13.7563, 100.5018, 10);
  assert not (r->>'ok')::boolean and r->>'reason' like '%ไม่ถูกต้อง%', 'tampered signature rejected';
  r := public.preview_scan(t, null, null, null);
  assert not (r->>'ok')::boolean and r->>'reason' like '%GPS%', 'GPS required';
  r := public.preview_scan(t, 13.7653, 100.5018, 10);
  assert not (r->>'ok')::boolean and r->>'reason' like '%นอกพื้นที่%', '1 km away rejected';
  r := public.preview_scan(t, 13.7563, 100.5018, 900);
  assert not (r->>'ok')::boolean and r->>'reason' like '%ไม่แม่น%', 'poor accuracy rejected';
end $$;

-- Preview inside the radius proposes check-in and writes nothing.
do $$ declare r jsonb; begin
  r := public.preview_scan((select v from ctx where k = 'token'), 13.7566, 100.5020, 15);
  assert (r->>'ok')::boolean and r->>'action' = 'check_in' and r->>'site_name' = 'สาขาหลัก', 'preview check_in';
  assert not exists (select 1 from public.time_entries where user_id = '10000000-0000-0000-0000-000000000002'), 'preview must not write';
end $$;

-- Confirm check-in.
do $$ declare r jsonb; e public.time_entries; begin
  r := public.scan_attendance((select v from ctx where k = 'token'), 13.7566, 100.5020, 15);
  assert (r->>'recorded')::boolean and r->>'action' = 'check_in', 'check_in recorded';
  select * into e from public.time_entries where user_id = '10000000-0000-0000-0000-000000000002';
  assert e.check_in_time is not null and e.method = 'qr' and e.check_in_site_id = '20000000-0000-0000-0000-000000000001', 'entry written';
  assert e.status = case when (now() at time zone 'Asia/Bangkok')::time >= '12:00' then 'late' else 'working' end, 'noon late rule';
  -- immediate repeat is blocked and logged
  r := public.scan_attendance((select v from ctx where k = 'token'), 13.7566, 100.5020, 15);
  assert not (r->>'ok')::boolean and r->>'reason' like '%2 นาที%', 'double scan blocked';
end $$;

-- Pretend 5 minutes passed, then check out.
reset role;
update public.attendance_scans set scanned_at = scanned_at - interval '5 minutes';
update public.time_entries set check_in_time = check_in_time - interval '9 hours';
set local role authenticated;
do $$ declare r jsonb; e public.time_entries; begin
  r := public.preview_scan((select v from ctx where k = 'token'), 13.7566, 100.5020, 15);
  assert r->>'action' = 'check_out', 'second scan proposes check_out';
  r := public.scan_attendance((select v from ctx where k = 'token'), 13.7566, 100.5020, 15);
  select * into e from public.time_entries where user_id = '10000000-0000-0000-0000-000000000002';
  assert e.check_out_time is not null and e.total_hours >= 8.9, 'check_out recorded with hours';
  assert (select count(*) from public.attendance_scans) = 3, 'own scans visible: in, rejected, out';
end $$;
reset role;
update public.attendance_scans set scanned_at = scanned_at - interval '5 minutes';
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.scan_attendance((select v from ctx where k = 'token'), 13.7566, 100.5020, 15);
  assert not (r->>'ok')::boolean and r->>'reason' like '%ครบแล้ว%', 'third scan rejected';
end $$;

-- Approved leave today blocks scanning.
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', true);
select public.manager_record_leave('10000000-0000-0000-0000-000000000003', public.app_today(), 'sick', null);
select set_config('test.uid', '00000000-0000-0000-0000-0000000000e2', true);
do $$ declare r jsonb; begin
  r := public.scan_attendance((select v from ctx where k = 'token'), 13.7566, 100.5020, 15);
  assert not (r->>'ok')::boolean and r->>'reason' like '%วันลา%', 'leave day blocked';
end $$;

-- Unlinked account is rejected.
select set_config('test.uid', '00000000-0000-0000-0000-0000000000e9', true);
do $$ begin
  assert not (public.preview_scan((select v from ctx where k = 'token'), 13.7566, 100.5020, 15)->>'ok')::boolean, 'unlinked rejected';
end $$;

-- Rotating the secret invalidates printed QR codes.
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', true);
select public.rotate_site_secret('20000000-0000-0000-0000-000000000001');
do $$ begin
  assert (public.preview_scan((select v from ctx where k = 'token'), 13.7566, 100.5020, 15)->>'reason') like '%ไม่ถูกต้อง%', 'old QR invalid after rotate';
end $$;

-- Employees cannot write sites or time entries directly.
select set_config('test.uid', '00000000-0000-0000-0000-0000000000e1', true);
do $$ begin
  insert into public.attendance_sites (name) values ('แอบสร้าง');
  raise exception 'FAIL: employee created a site';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  update public.time_entries set check_in_time = now() - interval '5 hours';
  assert not found, 'employee must not update time entries';
end $$;

select 'qr_attendance tests passed' as result;
rollback;
