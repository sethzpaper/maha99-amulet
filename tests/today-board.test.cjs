const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const mod = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/todayBoard.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: mod, require });
const { buildTodayFeed, summarizeToday } = mod;
const today = '2026-11-02';
const entries = [
  { id: 'a', user_id: 'u1', user_name: 'เอ', work_date: today, check_in_time: '2026-11-02T01:55:00Z', check_out_time: '2026-11-02T11:00:00Z', status: 'out' },
  { id: 'b', user_id: 'u2', user_name: 'บี', work_date: today, check_in_time: '2026-11-02T02:10:00Z', status: 'working' },
  { id: 'c', user_id: 'u3', user_name: 'ซี', work_date: today, status: 'leave' },
  { id: 'old', user_id: 'u4', user_name: 'ดี', work_date: '2026-11-01', check_in_time: '2026-11-01T02:00:00Z', status: 'out' },
];
test('feed lists today check-ins and check-outs, newest first, ignoring other days', () => {
  const feed = buildTodayFeed(entries, today);
  assert.deepEqual(Array.from(feed, (item) => item.id), ['a:out', 'b:in', 'a:in']);
});
test('summary counts present, leave and not-yet against the active roster', () => {
  const leaves = [{ user_id: 'u5', leave_date: today, status: 'approved' }, { user_id: 'u6', leave_date: today, status: 'pending' }];
  const s = summarizeToday(entries, leaves, ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'], today);
  assert.deepEqual({ ...s }, { total: 6, present: 2, checkedOut: 1, onLeave: 2, notYet: 2 });
});
test('someone on leave who still scanned in counts as present, not leave', () => {
  const leaves = [{ user_id: 'u2', leave_date: today, status: 'approved' }];
  const s = summarizeToday(entries, leaves, ['u1', 'u2', 'u3'], today);
  assert.equal(s.present, 2);
  assert.equal(s.onLeave, 1);
  assert.equal(s.notYet, 0);
});
