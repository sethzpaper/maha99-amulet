import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  getSpreadsheetData,
  listDriveFiles,
  getFileDownloadUrl,
} from './googleDriveService';
import {
  Amulet,
  LineLog,
  SocialPost,
  AdminStats,
  VideoRecord,
  DailyStat,
} from '../src/types';
import { initScheduler, getScheduler } from './services/schedulerService';
import { initOpenAI, getOpenAI } from './services/openaiService';
import { initEmailTransporter } from './services/emailService';
import attendanceRoutes from './routes/attendanceRoutes';
import employeeRoutes from './routes/employeeRoutes';
import socialAccountsRoutes from './routes/socialAccountsRoutes';
import type { CompetitorAccount } from './scrapers/competitorScraper';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Attendance & Leave Management
app.use('/api/attendance', attendanceRoutes);
app.use('/api', attendanceRoutes); // เพื่อให้ /api/leave/* ใช้ได้ด้วย
app.use('/api/employees', employeeRoutes);
app.use('/api/tracked-accounts', socialAccountsRoutes);

// Get Amulets from Google Sheets
app.get('/api/amulets', async (req: Request, res: Response) => {
  try {
    const spreadsheetId = process.env.AMULETS_SHEET_ID;
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'AMULETS_SHEET_ID not configured' });
    }

    const data = await getSpreadsheetData(spreadsheetId, 'Amulets!A2:H100');
    
    const amulets: Amulet[] = data.map((row: string[]) => ({
      id: row[0] || '',
      name: row[1] || '',
      type: row[2] || '',
      popularity: parseInt(row[3]) || 0,
      posts: parseInt(row[4]) || 0,
      likes: parseInt(row[5]) || 0,
      shares: parseInt(row[6]) || 0,
      trend: (row[7] || 'stable') as 'up' | 'down' | 'stable',
      image: row[8] || 'https://picsum.photos/seed/amulet/400/400',
    })).filter(a => a.id);

    res.json(amulets);
  } catch (error) {
    console.error('Error fetching amulets:', error);
    res.status(500).json({ error: 'Failed to fetch amulets' });
  }
});

// Get Admin Stats from Google Sheets
app.get('/api/admins', async (req: Request, res: Response) => {
  try {
    const spreadsheetId = process.env.AMULETS_SHEET_ID;
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'AMULETS_SHEET_ID not configured' });
    }

    const data = await getSpreadsheetData(spreadsheetId, 'Admins!A2:G100');
    
    const admins: AdminStats[] = data.map((row: string[]) => ({
      id: row[0] || '',
      name: row[1] || '',
      avatar: row[2] || 'https://picsum.photos/seed/admin/100/100',
      daily: parseInt(row[3]) || 0,
      weekly: parseInt(row[4]) || 0,
      monthly: parseInt(row[5]) || 0,
      performance: parseInt(row[6]) || 0,
    })).filter(a => a.id);

    res.json(admins);
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// Get Videos from Google Drive
app.get('/api/videos', async (req: Request, res: Response) => {
  try {
    const folderId = process.env.VIDEOS_FOLDER_ID;
    if (!folderId) {
      return res.status(400).json({ error: 'VIDEOS_FOLDER_ID not configured' });
    }

    const files = await listDriveFiles(folderId);
    
    const videos: VideoRecord[] = files.map((file: any, index: number) => ({
      id: file.id,
      entryDate: new Date(file.createdTime).toLocaleDateString('th-TH'),
      fileName: file.name,
      productName: file.name.replace(/\.[^.]+$/, ''),
      driveLink: file.webViewLink,
      creator: 'Admin',
      isPostedFB: false,
      isPostedTT: false,
      fbPostDate: '',
      ttPostDate: '',
    }));

    res.json(videos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Get LINE Logs from Google Sheets
app.get('/api/line-logs', async (req: Request, res: Response) => {
  try {
    const spreadsheetId = process.env.AMULETS_SHEET_ID;
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'AMULETS_SHEET_ID not configured' });
    }

    const data = await getSpreadsheetData(spreadsheetId, 'LineLogs!A2:D100');
    
    const logs: LineLog[] = data.map((row: string[]) => ({
      id: row[0] || '',
      userName: row[1] || '',
      action: (row[2] || 'check-in') as 'check-in' | 'check-out',
      timestamp: row[3] || '',
      groupName: row[4] || '',
    })).filter(l => l.id);

    res.json(logs);
  } catch (error) {
    console.error('Error fetching line logs:', error);
    res.status(500).json({ error: 'Failed to fetch line logs' });
  }
});

// Get Facebook Posts from Google Sheets
app.get('/api/facebook-posts', async (req: Request, res: Response) => {
  try {
    const spreadsheetId = process.env.AMULETS_SHEET_ID;
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'AMULETS_SHEET_ID not configured' });
    }

    const data = await getSpreadsheetData(spreadsheetId, 'FacebookPosts!A2:E100');
    
    const posts: SocialPost[] = data.map((row: string[]) => ({
      id: row[0] || '',
      platform: 'facebook' as const,
      content: row[1] || '',
      link: row[2] || '',
      engagement: parseInt(row[3]) || 0,
      timestamp: row[4] || '',
    })).filter(p => p.id);

    res.json(posts);
  } catch (error) {
    console.error('Error fetching facebook posts:', error);
    res.status(500).json({ error: 'Failed to fetch facebook posts' });
  }
});

