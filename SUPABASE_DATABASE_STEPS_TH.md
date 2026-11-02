# Supabase Database Steps - มหานิยม999ทีมพร้อม (Teamday)

ไฟล์นี้เป็นลำดับทำฐานข้อมูลใน Supabase แบบทีละตาราง สำหรับหน้าตาใหม่ของ sidebar/dashboard/workload

SQL หลักอยู่ที่ `sql/supabase_setup_step_by_step.sql` และแบ่งเป็น STEP ให้คัดลอกไปรันใน Supabase SQL Editor ทีละส่วนได้

## ลำดับที่แนะนำ

1. เปิด Supabase project > SQL Editor
2. รัน `STEP 00` extensions ก่อนเสมอ
3. รัน `STEP 01-03` ระบบพนักงานและ badge
4. รัน `STEP 04` tracked accounts สำหรับ dashboard/social overview
5. รัน `STEP 05-07` ลงเวลา, ลางาน, workload views สำหรับการ์ดและกราฟ dashboard
6. (ข้าม `STEP 08` — ตัดระบบรูปลงเวลาออกแล้ว)
7. รัน `STEP 09-11` content/social/leaderboard
8. รัน `STEP 12-13` activity log และ password reset
9. รัน `STEP 14` RLS policies
10. รัน `STEP 15` seed super admin และบัญชี social ตัวอย่าง
11. รัน `STEP 16` verification queries
12. รัน `supabase/migrations/202609060001_verified_auth_rls.sql` (สิทธิ์ตาม Supabase Auth)
13. รัน `supabase/migrations/202611020001_leave_booking_today_board.sql` (จองวันลา + หน้าแรก)
14. รัน `supabase/migrations/202611020002_qr_attendance.sql` (จุดลงเวลา + สแกน QR)
15. ทดสอบ: `supabase/tests/verified_auth_rls.sql`, `leave_booking.sql`, `qr_attendance.sql` (rollback เองทุกครั้ง)
16. เข้าเว็บด้วยบัญชีแอดมิน → เมนู "จุดลงเวลา & QR" → เพิ่มจุด → พิมพ์ QR ไปติด

## ตารางที่หน้าใหม่ต้องใช้

- `employees`: ทำเนียบพนักงาน, login, role
- `time_entries`: ลงเวลา, total hours, OT, dashboard workload
- `leave_requests`: จองวันลาล่วงหน้า / ผู้จัดการบันทึกให้ (`source`), quota เดือนละ 2
- `tracked_accounts`: ช่องทางของบริษัท (Facebook / TikTok / เว็บไซต์) ไม่เกิน 5 ช่อง
- `videos`: คลังวิดีโอ/บอร์ดคอนเทนต์
- `social_posts`: Facebook/TikTok posts
- `leaderboard_views`, `leaderboard_likes_fb`, `leaderboard_likes_tt`, `leaderboard_hours`: leaderboard cards
- `activity_logs`: audit trail
- `password_reset_requests`: ลืมรหัสผ่าน

## Dashboard workload

หน้าแดชบอร์ดตอนนี้ดึงจาก `time_entries` และคำนวณใน frontend ได้แล้ว แต่ SQL เตรียม view ไว้ให้ด้วย:

- `workload_daily`: ชั่วโมงรวม, OT, จำนวนคน active รายวัน
- `workload_employee_monthly`: สรุปรายเดือนต่อพนักงาน

OT threshold ใช้ 11 ชั่วโมงทั้งใน frontend และ SQL setup ใหม่นี้

## จุดสำคัญ

- ตาราง `videos` ต้องใช้คอลัมน์ camelCase แบบ quote เช่น `"entryDate"`, `"fileName"`, `"productName"` เพราะ frontend ส่ง field ชื่อ camelCase
- ถ้ารัน migration เก่าใน `MIGRATION_NOTES.md` มาก่อน ตาราง `videos` อาจกลายเป็น lowercase เช่น `entrydate` ซึ่งจะไม่ตรงกับ frontend
- ไฟล์ `sql/auto_checkout.sql` ถูกปรับสูตร OT เป็น `- 11` แล้ว เพื่อให้ auto-out ตรงกับ dashboard/workload
- RLS ใน setup นี้เป็นแบบ permissive เพราะแอปปัจจุบันใช้ anon key จาก browser โดยตรง ควร tighten ก่อน production จริง

## หลังรันเสร็จให้เช็ก

```sql
select * from public.employee_login('SUPER001', '11221122');
select * from public.workload_daily order by work_date desc limit 14;
select * from public.workload_employee_monthly order by month desc, total_hours desc limit 20;
```

ถ้า query แรกคืน row แปลว่า RPC login และ password hash พร้อมใช้งาน