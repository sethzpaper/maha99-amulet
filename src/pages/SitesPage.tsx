import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowRight, Crosshair, Download, MapPin, Pencil, Plus, Printer, RefreshCw, Trash2, X } from 'lucide-react';
import {
  deleteSite, getPosition, listSites, parseLatLng, qrUrl, rotateSiteToken, saveSite, siteToken,
  type AttendanceSite,
} from '../lib/qrAttendanceApi';
import { WorkDialog } from '../components/WorkDialog';

type Draft = { id?: string; name: string; coords: string; radius_m: number; require_gps: boolean; is_active: boolean };
const emptyDraft: Draft = { name: '', coords: '', radius_m: 150, require_gps: true, is_active: true };

async function qrImage(token: string) {
  return QRCode.toDataURL(qrUrl(window.location.origin, token), { width: 720, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0b2a1f', light: '#ffffff' } });
}

function printQr(site: AttendanceSite, image: string) {
  const win = window.open('', '_blank', 'width=720,height=960');
  if (!win) return;
  const name = site.name.replace(/[<>&"]/g, '');
  win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>QR ลงเวลา - ${name}</title>
<style>body{font-family:"IBM Plex Sans Thai",system-ui,sans-serif;text-align:center;margin:40px;color:#0b2a1f}
h1{font-size:40px;margin:0 0 4px}h2{font-size:22px;font-weight:500;margin:0 0 24px;color:#356b55}
img{width:440px;max-width:100%;border:10px solid #c4f542;border-radius:28px}
p{font-size:20px;line-height:1.6}.brand{margin-top:28px;font-weight:700;font-size:18px}</style></head>
<body><h1>สแกนลงเวลา</h1><h2>${name}</h2><img src="${image}" alt="QR"/>
<p>1. เปิดกล้องมือถือแล้วสแกน QR นี้<br/>2. อนุญาตตำแหน่ง (GPS)<br/>3. กด “ยืนยันเข้างาน / ออกงาน”</p>
<p class="brand">มหานิยม999ทีมพร้อม · Teamday — บารมี สแกน แรง</p>
<script>window.onload=function(){window.print()}</script></body></html>`);
  win.document.close();
}

export function SitesPage() {
  const [sites, setSites] = useState<AttendanceSite[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await listSites();
      setSites(list);
      const entries = await Promise.all(list.map(async (site) => [site.id, await qrImage(await siteToken(site.id))] as const));
      setImages(Object.fromEntries(entries));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดจุดลงเวลาไม่สำเร็จ');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!draft) return;
    const coords = draft.coords.trim() ? parseLatLng(draft.coords) : null;
    if (!draft.name.trim()) { setError('กรอกชื่อจุดลงเวลา'); return; }
    if (draft.coords.trim() && !coords) { setError('รูปแบบพิกัดไม่ถูกต้อง ตัวอย่าง: 13.7563, 100.5018'); return; }
    if (draft.require_gps && !coords) { setError('ต้องใส่พิกัดเมื่อเปิดตรวจ GPS'); return; }
    setBusy(true);
    try {
      await saveSite({
        id: draft.id, name: draft.name.trim(), lat: coords?.lat ?? null, lng: coords?.lng ?? null,
        radius_m: draft.radius_m, require_gps: draft.require_gps, is_active: draft.is_active,
      });
      setDraft(null);
      setMessage('บันทึกจุดลงเวลาแล้ว');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally { setBusy(false); }
  }

  async function useHere() {
    try {
      const fix = await getPosition();
      setDraft((d) => d && { ...d, coords: `${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)}` });
      setMessage(`ได้ตำแหน่งแล้ว (คลาดเคลื่อนประมาณ ${Math.round(fix.accuracy)} ม.)`);
    } catch (err) { setError(err instanceof Error ? err.message : 'หาตำแหน่งไม่สำเร็จ'); }
  }

  async function rotate(site: AttendanceSite) {
    if (!window.confirm(`สร้าง QR ใหม่ให้ "${site.name}"? QR เดิมที่พิมพ์ไว้จะใช้ไม่ได้ทันที`)) return;
    try {
      const token = await rotateSiteToken(site.id);
      setImages((m) => ({ ...m, [site.id]: '' }));
      const image = await qrImage(token);
      setImages((m) => ({ ...m, [site.id]: image }));
      setMessage('สร้าง QR ใหม่แล้ว อย่าลืมพิมพ์ไปติดแทนแผ่นเดิม');
    } catch (err) { setError(err instanceof Error ? err.message : 'สร้าง QR ใหม่ไม่สำเร็จ'); }
  }

  async function remove(site: AttendanceSite) {
    if (!window.confirm(`ลบจุด "${site.name}"? ประวัติการลงเวลายังอยู่ แต่ QR ของจุดนี้จะใช้ไม่ได้`)) return;
    try { await deleteSite(site.id); await load(); } catch (err) { setError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="pill-label">QR + GPS</span>
          <h2 className="mt-3 text-2xl font-bold">จุดลงเวลา</h2>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">ตั้งพิกัดและรัศมี แล้วพิมพ์ QR ไปติดหน้างาน พนักงานใช้มือถือตัวเองสแกน</p>
        </div>
        <button className="btn-pill btn-dark" onClick={() => { setError(''); setDraft({ ...emptyDraft }); }}>
          <Plus className="h-4 w-4" /> เพิ่มจุดลงเวลา <span className="btn-arrow"><ArrowRight className="h-4 w-4" /></span>
        </button>
      </div>

      {message && <p role="status" className="text-sm text-[var(--app-accent-text)]">{message}</p>}
      {error && !draft && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {sites.length === 0 && !error ? (
        <div className="hr-card p-10 text-center text-sm text-[var(--app-text-muted)]">ยังไม่มีจุดลงเวลา กด "เพิ่มจุดลงเวลา" เพื่อเริ่ม</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sites.map((site) => (
            <article key={site.id} className="hr-card flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold">{site.name}</h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-[var(--app-text-muted)]">
                    <MapPin className="h-3.5 w-3.5" />
                    {site.lat != null && site.lng != null ? `${site.lat.toFixed(5)}, ${site.lng.toFixed(5)} · รัศมี ${site.radius_m} ม.` : 'ยังไม่ตั้งพิกัด'}
                  </p>
                </div>
                <span className={`tag-chip ${site.is_active ? 'tag-chip-on' : ''}`}>{site.is_active ? 'เปิดใช้' : 'ปิดอยู่'}</span>
              </div>
              <div className="grid place-items-center rounded-2xl bg-white p-3">
                {images[site.id] ? <img src={images[site.id]} alt={`QR ลงเวลา ${site.name}`} className="w-48" /> : <p className="py-16 text-sm text-[var(--app-text-muted)]">กำลังสร้าง QR...</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="work-button work-primary" disabled={!images[site.id]} onClick={() => printQr(site, images[site.id])}><Printer size={16} />พิมพ์ QR</button>
                <a className="work-button" href={images[site.id] || undefined} download={`QR-${site.name}.png`} aria-disabled={!images[site.id]}><Download size={16} />PNG</a>
                <button className="work-icon" title="แก้ไข" aria-label={`แก้ไข ${site.name}`} onClick={() => { setError(''); setDraft({ id: site.id, name: site.name, coords: site.lat != null && site.lng != null ? `${site.lat}, ${site.lng}` : '', radius_m: site.radius_m, require_gps: site.require_gps, is_active: site.is_active }); }}><Pencil size={16} /></button>
                <button className="work-icon" title="สร้าง QR ใหม่ (ยกเลิกแผ่นเดิม)" aria-label={`สร้าง QR ใหม่ ${site.name}`} onClick={() => rotate(site)}><RefreshCw size={16} /></button>
                <button className="work-icon text-red-600" title="ลบ" aria-label={`ลบ ${site.name}`} onClick={() => remove(site)}><Trash2 size={16} /></button>
              </div>
            </article>
          ))}
        </div>
      )}

      {draft && (
        <WorkDialog title={draft.id ? 'แก้ไขจุดลงเวลา' : 'เพิ่มจุดลงเวลา'} busy={busy} onClose={() => setDraft(null)}>
          <div className="space-y-4">
            <label className="work-field">ชื่อจุด
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="เช่น สาขาหลัก, สตูดิโอ" />
            </label>
            <label className="work-field">พิกัด (ละติจูด, ลองจิจูด)
              <input value={draft.coords} onChange={(e) => setDraft({ ...draft, coords: e.target.value })} placeholder="13.7563, 100.5018" inputMode="decimal" />
            </label>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--app-text-muted)]">
              <button type="button" className="work-button" onClick={useHere}><Crosshair size={16} />ใช้ตำแหน่งปัจจุบัน</button>
              <span>หรือคลิกขวาที่จุดใน Google Maps แล้วคัดลอกพิกัดมาวาง</span>
            </div>
            <label className="work-field">รัศมีที่อนุญาต: {draft.radius_m} ม.
              <input type="range" min={30} max={500} step={10} value={draft.radius_m} onChange={(e) => setDraft({ ...draft, radius_m: Number(e.target.value) })} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">ตรวจ GPS ตอนสแกน
              <input type="checkbox" checked={draft.require_gps} onChange={(e) => setDraft({ ...draft, require_gps: e.target.checked })} className="h-5 w-5 accent-[#2f7d4f]" />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">เปิดใช้งาน
              <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} className="h-5 w-5 accent-[#2f7d4f]" />
            </label>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button className="work-button" disabled={busy} onClick={() => setDraft(null)}><X size={16} />ยกเลิก</button>
              <button className="work-button work-primary" disabled={busy} onClick={submit}>บันทึก</button>
            </div>
          </div>
        </WorkDialog>
      )}
    </div>
  );
}
