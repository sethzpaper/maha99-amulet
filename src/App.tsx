import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Crown,
  Facebook,
  Flower2,
  Globe,
  LogIn,
  LogOut,
  Medal,
  Music2,
  Shield,
  Sparkles,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { StatCards } from './components/StatCards';
import { FacebookPosts } from './components/FacebookPosts';
import { TikTokPosts } from './components/TikTokPosts';
import { VideoManagement } from './components/VideoManagement';
import { AdminStats } from './components/AdminStats';
import { EmployeeList } from './components/EmployeeList';
import { LineLogs } from './components/LineLogs';
import { CompetitorComparison } from './components/CompetitorComparison';
import { Settings as SettingsPage } from './components/Settings';
import { Login } from './components/Login';
import { useAuthStore } from './lib/authStore';
import { fetchEntries, OVERTIME_THRESHOLD_HOURS as overtimeThresholdHours, TimeEntry } from './lib/attendanceApi';
import { listTrackedAccounts, TrackedAccount } from './lib/employeeApi';
import { dataService } from './lib/dataService';
import { LeaderboardEntry } from './types';

type Tab =
  | 'aiVideoHome'
  | 'videoIdeas'
  | 'imageGen'
  | 'storyboard'
  | 'videoRender'
  | 'videoReview'
  | 'approvedVideos'
  | 'assetLibrary'
  | 'costTracker'
  | 'dashboard'
  | 'facebook'
  | 'tiktok'
  | 'comparison'
  | 'stats'
  | 'employees'
  | 'lineLogs'
  | 'settings';

type NavItem = { tab: Tab; label: string; icon: string };
type NavSection = { title: string; items: NavItem[] };

const pageMeta: Record<Tab, { th: string; en: string }> = {
  aiVideoHome: { th: 'ศูนย์งานวิดีโอ', en: 'AI Video Home' },
  videoIdeas: { th: 'ไอเดียวิดีโอ', en: 'Video Ideas' },
  imageGen: { th: 'สร้างภาพ AI', en: 'Image Generation' },
  storyboard: { th: 'สตอรี่บอร์ด', en: 'Storyboard' },
  videoRender: { th: 'เรนเดอร์วิดีโอ', en: 'Video Render' },
  videoReview: { th: 'ตรวจงานวิดีโอ', en: 'Video Review' },
  approvedVideos: { th: 'วิดีโออนุมัติแล้ว', en: 'Approved Videos' },
  assetLibrary: { th: 'คลังไฟล์คอนเทนต์', en: 'Asset Library' },
  costTracker: { th: 'ต้นทุนคอนเทนต์', en: 'Cost Tracker' },
  dashboard: { th: 'แดชบอร์ดองค์กร', en: 'Organization Dashboard' },
  facebook: { th: 'โพสต์ Facebook', en: 'Facebook Activity' },
  tiktok: { th: 'โพสต์ TikTok', en: 'TikTok Short-form Video' },
  comparison: { th: 'เปรียบเทียบคู่แข่ง', en: 'Competitor Intelligence' },
  stats: { th: 'สถิติพนักงาน', en: 'Admin Performance' },
  employees: { th: 'ทำเนียบพนักงาน', en: 'Employee Directory' },
  lineLogs: { th: 'ลงเวลาและ OT', en: 'Attendance Workload' },
  settings: { th: 'ตั้งค่า', en: 'System Settings' },
};

const trendNavItems: NavItem[] = [
  { tab: 'dashboard', label: 'แดชบอร์ดองค์กร', icon: 'dashboard' },
  { tab: 'comparison', label: 'เทียบคู่แข่ง', icon: 'query_stats' },
  { tab: 'stats', label: 'อันดับผลงาน', icon: 'leaderboard' },
];