// Get TikTok Posts from Google Sheets
app.get('/api/tiktok-posts', async (req: Request, res: Response) => {
  try {
    const spreadsheetId = process.env.AMULETS_SHEET_ID;
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'AMULETS_SHEET_ID not configured' });
    }

    const data = await getSpreadsheetData(spreadsheetId, 'TikTokPosts!A2:E100');
    
    const posts: SocialPost[] = data.map((row: string[]) => ({
      id: row[0] || '',
      platform: 'tiktok' as const,
      content: row[1] || '',
      link: row[2] || '',
      engagement: parseInt(row[3]) || 0,
      timestamp: row[4] || '',
    })).filter(p => p.id);

    res.json(posts);
  } catch (error) {
    console.error('Error fetching tiktok posts:', error);
    res.status(500).json({ error: 'Failed to fetch tiktok posts' });
  }
});

// Get Competitor Facebook Posts from Google Sheets
app.get('/api/competitor-facebook', async (req: Request, res: Response) => {
  try {
    const spreadsheetId = process.env.AMULETS_SHEET_ID;
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'AMULETS_SHEET_ID not configured' });
    }

    const data = await getSpreadsheetData(spreadsheetId, 'CompetitorFacebook!A2:E100');
    
    const posts: SocialPost[] = data.map((row: string[]) => ({
      id: row[0] || '',
      platform: 'facebook' as const,
      content: row[1] || '',
      link: row[2] || '',
      engagement: parseInt(row[3]) || 0,
      timestamp: row[4] || '',
    })).filter(p => p.id);

    res.json(posts);
  } catch (error) {
    console.error('Error fetching competitor facebook posts:', error);
    res.status(500).json({ error: 'Failed to fetch competitor facebook posts' });
  }
});

// Get Competitor TikTok Posts from Google Sheets
app.get('/api/competitor-tiktok', async (req: Request, res: Response) => {
  try {
    const spreadsheetId = process.env.AMULETS_SHEET_ID;
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'AMULETS_SHEET_ID not configured' });
    }

    const data = await getSpreadsheetData(spreadsheetId, 'CompetitorTikTok!A2:E100');
    
    const posts: SocialPost[] = data.map((row: string[]) => ({
      id: row[0] || '',
      platform: 'tiktok' as const,
      content: row[1] || '',
      link: row[2] || '',
      engagement: parseInt(row[3]) || 0,
      timestamp: row[4] || '',
    })).filter(p => p.id);

    res.json(posts);
  } catch (error) {
    console.error('Error fetching competitor tiktok posts:', error);
    res.status(500).json({ error: 'Failed to fetch competitor tiktok posts' });
  }
});

