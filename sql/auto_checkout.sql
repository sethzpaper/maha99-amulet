-- ============================================================
-- Auto-Checkout Migration
-- ──────────────────────
-- ทำให้สถานะ 'working' ที่ค้างจากวันก่อน ถูกเปลี่ยนเป็น 'auto-out'
-- โดยอัตโนมัติ เมื่อพ้นวันไปแล้ว (เกิน 23:59:59 ของ work_date)
--
-- ครอบคลุม 2 เคส:
--   (1) วันนี้พ้น 23:59 → แถวของวันนี้ที่ยังเป็น working ถูกปิด
--       (รันโดย pg_cron ทุกคืนเวลา 00:01)
--   (2) ลงเวลาย้อนหลัง / มี row เก่าค้าง → ถูกปิดทันทีเมื่อมี
--       insert/update ใหม่ (รันโดย trigger)
--
-- รันทีละบล็อกใน Supabase → SQL Editor
-- ============================================================


-- ─────────────────────────────────────────────
-- บล็อก 1: เพิ่ม 'auto-out' เข้า check constraint ของ status
-- ─────────────────────────────────────────────
alter table public.time_entries
  drop constraint if exists time_entries_status_check;

alter table public.time_entries
  add constraint time_entries_status_check
  check (status in ('working','out','late','leave','auto-leave','auto-out'));


-- ─────────────────────────────────────────────
-- บล็อก 2: Function auto_close_stale_entries()
--   - หา row ที่ status='working' และ work_date < current_date
--   - set status='auto-out', check_out_time = end-of-day ของ work_date
--   - คำนวณ total_hours / overtime_hours ให้ด้วยถ้ามี check_in_time
-- ─────────────────────────────────────────────
create or replace function public.auto_close_stale_entries()
returns table (closed_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with updated as (
    update public.time_entries te
    set
      status         = 'auto-out',
      check_out_time = (te.work_date + interval '23 hours 59 minutes 59 seconds')::timestamptz,
      total_hours    = coalesce(
                         round(
                           (extract(epoch from
                             (te.work_date + interval '23 hours 59 minutes 59 seconds')::timestamptz
                             - te.check_in_time
                           ) / 3600.0)::numeric,
                           2
                         ),
                         te.total_hours
                       ),
      overtime_hours = coalesce(
                         greatest(
                           0::numeric,
                           round(
                             ((extract(epoch from
                               (te.work_date + interval '23 hours 59 minutes 59 seconds')::timestamptz
                               - te.check_in_time
                             ) / 3600.0) - 8)::numeric,
                             2
                           )
                         ),
                         te.overtime_hours
                       ),
      note           = coalesce(te.note, '') ||
                       case when te.note is null or te.note = '' then '' else ' | ' end ||
                       '[auto-out @ ' || to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI') || ']'
    where te.status = 'working'
      and te.work_date < current_date
    returning 1
  )
  select count(*)::int into v_count from updated;

  return query select v_count;
end;
$$;

grant execute on function public.auto_close_stale_entries() to authenticated, service_role;


-- ─────────────────────────────────────────────
-- บล็อก 3: เปิด extension pg_cron (Supabase Pro / Self-host)
-- ─────────────────────────────────────────────
-- หมายเหตุ: ถ้าเป็น Supabase Free tier อาจไม่มี pg_cron
--           ให้ใช้ Edge Function + external scheduler (Cron-job.org, GitHub Action) แทน
create extension if not exists pg_cron with schema extensions;


-- ─────────────────────────────────────────────
-- บล็อก 4: ตั้ง pg_cron job รันทุกวัน 00:01 (เวลาเซิร์ฟเวอร์ = UTC)
--   - 00:01 UTC = 07:01 ตามเวลาไทย (Asia/Bangkok)
--   - ถ้าอยากให้ปิด "ทันทีหลังเที่ยงคืนไทย" ให้ใช้ '1 17 * * *'
--     (17:01 UTC = 00:01 ของวันถัดไปตามเวลาไทย)
-- ─────────────────────────────────────────────
-- ลบ job เดิมก่อน (ป้องกัน duplicate)
select cron.unschedule('auto-close-stale-entries')
  where exists (select 1 from cron.job where jobname = 'auto-close-stale-entries');

-- รันทุกวัน 00:01 ตามเวลาไทย (= 17:01 UTC)
select cron.schedule(
  'auto-close-stale-entries',
  '1 17 * * *',
  $$ select public.auto_close_stale_entries(); $$
);


-- ─────────────────────────────────────────────
-- บล็อก 5: Trigger function — ปิด row เก่าค้างเมื่อมี insert/update ใหม่
--   ครอบคลุมเคส "ลงเวลาย้อนหลัง" หรือ "เปิดเว็บมาแล้วยังไม่มี cron วิ่ง"
-- ─────────────────────────────────────────────
create or replace function public.trg_auto_close_on_new_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ปิด row เก่าของผู้ใช้คนเดียวกัน ที่ยังค้างเป็น working จากวันก่อน
  update public.time_entries te
  set
    status         = 'auto-out',
    check_out_time = (te.work_date + interval '23 hours 59 minutes 59 seconds')::timestamptz,
    total_hours    = coalesce(
                       round(
                         (extract(epoch from
                           (te.work_date + interval '23 hours 59 minutes 59 seconds')::timestamptz
                           - te.check_in_time
                         ) / 3600.0)::numeric,
                         2
                       ),
                       te.total_hours
                     ),
    overtime_hours = coalesce(
                       greatest(
                         0::numeric,
                         round(
                           ((extract(epoch from
                             (te.work_date + interval '23 hours 59 minutes 59 seconds')::timestamptz
                             - te.check_in_time
                           ) / 3600.0) - 8)::numeric,
                           2
                         )
                       ),
                       te.overtime_hours
                     ),
    note           = coalesce(te.note, '') ||
                     case when te.note is null or te.note = '' then '' else ' | ' end ||
                     '[auto-out by trigger @ ' || to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI') || ']'
  where te.user_id   = NEW.user_id
    and te.status    = 'working'
    and te.work_date < NEW.work_date
    and te.id        <> NEW.id;

  return NEW;
end;
$$;

drop trigger if exists trg_auto_close_on_new_entry on public.time_entries;

create trigger trg_auto_close_on_new_entry
  after insert or update of work_date, status on public.time_entries
  for each row
  execute function public.trg_auto_close_on_new_entry();


-- ─────────────────────────────────────────────
-- บล็อก 6: รันด้วยมือครั้งแรก เพื่อปิด row ที่ค้างอยู่ตอนนี้
-- ─────────────────────────────────────────────
select * from public.auto_close_stale_entries();


-- ─────────────────────────────────────────────
-- บล็อก 7: ตรวจผลลัพธ์
-- ─────────────────────────────────────────────
-- ดู cron job ที่ตั้งไว้
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'auto-close-stale-entries';

-- ดู log การรัน 10 ครั้งล่าสุด
select runid, jobid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'auto-close-stale-entries')
order by start_time desc
limit 10;

-- ดูแถวที่ถูก auto-close แล้ว
select user_name, work_date, check_in_time, check_out_time, status, total_hours, note
from public.time_entries
where status = 'auto-out'
order by work_date desc
limit 20;
