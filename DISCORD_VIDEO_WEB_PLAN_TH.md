# คู่มือแผนพัฒนาเว็บ AI Video Workflow + Discord

เอกสารนี้เป็นแผนทำงานต่อใน VS Code สำหรับเปลี่ยนเว็บ `maha99-amulet` ให้เป็นศูนย์จัดการงานวิดีโอ AI ที่เชื่อมกับ Discord จริง โดยให้ Discord เป็นจุดคุยงาน/สั่งงาน และให้เว็บเป็น Dashboard สำหรับดูสถานะ รายการไฟล์ ต้นทุน และงานที่อนุมัติแล้ว

---

## เป้าหมายหลัก

ทำให้ระบบทำงานเป็น flow เดียว:

1. ทีมสร้างงานและอัปเดตสถานะใน Discord
2. Discord bot บันทึกข้อมูล project, asset, cost, event
3. Bot ส่งข้อมูลเข้า Supabase หรือ API กลาง
4. เว็บดึงข้อมูลจริงมาแสดงในเมนู workflow
5. เว็บ export ตารางรายงาน social/video/cost ได้

---

## โครงเมนูเว็บที่ต้องใช้

เมนูหลักของเว็บให้ยึดตาม Discord channel:

```text
#🏠-ai-video-home
#💡-video-ideas
#🖼️-image-gen
#🎬-storyboard
#⚙️-video-render
#👀-video-review
#✅-approved-videos
#📦-asset-library
#🧾-cost-tracker
```

ตอนนี้เว็บมีเมนูเหล่านี้แล้ว แต่หลายหน้ายังเป็น placeholder รอข้อมูลจริงจาก Discord

---

## สถานะปัจจุบัน

### สิ่งที่มีแล้ว

- เว็บ React/Vite ทำงานได้
- เมนูหลักเปลี่ยนเป็น AI Video Workflow แล้ว
- มีหน้า `asset-library` ใช้ `VideoManagement` เดิม
- มี Discord bot ในโฟลเดอร์ `Discord_Video prompt`
- Bot มี SQLite สำหรับ video pipeline
- Bot มี slash commands หลักครบ:
  - `/new-video-project`
  - `/set-stage`
  - `/attach-asset`
  - `/cost`
  - `/credits`
  - `/approve`
  - `/video-status`
  - `/setup-video-channels`
- Smoke test ผ่านแล้ว

### สิ่งที่ยังไม่พร้อม

- เว็บยังไม่ได้ดึงข้อมูลจาก Discord bot จริง
- SQLite อยู่ในเครื่อง ไม่เหมาะสำหรับ Cloudflare Pages
- Bot ยังไม่ได้ส่งข้อมูลเข้า Supabase จริง
- `.env` ยังต้องเติม Discord token และ channel IDs
- เมนูเว็บกับ channel mapping ของ bot ยังต้องปรับชื่อให้ตรงกัน
- หน้า workflow ยังไม่มีตารางงานจริงแยกตาม stage

ประเมินความพร้อมตอนนี้:

```text
Discord bot backend logic: 55-60%
เว็บ + Discord ใช้ร่วมกันจริง: 40-45%
```

---

## ภาพรวมสถาปัตยกรรมที่ควรทำ

แนะนำให้ใช้ Supabase เป็นฐานกลาง:

```text
Discord
  ↓ slash command
Discord Bot
  ↓ webhook / Supabase insert
Supabase
  ↓ fetch
Cloudflare Pages Web
```

เหตุผล:

- Cloudflare Pages อ่าน SQLite ในเครื่องไม่ได้
- Supabase ใช้กับเว็บนี้อยู่แล้ว
- เว็บ React ดึงข้อมูลจาก Supabase ได้ทันที
- Bot เขียนข้อมูลเข้า Supabase หรือยิง webhook ไป API ได้

---

## Step 1: ปรับชื่อ Discord channel ให้ตรงกับเว็บ

แก้ไฟล์:

```text
Discord_Video prompt/bot.py
Discord_Video prompt/README_VIDEO_PIPELINE_BOT.md
Discord_Video prompt/.env.example
```

ให้ channel layout เป็น:

