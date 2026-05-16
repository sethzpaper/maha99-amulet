# คู่มือสร้าง Notion Workspace สำหรับ Workflow AI หลายตัว
## (Manus → ComfyUI → Grok → Notion → TikTok)

> เป้าหมาย: ออกแบบ Notion ให้เป็น "สมอง" ของระบบ ไม่ใช่แค่ที่เก็บไฟล์
> เก็บ prompt, เก็บข้อมูลพระเครื่อง, เก็บแผนเดือน, เก็บผลลัพธ์ แล้วให้ Manus
> หยิบไปใช้และเขียนผลกลับ — เมื่อเปลี่ยนไปใช้ Claude ในอนาคตก็ไม่ต้องรื้อโครงสร้าง

---

## สารบัญ

1. ภาพรวมระบบ — ทำไม Notion ต้องเป็นศูนย์กลาง
2. สถาปัตยกรรม Workspace ฉบับเต็ม
3. ฐานที่ 1: Prompt Library — คลังแม่แบบ prompt
4. ฐานที่ 2: Amulet Catalog — ข้อมูลพระเครื่องตั้งต้น
5. ฐานที่ 3: Monthly Content Plan — แผนคอนเทนต์รายเดือน
6. ฐานที่ 4: Pipeline Runs — บันทึกการรัน Manus
7. ฐานที่ 5: Mahaniyom Asset — ผลลัพธ์ภาพ/วิดีโอ (มีอยู่แล้ว)
8. ฐานที่ 6: TikTok Posts — track การโพสต์ + metrics
9. ฐานที่ 7: Competitor Watch — ส่องคู่แข่งโซเชียล
10. คลัง Prompt Template เริ่มต้น 5 แบบ
11. Workflow รายเดือน — เริ่มต้นจนจบ
12. การเปลี่ยนจาก Manus → Claude (Migration)
13. Checklist วันแรก / สัปดาห์แรก / เดือนแรก

---

## 1. ภาพรวมระบบ

```
       ┌─────────────────────────────────────────────────┐
       │              NOTION WORKSPACE                   │
       │  (สมองของระบบ — เก็บ prompt, plan, output)      │
       │                                                 │
       │  ┌────────────┐   ┌──────────┐  ┌────────────┐ │
       │  │ Prompt Lib │   │ Amulets  │  │ Plan/Month │ │
       │  └─────┬──────┘   └─────┬────┘  └─────┬──────┘ │
       │        │                │             │        │
       │        ▼                ▼             ▼        │
       │  ┌─────────────────────────────────────────┐  │
       │  │         Pipeline Runs (job log)         │  │
       │  └──────────┬──────────────────────────────┘  │
       │             ▼                                  │
       │  ┌─────────────────┐    ┌──────────────────┐  │
       │  │ Mahaniyom Asset │ ◄──│  TikTok Posts    │  │
       │  └─────────────────┘    └──────────────────┘  │
       │                                  ▲             │
       │                                  │ compare     │
       │                         ┌────────┴─────────┐   │
       │                         │ Competitor Watch │   │
       │                         └──────────────────┘   │
       └────────────┬────────────────────────────────────┘
                    │ (Notion API)
                    ▼
       ┌─────────────────────────┐
       │    MANUS (orchestrator) │
       │  อ่าน prompt + amulet   │
       │  ส่งไป generate         │
       │  เขียนผลกลับ            │
       └────┬───────────────┬────┘
            │               │
            ▼               ▼
       ┌──────────┐   ┌──────────┐
       │ ComfyUI  │   │   Grok   │
       │ (image)  │ → │ (video)  │
       └──────────┘   └──────────┘
                          │
                          ▼ (manual select)
                    ┌──────────┐
                    │  TikTok  │
                    └──────────┘
```

**กฎสำคัญ:** Notion ไม่ใช่ที่เก็บภาพ/วิดีโอจริง (ไฟล์ใหญ่ใส่ไม่ไหว)
ใส่แค่ **path** หรือ **URL** ของไฟล์ที่อยู่ที่อื่น (Drive / S3 / ComfyUI output folder)

---

## 2. สถาปัตยกรรม Workspace ฉบับเต็ม

### Sidebar layout ที่แนะนำ

```
🏠 Mahaniyom Studio                    ← Hub (หน้าหลัก)
│
├── 📚 Prompt Library                   ← คลัง prompt template
├── 🪷 Amulet Catalog                   ← ข้อมูลพระทั้งหมด
├── 🗓️ Monthly Content Plan             ← แผนรายเดือน
├── ⚙️ Pipeline Runs                    ← log การรัน
├── 🖼️ Mahaniyom Asset                  ← ผลลัพธ์ (มีอยู่แล้ว)
├── 🎵 TikTok Posts                     ← โพสต์ที่ปล่อย + metrics
├── 👀 Competitor Watch                 ← ส่องคู่แข่ง + benchmark
│
└── 🔧 System                            ← เอกสารเทคนิค (ซ่อน sub)
    ├── Manus Setup
    ├── ComfyUI Workflow IDs
    ├── Grok Endpoint
    └── Migration Notes
```

