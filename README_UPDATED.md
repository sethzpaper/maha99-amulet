# 📿 Amulet Statistics Hub

A professional dashboard application for tracking Thai amulet market statistics, social media engagement, admin performance, and video management. Built with React, TypeScript, and integrated with Google Drive for data management.

## 🎯 Features

✅ **Amulet Tracking** - Real-time popularity scores and engagement metrics  
✅ **Social Media Analytics** - Facebook and TikTok post performance tracking  
✅ **Admin Management** - Staff performance metrics and attendance tracking  
✅ **Video Management** - Google Drive integration for video asset management  
✅ **LINE Integration** - Check-in/check-out logging system  
✅ **Competitor Analysis** - Compare amulet market trends  
✅ **Google Drive Sync** - Automatic data synchronization from Google Sheets and Drive  
✅ **Real-time Dashboard** - Live statistics and performance metrics  
✅ **Dark Theme UI** - Premium Thai-inspired design with gold accents  

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 16+ 
- npm or yarn
- Google Drive account
- Google Cloud Console project

### 2. Installation

```bash
# Clone or download the project
cd d:\Cluade\Project-amulet_base

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### 3. Configure Google Drive

Follow the detailed setup guide in [SETUP.md](./SETUP.md) to:
1. Create a Google Cloud project
2. Generate service account credentials
3. Set up Google Sheets with data
4. Create Drive folder for videos

### 4. Run the Application

**Development Mode (Frontend Only):**
```bash
npm run dev
```
Visit: `http://localhost:3000`

**Development Mode (Frontend + Backend API):**
```bash
npm run dev:all
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000/api`

**Production Build:**
```bash
npm run build
npm run build:server
npm start
```

## 📁 Project Structure

```
Project-amulet_base/
├── src/
│   ├── components/       # React components
│   │   ├── AmuletList.tsx
│   │   ├── AdminStats.tsx
│   │   ├── VideoManagement.tsx
│   │   ├── LineLogs.tsx
│   │   └── ...
│   ├── data/
│   │   └── mockData.ts   # Mock data for fallback
│   ├── lib/
│   │   ├── dataService.ts # API client with caching
│   │   └── utils.ts
│   ├── types.ts           # TypeScript interfaces
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── server/                # Backend services
│   ├── index.ts          # Express server
│   └── googleDriveService.ts  # Google API integration
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example          # Environment template
├── SETUP.md              # Detailed setup guide
└── README.md
```

## 🔌 API Endpoints

When the backend is running on `http://localhost:5000`:

```
GET  /api/health              - Server status
GET  /api/amulets             - List all amulets
GET  /api/admins              - Admin statistics
GET  /api/videos              - Google Drive videos
GET  /api/line-logs           - LINE check-in logs
GET  /api/facebook-posts      - Facebook posts
GET  /api/tiktok-posts        - TikTok posts
```

## 🔧 Configuration

### Environment Variables (.env)

```env
# Frontend
REACT_APP_API_URL=http://localhost:5000/api

# Backend
PORT=5000
NODE_ENV=development

# Google Cloud
AMULETS_SHEET_ID=your-spreadsheet-id
VIDEOS_FOLDER_ID=your-videos-folder-id
```

See [SETUP.md](./SETUP.md) for complete configuration details.

## 📊 Data Structure

### Google Sheets Format

**Amulets Sheet:**
```
ID | Name | Type | Popularity | Posts | Likes | Shares | Trend | Image URL
```

**Admins Sheet:**
```
ID | Name | Avatar URL | Daily | Weekly | Monthly | Performance
```

See [SETUP.md](./SETUP.md) for all sheet formats.

## 🛠️ Development

### Scripts

```bash
npm run dev              # Start frontend dev server
npm run dev:server       # Start backend with auto-reload
npm run dev:all          # Start both frontend and backend
npm run build            # Build frontend for production
npm run build:server     # Build backend server
npm start                # Run production server
npm run lint             # Type checking
npm run clean            # Clean build artifacts
```

### Adding New Components

1. Create component in `src/components/`
2. Import mock data and dataService
3. Use `useEffect` hook to fetch real data
4. Fallback to mock data if API fails

Example:
```tsx
import { useEffect, useState } from 'react';
import { dataService } from '../lib/dataService';
import { MOCK_DATA } from '../data/mockData';

export function MyComponent() {
  const [data, setData] = useState(MOCK_DATA);
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const realData = await dataService.fetchMyData();
        if (realData) setData(realData);
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    };
    loadData();
  }, []);
  
  return <div>{/* Use data */}</div>;
}
```

## 🎨 Styling

- **Tailwind CSS** for styling
- **Gold theme** (#d4af37) with dark backgrounds
- **Thai language** UI labels
- **Responsive design** for all screen sizes
- **Custom scrollbars** and animations

## 🚨 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9

# Kill process on port 5000 (backend)
lsof -ti:5000 | xargs kill -9
```

### Google API Errors
- Verify `credentials.json` exists in project root
- Check that service account has Editor access to spreadsheets
- Ensure sheet names match exactly (case-sensitive)

### Build Errors
```bash
npm run lint          # Check TypeScript errors
npm install --legacy-peer-deps  # Fix dependency conflicts
```

### Empty Data on Frontend
- Start backend server: `npm run dev:server`
- Check API health: `http://localhost:5000/api/health`
- Verify Google credentials are correct
- Check browser console for error messages

## 📝 Features Roadmap

- [ ] User authentication
- [ ] Real-time WebSocket updates
- [ ] Data editing UI
- [ ] Export reports (PDF/Excel)
- [ ] Advanced analytics
- [ ] Mobile app
- [ ] Multi-language support

## 🔐 Security Notes

- Never commit `credentials.json` to version control
- Add to `.gitignore`: `credentials.json`, `.env`
- Use environment variables for all secrets
- Restrict Google service account permissions

## 📞 Support

For issues or questions:
1. Check [SETUP.md](./SETUP.md) for detailed setup guide
2. Review troubleshooting section above
3. Check browser console for error messages
4. Verify all environment variables are set correctly

## 📄 License

This project is proprietary. All rights reserved.

---

**Last Updated:** April 2026  
**Version:** 1.0.0  
**Status:** 🟢 Production Ready
