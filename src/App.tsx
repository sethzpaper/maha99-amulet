import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Award,
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
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import { StatCards } from './components/StatCards';
import { FacebookPosts } from './components/FacebookPosts';
import { TikTokPosts } from './components/TikTokPosts';
import { VideoManagement } from './components/VideoManagement';
import { LineLogs } from './components/LineLogs';
import { AdminStats } from './components/AdminStats';
import { EmployeeList } from './components/EmployeeList';
import { CompetitorComparison } from './components/CompetitorComparison';
import { Settings as SettingsPage } from './components/Settings';
import { Login } from './components/Login';
import { useAuthStore } from './lib/authStore';
import { listTrackedAccounts, TrackedAccount } from './lib/employeeApi';
import { dataService } from './lib/dataService';
import { LeaderboardEntry } from './types';

type Tab =
  | 'dashboard'
  | 'facebook'
  | 'tiktok'
  | 'comparison'
  | 'video'
  | 'stats'
  | 'attendance'
  | 'employees'
  | 'settings';

type NavItem = { tab: Tab; label: string; icon: LucideIcon };

const navPriority: Record<Tab, number> = {
  attendance: 0,
  stats: 1,
  employees: 2,
  dashboard: 3,
  facebook: 4,
  tiktok: 5,
  comparison: 6,
  video: 7,
  settings: 8,
};

const pageMeta: Record<Tab, { th: string; en: string }> = {
  dashboard: { th: 'เน€เธย เน€เธเธ’เน€เธยเน€เธเธเน€เธเธเน€เธเธเน€เธเธเน€เธยเน€เธยเน€เธยเน€เธยเน€เธเธ', en: 'Organization Dashboard' },
  facebook: { th: 'เน€เธยเน€เธยเน€เธเธ Facebook', en: 'Facebook Activity' },
  tiktok: { th: 'เน€เธยเน€เธยเน€เธเธ TikTok', en: 'TikTok Short-form Video' },
  comparison: { th: 'เน€เธโฌเน€เธยเน€เธเธเน€เธเธ•เน€เธเธเน€เธยเน€เธโฌเน€เธโ€”เน€เธเธ•เน€เธเธเน€เธยเน€เธยเน€เธเธเน€เธยเน€เธยเน€เธยเน€เธยเน€เธย', en: 'Competitor Intelligence' },
  video: { th: 'เน€เธเธเน€เธเธเน€เธยเน€เธยเน€เธยเน€เธเธ‘เน€เธโ€เน€เธยเน€เธเธ’เน€เธเธเน€เธเธเน€เธเธ”เน€เธโ€เน€เธเธ•เน€เธยเน€เธเธ', en: 'Video Asset Management' },
  stats: { th: 'เน€เธเธเน€เธโ€“เน€เธเธ”เน€เธโ€ขเน€เธเธ”เน€เธยเน€เธเธ‘เน€เธยเน€เธยเน€เธเธ‘เน€เธยเน€เธย', en: 'Admin Performance' },
  attendance: { th: 'เน€เธเธ…เน€เธยเน€เธโฌเน€เธเธเน€เธเธ…เน€เธเธ’เน€เธยเน€เธเธ’เน€เธย', en: 'Attendance & Leave System' },
  employees: { th: 'เน€เธเธเน€เธเธ’เน€เธเธเน€เธยเน€เธเธ—เน€เธยเน€เธเธเน€เธยเน€เธยเน€เธเธ‘เน€เธยเน€เธยเน€เธเธ’เน€เธย', en: 'Employee Directory' },
  settings: { th: 'เน€เธโ€ขเน€เธเธ‘เน€เธยเน€เธยเน€เธยเน€เธยเน€เธเธ’', en: 'System Settings' },
};

