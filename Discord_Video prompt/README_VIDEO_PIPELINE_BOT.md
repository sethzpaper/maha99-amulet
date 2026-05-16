# AI Video Pipeline Discord Bot

ระบบนี้ใช้ Discord เป็น frontend สำหรับคุยงานและ track งานวิดีโอ AI โดยเก็บ metadata ลง SQLite
และสามารถส่งต่อ webhook ไป Notion, Supabase, Postgres, Google Drive index หรือ automation อื่นได้

## 1. Discord Workflow

สร้าง channels ตามนี้:

| Channel | หน้าที่ |
| --- | --- |
| `#ai-video-pipeline` | master channel สำหรับสร้างโปรเจ็กต์ใหม่ |
| `#video-ideas` | รวมงาน stage idea |
| `#image-gen` | รวมงานสร้างภาพ / reference |
| `#storyboard` | รวม storyboard / shot plan |
| `#video-render` | รวม render และ generation |
| `#video-edits` | รวมรอบแก้ไข |
| `#approved-videos` | final version ที่ approve แล้ว |

เวลาสร้างงานใหม่ bot จะพยายามสร้าง thread ใต้ `#ai-video-pipeline`
เพื่อให้หนึ่ง thread เท่ากับหนึ่ง project และกันปัญหาข้อมูลกระจาย

## 2. Slash Commands

| Command | ใช้ทำอะไร |
| --- | --- |
| `/new-video-project title: brief:` | สร้างโปรเจ็กต์ใหม่และ thread สำหรับงานนั้น |
| `/set-stage stage:` | เปลี่ยนสถานะ เช่น `idea` -> `storyboard` -> `render` |
| `/attach-asset asset_type: url:` | บันทึกลิงก์ไฟล์, prompt, reference, storyboard, video |
| `/cost amount: unit:` | บันทึก credit/token/cost ที่ใช้ |
| `/credits amount:` | alias ของ `/cost` โดย unit เป็น `credits` |
| `/approve final_url:` | approve final version, ส่งเข้า approved channel และ lock thread |
| `/video-status` | ดู metadata, assets และ cost totals |
| `/setup-video-channels` | สร้าง category และ channel layout แบบ Notion Teamspace |
| `/project-template` | ส่งข้อความ dashboard/template ลง channel ปัจจุบัน |
| `/link-notion url:` | ผูก Notion page เข้ากับ project |
| `/link-drive url:` | ผูก Drive/S3/R2/Dropbox folder เข้ากับ project |

ถ้าใช้คำสั่งใน project thread ไม่ต้องใส่ `project_id`
ถ้าใช้จาก channel อื่นให้ใส่ `project_id` เช่น `vid-20260514-143000-my-video`

## 3. Storage / Database

SQLite จะเก็บ:

- `video_projects`: project key, title, brief, stage, owner, thread id, final url, approval
- `video_assets`: prompt/reference/image/storyboard/video/final links
- `video_costs`: credits/tokens/money usage แยกตาม unit และ tool
- `video_events`: event log ของโปรเจ็กต์

ไฟล์จริงยังควรเก็บใน Drive/S3/R2/Dropbox แล้วเอาลิงก์มาใส่ผ่าน `/attach-asset`
เพื่อกันปัญหาไฟล์หายหรือไม่รู้ว่า final ตัวไหน

## ตั้งค่า .env

```env
VIDEO_PIPELINE_DB_PATH=data/video_pipeline.sqlite3
VIDEO_MASTER_CHANNEL_ID=123456789012345678
VIDEO_APPROVED_CHANNEL_ID=123456789012345678

VIDEO_STAGE_IDEA_CHANNEL_ID=123456789012345678
VIDEO_STAGE_IMAGE_GEN_CHANNEL_ID=123456789012345678
VIDEO_STAGE_STORYBOARD_CHANNEL_ID=123456789012345678
VIDEO_STAGE_RENDER_CHANNEL_ID=123456789012345678
VIDEO_STAGE_REVIEW_CHANNEL_ID=123456789012345678
VIDEO_STAGE_EDITS_CHANNEL_ID=123456789012345678
VIDEO_STAGE_APPROVED_CHANNEL_ID=123456789012345678

VIDEO_PIPELINE_WEBHOOK_URL=https://example.com/video-pipeline-webhook
```

ถ้ายังไม่อยากแยก channel ตาม stage ให้ตั้งแค่ `VIDEO_MASTER_CHANNEL_ID`
และ `VIDEO_APPROVED_CHANNEL_ID` ก่อนก็พอ

## สร้าง Channel Layout อัตโนมัติ

ใช้คำสั่งนี้ใน Discord server:

```text
/setup-video-channels
```

bot จะสร้าง category `AI VIDEO TEAMSPACE` พร้อม channels:

```text
#00-ai-video-home
#01-video-ideas
#02-image-gen
#03-storyboard
#04-video-render
#05-video-review
#06-video-edits
#07-approved-videos
#08-asset-library
#09-prompt-library
#10-cost-tracker
#11-notion-sync-log
```

หลังสร้างเสร็จ bot จะส่งค่า channel IDs กลับมาเป็น block `.env`
ให้คัดลอกไปใส่ในไฟล์ `.env` เพื่อให้คำสั่ง `/new-video-project`, `/set-stage`
และ `/approve` ส่งข้อมูลไป channel ที่ถูกต้องแบบถาวร

ถ้าต้องการส่ง dashboard template เข้า channel เดิมอีกครั้ง ใช้:

```text
/project-template
```

## ตัวอย่าง Flow

```text
/new-video-project title:Temple Product Launch brief:30s cinematic launch video for herbal drink
/attach-asset asset_type:prompt url:https://docs.google.com/... prompt:golden temple, product hero, cinematic
/link-notion url:https://www.notion.so/...
/link-drive url:https://drive.google.com/...
/set-stage stage:image_gen note:Prompt ready for image generation
/attach-asset asset_type:image url:https://drive.google.com/...
/set-stage stage:storyboard
/attach-asset asset_type:storyboard url:https://drive.google.com/...
/cost amount:240 unit:credits tool:Runway
/set-stage stage:review
/attach-asset asset_type:final url:https://drive.google.com/final.mp4
/approve
```

## Channel Pin Template

```text
AI Video Pipeline

1 thread = 1 video project

/new-video-project - create project
/set-stage - update stage
/attach-asset - save prompt/file/final link
/cost or /credits - log usage
/approve - lock final version
/video-status - inspect project metadata

Stages:
idea -> image_gen -> storyboard -> render -> review -> edits -> approved
```
