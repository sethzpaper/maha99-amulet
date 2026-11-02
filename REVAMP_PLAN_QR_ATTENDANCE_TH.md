# โครงการปรับปรุงเว็บ มหานิยม 999 หน่วยหลังบ้าน
## ลงเวลาด้วย QR Code + บันทึกคลิปประจำเดือน

> ร่างวันที่: 2026-11-02
> ใช้แทนแผนเดิม `DISCORD_VIDEO_WEB_PLAN_TH.md` (เลิกเชื่อม Discord แล้ว)

---

## 1. เป้าหมาย

| เดิม | ใหม่ |
| --- | --- |
| ลงเวลาด้วยการกดปุ่มบนเว็บ ถ่ายเซลฟี่ และมี Discord bot (`/clockin`) | **สแกน QR Code ที่จุดลงเวลา** แนวเดียวกับแอป TimeMint |
| Pipeline วิดีโอ 9 ขั้น (ไอเดีย → ภาพ AI → สตอรี่บอร์ด → เรนเดอร์ → รีวิว → อนุมัติ → คลัง → ต้นทุน) | **เก็บรายการคลิปของแต่ละเดือน** อย่างเดียว |
| Discord bot + SQLite + Notion แยกจากเว็บ | **เว็บกับ Supabase อย่างเดียว** ข้อมูลอยู่ที่เดียว |

หลักการ: ข้อมูลแต่ละเรื่องเก็บไว้ที่เดียวและแสดงที่เดียว ตัดส่วนที่ทำซ้ำกันออก

---

## 2. ขอบเขต

### 2.1 ส่วนที่ตัดออก

| ส่วน | ไฟล์ / ตาราง |
| --- | --- |
| Discord bot (ลงเวลาและ video pipeline) | ลบทั้งโฟลเดอร์ `Discord_Video prompt/` (ในโฟลเดอร์มี `bot.py`, `attendance_db.py`, `video_pipeline_db.py`, `notion_client*.py`, `reporting.py` และไฟล์อื่น) |
| เอกสารแผน Discord | `DISCORD_VIDEO_WEB_PLAN_TH.md` (ลบ หรือย้ายไป `docs/archive/`) |
| เมนู pipeline วิดีโอ | tab `aiVideoHome`, `videoIdeas`, `imageGen`, `storyboard`, `videoRender`, `videoReview`, `approvedVideos`, `assetLibrary`, `costTracker` |
| Kanban workflow | `src/components/VideoBoard.tsx`, `VideoEditor.tsx`, `src/lib/workflow.ts`, `src/lib/workflowApi.ts`, `src/pages/VideoWorkflowPage.tsx` |
| DB workflow | คอลัมน์ `workflow_status`, `assignee_id`, `due_date`, `brief`, `workflow_version` และ trigger `videos_workflow_guard` (จาก migration `202609060002`) |
| Test ของ workflow | `tests/workflow*.cjs`, `supabase/tests/video_workflow.sql` |
| ข้อความในหน้า AdminGate ที่อ้างถึง Discord | `src/App.tsx` |

### 2.2 ส่วนที่เก็บไว้

- ระบบ login และสิทธิ์ (`authStore`, verified auth RLS, role `admin` / `super_admin`)
- ทำเนียบพนักงาน (`EmployeeList`, `EmployeeProfile`)
- ตาราง `time_entries`, `leave_requests`, การคำนวณ OT (เกิน 11 ชม.), auto-checkout
- แดชบอร์ด, เทียบคู่แข่ง, อันดับผลงาน, ตั้งค่า, รีเซ็ตรหัสผ่าน

### 2.3 ส่วนที่เพิ่มใหม่

- จุดลงเวลา (Sites) และ QR Code
- หน้า Kiosk สำหรับแท็บเล็ตที่ตั้งไว้หน้างาน
- หน้าสแกนบนมือถือพนักงาน
- หน้า "คลิปประจำเดือน"

---

## 3. ระบบลงเวลาด้วย QR Code

### 3.1 รูปแบบการใช้งาน (เลือกได้ต่อจุดลงเวลา)

