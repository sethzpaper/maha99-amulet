-- Apply after 202611020001_leave_booking_today_board.sql.
-- QR attendance, "static QR on the wall + GPS" mode:
--   * each attendance site has a printed QR: <origin>/scan?t=TD1.<site_id>.<signature>
--   * the employee scans with their own phone (logged in), the browser sends GPS,
--     preview_scan() shows "confirm check-in / check-out", scan_attendance() records it.
--   * all checks run here (security definer); browsers never write time_entries directly.
begin;

create table if not exists public.attendance_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision,
  lng double precision,
  radius_m integer not null default 150 check (radius_m between 20 and 2000),
  require_gps boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Signing secrets. RLS on with no policies: readable only by security-definer functions.
create table if not exists public.attendance_site_secrets (
  site_id uuid primary key references public.attendance_sites(id) on delete cascade,
  secret text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  rotated_at timestamptz not null default now()
);

-- Every scan attempt, including rejected ones, for auditing.
create table if not exists public.attendance_scans (
  id bigint generated always as identity primary key,
  employee_id uuid references public.employees(id) on delete set null,
  site_id uuid references public.attendance_sites(id) on delete set null,
  scanned_at timestamptz not null default now(),
  action text not null check (action in ('check_in','check_out','rejected')),
  reject_reason text,
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  distance_m double precision
);
create index if not exists attendance_scans_employee_time on public.attendance_scans (employee_id, scanned_at desc);

alter table public.time_entries
  add column if not exists check_in_site_id uuid references public.attendance_sites(id) on delete set null,
  add column if not exists check_out_site_id uuid references public.attendance_sites(id) on delete set null,
  add column if not exists method text not null default 'manual';
do $$ begin
  alter table public.time_entries add constraint time_entries_method_check check (method in ('qr','manual','auto'));
exception when duplicate_object then null; end $$;

-- RLS
alter table public.attendance_sites enable row level security;
alter table public.attendance_site_secrets enable row level security;
alter table public.attendance_scans enable row level security;
revoke all on public.attendance_site_secrets from public, anon, authenticated;
revoke all on public.attendance_sites, public.attendance_scans from public, anon;
grant select, insert, update, delete on public.attendance_sites to authenticated;
grant select on public.attendance_scans to authenticated;

drop policy if exists sites_admin on public.attendance_sites;
create policy sites_admin on public.attendance_sites for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
drop policy if exists sites_read on public.attendance_sites;
create policy sites_read on public.attendance_sites for select to authenticated using (true);
drop policy if exists scans_admin on public.attendance_scans;
create policy scans_admin on public.attendance_scans for select to authenticated using (public.app_is_admin());
drop policy if exists scans_own on public.attendance_scans;
create policy scans_own on public.attendance_scans for select to authenticated
  using (employee_id = (select e.id from public.employees e where e.auth_user_id = auth.uid() limit 1));

-- Employees may read (not write) their own attendance rows, e.g. on the scan page.
drop policy if exists own_entries on public.time_entries;
create policy own_entries on public.time_entries for select to authenticated
  using (user_id = (select e.id::text from public.employees e where e.auth_user_id = auth.uid() limit 1));

