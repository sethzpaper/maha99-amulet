import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Award,
  BarChart3,
  Clock,
  Crown,
  Facebook,
  Flower2,
  Medal,
  Music2,
  Settings as SettingsIcon,
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

// ── Types ──────────────────────────────────────────────────────────────────
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

// ── Navigation definition ──────────────────────────────────────────────────
const navPublic: NavItem[] = [
  { tab: 'dashboard', label: 'แดชบอร์ด', icon: BarChart3 },
  { tab: 'facebook', label: 'โพส Facebook', icon: Facebook },
  { tab: 'tiktok', label: 'โพส TikTok', icon: Music2 },
  { tab: 'comparison', label: 'เปรียบเทียบคู่แข่ง', icon: Activity },
];

const navAdmin: NavItem[] = [
  { tab: 'video', label: 'ระบบจัดการวิดีโอ', icon: Video },
  { tab: 'stats', label: 'สถิตินักปั้น', icon: Award },
  { tab: 'attendance', label: 'ลงเวลางาน', icon: Clock },
  { tab: 'employees', label: 'รายชื่อพนักงาน', icon: Users },
  { tab: 'settings', label: 'ตั้งค่า', icon: SettingsIcon },
];

// ── Page titles ────────────────────────────────────────────────────────────
const pageMeta: Record<Tab, { th: string; en: string }> = {
  dashboard:  { th: 'ภาพรวมองค์กร',         en: 'Organization Dashboard' },
  facebook:   { th: 'โพส Facebook',           en: 'Facebook Activity' },
  tiktok:     { th: 'โพส TikTok',             en: 'TikTok Short-form Video' },
  comparison: { th: 'เปรียบเทียบคู่แข่ง',    en: 'Competitor Intelligence' },
  video:      { th: 'ระบบจัดการวิดีโอ',      en: 'Video Asset Management' },
  stats:      { th: 'สถิตินักปั้น',           en: 'Admin Performance' },
  attendance: { th: 'ลงเวลางาน',             en: 'Attendance & Leave System' },
  employees:  { th: 'รายชื่อพนักงาน',        en: 'Employee Directory' },
  settings:   { th: 'ตั้งค่า',               en: 'System Settings' },
};

// ── Compact leaderboard data (dashboard only) ──────────────────────────────
const leaderboard = [
  { rank: 1, name: 'ธันวา',  role: 'Director / Producer', kpi: 100, icon: Crown },
  { rank: 2, name: 'มินตรา', role: 'Editor',               kpi: 99,  icon: Medal },
  { rank: 3, name: 'คีตะ',   role: 'Motion Artist',        kpi: 98,  icon: Zap },
  { rank: 4, name: 'พิมพ์',  role: 'Account Executive',    kpi: 96,  icon: Zap },
  { rank: 5, name: 'อชิ',    role: 'Camera / Lighting',    kpi: 94,  icon: Zap },
  { rank: 6, name: 'นรา',    role: 'Content Planner',      kpi: 92,  icon: Zap },
];