| โหมด | วิธีทำงาน | ข้อดี | ข้อเสีย |
| --- | --- | --- | --- |
| **A. Kiosk QR (แนะนำ)** | แท็บเล็ตหน้างานเปิดหน้า `/kiosk` แสดง QR ที่**เปลี่ยนทุก 30 วินาที** พนักงานใช้มือถือตัวเองสแกน | ถ่ายรูป QR ส่งให้เพื่อนสแกนแทนไม่ได้ เพราะ QR หมดอายุเร็ว | ต้องมีแท็บเล็ตและเน็ตที่จุดนั้น |
| **B. QR พิมพ์ติดผนัง + GPS** | พิมพ์ QR ถาวรติดไว้ พนักงานสแกนแล้วระบบเช็คพิกัดว่าอยู่ในรัศมี (เช่น 150 ม.) | ไม่ต้องมีอุปกรณ์เพิ่ม | ถ้าไม่มี GPS ก็สแกนจากรูปที่ถ่ายไว้ได้ ต้องเปิด GPS บังคับ |

ใช้ร่วมกันได้: เปิดทั้ง Kiosk QR และ GPS เพื่อความแน่นอนสูงสุด
เซลฟี่ตอนลงเวลาที่มีอยู่แล้ว (`attendance-photos`) เก็บเป็นตัวเลือกเปิด/ปิดได้ต่อจุด

### 3.2 Flow การสแกน

```text
พนักงาน (มือถือ, login แล้ว)
  │  เปิด /scan → อนุญาตกล้อง (+GPS ถ้าจุดนั้นบังคับ)
  ▼
อ่าน QR → ได้ token  ex: "m99:site_abc:1730541234:5f3a…"
  ▼
เรียก RPC  scan_attendance(token, lat, lng, photo_path?)
  ▼  ฝั่ง DB ตรวจสอบ
  1. ลายเซ็น token ถูกต้อง (HMAC ด้วย secret ของ site)
  2. ยังไม่หมดอายุ (โหมด A ≤ 60 วินาที)
  3. site เปิดใช้งาน และพนักงานได้รับสิทธิ์ที่ site นี้
  4. พิกัดอยู่ในรัศมี (ถ้าบังคับ)
  5. ห้ามสแกนซ้ำภายใน 2 นาที
  ▼
ตัดสินอัตโนมัติ:
  - วันนี้ยังไม่มี check-in → CHECK-IN (ถ้าเลยเวลาเริ่มกะ → status = 'late')
  - มี check-in แล้วแต่ยังไม่ check-out → CHECK-OUT (trigger เดิมคำนวณชั่วโมงและ OT)
  - ครบทั้งสองแล้ว → ปฏิเสธ แล้วแจ้งให้ติดต่อแอดมิน
  ▼
หน้าจอมือถือขึ้น ✅ "เข้างาน 08:57 · สาขาหลัก" แล้วสั่น (vibrate)
หน้า Kiosk ขึ้นชื่อ + รูปโปรไฟล์คนที่เพิ่งสแกนประมาณ 3 วินาที (ผ่าน Supabase Realtime)
```

> สำคัญ: การตรวจ token และการตัดสินเข้า/ออก**ต้องทำใน Postgres function (`security definer`)** เท่านั้น
> ห้าม insert ลง `time_entries` จาก browser ตรงๆ ไม่อย่างนั้นแก้เวลาเองได้

### 3.3 การสร้าง QR แบบหมุนเวียน (โหมด A)

- แท็บเล็ต kiosk login ด้วยบัญชี role ใหม่ `kiosk` ซึ่งเห็นได้แค่หน้า `/kiosk`
- ทุก 30 วินาที หน้า kiosk เรียก `issue_kiosk_token(site_id)` → DB คืน `site_id:epoch:hmac`
- secret ของแต่ละ site อยู่ในตาราง `attendance_site_secrets` ที่ RLS ปิดทุก role ให้อ่านได้เฉพาะผ่าน function
- ใช้ `pgcrypto` (`hmac(text, secret, 'sha256')`) ซึ่ง Supabase มีให้อยู่แล้ว

### 3.4 โครงสร้างข้อมูล (migration ใหม่ `2026110x_qr_attendance.sql`)

