import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CalendarPlus, Clock, Crown, ExternalLink, Facebook, Globe, LogIn, LogOut,
  Music2, QrCode, RefreshCw, UserCheck, UserMinus, Users, UserX, Video,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TodayWork } from '../components/TodayWork';
import {
  fetchEntries, fetchTodayBoard, subscribeTimeEntries,
  OVERTIME_THRESHOLD_HOURS as overtimeThresholdHours, type LeaveRequest, type TimeEntry, type TodayBoard,
} from '../lib/attendanceApi';
import { listTrackedAccounts, MAX_COMPANY_CHANNELS, type TrackedAccount } from '../lib/employeeApi';
import { dataService } from '../lib/dataService';
import { useAuthStore } from '../lib/authStore';
import { todayBangkok } from '../lib/dates';
import { buildTodayFeed, summarizeToday } from '../lib/todayBoard';
import type { LeaderboardEntry } from '../types';

/** เปลี่ยนรูปหน้าแรกได้ที่นี่ (วางไฟล์ไว้ใน public/) */
export const HERO_IMAGE = '/hero-temple.svg';

const fallbackLeaderboard: LeaderboardEntry[] = [
  { rank: 1, creator: 'พี่ใหญ่', name: 'พี่ใหญ่', value: 100 },
  { rank: 2, creator: 'น้องเอ', name: 'น้องเอ', value: 99 },
  { rank: 3, creator: 'น้องบี', name: 'น้องบี', value: 98 },
  { rank: 4, creator: 'น้องซี', name: 'น้องซี', value: 96 },
];

