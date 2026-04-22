import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  AlertCircle, Calendar, CheckCircle2, ChevronDown, Clock,
  Download, Edit2, Gift, LogIn, LogOut, Plus, Save, Shield,
  Star, Timer, Upload, Users, X,
} from 'lucide-react';
import { useAuthStore } from '../lib/authStore';
import { listEmployees, loginEmployee as apiLoginEmployee, Employee } from '../lib/employeeApi';
import {
  checkIn, checkOut,
  fetchEntries, fetchLeaveQuota, fetchLeaveRequests, submitLeaveRequest,
  exportMonthlyReport, fetchRecentCheckins, adminUpdateEntry, adminCreateEntry,
  TimeEntry, LeaveRequest, LeaveQuota,
} from '../lib/attendanceApi';

const MANAGER_EMAIL = (import.meta.env.VITE_MANAGER_EMAIL as string) || '';

// ── Thai national holidays 2026 ────────────────────────────────────────────
const THAI_HOLIDAYS: { name: string; date: string }[] = [
  { name: 'วันแรงงาน',           date: '2026-05-01' },
  { name: 'วันฉัตรมงคล',         date: '2026-05-04' },
  { name: 'วันวิสาขบูชา',        date: '2026-05-11' },
  { name: 'วันเฉลิมฯ ร.10',      date: '2026-07-28' },
  { name: 'วันอาสาฬหบูชา',       date: '2026-07-29' },
  { name: 'วันเข้าพรรษา',        date: '2026-07-30' },
  { name: 'วันแม่แห่งชาติ',      date: '2026-08-12' },
  { name: 'วันปิยมหาราช',        date: '2026-10-23' },
  { name: 'วันพ่อแห่งชาติ',      date: '2026-12-05' },
  { name: 'วันรัฐธรรมนูญ',       date: '2026-12-10' },
  { name: 'วันสิ้นปี',           date: '2026-12-31' },
  { name: 'วันขึ้นปีใหม่ 2027',  date: '2027-01-01' },
];

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

// ── Status badge helper ────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, string> = {
  working:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  out:        'bg-blue-500/10 text-blue-400 border-blue-500/20',
  late:       'bg-red-500/10 text-red-400 border-red-500/20',
  leave:      'bg-zinc-800 text-zinc-400',
  'auto-leave': 'bg-zinc-800 text-zinc-500',
};
const STATUS_TH: Record<string, string> = {
  working: 'กำลังทำงาน', out: 'ออกงานแล้ว', late: 'มาสาย',
  leave: 'ลาหยุด', 'auto-leave': 'ลาอัตโนมัติ',
};