```sql
-- จุดลงเวลา
create table public.attendance_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- 'สาขาหลัก', 'สตูดิโอ'
  mode text not null default 'kiosk' check (mode in ('kiosk','static')),
  lat double precision,
  lng double precision,
  radius_m integer default 150,
  require_gps boolean not null default false,
  require_selfie boolean not null default false,
  shift_start time default '09:00',   -- ใช้ตัดสิน 'late'
  grace_minutes integer default 10,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.attendance_site_secrets (   -- ไม่มี policy ให้ client อ่าน
  site_id uuid primary key references public.attendance_sites(id) on delete cascade,
  secret text not null default encode(gen_random_bytes(32), 'hex'),
  rotated_at timestamptz not null default now()
);

-- (ทางเลือก) จำกัดพนักงานต่อจุด; ไม่มีแถว = สแกนได้ทุกจุด
create table public.attendance_site_members (
  site_id uuid references public.attendance_sites(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  primary key (site_id, employee_id)
);

-- log ดิบทุกครั้งที่สแกน (รวมครั้งที่ถูกปฏิเสธ) ใช้ตรวจสอบย้อนหลัง
create table public.attendance_scans (
  id bigint generated always as identity primary key,
  employee_id uuid references public.employees(id),
  site_id uuid references public.attendance_sites(id),
  scanned_at timestamptz not null default now(),
  action text check (action in ('check_in','check_out','rejected')),
  reject_reason text,
  lat double precision,
  lng double precision,
  user_agent text
);

-- ต่อยอดตารางเดิม
alter table public.time_entries
  add column if not exists check_in_site_id uuid references public.attendance_sites(id),
  add column if not exists check_out_site_id uuid references public.attendance_sites(id),
  add column if not exists method text not null default 'manual'
    check (method in ('qr','manual','auto'));
```

RPC ที่ต้องมี:

| Function | ใครเรียก | หน้าที่ |
| --- | --- | --- |
| `issue_kiosk_token(site_id)` | role `kiosk` | คืน token อายุ 60 วินาที |
| `static_site_token(site_id)` | admin | คืน token ถาวรของโหมด B ไว้พิมพ์ (ไม่มี epoch) |
| `scan_attendance(token, lat, lng, photo_path)` | พนักงานที่ login | ตรวจสอบ บันทึก `attendance_scans` และ upsert `time_entries` แล้วคืนผล |
| `rotate_site_secret(site_id)` | super_admin | เปลี่ยน secret ทำให้ QR ที่พิมพ์ไว้เดิมใช้ไม่ได้ทันที |

### 3.5 หน้าเว็บใหม่และหน้าที่ปรับ

| Path | ใครเห็น | เนื้อหา |
| --- | --- | --- |
| `/scan` | พนักงานทุกคน | ปุ่มใหญ่ "สแกนลงเวลา" สถานะวันนี้ (เข้า/ออก/ชั่วโมง) และประวัติ 7 วันล่าสุด **ออกแบบสำหรับมือถือเป็นหลัก** |
| `/kiosk/:siteId` | role `kiosk` | เต็มจอ: QR ใหญ่, นาฬิกา, ชื่อสาขา, ชื่อคนที่เพิ่งสแกน · ไม่มีเมนู |
| `/attendance` (เดิม `LineLogs`) | admin | ตารางลงเวลารายวัน/รายเดือน แก้ไขเวลาด้วยมือ (method = manual) อนุมัติลา export รายงาน · **แตกไฟล์ 1,053 บรรทัดออกเป็น component ย่อย** |
| `/attendance/sites` | admin | จัดการจุดลงเวลา: แผนที่/พิกัด รัศมี โหมด พิมพ์ QR (โหมด B) และปุ่มเปิดหน้า kiosk |

ไลบรารีที่ต้องเพิ่ม (ล็อกเวอร์ชันตอนติดตั้งจริง):
- อ่าน QR: `@zxing/browser` หรือ `html5-qrcode` หรือ `BarcodeDetector` API ของเบราว์เซอร์ (ใช้ได้บน Android Chrome) แล้ว fallback ไปใช้ zxing
- สร้าง QR: `qrcode`

ข้อจำกัด: กล้องและ GPS ใช้ได้เฉพาะบน **HTTPS** (Cloudflare Pages มีให้อยู่แล้ว)

---

## 4. คลิปประจำเดือน (แทน pipeline วิดีโอ)

### 4.1 แนวคิด

เก็บแค่ "เดือนนี้มีคลิปอะไร ใครทำ ลงที่ไหน" ไม่มีสถานะขั้นตอน ไม่มีผู้รับผิดชอบหรือกำหนดส่ง

### 4.2 โครงสร้างข้อมูล

ใช้ตาราง `videos` เดิม ไม่ต้องสร้างใหม่ ลบคอลัมน์ workflow ออก แล้วเพิ่มคอลัมน์ลิงก์ที่จำเป็น:

```sql
drop trigger if exists videos_workflow_guard on public.videos;
drop function if exists public.enforce_video_workflow();
alter table public.videos
  drop constraint if exists videos_workflow_status_check,
  drop column if exists workflow_status,
  drop column if exists assignee_id,
  drop column if exists due_date,
  drop column if exists brief,
  drop column if exists workflow_version,
  add column if not exists "fbUrl" text,
  add column if not exists "ttUrl" text,
  add column if not exists note text;
```

ฟิลด์ที่แสดงในฟอร์มมีแค่: **วันที่, ชื่อคลิป/สินค้า, ผู้ทำ, ลิงก์ไฟล์ (Drive), ลิงก์ FB, ลิงก์ TikTok, หมายเหตุ**
ยอดวิว/ไลก์ (`fbViews`, `ttViews` …) ยังเก็บในตารางได้ แต่ซ่อนจากฟอร์มหลัก

### 4.3 หน้า `/clips`

```text
┌──────────────────────────────────────────────────────┐
│  คลิปประจำเดือน   [◀ ต.ค. 2026 ▶]   [+ เพิ่มคลิป] [CSV] │
├──────────────────────────────────────────────────────┤
│  รวม 42 คลิป · FB 38 · TikTok 40 · ผู้ทำ 5 คน           │
│  [ทั้งหมด] [ยังไม่ลง FB] [ยังไม่ลง TikTok]  🔍 ค้นหา       │
├────────┬──────────────────┬────────┬────┬────┬───────┤
│ วันที่   │ ชื่อคลิป            │ ผู้ทำ    │ FB │ TT │       │
│ 28 ต.ค. │ หลวงพ่อ… รุ่น…      │ เอ      │ 🔗 │ 🔗 │ ✏️ 🗑 │
└────────┴──────────────────┴────────┴────┴────┴───────┘
```

- ฟิลด์ "ลง FB / TikTok แล้ว" คำนวณจากว่ามีลิงก์หรือไม่ ไม่ต้องมี checkbox แยก ลดข้อมูลที่ขัดกันเอง
- Component เดียว: `src/pages/ClipsPage.tsx` แทน `VideoManagement` + `VideoBoard` + `VideoEditor`

### 4.4 ลดความซ้ำซ้อนกับหน้า Facebook / TikTok

ตอนนี้ข้อมูลคลิปกระจายอยู่ 3 ที่: `videos.isPostedFB/TT`, หน้า `FacebookPosts`, หน้า `TikTokPosts`
**ข้อเสนอ:** ให้หน้า `/clips` เป็นที่หลักที่เดียว ส่วนหน้า Facebook/TikTok เดิมเปลี่ยนเป็นตัวกรองในหน้า clips (`/clips?platform=fb`) หรือตัดออก **(รอยืนยัน ดูข้อ 8)**

---

## 5. โครงเมนูใหม่

```text
แนวโน้ม (สาธารณะ)
  ├ แดชบอร์ดองค์กร          /
  ├ เทียบคู่แข่ง              /comparison
  └ อันดับผลงาน              /stats
ลงเวลา
  ├ สแกนลงเวลา   ★ใหม่      /scan            (พนักงานทุกคน)
  ├ ตารางลงเวลา / OT         /attendance      (admin)
  └ จุดลงเวลา & QR ★ใหม่     /attendance/sites (admin)
คอนเทนต์
  └ คลิปประจำเดือน ★ใหม่      /clips           (admin)
พนักงาน
  └ ทำเนียบพนักงาน           /employees
จัดการระบบ
  └ ตั้งค่า                   /settings
(ซ่อน) Kiosk                 /kiosk/:siteId   (role kiosk, เต็มจอ)
```

จาก 17 tab เหลือ 9 หน้า

---

## 6. รายการเปลี่ยนแปลงไฟล์