// ── Dashboard composite page ───────────────────────────────────────────────
function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Stat cards row */}
      <StatCards />

      {/* Social summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Facebook summary */}
        <div className="glass-card p-6 rounded-3xl gold-border-glow space-y-3">
          <div className="flex items-center gap-3">
            <Facebook className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Facebook</p>
              <h3 className="text-base font-bold gold-text-gradient">สรุปเพจเดือนนี้</h3>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-900">
              <p className="text-[10px] text-zinc-500">Total Reach</p>
              <p className="text-xl font-bold text-blue-400 mt-1">240K</p>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-900">
              <p className="text-[10px] text-zinc-500">Engagement</p>
              <p className="text-xl font-bold text-blue-400 mt-1">18.5K</p>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-900">
              <p className="text-[10px] text-zinc-500">โพสใหม่</p>
              <p className="text-xl font-bold text-blue-400 mt-1">32</p>
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 italic">→ ดูรายละเอียดที่เมนู โพส Facebook</p>
        </div>

        {/* TikTok summary */}
        <div className="glass-card p-6 rounded-3xl gold-border-glow space-y-3">
          <div className="flex items-center gap-3">
            <Music2 className="w-5 h-5 text-pink-400" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">TikTok</p>
              <h3 className="text-base font-bold gold-text-gradient">สรุปช่องเดือนนี้</h3>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-900">
              <p className="text-[10px] text-zinc-500">Total Views</p>
              <p className="text-xl font-bold text-pink-400 mt-1">520K</p>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-900">
              <p className="text-[10px] text-zinc-500">Followers</p>
              <p className="text-xl font-bold text-pink-400 mt-1">4.2K</p>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-3 text-center border border-zinc-900">
              <p className="text-[10px] text-zinc-500">วิดีโอใหม่</p>
              <p className="text-xl font-bold text-pink-400 mt-1">14</p>
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 italic">→ ดูรายละเอียดที่เมนู โพส TikTok</p>
        </div>
      </div>

      {/* Compact leaderboard */}
      <div className="glass-card p-6 rounded-3xl gold-border-glow">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Team Performance</p>
            <h3 className="text-xl font-serif italic font-bold gold-text-gradient">กระดานอันดับประจำเดือน</h3>
          </div>
          <Crown className="w-5 h-5 text-gold/40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {leaderboard.map((emp) => (
            <div
              key={emp.rank}
              className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                emp.rank === 1
                  ? 'border-gold/40 bg-gold/5'
                  : emp.rank === 2
                  ? 'border-zinc-500/30 bg-zinc-800/20'
                  : emp.rank === 3
                  ? 'border-amber-700/30 bg-amber-900/10'
                  : 'border-zinc-900 bg-zinc-950/30'
              }`}
            >
              <span className={`text-lg font-bold font-mono w-7 text-center ${emp.rank <= 3 ? 'text-gold' : 'text-zinc-600'}`}>
                #{emp.rank}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-200 truncate">{emp.name}</p>
                <p className="text-[10px] text-zinc-500 truncate">{emp.role}</p>
              </div>
              <span className="text-sm font-bold text-gold shrink-0">{emp.kpi}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const allNav = [...navPublic, ...navAdmin];
  const meta = pageMeta[activeTab];

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':  return <DashboardPage />;
      case 'facebook':   return <FacebookPosts />;
      case 'tiktok':     return <TikTokPosts />;
      case 'comparison': return <CompetitorComparison />;
      case 'video':      return <VideoManagement />;
      case 'stats':      return <AdminStats />;
      case 'attendance': return <LineLogs />;
      case 'employees':  return <EmployeeList />;
      case 'settings':   return <SettingsPage />;
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0c0900]">
      {/* Background gradient layer */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(212,175,55,0.07)_0%,transparent_60%)]" />

      {/* ── Sidebar ── */}
      <aside className="fixed top-0 left-0 h-full w-64 z-30 bg-[#0a0700] border-r border-[#251b00] flex flex-col">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[#1e1500]">
          <div className="grid h-10 w-10 place-items-center bg-[#c4982f] text-[#0a0700] shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#d4af37]">มหานิยม999 เช็คชื่อ</p>
            <p className="text-[10px] text-[#6a5018] uppercase tracking-widest">Amulet Stat Hub</p>
          </div>
        </div>

        {/* Public nav */}
        <nav className="flex-1 overflow-y-auto px-3 pt-4 space-y-0.5">
          <p className="px-2 py-1.5 text-[9px] uppercase tracking-[0.2em] text-[#4a3800]">เมนูหลัก</p>
          {navPublic.map(({ tab, label, icon: Icon }) => (
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
              <span className="truncate">{label}</span>
            </button>
          ))}

          <p className="px-2 py-1.5 mt-4 text-[9px] uppercase tracking-[0.2em] text-[#4a3800]">จัดการระบบ</p>
          {navAdmin.map(({ tab, label, icon: Icon }) => (
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
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>

        {/* Sidebar footer quote */}
        <div className="px-4 py-4 border-t border-[#1e1500]">
          <p className="text-[10px] text-[#6a5018] leading-5 italic">
            "พระดีมีคุณค่า ข้อมูลดีมีพลัง"
          </p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="ml-64 flex-1 flex flex-col min-h-screen relative z-10">
        {/* Page header */}
        <header className="sticky top-0 z-20 bg-[#0c0900]/80 backdrop-blur-xl border-b border-[#251b00] px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#6a5018] uppercase tracking-[0.2em]">{meta.en}</p>
            <h1 className="text-xl font-bold text-[#d4af37] mt-0.5">{meta.th}</h1>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[#4a3800]">
            <Flower2 className="h-3 w-3 text-[#c4982f]/50" />
            <span>มหานิยม999 เช็คชื่อ</span>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 px-8 py-8">
          {renderPage()}
        </main>

        {/* Footer */}
        <footer className="border-t border-[#1e1500] px-8 py-5 flex items-center justify-between">
          <p className="text-[10px] text-[#4a3800]">© 2026 เว็บ มหานิยม999 เช็คชื่อ เดเวอล็อป</p>
          <div className="flex items-center gap-2">
            {allNav.map(({ tab }) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  activeTab === tab ? 'bg-[#c4982f]' : 'bg-[#2a1e00] hover:bg-[#c4982f]/40'
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] text-[#4a3800]">Amulet Stat Hub v2.0</p>
        </footer>
      </div>
    </div>
  );
}