export function LineLogs() {
  const authUser = useAuthStore((s) => s.user);
  const isSuperAdmin = authUser?.role === 'super_admin';

  // ── Live clock ────────────────────────────────────────────────────────────
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const isLate = now.getHours() >= 12;
  const minutesUntilNoon = isLate ? 0 : (12 * 60) - (now.getHours() * 60 + now.getMinutes());

  // ── Upcoming holidays (next 4) ────────────────────────────────────────────
  const upcomingHolidays = useMemo(() =>
    THAI_HOLIDAYS.map(h => ({ ...h, days: daysUntil(h.date) }))
      .filter(h => h.days >= 0)
      .slice(0, 4),
  []);

  // ── Recent check-ins board ────────────────────────────────────────────────
  const [recentCheckins, setRecentCheckins] = useState<TimeEntry[]>([]);

  // ── Employee list (for picker) ────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [verifyEmpId, setVerifyEmpId] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifiedEmp, setVerifiedEmp] = useState<Employee | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // ── Attendance data (for verified employee) ───────────────────────────────
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [quota, setQuota] = useState<LeaveQuota | null>(null);

  // ── Photo upload (optional) ───────────────────────────────────────────────
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Sub-tabs ──────────────────────────────────────────────────────────────
  const [activeSubTab, setActiveSubTab] = useState<'attendance' | 'leave' | 'report' | 'admin'>('attendance');

  // ── Leave form ────────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [leaveType, setLeaveType] = useState<'personal' | 'sick' | 'vacation' | 'other'>('personal');
  const [leaveReason, setLeaveReason] = useState('');

  // ── Report ────────────────────────────────────────────────────────────────
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));

  // ── Admin retroactive edit ────────────────────────────────────────────────
  const [adminAllEntries, setAdminAllEntries] = useState<TimeEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editForm, setEditForm] = useState({ check_in_time: '', check_out_time: '', status: 'working', note: '' });
  const [newEntryForm, setNewEntryForm] = useState({
    userId: '', userName: '', workDate: '', checkInTime: '', checkOutTime: '', status: 'working', note: '',
  });
  const [adminTab, setAdminTab] = useState<'edit' | 'create'>('edit');

  // ── Loading / toast ───────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const todayStr = now.toISOString().slice(0, 10);
  const todayEntry = entries.find((e) => e.work_date === todayStr);
  const effectiveUser = verifiedEmp ?? (authUser ? { id: authUser.id, nickname: authUser.nickname || authUser.username, username: authUser.username } as any : null);

  // ── Load public data ──────────────────────────────────────────────────────
  const loadPublic = async () => {
    const [empList, recent] = await Promise.allSettled([
      listEmployees(),
      fetchRecentCheckins(),
    ]);
    if (empList.status === 'fulfilled') setEmployees(Array.isArray(empList.value) ? empList.value : []);
    if (recent.status === 'fulfilled') setRecentCheckins(Array.isArray(recent.value) ? recent.value : []);
  };

  // ── Load employee-specific data ───────────────────────────────────────────
  const loadPersonal = async (emp: { id: string; username?: string; nickname?: string }) => {
    setLoading(true);
    try {
      const [e, l, q] = await Promise.all([
        fetchEntries({ userId: emp.id, month: now.toISOString().slice(0, 7) }),
        fetchLeaveRequests({ userId: emp.id }),
        fetchLeaveQuota(emp.id),
      ]);
      setEntries(Array.isArray(e) ? e : []);
      setLeaves(Array.isArray(l) ? l : []);
      setQuota(q);
    } catch { /* silent */ }
    setLoading(false);
  };

  // ── Load admin all entries ────────────────────────────────────────────────
  const loadAdminEntries = async () => {
    try {
      const data = await fetchEntries({ month: now.toISOString().slice(0, 7) });
      setAdminAllEntries(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  };

  useEffect(() => { loadPublic(); }, []);
  useEffect(() => {
    if (authUser) loadPersonal(authUser);
  }, [authUser?.id]);
  useEffect(() => {
    if (isSuperAdmin && activeSubTab === 'admin') loadAdminEntries();
  }, [isSuperAdmin, activeSubTab]);

  // ── Verify employee ───────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!verifyEmpId || !verifyPassword) { setVerifyError('เลือกชื่อและใส่รหัสผ่าน'); return; }
    setVerifyLoading(true);
    setVerifyError('');
    try {
      const res = await apiLoginEmployee(verifyEmpId, verifyPassword);
      const emp = res.employee ?? res;
      setVerifiedEmp(emp);
      setVerifyPassword('');
      await loadPersonal(emp);
    } catch (err: any) {
      setVerifyError(err.message || 'รหัสผ่านไม่ถูกต้อง');
    }
    setVerifyLoading(false);
  };

  // ── Photo picker ──────────────────────────────────────────────────────────
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  // ── Check In / Out ────────────────────────────────────────────────────────
  const doCheckIn = async () => {
    if (!effectiveUser) return;
    setLoading(true);
    try {
      await checkIn({
        userId: effectiveUser.id,
        userName: effectiveUser.nickname || effectiveUser.username || effectiveUser.id,
        photo: photoFile ?? undefined,
      });
      showToast('success', 'เข้างานสำเร็จ');
      setPhotoFile(null); setPhotoPreview(null);
      await Promise.all([loadPersonal(effectiveUser), loadPublic()]);
    } catch (err: any) { showToast('error', err.message); }
    setLoading(false);
  };

  const doCheckOut = async () => {
    if (!effectiveUser) return;
    setLoading(true);
    try {
      await checkOut({
        userId: effectiveUser.id,
        userName: effectiveUser.nickname || effectiveUser.username || effectiveUser.id,
        photo: photoFile ?? undefined,
      });
      showToast('success', 'ออกงานสำเร็จ');
      setPhotoFile(null); setPhotoPreview(null);
      await Promise.all([loadPersonal(effectiveUser), loadPublic()]);
    } catch (err: any) { showToast('error', err.message); }
    setLoading(false);
  };

  // ── Leave ─────────────────────────────────────────────────────────────────
  const handleSubmitLeave = async () => {
    if (!effectiveUser || !selectedDate) { showToast('error', 'เลือกวันที่ก่อน'); return; }
    if (quota && !quota.allowed) { showToast('error', `โควต้าหมดแล้ว (${quota.used_count}/4)`); return; }
    setLoading(true);
    try {
      await submitLeaveRequest({
        userId: effectiveUser.id,
        userName: effectiveUser.nickname || effectiveUser.username || effectiveUser.id,
        leaveDate: selectedDate, leaveType, reason: leaveReason,
        managerEmail: MANAGER_EMAIL,
      });
      showToast('success', 'ส่งคำขอลาเรียบร้อย — รอหัวหน้าอนุมัติ');
      setSelectedDate(null); setLeaveReason('');
      await loadPersonal(effectiveUser);
    } catch (err: any) { showToast('error', err.message); }
    setLoading(false);
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await exportMonthlyReport(reportMonth);
      showToast('success', 'สร้างรายงานสำเร็จ');
      window.open(res.webViewLink, '_blank');
    } catch (err: any) { showToast('error', err.message); }
    setLoading(false);
  };

  // ── Admin edit ────────────────────────────────────────────────────────────
  const handleAdminEdit = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditForm({
      check_in_time: entry.check_in_time ? entry.check_in_time.slice(0, 16) : '',
      check_out_time: entry.check_out_time ? entry.check_out_time.slice(0, 16) : '',
      status: entry.status,
      note: entry.note || '',
    });
  };

  const handleAdminEditSave = async () => {
    if (!editingEntry || !authUser) return;
    setLoading(true);
    try {
      await adminUpdateEntry(authUser.role, editingEntry.id, {
        check_in_time: editForm.check_in_time ? new Date(editForm.check_in_time).toISOString() : undefined,
        check_out_time: editForm.check_out_time ? new Date(editForm.check_out_time).toISOString() : undefined,
        status: editForm.status,
        note: editForm.note,
      });
      showToast('success', 'แก้ไขข้อมูลสำเร็จ');
      setEditingEntry(null);
      loadAdminEntries();
    } catch (err: any) { showToast('error', err.message); }
    setLoading(false);
  };

  const handleAdminCreate = async () => {
    if (!authUser || !newEntryForm.userId || !newEntryForm.workDate) {
      showToast('error', 'กรุณาเลือกพนักงานและวันที่');
      return;
    }
    setLoading(true);
    try {
      await adminCreateEntry(authUser.role, {
        userId: newEntryForm.userId,
        userName: newEntryForm.userName,
        workDate: newEntryForm.workDate,
        checkInTime: newEntryForm.checkInTime ? new Date(newEntryForm.workDate + 'T' + newEntryForm.checkInTime).toISOString() : undefined,
        checkOutTime: newEntryForm.checkOutTime ? new Date(newEntryForm.workDate + 'T' + newEntryForm.checkOutTime).toISOString() : undefined,
        status: newEntryForm.status,
        note: newEntryForm.note,
      });
      showToast('success', 'สร้างข้อมูลย้อนหลังสำเร็จ');
      setNewEntryForm({ userId: '', userName: '', workDate: '', checkInTime: '', checkOutTime: '', status: 'working', note: '' });
      loadAdminEntries();
    } catch (err: any) { showToast('error', err.message); }
    setLoading(false);
  };

  // ── Calendar ──────────────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const year = now.getFullYear(), month = now.getMonth();
    const days: { date: string; day: number; hasLeave: boolean; leaveStatus?: string }[] = [];
    for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const leave = leaves.find((l) => l.leave_date === date);
      days.push({ date, day: d, hasLeave: !!leave, leaveStatus: leave?.status });
    }
    return days;
  }, [now, leaves]);

  return (
    <div className="space-y-6 relative">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-lg font-bold text-sm border ${
          toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
        }`}>{toast.msg}</div>
      )}

      {/* ── Row 1: Clock Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Big live clock */}
        <div className="glass-card p-6 rounded-3xl gold-border-glow text-center">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">เวลาปัจจุบัน</p>
          <p className="text-6xl font-mono font-black text-[#d4af37] tabular-nums tracking-tight leading-none">
            {now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <p className="text-base font-medium text-zinc-300 mt-3">
            {now.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Noon warning */}
        <div className={`glass-card p-6 rounded-3xl text-center ${isLate ? 'border-2 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'gold-border-glow'}`}>
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: isLate ? '#f87171' : '#a16207' }}>
            {isLate ? 'เลยเที่ยงแล้ว — มาสาย' : 'นาฬิกาเตือนเที่ยง'}
          </p>
          <p className={`text-5xl font-mono font-black tabular-nums leading-none ${isLate ? 'text-red-400' : 'text-emerald-400'}`}>
            {isLate ? '12:00' : `${String(Math.floor(minutesUntilNoon / 60)).padStart(2,'0')}:${String(minutesUntilNoon % 60).padStart(2,'0')}`}
          </p>
          <p className={`text-sm font-medium mt-3 ${isLate ? 'text-red-300' : 'text-zinc-300'}`}>
            {isLate
              ? 'การลงเวลาจะถูกบันทึกว่า "มาสาย"'
              : `อีก ${minutesUntilNoon} นาทีถึงเที่ยง — เข้างานก่อนนะ!`}
          </p>
          <p className="text-[10px] text-zinc-600 mt-1">ออกงานโดยยังไม่เข้างานก็ทำได้ (กรณีลืมลง)</p>
        </div>
      </div>

      {/* ── Row 2: Holiday countdown ── */}
      {upcomingHolidays.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {upcomingHolidays.map((h) => (
            <div key={h.date} className="glass-card p-4 rounded-2xl gold-border-glow text-center">
              <div className="flex justify-center mb-2">
                {h.days === 0 ? <Star className="w-5 h-5 text-gold" /> : <Gift className="w-5 h-5 text-[#c4982f]/70" />}
              </div>
              <p className="text-[10px] text-zinc-500 leading-tight mb-1">{h.name}</p>
              <p className="text-2xl font-black text-[#d4af37] tabular-nums">{h.days === 0 ? 'วันนี้!' : h.days}</p>
              {h.days > 0 && <p className="text-[10px] text-zinc-600">วัน</p>}
              <p className="text-[9px] text-zinc-700 mt-1">{h.date}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Row 3: Recent check-ins ── */}
      <div className="glass-card p-6 rounded-3xl gold-border-glow">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-5 h-5 text-gold/60" />
          <div>
            <h3 className="text-sm font-bold gold-text-gradient">ลงเวลาล่าสุดวันนี้</h3>
            <p className="text-[10px] text-zinc-500">10 คนล่าสุดที่ลงเวลาแล้ว</p>
          </div>
          <button onClick={loadPublic} className="ml-auto text-[10px] text-zinc-600 hover:text-zinc-400">รีเฟรช</button>
        </div>
        {recentCheckins.length === 0 ? (
          <p className="text-xs text-zinc-600 italic text-center py-3">ยังไม่มีใครลงเวลาวันนี้</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {recentCheckins.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 px-3 py-2 bg-zinc-900/60 rounded-xl border border-zinc-800">
                <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-[#c4982f]">
                  {entry.user_name?.[0] || '?'}
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-300">{entry.user_name}</p>
                  <p className="text-[10px] text-zinc-600 font-mono">
                    {entry.check_in_time ? new Date(entry.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    {entry.check_out_time ? ` → ${new Date(entry.check_out_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </p>
                </div>
                <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[entry.status] || 'text-zinc-500'}`}>
                  {STATUS_TH[entry.status] || entry.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Row 4: Employee Verify / Action ── */}
      {!authUser ? (
        <div className="glass-card p-8 rounded-3xl gold-border-glow max-w-2xl">
          <h3 className="text-lg font-serif italic font-bold gold-text-gradient mb-3">ลงเวลางาน</h3>
          <p className="text-sm text-zinc-500">
            โหมดผู้ชมเปิดให้ดูเวลาและรายการลงเวลาล่าสุดเท่านั้น กรุณาเข้าสู่ระบบด้วยรายชื่อหรือเบอร์โทรเพื่อเข้างาน ออกงาน ขอวันลา หรือดูรายงานส่วนตัว
          </p>
        </div>
      ) : !effectiveUser ? (
        /* Not verified — show picker */
        <div className="glass-card p-8 rounded-3xl gold-border-glow max-w-lg">
          <h3 className="text-lg font-serif italic font-bold gold-text-gradient mb-5">ลงเวลางาน</h3>
          <div className="space-y-4">
            {/* Employee picker */}
            <div>
              <label className="text-[10px] text-zinc-500 uppercase block mb-1">เลือกชื่อพนักงาน</label>
              <div className="relative">
                <select
                  value={verifyEmpId}
                  onChange={(e) => { setVerifyEmpId(e.target.value); setVerifyError(''); }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-sm text-zinc-200 appearance-none focus:outline-none focus:border-gold/50"
                >
                  <option value="">— เลือกชื่อ —</option>
                  {employees.filter(e => e.is_active).map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.nickname}{emp.full_name ? ` (${emp.full_name})` : ''}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-[10px] text-zinc-500 uppercase block mb-1">รหัสผ่านของคุณ</label>
              <input
                type="password"
                value={verifyPassword}
                onChange={(e) => { setVerifyPassword(e.target.value); setVerifyError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                placeholder="รหัสผ่าน"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-sm text-zinc-200 focus:outline-none focus:border-gold/50"
              />
            </div>

            {verifyError && (
              <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{verifyError}</p>
            )}

            <button
              onClick={handleVerify}
              disabled={verifyLoading || !verifyEmpId || !verifyPassword}
              className="w-full bg-gold text-black font-bold py-3 rounded-xl text-sm uppercase disabled:opacity-40 hover:bg-gold/90 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              {verifyLoading ? 'กำลังตรวจสอบ…' : 'ยืนยันตัวตน'}
            </button>
          </div>
        </div>
      ) : (
        /* Verified — show action area */
        <div className="space-y-4">
          {/* Verified header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm font-bold text-emerald-300">
                  {effectiveUser?.nickname || (effectiveUser as any)?.username || 'พนักงาน'}
                </p>
                <p className="text-[10px] text-emerald-600">ยืนยันตัวตนแล้ว</p>
              </div>
            </div>
            {!authUser && (
              <button
                onClick={() => { setVerifiedEmp(null); setEntries([]); setLeaves([]); setQuota(null); }}
                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> ออกจาก session
              </button>
            )}
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-2xl border border-zinc-900 w-fit flex-wrap">
            {[
              { k: 'attendance', label: 'ลงเวลา' },
              { k: 'leave', label: 'ขอลางาน' },
              { k: 'report', label: 'รายงาน' },
              ...(isSuperAdmin ? [{ k: 'admin', label: '🛡 Admin' }] : []),
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => setActiveSubTab(t.k as any)}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeSubTab === t.k ? 'bg-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Attendance tab ── */}
          {activeSubTab === 'attendance' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick action */}
              <div className="glass-card p-6 rounded-3xl gold-border-glow space-y-4">
                <h3 className="text-base font-serif italic font-bold gold-text-gradient">ลงเวลาวันนี้</h3>

                {todayEntry ? (
                  <div className="space-y-2 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 text-xs">
                    <div className="flex justify-between"><span className="text-zinc-500">เข้างาน:</span>
                      <span className="text-zinc-300 font-mono">{todayEntry.check_in_time ? new Date(todayEntry.check_in_time).toLocaleTimeString('th-TH') : '-'}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">ออกงาน:</span>
                      <span className="text-zinc-300 font-mono">{todayEntry.check_out_time ? new Date(todayEntry.check_out_time).toLocaleTimeString('th-TH') : '-'}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">ชั่วโมง:</span>
                      <span className="text-gold font-bold">{todayEntry.total_hours || 0} ชม.</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">สถานะ:</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${STATUS_STYLE[todayEntry.status] || ''}`}>{STATUS_TH[todayEntry.status] || todayEntry.status}</span></div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic">ยังไม่มีบันทึกวันนี้</p>
                )}

                {/* Photo upload (optional) */}
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase mb-2">แนบรูป (ไม่บังคับ)</p>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  {photoPreview ? (
                    <div className="relative">
                      <img src={photoPreview} alt="preview" className="w-full rounded-xl max-h-32 object-cover" />
                      <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        className="absolute top-1 right-1 bg-black/70 rounded-full p-1 text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-zinc-800 hover:border-zinc-600 rounded-xl py-3 text-xs text-zinc-500 flex items-center justify-center gap-2 transition">
                      <Upload className="w-4 h-4" /> เลือกรูป
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={doCheckIn}
                    disabled={loading || !!todayEntry?.check_in_time}
                    className="flex-1 flex items-center justify-center gap-2 bg-gold text-black font-bold py-3 rounded-xl text-xs uppercase disabled:opacity-30"
                  >
                    <LogIn className="w-4 h-4" /> เข้างาน
                  </button>
                  <button
                    onClick={doCheckOut}
                    disabled={loading || !!todayEntry?.check_out_time}
                    className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 text-zinc-200 font-bold py-3 rounded-xl text-xs uppercase disabled:opacity-30"
                  >
                    <LogOut className="w-4 h-4" /> ออกงาน
                  </button>
                </div>
              </div>

              {/* History table */}
              <div className="lg:col-span-2 glass-card p-6 rounded-3xl gold-border-glow">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-serif italic font-bold gold-text-gradient">ประวัติการลงเวลา (เดือนนี้)</h2>
                  <Timer className="w-5 h-5 text-gold/30" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-900">
                        <th className="pb-3">วันที่</th><th className="pb-3">เข้า</th><th className="pb-3">ออก</th>
                        <th className="pb-3">ชม.</th><th className="pb-3">รูป</th><th className="pb-3 text-right">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/50">
                      {entries.length === 0 && (
                        <tr><td colSpan={6} className="py-6 text-center text-xs text-zinc-500">{loading ? 'กำลังโหลด…' : 'ยังไม่มีข้อมูล'}</td></tr>
                      )}
                      {entries.map((e) => (
                        <tr key={e.id}>
                          <td className="py-3 text-xs text-zinc-400">{e.work_date}</td>
                          <td className="py-3 text-xs text-zinc-500 font-mono">{e.check_in_time ? new Date(e.check_in_time).toLocaleTimeString('th-TH') : '-'}</td>
                          <td className="py-3 text-xs text-zinc-500 font-mono">{e.check_out_time ? new Date(e.check_out_time).toLocaleTimeString('th-TH') : '-'}</td>
                          <td className="py-3 text-xs text-zinc-200 font-bold">{e.total_hours || 0}</td>
                          <td className="py-3 flex gap-1">
                            {e.check_in_photo_url && <a href={e.check_in_photo_url} target="_blank" rel="noreferrer" className="text-gold text-[10px] underline">เข้า</a>}
                            {e.check_out_photo_url && <a href={e.check_out_photo_url} target="_blank" rel="noreferrer" className="text-gold text-[10px] underline">ออก</a>}
                          </td>
                          <td className="py-3 text-right">
                            <span className={`text-[10px] px-2 py-1 rounded-full uppercase font-bold border ${STATUS_STYLE[e.status] || ''}`}>
                              {STATUS_TH[e.status] || e.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Leave tab ── */}
          {activeSubTab === 'leave' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 glass-card p-6 rounded-3xl gold-border-glow">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-serif italic font-bold gold-text-gradient">เลือกวันลา</h2>
                    <p className="text-[10px] text-zinc-500 mt-1">ลาได้เดือนละ 4 ครั้ง • คลิกวันที่เพื่อขอลา</p>
                  </div>
                  {quota && (
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-500 uppercase">โควต้าคงเหลือ</p>
                      <p className={`text-2xl font-bold ${quota.remaining > 0 ? 'gold-text-gradient' : 'text-red-500'}`}>{quota.remaining}/4</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {['อา','จ','อ','พ','พฤ','ศ','ส'].map(d => <div key={d} className="text-center text-[10px] text-zinc-500 pb-1">{d}</div>)}
                  {calendarDays.map(({ date, day, hasLeave, leaveStatus }) => {
                    const isSelected = selectedDate === date;
                    const isPast = date < todayStr;
                    const sc = leaveStatus === 'approved' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : leaveStatus === 'rejected' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : leaveStatus === 'pending' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : '';
                    return (
                      <button key={date} disabled={isPast || hasLeave} onClick={() => setSelectedDate(date)}
                        className={`p-2 rounded-xl border text-left transition-all text-xs font-bold
                          ${isSelected ? 'bg-gold/20 border-gold text-gold' : hasLeave ? sc : isPast ? 'bg-zinc-950 border-zinc-900 text-zinc-700 cursor-not-allowed' : 'bg-zinc-950/50 border-zinc-900 text-zinc-300 hover:border-gold/40'}`}>
                        {day}
                        {hasLeave && <CheckCircle2 className="w-2.5 h-2.5 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="glass-card p-6 rounded-3xl gold-border-glow space-y-4">
                <h3 className="text-base font-serif italic font-bold gold-text-gradient">รายละเอียดการลา</h3>
                {selectedDate ? (
                  <>
                    <div><label className="text-[10px] text-zinc-500 uppercase">วันที่</label>
                      <p className="text-sm font-bold text-gold mt-1">{selectedDate}</p></div>
                    <div><label className="text-[10px] text-zinc-500 uppercase">ประเภท</label>
                      <select value={leaveType} onChange={e => setLeaveType(e.target.value as any)}
                        className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200">
                        <option value="personal">ลากิจ</option><option value="sick">ลาป่วย</option>
                        <option value="vacation">ลาพักร้อน</option><option value="other">อื่น ๆ</option>
                      </select></div>
                    <div><label className="text-[10px] text-zinc-500 uppercase">เหตุผล</label>
                      <textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)}
                        placeholder="ระบุเหตุผล..." className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 h-20 resize-none" /></div>
                    <button onClick={handleSubmitLeave} disabled={loading}
                      className="w-full bg-gold text-black font-bold py-3 rounded-xl text-xs uppercase disabled:opacity-40 hover:bg-gold/90">ส่งคำขอลา</button>
                  </>
                ) : (
                  <p className="text-xs text-zinc-500 italic text-center py-6">เลือกวันในปฏิทินเพื่อขอลา</p>
                )}
                <div className="pt-3 border-t border-zinc-900">
                  <h4 className="text-[10px] text-zinc-500 uppercase mb-2">คำขอล่าสุด</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {leaves.slice(0, 6).map(l => (
                      <div key={l.id} className="p-2 bg-zinc-950/50 rounded-lg border border-zinc-900 text-xs flex justify-between">
                        <span className="text-zinc-300">{l.leave_date}</span>
                        <span className={l.status === 'approved' ? 'text-emerald-400' : l.status === 'rejected' ? 'text-red-400' : 'text-amber-400'}>{l.status}</span>
                      </div>
                    ))}
                    {leaves.length === 0 && <p className="text-[10px] text-zinc-600">—</p>}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-xs text-zinc-400">ลาได้เดือนละ 4 ครั้ง • ระบบส่งอีเมลแจ้งผู้จัดการอัตโนมัติ • ต้องขอลาก่อน 12:00</p>
              </div>
            </div>
          )}

          {/* ── Report tab ── */}
          {activeSubTab === 'report' && (
            <div className="glass-card p-8 rounded-3xl gold-border-glow">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-serif italic font-bold gold-text-gradient">ส่งออกรายงานรายเดือน</h2>
                <Calendar className="w-5 h-5 text-gold/30" />
              </div>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-[10px] text-zinc-500 uppercase">เดือน (YYYY-MM)</label>
                  <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)}
                    className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200" />
                </div>
                <button onClick={handleExport} disabled={loading}
                  className="flex items-center gap-2 bg-gold text-black font-bold px-6 py-3 rounded-xl text-xs uppercase disabled:opacity-40">
                  <Download className="w-4 h-4" /> ส่งออก
                </button>
              </div>
            </div>
          )}

          {/* ── Admin tab (super_admin only) ── */}
          {activeSubTab === 'admin' && isSuperAdmin && (
            <div className="glass-card p-6 rounded-3xl gold-border-glow space-y-6">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-gold" />
                <h2 className="text-base font-serif italic font-bold gold-text-gradient">แก้ไขข้อมูลย้อนหลัง (Admin)</h2>
              </div>

              {/* Admin sub-tabs */}
              <div className="flex gap-2">
                {[{k:'edit',label:'แก้ไขรายการ'},{k:'create',label:'สร้างรายการใหม่'}].map(t => (
                  <button key={t.k} onClick={() => setAdminTab(t.k as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${adminTab === t.k ? 'bg-gold/20 border-gold text-gold' : 'border-zinc-800 text-zinc-500'}`}>{t.label}</button>
                ))}
              </div>

              {/* Edit existing */}
              {adminTab === 'edit' && (
                <div>
                  {editingEntry ? (
                    <div className="space-y-4 max-w-lg">
                      <p className="text-xs text-zinc-400">แก้ไข: <strong className="text-zinc-200">{editingEntry.user_name}</strong> วันที่ {editingEntry.work_date}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase">เวลาเข้า</label>
                          <input type="datetime-local" value={editForm.check_in_time} onChange={e => setEditForm({...editForm, check_in_time: e.target.value})}
                            className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200" />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase">เวลาออก</label>
                          <input type="datetime-local" value={editForm.check_out_time} onChange={e => setEditForm({...editForm, check_out_time: e.target.value})}
                            className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200" />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase">สถานะ</label>
                          <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}
                            className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200">
                            <option value="working">กำลังทำงาน</option><option value="out">ออกงานแล้ว</option>
                            <option value="late">มาสาย</option><option value="leave">ลาหยุด</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase">หมายเหตุ</label>
                          <input value={editForm.note} onChange={e => setEditForm({...editForm, note: e.target.value})}
                            className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleAdminEditSave} disabled={loading}
                          className="flex items-center gap-2 bg-gold text-black font-bold px-5 py-2 rounded-xl text-xs uppercase disabled:opacity-40">
                          <Save className="w-4 h-4" /> บันทึก
                        </button>
                        <button onClick={() => setEditingEntry(null)} className="px-5 py-2 rounded-xl text-xs bg-zinc-800 text-zinc-300">ยกเลิก</button>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-900">
                            <th className="pb-3">วันที่</th><th className="pb-3">พนักงาน</th><th className="pb-3">เข้า</th>
                            <th className="pb-3">ออก</th><th className="pb-3">สถานะ</th><th className="pb-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900/50">
                          {adminAllEntries.length === 0 && (
                            <tr><td colSpan={6} className="py-6 text-center text-xs text-zinc-500">ไม่มีข้อมูล</td></tr>
                          )}
                          {adminAllEntries.map(e => (
                            <tr key={e.id}>
                              <td className="py-3 text-xs text-zinc-400">{e.work_date}</td>
                              <td className="py-3 text-xs text-zinc-300 font-semibold">{e.user_name}</td>
                              <td className="py-3 text-xs text-zinc-500 font-mono">{e.check_in_time ? new Date(e.check_in_time).toLocaleTimeString('th-TH') : '-'}</td>
                              <td className="py-3 text-xs text-zinc-500 font-mono">{e.check_out_time ? new Date(e.check_out_time).toLocaleTimeString('th-TH') : '-'}</td>
                              <td className="py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${STATUS_STYLE[e.status] || ''}`}>{STATUS_TH[e.status] || e.status}</span></td>
                              <td className="py-3">
                                <button onClick={() => handleAdminEdit(e)} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-gold">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Create new retroactive */}
              {adminTab === 'create' && (
                <div className="space-y-4 max-w-lg">
                  <p className="text-xs text-zinc-500">สร้างรายการลงเวลาย้อนหลัง (ตั้งแต่ 16 เม.ย. 2569 เป็นต้นไป)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase">พนักงาน</label>
                      <select value={newEntryForm.userId}
                        onChange={e => {
                          const emp = employees.find(emp => emp.id === e.target.value);
                          setNewEntryForm({...newEntryForm, userId: e.target.value, userName: emp?.nickname || ''});
                        }}
                        className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200">
                        <option value="">— เลือก —</option>
                        {employees.filter(e => e.is_active).map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.nickname}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase">วันที่</label>
                      <input type="date" min="2026-04-16" value={newEntryForm.workDate}
                        onChange={e => setNewEntryForm({...newEntryForm, workDate: e.target.value})}
                        className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200" />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase">เวลาเข้า</label>
                      <input type="time" value={newEntryForm.checkInTime}
                        onChange={e => setNewEntryForm({...newEntryForm, checkInTime: e.target.value})}
                        className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200" />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase">เวลาออก</label>
                      <input type="time" value={newEntryForm.checkOutTime}
                        onChange={e => setNewEntryForm({...newEntryForm, checkOutTime: e.target.value})}
                        className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200" />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase">สถานะ</label>
                      <select value={newEntryForm.status} onChange={e => setNewEntryForm({...newEntryForm, status: e.target.value})}
                        className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200">
                        <option value="working">กำลังทำงาน</option><option value="out">ออกงานแล้ว</option>
                        <option value="late">มาสาย</option><option value="leave">ลาหยุด</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase">หมายเหตุ</label>
                      <input value={newEntryForm.note} onChange={e => setNewEntryForm({...newEntryForm, note: e.target.value})}
                        className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200" />
                    </div>
                  </div>
                  <button onClick={handleAdminCreate} disabled={loading || !newEntryForm.userId || !newEntryForm.workDate}
                    className="flex items-center gap-2 bg-gold text-black font-bold px-5 py-3 rounded-xl text-xs uppercase disabled:opacity-40">
                    <Plus className="w-4 h-4" /> สร้างรายการ
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