| การทำ | ไฟล์ |
| --- | --- |
| ลบ | `Discord_Video prompt/`, `DISCORD_VIDEO_WEB_PLAN_TH.md`, `src/components/VideoBoard.tsx`, `VideoEditor.tsx`, `VideoManagement.tsx`, `src/lib/workflow.ts`, `workflowApi.ts`, `src/pages/VideoWorkflowPage.tsx`, `tests/workflow*.cjs`, `supabase/tests/video_workflow.sql` |
| แก้ | `src/routes.ts` (tab ใหม่), `src/App.tsx` (เมนู, AdminGate, ซ่อน layout ใน kiosk), `src/lib/authStore.ts` (role `kiosk`), `src/lib/attendanceApi.ts` (เพิ่ม `scanAttendance`), `src/components/LineLogs.tsx` → แตกเป็น `src/pages/attendance/*`, `package.json` (scripts test), `README.md`, `USER_MANUAL_TH.md` |
| เพิ่ม | `src/pages/ScanPage.tsx`, `src/pages/KioskPage.tsx`, `src/pages/SitesPage.tsx`, `src/pages/ClipsPage.tsx`, `src/lib/qrAttendanceApi.ts`, `src/lib/clipsApi.ts`, `supabase/migrations/2026110x_remove_video_workflow.sql`, `supabase/migrations/2026110x_qr_attendance.sql`, `supabase/tests/qr_attendance.sql`, `tests/qr-token.test.cjs` |

---

## 7. แผนงานเป็นเฟส

### เฟส 1: ตัดของเก่า (0.5–1 วัน)
- [ ] ลบ Discord bot, เอกสาร และ pipeline วิดีโอตามข้อ 6
- [ ] migration ลบคอลัมน์และ trigger workflow
- [ ] ปรับเมนูและ routes ให้เหลือตามข้อ 5 (หน้าใหม่ใส่ placeholder ไว้ก่อน)
- [ ] `npm run lint` และ `npm run build` ผ่าน

### เฟส 2: คลิปประจำเดือน (1 วัน)
- [ ] `clipsApi.ts` (list by month, create, update, delete)
- [ ] `ClipsPage.tsx` + ตัวเลือกเดือน + สรุปตัวเลข + export CSV
- [ ] ย้ายข้อมูลเดิม: แปลง `isPostedFB/TT` ให้สอดคล้องกับลิงก์

### เฟส 3: QR ลงเวลา ฝั่งฐานข้อมูล (1–2 วัน)
- [ ] migration ตารางตามข้อ 3.4 + RLS
- [ ] RPC `issue_kiosk_token`, `static_site_token`, `scan_attendance`, `rotate_site_secret`
- [ ] SQL test: token หมดอายุ, ลายเซ็นผิด, นอกรัศมี, สแกนซ้ำ, เข้า→ออก, late

### เฟส 4: QR ลงเวลา ฝั่งหน้าเว็บ (2–3 วัน)
- [ ] หน้า `/attendance/sites` (CRUD + พิมพ์ QR)
- [ ] หน้า `/kiosk/:siteId` (QR หมุนทุก 30 วิ + Realtime แสดงคนที่เพิ่งสแกน)
- [ ] หน้า `/scan` (กล้อง, GPS, เซลฟี่ถ้าบังคับ, ผลลัพธ์)
- [ ] ปรับหน้า `/attendance` ให้แสดงจุด/วิธีที่ลงเวลา และแตกไฟล์ `LineLogs`

### เฟส 5: ทดสอบหน้างานและเปิดใช้ (1 วัน)
- [ ] ทดสอบบน Android และ iPhone จริง (สิทธิ์กล้อง/GPS บน HTTPS)
- [ ] ทดลองใช้คู่กับระบบเดิม 1 สัปดาห์
- [ ] ปิดการกดลงเวลาแบบปุ่มเดิม และอัปเดต `USER_MANUAL_TH.md`

**รวมประมาณ 6–8 วันทำงาน**

---

## 8. คำถามที่ต้องตัดสินใจก่อนเริ่ม

1. มีกี่จุดลงเวลา และใช้ **Kiosk (แท็บเล็ต)** หรือ **QR พิมพ์ติดผนัง + GPS**?
2. ยังต้องการ **เซลฟี่** ตอนลงเวลาอยู่ไหม (ระบบเดิมมีอยู่แล้ว)?
3. เวลาเริ่มงาน/เกณฑ์มาสาย เท่ากันทุกคน หรือแยกตามกะ?
4. หน้า **Facebook / TikTok** เดิม: รวมเข้าหน้าคลิป หรือเก็บแยกไว้?
5. Supabase ที่เคยพักไว้ จะเปิดโปรเจกต์เดิมกลับมา หรือสร้างโปรเจกต์ใหม่?
6. ข้อมูลลงเวลาเก่าใน SQLite ของ Discord bot ต้องย้ายเข้า Supabase หรือทิ้งได้?