// Manual trigger for scraping (for testing)
app.post('/api/scrape-now', async (req: Request, res: Response) => {
  try {
    const scheduler = getScheduler();
    if (!scheduler) {
      return res.status(503).json({ error: 'Scheduler not initialized' });
    }

    console.log('[API] Manual scraping triggered');
    
    // Run scraping in background (don't wait for completion)
    scheduler.runImmediately().catch(error => {
      console.error('[API] Error during manual scraping:', error);
    });

    res.json({ message: 'Scraping started', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error triggering scraping:', error);
    res.status(500).json({ error: 'Failed to trigger scraping' });
  }
});

// Competitor analysis endpoint
app.get('/api/competitor-analysis', async (req: Request, res: Response) => {
  try {
    const openai = getOpenAI();
    if (!openai) {
      return res.status(503).json({ error: 'OpenAI service not initialized. Set OPENAI_API_KEY in .env' });
    }

    const spreadsheetId = process.env.AMULETS_SHEET_ID;
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'AMULETS_SHEET_ID not configured' });
    }

    // Fetch competitor data
    const facebookData = await getSpreadsheetData(spreadsheetId, 'CompetitorFacebook!A2:E100');
    const tikTokData = await getSpreadsheetData(spreadsheetId, 'CompetitorTikTok!A2:E100');

    const facebookPosts: SocialPost[] = facebookData
      .map((row: string[]) => ({
        id: row[0] || '',
        platform: 'facebook' as const,
        content: row[1] || '',
        link: row[2] || '',
        engagement: parseInt(row[3]) || 0,
        timestamp: row[4] || '',
      }))
      .filter(p => p.id);

    const tikTokPosts: SocialPost[] = tikTokData
      .map((row: string[]) => ({
        id: row[0] || '',
        platform: 'tiktok' as const,
        content: row[1] || '',
        link: row[2] || '',
        engagement: parseInt(row[3]) || 0,
        timestamp: row[4] || '',
      }))
      .filter(p => p.id);

    // Analyze both platforms
    const facebookAnalysis = await openai.analyzeCompetitors(facebookPosts, 'Facebook Competitors');
    const tikTokAnalysis = await openai.analyzeCompetitors(tikTokPosts, 'TikTok Competitors');

    res.json({
      facebook: facebookAnalysis,
      tiktok: tikTokAnalysis,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error analyzing competitors:', error);
    res.status(500).json({ error: 'Failed to analyze competitors' });
  }
});

// Error handling middleware
app.use((err: any, req: Request, res: Response) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('📊 API endpoints:');
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/amulets`);
  console.log(`  GET  /api/admins`);
  console.log(`  GET  /api/videos`);
  console.log(`  GET  /api/line-logs`);
  console.log(`  GET  /api/facebook-posts`);
  console.log(`  GET  /api/tiktok-posts`);
  console.log(`  GET  /api/competitor-facebook`);
  console.log(`  GET  /api/competitor-tiktok`);
  console.log(`  POST /api/scrape-now (manual trigger)`);
  console.log(`  GET  /api/competitor-analysis (requires OPENAI_API_KEY)`);

  // Initialize email transporter
  initEmailTransporter();

  // Initialize OpenAI if API key is provided
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    try {
      initOpenAI(openaiApiKey);
      console.log('✅ OpenAI service initialized');
    } catch (error) {
      console.warn('⚠️  OpenAI initialization failed:', error);
    }
  } else {
    console.log('⚠️  OPENAI_API_KEY not set. Competitor analysis will be unavailable.');
  }

  // Initialize scheduler
  const facebookProfileId = process.env.FACEBOOK_PROFILE_ID || '61586041723341';
  const tikTokUsername = process.env.TIKTOK_USERNAME || '@oilymahaniyom999';
  
  // Parse competitor accounts from env if provided
  let competitorAccounts: CompetitorAccount[] = [];
  const competitorsJson = process.env.COMPETITOR_ACCOUNTS;
  if (competitorsJson) {
    try {
      competitorAccounts = JSON.parse(competitorsJson);
      console.log(`✅ Loaded ${competitorAccounts.length} competitor accounts`);
    } catch (error) {
      console.warn('⚠️  Failed to parse COMPETITOR_ACCOUNTS:', error);
    }
  }

  const scheduler = initScheduler({
    facebookProfileId,
    tikTokUsername,
    competitorAccounts,
    cronSchedule: process.env.SCRAPE_CRON || '0 */6 * * *', // Default: every 6 hours
    enabled: process.env.SCRAPER_ENABLED !== 'false',
  });

  scheduler.start();
  console.log('✅ Scraper scheduler initialized');
});