const navPublicGuest: NavItem[] = [
  { tab: 'attendance', label: 'เน€เธเธ…เน€เธยเน€เธโฌเน€เธเธเน€เธเธ…เน€เธเธ’เน€เธยเน€เธเธ’เน€เธย', icon: Clock },
  { tab: 'dashboard', label: 'เน€เธยเน€เธโ€เน€เธยเน€เธยเน€เธเธเน€เธเธเน€เธยเน€เธโ€', icon: BarChart3 },
  { tab: 'comparison', label: 'เน€เธโฌเน€เธยเน€เธเธเน€เธเธ•เน€เธเธเน€เธยเน€เธโฌเน€เธโ€”เน€เธเธ•เน€เธเธเน€เธยเน€เธยเน€เธเธเน€เธยเน€เธยเน€เธยเน€เธยเน€เธย', icon: Activity },
  { tab: 'stats', label: 'เน€เธเธเน€เธโ€“เน€เธเธ”เน€เธโ€ขเน€เธเธ”เน€เธยเน€เธเธ‘เน€เธยเน€เธยเน€เธเธ‘เน€เธยเน€เธย', icon: Award },
  { tab: 'employees', label: 'เน€เธเธเน€เธเธ’เน€เธเธเน€เธยเน€เธเธ—เน€เธยเน€เธเธเน€เธยเน€เธยเน€เธเธ‘เน€เธยเน€เธยเน€เธเธ’เน€เธย', icon: Users },
  { tab: 'settings', label: 'เน€เธโ€ขเน€เธเธ‘เน€เธยเน€เธยเน€เธยเน€เธยเน€เธเธ’', icon: SettingsIcon },
];

const navLoggedIn: NavItem[] = [
  { tab: 'attendance', label: 'เน€เธเธ…เน€เธยเน€เธโฌเน€เธเธเน€เธเธ…เน€เธเธ’เน€เธยเน€เธเธ’เน€เธย', icon: Clock },
  { tab: 'dashboard', label: 'เน€เธยเน€เธโ€เน€เธยเน€เธยเน€เธเธเน€เธเธเน€เธยเน€เธโ€', icon: BarChart3 },
  { tab: 'facebook', label: 'เน€เธยเน€เธยเน€เธเธ Facebook', icon: Facebook },
  { tab: 'tiktok', label: 'เน€เธยเน€เธยเน€เธเธ TikTok', icon: Music2 },
  { tab: 'comparison', label: 'เน€เธโฌเน€เธยเน€เธเธเน€เธเธ•เน€เธเธเน€เธยเน€เธโฌเน€เธโ€”เน€เธเธ•เน€เธเธเน€เธยเน€เธยเน€เธเธเน€เธยเน€เธยเน€เธยเน€เธยเน€เธย', icon: Activity },
  { tab: 'video', label: 'เน€เธเธเน€เธเธเน€เธยเน€เธยเน€เธยเน€เธเธ‘เน€เธโ€เน€เธยเน€เธเธ’เน€เธเธเน€เธเธเน€เธเธ”เน€เธโ€เน€เธเธ•เน€เธยเน€เธเธ', icon: Video },
  { tab: 'stats', label: 'เน€เธเธเน€เธโ€“เน€เธเธ”เน€เธโ€ขเน€เธเธ”เน€เธยเน€เธเธ‘เน€เธยเน€เธยเน€เธเธ‘เน€เธยเน€เธย', icon: Award },
  { tab: 'employees', label: 'เน€เธเธเน€เธเธ’เน€เธเธเน€เธยเน€เธเธ—เน€เธยเน€เธเธเน€เธยเน€เธยเน€เธเธ‘เน€เธยเน€เธยเน€เธเธ’เน€เธย', icon: Users },
  { tab: 'settings', label: 'เน€เธโ€ขเน€เธเธ‘เน€เธยเน€เธยเน€เธยเน€เธยเน€เธเธ’', icon: SettingsIcon },
];

const fallbackLeaderboard = [
  { rank: 1, name: 'เน€เธยเน€เธเธ‘เน€เธยเน€เธเธเน€เธเธ’', role: 'Director / Producer', kpi: 100, icon: Crown },
  { rank: 2, name: 'เน€เธเธเน€เธเธ”เน€เธยเน€เธโ€ขเน€เธเธเน€เธเธ’', role: 'Editor', kpi: 99, icon: Medal },
  { rank: 3, name: 'เน€เธยเน€เธเธ•เน€เธโ€ขเน€เธเธ', role: 'Motion Artist', kpi: 98, icon: Zap },
  { rank: 4, name: 'เน€เธยเน€เธเธ”เน€เธเธเน€เธยเน€เธย', role: 'Account Executive', kpi: 96, icon: Zap },
  { rank: 5, name: 'เน€เธเธเน€เธยเน€เธเธ”', role: 'Camera / Lighting', kpi: 94, icon: Zap },
  { rank: 6, name: 'เน€เธยเน€เธเธเน€เธเธ’', role: 'Content Planner', kpi: 92, icon: Zap },
];

