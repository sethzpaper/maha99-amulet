# Roadmap — maha99-amulet Dashboard

> อัปเดต: 2026-04-25  
> สถานะ: ✅ Done · ⚠️ Partial · ❌ Not started · 🔧 Needs library

---

## สรุปภาพรวม

| ฟีเจอร์ | สถานะ | ความยาก |
|--------|------|--------|
| Search / Filter / Date range | ⚠️ Partial | M |
| Export CSV / Excel / PDF | ❌ Not started | M |
| Activity log จริงจาก DB | ⚠️ Mock only | S |
| Edit tracked account | ⚠️ Partial (no UI) | S |
| Actionable dashboard | ❌ Not started | L |

---

## 1. Search / Filter / Date Range

### สถานะปัจจุบัน
| หน้า | ค้นหา | กรอง | วันที่ |
|------|------|------|------|
| EmployeeList | ✅ ค้นหาชื่อ/อีเมล | ❌ | ❌ |
| VideoManagement | ❌ | ❌ | ❌ |
| AmuletList | ❌ | ❌ | ❌ |
| LineLogs (ลางาน) | ❌ | ❌ | ⚠️ เลือกเดือนเดียว |
| Settings (tracked accounts) | ❌ | ❌ | ❌ |

### สิ่งที่ต้องทำ
- [ ] **VideoManagement** — search ชื่อไฟล์/ชื่อสินค้า + filter โดย creator + date range "วันที่บันทึก"
- [ ] **AmuletList** — search ชื่อพระ + filter ประเภท/trend
- [ ] **LineLogs** — date range picker แทน month-only selector + filter สถานะ (working/late/leave)
- [ ] **Settings tracked accounts** — search ชื่อ/platform + filter competitor flag
- [ ] **EmployeeList** — เพิ่ม filter แผนก/สถานะ (ถ้ามีในอนาคต)

### ไฟล์ที่ต้องแก้
- `src/components/VideoManagement.tsx`
- `src/components/AmuletList.tsx`
- `src/components/LineLogs.tsx`
- `src/components/Settings.tsx`

---

## 2. Export CSV / Excel / PDF

### สถานะปัจจุบัน
- ปุ่ม PDF / Excel / Print อยู่ใน `Settings.tsx:319-327` — **ไม่มี onClick handler ใดๆ**
- ปุ่ม Export รายงานเดือน อยู่ใน `LineLogs.tsx:902` — เรียก `exportMonthlyReport()` แต่ไม่ได้สร้างไฟล์จริง
- **ไม่มี library** สำหรับ export เลยใน `package.json`

### Library ที่ต้องติดตั้ง
```bash
npm install xlsx jspdf jspdf-autotable
```

### สิ่งที่ต้องทำ
- [ ] ติดตั้ง `xlsx` + `jspdf` + `jspdf-autotable`
- [ ] สร้าง `src/lib/exportUtils.ts` — util functions สำหรับ
  - `exportToCSV(rows, filename)` — ใช้ xlsx
  - `exportToExcel(rows, filename)` — ใช้ xlsx
  - `exportToPDF(rows, columns, filename)` — ใช้ jspdf-autotable
- [ ] **Settings.tsx:319-327** — ต่อ onClick handler 3 ปุ่ม (PDF / Excel / Print)
- [ ] **LineLogs.tsx** — ให้ export สร้างไฟล์จริง แทนที่จะแค่ดึง JSON จาก Supabase
- [ ] (optional) ต่อ GAS Drive Upload หลัง export เพื่อบันทึกไฟล์ไว้ใน Google Drive อัตโนมัติ

### ไฟล์ที่ต้องแก้
- `package.json`
- `src/lib/exportUtils.ts` ← สร้างใหม่
- `src/components/Settings.tsx`
- `src/components/LineLogs.tsx`

---

## 3. Activity Log จริงจาก Database

### สถานะปัจจุบัน
- `Settings.tsx:367` render `ACTIVITY_LOGS` ที่ import จาก `src/data/mockData.ts` — **ข้อมูล hard-code ทั้งหมด**
- ปุ่ม "ดูบันทึกทั้งหมด" (Settings.tsx:401) — **ไม่มี handler**
- `dataService.ts` ไม่มี function สำหรับ fetch activity log จาก DB

### สิ่งที่ต้องทำ
- [ ] สร้าง table `activity_logs` ใน Supabase (ถ้ายังไม่มี)
  ```sql
  create table activity_logs (
    id uuid primary key default gen_random_uuid(),
    user_id text,
    user_name text,
    action text,
    details text,
    type text check (type in ('update','create','delete','system')),
    created_at timestamptz default now()
  );
  ```
