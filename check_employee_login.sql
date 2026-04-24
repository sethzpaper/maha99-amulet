-- ============================================================
-- สคริปต์ตรวจสอบและแก้ปัญหา "พนักงานใหม่ล็อกอินไม่ได้"
-- รันทีละบล็อกใน Supabase → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────
-- บล็อก 1: ดูพนักงานทั้งหมด + เช็คว่ามี password_hash หรือยัง
-- ─────────────────────────────────────────────
-- ถ้า password_hash เป็น NULL = ล็อกอินไม่ได้แน่นอน
-- ถ้า is_active = false = ล็อกอินไม่ได้แน่นอน
select
  employee_code,
  nickname,
  role,
  is_active,
  case when password_hash is null then 'ยังไม่มีรหัสผ่าน ❌'
       else 'มีรหัสผ่านแล้ว ✅' end as password_status,
  created_at
from public.employees
order by created_at desc;


-- ─────────────────────────────────────────────
-- บล็อก 2: เช็คว่า RPC functions ที่จำเป็นมีในระบบหรือยัง
-- ─────────────────────────────────────────────
-- ต้องเห็น 2 แถว: employee_login และ set_employee_password
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('employee_login', 'set_employee_password');


-- ─────────────────────────────────────────────
-- บล็อก 3: เช็คว่า extension pgcrypto ติดตั้งหรือยัง
-- ─────────────────────────────────────────────
-- ถ้าไม่มีให้รัน: create extension if not exists pgcrypto;
select extname from pg_extension where extname = 'pgcrypto';


-- ─────────────────────────────────────────────
-- บล็อก 4: ถ้า set_employee_password ไม่มี → สร้างใหม่
-- ─────────────────────────────────────────────
-- Supabase เก็บ pgcrypto ไว้ schema "extensions" (ไม่ใช่ public)
-- ดังนั้นต้องใส่ extensions ใน search_path ด้วย
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_employee_password(p_code text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.employees
  set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where employee_code = p_code;

  if not found then
    raise exception 'employee not found for code %', p_code;
  end if;
end;
$$;

grant execute on function public.set_employee_password(text, text) to anon, authenticated;


-- ─────────────────────────────────────────────
-- บล็อก 5: ถ้า employee_login ไม่มี → สร้างใหม่
-- ─────────────────────────────────────────────
create or replace function public.employee_login(p_code text, p_password text)
returns table (
  id uuid,
  employee_code text,
  nickname text,
  full_name text,
  avatar_url text,
  email text,
  role text,
  is_active boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
    select e.id, e.employee_code, e.nickname, e.full_name, e.avatar_url,
           e.email, e.role, e.is_active
    from public.employees e
    where e.employee_code = p_code
      and e.is_active = true
      and e.password_hash is not null
      and e.password_hash = extensions.crypt(p_password, e.password_hash);
end;
$$;

grant execute on function public.employee_login(text, text) to anon, authenticated;


-- ─────────────────────────────────────────────
-- บล็อก 6: ตั้งรหัสผ่านใหม่ให้พนักงานคนที่ล็อกอินไม่ได้
-- ─────────────────────────────────────────────
-- เปลี่ยน 'EMP002' เป็นรหัสพนักงานจริง และ 'รหัสผ่านใหม่' เป็น password ที่ต้องการ
select public.set_employee_password('EMP002', 'รหัสผ่านใหม่');

-- หรือทำหลายคนพร้อมกัน:
-- select public.set_employee_password('EMP002', 'pass002');
-- select public.set_employee_password('EMP003', 'pass003');
-- select public.set_employee_password('EMP004', 'pass004');


-- ─────────────────────────────────────────────
-- บล็อก 7: ทดสอบล็อกอิน (ใส่รหัสจริง)
-- ─────────────────────────────────────────────
-- ถ้าได้แถวกลับมา = ล็อกอินผ่าน
-- ถ้าได้ผลว่าง = รหัสผ่านผิด หรือ is_active = false
select * from public.employee_login('EMP002', 'รหัสผ่านใหม่');


-- ─────────────────────────────────────────────
-- บล็อก 8 (option): แก้พนักงานเก่าที่ is_active = false
-- ─────────────────────────────────────────────
-- update public.employees set is_active = true where employee_code = 'EMP002';