### หลักการตั้งชื่อ

- **อังกฤษล้วน** สำหรับชื่อฐานและคอลัมน์ — ป้องกัน encoding error เวลา API เรียก
- **ไทยได้** ในเนื้อหา/ค่าใน cell
- ใช้ **emoji prefix** ทุก page ใน sidebar เพื่อสแกนง่าย

---

## 3. ฐานที่ 1: Prompt Library 📚

หัวใจของระบบ — เก็บ prompt template ที่ Manus จะหยิบไปใช้

### Schema

| คอลัมน์ | Type | คำอธิบาย |
|---------|------|----------|
| Template Name | Title | ชื่อ template เช่น `Single Amulet 360°` |
| Template ID | Text | รหัสสั้น เช่น `T01_360`, `T02_TRIO` (ใช้อ้างอิงในโค้ด) |
| Category | Select | `Single`, `Trio`, `Event Promo`, `Educational`, `New Arrival` |
| Status | Select | `Draft`, `Testing`, `Active`, `Retired` |
| ComfyUI Prompt | Text | prompt ที่ส่ง ComfyUI พร้อม placeholder |
| ComfyUI Negative | Text | negative prompt |
| Grok Prompt | Text | prompt ที่ส่ง Grok |
| Video Length (sec) | Number | ความยาวเป้าหมาย |
| Aspect Ratio | Select | `9:16` (TikTok), `1:1`, `16:9` |
| Variables | Text | ระบุตัวแปรที่ Manus ต้องเติม เช่น `{name}, {temple}, {year}` |
| Example Output | Files | ภาพ/วิดีโอตัวอย่างผลที่ดี |
| Last Used | Date | ครั้งล่าสุดที่รัน |
| Run Count | Number | จำนวนครั้งที่รัน |
| Notes | Text | บันทึกการปรับ prompt |

### หลักการเขียน Prompt template

ใช้ **placeholder ในวงปีกกา** สำหรับค่าที่จะเปลี่ยนแต่ละครั้ง:

```
{name}     = ชื่อพระ
{temple}   = ชื่อวัด
{year}     = ปี พ.ศ.
{material} = วัสดุ
{event}    = ชื่องาน
{date}     = วันที่
```

ตัวอย่าง ComfyUI Prompt:

```
ultra detailed thai amulet photography, {name} from {temple},
created in B.E. {year}, made of {material},
studio lighting, black velvet background, 8k, sharp focus,
collector grade, professional product shot
```

### Views ที่แนะนำ

- **By Category** (Board) — group by Category เห็นแม่แบบที่มีในแต่ละหมวด
- **Active only** (Table) — filter Status = Active เพื่อใช้งาน
- **Most used** (Table) — sort Run Count desc

---

## 4. ฐานที่ 2: Amulet Catalog 🪷

ฐานข้อมูลพระเครื่องที่มี — Manus จะดึงจากที่นี่ไปแทน {placeholder}

### Schema

| คอลัมน์ | Type | คำอธิบาย |
|---------|------|----------|
| Name | Title | ชื่อพระ เช่น "พระสมเด็จวัดระฆัง" |
| Temple | Select / Text | วัดที่สร้าง |
| Year (B.E.) | Number | ปี พ.ศ. ที่สร้าง |
| Material | Multi-select | เนื้อโลหะ / ผง / ดิน / ผสม |
| Featured Detail | Text | ตะกรุดเงิน / รอย / สี / จุดเด่น |
| Reference Image | Files | ภาพอ้างอิงจริง |
| Rarity | Select | Common, Rare, Very Rare, Legendary |
| Available | Checkbox | มีในร้าน/คอลเลกชันหรือไม่ |
| Used in Content | Relation → TikTok Posts | เคยใช้โพสต์ไหนบ้าง |
| Tags | Multi-select | yellow, golden, sacred, etc. |

> **Tip:** Reference Image ที่ใส่ไว้ตรงนี้ Manus ดึงไปเป็น img2img reference ใน ComfyUI ได้

---

## 5. ฐานที่ 3: Monthly Content Plan 🗓️

แผนเนื้อหาแต่ละเดือน — เลือกพระตัวไหน + template ไหน + ปล่อยวันไหน

### Schema

| คอลัมน์ | Type | คำอธิบาย |
|---------|------|----------|
| Plan Name | Title | เช่น `2026-05 Week 1 - พระสมเด็จ trio` |
| Month | Select | 2026-05, 2026-06, ... |
| Week | Number | สัปดาห์ที่ในเดือน |
| Theme | Text | ธีมประจำสัปดาห์ |
| Template (relation) | Relation → Prompt Library | ใช้แม่แบบไหน |
| Subjects (relation) | Relation → Amulet Catalog | พระตัวไหน (1+) |
| Target Publish Date | Date | วันที่ตั้งใจปล่อย |
| Status | Select | Idea / Approved / In Production / Done / Posted |
| Variants to Generate | Number | จะสั่งสร้างกี่รอบ (เผื่อเลือก) เช่น 3 |
| Notes | Text | บันทึกพิเศษ |

