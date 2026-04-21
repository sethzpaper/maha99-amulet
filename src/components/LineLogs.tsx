import { useEffect, useState, useRef, useMemo } from 'react';
import { Clock, CheckCircle2, Calendar, AlertCircle, Timer, Camera, LogIn, LogOut, Download, X } from 'lucide-react';
import { useAuthStore } from '../lib/authStore';
import {
  checkIn,
  checkOut,
  fetchEntries,
  fetchLeaveQuota,
  fetchLeaveRequests,
  submitLeaveRequest,
  exportMonthlyReport,
  TimeEntry,
  LeaveRequest,
  LeaveQuota,
} from '../lib/attendanceApi';

const MANAGER_EMAIL = (import.meta.env.VITE_MANAGER_EMAIL as string) || '';

export function LineLogs() {
  const user = useAuthStore((s) => s.user);
  const [activeSubTab, setActiveSubTab] = useState<'attendance' | 'leave' | 'report'>('attendance');
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [quota, setQuota] = useState<LeaveQuota | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [reportMonth, setReportMonth] = useState(currentMonth);

  // -------- Camera capture dialog --------
  const [captureOpen, setCaptureOpen] = useState<false | 'check-in' | 'check-out'>(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // -------- Leave request form --------
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveType, setLeaveType] = useState<'personal' | 'sick' | 'vacation' | 'other'>('personal');

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // -------- Load data --------
  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [e, l, q] = await Promise.all([
        fetchEntries({ userId: user.id, month: currentMonth }),
        fetchLeaveRequests({ userId: user.id }),
        fetchLeaveQuota(user.id),
      ]);
      setEntries(Array.isArray(e) ? e : []);
      setLeaves(Array.isArray(l) ? l : []);
      setQuota(q);
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [user?.id]);

  // -------- Camera --------
  const openCamera = async (mode: 'check-in' | 'check-out') => {
    setCaptureOpen(mode);
    setPhotoBlob(null);
    setPhotoPreview(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      showToast('error', 'ไม่สามารถเปิดกล้องได้');
      setCaptureOpen(false);
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCaptureOpen(false);
    setPhotoBlob(null);
    setPhotoPreview(null);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        setPhotoBlob(blob);
        setPhotoPreview(URL.createObjectURL(blob));
        // stop stream after capture
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      }
    }, 'image/jpeg', 0.85);
  };

  const confirmCapture = async () => {
    if (!user) return;
    if (!photoBlob) {
      showToast('error', 'กรุณาถ่ายรูปก่อน');
      return;
    }
    setLoading(true);
    try {
      if (captureOpen === 'check-in') {
        await checkIn({ userId: user.id, userName: user.username, photo: photoBlob });
        showToast('success', 'เข้างานสำเร็จ');
      } else if (captureOpen === 'check-out') {
        await checkOut({ userId: user.id, userName: user.username, photo: photoBlob });
        showToast('success', 'ออกงานสำเร็จ');
      }
      closeCamera();
      await loadAll();
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // -------- Leave actions --------
  const handleSubmitLeave = async () => {
    if (!user || !selectedDate) {
      showToast('error', 'เลือกวันที่ก่อน');
      return;
    }
    if (quota && !quota.allowed) {
      showToast('error', `โควต้าการลาเดือนนี้หมดแล้ว (${quota.used_count}/4)`);
      return;
    }
    setLoading(true);
    try {
      await submitLeaveRequest({
        userId: user.id,
        userName: user.username,
        leaveDate: selectedDate,
        leaveType,
        reason: leaveReason,
        managerEmail: MANAGER_EMAIL,
      });
      showToast('success', 'ส่งคำขอลาเรียบร้อย — รอหัวหน้าอนุมัติ');
      setSelectedDate(null);
      setLeaveReason('');
      await loadAll();
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // -------- Monthly report --------
  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await exportMonthlyReport(reportMonth);
      showToast('success', 'สร้างรายงานสำเร็จ');
      window.open(res.webViewLink, '_blank');
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // -------- Calendar grid --------
  const calendarDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: { date: string; day: number; hasLeave: boolean; leaveStatus?: string }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const leave = leaves.find((l) => l.leave_date === date);
      days.push({
        date,
        day: d,
        hasLeave: !!leave,
        leaveStatus: leave?.status,
      });
    }
    return days;
  }, [leaves]);

  const todayEntry = entries.find((e) => e.work_date === new Date().toISOString().slice(0, 10));

  return (
    <div className="space-y-6 relative">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-lg font-bold text-sm border ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Tab switch */}
      <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-2xl border border-zinc-900 w-fit flex-wrap">
        {[
          { k: 'attendance', label: 'สรุปการทำงาน' },
          { k: 'leave', label: 'ขอลางาน' },
          { k: 'report', label: 'รายงานรายเดือน' },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setActiveSubTab(t.k as any)}
            className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === t.k
                ? 'bg-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ============ TAB: ATTENDANCE ============ */}
      {activeSubTab === 'attendance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick action card */}
          <div className="glass-card p-8 rounded-3xl gold-border-glow space-y-4">
            <div>
              <h3 className="text-lg font-serif italic font-bold text-zinc-100 gold-text-gradient">
                ลงเวลาวันนี้
              </h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
                {new Date().toLocaleDateString('th-TH', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            {todayEntry ? (
              <div className="space-y-2 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">เข้างาน:</span>
                  <span className="text-zinc-300 font-mono">
                    {todayEntry.check_in_time
                      ? new Date(todayEntry.check_in_time).toLocaleTimeString('th-TH')
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">ออกงาน:</span>
                  <span className="text-zinc-300 font-mono">
                    {todayEntry.check_out_time
                      ? new Date(todayEntry.check_out_time).toLocaleTimeString('th-TH')
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">ชั่วโมงรวม:</span>
                  <span className="text-gold font-bold">
                    {todayEntry.total_hours || 0} ชม.
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">ยังไม่มีบันทึกเวลาวันนี้</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => openCamera('check-in')}
                disabled={loading || !!todayEntry?.check_in_time}
                className="flex-1 flex items-center justify-center gap-2 bg-gold text-black font-bold py-3 rounded-xl text-xs uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gold/90"
              >
                <LogIn className="w-4 h-4" /> เข้างาน
              </button>
              <button
                onClick={() => openCamera('check-out')}
                disabled={loading || !todayEntry?.check_in_time || !!todayEntry?.check_out_time}
                className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 text-zinc-200 font-bold py-3 rounded-xl text-xs uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-700"
              >
                <LogOut className="w-4 h-4" /> ออกงาน
              </button>
            </div>

            <p className="text-[10px] text-zinc-500 text-center flex items-center justify-center gap-1">
              <Camera className="w-3 h-3" /> ต้องถ่ายรูปยืนยัน
            </p>
          </div>

          {/* Attendance history table */}
          <div className="lg:col-span-2 glass-card p-8 rounded-3xl gold-border-glow">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">
                ประวัติการลงเวลา (เดือนนี้)
              </h2>
              <Timer className="w-5 h-5 text-gold/30" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-900">
                    <th className="pb-4">วันที่</th>
                    <th className="pb-4">เข้า</th>
                    <th className="pb-4">ออก</th>
                    <th className="pb-4">ชั่วโมง</th>
                    <th className="pb-4">รูป</th>
                    <th className="pb-4 text-right">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/50">
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-zinc-500">
                        {loading ? 'กำลังโหลด…' : 'ยังไม่มีข้อมูล'}
                      </td>
                    </tr>
                  )}
                  {entries.map((e) => (
                    <tr key={e.id} className="group">
                      <td className="py-4 text-xs text-zinc-400">{e.work_date}</td>
                      <td className="py-4 text-xs text-zinc-500 font-mono">
                        {e.check_in_time ? new Date(e.check_in_time).toLocaleTimeString('th-TH') : '-'}
                      </td>
                      <td className="py-4 text-xs text-zinc-500 font-mono">
                        {e.check_out_time ? new Date(e.check_out_time).toLocaleTimeString('th-TH') : '-'}
                      </td>
                      <td className="py-4 text-xs text-zinc-200 font-bold">{e.total_hours || 0}</td>
                      <td className="py-4">
                        <div className="flex gap-1">
                          {e.check_in_photo_url && (
                            <a href={e.check_in_photo_url} target="_blank" rel="noreferrer" className="text-gold text-[10px] underline">
                              เข้า
                            </a>
                          )}
                          {e.check_out_photo_url && (
                            <a href={e.check_out_photo_url} target="_blank" rel="noreferrer" className="text-gold text-[10px] underline">
                              ออก
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <span
                          className={`text-[10px] px-3 py-1 rounded-full uppercase font-bold tracking-tighter ${
                            e.status === 'late'
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                              : e.status === 'leave' || e.status === 'auto-leave'
                              ? 'bg-zinc-800 text-zinc-500'
                              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          }`}
                        >
                          {e.status}
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

      {/* ============ TAB: LEAVE ============ */}
      {activeSubTab === 'leave' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 glass-card p-8 rounded-3xl gold-border-glow">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">
                  เลือกวันลา
                </h2>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
                  ลาได้เดือนละ 4 ครั้ง • คลิกวันที่เพื่อขอลา
                </p>
              </div>
              {quota && (
                <div className="text-right">
                  <p className="text-[10px] text-zinc-500 uppercase">โควต้าคงเหลือ</p>
                  <p className={`text-2xl font-bold ${quota.remaining > 0 ? 'gold-text-gradient' : 'text-red-500'}`}>
                    {quota.remaining}/4
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d) => (
                <div key={d} className="text-center text-[10px] text-zinc-500 uppercase pb-2">
                  {d}
                </div>
              ))}
              {calendarDays.map(({ date, day, hasLeave, leaveStatus }) => {
                const isSelected = selectedDate === date;
                const isPast = date < new Date().toISOString().slice(0, 10);
                const statusColor =
                  leaveStatus === 'approved'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : leaveStatus === 'rejected'
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : leaveStatus === 'pending'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : '';
                return (
                  <button
                    key={date}
                    disabled={isPast || hasLeave}
                    onClick={() => setSelectedDate(date)}
                    className={`p-3 rounded-xl border text-left transition-all text-sm font-bold
                      ${isSelected ? 'bg-gold/20 border-gold text-gold' : hasLeave ? statusColor : isPast ? 'bg-zinc-950 border-zinc-900 text-zinc-700 cursor-not-allowed' : 'bg-zinc-950/50 border-zinc-900 text-zinc-300 hover:border-gold/40'}
                    `}
                  >
                    {day}
                    {hasLeave && <CheckCircle2 className="w-3 h-3 mt-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Leave form */}
          <div className="glass-card p-8 rounded-3xl gold-border-glow space-y-4">
            <h3 className="text-lg font-serif italic font-bold gold-text-gradient">รายละเอียดการลา</h3>

            {selectedDate ? (
              <>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase">วันที่เลือก</label>
                  <p className="text-sm font-bold text-gold mt-1">{selectedDate}</p>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase">ประเภทการลา</label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value as any)}
                    className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200"
                  >
                    <option value="personal">ลากิจ</option>
                    <option value="sick">ลาป่วย</option>
                    <option value="vacation">ลาพักร้อน</option>
                    <option value="other">อื่น ๆ</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase">เหตุผล</label>
                  <textarea
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    placeholder="ระบุเหตุผล..."
                    className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 h-24 resize-none"
                  />
                </div>
                <button
                  onClick={handleSubmitLeave}
                  disabled={loading}
                  className="w-full bg-gold text-black font-bold py-3 rounded-xl text-xs uppercase disabled:opacity-40 hover:bg-gold/90"
                >
                  ส่งคำขอลา
                </button>
              </>
            ) : (
              <p className="text-xs text-zinc-500 italic text-center py-8">
                เลือกวันที่ในปฏิทินเพื่อขอลา
              </p>
            )}

            {/* Leave history */}
            <div className="pt-4 border-t border-zinc-900">
              <h4 className="text-[10px] text-zinc-500 uppercase mb-3">คำขอลาล่าสุด</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {leaves.slice(0, 8).map((l) => (
                  <div key={l.id} className="p-2 bg-zinc-950/50 rounded-lg border border-zinc-900 text-xs flex justify-between">
                    <span className="text-zinc-300">{l.leave_date}</span>
                    <span
                      className={`font-bold ${
                        l.status === 'approved'
                          ? 'text-emerald-400'
                          : l.status === 'rejected'
                          ? 'text-red-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {l.status}
                    </span>
                  </div>
                ))}
                {leaves.length === 0 && <p className="text-[10px] text-zinc-600">—</p>}
              </div>
            </div>
          </div>

          {/* Rules */}
          <div className="lg:col-span-3 p-6 bg-amber-500/5 rounded-2xl border border-amber-500/10 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-500 mb-1 italic font-serif">กฎการลาหยุด:</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                ลาได้เดือนละ 4 ครั้ง • ระบบจะส่งอีเมลแจ้งผู้จัดการอัตโนมัติ • ต้องขอลาก่อนเวลา 12:00 ของวันที่ลา
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============ TAB: MONTHLY REPORT ============ */}
      {activeSubTab === 'report' && (
        <div className="glass-card p-8 rounded-3xl gold-border-glow">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">
              ส่งออกรายงานรายเดือน
            </h2>
            <Calendar className="w-5 h-5 text-gold/30" />
          </div>
          <p className="text-xs text-zinc-500 mb-4">
            รายงานจะถูกสร้างเป็นไฟล์ Google Sheet และเก็บไว้ในโฟลเดอร์ที่กำหนด
          </p>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-zinc-500 uppercase">เดือน (YYYY-MM)</label>
              <input
                type="month"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200"
              />
            </div>
            <button
              onClick={handleExport}
              disabled={loading}
              className="flex items-center gap-2 bg-gold text-black font-bold px-6 py-3 rounded-xl text-xs uppercase disabled:opacity-40 hover:bg-gold/90"
            >
              <Download className="w-4 h-4" /> ส่งออก
            </button>
          </div>
        </div>
      )}

      {/* ============ CAMERA DIALOG ============ */}
      {captureOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-zinc-100">
                {captureOpen === 'check-in' ? 'ถ่ายรูปเข้างาน' : 'ถ่ายรูปออกงาน'}
              </h3>
              <button onClick={closeCamera} className="text-zinc-500 hover:text-zinc-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {photoPreview ? (
              <img src={photoPreview} alt="preview" className="w-full rounded-xl mb-4" />
            ) : (
              <video ref={videoRef} className="w-full rounded-xl mb-4 bg-black" playsInline muted />
            )}

            <div className="flex gap-2">
              {!photoBlob ? (
                <button
                  onClick={capturePhoto}
                  className="flex-1 bg-gold text-black font-bold py-3 rounded-xl text-xs uppercase flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" /> ถ่ายรูป
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setPhotoBlob(null);
                      setPhotoPreview(null);
                      openCamera(captureOpen);
                    }}
                    className="flex-1 bg-zinc-800 text-zinc-200 font-bold py-3 rounded-xl text-xs uppercase"
                  >
                    ถ่ายใหม่
                  </button>
                  <button
                    onClick={confirmCapture}
                    disabled={loading}
                    className="flex-1 bg-emerald-500 text-black font-bold py-3 rounded-xl text-xs uppercase disabled:opacity-40"
                  >
                    {loading ? 'กำลังส่ง...' : 'ยืนยัน'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
