import type { LeaveRequest, TimeEntry } from './attendanceApi';

/** รายงานประจำเดือน: แปลงข้อมูลดิบเป็นแถวสรุป/รายละเอียด และไฟล์ CSV ที่เปิดใน Excel ได้ (ภาษาไทยไม่เพี้ยน) */

export const OT_THRESHOLD = 11;

export interface SummaryRow {
  user_id: string;
  name: string;
  work_days: number;
  total_hours: number;
  ot_hours: number;
  late_days: number;
  leave_days: number;
  leave_advance: number;
  leave_by_manager: number;
}

export interface DetailRow {
  date: string;
  name: string;
  check_in: string;
  check_out: string;
  hours: number | '';
  ot_hours: number | '';
  status: string;
  site: string;
  method: string;
  note: string;
}

export const STATUS_LABEL: Record<string, string> = {
  working: 'กำลังทำงาน', out: 'ออกงานแล้ว', late: 'มาสาย', leave: 'ลา', 'auto-leave': 'ลา (อัตโนมัติ)', 'auto-out': 'ออกงานอัตโนมัติ',
};
const METHOD_LABEL: Record<string, string> = { qr: 'สแกน QR', manual: 'แอดมินบันทึก', auto: 'อัตโนมัติ' };

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' });
const round2 = (n: number) => Math.round(n * 100) / 100;

export function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' })
    .format(new Date(Date.UTC(y, m - 1, 15)));
}

