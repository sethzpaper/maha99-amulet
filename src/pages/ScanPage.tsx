import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, LogIn, LogOut, MapPin, QrCode, RotateCcw, XCircle } from 'lucide-react';
import { QrCamera } from '../components/QrCamera';
import {
  confirmScan, extractToken, fetchMyRecentEntries, getPosition, previewScan,
  type GeoFix, type ScanDecision,
} from '../lib/qrAttendanceApi';
import type { TimeEntry } from '../lib/attendanceApi';
import { displayDate } from '../lib/dates';

type Stage = 'idle' | 'camera' | 'locating' | 'confirm' | 'saving' | 'done' | 'error';

const clock = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const STATUS_TH: Record<string, string> = {
  working: 'กำลังทำงาน', out: 'ออกงานแล้ว', late: 'มาสาย', leave: 'ลา', 'auto-leave': 'ลา (อัตโนมัติ)', 'auto-out': 'ออกงานอัตโนมัติ',
};

export function ScanPage() {
  const [params, setParams] = useSearchParams();
  const [stage, setStage] = useState<Stage>('idle');
  const [message, setMessage] = useState('');
  const [decision, setDecision] = useState<ScanDecision | null>(null);
  const [recent, setRecent] = useState<TimeEntry[]>([]);
  const token = useRef<string | null>(null);
  const fix = useRef<GeoFix | null>(null);

  const loadRecent = useCallback(() => { fetchMyRecentEntries().then(setRecent).catch(() => setRecent([])); }, []);
  useEffect(loadRecent, [loadRecent]);

  const fail = (text: string) => { setMessage(text); setStage('error'); };

  const handleText = useCallback(async (text: string) => {
    const parsed = extractToken(text);
    if (!parsed) { fail('QR นี้ไม่ใช่ QR ลงเวลาของ Teamday'); return; }
    token.current = parsed;
    setStage('locating');
    try {
      fix.current = await getPosition();
    } catch (error) {
      fail(error instanceof Error ? error.message : 'หาตำแหน่งไม่สำเร็จ');
      return;
    }
    try {
      const result = await previewScan(parsed, fix.current);
      setDecision(result);
      if (result.ok) setStage('confirm');
      else fail(result.reason || 'ลงเวลาไม่ได้');
    } catch (error) {
      fail(error instanceof Error ? error.message : 'ตรวจสอบ QR ไม่สำเร็จ');
    }
  }, []);

  // Scanned with the phone's own camera app: /scan?t=TD1....
  useEffect(() => {
    const t = params.get('t');
    if (!t) return;
    setParams({}, { replace: true });
    void handleText(t);
  }, [params, setParams, handleText]);

  const onCameraError = useCallback((text: string) => fail(text), []);

  async function confirm() {
    if (!token.current) return;
    setStage('saving');
    try {
      const result = await confirmScan(token.current, fix.current);
      setDecision(result);
      if (result.ok && result.recorded) {
        setStage('done');
        navigator.vibrate?.(120);
        loadRecent();
      } else {
        fail(result.reason || 'บันทึกไม่สำเร็จ');
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ');
    }
  }

  const reset = () => { setStage('idle'); setDecision(null); setMessage(''); token.current = null; };
  const isIn = decision?.action === 'check_in';

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <section className="on-dark overflow-hidden rounded-[28px] p-6 sm:p-8">
        {stage === 'idle' && (
          <div className="space-y-5 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--app-accent)] text-[#0b2a1f]"><QrCode className="h-8 w-8" /></span>
            <div>
              <h2 className="text-3xl font-bold">สแกนลงเวลา</h2>
              <p className="mt-2 text-sm text-[var(--app-text-muted)]">ส่องกล้องไปที่ QR ที่ติดไว้ ณ จุดลงเวลา ระบบจะเช็คตำแหน่ง แล้วให้กดยืนยันเข้างานหรือออกงาน</p>
            </div>
            <button className="btn-pill btn-lime mx-auto" onClick={() => { setMessage(''); setStage('camera'); }}>
              เปิดกล้องสแกน <span className="btn-arrow"><ArrowRight className="h-4 w-4" /></span>
            </button>
            <p className="text-xs text-[var(--app-text-muted)]">หรือใช้แอปกล้องของมือถือสแกน QR ได้เลย ระบบจะพามาหน้านี้เอง</p>
          </div>
        )}

        {stage === 'camera' && (
          <div className="space-y-4 text-center">
            <QrCamera onResult={handleText} onError={onCameraError} />
            <button className="btn-pill btn-outline-lime mx-auto" onClick={reset}>ยกเลิก</button>
          </div>
        )}

        {(stage === 'locating' || stage === 'saving') && (
          <div role="status" className="space-y-4 py-8 text-center">
            <MapPin className="mx-auto h-10 w-10 animate-pulse text-gold" />
            <p className="text-lg font-semibold">{stage === 'locating' ? 'กำลังตรวจตำแหน่งและ QR...' : 'กำลังบันทึก...'}</p>
          </div>
        )}

        {stage === 'confirm' && decision && (
          <div className="space-y-6 text-center">
            <div>
              <p className="text-sm text-[var(--app-text-muted)]">{decision.site_name}{decision.distance_m != null ? ` · ห่าง ${decision.distance_m} ม.` : ''}</p>
              <h2 className="mt-1 text-2xl font-bold">{decision.employee_name}</h2>
              <p className="mt-3 text-5xl font-bold tabular-nums text-gold">{clock.format(new Date())}</p>
              {isIn && decision.late && <p className="mt-2 text-sm font-semibold text-amber-300">เลย 12:00 น. จะบันทึกเป็นมาสาย</p>}
              {!isIn && decision.check_in_time && <p className="mt-2 text-sm text-[var(--app-text-muted)]">เข้างานเมื่อ {clock.format(new Date(decision.check_in_time))} น.</p>}
            </div>
            <button className="btn-pill btn-lime btn-xl mx-auto" onClick={confirm}>
              {isIn ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
              {isIn ? 'ยืนยันเข้างาน' : 'ยืนยันออกงาน'}
              <span className="btn-arrow"><ArrowRight className="h-4 w-4" /></span>
            </button>
            <button className="text-sm text-[var(--app-text-muted)] underline" onClick={reset}>ยกเลิก</button>
          </div>
        )}

        {stage === 'done' && decision && (
          <div role="status" className="space-y-4 py-4 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-gold drop-shadow-[0_0_18px_rgba(196,245,66,0.7)]" />
            <h2 className="text-2xl font-bold">{isIn ? 'เข้างานแล้ว' : 'ออกงานแล้ว'} {clock.format(new Date(decision.at || Date.now()))} น.</h2>
            <p className="text-sm text-[var(--app-text-muted)]">{decision.site_name} · {decision.employee_name}</p>
            <button className="btn-pill btn-outline-lime mx-auto" onClick={reset}>เสร็จสิ้น</button>
          </div>
        )}

        {stage === 'error' && (
          <div role="alert" className="space-y-4 py-4 text-center">
            <XCircle className="mx-auto h-14 w-14 text-red-300" />
            <h2 className="text-xl font-bold">ลงเวลาไม่สำเร็จ</h2>
            <p className="text-sm leading-6 text-[var(--app-text-muted)]">{message}</p>
            <button className="btn-pill btn-lime mx-auto" onClick={reset}><RotateCcw className="h-4 w-4" />ลองใหม่</button>
          </div>
        )}
      </section>

      <section className="hr-card p-5">
        <span className="pill-label">ประวัติของฉัน</span>
        <h3 className="mt-3 text-lg font-semibold">ลงเวลา 7 วันล่าสุด</h3>
        {recent.length === 0 ? (
          <p className="py-6 text-sm text-[var(--app-text-muted)]">ยังไม่มีข้อมูล</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--app-border-muted)]">
            {recent.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="font-medium">{displayDate(entry.work_date)}</span>
                <span className="tabular-nums text-[var(--app-text-muted)]">
                  {entry.check_in_time ? clock.format(new Date(entry.check_in_time)) : '—'} – {entry.check_out_time ? clock.format(new Date(entry.check_out_time)) : '—'}
                </span>
                <span className="tag-chip">{STATUS_TH[entry.status] || entry.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