### View แนะนำ

- **Calendar by Target Publish Date** — เห็นปฏิทินคอนเทนต์ทั้งเดือน
- **Board by Status** — เห็น pipeline ว่างานติดขั้นไหน
- **Filter This Month** — โฟกัสเฉพาะเดือนปัจจุบัน

---

## 6. ฐานที่ 4: Pipeline Runs ⚙️

ทุกครั้งที่ Manus รันงาน → สร้าง row ใหม่ในนี้ — เป็น log สำหรับ debug และดูประสิทธิภาพ

### Schema

| คอลัมน์ | Type | คำอธิบาย |
|---------|------|----------|
| Run ID | Title | timestamp + template เช่น `2026-05-09T14:30_T01_360` |
| Template (relation) | Relation → Prompt Library | ใช้ template ไหน |
| Subject (relation) | Relation → Amulet Catalog | พระที่ใช้ |
| Plan (relation) | Relation → Monthly Plan | สั่งจากแผนไหน |
| Resolved Prompt | Text | prompt จริงหลังเติม placeholder แล้ว |
| Started At | Date+Time | เริ่มกี่โมง |
| Completed At | Date+Time | เสร็จกี่โมง |
| Status | Select | `Queued` / `ComfyUI Running` / `Grok Running` / `Done` / `Failed` |
| Error Log | Text | ข้อความ error ถ้ามี |
| Outputs (relation) | Relation → Mahaniyom Asset | asset ที่สร้างได้ในครั้งนี้ |
| Cost (THB) | Number | ค่าใช้จ่าย API ต่อรอบ (ประมาณ) |

> **ทำไมต้อง log?** เดือนที่ 3 ของการใช้งาน คุณจะอยากรู้ว่า template ไหนมีอัตรา
> Failed สูง, ใช้เวลาเฉลี่ยเท่าไร, ค่าใช้จ่ายต่อคลิปเท่าไร — ฐานนี้ตอบให้

---

## 7. ฐานที่ 5: Mahaniyom Asset 🖼️

ฐานนี้คุณตั้งไว้แล้ว (จากคู่มือก่อนหน้า) — มีคอลัมน์ Name, Image Path, Video Path,
Status, ComfyUI Prompt, Grok Prompt

### เพิ่มคอลัมน์ที่แนะนำให้รองรับ workflow นี้

| คอลัมน์เพิ่ม | Type | คำอธิบาย |
|-------------|------|----------|
| Run (relation) | Relation → Pipeline Runs | มาจาก run ไหน |
| Quality Rating | Select | ⭐ Reject / ⭐⭐ OK / ⭐⭐⭐ Good / ⭐⭐⭐⭐ Excellent |
| Selected for Post | Checkbox | ติ๊กเมื่อจะใช้ลง TikTok |
| Used in Post (relation) | Relation → TikTok Posts | ปลายทางที่ถูกใช้ |

---

## 8. ฐานที่ 6: TikTok Posts 🎵

บันทึกคลิปที่ปล่อยจริง + metric ที่ดึงมาเปรียบเทียบ

### Schema

| คอลัมน์ | Type | คำอธิบาย |
|---------|------|----------|
| Post Title | Title | ชื่ออ้างอิงในระบบ |
| Caption | Text | caption จริงที่ปล่อย |
| Hashtags | Multi-select | #พระเครื่อง #amulet #thaiamulet |
| Asset (relation) | Relation → Mahaniyom Asset | คลิปที่ใช้ |
| Plan (relation) | Relation → Monthly Plan | มาจากแผนไหน |
| Subjects (relation) | Relation → Amulet Catalog | พระที่ปรากฏ |
| Posted At | Date+Time | วันเวลาที่โพสต์ |
| TikTok URL | URL | ลิงก์โพสต์ |
| Views | Number | ยอดวิว (อัปเดตมือทุก 7 วัน) |
| Likes | Number | |
| Comments | Number | |
| Shares | Number | |
| Saves | Number | |
| Engagement Rate | Formula | `(Likes+Comments+Shares)/Views*100` |
| Best Performing | Checkbox | ติ๊กถ้าเป็น top 10% |

### View

- **By Engagement Rate** (Table sort desc) — ดูว่าอันไหน engagement ดีสุด
- **Calendar by Posted At** — ดูประวัติการโพสต์
- **Board by Subject Category** — group by ประเภทพระ

---

## 9. ฐานที่ 7: Competitor Watch 👀

ฐานนี้ทำหน้าที่ "ส่องคู่แข่ง" — ติดตามว่าบัญชีพระเครื่องอื่นทำอะไร อะไรเวิร์ค
อะไรไม่เวิร์ค แล้วป้อน insight กลับไปที่ Prompt Library และ Monthly Content Plan

