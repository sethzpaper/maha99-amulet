# Amulet Statistics Dashboard 🏆

ระบบแดชบอร์ดสถิติเครื่องรางและการจัดการข้อมูลผ่าน Google Drive

## 📋 สารบัญ
- [ภาพรวมโครงการ](#ภาพรวมโครงการ)
- [ฟีเจอร์หลัก](#ฟีเจอร์หลัก)
- [อัปเดตล่าสุด](#อัปเดตล่าสุด)
- [ติดตั้งและรันโปรแกรม](#ติดตั้งและรันโปรแกรม)
- [โครงสร้างโปรเจค](#โครงสร้างโปรเจค)
- [การตั้งค่า Google Drive](#การตั้งค่า-google-drive)

## 📊 ภาพรวมโครงการ

โปรเจคนี้เป็น **Dashboard สถิติเครื่องรางอย่างครบถ้วน** ที่มีการเชื่อมต่อกับ Google Drive เพื่อจัดเก็บและแสดงข้อมูลแบบเรียลไทม์

### เทคโนโลยีที่ใช้
- **Frontend**: React 19 + TypeScript 5.8 + Tailwind CSS 4
- **Build Tool**: Vite 6.2.0
- **Backend**: Express.js 4.21.2
- **API**: Google Drive & Google Sheets
- **State Management**: Zustand 4.x
- **UI Components**: lucide-react, Motion Animations

## 🎯 ฟีเจอร์หลัก

### ✅ ระบบการตรวจสอบสิทธิ์ (Authentication)
- ระบบ Super Admin: ชื่อผู้ใช้ `admin` รหัสผ่าน `11221122`
- **GitHub OAuth**: เข้าสู่ระบบด้วยบัญชี GitHub และได้รับสิทธิ์ admin โดยตรง
- **Admin GitHub IDs**: กำหนด GitHub usernames ที่ได้รับสิทธิ์ admin ผ่าน environment variable
- บันทึกการเข้าสู่ระบบไว้ในที่จัดเก็บ localStorage
- ล็อกเอาต์พร้อมการยืนยัน
- แสดงข้อมูลผู้ใช้และระดับสิทธิ์ในส่วนหัวของหน้า

### ✅ การจัดการข้อมูลเครื่องราง
- แสดงรายชื่อเครื่องรางยอดนิยมพร้อมสถิติการมีส่วนร่วม
- ดึงข้อมูลจาก Google Sheets ผ่าน API
- พร้อมระบบสำรองข้อมูล (Mock Data)

### ✅ สถิติแอดมิน
- แสดงการจัดอันดับการทำงานของแอดมิน
- แอดมินอันดับ 1 ของเดือน
- ตารางสรุปสถิติทั้งหมด
- สถานะการปฏิบัติงานแบบเรียลไทม์

### ✅ จัดการวิดีโอและโพสต์
- ดึงข้อมูลจาก Google Drive
- แสดง Facebook Posts และ TikTok Posts
- เก็บประวัติการโพสต์

### ✅ บันทึก LINE Check-in/Check-out
- ติดตามการเข้า-ออกของพนักงาน
- แสดงประวัติการเข้าปฏิบัติงาน

## 🚀 อัปเดตล่าสุด

### รวม ✨
1. **Google Drive Integration** - เชื่อมต่อ API เพื่อดึงข้อมูลจากสเปรดชีตและไฟล์
2. **Backend API Server** - Express.js ที่มี 7 Endpoint สำหรับจัดเก็บและดึงข้อมูล
3. **Frontend Data Service** - บริการดึงข้อมูลกลางพร้อมระบบแคช (5 นาที)
4. **Zustand Auth Store** - ระบบการตรวจสอบสิทธิ์พร้อมการจำข้อมูลการเข้าสู่ระบบ
5. **Login Component** - UI สำหรับเข้าสู่ระบบที่ออกแบบอย่างสวยงาม
6. **Component Integration** - อัปเดตทั้ง AmuletList, AdminStats, VideoManagement, LineLogs
7. **App-level Auth** - ตรวจสอบสิทธิ์ก่อนแสดงแดชบอร์ด

### Endpoint ของ API ✅
```
GET /api/health              - ตรวจสอบสถานะเซิร์ฟเวอร์
GET /api/amulets            - ดึงข้อมูลเครื่องราง
GET /api/admins             - ดึงสถิติแอดมิน
GET /api/videos             - ดึงรายชื่อวิดีโอ
GET /api/line-logs          - ดึงบันทึก LINE
GET /api/facebook-posts     - ดึงโพสต์ Facebook
GET /api/tiktok-posts       - ดึงโพสต์ TikTok
```

## 💻 ติดตั้งและรันโปรแกรม

### ข้อกำหนดเบื้องต้น
- Node.js 18+ และ npm 9+
- Google Cloud Project ที่มี API enabled
- ไฟล์ `credentials.json` จาก Google Cloud

### ขั้นตอนการติดตั้ง

1. **ติดตั้ง Dependencies**
```bash
npm install --legacy-peer-deps
```

2. **ตั้งค่าตัวแปรสภาพแวดล้อม**
```bash
# สำเนาไฟล์ตัวอย่าง
cp .env.example .env.local

# เพิ่มข้อมูลตามต้องการ
# REACT_APP_API_URL=http://localhost:5000/api
# PORT=5000
# AMULETS_SHEET_ID=your_sheet_id_here
# VIDEOS_FOLDER_ID=your_folder_id_here

# สำหรับ GitHub Admin Authentication
# VITE_SUPABASE_URL=https://your-project-ref.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-public-key
# VITE_ADMIN_GITHUB_IDS=github_username1,github_username2
```

3. **เพิ่มไฟล์ Google Credentials**
- วางไฟล์ `credentials.json` ในโฟลเดอร์ `server/`

4. **รันโปรแกรม**

**โหมดพัฒนา (Development)**
```bash
npm run dev:all
```
จะเปิด:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000/api

**โหมดเดี่ยว**
```bash
# เฉพาะ Frontend
npm run dev

# เฉพาะ Backend
npm run dev:server
```

## 📁 โครงสร้างโปรเจค

```
Project-amulet_base/
├── src/
│   ├── components/
│   │   ├── AdminStats.tsx          - สถิติแอดมิน
│   │   ├── AmuletList.tsx          - รายชื่อเครื่องราง
│   │   ├── AmuletChart.tsx         - กราฟสถิติ
│   │   ├── VideoManagement.tsx     - จัดการวิดีโอ
│   │   ├── LineLogs.tsx            - บันทึก LINE
│   │   ├── FacebookPosts.tsx       - โพสต์ Facebook
│   │   ├── TikTokPosts.tsx         - โพสต์ TikTok
│   │   ├── Login.tsx               - ฟอร์มเข้าสู่ระบบ
│   │   └── Settings.tsx            - ตั้งค่า
│   ├── lib/
│   │   ├── dataService.ts          - บริการดึงข้อมูล
│   │   ├── authStore.ts            - Zustand Auth Store
│   │   └── utils.ts                - ฟังก์ชันช่วยเหลือ
│   ├── data/
│   │   └── mockData.ts             - ข้อมูลทดสอบ
│   ├── App.tsx                     - คอมโพเนนต์หลัก
│   ├── main.tsx                    - Entry point
│   └── types.ts                    - Type definitions
├── server/
│   ├── index.ts                    - Express API Server
│   ├── googleDriveService.ts       - Google Drive API Service
│   └── credentials.json            - Google Service Account (ต้องเพิ่ม)
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

## 🔐 การตั้งค่า Google Drive

### ขั้นตอนการตั้งค่า

1. **สร้าง Google Cloud Project**
   - ไปที่ https://console.cloud.google.com
   - สร้าง Project ใหม่

2. **เปิดใช้งาน APIs**
   - Google Drive API
   - Google Sheets API

3. **สร้าง Service Account**
   - ไปที่ Credentials
   - สร้าง Service Account
   - ดาวน์โหลด JSON Key เป็น `credentials.json`

4. **สร้างโครงสร้างใน Google Drive**
   - Folder หลัก: "Amulet Data"
   - Spreadsheet: "Amulet Statistics"
   - Folder สำหรับวิดีโอ: "Videos"

5. **เพิ่ม IDs ในไฟล์ `.env.local`**
   - Sheet ID จาก URL ของ Spreadsheet
   - Folder ID จากโฟลเดอร์วิดีโอ

## 👤 ข้อมูลเข้าสู่ระบบ Demo

```
ชื่อผู้ใช้: admin
รหัสผ่าน: 11221122
บทบาท: Super Admin
```

## 🐛 การแก้ไขข้อบกพร่อง

### ปัญหาทั่วไป

**ไม่สามารถ npm install ได้**
```bash
npm install --legacy-peer-deps
```

**ข้อผิดพลาด Type TypeScript**
```bash
npm run lint
```

**ล้มเหลวในการดึงข้อมูล**
- ตรวจสอบว่า `credentials.json` อยู่ในโฟลเดอร์ `server/`
- ยืนยันว่า Google APIs เปิดใช้งาน
- ตรวจสอบค่า `.env.local`

## 📞 การติดต่อ

สำหรับคำถามหรือปัญหา โปรดติดต่อทีมพัฒนา