```text
🏠-ai-video-home
💡-video-ideas
🖼️-image-gen
🎬-storyboard
⚙️-video-render
👀-video-review
✅-approved-videos
📦-asset-library
🧾-cost-tracker
```

หมายเหตุ:

- Discord channel อาจรองรับ emoji ในชื่อได้ แต่ควรทดสอบจริง
- ถ้า emoji ทำให้ command/channel mapping ยาก ให้ใช้ชื่อแบบมีเลขนำหน้าใน Discord แต่เว็บแสดงชื่อแบบ emoji ได้

ตัวเลือกที่ปลอดภัย:

```text
00-ai-video-home
01-video-ideas
02-image-gen
03-storyboard
04-video-render
05-video-review
06-approved-videos
07-asset-library
08-cost-tracker
```

แล้วให้เว็บแสดง label เป็น:

```text
#🏠-ai-video-home
```

---

## Step 2: สร้างตาราง Supabase สำหรับ Video Workflow

เพิ่ม SQL ใน `MIGRATION_NOTES.md` หรือรันใน Supabase SQL editor

```sql
create table if not exists public.video_projects (
  id uuid primary key default gen_random_uuid(),
  project_key text unique not null,
  title text not null,
  brief text,
  stage text not null default 'idea',
  owner_id text,
  owner_name text,
  discord_thread_id text,
  discord_channel_id text,
  notion_url text,
  drive_url text,
  final_asset_url text,
  approved_by_id text,
  approved_by_name text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.video_assets (
  id uuid primary key default gen_random_uuid(),
  project_key text not null references public.video_projects(project_key) on delete cascade,
  asset_type text not null,
  url text not null,
  prompt text,
  note text,
  added_by_id text,
  added_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.video_costs (
  id uuid primary key default gen_random_uuid(),
  project_key text not null references public.video_projects(project_key) on delete cascade,
  amount numeric not null,
  unit text not null default 'credits',
  tool text,
  note text,
  added_by_id text,
  added_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.video_events (
  id uuid primary key default gen_random_uuid(),
  project_key text not null references public.video_projects(project_key) on delete cascade,
  event_type text not null,
  message text,
  actor_id text,
  actor_name text,
  payload jsonb,
  created_at timestamptz not null default now()
);
```

Stage ที่ใช้:

```text
idea
image_gen
storyboard
render
review
approved
asset_library
cost_tracker
```

ถ้ายังต้องมี `edits` ให้ใช้เป็น sub-status ใน `review` แทน เพื่อให้เมนูไม่เยอะเกิน

---

## Step 3: เปิด RLS และ policy เบื้องต้น

ช่วงแรกถ้าต้องการให้เว็บอ่านได้:

```sql
alter table public.video_projects enable row level security;
alter table public.video_assets enable row level security;
alter table public.video_costs enable row level security;
alter table public.video_events enable row level security;

create policy "public read video projects"
on public.video_projects for select using (true);

create policy "public read video assets"
on public.video_assets for select using (true);

create policy "public read video costs"
on public.video_costs for select using (true);

create policy "public read video events"
on public.video_events for select using (true);
```

สำหรับ bot ไม่ควรใช้ anon key เขียนข้อมูลระยะยาว  
ควรใช้วิธีใดวิธีหนึ่ง:

- ใช้ Supabase service role key เฉพาะฝั่ง bot
- หรือทำ webhook API กลาง แล้วให้ API เป็นคนเขียน Supabase

---

## Step 4: เพิ่ม Supabase client ใน Discord bot

เพิ่ม dependency:

```text
supabase>=2.0.0
```

ในไฟล์:

```text
Discord_Video prompt/requirements.txt
```

เพิ่ม `.env.example`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

คำเตือน:

```text
ห้าม commit service role key ขึ้น GitHub
```

---

## Step 5: ทำ bridge จาก Discord bot ไป Supabase

สร้างไฟล์ใหม่:

```text
Discord_Video prompt/supabase_video_bridge.py
```

หน้าที่ของไฟล์นี้:

- upsert project ลง `video_projects`
- insert asset ลง `video_assets`
- insert cost ลง `video_costs`
- insert event log ลง `video_events`

จุดที่ต้องเรียก bridge ใน `bot.py`:

```text
/new-video-project  -> sync project + created event
/set-stage          -> update stage + stage_changed event
/attach-asset       -> insert asset + asset_added event
/cost /credits      -> insert cost + cost_added event
/approve            -> update approved + approved event
/link-notion        -> update notion_url
/link-drive         -> update drive_url
```

---

## Step 6: เพิ่ม data service ฝั่งเว็บ

แก้ไฟล์:

```text
src/lib/dataService.ts
```

เพิ่ม functions:

```ts
fetchVideoProjects(stage?: string)
fetchVideoAssets(projectKey?: string)
fetchVideoCosts(projectKey?: string)
fetchVideoEvents(projectKey?: string)
```

แต่ละ function อ่านจาก Supabase:

```text
video_projects
video_assets
video_costs
video_events
```

---

## Step 7: ทำหน้าเว็บแต่ละเมนูให้ใช้ข้อมูลจริง

### #🏠-ai-video-home

แสดง:

- จำนวน project ทั้งหมด
- จำนวนงานในแต่ละ stage
- งานล่าสุด 10 รายการ
- งานที่ค้าง review
- ต้นทุนรวมเดือนนี้

### #💡-video-ideas

ดึงจาก:

```text
video_projects where stage = 'idea'
```

แสดงเป็นตาราง:

- Project
- Brief
- Owner
- Created
- Thread link
- ปุ่มดูรายละเอียด

### #🖼️-image-gen

ดึงจาก:

```text
video_projects where stage = 'image_gen'
video_assets where asset_type in ('prompt','reference','image')
```

แสดง:

- Prompt
- Reference
- Image output
- คนสร้าง
- สถานะ

### #🎬-storyboard

ดึงจาก:

```text
video_projects where stage = 'storyboard'
video_assets where asset_type = 'storyboard'
```

แสดง:

- Shot plan
- Storyboard link
- Note
- Owner

### #⚙️-video-render

ดึงจาก:

```text
video_projects where stage = 'render'
video_assets where asset_type = 'video'
video_costs
```

แสดง:

- Render version
- Tool
- Cost
- Output URL

### #👀-video-review

ดึงจาก:

```text
video_projects where stage = 'review'
```

แสดง:

- Final draft URL
- Comment ล่าสุด
- Owner
- ปุ่ม link ไป Discord thread

### #✅-approved-videos

ดึงจาก:

```text
video_projects where stage = 'approved'
```

แสดง:

- Final URL
- Approved by
- Approved date
- Drive folder

### #📦-asset-library

ดึงจาก:

```text
video_assets
```

แสดงเป็นคลัง:

- asset type
- project
- URL
- prompt/note
- created date

### #🧾-cost-tracker

ดึงจาก:

```text
video_costs
```

แสดง:

- ต้นทุนรวมตาม project
- ต้นทุนรวมตาม tool
- credits/tokens/money
- export CSV

---

## Step 8: ทำ project detail modal

ทุกหน้า workflow ควรกด project แล้วเปิด modal:

ข้อมูลใน modal:

- Project title
- Brief
- Stage
- Owner
- Discord thread
- Notion URL
- Drive URL
- Assets
- Costs
- Event timeline

ไฟล์ที่ควรสร้าง:

```text
src/components/VideoProjectDetail.tsx
src/components/VideoWorkflowTable.tsx
src/components/VideoStageBoard.tsx
```

---

## Step 9: ปรับ Export ให้เป็นรายงาน Video Workflow จริง

ในเมนู Settings > Export:

เพิ่ม report:

- Video project report
- Asset report
- Cost report
- Approved videos report

รูปแบบ:

- PDF print table
- CSV สำหรับ Excel

Columns ที่ควรมี:

```text
Project Key
Title
Stage
Owner
Assets Count
Cost Total
Final URL
Approved At
Discord Thread
```

---

## Step 10: ทดสอบแบบ end-to-end

ทดสอบ flow นี้:

```text
/new-video-project title:Test Product Video brief:30s test clip
/attach-asset asset_type:prompt url:https://docs.google.com/test prompt:test prompt
/set-stage stage:image_gen
/attach-asset asset_type:image url:https://drive.google.com/image-test
/set-stage stage:storyboard
/attach-asset asset_type:storyboard url:https://drive.google.com/storyboard-test
/set-stage stage:render
/cost amount:120 unit:credits tool:Runway
/attach-asset asset_type:video url:https://drive.google.com/render-test
/set-stage stage:review
/approve final_url:https://drive.google.com/final-test
```