- [ ] เพิ่ม `fetchActivityLogs()` ใน `src/lib/dataService.ts`
- [ ] เพิ่ม `logActivity()` helper — เรียกจากทุก action สำคัญ (check-in, leave approve, video update)
- [ ] **Settings.tsx** — แทนที่ `ACTIVITY_LOGS` mock ด้วย real fetch + pagination
- [ ] ต่อปุ่ม "ดูบันทึกทั้งหมด" ให้ขยาย/modal แสดงทั้งหมด

### ไฟล์ที่ต้องแก้
- `src/lib/dataService.ts`
- `src/components/Settings.tsx`
- `src/data/mockData.ts` ← ลบ ACTIVITY_LOGS ออกเมื่อพร้อม

---

## 4. Edit Tracked Account

### สถานะปัจจุบัน
- **Add** ✅ — form ครบ (`Settings.tsx:206-275`)
- **Delete** ✅ — มี confirmation (`Settings.tsx:444`)
- **Edit** ❌ — ไม่มี UI เลย แม้ว่า `updateTrackedAccount()` ใน `employeeApi.ts:359` พร้อมใช้แล้ว

### สิ่งที่ต้องทำ
- [ ] เพิ่มปุ่ม "แก้ไข" (ดินสอ icon) ข้างปุ่มลบ ในแถว tracked account แต่ละรายการ
- [ ] เปิด dialog/drawer เดิม (ใช้ form เดียวกับ Add) โดย pre-fill ค่าปัจจุบัน
- [ ] เรียก `updateTrackedAccount(id, payload)` เมื่อกด Save
- [ ] Refresh รายการหลัง save สำเร็จ

### ไฟล์ที่ต้องแก้
- `src/components/Settings.tsx` — เพิ่ม edit state + pre-fill logic (~30-50 บรรทัด)

---

## 5. Actionable Dashboard

### สถานะปัจจุบัน
- StatCards แสดงเฉพาะ metric ย้อนหลัง (engagement, popularity) — ไม่มี "งานที่รอดำเนินการ"
- AdminStats แสดง leaderboard — ไม่มี alert/count pending items
- **ไม่มี widget** สำหรับ: วิดีโอค้างโพสต์ / ใบลารออนุมัติ / พนักงานยังไม่ลงเวลา

### Widget ที่ต้องสร้าง

| Widget | ข้อมูลจาก | เงื่อนไข |
|--------|----------|---------|
| วิดีโอค้างโพสต์ | `video_records` | `isPostedFB=false OR isPostedTT=false` |
| ใบลารออนุมัติ | `leave_requests` | `status='pending'` |
| พนักงานยังไม่ลงเวลาวันนี้ | `time_entries` + employees | ไม่มี entry วันนี้ |
| OT สะสมสัปดาห์นี้ | `time_entries` | `overtime_hours > 0` รวม 7 วัน |

### สิ่งที่ต้องทำ
- [ ] สร้าง `src/components/ActionableAlerts.tsx` — card grid 2×2 หรือ row
- [ ] เพิ่ม fetch functions ใน `src/lib/dataService.ts`:
  - `fetchPendingLeaveCount()`
  - `fetchUnpostedVideoCount()`
  - `fetchNotCheckedInToday()`
- [ ] วาง `<ActionableAlerts />` ที่บน dashboard (ก่อน StatCards)
- [ ] คลิก card แล้ว navigate/filter ไปหน้าที่เกี่ยวข้องโดยตรง

### ไฟล์ที่ต้องแก้
- `src/components/ActionableAlerts.tsx` ← สร้างใหม่
- `src/lib/dataService.ts`
- `src/App.tsx` — วาง component ใหม่

---

## Priority & Effort

```
Sprint 1 (เร็ว ผลชัด)
├── [S] Edit tracked account     — มี API อยู่แล้ว แค่เพิ่ม UI
├── [S] Activity log จาก DB     — schema + 1 function + swap component
└── [M] Export utils             — ติดตั้ง library + util + ต่อปุ่ม

Sprint 2 (ค่อนข้างซับซ้อน)
├── [M] Search/filter ทุกหน้า   — แต่ละหน้าทำแยกกัน
└── [L] Actionable dashboard     — ต้องการ 3 fetch ใหม่ + component ใหม่
```

---

## Dependencies ที่ต้องติดตั้ง

```bash
# Export
npm install xlsx jspdf jspdf-autotable

# Date picker (ถ้าต้องการ UI component สำเร็จรูป)
npm install react-datepicker @types/react-datepicker
```