export function buildSummary(entries: TimeEntry[], leaves: LeaveRequest[]): SummaryRow[] {
  const rows = new Map<string, SummaryRow>();
  const row = (userId: string, name: string) => {
    let r = rows.get(userId);
    if (!r) {
      r = { user_id: userId, name, work_days: 0, total_hours: 0, ot_hours: 0, late_days: 0, leave_days: 0, leave_advance: 0, leave_by_manager: 0 };
      rows.set(userId, r);
    }
    return r;
  };
  for (const e of entries) {
    const r = row(e.user_id, e.user_name);
    const hours = Number(e.total_hours || 0);
    if (e.check_in_time) r.work_days += 1;
    r.total_hours += hours;
    r.ot_hours += Math.max(0, hours - OT_THRESHOLD);
    if (e.status === 'late') r.late_days += 1;
    if (e.status === 'leave' || e.status === 'auto-leave') r.leave_days += 1;
  }
  for (const l of leaves) {
    if (l.status !== 'approved') continue;
    const r = row(l.user_id, l.user_name);
    if (l.source === 'manager') r.leave_by_manager += 1;
    else r.leave_advance += 1;
  }
  return Array.from(rows.values())
    .map((r) => ({ ...r, total_hours: round2(r.total_hours), ot_hours: round2(r.ot_hours) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

export function buildDetail(entries: TimeEntry[], siteNames: Record<string, string> = {}): DetailRow[] {
  return [...entries]
    .sort((a, b) => a.work_date.localeCompare(b.work_date) || a.user_name.localeCompare(b.user_name, 'th'))
    .map((e) => {
      const hours = e.total_hours == null ? '' : round2(Number(e.total_hours));
      const extra = e as TimeEntry & { method?: string; check_in_site_id?: string; check_out_site_id?: string };
      const siteId = extra.check_in_site_id || extra.check_out_site_id;
      return {
        date: e.work_date,
        name: e.user_name,
        check_in: e.check_in_time ? timeFormat.format(new Date(e.check_in_time)) : '',
        check_out: e.check_out_time ? timeFormat.format(new Date(e.check_out_time)) : '',
        hours,
        ot_hours: hours === '' ? '' : round2(Math.max(0, hours - OT_THRESHOLD)),
        status: STATUS_LABEL[e.status] || e.status,
        site: siteId ? siteNames[siteId] || '' : '',
        method: METHOD_LABEL[extra.method || ''] || '',
        note: e.note || '',
      };
    });
}

export const SUMMARY_HEADERS: [keyof SummaryRow, string][] = [
  ['name', 'ชื่อ'], ['work_days', 'วันทำงาน'], ['total_hours', 'ชั่วโมงรวม'], ['ot_hours', `OT (เกิน ${OT_THRESHOLD} ชม.)`],
  ['late_days', 'มาสาย (วัน)'], ['leave_days', 'ลา (วัน)'], ['leave_advance', 'ลาล่วงหน้า (อนุมัติ)'], ['leave_by_manager', 'ผู้จัดการบันทึกให้'],
];
export const DETAIL_HEADERS: [keyof DetailRow, string][] = [
  ['date', 'วันที่'], ['name', 'ชื่อ'], ['check_in', 'เวลาเข้า'], ['check_out', 'เวลาออก'], ['hours', 'ชั่วโมง'],
  ['ot_hours', 'OT'], ['status', 'สถานะ'], ['site', 'จุดที่สแกน'], ['method', 'วิธีลงเวลา'], ['note', 'หมายเหตุ'],
];

function csvCell(value: unknown) {
  let text = value == null ? '' : String(value);
  // Prevent spreadsheet formula injection from names/notes.
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV + BOM เพื่อให้ Excel อ่านภาษาไทยถูกต้อง */
export function toCsv<T>(rows: T[], headers: [keyof T, string][]): string {
  const lines = [headers.map(([, label]) => csvCell(label)).join(',')];
  for (const r of rows) lines.push(headers.map(([key]) => csvCell(r[key])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function htmlTable<T>(rows: T[], headers: [keyof T, string][]) {
  const head = headers.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join('');
  const body = rows.map((r) => `<tr>${headers.map(([key]) => `<td>${escapeHtml(r[key])}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}">ไม่มีข้อมูล</td></tr>`}</tbody></table>`;
}

/** หน้าพิมพ์รายงาน (ใช้ "บันทึกเป็น PDF" ของเบราว์เซอร์ได้) */
export function reportHtml(params: { brand: string; month: string; summary: SummaryRow[]; detail: DetailRow[] }) {
  const title = `รายงานลงเวลาประจำเดือน ${monthLabel(params.month)}`;
  const totals = params.summary.reduce((t, r) => ({ hours: t.hours + r.total_hours, ot: t.ot + r.ot_hours, late: t.late + r.late_days, leave: t.leave + r.leave_days }), { hours: 0, ot: 0, late: 0, leave: 0 });
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page{size:A4;margin:14mm}body{font-family:"IBM Plex Sans Thai",system-ui,sans-serif;color:#0f2a1f;margin:0;font-size:12px}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #c4f542;padding-bottom:8px;margin-bottom:14px}
h1{font-size:20px;margin:0}h2{font-size:15px;margin:22px 0 8px}.brand{font-weight:700;color:#0c3a2b}
.kpi{display:flex;gap:10px;margin:10px 0}.kpi div{flex:1;border:1px solid #d3ddcf;border-radius:10px;padding:8px 10px}.kpi b{display:block;font-size:18px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #d3ddcf;padding:5px 6px;text-align:left}th{background:#0c3a2b;color:#fff;font-weight:600}
tr:nth-child(even) td{background:#f2f5ee}.detail{page-break-before:always}.foot{margin-top:16px;color:#5b6d63;font-size:11px}
</style></head><body>
<header><div><div class="brand">${escapeHtml(params.brand)}</div><h1>${escapeHtml(title)}</h1></div><div>พิมพ์เมื่อ ${escapeHtml(new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }))}</div></header>
<div class="kpi"><div>พนักงาน<b>${params.summary.length} คน</b></div><div>ชั่วโมงรวม<b>${round2(totals.hours)}</b></div><div>OT รวม<b>${round2(totals.ot)}</b></div><div>มาสาย<b>${totals.late} วัน</b></div><div>ลา<b>${totals.leave} วัน</b></div></div>
<h2>สรุปรายคน</h2>${htmlTable(params.summary, SUMMARY_HEADERS)}
<div class="detail"><h2>รายละเอียดรายวัน</h2>${htmlTable(params.detail, DETAIL_HEADERS)}</div>
<p class="foot">OT นับเมื่อทำงานเกิน ${OT_THRESHOLD} ชั่วโมงต่อวัน · มาสาย = เข้างานหลัง 12:00 น.</p>
<script>window.onload=function(){window.print()}</script></body></html>`;
}