### ทำไมต้องมี?

- ไอเดียคอนเทนต์ใหม่มาจากการเห็น pattern ของคู่แข่ง (ไม่ใช่ลอก แต่สังเคราะห์)
- benchmark engagement: ของเราต่ำหรือสูงเทียบตลาด
- จับเทรนด์ format ใหม่ (เช่น เริ่มมีคนทำ ASMR พระเครื่อง) ก่อนคนอื่น

### Schema ฐาน Competitor Watch (ระดับบัญชี)

| คอลัมน์ | Type | คำอธิบาย |
|---------|------|----------|
| Competitor Name | Title | ชื่อบัญชี เช่น `@amulet_master_th` |
| Platform | Multi-select | TikTok, Instagram, Facebook, YouTube |
| Profile URL | URL | ลิงก์โปรไฟล์ |
| Followers | Number | จำนวนผู้ติดตาม (อัปเดตทุกเดือน) |
| Avg Engagement Rate | Number | % engagement เฉลี่ย |
| Posting Frequency | Select | Daily / 3-5x/wk / Weekly / Sporadic |
| Content Style | Multi-select | Educational, Trio Showcase, 360°, Storytelling, Live, Comparison |
| Strengths | Text | จุดแข็งที่สังเกตได้ |
| Weaknesses | Text | จุดที่ทำพลาด/น่าปรับปรุง |
| Threat Level | Select | 🔴 High / 🟡 Medium / 🟢 Low |
| Tracking Status | Select | Active Watch / Pause / Dropped |
| Last Reviewed | Date | วันล่าสุดที่ดู |
| Notes | Text | บันทึกเพิ่ม |

### Sub-database: Competitor Posts (ระดับคลิป)

ในแต่ละ Competitor page ฝัง sub-database ชื่อ "Competitor Posts" สำหรับเก็บคลิปที่น่าสนใจของคู่แข่ง

| คอลัมน์ | Type | คำอธิบาย |
|---------|------|----------|
| Post Title | Title | สรุปคลิปสั้นๆ |
| Competitor (relation) | Relation → Competitor Watch | เจ้าของคลิป |
| Post URL | URL | ลิงก์คลิป |
| Posted Date | Date | วันที่เขาโพสต์ |
| Format | Select | 360°, Trio, Compare, Storytelling, ... (ตรงกับ Prompt Library Categories) |
| Topic / Subjects | Multi-select | ประเภทพระที่พูดถึง |
| Hook (first 3s) | Text | ประโยคแรก/ภาพแรก |
| Views | Number | |
| Likes | Number | |
| Comments | Number | |
| Engagement Rate | Formula | คำนวณเอง |
| Why It Worked | Text | วิเคราะห์: ทำไมคลิปนี้ดัง |
| Steal-able Idea | Text | ไอเดียที่เอามาดัดแปลงได้ (ไม่ใช่ลอก) |
| Action Item (relation) | Relation → Monthly Content Plan | ถ้าจะลองทำ ให้สร้างแผนใหม่และโยงมา |

### ความสัมพันธ์กับฐานอื่นทั้งระบบ — สำคัญมาก

```
                ┌────────────────────┐
                │  Competitor Watch  │
                │  (ระดับบัญชี)       │
                └─────────┬──────────┘
                          │
                          ▼
                ┌────────────────────┐
                │  Competitor Posts  │
                │  (ระดับคลิป)        │
                └─────────┬──────────┘
                          │ "Steal-able Idea"
                          ▼
                ┌────────────────────┐
                │   Prompt Library   │ ◄─ เพิ่ม template ใหม่
                └────────────────────┘
                          │
                          ▼
                ┌────────────────────┐
                │  Monthly Plan      │ ◄─ ใส่ในแผนเดือนหน้า
                └────────────────────┘
                          │
                          ▼
                ┌────────────────────┐
                │  TikTok Posts      │
                │  (ของเรา)           │
                └─────────┬──────────┘
                          │
                          ▼
                ┌────────────────────────────┐
                │ เทียบกับ Competitor Posts  │
                │ ผ่าน View "Benchmark"     │
                └────────────────────────────┘
```

### View ที่แนะนำ

ใน **Competitor Watch:**
- **By Threat Level** (Board) — เห็นใครต้องจับตา
- **Active only** (Table) — filter Tracking Status = Active Watch

ใน **Competitor Posts:**
- **Top Performing** — sort Engagement Rate desc, top 20
- **By Format** — Board group by Format → ดูว่า format ไหนเวิร์คในตลาด
- **Steal-able This Month** — filter Action Item ว่าง = ยังไม่เก็บไอเดีย

### การใช้งานจริง — รอบเดือน

**ทุก 1-2 สัปดาห์ใช้เวลา 30 นาที:**

