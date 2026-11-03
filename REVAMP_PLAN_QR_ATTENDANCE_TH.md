# โครงการปรับปรุงเว็บ มหานิยม999ทีมพร้อม (Teamday)
## ลงเวลาด้วย QR Code + บันทึกคลิปประจำเดือน

> ร่างวันที่: 2026-11-02
> ใช้แทนแผนเดิม `DISCORD_VIDEO_WEB_PLAN_TH.md` (เลิกเชื่อม Discord แล้ว)

### ข้อตัดสินใจ (2026-11-02)

| เรื่อง | ตัดสินใจ |
| --- | --- |
| รูปแบบลงเวลา | **QR พิมพ์ติดผนัง + GPS** |
| เซลฟี่ | **ตัดออกทั้งหมด** (ลบออกจากโค้ด, SQL และ storage bucket แล้วในเฟส 1) |
| Supabase | **สร้างโปรเจกต์ใหม่** ด้วยอีเมลบริษัท ตั้งค่าจาก `sql/supabase_setup_step_by_step.sql` + `supabase/migrations/` |
| เกณฑ์มาสาย | **ใช้เกณฑ์เดิม**: เข้างาน**หลัง 12:00 น.** (เวลาไทย) = มาสาย ตามนาฬิกาเตือนเที่ยงในหน้าลงเวลา · ตอนสแกน QR ให้ตั้ง `late` อัตโนมัติตามเกณฑ์นี้ · OT นับเมื่อเกิน 11 ชม. · มี auto-checkout เหมือนเดิม |
| คลิปประจำเดือน | หน้า `/clips` หน้าเดียว เก็บแค่ **วันที่, ชื่อคลิป, ผู้ทำ** (รอ Google Sheet ตัวอย่าง) |
| หน้า Facebook / TikTok | เก็บไว้ตามเดิม แยกจากหน้าคลิป |
| ข้อมูล SQLite ของ Discord bot | **ไม่ย้าย** ทิ้งไปพร้อม bot |
| ชื่อเว็บ | **มหานิยม999ทีมพร้อม · Teamday** |
| ธีม | **Forest & Lime** ตามภาพตัวอย่าง: หน้าเว็บพื้นสว่าง, แถบเมนูและ hero สีเขียวป่า, ปุ่มแคปซูลสีเขียวมะนาวนีออนพร้อมวงกลมลูกศร, เงารูปเรืองเขียว · ฟอนต์ Prompt + IBM Plex Sans Thai · รูปหน้าแรกใช้ภาพวัดไปก่อน (`public/hero-temple.svg`) |
| สโลแกน | **บารมี สแกน แรง** (`src/lib/brand.ts`) |
| หน้าแรก | สไตล์เว็บ HR: ลงเวลาวันนี้อัปเดตสด, สรุปเข้างาน/ลา/ยังไม่ลงเวลา, อันดับคนขยัน, เว็บ/เพจของบริษัท |
| เทียบคู่แข่ง | **ตัดออก** · แสดงเฉพาะช่องทางที่แอคทีฟของบริษัท ไม่เกิน 5 ช่อง (Facebook / เว็บไซต์) |
| TikTok | **ตัดออกจากเว็บทั้งหมด** (2026-11-03): หน้าโพสต์, การ์ดอันดับ, ช่องทาง, ตาราง leaderboard |
| ปฏิทินไลฟ์ | หน้า `/calendar`: วันสำคัญทางศาสนา / วันไลฟ์ ไฮไลท์**สีเหลือง** มีเวลา สถานที่ หมายเหตุ · แอดมินแก้ไข ทุกคนดูได้ · แสดงในหน้าแรก, ตารางคลิป และปฏิทินลา |
| คลิปประจำเดือน | หน้า `/clips` แบบเดียวกับ Google Sheet: แถว = วันที่, คอลัมน์ = ผู้ทำ (4 คน) · ทุกช่องบันทึกเวลาลง/แก้ไขและผู้แก้ไขให้อัตโนมัติ · ผู้ทำแก้ได้เฉพาะคอลัมน์ตัวเอง · ส่งออก Excel |
| ระบบลา | **จองล่วงหน้า** (อย่างน้อย 1 วัน, รออนุมัติ) หรือ **ผู้จัดการบันทึกให้** (วันนี้/ย้อนหลัง, อนุมัติทันที) · วันที่ลาอนุมัติแล้วสแกนเข้างานไม่ได้ · ดูข้อ 3.6 |

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
- แดชบอร์ด, อันดับผลงาน, ตั้งค่า, รีเซ็ตรหัสผ่าน

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

