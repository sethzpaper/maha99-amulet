import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { type Tab, tabPaths, pathTabs } from './routes';
import {
  Menu,
  X,
  BarChart3,
  TrendingUp,
  Trophy,
  Facebook,
  Music2,
  Users,
  Clock,
  Video,
  ScanLine,
  MapPin,
  Settings,
  Flower2,
  Globe,
  LogIn,
  LogOut,
  Shield,
  Sparkles,
} from 'lucide-react';
import { FacebookPosts } from './components/FacebookPosts';
import { TikTokPosts } from './components/TikTokPosts';
import { AdminStats } from './components/AdminStats';
import { EmployeeList } from './components/EmployeeList';
import { LineLogs } from './components/LineLogs';
import { CompetitorComparison } from './components/CompetitorComparison';
import { Settings as SettingsPage } from './components/Settings';
import { Login } from './components/Login';
import { useAuthStore } from './lib/authStore';

type NavItem = { tab: Tab; label: string; icon: string };
type NavSection = { title: string; items: NavItem[] };
const navIcons = {
  dashboard: BarChart3, query_stats: TrendingUp, leaderboard: Trophy,
  facebook: Facebook, music_note: Music2, groups: Users, schedule: Clock,
  qr_scan: ScanLine, map_pin: MapPin, video_library: Video,
  admin_panel_settings: Settings,
};

