-- Run in staging after both migrations. Fixtures are rolled back.
begin;
select set_config('test.admin_id', gen_random_uuid()::text, true);
select set_config('test.employee_id', gen_random_uuid()::text, true);
select set_config('test.video_id', gen_random_uuid()::text, true);
insert into auth.users (id, email, raw_app_meta_data)
values (current_setting('test.admin_id')::uuid, current_setting('test.admin_id') || '@example.invalid', '{"role":"admin"}');
insert into public.employees (id, employee_code, nickname, auth_user_id)
values (current_setting('test.employee_id')::uuid, current_setting('test.employee_id'), 'Workflow test', current_setting('test.admin_id')::uuid);
select set_config('request.jwt.claim.sub', current_setting('test.admin_id'), true);
set local role authenticated;
insert into public.videos (id, "fileName") values (current_setting('test.video_id')::uuid, 'Workflow test');
do $$
declare task uuid := current_setting('test.video_id')::uuid; affected integer;
begin
  begin
    update public.videos set workflow_status = 'published' where id = task;
    raise exception 'FAIL: skipped approval';
  exception when raise_exception then
    if sqlerrm <> 'Invalid workflow transition' then raise; end if;
  end;
  begin
    update public.videos set workflow_status = 'production' where id = task;
    raise exception 'FAIL: missing assignee accepted';
  exception when raise_exception then
    if sqlerrm <> 'Assignee and due date are required' then raise; end if;
  end;
  update public.videos set workflow_status = 'production', assignee_id = current_setting('test.employee_id')::uuid, due_date = current_date where id = task;
  update public.videos set workflow_status = 'review' where id = task and workflow_version = 1;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: stale version accepted'; end if;
  update public.videos set workflow_status = 'review' where id = task;
  update public.videos set workflow_status = 'approved' where id = task;
  update public.videos set workflow_status = 'published' where id = task;
  if not exists (select 1 from public.videos where id = task and workflow_status = 'published' and workflow_version = 5) then
    raise exception 'FAIL: workflow did not complete';
  end if;
end $$;
reset role;
rollback;
