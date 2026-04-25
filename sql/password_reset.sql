-- ============================================================
-- Password Reset Request (admin approval flow)
--   - User กดปุ่ม "ลืมรหัสผ่าน?" จากหน้า login
--   - Admin/Super Admin เห็นในแท็บ "คำขอรีเซ็ตรหัสผ่าน"
--   - Admin กรอกรหัสใหม่ → กดอนุมัติ → password_hash ถูกอัปเดต
-- รันใน Supabase → SQL Editor
-- ============================================================

create extension if not exists pgcrypto with schema extensions;


-- ─────────────────────────────────────────────
-- บล็อก 1: ตาราง password_reset_requests
-- ─────────────────────────────────────────────
create table if not exists public.password_reset_requests (
  id              uuid primary key default gen_random_uuid(),
  employee_code   text not null,
  user_name       text,
  reason          text,
  status          text not null default 'pending'
                  check (status in ('pending','approved','rejected','cancelled')),
  approved_by     text,                          -- ชื่อ/code ของ admin ที่กดอนุมัติ
  approver_note   text,
  approved_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_prr_status_created
  on public.password_reset_requests (status, created_at desc);

create index if not exists idx_prr_code
  on public.password_reset_requests (employee_code);


-- ─────────────────────────────────────────────
-- บล็อก 2: RLS — ใครเห็นใครเขียนได้
-- ─────────────────────────────────────────────
alter table public.password_reset_requests enable row level security;

drop policy if exists "prr read all" on public.password_reset_requests;
create policy "prr read all"
  on public.password_reset_requests for select
  to anon, authenticated
  using (true);

drop policy if exists "prr insert" on public.password_reset_requests;
create policy "prr insert"
  on public.password_reset_requests for insert
  to anon, authenticated
  with check (true);


-- ─────────────────────────────────────────────
-- บล็อก 3: RPC request_password_reset(p_code, p_reason)
--   เรียกจากหน้า Login → สร้าง row pending
-- ─────────────────────────────────────────────
create or replace function public.request_password_reset(p_code text, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_name text;
begin
  -- ตรวจว่าพนักงานคนนี้มีจริง
  select nickname into v_name
  from public.employees
  where employee_code = p_code
    and is_active = true;

  if v_name is null then
    raise exception 'employee % not found or inactive', p_code;
  end if;

  -- ถ้ามี pending request เก่ารออยู่ ให้ return id เดิม
  select id into v_id
  from public.password_reset_requests
  where employee_code = p_code
    and status = 'pending'
  order by created_at desc
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.password_reset_requests (employee_code, user_name, reason)
  values (p_code, v_name, p_reason)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.request_password_reset(text, text) to anon, authenticated;


-- ─────────────────────────────────────────────
-- บล็อก 4: RPC approve_password_reset(p_request_id, p_new_password, p_approver, p_note)
--   - update password_hash ของพนักงาน
--   - mark request เป็น approved
-- ─────────────────────────────────────────────
create or replace function public.approve_password_reset(
  p_request_id  uuid,
  p_new_password text,
  p_approver    text,
  p_note        text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
begin
  if length(coalesce(p_new_password, '')) < 4 then
    raise exception 'new password must be at least 4 characters';
  end if;

  select employee_code into v_code
  from public.password_reset_requests
  where id = p_request_id and status = 'pending'
  for update;

  if v_code is null then
    raise exception 'pending request not found';
  end if;

  update public.employees
  set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where employee_code = v_code;

  if not found then
    raise exception 'employee % not found', v_code;
  end if;

  update public.password_reset_requests
  set status = 'approved',
      approved_by = p_approver,
      approver_note = p_note,
      approved_at = now()
  where id = p_request_id;
end;
$$;

grant execute on function public.approve_password_reset(uuid, text, text, text) to authenticated;


-- ─────────────────────────────────────────────
-- บล็อก 5: RPC reject_password_reset(p_request_id, p_approver, p_note)
-- ─────────────────────────────────────────────
create or replace function public.reject_password_reset(
  p_request_id  uuid,
  p_approver    text,
  p_note        text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.password_reset_requests
  set status = 'rejected',
      approved_by = p_approver,
      approver_note = p_note,
      approved_at = now()
  where id = p_request_id and status = 'pending';

  if not found then
    raise exception 'pending request not found';
  end if;
end;
$$;

grant execute on function public.reject_password_reset(uuid, text, text) to authenticated;


-- ─────────────────────────────────────────────
-- บล็อก 6: ตรวจผลลัพธ์
-- ─────────────────────────────────────────────
select * from public.password_reset_requests order by created_at desc limit 20;
