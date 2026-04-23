import { Amulet, DailyStat, SocialPost, AdminStats, DailyTag, VideoRecord, AttendanceRecord, PriceTrack, GoogleTrend, ActivityLog } from '../types';

export const AMULETS: Amulet[] = [
  { id: '1', name: 'พระสมเด็จวัดระฆัง พิมพ์ใหญ่', type: 'พระสมเด็จ', popularity: 98, posts: 1250, likes: 45000, shares: 8900, trend: 'up', image: 'https://picsum.photos/seed/amulet1/400/400' },
  { id: '2', name: 'หลวงปู่ทวด วัดช้างให้ รุ่นแรก', type: 'หลวงปู่ทวด', popularity: 95, posts: 980, likes: 32000, shares: 5600, trend: 'up', image: 'https://picsum.photos/seed/amulet2/400/400' },
  { id: '3', name: 'พระปิดตาหลวงปู่เอี่ยม วัดสะพานสูง', type: 'พระปิดตา', popularity: 92, posts: 750, likes: 28000, shares: 4200, trend: 'stable', image: 'https://picsum.photos/seed/amulet3/400/400' },
  { id: '4', name: 'เหรียญหลวงพ่อกวย รุ่นแรก', type: 'เหรียญคณาจารย์', popularity: 94, posts: 1100, likes: 39000, shares: 7800, trend: 'up', image: 'https://picsum.photos/seed/amulet4/400/400' },
  { id: '5', name: 'พระกริ่งปวเรศ', type: 'พระกริ่ง', popularity: 89, posts: 450, likes: 15000, shares: 2100, trend: 'stable', image: 'https://picsum.photos/seed/amulet5/400/400' },
  { id: '6', name: 'พระนางพญา พิษณุโลก', type: 'พระเบญจภาคี', popularity: 91, posts: 620, likes: 21000, shares: 3400, trend: 'up', image: 'https://picsum.photos/seed/amulet6/400/400' },
  { id: '7', name: 'พระผงสุพรรณ', type: 'พระเบญจภาคี', popularity: 90, posts: 580, likes: 19500, shares: 2900, trend: 'down', image: 'https://picsum.photos/seed/amulet7/400/400' },
  { id: '8', name: 'พระรอด ลำพูน', type: 'พระเบญจภาคี', popularity: 88, posts: 510, likes: 17000, shares: 2500, trend: 'stable', image: 'https://picsum.photos/seed/amulet8/400/400' },
  { id: '9', name: 'พระซุ้มกอ กำแพงเพชร', type: 'พระเบญจภาคี', popularity: 93, posts: 840, likes: 29000, shares: 4800, trend: 'up', image: 'https://picsum.photos/seed/amulet9/400/400' },
  { id: '10', name: 'หลวงพ่อเงิน วัดบางคลาน', type: 'รูปหล่อ', popularity: 96, posts: 1050, likes: 41000, shares: 7200, trend: 'up', image: 'https://picsum.photos/seed/amulet10/400/400' },
  ...Array.from({ length: 40 }).map((_, i) => ({
    id: (i + 11).toString(),
    name: `พระเครื่องยอดนิยม รายการที่ ${i + 11}`,
    type: ['เหรียญ', 'ผง', 'โลหะ', 'ชิน'][Math.floor(Math.random() * 4)],
    popularity: Math.floor(Math.random() * 40) + 50,
    posts: Math.floor(Math.random() * 500) + 100,
    likes: Math.floor(Math.random() * 10000) + 1000,
    shares: Math.floor(Math.random() * 2000) + 200,
    trend: (['up', 'down', 'stable'] as const)[Math.floor(Math.random() * 3)],
    image: `https://picsum.photos/seed/amulet${i + 11}/400/400`
  }))
];


export const DAILY_STATS: DailyStat[] = [
  { date: 'จันทร์', popularity: 85, mentions: 1200 },
  { date: 'อังคาร', popularity: 88, mentions: 1500 },
  { date: 'พุธ', popularity: 92, mentions: 1800 },
  { date: 'พฤหัสบดี', popularity: 90, mentions: 1600 },
  { date: 'ศุกร์', popularity: 95, mentions: 2200 },
  { date: 'เสาร์', popularity: 98, mentions: 2800 },
  { date: 'อาทิตย์', popularity: 97, mentions: 2500 },
];

export const FACEBOOK_POSTS: SocialPost[] = Array.from({ length: 25 }).map((_, i) => ({
  id: `fb-${i}`,
  platform: 'facebook',
  content: `โพสต์ Facebook เกี่ยวกับพระเครื่องรายการที่ ${i + 1}: ข้อมูลเชิงลึกและการวิเคราะห์ตลาดวันนี้ #พระเครื่อง #สถิติ`,
  link: `https://facebook.com/amulet-post-${i}`,
  engagement: Math.floor(Math.random() * 5000) + 500,
  timestamp: '2024-04-15 14:20'
}));

export const TIKTOK_POSTS: SocialPost[] = Array.from({ length: 25 }).map((_, i) => ({
  id: `tt-${i}`,
  platform: 'tiktok',
  content: `วิดีโอ TikTok รีวิวพระเครื่องยอดนิยม ${i + 1}: เทคนิคการดูพระแท้และราคาตลาดล่าสุด`,
  link: `https://tiktok.com/@amulet-expert/video/${i}`,
  engagement: Math.floor(Math.random() * 20000) + 2000,
  timestamp: '2024-04-15 16:45'
}));

