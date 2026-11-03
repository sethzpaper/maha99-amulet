const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const mod = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/monthlyReport.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: mod, Intl, Date, String, Math, Number, Object, Array, Map, require });
const { buildSummary, buildDetail, toCsv, SUMMARY_HEADERS, DETAIL_HEADERS } = mod;

const entries = [
  { id: '1', user_id: 'a', user_name: 'เอ', work_date: '2026-11-03', check_in_time: '2026-11-03T02:00:00Z', check_out_time: '2026-11-03T15:00:00Z', total_hours: 13, status: 'out', method: 'qr', check_in_site_id: 's1' },
  { id: '2', user_id: 'a', user_name: 'เอ', work_date: '2026-11-04', check_in_time: '2026-11-04T06:00:00Z', check_out_time: '2026-11-04T12:00:00Z', total_hours: 6, status: 'late', method: 'qr' },
  { id: '3', user_id: 'a', user_name: 'เอ', work_date: '2026-11-05', total_hours: null, status: 'leave', note: 'ป่วย' },
  { id: '4', user_id: 'b', user_name: 'บี', work_date: '2026-11-03', check_in_time: '2026-11-03T01:30:00Z', total_hours: null, status: 'working', method: 'manual' },
];
const leaves = [
  { user_id: 'a', user_name: 'เอ', leave_date: '2026-11-05', status: 'approved', source: 'manager' },
  { user_id: 'b', user_name: 'บี', leave_date: '2026-11-20', status: 'approved', source: 'employee' },
  { user_id: 'b', user_name: 'บี', leave_date: '2026-11-21', status: 'pending', source: 'employee' },
];

test('summary counts only scanned days as work days and splits leave by source', () => {
  const rows = buildSummary(entries, leaves);
  const a = rows.find((r) => r.user_id === 'a');
  const b = rows.find((r) => r.user_id === 'b');
  assert.equal(a.work_days, 2);
  assert.equal(a.total_hours, 19);
  assert.equal(a.ot_hours, 2);
  assert.equal(a.late_days, 1);
  assert.equal(a.leave_days, 1);
  assert.equal(a.leave_by_manager, 1);
  assert.equal(b.work_days, 1);
  assert.equal(b.leave_advance, 1, 'pending leave is not counted');
});
test('detail rows use Bangkok time, site names and method labels', () => {
  const rows = buildDetail(entries, { s1: 'สาขาหลัก' });
  assert.deepEqual(Array.from(rows, (r) => r.date + r.name), ['2026-11-03บี', '2026-11-03เอ', '2026-11-04เอ', '2026-11-05เอ'], 'sorted by date, then Thai name');
  const first = rows[1];
  assert.equal(first.check_in, '09:00');
  assert.equal(first.check_out, '22:00');
  assert.equal(first.ot_hours, 2);
  assert.equal(first.site, 'สาขาหลัก');
  assert.equal(first.method, 'สแกน QR');
  assert.equal(rows[0].method, 'แอดมินบันทึก');
  assert.equal(rows.find((r) => r.status === 'ลา').hours, '');
});
test('CSV opens in Excel: BOM, CRLF, quoting and no formula injection', () => {
  const csv = toCsv([{ name: '=HYPERLINK("x")', note: 'มี, จุลภาค' }], [['name', 'ชื่อ'], ['note', 'หมายเหตุ']]);
  assert.ok(csv.startsWith('﻿ชื่อ,หมายเหตุ\r\n'));
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(csv.includes('"มี, จุลภาค"'));
  assert.equal(SUMMARY_HEADERS.length, 8);
  assert.equal(DETAIL_HEADERS.length, 10);
});