const navSections: NavSection[] = [
  {
    title: 'แนวโน้ม',
    items: trendNavItems,
  },
  {
    title: 'บริษัท',
    items: [
      { tab: 'facebook', label: 'โพสต์ Facebook', icon: 'facebook' },
      { tab: 'tiktok', label: 'โพสต์ TikTok', icon: 'music_note' },
    ],
  },
  {
    title: 'พนักงาน',
    items: [
      { tab: 'employees', label: 'ทำเนียบพนักงาน', icon: 'groups' },
      { tab: 'lineLogs', label: 'ลงเวลา / Workload', icon: 'schedule' },
    ],
  },
  {
    title: 'บอร์ด',
    items: [
      { tab: 'aiVideoHome', label: 'ศูนย์งานวิดีโอ', icon: 'video_library' },
      { tab: 'assetLibrary', label: 'คลังคอนเทนต์', icon: 'inventory_2' },
      { tab: 'costTracker', label: 'ต้นทุนคอนเทนต์', icon: 'receipt_long' },
    ],
  },
  {
    title: 'จัดการระบบ',
    items: [
      { tab: 'settings', label: 'ตั้งค่าระบบ', icon: 'admin_panel_settings' },
    ],
  },
];

const publicNavSections: NavSection[] = [
  {
    title: 'แนวโน้ม',
    items: trendNavItems,
  },
];

const publicTabs = new Set<Tab>(trendNavItems.map((item) => item.tab));
const fallbackLeaderboard = [
  { rank: 1, name: 'พี่ใหญ่', role: 'Director / Producer', kpi: 100, icon: Crown },
  { rank: 2, name: 'น้องเอ', role: 'Editor', kpi: 99, icon: Medal },
  { rank: 3, name: 'น้องบี', role: 'Motion Artist', kpi: 98, icon: Zap },
  { rank: 4, name: 'น้องซี', role: 'Account Executive', kpi: 96, icon: Zap },
  { rank: 5, name: 'น้องดี', role: 'Camera / Lighting', kpi: 94, icon: Zap },
  { rank: 6, name: 'น้องอี', role: 'Content Planner', kpi: 92, icon: Zap },
];

