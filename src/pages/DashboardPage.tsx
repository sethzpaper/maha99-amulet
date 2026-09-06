import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, Clock, Crown, Facebook, Medal, Music2, Users, Video, Zap } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { StatCards } from '../components/StatCards';
import { TodayWork } from '../components/TodayWork';
import { fetchEntries, OVERTIME_THRESHOLD_HOURS as overtimeThresholdHours, type TimeEntry } from '../lib/attendanceApi';
import { listTrackedAccounts, type TrackedAccount } from '../lib/employeeApi';
import { dataService } from '../lib/dataService';
import type { LeaderboardEntry } from '../types';
const fallbackLeaderboard = [
  { rank: 1, name: 'พี่ใหญ่', role: 'Director / Producer', kpi: 100, icon: Crown },
  { rank: 2, name: 'น้องเอ', role: 'Editor', kpi: 99, icon: Medal },
  { rank: 3, name: 'น้องบี', role: 'Motion Artist', kpi: 98, icon: Zap },
  { rank: 4, name: 'น้องซี', role: 'Account Executive', kpi: 96, icon: Zap },
  { rank: 5, name: 'น้องดี', role: 'Camera / Lighting', kpi: 94, icon: Zap },
  { rank: 6, name: 'น้องอี', role: 'Content Planner', kpi: 92, icon: Zap },
];

export function DashboardPage() {
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
      <TodayWork />
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
        <div className="border-t border-[var(--app-border-muted)] py-6">
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

        <div className="border-t border-[var(--app-border-muted)] py-6">
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
        <div className="border-t border-[var(--app-border-muted)] py-6 space-y-3">
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

        <div className="border-t border-[var(--app-border-muted)] py-6 space-y-3">
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

      <div className="border-t border-[var(--app-border-muted)] py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Social Overview</p>
            <h3 className="text-xl font-serif italic font-bold gold-text-gradient">ภาพรวมโซเชียล</h3>
          </div>
          <Activity className="w-5 h-5 text-gold/40" />
        </div>
        <div className="space-y-3">
          {sourceGraph.map((account) => (
            <div key={account.id} className="grid grid-cols-[minmax(0,1fr)_minmax(24px,1fr)_48px] items-center gap-3">
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

      <div className="border-t border-[var(--app-border-muted)] py-6">
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
