# 📿 Amulet Statistics Hub - Google Drive Integration Setup Guide

## Prerequisites
- Node.js 16+ installed
- npm or yarn
- Google Cloud Platform project
- Google Drive account

## Step 1: Google Cloud Project Setup

### 1.1 Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project named "Amulet Hub"
3. Enable these APIs:
   - Google Drive API
   - Google Sheets API

### 1.2 Create Service Account Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **Service Account**
3. Fill in the details:
   - Service account name: `amulet-app`
   - Click **Create and Continue**
   - Grant **Editor** role → **Continue**
   - Click **Done**

### 1.3 Generate JSON Key
1. Go to the service account you just created
2. Click on **Keys** tab
3. Click **Add Key** → **Create new key**
4. Select **JSON** and click **Create**
5. Save the downloaded file as `credentials.json` in your project root

## Step 2: Set Up Google Drive Structure

### 2.1 Create Main Spreadsheet
1. Go to [Google Drive](https://drive.google.com)
2. Create a new Google Sheet named "Amulet Data Hub"
3. Create these sheets (tabs):
   - **Amulets** - Main amulet data
   - **Admins** - Admin statistics
   - **LineLogs** - LINE check-in/out logs
   - **FacebookPosts** - Facebook post data
   - **TikTokPosts** - TikTok post data

### 2.2 Add Column Headers

#### Amulets Sheet
```
ID | Name | Type | Popularity | Posts | Likes | Shares | Trend | Image URL
1  | พระสมเด็จวัดระฆัง | พระสมเด็จ | 98 | 1250 | 45000 | 8900 | up | https://...
```

#### Admins Sheet
```
ID | Name | Avatar URL | Daily | Weekly | Monthly | Performance
a1 | แอดมิน สมชาย | https://... | 45 | 280 | 1150 | 95
```

#### LineLogs Sheet
```
ID | UserName | Action | Timestamp | GroupName
l1 | Somchai A. | check-in | 2024-04-15 08:30 | ชมรมพระเครื่องภาคกลาง
```

#### FacebookPosts Sheet
```
ID | Content | Link | Engagement | Timestamp
fb-1 | โพสต์เกี่ยวกับพระ... | https://facebook.com/... | 5000 | 2024-04-15 14:20
```

#### TikTokPosts Sheet
```
ID | Content | Link | Engagement | Timestamp
tt-1 | วิดีโอรีวิวพระ... | https://tiktok.com/... | 20000 | 2024-04-15 16:45
```

### 2.3 Get Spreadsheet ID
1. Open your spreadsheet
2. Copy the ID from the URL: `https://docs.google.com/spreadsheets/d/{ID}/edit`

### 2.4 Create Folder for Videos
1. Create a folder in Google Drive named "Amulet Videos"
2. Upload your videos there
3. Copy the folder ID from the URL: `https://drive.google.com/drive/folders/{FOLDER_ID}`

## Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in:
   ```env
   REACT_APP_API_URL=http://localhost:5000/api
   PORT=5000
   AMULETS_SHEET_ID=your-spreadsheet-id-here
   VIDEOS_FOLDER_ID=your-videos-folder-id-here
   ```

## Step 4: Install Dependencies

```bash
npm install
```

## Step 5: Run the Application

### Development Mode (Frontend Only)
```bash
npm run dev
```
Visit: `http://localhost:3000`

### Development Mode (Frontend + Backend)
```bash
npm run dev:all
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000/api`

### Build for Production
```bash
npm run build
npm run build:server
npm start
```

## Step 6: Share Spreadsheet with Service Account

1. Get the service account email from `credentials.json` (field: `client_email`)
2. Open your "Amulet Data Hub" spreadsheet
3. Click **Share** → Paste the service account email → **Editor** → **Share**
4. Do the same for the Videos folder

## API Endpoints

Once the backend is running, you can access:

- `GET /api/health` - Server health check
- `GET /api/amulets` - List all amulets
- `GET /api/admins` - List admin statistics
- `GET /api/videos` - List videos from Google Drive
- `GET /api/line-logs` - List LINE logs
- `GET /api/facebook-posts` - List Facebook posts
- `GET /api/tiktok-posts` - List TikTok posts

## Troubleshooting

### Error: "Google credentials not found"
- Make sure `credentials.json` is in the project root
- Check the file path in server/googleDriveService.ts

### Error: "Permission denied"
- Share the spreadsheet with the service account email
- Make sure the service account has "Editor" permission

### Error: "Sheet not found"
- Verify the sheet names match exactly (case-sensitive)
- Ensure the AMULETS_SHEET_ID is correct

### API returns empty data
- Check if the sheets have data starting from row 2 (row 1 is headers)
- Verify the column order matches the expected format

## Features Implemented

✅ Google Drive Spreadsheet integration  
✅ Google Drive video folder sync  
✅ Real-time data caching (5-minute TTL)  
✅ REST API backend  
✅ CORS enabled for frontend  
✅ Error handling and fallbacks  
✅ Health check endpoint  

## Next Steps

1. Add more data to your Google Sheets
2. Customize the data range queries in server/index.ts
3. Add authentication for editing data
4. Implement real-time updates with WebSockets
5. Deploy to production (Heroku, Vercel, etc.)