1. เปิดบัญชีคู่แข่งใน TikTok app → ดูคลิป 7 วันล่าสุด
2. คลิปไหนดังกว่าค่าเฉลี่ยของเขา → เพิ่มเข้า Competitor Posts
3. ใส่ Hook + วิเคราะห์ "Why It Worked"
4. ถ้าได้ไอเดียที่อยากลอง → จดใน "Steal-able Idea"
5. **ถ้าตัดสินใจลอง:**
   - ไปที่ Prompt Library → New template (อ้าง category ใหม่ถ้าจำเป็น)
   - ไปที่ Monthly Content Plan → New row ใส่ template + subject
   - กลับมาที่ Competitor Post → ตั้ง Action Item (relation) ไปที่ row Monthly Plan ที่สร้าง
   - ติ่กไว้เพื่อจะได้ track ว่า "ไอเดียที่เอามาจากคู่แข่ง คนนี้ ผลของเราเป็นอย่างไร"

### สร้าง Benchmark View ในฐาน TikTok Posts

ใน TikTok Posts สร้าง View ใหม่ชื่อ "vs Competitors":
- แสดงคอลัมน์: Posted At, Engagement Rate ของเรา, Subject Category
- เพิ่ม Linked database view ของ Competitor Posts ข้างๆ filter เดียวกัน
- เปรียบเทียบเดือนต่อเดือนได้ว่าตามทันหรือทิ้งห่าง

> **ผลลัพธ์:** ทุก insight จากการดูคู่แข่งจะถูกแปลงเป็น **template ใหม่ใน Prompt Library**
> และ **แผนใน Monthly Plan** อย่างเป็นระบบ ไม่ลอยไปแล้วลืม — นี่คือเหตุผลที่ฐานนี้
> ไม่ใช่ "ตารางลอยๆ" แต่เป็นข้อต่อสำคัญในวงจร feedback loop

---

## 10. คลัง Prompt Template เริ่มต้น 5 แบบ

ตั้งใน Prompt Library ตามนี้เพื่อเริ่มได้เลย

---

### T01 — Single Amulet 360°

**Category:** Single
**Variables:** `{name}, {temple}, {year}, {material}, {detail}`
**Length:** 10 sec • **Aspect:** 9:16

**ComfyUI Prompt:**
```
hyper detailed thai amulet, {name} from {temple} temple,
created in B.E. {year}, {material} with {detail},
studio product photography, soft top light, black velvet background,
multiple angles for turntable rotation, ultra sharp, 8k, collector grade
```

**ComfyUI Negative:**
```
blurry, low quality, watermark, text, distorted, oversaturated, fake plastic
```

**Grok Prompt:**
```
Create a 10-second 9:16 vertical video showing the amulet rotating 360 degrees
on a black velvet pedestal. Smooth turntable motion, single rotation.
Add subtle ambient temple bell sound effect at start. End with 1-second
hold of front view. Color grading: warm gold accent, deep black background.
```

---

### T02 — Trio of Top Picks

**Category:** Trio
**Variables:** `{name1}, {name2}, {name3}, {month_th}`
**Length:** 15 sec • **Aspect:** 9:16

**ComfyUI Prompt:**
```
three thai sacred amulets arranged in triangle composition,
{name1}, {name2}, {name3}, all front view symmetrical,
soft museum lighting, off-white linen backdrop with gold dust particles,
shallow depth of field, premium catalog style, 8k
```

**Grok Prompt:**
```
Create a 15-second 9:16 vertical slideshow:
- 0:00-0:04: hero shot of all three amulets together with title overlay
  "สามยอดนิยมประจำเดือน {month_th}"
- 0:04-0:07: zoom into amulet 1, name overlay "{name1}"
- 0:07-0:10: smooth pan to amulet 2, "{name2}"
- 0:10-0:13: pan to amulet 3, "{name3}"
- 0:13-0:15: pull back to all three with logo
Smooth Ken Burns transitions, soft chime audio between each.
```

---

### T03 — Event Promo Flyer

**Category:** Event Promo
**Variables:** `{event_name}, {event_date_th}, {venue}`
**Length:** 15 sec • **Aspect:** 9:16

**ComfyUI Prompt:**
```
thai amulet exhibition poster, multiple amulets floating with golden light rays,
crowd silhouette in background, traditional thai pattern frame,
festival atmosphere, dramatic lighting, premium event flyer aesthetic,
warm gold and red color palette, 8k vertical format
```

**Grok Prompt:**
```
Create 15-second 9:16 vertical event teaser:
- 0:00-0:03: light rays burst with title "{event_name}"
- 0:03-0:08: showcase amulets floating with parallax
- 0:08-0:12: text overlay "พบกับพระเครื่องสายสยาม
  หลากหลายรายการในงาน {event_name} วันที่ {event_date_th}"
- 0:12-0:15: venue info "{venue}" + call-to-action
Dramatic Thai traditional music build-up. Final cut on logo.
```

---

### T04 — Educational Compare

