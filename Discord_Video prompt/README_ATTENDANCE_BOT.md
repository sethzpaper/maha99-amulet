# Discord Time Tracking Bot

ระบบลงเวลาด้วย Discord Bot สำหรับทีมที่ต้องการใช้คำสั่ง slash command ในห้อง `#attendance`
และบันทึกข้อมูลลง SQLite พร้อมส่ง log ไปยัง `#attendance-log` หรือ webhook ภายนอกได้

## การคำนวณค่าแรง

- ไม่มีการหักเวลาพัก
- ค่าแรงมาตรฐานเริ่มต้น `400 บาท/วัน`
- นับค่าแรงเมื่อวันนั้นมีทั้ง clock-in และ clock-out ครบ
- วันที่ clock-in แล้วไม่ clock-out จะแสดงเป็น `incomplete` และยังไม่นับค่าแรง
- พนักงานอ้างอิงด้วย Discord user ID ส่วนชื่อ Discord ใช้เป็นชื่อแสดงผลและอัปเดตอัตโนมัติ
- ผู้ดูแลสามารถแก้ค่าแรงรายวันของแต่ละคนจากหน้าเว็บหลังบ้าน

## คำสั่งที่มี

| Command | ใช้ทำอะไร |
| --- | --- |
| `/clockin` | ลงเวลาเข้างาน |
| `/clockout` | ลงเวลาออกงาน และสรุปชั่วโมงวันนี้ |
| `/status` | เช็คสถานะวันนี้ |
| `/summary` | สร้างรายงานสรุปรายเดือนเป็น PDF |
| `/absent reason:` | ลางานพร้อมเหตุผล |
| `/wfh` | แจ้งทำงานจากบ้าน |
| `/late reason:` | แจ้งสาเหตุมาสาย |
| `/holidaycoming` | placeholder สำหรับเชื่อมปฏิทินวันหยุดภายหลัง |

> หมายเหตุ: Discord slash command ต้องเป็นตัวพิมพ์เล็กทั้งหมด จึงใช้ `/holidaycoming`
> แทนชื่อแนว camelCase อย่าง `/holidayComing`

## ติดตั้ง

```bash
pip install -r requirements.txt
copy .env.example .env
```

แก้ค่าใน `.env` อย่างน้อย:

```env
DISCORD_TOKEN=your_discord_bot_token
TIMEZONE=Asia/Bangkok
DATABASE_BACKEND=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=server-only-key
ATTENDANCE_DB_PATH=runtime/attendance.sqlite3
ATTENDANCE_DEFAULT_DAILY_RATE=400
```

ถ้าต้องการจำกัดคำสั่งเฉพาะห้อง `#attendance` ให้ใส่ channel id:

```env
ATTENDANCE_CHANNEL_ID=123456789012345678
ATTENDANCE_LOG_CHANNEL_ID=123456789012345678
```

ถ้าต้องการส่งต่อไป HR database, automation, หรือ Notion bridge:

```env
ATTENDANCE_WEBHOOK_URL=https://example.com/webhook
```

## รันบอท

```bash
python bot.py
```

## เว็บหลังบ้าน Worktime

ตั้งค่าใน `.env`:

```env
ATTENDANCE_DB_PATH=runtime/attendance.sqlite3
ATTENDANCE_DEFAULT_DAILY_RATE=400
ADMIN_WEB_HOST=127.0.0.1
ADMIN_WEB_PORT=8080
ADMIN_WEB_TOKEN=ตั้งรหัสลับที่ยาวและเดายาก
```

รันเว็บ:

```powershell
.\.python-3.12.4\python.exe admin_web.py
```

เปิด:

```text
http://127.0.0.1:8080/?token=รหัสจาก ADMIN_WEB_TOKEN
```

หน้าเว็บแสดง Discord user ID, ชื่อ Discord และค่าแรงรายวัน พร้อมช่องแก้ไขและปุ่ม Save
ไฟล์ `.env` และ URL ที่มี token ห้ามส่งลง channel สาธารณะ

ครั้งแรก slash commands อาจใช้เวลาสักพักถ้า sync แบบ global
ระหว่างพัฒนาแนะนำใส่ `DISCORD_GUILD_ID` เพื่อ sync เฉพาะ server แล้วคำสั่งจะขึ้นเร็วกว่า

## โครงสร้างข้อมูล

ข้อมูลถูกเก็บใน SQLite ที่ `ATTENDANCE_DB_PATH` โดยมีหนึ่ง record ต่อผู้ใช้ต่อวัน:

- `user_id`
- `user_name`
- `work_date`
- `clock_in`
- `clock_out`
- `status`: `working`, `completed`, `absent`, `wfh`, `late`
- `reason`

ตาราง `attendance_employees` เก็บ:

- `user_id`: Discord user ID
- `user_name`: ชื่อ Discord ล่าสุด
- `daily_rate`: ค่าแรงรายวัน เริ่มต้น 400 บาท

## Workflow ที่แนะนำใน Discord

1. สร้างห้อง `#attendance` สำหรับพนักงาน
2. สร้างห้อง `#attendance-log` สำหรับ admin หรือระบบ automation
3. ตั้งสิทธิ์ให้เฉพาะทีมเข้าใช้งาน
4. Pin ข้อความอธิบายคำสั่ง
5. ตั้งค่า `ATTENDANCE_CHANNEL_ID` และ `ATTENDANCE_LOG_CHANNEL_ID` ใน `.env`
6. รัน `python bot.py`

## ตัวอย่างข้อความ pin ใน #attendance

```text
ระบบลงเวลา

/clockin - ลงเวลาเข้างาน
/clockout - ลงเวลาออกงาน
/status - เช็คสถานะวันนี้
/summary - ขอรายงานสรุปรายเดือน
/absent reason:... - ลางานพร้อมเหตุผล
/wfh - แจ้งทำงานจากบ้าน
/late reason:... - แจ้งมาสายพร้อมเหตุผล
```