const pageMeta: Record<Tab, { th: string; en: string }> = {
  scan: { th: 'สแกนลงเวลา', en: 'QR Check-in' },
  sites: { th: 'จุดลงเวลา & QR', en: 'Attendance Sites' },
  clips: { th: 'คลิปประจำเดือน', en: 'Monthly Clips' },
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

const scanNavItem: NavItem = { tab: 'scan', label: 'สแกนลงเวลา', icon: 'qr_scan' };

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
    title: 'ลงเวลา',
    items: [
      scanNavItem,
      { tab: 'lineLogs', label: 'ตารางลงเวลา / OT', icon: 'schedule' },
      { tab: 'sites', label: 'จุดลงเวลา & QR', icon: 'map_pin' },
    ],
  },
  {
    title: 'คอนเทนต์',
    items: [
      { tab: 'clips', label: 'คลิปประจำเดือน', icon: 'video_library' },
    ],
  },
  {
    title: 'พนักงาน',
    items: [
      { tab: 'employees', label: 'ทำเนียบพนักงาน', icon: 'groups' },
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

const employeeNavSections: NavSection[] = [
  ...publicNavSections,
  { title: 'ลงเวลา', items: [scanNavItem] },
];

const publicTabs = new Set<Tab>(trendNavItems.map((item) => item.tab));
const employeeTabs = new Set<Tab>([...publicTabs, 'scan']);
function AdminGate({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-220px)] max-w-3xl items-center">
      <div className="glass-card w-full rounded-3xl border border-gold/20 p-8 gold-border-glow">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
            <Shield className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#6a5018]">Members only</p>
            <h2 className="mt-2 text-2xl font-serif italic font-bold gold-text-gradient">
              เมนูหลักถูกซ่อนไว้
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              หน้านี้เปิดให้เฉพาะผู้ที่เข้าสู่ระบบแล้ว ส่วนข้อมูลลงเวลา คลิปประจำเดือน และพนักงาน
              ต้องใช้บัญชี admin หรือ super admin
            </p>
            <button
              onClick={onLogin}
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-gold/40 bg-[var(--app-surface)] px-4 py-3 text-sm font-bold text-gold transition-all hover:border-gold/70 hover:bg-gold/10"
            >
              <LogIn className="h-4 w-4" />
              <span>เข้าสู่ระบบ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const activeTab = pathTabs[location.pathname.replace(/\/+$/, '') || '/'];
  const [showLogin, setShowLogin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  const [lang, setLang] = useState<'th' | 'en'>('th');
  const { user, isAuthenticated, isLoading, logout, loadSession } = useAuthStore();
  useEffect(() => { void loadSession(); }, [loadSession]);

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const visibleNavSections = isAdmin ? navSections : isAuthenticated ? employeeNavSections : publicNavSections;
  const canViewActiveTab = isAdmin || (isAuthenticated ? employeeTabs : publicTabs).has(activeTab);
  const meta = pageMeta[activeTab || 'dashboard'];


  const renderPage = () => {
    if (!activeTab) return <p role="status">ไม่พบหน้าที่ต้องการ</p>;
    if (isLoading) return <p role="status">กำลังตรวจสอบเซสชัน...</p>;
    if (!canViewActiveTab) {
      return <AdminGate onLogin={() => setShowLogin(true)} />;
    }

    switch (activeTab) {
      case 'scan': return <ComingSoonPage title="สแกนลงเวลาด้วย QR Code" phase="เฟส 4">สแกน QR ที่ติดไว้ ณ จุดลงเวลา ระบบจะตรวจพิกัด GPS แล้วบันทึกเข้า/ออกงานให้อัตโนมัติ</ComingSoonPage>;
      case 'sites': return <ComingSoonPage title="จุดลงเวลา & QR Code" phase="เฟส 4">กำหนดพิกัดและรัศมีของแต่ละจุด แล้วพิมพ์ QR ไปติดหน้างาน</ComingSoonPage>;
      case 'clips': return <ComingSoonPage title="คลิปประจำเดือน" phase="เฟส 2">เลือกเดือนแล้วดูรายการคลิป: วันที่ ชื่อคลิป ผู้ทำ (รอข้อมูลจาก Google Sheet)</ComingSoonPage>;
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
    <div className="app-shell min-h-screen flex bg-[var(--app-bg)]">


      {menuOpen && <button aria-label="ปิดเมนู" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-black/60 md:hidden" />}
      <aside data-open={menuOpen} className="fixed top-0 left-0 h-full w-64 z-30 bg-[var(--app-bg-deep)] border-r border-[var(--app-border-muted)] flex flex-col">
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
                  <NavLink
                    key={tab}
                    to={tabPaths[tab]}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold rounded-xl transition-all text-left ${
                      activeTab === tab
                        ? 'bg-gold/10 text-gold border border-gold/20'
                        : 'text-[var(--app-text-muted)] border border-transparent hover:bg-[var(--app-surface)]'
                    }`}
                  >
                    {(() => { const Icon = navIcons[icon]; return <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />; })()}
                    <span className="truncate">{label}</span>
                    {tab === 'settings' && !isSuperAdmin && <span className="ml-auto text-[9px] text-[#4a3800]">admin</span>}
                  </NavLink>
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
              <p>{isAuthenticated ? 'เมนูบริษัท ลงเวลา คอนเทนต์ พนักงาน และจัดการระบบ สำหรับแอดมิน' : 'ดูหมวดแนวโน้มได้ทันที เข้าสู่ระบบเพื่อสแกนลงเวลา'}</p>
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

      <div className="app-content ml-64 flex-1 flex flex-col min-h-screen relative z-10">
        <header className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--app-bg)_80%,transparent)] backdrop-blur-xl border-b border-[var(--app-border-muted)] px-8 py-4 flex items-center justify-between">
          <button className="mobile-menu h-10 w-10 shrink-0 items-center justify-center" title="เปิดเมนู" aria-label="เปิดเมนู" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Menu /></button>
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
        <div role="dialog" aria-modal="true" aria-label="เข้าสู่ระบบ" onKeyDown={(event) => { if (event.key === 'Escape') setShowLogin(false); }} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md relative">
            <button
              onClick={() => setShowLogin(false)}
              aria-label="ปิดหน้าต่างเข้าสู่ระบบ"
              className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <Login onLoginSuccess={() => setShowLogin(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