**Category:** Educational
**Variables:** `{name}, {real_traits}, {fake_traits}`
**Length:** 30 sec • **Aspect:** 9:16

**ComfyUI Prompt:**
```
side by side comparison of two thai amulets, {name},
left side labeled "REAL" with detail of {real_traits},
right side labeled "REPLICA" with subtle differences {fake_traits},
extreme close-up macro photography, museum lighting, 8k
```

**Grok Prompt:**
```
Create 30-second 9:16 educational comparison video:
- 0:00-0:05: title card "วิธีดูพระแท้ - {name}"
- 0:05-0:15: zoom into REAL amulet, highlight {real_traits} with circle markers
- 0:15-0:25: zoom into REPLICA, highlight {fake_traits}
- 0:25-0:30: side-by-side conclusion, CTA "ติดตามเพื่อความรู้พระเครื่อง"
Clean educational narration tone (no music initially - leave space for VO).
Add subtle keyboard typing SFX when text appears.
```

> **หมายเหตุ:** Template นี้ตั้งใจให้คุณพากย์เสียงเองทีหลัง — ปล่อย video ไม่มีเสียงพูด

---

### T05 — New Arrival Quick

**Category:** New Arrival
**Variables:** `{name}, {temple}, {short_pitch}`
**Length:** 10 sec • **Aspect:** 9:16

**ComfyUI Prompt:**
```
single thai amulet hero shot, {name} from {temple},
dramatic spotlight from above, dark background with subtle smoke,
luxury jewelry display style, ultra sharp macro detail, 8k vertical
```

**Grok Prompt:**
```
Create snappy 10-second 9:16 new arrival reveal:
- 0:00-0:02: black screen → quick zoom in to amulet (drum hit)
- 0:02-0:06: slow rotate showing detail with sparkle particles
- 0:06-0:09: text overlay "{short_pitch}"
- 0:09-0:10: logo + "พระเข้าร้านใหม่"
Punchy modern beat, drum drop at 0:02. High energy.
```

---

## 11. Workflow รายเดือน — ทำตามทีละขั้น

### สัปดาห์ก่อนเดือนใหม่ — วางแผน

1. เปิด **Monthly Content Plan** → New 4-8 row สำหรับเดือนใหม่
2. แต่ละ row เลือก:
   - Template (relation จาก Prompt Library)
   - Subjects (relation จาก Amulet Catalog) — พระตัวไหน
   - Target Publish Date
   - Variants to Generate (เช่น 3 = สั่งสร้าง 3 รอบ เลือก 1)
3. กด Status = `Approved` ทุก row → Manus จะมอง row นี้

### วันรัน Manus — Generate

4. เปิด Manus → สั่งงาน "ดึง row ใน Monthly Plan ที่ Status = Approved
   และยังไม่มี Pipeline Run"
5. Manus จะ:
   - Resolve prompt: ดึง template + subject → เติม placeholder
   - สร้าง Pipeline Run row (Status = Queued)
   - เรียก ComfyUI → ได้ภาพ
   - เรียก Grok → ได้วิดีโอ
   - สร้าง Mahaniyom Asset row × Variants to Generate
   - อัปเดต Pipeline Run = Done
6. คุณเปิด Mahaniyom Asset (Gallery view) — เลือกตัวที่ดีที่สุด ติ๊ก
   `Selected for Post`, ให้ดาว Quality Rating

### วันโพสต์ — เผยแพร่

7. เปิด TikTok Posts → New
8. Asset (relation) → เลือก asset ที่ติ๊กไว้
9. เขียน Caption + Hashtags ในไทย
10. โพสต์จริงบน TikTok → เอา URL กลับมาใส่ TikTok URL
11. Posted At = วันเวลาจริง
12. กลับไปที่ Monthly Plan row → เปลี่ยน Status = Posted

### หลังโพสต์ 7 วัน — เก็บข้อมูล

13. เปิด TikTok Posts → ใส่ Views/Likes/Comments/Shares
14. ดู View "By Engagement Rate" → จด pattern ว่า template ไหน ทำงานดี
15. ปรับ Prompt Library: template ที่แย่ → Status `Retired` หรือแก้ prompt

---

## 12. การเปลี่ยนจาก Manus → Claude (Migration)

ข่าวดี: ถ้าใช้ Notion เป็นศูนย์กลางแบบนี้ การเปลี่ยน orchestrator
**ไม่ต้องรื้อ workspace เลย**

สิ่งที่ต้องทำ:

| สิ่งที่เปลี่ยน | สิ่งที่ไม่ต้องเปลี่ยน |
|---------------|---------------------|
| ตัวเรียก ComfyUI/Grok/Notion API | Notion workspace ทั้งหมด |
| Prompt orchestration logic | Prompt templates ใน Prompt Library |
| ค่าใช้จ่าย API | Amulet Catalog, Monthly Plan, ทุกฐาน |

### ขั้นเปลี่ยน (high-level)

