-- Apply after 202609060001_verified_auth_rls.sql.
begin;
alter table public.videos
  add column if not exists workflow_status text not null default 'idea',
  add column if not exists assignee_id uuid references public.employees(id) on delete set null,
  add column if not exists due_date date,
  add column if not exists brief text not null default '',
  add column if not exists workflow_version integer not null default 1;
alter table public.videos add constraint videos_workflow_status_check
  check (workflow_status in ('idea','production','review','approved','published'));
update public.videos set workflow_status = 'published'
where "isPostedFB" or "isPostedTT";
create index if not exists videos_workflow_due on public.videos (workflow_status, due_date);
create index if not exists videos_assignee on public.videos (assignee_id);

create or replace function public.enforce_video_workflow()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.workflow_status <> 'idea' then raise exception 'New tasks must start at idea'; end if;
    new.workflow_version := 1;
  else
    new.workflow_version := old.workflow_version + 1;
    if new.workflow_status is distinct from old.workflow_status then
      if not (
        (old.workflow_status = 'idea' and new.workflow_status = 'production') or
        (old.workflow_status = 'production' and new.workflow_status in ('idea','review')) or
        (old.workflow_status = 'review' and new.workflow_status in ('production','approved')) or
        (old.workflow_status = 'approved' and new.workflow_status in ('review','published')) or
        (old.workflow_status = 'published' and new.workflow_status = 'production')
      ) then raise exception 'Invalid workflow transition'; end if;
      if new.workflow_status <> 'idea' and (new.assignee_id is null or new.due_date is null) then
        raise exception 'Assignee and due date are required';
      end if;
    end if;
    if new.workflow_status <> 'idea'
       and (new.assignee_id is distinct from old.assignee_id or new.due_date is distinct from old.due_date)
       and (new.assignee_id is null or new.due_date is null) then
      raise exception 'Assignee and due date are required';
    end if;
  end if;
  return new;
end $$;
create trigger videos_workflow_guard before insert or update on public.videos
for each row execute function public.enforce_video_workflow();
-- Existing admin RLS policies on videos, employees and leave_requests remain in effect.
commit;