export const ADMIN_STATS: AdminStats[] = [
  { id: 'a1', name: 'แอดมิน สมชาย', avatar: 'https://picsum.photos/seed/admin1/100/100', daily: 45, weekly: 280, monthly: 1150, performance: 95 },
  { id: 'a2', name: 'แอดมิน วิชัย', avatar: 'https://picsum.photos/seed/admin2/100/100', daily: 38, weekly: 245, monthly: 980, performance: 88 },
  { id: 'a3', name: 'แอดมิน อนันต์', avatar: 'https://picsum.photos/seed/admin3/100/100', daily: 52, weekly: 310, monthly: 1240, performance: 98 },
  { id: 'a4', name: 'แอดมิน สมศักดิ์', avatar: 'https://picsum.photos/seed/admin4/100/100', daily: 30, weekly: 210, monthly: 850, performance: 82 },
  { id: 'a5', name: 'แอดมิน มาลี', avatar: 'https://picsum.photos/seed/admin5/100/100', daily: 42, weekly: 275, monthly: 1080, performance: 91 },
];

export const TRENDING_TAGS: DailyTag[] = [
  { tag: '#พระสมเด็จ', count: 1250, trend: 'up' },
  { tag: '#หลวงปู่ทวด', count: 980, trend: 'up' },
  { tag: '#พระแท้', count: 850, trend: 'stable' }, 
  { tag: '#ตลาดพระเครื่อง', count: 720, trend: 'down' },
  { tag: '#เช่าพระ', count: 650, trend: 'up' },
];

export const VIDEO_RECORDS: VideoRecord[] = [
  { id: 'v1', entryDate: '15/04/2024', fileName: 'somdej_review_01.mp4', productName: 'พระสมเด็จวัดระฆัง', driveLink: 'https://drive.google.com/share/v1', creator: 'แอดมิน สมชาย', isPostedFB: true, isPostedTT: true, fbPostDate: '15/04/2024 14:00', ttPostDate: '15/04/2024 16:00' },
  { id: 'v2', entryDate: '16/04/2024', fileName: 'lp_thuad_05.mp4', productName: 'หลวงปู่ทวด วัดช้างให้', driveLink: 'https://drive.google.com/share/v2', creator: 'แอดมิน วิชัย', isPostedFB: false, isPostedTT: false },
];

export const ATTENDANCE_RECORDS: AttendanceRecord[] = [
  { id: 'att1', adminId: 'a1', adminName: 'แอดมิน สมชาย', date: '15/04/2024', checkIn: '08:30', checkOut: '19:45', totalHours: 11.25, overtime: '2h 15m', status: 'out' },
  { id: 'att2', adminId: 'a2', adminName: 'แอดมิน วิชัย', date: '15/04/2024', checkIn: '13:15', checkOut: '22:15', totalHours: 9, overtime: '0h 0m', status: 'late' },
];

export const PRICE_HISTORY: PriceTrack[] = [
  { date: '01/04', amuletName: 'พระสมเด็จ', price: 500000 },
  { date: '05/04', amuletName: 'พระสมเด็จ', price: 520000 },
  { date: '10/04', amuletName: 'พระสมเด็จ', price: 550000 },
  { date: '15/04', amuletName: 'พระสมเด็จ', price: 580000 },
];

export const GOOGLE_TRENDS: GoogleTrend[] = [
  { keyword: 'พระสมเด็จวัดระฆัง', searchVolume: 125000, growth: '+25%' },
  { keyword: 'หลวงพ่อรวย รุ่นสรงน้ำ', searchVolume: 89000, growth: '+40%' },
  { keyword: 'ตะกรุดดอกไม้ทอง', searchVolume: 45000, growth: '+15%' },
  { keyword: 'ไอ้ไข่ วัดเจดีย์', searchVolume: 110000, growth: '-5%' },
];

export const ACTIVITY_LOGS: ActivityLog[] = [
  { id: 'log1', user: 'Super Admin', action: 'แก้ไขข้อมูลวิดีโอ', details: 'เปลี่ยนชื่อไฟล์ v1 เป็น somdej_hq.mp4', timestamp: '2024-04-16 10:30', type: 'update' },
  { id: 'log2', user: 'แอดมิน สมชาย', action: 'เพิ่มรายการวิดีโอ', details: 'เพิ่มไฟล์ luang_phor_02.mp4', timestamp: '2024-04-16 11:20', type: 'create' },
  { id: 'log3', user: 'System', action: 'Auto-Leave', details: 'แอดมิน อนันต์ ไม่ลงเวลาเช็คอิน', timestamp: '2024-04-16 12:01', type: 'system' },
];

export const RECOMMENDED_TAGS: DailyTag[] = [
  { tag: '#พระเครื่องไทย', count: 5000, trend: 'up' },
  { tag: '#มหานิยม99', count: 3200, trend: 'up' },
  { tag: '#พระสมเด็จ', count: 2800, trend: 'down' },
  { tag: '#amuletthailand', count: 4500, trend: 'up' },
  { tag: '#พระแท้', count: 1200, trend: 'up' },
];
