begin;

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.video_projects'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%stage%'
  limit 1;

  if constraint_name is not null then
    execute format(
      'alter table public.video_projects drop constraint %I',
      constraint_name
    );
  end if;
end
$$;

alter table public.video_projects
  add constraint video_projects_stage_check
  check (
    stage in (
      'idea',
      'image_gen',
      'storyboard',
      'render',
      'pending_review',
      'review',
      'edits',
      'approved'
    )
  );

commit;
