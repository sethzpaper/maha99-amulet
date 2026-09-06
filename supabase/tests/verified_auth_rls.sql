-- Run after the migration in a staging project's SQL Editor. Always rolls back.
begin;
select set_config('test.admin_id', gen_random_uuid()::text, true);
select set_config('test.user_id', gen_random_uuid()::text, true);
select set_config('test.employee_id', gen_random_uuid()::text, true);
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
values
  (current_setting('test.admin_id')::uuid, current_setting('test.admin_id') || '@example.invalid', '{"role":"admin"}', '{}'),
  (current_setting('test.user_id')::uuid, current_setting('test.user_id') || '@example.invalid', '{}', '{"role":"super_admin"}');
insert into public.employees (id, employee_code, nickname, auth_user_id)
values (current_setting('test.employee_id')::uuid, current_setting('test.employee_id'), 'RLS fixture', current_setting('test.admin_id')::uuid);

set local role anon;
do $$
begin
  begin
    perform id from public.employees limit 1;
    raise exception 'FAIL: anonymous employee read succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.videos ("fileName") values ('forbidden');
    raise exception 'FAIL: anonymous write succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('test.user_id'), true);
set local role authenticated;
do $$
begin
  if public.app_is_admin() then raise exception 'FAIL: user_metadata granted admin'; end if;
  if exists (select 1 from public.employees where id = current_setting('test.employee_id')::uuid) then
    raise exception 'FAIL: another employee is visible';
  end if;
  begin
    insert into public.videos ("fileName") values ('forbidden');
    raise exception 'FAIL: employee wrote video';
  exception when insufficient_privilege then null;
  end;
  if has_function_privilege(current_user, 'public.employee_login(text,text)', 'EXECUTE') then
    raise exception 'FAIL: legacy login is executable';
  end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('test.admin_id'), true);
set local role authenticated;
do $$
declare video_id uuid;
begin
  if not public.app_is_admin() then raise exception 'FAIL: admin denied'; end if;
  insert into public.videos ("fileName") values ('RLS test') returning id into video_id;
  update public.videos set "fileName" = 'RLS updated' where id = video_id;
  if not exists (select 1 from public.videos where id = video_id and "fileName" = 'RLS updated') then
    raise exception 'FAIL: admin read/update denied';
  end if;
  delete from public.videos where id = video_id;
end $$;
reset role;
rollback;