function DashboardPage() {
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({
    views: [],
    likesFb: [],
    likesTt: [],
    hours: [],
  });

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
    { key: 'views', label: 'เน€เธเธเน€เธเธเน€เธโ€เน€เธเธเน€เธเธ”เน€เธเธเน€เธเธเน€เธเธเน€เธเธ', suffix: 'views', icon: Video, rows: leaderboards.views },
    { key: 'likesFb', label: 'เน€เธยเน€เธเธ…เน€เธยเน€เธย Facebook', suffix: 'likes', icon: Facebook, rows: leaderboards.likesFb },
    { key: 'likesTt', label: 'เน€เธยเน€เธเธ…เน€เธยเน€เธย TikTok', suffix: 'likes', icon: Music2, rows: leaderboards.likesTt },
    { key: 'hours', label: 'เน€เธยเน€เธเธ‘เน€เธยเน€เธเธเน€เธยเน€เธเธเน€เธยเน€เธยเน€เธเธ’เน€เธย', suffix: 'hrs', icon: Clock, rows: leaderboards.hours },
  ];

  return (
    <div className="space-y-8">
      <StatCards />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-3xl gold-border-glow space-y-3">
          <div className="flex items-center gap-3">
            <Facebook className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Facebook</p>
              <h3 className="text-base font-bold gold-text-gradient">เน€เธเธเน€เธเธเน€เธเธเน€เธยเน€เธโฌเน€เธยเน€เธยเน€เธโฌเน€เธโ€เน€เธเธ—เน€เธเธเน€เธยเน€เธยเน€เธเธ•เน€เธย</h3>
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
              <p className="text-[10px] text-zinc-500">เน€เธยเน€เธเธเน€เธยเน€เธยเน€เธยเน€เธยเน€เธย</p>
              <p className="text-xl font-bold text-blue-400 mt-1">{competitorAccounts.filter((account) => account.platform === 'facebook').length}</p>
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 italic">เน€เธโ€เน€เธเธเน€เธเธเน€เธเธ’เน€เธเธเน€เธเธ…เน€เธเธเน€เธโฌเน€เธเธเน€เธเธ•เน€เธเธเน€เธโ€เน€เธโ€”เน€เธเธ•เน€เธยเน€เธโฌเน€เธเธเน€เธยเน€เธเธ เน€เธยเน€เธยเน€เธเธ Facebook</p>
        </div>

        <div className="glass-card p-6 rounded-3xl gold-border-glow space-y-3">
          <div className="flex items-center gap-3">
            <Music2 className="w-5 h-5 text-pink-400" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">TikTok</p>
              <h3 className="text-base font-bold gold-text-gradient">เน€เธเธเน€เธเธเน€เธเธเน€เธยเน€เธยเน€เธยเน€เธเธเน€เธยเน€เธโฌเน€เธโ€เน€เธเธ—เน€เธเธเน€เธยเน€เธยเน€เธเธ•เน€เธย</h3>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-900">
              <p className="text-[10px] text-zinc-500">Total Views</p>
              <p className="text-xl font-bold text-pink-400 mt-1">{Math.round(tiktokReach / 1000)}K</p>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-900">
              <p className="text-[10px] text-zinc-500">เน€เธยเน€เธยเน€เธเธเน€เธย</p>
              <p className="text-xl font-bold text-pink-400 mt-1">{tiktokAccounts.length}</p>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-900">
              <p className="text-[10px] text-zinc-500">เน€เธยเน€เธเธเน€เธยเน€เธยเน€เธยเน€เธยเน€เธย</p>
              <p className="text-xl font-bold text-pink-400 mt-1">{competitorAccounts.filter((account) => account.platform === 'tiktok').length}</p>
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 italic">เน€เธโ€เน€เธเธเน€เธเธเน€เธเธ’เน€เธเธเน€เธเธ…เน€เธเธเน€เธโฌเน€เธเธเน€เธเธ•เน€เธเธเน€เธโ€เน€เธโ€”เน€เธเธ•เน€เธยเน€เธโฌเน€เธเธเน€เธยเน€เธเธ เน€เธยเน€เธยเน€เธเธ TikTok</p>
        </div>
      </div>

      <div className="glass-card p-6 rounded-3xl gold-border-glow">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Social Overview</p>
            <h3 className="text-xl font-serif italic font-bold gold-text-gradient">เน€เธยเน€เธเธเน€เธเธ’เน€เธยเน€เธเธเน€เธโ€“เน€เธเธ”เน€เธโ€ขเน€เธเธ”เน€เธยเน€เธยเน€เธโฌเน€เธยเน€เธเธ•เน€เธยเน€เธเธเน€เธเธ…</h3>
          </div>
          <Activity className="w-5 h-5 text-gold/40" />
        </div>
        <div className="space-y-3">
          {sourceGraph.map((account) => (
            <div key={account.id} className="grid grid-cols-[160px_1fr_82px] items-center gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-zinc-300">{account.account_name}</p>
                <p className="text-[10px] text-zinc-600">
                  {account.platform === 'facebook' ? 'Facebook' : 'TikTok'} - {account.is_competitor ? 'เน€เธยเน€เธเธเน€เธยเน€เธยเน€เธยเน€เธยเน€เธย' : 'เน€เธยเน€เธเธเน€เธยเน€เธโฌเน€เธเธเน€เธเธ’'}
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
            <h3 className="text-xl font-serif italic font-bold gold-text-gradient">เน€เธยเน€เธเธเน€เธเธเน€เธโ€เน€เธเธ’เน€เธยเน€เธเธเน€เธเธ‘เน€เธยเน€เธโ€เน€เธเธ‘เน€เธยเน€เธยเน€เธเธเน€เธเธเน€เธยเน€เธเธ“เน€เธโฌเน€เธโ€เน€เธเธ—เน€เธเธเน€เธย</h3>
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

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('attendance');
  const [showLogin, setShowLogin] = useState(false);
  const [lang, setLang] = useState<'th' | 'en'>('th');
  const { user, isAuthenticated, logout } = useAuthStore();

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const navItems = isAdmin ? navLoggedIn : navPublicGuest;
  const orderedNavItems = [...navItems].sort((a, b) => navPriority[a.tab] - navPriority[b.tab]);
  const meta = pageMeta[activeTab];

  useEffect(() => {
    if (!navItems.some((item) => item.tab === activeTab)) {
      setActiveTab('attendance');
    }
  }, [activeTab, navItems]);

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardPage />;
      case 'facebook': return <FacebookPosts />;
      case 'tiktok': return <TikTokPosts />;
      case 'comparison': return <CompetitorComparison />;
      case 'video': return <VideoManagement />;
      case 'stats': return <AdminStats />;
      case 'attendance': return <LineLogs />;
      case 'employees': return <EmployeeList />;
      case 'settings': return <SettingsPage isAuthenticated={isAuthenticated} isSuperAdmin={isSuperAdmin} />;
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0c0900]">
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(212,175,55,0.07)_0%,transparent_60%)]" />

      <aside className="fixed top-0 left-0 h-full w-64 z-30 bg-[#0a0700] border-r border-[#251b00] flex flex-col">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[#1e1500]">
          <div className="grid h-10 w-10 place-items-center bg-[#c4982f] text-[#0a0700] shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#d4af37]">เธกเธซเธฒเธเธดเธขเธก999 เน€เธเนเธเธเธทเนเธญ</p>
            <p className="text-[10px] text-[#6a5018] uppercase tracking-widest">Amulet Stat Hub</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-4 space-y-0.5">
          {orderedNavItems.filter(n => n.tab === 'attendance').map(({ tab, label, icon: Icon }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full flex items-center gap-2.5 px-3 py-3 text-sm font-bold rounded-xl transition-all text-left mb-3 ${
                activeTab === tab
                  ? 'bg-[#c4982f]/25 text-[#d4af37] border-2 border-[#c4982f]/60 shadow-[0_0_12px_rgba(196,152,47,0.25)]'
                  : 'text-[#c4982f] border-2 border-[#c4982f]/30 hover:bg-[#c4982f]/10 hover:border-[#c4982f]/50'
              }`}
            >
              <Clock className="h-4 w-4 shrink-0 text-[#c4982f]" />
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{pageMeta[tab][lang]}</span>
            </button>
          ))}

          <p className="px-2 py-1.5 text-[9px] uppercase tracking-[0.2em] text-[#4a3800]">เน€เธโฌเน€เธเธเน€เธยเน€เธเธเน€เธเธเน€เธเธ…เน€เธเธ‘เน€เธย</p>
          {orderedNavItems.filter(n => !['attendance', 'video', 'settings'].includes(n.tab)).map(({ tab, label, icon: Icon }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-all text-left ${
                activeTab === tab
                  ? 'bg-[#c4982f]/15 text-[#d4af37] border border-[#c4982f]/30'
                  : 'text-[#8a6820] hover:bg-[#140e00] hover:text-[#c4982f]'
              }`}
            >
              <Flower2 className="h-3 w-3 shrink-0 text-[#c4982f]/70" />
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{pageMeta[tab][lang]}</span>
            </button>
          ))}

          {isAdmin && (
            <>
              <p className="px-2 py-1.5 mt-4 text-[9px] uppercase tracking-[0.2em] text-[#4a3800]">เน€เธยเน€เธเธ‘เน€เธโ€เน€เธยเน€เธเธ’เน€เธเธเน€เธเธเน€เธเธเน€เธยเน€เธย</p>
              {orderedNavItems.filter(n => ['video'].includes(n.tab)).map(({ tab, label, icon: Icon }) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-all text-left ${
                    activeTab === tab
                      ? 'bg-[#c4982f]/15 text-[#d4af37] border border-[#c4982f]/30'
                      : 'text-[#8a6820] hover:bg-[#140e00] hover:text-[#c4982f]'
                  }`}
                >
                  <Flower2 className="h-3 w-3 shrink-0 text-[#c4982f]/70" />
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{pageMeta[tab][lang]}</span>
                </button>
              ))}
            </>
          )}

          <p className="px-2 py-1.5 mt-4 text-[9px] uppercase tracking-[0.2em] text-[#4a3800]">เน€เธเธเน€เธเธเน€เธยเน€เธย</p>
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-all text-left ${
              activeTab === 'settings'
                ? 'bg-[#c4982f]/15 text-[#d4af37] border border-[#c4982f]/30'
                : 'text-[#8a6820] hover:bg-[#140e00] hover:text-[#c4982f]'
            }`}
          >
            <Flower2 className="h-3 w-3 shrink-0 text-[#c4982f]/70" />
            <SettingsIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{pageMeta['settings'][lang]}</span>
            {!isSuperAdmin && <span className="ml-auto text-[9px] text-[#4a3800]">เน€เธโ€เน€เธเธเน€เธโฌเน€เธโ€”เน€เธยเน€เธเธ’เน€เธยเน€เธเธ‘เน€เธยเน€เธย</span>}
          </button>
        </nav>

        <div className="px-3 py-4 border-t border-[#1e1500] space-y-2">
          {isAuthenticated ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1200] rounded-xl border border-[#2a1e00]">
                <div className="w-7 h-7 rounded-full bg-[#c4982f]/20 flex items-center justify-center">
                  {user?.avatarUrl
                    ? <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                    : <span className="text-xs font-bold text-[#c4982f]">{user?.nickname?.[0] || user?.username?.[0] || '?'}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#d4af37] truncate">{user?.nickname || user?.username}</p>
                  <p className="text-[9px] text-[#6a5018] truncate">{user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Employee'}</p>
                </div>
                {isSuperAdmin && <Shield className="w-4 h-4 text-[#c4982f] shrink-0" />}
              </div>
              <button
                onClick={() => logout()}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#8a6820] hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>เน€เธเธเน€เธเธเน€เธยเน€เธยเน€เธเธ’เน€เธยเน€เธเธเน€เธเธเน€เธยเน€เธย</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="w-full flex items-center gap-2.5 px-3 py-3 text-sm font-bold rounded-xl transition-all bg-[#1a1200] border border-[#c4982f]/40 text-[#c4982f] hover:bg-[#c4982f]/10 hover:border-[#c4982f]/70"
            >
              <Shield className="h-4 w-4 shrink-0" />
              <LogIn className="h-4 w-4 shrink-0" />
              <span>ผู้แลล็อกอิน</span>
            </button>
          )}
          <button
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#8a6820] hover:text-[#c4982f] hover:bg-[#140e00] rounded-lg transition-all"
          >
            <Globe className="w-4 h-4" />
            <span>{lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}</span>
          </button>
          <p className="px-1 text-sm font-extrabold leading-6 text-[#d4af37]">
            "คนศรัทธาพระ บุญช่วยนำพา ต้องทำอย่างเต็มที่ ต้องทำให้ดีที่สุด"
          </p>
        </div>
      </aside>

      <div className="ml-64 flex-1 flex flex-col min-h-screen relative z-10">
        <header className="sticky top-0 z-20 bg-[#0c0900]/80 backdrop-blur-xl border-b border-[#251b00] px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#6a5018] uppercase tracking-[0.2em]">{meta.en}</p>
            <h1 className="text-xl font-bold text-[#d4af37] mt-0.5">{meta.th}</h1>
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
              <Flower2 className="h-3 w-3 text-[#c4982f]/50" />
              <span>มหานิยม999 เช็คชื่อ</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">
          {renderPage()}
        </main>

        <footer className="border-t border-[#1e1500] px-8 py-5 flex items-center justify-between">
          <p className="text-[10px] text-[#4a3800]">(c) 2026 เว็บ มหานิยม999 เช็คชื่อ</p>
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
