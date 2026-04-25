import { useEffect, useState } from 'react';
import { Check, KeyRound, RefreshCw, X } from 'lucide-react';
import {
  approveResetRequest,
  listResetRequests,
  rejectResetRequest,
  type PasswordResetRequest,
  type ResetStatus,
} from '../lib/passwordResetApi';

interface Props {
  approverName: string;
  canApprove: boolean;
}

const STATUS_LABEL: Record<ResetStatus, string> = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ปฏิเสธ',
  cancelled: 'ยกเลิก',
};

const STATUS_STYLE: Record<ResetStatus, string> = {
  pending:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  approved:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rejected:  'bg-red-500/10 text-red-400 border-red-500/20',
  cancelled: 'bg-zinc-800 text-zinc-500 border-zinc-700',
};

export function PasswordResetAdmin({ approverName, canApprove }: Props) {
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [items, setItems] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { pwd: string; note: string }>>({});
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    window.setTimeout(() => setMsg(null), 3000);
  };

  const reload = async () => {
    setLoading(true);
    try {
      const list = await listResetRequests(filter === 'pending' ? 'pending' : undefined);
      setItems(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [filter]);

  const setField = (id: string, key: 'pwd' | 'note', val: string) => {
    setDraft((d) => ({ ...d, [id]: { ...(d[id] || { pwd: '', note: '' }), [key]: val } }));
  };

  const handleApprove = async (req: PasswordResetRequest) => {
    if (!canApprove) return flash('err', 'คุณไม่มีสิทธิ์อนุมัติ');
    const d = draft[req.id] || { pwd: '', note: '' };
    if (d.pwd.length < 4) return flash('err', 'รหัสใหม่ต้องอย่างน้อย 4 ตัวอักษร');
    setBusyId(req.id);
    try {
      await approveResetRequest({
        requestId: req.id,
        newPassword: d.pwd,
        approverName,
        note: d.note || undefined,
      });
      flash('ok', `อนุมัติสำเร็จ — รหัสใหม่ของ ${req.user_name || req.employee_code}: ${d.pwd}`);
      setDraft((cur) => { const n = { ...cur }; delete n[req.id]; return n; });
      reload();
    } catch (err: any) {
      flash('err', err?.message || 'อนุมัติไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (req: PasswordResetRequest) => {
    if (!canApprove) return flash('err', 'คุณไม่มีสิทธิ์ปฏิเสธ');
    const d = draft[req.id] || { pwd: '', note: '' };
    setBusyId(req.id);
    try {
      await rejectResetRequest({ requestId: req.id, approverName, note: d.note || undefined });
      flash('ok', 'ปฏิเสธคำขอแล้ว');
      reload();
    } catch (err: any) {
      flash('err', err?.message || 'ปฏิเสธไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-bold text-zinc-100">คำขอรีเซ็ตรหัสผ่าน</h3>
        <button onClick={reload} className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> รีเฟรช
        </button>
      </div>

      <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800 rounded-xl p-1 w-fit">
        {(['pending', 'all'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              filter === k ? 'bg-gold/20 text-gold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {k === 'pending' ? 'รออนุมัติ' : 'ทั้งหมด'}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`px-4 py-2 rounded-xl text-xs border ${
          msg.type === 'ok'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : 'bg-red-500/10 text-red-400 border-red-500/30'
        }`}>{msg.text}</div>
      )}

      {!canApprove && (
        <div className="bg-amber-500/5 border border-amber-500/20 text-amber-400 text-xs px-4 py-3 rounded-xl">
          เฉพาะ Admin / Super Admin เท่านั้นที่อนุมัติได้
        </div>
      )}

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-xs text-zinc-600 italic text-center py-6">
            {loading ? 'กำลังโหลด...' : 'ไม่มีคำขอ'}
          </p>
        ) : items.map((req) => {
          const d = draft[req.id] || { pwd: '', note: '' };
          const isPending = req.status === 'pending';
          return (
            <div key={req.id} className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-zinc-200">
                    {req.user_name || '(ไม่ทราบชื่อ)'} <span className="text-zinc-500 font-mono text-xs">[{req.employee_code}]</span>
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    ขอเมื่อ {new Date(req.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full border font-bold ${STATUS_STYLE[req.status]}`}>
                  {STATUS_LABEL[req.status]}
                </span>
              </div>

              {req.reason && (
                <p className="text-xs text-zinc-400 bg-zinc-900/60 rounded-xl px-3 py-2">
                  เหตุผล: <span className="text-zinc-300">{req.reason}</span>
                </p>
              )}

              {req.status !== 'pending' && (
                <p className="text-[10px] text-zinc-500">
                  {req.status === 'approved' ? 'อนุมัติโดย ' : 'ปฏิเสธโดย '}
                  <span className="text-zinc-300 font-bold">{req.approved_by || '-'}</span>
                  {req.approved_at && ` เมื่อ ${new Date(req.approved_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`}
                  {req.approver_note && <> · <span className="italic">{req.approver_note}</span></>}
                </p>
              )}

              {isPending && canApprove && (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-2 pt-2 border-t border-zinc-900">
                  <input
                    type="text"
                    value={d.pwd}
                    onChange={(e) => setField(req.id, 'pwd', e.target.value)}
                    placeholder="รหัสผ่านใหม่ (อย่างน้อย 4 ตัว)"
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:border-gold/40 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={d.note}
                    onChange={(e) => setField(req.id, 'note', e.target.value)}
                    placeholder="หมายเหตุ (ไม่บังคับ)"
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:border-gold/40 focus:outline-none"
                  />
                  <button
                    disabled={busyId === req.id}
                    onClick={() => handleApprove(req)}
                    className="inline-flex items-center justify-center gap-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> อนุมัติ
                  </button>
                  <button
                    disabled={busyId === req.id}
                    onClick={() => handleReject(req)}
                    className="inline-flex items-center justify-center gap-1 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" /> ปฏิเสธ
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