1. Export prompt template เป็นไฟล์ JSON (Notion API → script ดึงทุก row)
2. เขียน Claude script ใหม่ที่ทำหน้าที่เดียวกับ Manus:
   - อ่าน Monthly Plan ผ่าน Notion API
   - resolve prompt
   - call ComfyUI HTTP endpoint
   - call Grok API
   - เขียนกลับ Notion (ใช้ `notion_client_mahaniyom.py` ที่มีอยู่แล้ว!)
3. รันแบบ scheduled task (cron/Task Scheduler) แทน Manus dashboard

> **เคล็ดสำคัญ:** ออกแบบ workflow ให้แต่ละ step สื่อสารผ่าน **Notion เท่านั้น**
> ไม่ใช่ผ่าน in-memory state ของ Manus — แล้ว migration จะกลายเป็นแค่ "เปลี่ยนคนขับ"

ใน System page ใน workspace แนะนำให้บันทึก:
- Endpoint URL ของ ComfyUI (ที่ตั้งไว้)
- Endpoint URL ของ Grok
- Notion Integration Token IDs (ห้ามใส่ token จริง — ใส่แค่ชื่อและ permission)
- Workflow JSON ของ ComfyUI ที่ใช้

---

## 13. Checklist

### ✅ วันแรก (1-2 ชม.)

- [ ] สร้าง Hub `🏠 Mahaniyom Studio` พร้อม cover/icon
- [ ] สร้างฐาน Prompt Library + ใส่ template T01-T05 จากข้อ 9
- [ ] สร้างฐาน Amulet Catalog + ใส่พระทดสอบ 5-10 ตัว
- [ ] เพิ่มคอลัมน์ใหม่ใน Mahaniyom Asset (Run, Quality Rating, Selected, Used in Post)

### ✅ สัปดาห์แรก

- [ ] สร้างฐาน Monthly Content Plan + Pipeline Runs + TikTok Posts
- [ ] สร้างฐาน Competitor Watch + Sub-database Competitor Posts
- [ ] เชื่อม Relations ทุกฐานครบ (ดูแผนผังในข้อ 1)
- [ ] เพิ่มคู่แข่ง 5-10 บัญชีในวงการพระเครื่องเข้า Competitor Watch
- [ ] รัน Manus 1 ครั้งทดลอง (template เดียว, พระตัวเดียว) — ดูว่า data flow ครบไหม
- [ ] ปรับ T01-T05 หลังเห็นผลจริง

### ✅ เดือนแรก

- [ ] วางแผน 8-12 row ใน Monthly Plan
- [ ] รันครบทุก row, posted ครบ
- [ ] เก็บ engagement metric หลัง 7 วัน
- [ ] ส่อง Competitor Posts สัปดาห์ละครั้ง — เก็บ 4-8 คลิปต่อสัปดาห์
- [ ] ทบทวน: template ไหนเวิร์ค? พระตัวไหนคนชอบ? คู่แข่งทำอะไรที่เราไม่ทำ?
- [ ] ปรับ Prompt Library — retire ที่ไม่เวิร์ค, เพิ่ม template ใหม่จาก insight (ของเรา + ของคู่แข่ง)

### ✅ ตอนพร้อมเปลี่ยนเป็น Claude

- [ ] เขียน Claude orchestrator script (ใช้ `notion_client_mahaniyom.py` ที่มีอยู่)
- [ ] รัน parallel กับ Manus 1 รอบ เพื่อเทียบผล
- [ ] ปิด Manus subscription เมื่อมั่นใจ

---

## ภาคผนวก: ตัวอย่าง Resolved Prompt

ถ้า template T01 มี:
```
{name} from {temple} temple, B.E. {year}, {material}
```

และเลือก Subject "พระสมเด็จวัดระฆัง" จาก Amulet Catalog ที่มี:
- Name: พระสมเด็จวัดระฆัง พิมพ์ใหญ่
- Temple: วัดระฆังโฆสิตาราม
- Year (B.E.): 2411
- Material: ผงพุทธคุณ

Resolved prompt ที่ Manus ส่งให้ ComfyUI:
```
พระสมเด็จวัดระฆัง พิมพ์ใหญ่ from วัดระฆังโฆสิตาราม temple,
B.E. 2411, ผงพุทธคุณ
```

> **เคล็ด:** ถ้า ComfyUI/Grok เข้าใจอังกฤษดีกว่า ให้สร้างคอลัมน์
> `Name (EN)`, `Temple (EN)` ใน Amulet Catalog เพิ่ม แล้วให้ Manus
> ใช้เวอร์ชัน EN เวลา resolve

---

## สรุปสำคัญ

1. **Notion = สมอง** — เก็บทุก state ของระบบ
2. **Manus = แขน** — แค่หยิบไปใช้และเขียนกลับ
3. **ComfyUI/Grok = เครื่องมือ** — สลับยี่ห้อได้ ถ้าโครงไม่ผูกแน่น
4. **คุณ = ผู้ตัดสิน** — ตรงจุด "เลือก asset" และ "Caption" ที่เครื่องทำไม่ได้