const timeFormat = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const fullDate = new Intl.DateTimeFormat('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });

function initials(name: string) {
  return name.trim().slice(0, 1) || '?';
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [now, setNow] = useState(() => new Date());
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({ views: [], likesFb: [], likesTt: [], hours: [] });
  const [monthEntries, setMonthEntries] = useState<TimeEntry[]>([]);
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [todayLeaves, setTodayLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<TodayBoard['employees']>([]);
  const [boardError, setBoardError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const today = todayBangkok(now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const loadToday = useCallback(async () => {
    setRefreshing(true);
    try {
      const board = await fetchTodayBoard();
      setTodayEntries(board.entries);
      setTodayLeaves(board.leaves);
      setEmployees(board.employees);
      setBoardError('');
      setLastUpdated(new Date());
    } catch (error) {
      setBoardError(error instanceof Error ? error.message : 'โหลดข้อมูลวันนี้ไม่สำเร็จ');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    listTrackedAccounts().then((list) => setAccounts(list.slice(0, MAX_COMPANY_CHANNELS)));
    Promise.all([
      dataService.fetchLeaderboard('views'),
      dataService.fetchLeaderboard('likes-fb'),
      dataService.fetchLeaderboard('likes-tt'),
      dataService.fetchLeaderboard('hours'),
    ]).then(([views, likesFb, likesTt, hours]) => setLeaderboards({ views, likesFb, likesTt, hours }));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadToday();
    fetchEntries({ month: todayBangkok().slice(0, 7) }).then(setMonthEntries);
    const unsubscribe = subscribeTimeEntries(() => { void loadToday(); });
    const poll = window.setInterval(() => { void loadToday(); }, 60000);
    return () => { unsubscribe(); window.clearInterval(poll); };
  }, [isAuthenticated, loadToday]);

  const activeEmployees = employees.filter((employee) => employee.is_active);
  const summary = summarizeToday(todayEntries, todayLeaves, activeEmployees.map((employee) => employee.id), today);
  const feed = buildTodayFeed(todayEntries, today);
  const scannedIds = new Set(todayEntries.filter((entry) => entry.check_in_time).map((entry) => entry.user_id));
  const leaveIds = new Set(todayLeaves.map((leave) => leave.user_id));
  const notYet = activeEmployees.filter((employee) => !scannedIds.has(employee.id) && !leaveIds.has(employee.id));

  const attendanceRows = monthEntries.filter((entry) => Number(entry.total_hours || 0) > 0);
  const totalWorkHours = attendanceRows.reduce((sum, entry) => sum + Number(entry.total_hours || 0), 0);
  const totalOtHours = attendanceRows.reduce((sum, entry) => sum + Math.max(0, Number(entry.total_hours || 0) - overtimeThresholdHours), 0);
  const workloadByEmployee = Array.from(attendanceRows.reduce((map, entry) => {
    const current = map.get(entry.user_id) || { name: entry.user_name, hours: 0, ot: 0 };
    const hours = Number(entry.total_hours || 0);
    current.hours += hours;
    current.ot += Math.max(0, hours - overtimeThresholdHours);
    map.set(entry.user_id, current);
    return map;
  }, new Map<string, { name: string; hours: number; ot: number }>()).values())
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 8)
    .map((row) => ({ ...row, hours: Number(row.hours.toFixed(1)), ot: Number(row.ot.toFixed(1)) }));

  const leaderboardSections = [
    { key: 'hours', label: 'ชั่วโมงทำงาน', suffix: 'ชม.', icon: Clock, rows: leaderboards.hours },
    { key: 'views', label: 'ยอดวิวสูงสุด', suffix: 'views', icon: Video, rows: leaderboards.views },
    { key: 'likesFb', label: 'ยอดไลก์ Facebook', suffix: 'likes', icon: Facebook, rows: leaderboards.likesFb },
    { key: 'likesTt', label: 'ยอดไลก์ TikTok', suffix: 'likes', icon: Music2, rows: leaderboards.likesTt },
  ];

  const kpis = [
    { label: 'พนักงานทั้งหมด', value: summary.total, icon: Users, tone: 'text-[var(--app-text)]' },
    { label: 'เข้างานแล้ว', value: summary.present, icon: UserCheck, tone: 'text-gold' },
    { label: 'ลาวันนี้', value: summary.onLeave, icon: UserMinus, tone: 'text-amber-300' },
    { label: 'ยังไม่ลงเวลา', value: summary.notYet, icon: UserX, tone: summary.notYet ? 'text-red-300' : 'text-[var(--app-text-muted)]' },
  ];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="hr-card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col justify-center gap-5 p-6 sm:p-8">
            <div>
              <p className="text-sm text-[var(--app-text-muted)]">{fullDate.format(now)}</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight">
                สวัสดี{user?.nickname ? ` ${user.nickname}` : ''} <span className="text-gold">พร้อมลุยวันนี้</span>
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">
                สแกน QR ที่จุดลงเวลาเพื่อเข้า/ออกงาน หรือจองวันลาล่วงหน้าได้จากที่นี่
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/scan" className="neon-button"><QrCode className="h-5 w-5" />สแกนลงเวลา</Link>
              <Link to="/attendance" className="neon-outline"><CalendarPlus className="h-5 w-5" />จองวันลา</Link>
            </div>
          </div>
          <div className="p-4 lg:p-5">
            <img
              src={HERO_IMAGE}
              alt="ภาพวัดไทยยามเช้า"
              className="neon-img h-48 w-full rounded-xl object-cover sm:h-64 lg:h-full lg:min-h-[260px]"
            />
          </div>
        </div>
      </section>

      {/* Today KPIs */}
      <section aria-label="สรุปวันนี้" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="hr-card p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--app-text-muted)]">{label}</p>
              <Icon className="h-5 w-5 text-gold/70" />
            </div>
            <p className={`mt-3 text-3xl font-bold tabular-nums ${tone}`}>{isAuthenticated ? value : '—'}</p>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">คน</p>
          </div>
        ))}
      </section>

      {/* Live attendance */}
      <section className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6">
        <div className="hr-card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="live-dot" aria-hidden="true" />
                <h3 className="text-lg font-semibold">ลงเวลาวันนี้</h3>
              </div>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                {lastUpdated ? `อัปเดตล่าสุด ${timeFormat.format(lastUpdated)} น. · อัปเดตอัตโนมัติ` : 'อัปเดตอัตโนมัติเมื่อมีคนสแกน'}
              </p>
            </div>
            {isAuthenticated && (
              <button className="work-icon" title="รีเฟรช" aria-label="รีเฟรชการลงเวลาวันนี้" disabled={refreshing} onClick={() => void loadToday()}>
                <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
          {!isAuthenticated ? (
            <p className="py-8 text-center text-sm text-[var(--app-text-muted)]">เข้าสู่ระบบเพื่อดูรายชื่อคนลงเวลาวันนี้</p>
          ) : boardError ? (
            <p role="alert" className="py-6 text-sm text-red-400">{boardError}</p>
          ) : feed.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--app-text-muted)]">ยังไม่มีใครลงเวลาวันนี้</p>
          ) : (
            <ul className="today-list divide-y divide-[var(--app-border-muted)]">
              {feed.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--app-accent-soft)] font-bold text-gold">{initials(item.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-xs text-[var(--app-text-muted)]">
                      {item.action === 'check_in' ? 'เข้างาน' : 'ออกงาน'}{item.status === 'late' && item.action === 'check_in' ? ' · มาสาย' : ''}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${item.action === 'check_in' ? 'neon-chip' : 'border border-[var(--app-border)] text-[var(--app-text-muted)]'}`}>
                    {item.action === 'check_in' ? <LogIn size={14} /> : <LogOut size={14} />}
                    {timeFormat.format(new Date(item.at))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className="hr-card p-5 sm:p-6">
            <h3 className="text-lg font-semibold">ยังไม่ลงเวลา</h3>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">ไม่รวมคนที่ลาวันนี้</p>
            {!isAuthenticated ? (
              <p className="py-6 text-sm text-[var(--app-text-muted)]">—</p>
            ) : notYet.length === 0 ? (
              <p className="py-6 text-sm text-gold">ทุกคนลงเวลาแล้ว</p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {notYet.map((employee) => (
                  <span key={employee.id} className="rounded-full border border-[var(--app-border)] px-3 py-1 text-sm">{employee.nickname}</span>
                ))}
              </div>
            )}
          </div>
          <TodayWork />
        </div>
      </section>

      {/* Diligence ranking */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--app-text-muted)]">Team Ranking</p>
            <h3 className="text-xl font-bold">อันดับคนขยันประจำเดือน</h3>
          </div>
          <Crown className="h-6 w-6 text-gold" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {leaderboardSections.map(({ key, label, suffix, icon: Icon, rows }) => {
            const entries = (rows.length > 0 ? rows : fallbackLeaderboard).slice(0, 4);
            return (
              <div key={key} className="hr-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-gold" />
                  <p className="text-sm font-semibold">{label}</p>
                </div>
                <ol className="space-y-2">
                  {entries.map((emp) => (
                    <li
                      key={`${key}-${emp.rank}-${emp.name}`}
                      className={`flex items-center gap-3 rounded-lg border p-3 ${emp.rank === 1 ? 'border-gold/50 bg-[var(--app-accent-faint)] shadow-[0_0_18px_-6px_rgba(57,255,136,0.5)]' : 'border-[var(--app-border-muted)]'}`}
                    >
                      <span className={`w-7 text-center font-mono text-sm font-bold ${emp.rank <= 3 ? 'text-gold' : 'text-[var(--app-text-muted)]'}`}>#{emp.rank}</span>
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">{emp.name || emp.creator}</p>
                      <span className="shrink-0 text-xs font-bold text-gold">{Math.round(emp.value).toLocaleString()} {suffix}</span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      </section>

      {/* Monthly workload */}
      {isAuthenticated && (
        <section className="hr-card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-[var(--app-text-muted)]">Workload เดือนนี้</p>
              <h3 className="text-lg font-semibold">ชั่วโมงสะสมตามพนักงาน</h3>
            </div>
            <div className="flex gap-6 text-sm">
              <p><span className="text-[var(--app-text-muted)]">รวม </span><strong className="text-gold">{Math.round(totalWorkHours).toLocaleString()} ชม.</strong></p>
              <p className="flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-amber-300" /><span className="text-[var(--app-text-muted)]">OT </span><strong className="text-amber-300">{Math.round(totalOtHours * 10) / 10} ชม.</strong></p>
            </div>
          </div>
          <div className="h-72">
            {workloadByEmployee.length === 0 ? (
              <p className="py-16 text-center text-sm text-[var(--app-text-muted)]">ยังไม่มีชั่วโมงทำงานเดือนนี้</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadByEmployee} layout="vertical" margin={{ top: 8, right: 20, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="#232b27" strokeDasharray="3 3" />
                  <XAxis type="number" stroke="#a3b0a8" fontSize={12} />
                  <YAxis dataKey="name" type="category" width={92} stroke="#a3b0a8" fontSize={12} />
                  <Tooltip contentStyle={{ background: '#171c19', border: '1px solid #34403a', borderRadius: 10 }} cursor={{ fill: 'rgba(57,255,136,0.06)' }} />
                  <Bar dataKey="hours" name="ชั่วโมงรวม" fill="#39ff88" radius={[0, 6, 6, 0]} />
                  <Bar dataKey="ot" name={`OT (เกิน ${overtimeThresholdHours} ชม.)`} fill="#fbbf24" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      )}

      {/* Company channels */}
      <section>
        <div className="mb-4">
          <p className="text-xs text-[var(--app-text-muted)]">ช่องทางที่แอคทีฟ</p>
          <h3 className="text-xl font-bold">เว็บและเพจของบริษัท</h3>
        </div>
        {accounts.length === 0 ? (
          <p className="text-sm text-[var(--app-text-muted)]">ยังไม่ได้ตั้งค่า — เพิ่มได้ที่หน้าตั้งค่า (สูงสุด {MAX_COMPANY_CHANNELS} ช่อง)</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {accounts.map((account) => {
              const Icon = account.platform === 'facebook' ? Facebook : account.platform === 'tiktok' ? Music2 : Globe;
              return (
                <a key={account.id} href={account.account_url} target="_blank" rel="noreferrer" className="hr-card group flex flex-col gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--app-accent-soft)] text-gold"><Icon className="h-5 w-5" /></span>
                    <ExternalLink className="h-4 w-4 text-[var(--app-text-muted)] group-hover:text-gold" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{account.account_name}</p>
                    <p className="truncate text-xs text-[var(--app-text-muted)]">{account.account_handle || account.account_url}</p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