-- Every new site gets a secret automatically.
create or replace function public.trg_site_secret()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin
  insert into public.attendance_site_secrets (site_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists trg_site_secret on public.attendance_sites;
create trigger trg_site_secret after insert on public.attendance_sites
for each row execute function public.trg_site_secret();

create or replace function public.app_site_signature(p_site uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select left(encode(extensions.hmac(p_site::text, s.secret, 'sha256'), 'hex'), 32)
  from public.attendance_site_secrets s where s.site_id = p_site
$$;
revoke all on function public.app_site_signature(uuid) from public, anon, authenticated;

create or replace function public.app_distance_m(lat1 double precision, lng1 double precision,
                                                 lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = ''
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- Admin: the token printed on the site's QR code.
create or replace function public.static_site_token(p_site uuid)
returns text language plpgsql stable security definer set search_path = ''
as $$ begin
  if not public.app_is_admin() then raise exception 'เฉพาะแอดมินเท่านั้น'; end if;
  return 'TD1.' || p_site::text || '.' || public.app_site_signature(p_site);
end $$;
revoke all on function public.static_site_token(uuid) from public, anon;
grant execute on function public.static_site_token(uuid) to authenticated;

-- Admin: invalidate printed QR codes for a site (e.g. a photo of the QR leaked).
create or replace function public.rotate_site_secret(p_site uuid)
returns text language plpgsql security definer set search_path = ''
as $$ begin
  if not public.app_is_admin() then raise exception 'เฉพาะแอดมินเท่านั้น'; end if;
  update public.attendance_site_secrets
     set secret = encode(extensions.gen_random_bytes(32), 'hex'), rotated_at = now()
   where site_id = p_site;
  return public.static_site_token(p_site);
end $$;
revoke all on function public.rotate_site_secret(uuid) from public, anon;
grant execute on function public.rotate_site_secret(uuid) to authenticated;

-- Shared validation. Returns the decision without writing anything.
create or replace function public.app_evaluate_scan(
  p_token text, p_lat double precision, p_lng double precision, p_accuracy double precision)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  me public.employees;
  site public.attendance_sites;
  site_id uuid;
  entry public.time_entries;
  dist double precision;
  today date := public.app_today();
  local_now timestamp := now() at time zone 'Asia/Bangkok';
  result jsonb;
begin
  me := public.app_current_employee();
  if me.id is null then
    return jsonb_build_object('ok', false, 'reason', 'บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน ติดต่อแอดมิน');
  end if;
  result := jsonb_build_object('employee_id', me.id, 'employee_name', me.nickname, 'at', now());

  if p_token is null or split_part(p_token, '.', 1) <> 'TD1'
     or split_part(p_token, '.', 2) !~ '^[0-9a-f-]{36}$' then
    return result || jsonb_build_object('ok', false, 'reason', 'QR นี้ไม่ใช่ QR ลงเวลาของ Teamday');
  end if;
  site_id := split_part(p_token, '.', 2)::uuid;
  select * into site from public.attendance_sites where id = site_id;
  if site.id is null or public.app_site_signature(site_id) is distinct from split_part(p_token, '.', 3) then
    return result || jsonb_build_object('ok', false, 'reason', 'QR ไม่ถูกต้องหรือถูกยกเลิกแล้ว ขอ QR ใหม่จากแอดมิน');
  end if;
  result := result || jsonb_build_object('site_id', site.id, 'site_name', site.name);
  if not site.is_active then
    return result || jsonb_build_object('ok', false, 'reason', 'จุดลงเวลานี้ปิดใช้งานอยู่');
  end if;

  if site.require_gps then
    if site.lat is null or site.lng is null then
      return result || jsonb_build_object('ok', false, 'reason', 'จุดนี้ยังไม่ได้ตั้งพิกัด ติดต่อแอดมิน');
    end if;
    if p_lat is null or p_lng is null then
      return result || jsonb_build_object('ok', false, 'reason', 'ต้องเปิด GPS และอนุญาตตำแหน่งก่อนลงเวลา');
    end if;
    if coalesce(p_accuracy, 0) > 300 then
      return result || jsonb_build_object('ok', false, 'reason', 'สัญญาณ GPS ยังไม่แม่น ลองใหม่ใกล้หน้าต่างหรือที่โล่ง');
    end if;
    dist := public.app_distance_m(site.lat, site.lng, p_lat, p_lng);
    result := result || jsonb_build_object('distance_m', round(dist::numeric));
    -- Allow some GPS error (up to 50 m) on top of the site radius.
    if dist > site.radius_m + least(coalesce(p_accuracy, 0), 50) then
      return result || jsonb_build_object('ok', false,
        'reason', format('อยู่นอกพื้นที่ลงเวลา (ห่าง %s ม. ต้องไม่เกิน %s ม.)', round(dist::numeric), site.radius_m));
    end if;
  end if;

  if exists (select 1 from public.leave_requests
             where user_id = me.id::text and leave_date = today and status = 'approved') then
    return result || jsonb_build_object('ok', false, 'reason', 'วันนี้คุณมีวันลาที่อนุมัติแล้ว ถ้ามาทำงาน ให้ผู้จัดการยกเลิกใบลาก่อน');
  end if;

  if exists (select 1 from public.attendance_scans
             where employee_id = me.id and action <> 'rejected' and scanned_at > now() - interval '2 minutes') then
    return result || jsonb_build_object('ok', false, 'reason', 'เพิ่งลงเวลาไปเมื่อสักครู่ รอ 2 นาทีแล้วลองใหม่');
  end if;

  select * into entry from public.time_entries where user_id = me.id::text and work_date = today;
  if entry.id is null or entry.check_in_time is null then
    return result || jsonb_build_object('ok', true, 'action', 'check_in',
      'late', local_now::time >= time '12:00');
  elsif entry.check_out_time is null then
    return result || jsonb_build_object('ok', true, 'action', 'check_out', 'check_in_time', entry.check_in_time);
  end if;
  return result || jsonb_build_object('ok', false, 'reason', 'วันนี้ลงเวลาเข้าและออกครบแล้ว ถ้าต้องแก้ ติดต่อแอดมิน');
end $$;
revoke all on function public.app_evaluate_scan(text, double precision, double precision, double precision) from public, anon, authenticated;

-- Employee: what will happen if I confirm? (no writes)
create or replace function public.preview_scan(
  p_token text, p_lat double precision default null, p_lng double precision default null, p_accuracy double precision default null)
returns jsonb language sql stable security definer set search_path = ''
as $$ select public.app_evaluate_scan(p_token, p_lat, p_lng, p_accuracy) $$;
revoke all on function public.preview_scan(text, double precision, double precision, double precision) from public, anon;
grant execute on function public.preview_scan(text, double precision, double precision, double precision) to authenticated;

-- Employee: confirm. Re-validates, then records check-in or check-out.
create or replace function public.scan_attendance(
  p_token text, p_lat double precision default null, p_lng double precision default null, p_accuracy double precision default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  d jsonb;
  emp uuid;
  site uuid;
  today date := public.app_today();
begin
  -- Serialise scans per user so double taps cannot create two check-ins.
  perform pg_advisory_xact_lock(hashtextextended(coalesce(auth.uid()::text, ''), 0));
  d := public.app_evaluate_scan(p_token, p_lat, p_lng, p_accuracy);
  emp := nullif(d->>'employee_id', '')::uuid;
  site := nullif(d->>'site_id', '')::uuid;

  insert into public.attendance_scans (employee_id, site_id, action, reject_reason, lat, lng, accuracy_m, distance_m)
  values (emp, site, case when (d->>'ok')::boolean then d->>'action' else 'rejected' end,
          d->>'reason', p_lat, p_lng, p_accuracy, (d->>'distance_m')::double precision);
  if not (d->>'ok')::boolean then return d; end if;

  if d->>'action' = 'check_in' then
    insert into public.time_entries (user_id, user_name, work_date, check_in_time, status, method, check_in_site_id)
    values (emp::text, d->>'employee_name', today, now(),
            case when (d->>'late')::boolean then 'late' else 'working' end, 'qr', site)
    on conflict (user_id, work_date) do update
      set check_in_time = excluded.check_in_time, status = excluded.status,
          method = 'qr', check_in_site_id = excluded.check_in_site_id;
  else
    update public.time_entries
       set check_out_time = now(),
           status = case when status = 'late' then 'late' else 'out' end,
           check_out_site_id = site
     where user_id = emp::text and work_date = today;
  end if;
  return d || jsonb_build_object('recorded', true);
end $$;
revoke all on function public.scan_attendance(text, double precision, double precision, double precision) from public, anon;
grant execute on function public.scan_attendance(text, double precision, double precision, double precision) to authenticated;

commit;
