import { useEffect, useState, useCallback } from 'react';
import { ArrowUpRight, Check, X, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../lib/authStore';
import { listPendingLeaves, decideLeave } from '../lib/leaveApi';
import { displayDate, todayBangkok } from '../lib/dates';
import type { LeaveRequest } from '../lib/attendanceApi';
import { WorkDialog } from './WorkDialog';

export function TodayWork() {
  const role = useAuthStore((state) => state.user?.role);
  return role === 'admin' || role === 'super_admin' ? <TodayWorkContent /> : null;
}
function TodayWorkContent() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [decisionError, setDecisionError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setLeaves(await listPendingLeaves()); }
    catch (error) { setError(error instanceof Error ? error.message : 'โหลดงานวันนี้ไม่สำเร็จ'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function decide(status: 'approved' | 'rejected') {
    if (!selected) return;
    setBusy(true); setDecisionError('');
    try {
      await decideLeave(selected.id, status, note);
      setLeaves((rows) => rows.filter((row) => row.id !== selected.id));
      setSelected(null); setMessage(status === 'approved' ? 'อนุมัติใบลาแล้ว' : 'ปฏิเสธใบลาแล้ว');
    } catch (error) { setDecisionError(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  return (
    <section aria-label="งานวันนี้" className="border-b border-[var(--app-border)] pb-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">ใบลารออนุมัติ</h2><p className="text-sm text-[var(--app-text-muted)] mt-1">{displayDate(todayBangkok())}</p></div>
        <div className="flex items-center gap-3">
          <strong className="text-2xl tabular-nums">{loading || error ? '—' : leaves.length}</strong>
          <button className="work-icon" title="รีเฟรช" aria-label="รีเฟรชใบลา" disabled={loading} onClick={load}><RefreshCw size={18} /></button>
        </div>
      </div>
      {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
      {loading ? <p role="status">กำลังโหลด...</p> : error ? <p role="alert" className="text-red-400">{error}</p> : (
        <div className="today-list">
          {!leaves.length && <p className="py-5 text-sm text-[var(--app-text-muted)]">ไม่มีใบลารออนุมัติ</p>}
          {leaves.map((leave) => <div key={leave.id} className="today-row">
            <div className="min-w-0"><p className="font-medium break-words">{leave.user_name}</p><p className="text-sm text-[var(--app-text-muted)]">{displayDate(leave.leave_date)} · {leave.reason || 'ไม่ระบุเหตุผล'}</p></div>
            <button className="work-button shrink-0" onClick={() => { setSelected(leave); setNote(''); setDecisionError(''); }}>จัดการ<ArrowUpRight size={16} /></button>
          </div>)}
        </div>
      )}
      {selected && <WorkDialog title="จัดการใบลา" busy={busy} onClose={() => setSelected(null)}>
        <div className="space-y-4">
          <p className="font-semibold">{selected.user_name}</p>
          <p>{displayDate(selected.leave_date)} · {({ personal: 'ลากิจ', sick: 'ลาป่วย', vacation: 'ลาพักร้อน', other: 'อื่น ๆ' })[selected.leave_type]}</p>
          <p className="whitespace-pre-wrap break-words">{selected.reason || 'ไม่ระบุเหตุผล'}</p>
          <label className="work-field">หมายเหตุ<textarea disabled={busy} rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label>
          {decisionError && <p role="alert" className="text-red-400">{decisionError}</p>}
          <div className="flex justify-end gap-3 pt-3">
            <button className="work-button text-red-400" disabled={busy} onClick={() => decide('rejected')}><X size={16} />ปฏิเสธ</button>
            <button className="work-button work-primary" disabled={busy} onClick={() => decide('approved')}><Check size={16} />อนุมัติ</button>
          </div>
        </div>
      </WorkDialog>}
    </section>
  );
}
