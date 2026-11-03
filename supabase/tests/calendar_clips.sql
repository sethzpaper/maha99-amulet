-- Run after the setup SQL and all migrations. Everything rolls back.
begin;
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'boss@example.com', '{"role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'cut1@example.com', '{}'),
  ('00000000-0000-0000-0000-0000000000c2', 'cut2@example.com', '{}'),
  ('00000000-0000-0000-0000-0000000000e1', 'staff@example.com', '{}'),
  ('00000000-0000-0000-0000-0000000000e9', 'nobody@example.com', '{}');
insert into public.employees (id, employee_code, nickname, role, is_active, auth_user_id) values
  ('10000000-0000-0000-0000-0000000000a1', 'C-BOSS', 'บอส', 'admin', true, '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-0000000000c1', 'C-CUT1', 'ตัดหนึ่ง', 'user', true, '00000000-0000-0000-0000-0000000000c1'),
  ('10000000-0000-0000-0000-0000000000c2', 'C-CUT2', 'ตัดสอง', 'user', true, '00000000-0000-0000-0000-0000000000c2'),
  ('10000000-0000-0000-0000-0000000000e1', 'C-STAFF', 'ทั่วไป', 'user', true, '00000000-0000-0000-0000-0000000000e1');

set local role authenticated;

-- Calendar: admin writes, everyone signed in reads, staff cannot write.
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', true);
insert into public.calendar_events (event_date, title, kind, needs_live, start_time, location, note)
values ('2026-11-24', 'วันลอยกระทง', 'religious', true, '18:00', 'วัดตัวอย่าง', 'เตรียมไฟไลฟ์');
select set_config('test.uid', '00000000-0000-0000-0000-0000000000e1', true);
do $$ begin
  assert (select count(*) from public.calendar_events) = 1, 'staff can read calendar';
  insert into public.calendar_events (event_date, title) values ('2026-11-25', 'แอบเพิ่ม');
  raise exception 'FAIL: staff added an event';
exception when insufficient_privilege then null;
end $$;

-- Admin picks the editor columns (order 2,1 on purpose).
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', true);
update public.employees set clip_column = 2 where id = '10000000-0000-0000-0000-0000000000c1';
update public.employees set clip_column = 1 where id = '10000000-0000-0000-0000-0000000000c2';

select set_config('test.uid', '00000000-0000-0000-0000-0000000000e1', true);
do $$ begin
  assert (select string_agg(nickname, ',' order by clip_column) from public.clip_editors()) = 'ตัดสอง,ตัดหนึ่ง', 'editors ordered by column';
end $$;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000e9', true);
do $$ begin
  assert (select count(*) from public.clip_editors()) = 0, 'unlinked user sees no editors';
end $$;

-- Editor adds a clip in their own column; timestamps come from the server.
select set_config('test.uid', '00000000-0000-0000-0000-0000000000c1', true);
insert into public.clips (clip_date, editor_id, title, created_at, created_by)
values ('2026-11-03', '10000000-0000-0000-0000-0000000000c1', 'หลวงพ่อรุ่นแรก', '2020-01-01', '00000000-0000-0000-0000-0000000000a1');
do $$ declare c public.clips; begin
  select * into c from public.clips;
  assert c.created_at > now() - interval '1 minute', 'created_at cannot be backdated';
  assert c.created_by = '00000000-0000-0000-0000-0000000000c1', 'created_by is the real user';
  assert c.updated_by = '00000000-0000-0000-0000-0000000000c1', 'updated_by set on insert';
end $$;

-- Editor cannot write into another editor's column; plain staff cannot write at all.
do $$ begin
  insert into public.clips (clip_date, editor_id, title) values ('2026-11-03', '10000000-0000-0000-0000-0000000000c2', 'แอบใส่ช่องคนอื่น');
  raise exception 'FAIL: wrote into another column';
exception when insufficient_privilege then null;
end $$;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000e1', true);
do $$ begin
  assert (select count(*) from public.clips) = 1, 'staff can read clips';
  insert into public.clips (clip_date, editor_id, title) values ('2026-11-03', '10000000-0000-0000-0000-0000000000c1', 'ไม่ใช่ผู้ทำ');
  raise exception 'FAIL: non-editor wrote a clip';
exception when insufficient_privilege then null;
end $$;

-- Editing keeps created_at/created_by and refreshes updated_at/updated_by.
reset role;
alter table public.clips disable trigger trg_clip_stamp;
update public.clips set created_at = created_at - interval '2 hours', updated_at = updated_at - interval '2 hours';
alter table public.clips enable trigger trg_clip_stamp;
create temp table before_edit as select created_at, updated_at from public.clips;
grant select on before_edit to authenticated;
set local role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', true);
update public.clips set title = 'หลวงพ่อรุ่นแรก (แก้ชื่อ)', created_at = now(), created_by = null;
do $$ declare c public.clips; b record; begin
  select * into c from public.clips;
  select * into b from before_edit;
  assert c.created_at = b.created_at, 'created_at preserved on edit';
  assert c.created_by = '00000000-0000-0000-0000-0000000000c1', 'created_by preserved on edit';
  assert c.updated_at > b.updated_at, 'updated_at refreshed';
  assert c.updated_by = '00000000-0000-0000-0000-0000000000a1', 'admin recorded as editor';
end $$;

-- Removed editor column: that person can no longer edit.
update public.employees set clip_column = null where id = '10000000-0000-0000-0000-0000000000c1';
select set_config('test.uid', '00000000-0000-0000-0000-0000000000c1', true);
do $$ begin
  update public.clips set title = 'หลังถูกเอาออก';
  assert not found, 'former editor cannot edit';
end $$;

select 'calendar_clips tests passed' as result;
rollback;