วันที่เปลี่ยนเป็น Claude — เปลี่ยนแค่ "แขน" ส่วน "สมอง" ยังอยู่เหมือนเดิม

---

## 📌 Map สรุป — ทุกฐานเชื่อมกันยังไง

> สำหรับคนที่กังวลว่าจะลืมว่าอะไรเชื่อมกับอะไร — อ่านหน้าเดียวจบ

### ทิศทางการไหลของข้อมูล

```
INPUT → PROCESS → OUTPUT → FEEDBACK
```

**INPUT (สิ่งที่เราสร้างไว้ก่อน):**
- 🪷 Amulet Catalog → พระทั้งหมดที่จะใช้เป็น subject
- 📚 Prompt Library → แม่แบบ prompt ที่จะใช้ซ้ำๆ
- 👀 Competitor Watch → ส่งไอเดียใหม่เข้า Prompt Library

**PROCESS (Manus ทำ):**
- 🗓️ Monthly Plan → บอก Manus ว่าจะทำอะไร เมื่อไร
- ⚙️ Pipeline Runs → log ว่ารันสำเร็จ/ล้มเหลว
- (Manus เรียก ComfyUI + Grok ผ่าน API)

**OUTPUT (ผลลัพธ์):**
- 🖼️ Mahaniyom Asset → ภาพ/วิดีโอที่ generate ได้
- 🎵 TikTok Posts → คลิปที่ปล่อยจริง + metric

**FEEDBACK (กลับไปปรับระบบ):**
- TikTok Posts metrics → บอกว่า template ไหนเวิร์ค → ปรับ Prompt Library
- Competitor Watch insights → บอกว่ามี format ใหม่ → เพิ่ม template ใหม่
- กลับวนรอบใหม่

### ตารางความสัมพันธ์ (Relations) ทุกคู่

| ฐาน | เชื่อมไปฐาน | ผ่านคอลัมน์ |
|-----|------------|-------------|
| Monthly Plan | Prompt Library | Template (relation) |
| Monthly Plan | Amulet Catalog | Subjects (relation) |
| Pipeline Runs | Prompt Library | Template (relation) |
| Pipeline Runs | Amulet Catalog | Subject (relation) |
| Pipeline Runs | Monthly Plan | Plan (relation) |
| Pipeline Runs | Mahaniyom Asset | Outputs (relation) |
| Mahaniyom Asset | Pipeline Runs | Run (relation) |
| Mahaniyom Asset | TikTok Posts | Used in Post (relation) |
| TikTok Posts | Mahaniyom Asset | Asset (relation) |
| TikTok Posts | Monthly Plan | Plan (relation) |
| TikTok Posts | Amulet Catalog | Subjects (relation) |
| Amulet Catalog | TikTok Posts | Used in Content (relation) |
| Competitor Posts | Competitor Watch | Competitor (relation) |
| Competitor Posts | Monthly Plan | Action Item (relation) |

> **ถ้าตั้ง relations ครบตามตารางนี้ ระบบจะถักทอเป็นเครือข่ายเดียว** —
> เปิดพระ 1 ตัวเห็นทุกคลิปที่ใช้, เปิดคลิป 1 อันเห็นพระ + run + plan ที่มา,
> เปิด template เห็นว่า run ไหนใช้ template นี้แล้วผลเป็นยังไง

### กฎทอง 3 ข้อเพื่อไม่ให้ระบบขาดการเชื่อม

1. **อย่าสร้าง row ที่ไม่มี relation** — ทุก row ใน Pipeline Runs ต้องโยง Template,
   Subject, Plan ให้ครบ; ทุก TikTok Post ต้องโยง Asset
2. **ใช้ Manus เขียน relation ให้อัตโนมัติ** — ตอน Manus สร้าง Asset row
   ให้กรอก Run (relation) ทันที ไม่ต้องมาทำมือทีหลัง
3. **ทุก insight ต้องลงเป็น row ใหม่ในฐานที่ถูก** — ไม่ใช่จดใน Doc ลอย
   เห็นไอเดียจากคู่แข่ง? → New row ใน Competitor Posts → New template ใน Prompt Library

---

## คำตอบสั้นถ้าใครถาม "ตารางคู่แข่งเกี่ยวอะไรกับระบบ generate วิดีโอ?"

> "ตารางคู่แข่งคือต้นน้ำของไอเดียใหม่ ถ้าไม่มีมัน Prompt Library จะค่อยๆ เก่า
> เพราะปรับจากผลของตัวเองอย่างเดียว ตารางนี้ทำให้ระบบ 'เห็น' ตลาด แล้ว
> แปลงสิ่งที่เห็นเป็น template และแผน — ไม่ใช่ตารางที่อยู่นอกระบบ
> แต่เป็นข้อต่อระหว่าง 'โลกข้างนอก' กับ 'workflow ข้างใน'"