หลังจากนั้นเช็ก:

- Discord thread มี log ครบ
- Supabase มี rows เพิ่มครบ
- เว็บหน้า home เห็น project ใหม่
- หน้า approved เห็น final video
- หน้า cost tracker เห็น 120 credits
- export CSV มีข้อมูล project นี้

---

## Step 11: เกณฑ์ว่าใช้งานได้ 50%

ถือว่าเกิน 50% เมื่อทำครบนี้:

- Bot รันจริงใน Discord ได้
- `/new-video-project` สร้าง project ได้
- `/set-stage` เปลี่ยน stage ได้
- `/attach-asset` เก็บ link ได้
- `/cost` เก็บต้นทุนได้
- `/approve` อนุมัติได้
- ข้อมูลทั้งหมดเข้า Supabase
- เว็บดึง project จริงมาแสดงอย่างน้อย 5 หน้า:
  - home
  - ideas
  - render
  - review
  - approved
- export CSV ใช้ได้

---

## Step 12: เกณฑ์ว่าใช้งานได้ 80%

ถือว่าใกล้ production เมื่อมีเพิ่ม:

- หน้า detail modal ครบ
- asset library ใช้งานจริง
- cost tracker สรุปตามเดือน/tool/project
- Discord thread link เปิดจากเว็บได้
- RLS/permission ปลอดภัย
- มี error logging
- มี backup หรือ sync จาก SQLite ไป Supabase
- Cloudflare Pages deploy จาก GitHub ล่าสุด

---

## Step 13: งานที่ควรทำทันทีในรอบต่อไป

ลำดับที่แนะนำ:

1. สร้าง Supabase tables สำหรับ video workflow
2. เพิ่ม `supabase_video_bridge.py` ใน Discord bot
3. ให้ `/new-video-project` ส่งข้อมูลเข้า Supabase
4. ให้เว็บหน้า `#🏠-ai-video-home` อ่าน `video_projects`
5. ให้เว็บหน้า `#✅-approved-videos` อ่านงาน approved จริง
6. ค่อยเติมหน้าอื่นทีละ stage

---

## หมายเหตุเรื่อง Attendance

ตอนนี้ระบบลงเวลาจะย้ายไป Discord แล้ว เว็บจึงไม่ต้องแสดงเมนูลงเวลา

แต่ไฟล์เดิมยังเก็บไว้ได้:

```text
src/components/LineLogs.tsx
src/lib/attendanceApi.ts
Discord_Video prompt/attendance_db.py
```

ระยะต่อไปควรเลือกอย่างใดอย่างหนึ่ง:

- เก็บไว้เป็น legacy ไม่โชว์บนเว็บ
- ลบออกเมื่อ Discord attendance ใช้งานจริงแล้ว
- หรือทำหน้า admin เฉพาะดู report จาก Discord attendance ภายหลัง

---

## Checklist สำหรับเปิดใช้งานจริง

```text
[ ] ตั้งค่า Discord bot token
[ ] ตั้งค่า Discord guild id
[ ] สร้าง channel layout จริง
[ ] ใส่ channel IDs ใน .env
[ ] สร้าง Supabase tables
[ ] ใส่ Supabase service role key ใน .env ของ bot
[ ] Bot เขียน project เข้า Supabase ได้
[ ] เว็บอ่าน project จาก Supabase ได้
[ ] ทดสอบ full flow 1 project
[ ] Deploy Cloudflare Pages จาก GitHub ล่าสุด
```

---

## สรุป

โครงที่มีตอนนี้ถือว่ามีฐานดีแล้ว แต่หัวใจสำคัญที่ต้องทำต่อคือ “เชื่อมข้อมูลจริง” จาก Discord bot เข้า Supabase แล้วให้เว็บอ่านจาก Supabase

เมื่อทำ bridge นี้เสร็จ เว็บจะเปลี่ยนจาก placeholder board เป็น dashboard งานวิดีโอจริงทันที