> **ตัดสินใจแล้ว (2026-11-02): ใช้โหมด B (QR พิมพ์ติดผนัง + GPS)** โดยตั้ง `mode = 'static'` และ `require_gps = true` เป็นค่าเริ่มต้น
> ส่วน Kiosk ยังเก็บไว้ในโครงสร้างเผื่ออนาคต แต่ยังไม่ต้องทำหน้า `/kiosk` ในเฟส 4

ใช้ร่วมกันได้: เปิดทั้ง Kiosk QR และ GPS เพื่อความแน่นอนสูงสุด
~~เซลฟี่~~ ตัดออกแล้ว

### 3.2 Flow การสแกน

```text
พนักงาน (มือถือ, login แล้ว)
  │  เปิด /scan → อนุญาตกล้อง (+GPS ถ้าจุดนั้นบังคับ)
  ▼
อ่าน QR → ได้ token  ex: "m99:site_abc:1730541234:5f3a…"
  ▼
เรียก RPC  scan_attendance(token, lat, lng)
  ▼  ฝั่ง DB ตรวจสอบ
  1. ลายเซ็น token ถูกต้อง (HMAC ด้วย secret ของ site)
  2. ยังไม่หมดอายุ (โหมด A ≤ 60 วินาที)
  3. site เปิดใช้งาน และพนักงานได้รับสิทธิ์ที่ site นี้
  4. พิกัดอยู่ในรัศมี (ถ้าบังคับ)
  5. ห้ามสแกนซ้ำภายใน 2 นาที
  6. วันนี้ไม่มีวันลาที่อนุมัติแล้ว (ถ้ามี → ปฏิเสธ "วันนี้คุณลา ติดต่อผู้จัดการถ้ามาทำงาน")
  ▼
ตัดสินอัตโนมัติ:
  - วันนี้ยังไม่มี check-in → CHECK-IN (status = 'working' หรือ 'late' ถ้าหลัง 12:00 น.)
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
  mode text not null default 'static' check (mode in ('kiosk','static')),
  lat double precision,
  lng double precision,
  radius_m integer default 150,
  require_gps boolean not null default true,
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
| `scan_attendance(token, lat, lng)` | พนักงานที่ login | ตรวจสอบ บันทึก `attendance_scans` และ upsert `time_entries` แล้วคืนผล |
| `rotate_site_secret(site_id)` | super_admin | เปลี่ยน secret ทำให้ QR ที่พิมพ์ไว้เดิมใช้ไม่ได้ทันที |

### 3.6 ระบบจองวันลาที่ผูกกับการสแกน ✅ ทำแล้ว (migration `202611020001`)

| กรณี | ใครทำ | ทำผ่าน | ผล |
| --- | --- | --- | --- |
| ลาล่วงหน้า (พรุ่งนี้ขึ้นไป) | พนักงาน | หน้า `/attendance` แท็บลางาน → RPC `request_leave` | รออนุมัติ · เดือนละไม่เกิน 2 ครั้ง |
| ลาวันนี้ / ลาย้อนหลัง / ป่วยกะทันหัน | ผู้จัดการ (admin) | แท็บแอดมิน "บันทึกวันลาให้พนักงาน" → RPC `manager_record_leave` | อนุมัติทันที |
| อนุมัติ / ยกเลิก | ผู้จัดการ | การ์ด "ใบลารออนุมัติ" หน้าแรก | อนุมัติ → `time_entries` ได้แถว `leave` อัตโนมัติ · ยกเลิก → ลบแถวนั้น |
| วันที่ลาแล้วแต่มาทำงาน | ผู้จัดการ | ยกเลิกใบลา แล้วให้พนักงานสแกน | การสแกนจะถูกปฏิเสธจนกว่าจะยกเลิกใบลา (เฟส 3) |

กันข้อมูลขัดกัน: 1 คนมีใบลาที่รอ/อนุมัติได้วันละ 1 ใบ · ผู้จัดการบันทึกลาทับวันที่สแกนเข้างานแล้วไม่ได้
ทดสอบแล้ว: `supabase/tests/leave_booking.sql` (10 กรณี รันกับ Postgres 16)

### 3.5 หน้าเว็บใหม่และหน้าที่ปรับ

| Path | ใครเห็น | เนื้อหา |
| --- | --- | --- |
| `/scan` | พนักงานทุกคนที่ login | ปุ่มใหญ่ "สแกนลงเวลา" สถานะวันนี้ (เข้า/ออก/ชั่วโมง) และประวัติ 7 วันล่าสุด **ออกแบบสำหรับมือถือเป็นหลัก** |
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

> **อัปเดต:** เก็บแค่ วันที่, ชื่อคลิป, ผู้ทำ · ตารางจริงจะออกแบบตาม Google Sheet ที่จะส่งมา
> เนื่องจากย้ายไป Supabase โปรเจกต์ใหม่ migration workflow (`202609060002`) จึงถูกลบทิ้งไปเลยในเฟส 1 ไม่ต้องรัน SQL ด้านล่าง

ร่างเดิม (อ้างอิงเท่านั้น):

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
ภาพรวม (สาธารณะ)
  ├ หน้าแรก (HR)            /
  └ อันดับคนขยัน             /stats
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

จาก 17 tab เหลือ 8 หน้า

---

## 6. รายการเปลี่ยนแปลงไฟล์

| การทำ | ไฟล์ |
| --- | --- |
| ลบ | `Discord_Video prompt/`, `DISCORD_VIDEO_WEB_PLAN_TH.md`, `src/components/VideoBoard.tsx`, `VideoEditor.tsx`, `VideoManagement.tsx`, `src/lib/workflow.ts`, `workflowApi.ts`, `src/pages/VideoWorkflowPage.tsx`, `tests/workflow*.cjs`, `supabase/tests/video_workflow.sql` |
| แก้ | `src/routes.ts` (tab ใหม่), `src/App.tsx` (เมนู, AdminGate, ซ่อน layout ใน kiosk), `src/lib/authStore.ts` (role `kiosk`), `src/lib/attendanceApi.ts` (เพิ่ม `scanAttendance`), `src/components/LineLogs.tsx` → แตกเป็น `src/pages/attendance/*`, `package.json` (scripts test), `README.md`, `USER_MANUAL_TH.md` |
| เพิ่ม | `src/pages/ScanPage.tsx`, `src/pages/KioskPage.tsx`, `src/pages/SitesPage.tsx`, `src/pages/ClipsPage.tsx`, `src/lib/qrAttendanceApi.ts`, `src/lib/clipsApi.ts`, `supabase/migrations/2026110x_remove_video_workflow.sql`, `supabase/migrations/2026110x_qr_attendance.sql`, `supabase/tests/qr_attendance.sql`, `tests/qr-token.test.cjs` |

---

## 7. แผนงานเป็นเฟส

### เฟส 1: ตัดของเก่า ✅ เสร็จแล้ว
- [x] ลบ Discord bot, เอกสาร และ pipeline วิดีโอตามข้อ 6
- [x] ลบ migration และ test ของ workflow (โปรเจกต์ Supabase ใหม่จึงไม่ต้องทำ migration ลบคอลัมน์)
- [x] ตัดเซลฟี่: UI แนบรูป, การอัปโหลด, คอลัมน์ `check_*_photo_url`, bucket `attendance-photos`
- [x] ย้ายการอนุมัติใบลาไป `src/lib/leaveApi.ts` และฟังก์ชันวันที่ไป `src/lib/dates.ts`; การ์ด "งานวันนี้" เหลือแค่ใบลารออนุมัติ
- [x] ปรับเมนูและ routes ตามข้อ 5 · `/scan`, `/attendance/sites`, `/clips` เป็น placeholder · `/scan` เปิดให้พนักงานที่ login เห็น
- [x] `npm run lint`, `npm test`, `npm run build` ผ่าน

### เฟส 2: คลิปประจำเดือน ✅ เสร็จแล้ว (ยังไม่ได้นำเข้าข้อมูลจากชีท — เปิดลิงก์ชีทจาก session นี้ไม่ได้)
- [x] ตาราง `clips` + คอลัมน์ผู้ทำ `employees.clip_column` (migration `202611030001`)
- [x] `clipsApi.ts`, `ClipsPage.tsx`: เลือกเดือน, ตารางวันที่ × ผู้ทำ, จำนวนคลิปต่อคน, เวลาลง/แก้ไขทุกช่อง, ส่งออก Excel
- [ ] นำเข้าข้อมูลเก่าจาก Google Sheet (ต้องเปิดสิทธิ์ docs.google.com ให้ session หรือส่งไฟล์ .csv มา)

### เฟส 3: QR ลงเวลา ฝั่งฐานข้อมูล ✅ เสร็จแล้ว (migration `202611020002_qr_attendance.sql`)
- [x] ตาราง `attendance_sites`, `attendance_site_secrets` (อ่านได้เฉพาะในฟังก์ชัน), `attendance_scans` (log ทุกครั้งรวมที่ถูกปฏิเสธ) + RLS
- [x] QR = ลิงก์ `<เว็บ>/scan?t=TD1.<site>.<ลายเซ็น HMAC>` → สแกนด้วยกล้องมือถือปกติแล้วเปิดเว็บได้เลย
- [x] RPC `static_site_token`, `rotate_site_secret` (แอดมิน), `preview_scan` (ดูก่อนยืนยัน ไม่บันทึก), `scan_attendance` (ยืนยันแล้วบันทึก)
- [x] กติกา: ลายเซ็นถูก, จุดเปิดใช้, GPS ในรัศมี (+เผื่อคลาดเคลื่อน ≤50 ม.), ความแม่น GPS ≤300 ม., ไม่ใช่วันลา, ห้ามสแกนซ้ำใน 2 นาที, หลัง 12:00 = มาสาย
- [x] พนักงานอ่านแถวลงเวลาของตัวเองได้ (แต่แก้ไม่ได้)
- [x] SQL test `supabase/tests/qr_attendance.sql` ผ่าน (Postgres 16)
- โหมด Kiosk (QR หมุนเวียน) ยังไม่ทำ เพราะเลือกใช้ QR ติดผนัง

### เฟส 4: QR ลงเวลา ฝั่งหน้าเว็บ ✅ เสร็จแล้ว
- [x] หน้า `/scan`: เปิดกล้องสแกนในเว็บ (jsQR) หรือสแกนด้วยแอปกล้อง → ตรวจ GPS → **หน้ายืนยันเข้างาน/ออกงาน** → บันทึก + สั่น · ประวัติ 7 วันของตัวเอง
- [x] หน้า `/attendance/sites` (แอดมิน): เพิ่ม/แก้/ลบจุด, วางพิกัดจาก Google Maps หรือกด "ใช้ตำแหน่งปัจจุบัน", ปรับรัศมี, **พิมพ์ QR** / ดาวน์โหลด PNG, สร้าง QR ใหม่ (ยกเลิกแผ่นเดิม)
- [x] ปุ่มลงเวลาแบบเดิมในหน้า `/attendance` เปลี่ยนเป็นลิงก์ไปหน้าสแกน
- [ ] แตกไฟล์ `LineLogs` (ยังไม่ทำ)

### เฟส 5: ทดสอบหน้างานและเปิดใช้ (1 วัน)
- [ ] ทดสอบบน Android และ iPhone จริง (สิทธิ์กล้อง/GPS บน HTTPS)
- [ ] ทดลองใช้คู่กับระบบเดิม 1 สัปดาห์
- [ ] ปิดการกดลงเวลาแบบปุ่มเดิม และอัปเดต `USER_MANUAL_TH.md`

**รวมประมาณ 6–8 วันทำงาน**

---

### งานรอบ 2 (2026-11-02) ✅ เสร็จแล้ว
- [x] เปลี่ยนชื่อเว็บเป็น มหานิยม999ทีมพร้อม · Teamday (+ favicon)
- [x] ธีมเขียวนีออน + ภาพวัดหน้าแรก
- [x] หน้าแรกสไตล์ HR: ลงเวลาวันนี้อัปเดตสด (Realtime สำหรับแอดมิน + โหลดซ้ำทุก 60 วินาที), สรุปวันนี้, คนที่ยังไม่ลงเวลา, อันดับคนขยัน, ช่องทางบริษัท
- [x] ตัดหน้าเทียบคู่แข่ง + ตารางคู่แข่ง; ช่องทางบริษัทจำกัด 5 ช่อง เพิ่มประเภท "เว็บไซต์"
- [x] ระบบจองวันลา (ข้อ 3.6) + RPC `today_board` ให้พนักงานทั่วไปดูหน้าแรกได้โดยไม่เห็นข้อมูลส่วนตัว

## 7.1 ค่าใช้จ่าย (โหมด B)

| รายการ | ค่าใช้จ่าย |
| --- | --- |
| อ่านพิกัด GPS (`navigator.geolocation` ของเบราว์เซอร์) | ฟรี ไม่ต้องใช้ API key |
| สร้าง/อ่าน QR (`qrcode`, `@zxing/browser`) | ฟรี เป็น open source ทำงานในเบราว์เซอร์ |
| คำนวณระยะห่างจากจุดลงเวลา (สูตร Haversine ใน Postgres) | ฟรี |
| กำหนดพิกัดจุดลงเวลา | ฟรี: คัดลอกพิกัดจาก Google Maps มาวาง หรือใช้แผนที่ OpenStreetMap + Leaflet **ไม่ใช้** Google Maps API |
| Supabase | แพ็กเกจฟรีพอสำหรับทีมเล็ก แต่**โปรเจกต์ที่ไม่มีการใช้งานจะถูกพัก**; แพ็กเกจ Pro ราว $25/เดือน |
| Cloudflare Pages (โฮสต์เว็บ + HTTPS) | ฟรี |
| AI / LLM token | ไม่ใช้ |

---

## 8. คำถามที่ยังเหลือ

1. มีจุดลงเวลากี่จุด และพิกัดของแต่ละจุด
2. Google Sheet ข้อมูลคลิป: ตรวจรูปแบบตารางให้ตรงชีท และนำเข้าข้อมูลเก่า
3. รูปคนสำหรับหน้าแรก (แทน `public/hero-temple.svg` แล้วแก้ `HERO_IMAGE` ใน `src/pages/DashboardPage.tsx`)
