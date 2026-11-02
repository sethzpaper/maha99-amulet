import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CalendarPlus, Clock, Facebook, Globe, LogIn, LogOut,
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
import { SLOGAN } from '../lib/brand';

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
    { label: 'ลาวันนี้', value: summary.onLeave, icon: UserMinus, tone: 'text-amber-700' },
    { label: 'ยังไม่ลงเวลา', value: summary.notYet, icon: UserX, tone: summary.notYet ? 'text-red-600' : 'text-[var(--app-text-muted)]' },
  ];

  const presentPct = summary.total ? Math.round((summary.present / summary.total) * 100) : 0;
  const [sloganTop, ...sloganRest] = SLOGAN.split(' ');

  return (
    <div className="space-y-10">
      {/* Hero — forest panel, big slogan, photo with live stat overlay */}
      <section className="on-dark rounded-[28px] p-5 sm:p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <h2 className="font-display text-5xl font-semibold leading-[1.05] sm:text-6xl xl:text-7xl">
            {sloganTop}<br />{sloganRest.join(' ')}
          </h2>
          <div className="space-y-4 lg:pb-2">
            <p className="text-sm text-[var(--app-text-muted)]">{fullDate.format(now)}</p>
            <p className="text-sm leading-6">
              สวัสดี{user?.nickname ? ` ${user.nickname}` : ''} สแกน QR ที่จุดลงเวลาด้วยมือถือของคุณเพื่อเข้า/ออกงาน หรือจองวันลาล่วงหน้าได้ที่นี่
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/scan" className="btn-pill btn-lime"><QrCode className="h-4 w-4" />สแกนลงเวลา<span className="btn-arrow"><ArrowRight className="h-4 w-4" /></span></Link>
              <Link to="/attendance" className="btn-pill btn-outline-lime"><CalendarPlus className="h-4 w-4" />จองวันลา<span className="btn-arrow"><ArrowRight className="h-4 w-4" /></span></Link>
            </div>
          </div>
        </div>

        <div className="relative mt-8">
          <div className="overflow-hidden rounded-[22px] neon-img">
            <img src={HERO_IMAGE} alt="ภาพวัดไทยยามเช้า" className="h-56 w-full object-cover sm:h-80 xl:h-96" />
          </div>
          <div className="glass-stat mt-3 rounded-2xl p-4 sm:absolute sm:bottom-4 sm:left-4 sm:mt-0 sm:w-[300px]">
            <p className="text-xs opacity-80">เข้างานวันนี้</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
              {isAuthenticated ? <>{summary.present}<span className="text-lg opacity-70"> / {summary.total} คน</span></> : '—'}
            </p>
            <div className="progress-track mt-3"><div className="progress-fill" style={{ width: `${isAuthenticated ? presentPct : 0}%` }} /></div>
            <div className="mt-2 flex justify-between text-[11px] opacity-80">
              <span>{isAuthenticated ? `ลา ${summary.onLeave} · ยังไม่ลงเวลา ${summary.notYet}` : 'เข้าสู่ระบบเพื่อดูสถานะ'}</span>
              {isAuthenticated && <span>{presentPct}%</span>}
            </div>
          </div>
          <div className="absolute bottom-4 right-4 hidden flex-wrap justify-end gap-2 sm:flex">
            <span className="tag-chip tag-chip-on">QR + GPS</span>
            <span className="tag-chip">จองวันลา</span>
            <span className="tag-chip">อัปเดตสด</span>
          </div>
        </div>
      </section>

      {/* Company channels strip (like the partner-logo band) */}
      {accounts.length > 0 && (
        <section aria-label="เว็บและเพจของบริษัท" className="channel-strip px-1">
          {accounts.map((account) => {
            const Icon = account.platform === 'facebook' ? Facebook : account.platform === 'tiktok' ? Music2 : Globe;
            return (
              <a key={account.id} href={account.account_url} target="_blank" rel="noreferrer"
                className="flex shrink-0 items-center gap-2 py-2 font-display text-lg font-semibold text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]">
                <Icon className="h-5 w-5 text-gold" />{account.account_name}
              </a>
            );
          })}
        </section>
      )}

      {/* Today — live feed (left card) + team status (right) */}
      <section className="grid grid-cols-1 gap-8 xl:grid-cols-[1.25fr_1fr]">
        <div className="rounded-[26px] bg-[var(--app-surface-strong)] p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="pill-label"><span className="live-dot mr-2" aria-hidden="true" />อัปเดตสด</span>
              <h3 className="mt-4 text-3xl font-semibold">ลงเวลาวันนี้</h3>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                {lastUpdated ? `อัปเดตล่าสุด ${timeFormat.format(lastUpdated)} น.` : 'อัปเดตอัตโนมัติเมื่อมีคนสแกน'}
              </p>
            </div>
            {isAuthenticated && (
              <button className="work-icon" title="รีเฟรช" aria-label="รีเฟรชการลงเวลาวันนี้" disabled={refreshing} onClick={() => void loadToday()}>
                <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
          <div className="mt-5 rounded-2xl bg-[var(--app-surface)] px-4">
            {!isAuthenticated ? (
              <p className="py-10 text-center text-sm text-[var(--app-text-muted)]">เข้าสู่ระบบเพื่อดูรายชื่อคนลงเวลาวันนี้</p>
            ) : boardError ? (
              <p role="alert" className="py-6 text-sm text-red-600">{boardError}</p>
            ) : feed.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--app-text-muted)]">ยังไม่มีใครลงเวลาวันนี้</p>
            ) : (
              <ul className="today-list divide-y divide-[var(--app-border-muted)]">
                {feed.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--forest)] font-bold text-[var(--app-accent)]">{initials(item.name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-xs text-[var(--app-text-muted)]">
                        {item.action === 'check_in' ? 'เข้างาน' : 'ออกงาน'}{item.status === 'late' && item.action === 'check_in' ? ' · มาสาย' : ''}
                      </p>
                    </div>
                    <span className={`tag-chip gap-1.5 ${item.action === 'check_in' ? 'tag-chip-on' : ''}`}>
                      {item.action === 'check_in' ? <LogIn size={13} /> : <LogOut size={13} />}
                      {timeFormat.format(new Date(item.at))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-2xl font-semibold leading-snug">ทีมพร้อมทุกวัน สแกนครั้งเดียวรู้ทันทีว่าใครมา ใครลา</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--app-text-muted)]">ลงเวลาด้วย QR + GPS ที่จุดทำงาน ระบบคิดชั่วโมงและ OT ให้อัตโนมัติ วันลาที่อนุมัติแล้วจะแสดงที่นี่ทันที</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {kpis.map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="hr-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-[var(--app-text-muted)]">{label}</p>
                  <Icon className="h-4 w-4 text-gold" />
                </div>
                <p className={`mt-2 font-display text-3xl font-semibold tabular-nums ${tone}`}>{isAuthenticated ? value : '—'}</p>
              </div>
            ))}
          </div>
          {isAuthenticated && notYet.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">ยังไม่ลงเวลา</p>
              <div className="flex flex-wrap gap-2">
                {notYet.map((employee) => <span key={employee.id} className="tag-chip">{employee.nickname}</span>)}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/attendance" className="btn-pill btn-dark">ดูตารางลงเวลา<span className="btn-arrow"><ArrowRight className="h-4 w-4" /></span></Link>
            <Link to="/stats" className="text-sm font-semibold text-[var(--app-text)] hover:underline">อันดับทั้งหมด →</Link>
          </div>
          <TodayWork />
        </div>
      </section>

      {/* Diligence ranking */}
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="pill-label">Team Ranking</span>
            <h3 className="mt-3 text-3xl font-semibold">อันดับคนขยันประจำเดือน</h3>
          </div>
          <Link to="/stats" className="btn-pill btn-outline-lime">ดูทั้งหมด<span className="btn-arrow"><ArrowRight className="h-4 w-4" /></span></Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {leaderboardSections.map(({ key, label, suffix, icon: Icon, rows }) => {
            const entries = (rows.length > 0 ? rows : fallbackLeaderboard).slice(0, 4);
            return (
              <div key={key} className="hr-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--app-accent-soft)]"><Icon className="h-4 w-4 text-gold" /></span>
                  <p className="text-sm font-semibold">{label}</p>
                </div>
                <ol className="space-y-2">
                  {entries.map((emp) => (
                    <li
                      key={`${key}-${emp.rank}-${emp.name}`}
                      className={`flex items-center gap-3 rounded-full px-3 py-2.5 ${emp.rank === 1 ? 'bg-[var(--forest)] text-white shadow-[0_8px_24px_-10px_rgba(120,200,20,0.7)]' : 'bg-[var(--app-surface-strong)]'}`}
                    >
                      <span className={`w-7 text-center font-display text-sm font-bold ${emp.rank === 1 ? 'text-[var(--app-accent)]' : 'text-[var(--app-text-muted)]'}`}>#{emp.rank}</span>
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">{emp.name || emp.creator}</p>
                      <span className={`shrink-0 text-xs font-bold ${emp.rank === 1 ? 'text-[var(--app-accent)]' : 'text-gold'}`}>{Math.round(emp.value).toLocaleString()} {suffix}</span>
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
        <section className="hr-card p-5 sm:p-7">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="pill-label">Workload เดือนนี้</span>
              <h3 className="mt-3 text-2xl font-semibold">ชั่วโมงสะสมตามพนักงาน</h3>
            </div>
            <div className="flex gap-6 text-sm">
              <p><span className="text-[var(--app-text-muted)]">รวม </span><strong className="text-gold">{Math.round(totalWorkHours).toLocaleString()} ชม.</strong></p>
              <p className="flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-amber-600" /><span className="text-[var(--app-text-muted)]">OT </span><strong className="text-amber-700">{Math.round(totalOtHours * 10) / 10} ชม.</strong></p>
            </div>
          </div>
          <div className="h-72">
            {workloadByEmployee.length === 0 ? (
              <p className="py-16 text-center text-sm text-[var(--app-text-muted)]">ยังไม่มีชั่วโมงทำงานเดือนนี้</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadByEmployee} layout="vertical" margin={{ top: 8, right: 20, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="#e3e9df" strokeDasharray="3 3" />
                  <XAxis type="number" stroke="#5b6d63" fontSize={12} />
                  <YAxis dataKey="name" type="category" width={92} stroke="#5b6d63" fontSize={12} />
                  <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #d3ddcf', borderRadius: 12 }} cursor={{ fill: 'rgba(196,245,66,0.18)' }} />
                  <Bar dataKey="hours" name="ชั่วโมงรวม" fill="#0c3a2b" radius={[0, 8, 8, 0]} />
                  <Bar dataKey="ot" name={`OT (เกิน ${overtimeThresholdHours} ชม.)`} fill="#c4f542" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