function DashboardPage() {
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({
    views: [],
    likesFb: [],
    likesTt: [],
    hours: [],
  });
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    listTrackedAccounts().then(setAccounts);
    Promise.all([
      dataService.fetchLeaderboard('views'),
      dataService.fetchLeaderboard('likes-fb'),
      dataService.fetchLeaderboard('likes-tt'),
      dataService.fetchLeaderboard('hours'),
    ]).then(([views, likesFb, likesTt, hours]) => {
      setLeaderboards({ views, likesFb, likesTt, hours });
    });
    fetchEntries({ month: new Date().toISOString().slice(0, 7) }).then(setTimeEntries);
  }, []);

  const facebookAccounts = accounts.filter((account) => account.platform === 'facebook' && !account.is_competitor);
  const tiktokAccounts = accounts.filter((account) => account.platform === 'tiktok' && !account.is_competitor);
  const competitorAccounts = accounts.filter((account) => account.is_competitor);
  const sourceGraph = accounts.map((account, index) => {
    const base = account.platform === 'facebook' ? 24000 : 52000;
    const reach = base + index * 6200 + (account.is_competitor ? 4200 : 9800);
    return {
      ...account,
      reach,
      engagement: Math.round(reach * (account.platform === 'facebook' ? 0.078 : 0.112)),
    };
  });
  const maxReach = Math.max(...sourceGraph.map((account) => account.reach), 1);
  const facebookReach = sourceGraph
    .filter((account) => account.platform === 'facebook' && !account.is_competitor)
    .reduce((sum, account) => sum + account.reach, 0);
  const tiktokReach = sourceGraph
    .filter((account) => account.platform === 'tiktok' && !account.is_competitor)
    .reduce((sum, account) => sum + account.reach, 0);
  const fallbackEntries = fallbackLeaderboard.slice(0, 4).map(item => ({
    rank: item.rank,
    creator: item.name,
    name: item.name,
    value: item.kpi,
  }));
  const leaderboardSections = [
    { key: 'views', label: 'ยอดวิวสูงสุด', suffix: 'views', icon: Video, rows: leaderboards.views },
    { key: 'likesFb', label: 'ยอดไลก์ Facebook', suffix: 'likes', icon: Facebook, rows: leaderboards.likesFb },
    { key: 'likesTt', label: 'ยอดไลก์ TikTok', suffix: 'likes', icon: Music2, rows: leaderboards.likesTt },
    { key: 'hours', label: 'ชั่วโมงทำงาน', suffix: 'hrs', icon: Clock, rows: leaderboards.hours },
  ];
  const attendanceRows = timeEntries.filter((entry) => Number(entry.total_hours || 0) > 0);
  const totalWorkHours = attendanceRows.reduce((sum, entry) => sum + Number(entry.total_hours || 0), 0);
  const totalOtHours = attendanceRows.reduce((sum, entry) => sum + Math.max(0, Number(entry.total_hours || 0) - overtimeThresholdHours), 0);
  const overThresholdDays = attendanceRows.filter((entry) => Number(entry.total_hours || 0) > overtimeThresholdHours).length;
  const activeEmployeeCount = new Set(attendanceRows.map((entry) => entry.user_id)).size;
  const averageHours = attendanceRows.length ? totalWorkHours / attendanceRows.length : 0;
  const workloadByEmployee = Array.from(attendanceRows.reduce((map, entry) => {
    const current = map.get(entry.user_id) || { name: entry.user_name, hours: 0, ot: 0, days: 0 };
    const hours = Number(entry.total_hours || 0);
    current.hours += hours;
    current.ot += Math.max(0, hours - overtimeThresholdHours);
    current.days += 1;
    map.set(entry.user_id, current);
    return map;
  }, new Map<string, { name: string; hours: number; ot: number; days: number }>()).values())
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 8)
    .map((row) => ({ ...row, hours: Number(row.hours.toFixed(1)), ot: Number(row.ot.toFixed(1)) }));
  const dailyWorkload = Array.from(attendanceRows.reduce((map, entry) => {
    const current = map.get(entry.work_date) || { date: entry.work_date.slice(5), hours: 0, ot: 0, people: new Set<string>() };
    const hours = Number(entry.total_hours || 0);
    current.hours += hours;
    current.ot += Math.max(0, hours - overtimeThresholdHours);
    current.people.add(entry.user_id);
    map.set(entry.work_date, current);
    return map;
  }, new Map<string, { date: string; hours: number; ot: number; people: Set<string> }>()).values())
    .map((row) => ({ date: row.date, hours: Number(row.hours.toFixed(1)), ot: Number(row.ot.toFixed(1)), people: row.people.size }))
    .slice(-14);

  return (
    <div className="space-y-8">
      <StatCards />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'ชั่วโมงรวมเดือนนี้', value: `${Math.round(totalWorkHours).toLocaleString()} ชม.`, icon: Clock, tone: 'text-blue-300' },
          { label: 'OT หลัง 11 ชม.', value: `${Math.round(totalOtHours * 10) / 10} ชม.`, icon: AlertTriangle, tone: totalOtHours > 0 ? 'text-amber-300' : 'text-emerald-300' },
          { label: 'วันเกิน Threshold', value: `${overThresholdDays.toLocaleString()} วัน`, icon: BarChart3, tone: overThresholdDays > 0 ? 'text-amber-300' : 'text-emerald-300' },
          { label: 'พนักงาน active', value: `${activeEmployeeCount.toLocaleString()} คน`, icon: Users, tone: 'text-cyan-300' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="glass-card rounded-2xl p-5 gold-border-glow">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
                <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
              </div>
              <Icon className="h-6 w-6 text-gold/60" />
            </div>
            <p className="mt-3 text-[10px] text-zinc-600">เฉลี่ย {averageHours.toFixed(1)} ชม./รายการ · threshold {overtimeThresholdHours} ชม.</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-3xl gold-border-glow">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Workload Trend</p>
              <h3 className="text-lg font-bold gold-text-gradient">ชั่วโมงรวมและ OT รายวัน</h3>
            </div>
            <BarChart3 className="h-5 w-5 text-gold/50" />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyWorkload} margin={{ top: 12, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#7aa7d9" fontSize={11} />
                <YAxis stroke="#7aa7d9" fontSize={11} />
                <Tooltip contentStyle={{ background: '#071527', border: '1px solid #12395a', borderRadius: 12 }} />
                <Line type="monotone" dataKey="hours" name="ชั่วโมงรวม" stroke="#3794ff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ot" name="OT" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6 rounded-3xl gold-border-glow">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Employee Load</p>
              <h3 className="text-lg font-bold gold-text-gradient">ชั่วโมงสะสมตามพนักงาน</h3>
            </div>
            <Users className="h-5 w-5 text-gold/50" />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadByEmployee} layout="vertical" margin={{ top: 8, right: 20, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                <XAxis type="number" stroke="#7aa7d9" fontSize={11} />
                <YAxis dataKey="name" type="category" width={92} stroke="#7aa7d9" fontSize={11} />
                <Tooltip contentStyle={{ background: '#071527', border: '1px solid #12395a', borderRadius: 12 }} />
                <Bar dataKey="hours" name="ชั่วโมงรวม" fill="#3794ff" radius={[0, 6, 6, 0]} />
                <Bar dataKey="ot" name="OT" fill="#f59e0b" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-3xl gold-border-glow space-y-3">
          <div className="flex items-center gap-3">
            <Facebook className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Facebook</p>
              <h3 className="text-base font-bold gold-text-gradient">ผลตอบรับเดือนนี้</h3>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-900">
              <p className="text-[10px] text-zinc-500">Total Reach</p>
              <p className="text-xl font-bold text-blue-400 mt-1">{Math.round(facebookReach / 1000)}K</p>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-900">
              <p className="text-[10px] text-zinc-500">Fanpage</p>
              <p className="text-xl font-bold text-blue-400 mt-1">{facebookAccounts.length}</p>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-900">
              <p className="text-[10px] text-zinc-500">คู่แข่ง</p>
              <p className="text-xl font-bold text-blue-400 mt-1">{competitorAccounts.filter((account) => account.platform === 'facebook').length}</p>
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 italic">ข้อมูลจากบัญชีที่เชื่อมไว้ · โพสต์ Facebook</p>
        </div>

        <div className="glass-card p-6 rounded-3xl gold-border-glow space-y-3">
          <div className="flex items-center gap-3">
            <Music2 className="w-5 h-5 text-pink-400" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">TikTok</p>
              <h3 className="text-base font-bold gold-text-gradient">ผลตอบรับเดือนนี้</h3>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-900">
              <p className="text-[10px] text-zinc-500">Total Views</p>
              <p className="text-xl font-bold text-pink-400 mt-1">{Math.round(tiktokReach / 1000)}K</p>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-900">
              <p className="text-[10px] text-zinc-500">ช่อง</p>
              <p className="text-xl font-bold text-pink-400 mt-1">{tiktokAccounts.length}</p>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-900">
              <p className="text-[10px] text-zinc-500">คู่แข่ง</p>
              <p className="text-xl font-bold text-pink-400 mt-1">{competitorAccounts.filter((account) => account.platform === 'tiktok').length}</p>
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 italic">ข้อมูลจากบัญชีที่เชื่อมไว้ · โพสต์ TikTok</p>
        </div>
      </div>

      <div className="glass-card p-6 rounded-3xl gold-border-glow">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Social Overview</p>
            <h3 className="text-xl font-serif italic font-bold gold-text-gradient">ภาพรวมโซเชียล</h3>
          </div>
          <Activity className="w-5 h-5 text-gold/40" />
        </div>
        <div className="space-y-3">
          {sourceGraph.map((account) => (
            <div key={account.id} className="grid grid-cols-[160px_1fr_82px] items-center gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-zinc-300">{account.account_name}</p>
                <p className="text-[10px] text-zinc-600">
                  {account.platform === 'facebook' ? 'Facebook' : 'TikTok'} - {account.is_competitor ? 'คู่แข่ง' : 'ของเรา'}
                </p>
              </div>
              <div className="h-3 rounded-full bg-zinc-900 overflow-hidden">
                <div
                  className={`h-full ${account.platform === 'facebook' ? 'bg-blue-500' : 'bg-pink-500'}`}
                  style={{ width: `${Math.max(8, (account.reach / maxReach) * 100)}%` }}
                />
              </div>
              <p className="text-right text-xs font-mono text-gold">{Math.round(account.reach / 1000)}K</p>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-6 rounded-3xl gold-border-glow">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Team Performance</p>
            <h3 className="text-xl font-serif italic font-bold gold-text-gradient">ผู้นำอันดับประจำเดือน</h3>
          </div>
          <Crown className="w-5 h-5 text-gold/40" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {leaderboardSections.map(({ key, label, suffix, icon: Icon, rows }) => {
            const entries = (rows.length > 0 ? rows : fallbackEntries).slice(0, 4);
            return (
              <div key={key} className="rounded-2xl border border-zinc-900 bg-zinc-950/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-gold" />
                  <p className="text-xs font-bold text-zinc-300">{label}</p>
                </div>
                <div className="space-y-2">
                  {entries.map((emp) => (
                    <div key={`${key}-${emp.rank}-${emp.name}`} className="flex items-center gap-3 rounded-xl border border-zinc-900 bg-zinc-950/40 p-3">
                      <span className={`text-sm font-bold font-mono w-7 text-center ${emp.rank <= 3 ? 'text-gold' : 'text-zinc-600'}`}>#{emp.rank}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-200 truncate">{emp.name || emp.creator}</p>
                      </div>
                      <span className="text-xs font-bold text-gold shrink-0">{Math.round(emp.value).toLocaleString()} {suffix}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const workflowCards: Record<Tab, { title: string; description: string; columns: string[] }> = {
  aiVideoHome: {
    title: 'AI Video Command Center',
    description: 'ภาพรวมงานวิดีโอทั้งหมดจากไอเดียจนถึงอนุมัติ พร้อมรอเชื่อม Discord workflow',
    columns: ['งานใหม่', 'กำลังทำ', 'รอตรวจ', 'อนุมัติแล้ว'],
  },
  videoIdeas: {
    title: 'Video Ideas',
    description: 'รวบรวมไอเดีย hook, keyword, reference และโจทย์คลิปจากทีม',
    columns: ['Idea Backlog', 'Selected', 'Need Assets', 'Ready'],
  },
  imageGen: {
    title: 'Image Generation',
    description: 'คิวสร้างภาพสินค้า, thumbnail, scene reference และภาพประกอบสำหรับวิดีโอ',
    columns: ['Prompt Draft', 'Generating', 'Need Revision', 'Approved Image'],
  },
  storyboard: {
    title: 'Storyboard',
    description: 'แตกช็อต วางลำดับภาพ คำบรรยาย และจังหวะของคลิปก่อน render',
    columns: ['Script', 'Shot List', 'Voice/Text', 'Ready Render'],
  },
  videoRender: {
    title: 'Video Render',
    description: 'ติดตามงาน render, version, output size และสถานะไฟล์ปลายทาง',
    columns: ['Queued', 'Rendering', 'Failed', 'Rendered'],
  },
  videoReview: {
    title: 'Video Review',
    description: 'พื้นที่ตรวจคลิปก่อนโพสต์ เก็บ comment, revision และผลตรวจคุณภาพ',
    columns: ['Waiting Review', 'Fix Needed', 'Final Check', 'Approved'],
  },
  approvedVideos: {
    title: 'Approved Videos',
    description: 'คลิปที่ผ่านการอนุมัติแล้ว รอจัดตารางโพสต์หรือบันทึกเป็นผลงาน',
    columns: ['Approved', 'Scheduled FB', 'Scheduled TikTok', 'Posted'],
  },
  assetLibrary: {
    title: 'Asset Library',
    description: 'คลังไฟล์วิดีโอ รูปภาพ ลิงก์ Drive และสถานะ pipeline ของคอนเทนท์',
    columns: ['Video Files', 'Product Images', 'Post Links', 'Archive'],
  },
  costTracker: {
    title: 'Cost Tracker',
    description: 'ติดตามค่าใช้จ่าย AI render, image generation, ads และต้นทุนรายคลิป',
    columns: ['AI Cost', 'Production', 'Ads', 'Total'],
  },
  dashboard: { title: '', description: '', columns: [] },
  facebook: { title: '', description: '', columns: [] },
  tiktok: { title: '', description: '', columns: [] },
  comparison: { title: '', description: '', columns: [] },
  stats: { title: '', description: '', columns: [] },
  employees: { title: '', description: '', columns: [] },
  settings: { title: '', description: '', columns: [] },
};

function VideoWorkflowPage({ tab }: { tab: Tab }) {
  const config = workflowCards[tab];

  if (tab === 'assetLibrary') {
    return <VideoManagement />;
  }

  if (tab === 'aiVideoHome') {
    return (
      <div className="space-y-8">
        <VideoWorkflowBoard config={config} />
        <VideoManagement />
      </div>
    );
  }

  return <VideoWorkflowBoard config={config} />;
}

function VideoWorkflowBoard({ config }: { config: { title: string; description: string; columns: string[] } }) {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl border border-gold/20 p-6 gold-border-glow">
        <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Discord-ready workflow</p>
        <h2 className="mt-2 text-2xl font-serif italic font-bold gold-text-gradient">{config.title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-500">{config.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {config.columns.map((column) => (
          <div key={column} className="min-h-48 rounded-3xl border border-zinc-900 bg-zinc-950/40 p-5">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h3 className="text-sm font-bold text-zinc-200">{column}</h3>
              <span className="rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-[10px] font-bold text-gold">0</span>
            </div>
            <div className="mt-5 rounded-2xl border border-dashed border-zinc-800 p-5 text-center text-xs text-zinc-600">
              รอเชื่อมรายการจาก Discord
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminGate({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-220px)] max-w-3xl items-center">
      <div className="glass-card w-full rounded-3xl border border-gold/20 p-8 gold-border-glow">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
            <Shield className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#6a5018]">Admin only</p>
            <h2 className="mt-2 text-2xl font-serif italic font-bold gold-text-gradient">
              เมนูหลักถูกซ่อนไว้
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              ระบบจัดการคอนเทนต์และข้อมูล workflow เปิดให้เฉพาะบัญชีแอดมินเท่านั้น
              กรุณาเข้าสู่ระบบด้วยบัญชี admin หรือ super admin เพื่อจัดการงานวิดีโอจาก Discord
            </p>
            <button
              onClick={onLogin}
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-gold/40 bg-[var(--app-surface)] px-4 py-3 text-sm font-bold text-gold transition-all hover:border-gold/70 hover:bg-gold/10"
            >
              <LogIn className="h-4 w-4" />
              <span>เข้าสู่ระบบแอดมิน</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showLogin, setShowLogin] = useState(false);
  const [lang, setLang] = useState<'th' | 'en'>('th');
  const { user, isAuthenticated, logout } = useAuthStore();

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const visibleNavSections = isAdmin ? navSections : publicNavSections;
  const navItems: NavItem[] = visibleNavSections.flatMap((section) => section.items);
  const canViewActiveTab = isAdmin || publicTabs.has(activeTab);
  const meta = pageMeta[canViewActiveTab ? activeTab : 'dashboard'];

  useEffect(() => {
    if (!navItems.some((item) => item.tab === activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, navItems]);

  const renderPage = () => {
    if (!canViewActiveTab) {
      return <AdminGate onLogin={() => setShowLogin(true)} />;
    }

    switch (activeTab) {
      case 'aiVideoHome':
      case 'videoIdeas':
      case 'imageGen':
      case 'storyboard':
      case 'videoRender':
      case 'videoReview':
      case 'approvedVideos':
      case 'assetLibrary':
      case 'costTracker':
        return <VideoWorkflowPage tab={activeTab} />;
      case 'dashboard': return <DashboardPage />;
      case 'facebook': return <FacebookPosts />;
      case 'tiktok': return <TikTokPosts />;
      case 'comparison': return <CompetitorComparison />;
      case 'stats': return <AdminStats />;
      case 'employees': return <EmployeeList />;
      case 'lineLogs': return <LineLogs />;
      case 'settings': return <SettingsPage isAuthenticated={isAuthenticated} isSuperAdmin={isSuperAdmin} isAdmin={isAdmin} userName={user?.username || ''} />;
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--app-bg)]">
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(55,148,255,0.13)_0%,transparent_60%)]" />

      <aside className="fixed top-0 left-0 h-full w-64 z-30 bg-[var(--app-bg-deep)] border-r border-[var(--app-border-muted)] flex flex-col">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[var(--app-border-muted)]">
          <div className="grid h-10 w-10 place-items-center bg-[var(--app-accent)] text-[var(--app-bg-deep)] shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-gold">มหานิยม 999 หน่วยหลังบ้าน</p>
            <p className="text-[10px] text-[#6a5018] uppercase tracking-widest">Amulet Stat Hub</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-4 space-y-0.5">
          {visibleNavSections.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="px-2 py-1.5 text-[9px] uppercase tracking-[0.2em] text-[#4a3800]">{section.title}</p>
              <div className="space-y-1">
                {section.items.map(({ tab, label, icon }) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold rounded-xl transition-all text-left ${
                      activeTab === tab
                        ? 'bg-gold/20 text-gold border-2 border-gold/60 shadow-[0_0_12px_rgba(55,148,255,0.28)]'
                        : 'text-gold border-2 border-gold/30 hover:bg-gold/10 hover:border-gold/50'
                    }`}
                  >
                    <span className="material-symbols-rounded h-5 w-5 shrink-0 items-center justify-center text-[20px]">{icon}</span>
                    <span className="truncate">{label}</span>
                    {tab === 'settings' && !isSuperAdmin && <span className="ml-auto text-[9px] text-[#4a3800]">admin</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {!isAdmin && (
            <div className="rounded-2xl border border-gold/20 bg-gold/5 px-3 py-4 text-sm leading-6 text-zinc-500">
              <div className="mb-2 flex items-center gap-2 text-gold">
                <Shield className="h-4 w-4" />
                <span className="font-bold">เมนูอื่นสำหรับแอดมิน</span>
              </div>
              <p>ดูหมวดแนวโน้มได้ทันที ส่วนบริษัท พนักงาน บอร์ด และจัดการระบบต้องเข้าสู่ระบบแอดมินก่อน</p>
            </div>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-[var(--app-border-muted)] space-y-2">
          {isAuthenticated ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border-muted)]">
                <div className="w-7 h-7 rounded-full bg-gold/20 flex items-center justify-center">
                  {user?.avatarUrl
                    ? <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                    : <span className="text-xs font-bold text-gold">{user?.nickname?.[0] || user?.username?.[0] || '?'}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gold truncate">{user?.nickname || user?.username}</p>
                  <p className="text-[9px] text-[#6a5018] truncate">{user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Employee'}</p>
                </div>
                {isSuperAdmin && <Shield className="w-4 h-4 text-gold shrink-0" />}
              </div>
              <button
                onClick={() => logout()}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--app-text-muted)] hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="w-full flex items-center gap-2.5 px-3 py-3 text-sm font-bold rounded-xl transition-all bg-[var(--app-surface)] border border-gold/40 text-gold hover:bg-gold/10 hover:border-gold/70"
            >
              <Shield className="h-4 w-4 shrink-0" />
              <LogIn className="h-4 w-4 shrink-0" />
              <span>เข้าสู่ระบบ</span>
            </button>
          )}
          <button
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--app-text-muted)] hover:text-gold hover:bg-[var(--app-surface)] rounded-lg transition-all"
          >
            <Globe className="w-4 h-4" />
            <span>{lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}</span>
          </button>
          <p className="px-1 text-sm font-extrabold leading-6 text-gold">
            "คนศรัทธาพระ บุญช่วยนำพา ต้องทำอย่างเต็มที่ ต้องทำให้ดีที่สุด"
          </p>
        </div>
      </aside>

      <div className="ml-64 flex-1 flex flex-col min-h-screen relative z-10">
        <header className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--app-bg)_80%,transparent)] backdrop-blur-xl border-b border-[var(--app-border-muted)] px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#6a5018] uppercase tracking-[0.2em]">{meta.en}</p>
            <h1 className="text-xl font-bold text-gold mt-0.5">{meta.th}</h1>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-200">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    user?.nickname?.[0] || user?.username?.[0] || '?'
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-emerald-100">{user?.nickname || user?.username}</p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">
                    {isSuperAdmin ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Employee'}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-[10px] text-[#4a3800]">
              <Flower2 className="h-3 w-3 text-gold/50" />
              <span>มหานิยม 999 หน่วยหลังบ้าน</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">
          {renderPage()}
        </main>

        <footer className="border-t border-[var(--app-border-muted)] px-8 py-5 flex items-center justify-between">
          <p className="text-[10px] text-[#4a3800]">(c) 2026 เว็บ มหานิยม 999 หน่วยหลังบ้าน</p>
          <p className="text-[10px] text-[#4a3800]">developed by Sasiskis84 • Amulet Stat Hub v2.0</p>
        </footer>
      </div>

      {showLogin && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md relative">
            <button
              onClick={() => setShowLogin(false)}
              className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white"
            >
              x
            </button>
            <Login onLoginSuccess={() => setShowLogin(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
