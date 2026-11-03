const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
function load(file) {
  const mod = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: mod, Date, Object, Array, String, Number, require: (n) => (n === './supabaseClient' ? { supabase: null, isSupabaseConfigured: false } : require(n)) });
  return mod;
}
const cal = load('src/lib/calendarApi.ts');
const clips = load('src/lib/clipsApi.ts');

test('month grid starts on Sunday and covers the whole month', () => {
  const days = Array.from(cal.monthGrid('2026-11'));
  assert.equal(days[0], '2026-11-01'); // 1 Nov 2026 is a Sunday
  assert.equal(days.length % 7, 0);
  assert.ok(days.includes('2026-11-30'));
  const feb = Array.from(cal.monthGrid('2027-02'));
  assert.equal(feb[0], '2027-01-31');
  assert.equal(cal.shiftMonth('2026-12', 1), '2027-01');
  assert.equal(cal.shiftMonth('2027-01', -1), '2026-12');
});
test('events are grouped by date, timed events first', () => {
  const g = cal.groupByDate([
    { id: 'b', event_date: '2026-11-24', start_time: null },
    { id: 'a', event_date: '2026-11-24', start_time: '18:00' },
  ]);
  assert.deepEqual(Array.from(g['2026-11-24'], (e) => e.id), ['a', 'b']);
});
test('clip grid puts each clip in its date x editor cell, oldest first', () => {
  assert.equal(clips.monthRange('2026-02').days.length, 28);
  const grid = clips.buildGrid([
    { id: '2', clip_date: '2026-11-03', editor_id: 'e1', created_at: '2026-11-03T10:00:00Z' },
    { id: '1', clip_date: '2026-11-03', editor_id: 'e1', created_at: '2026-11-03T08:00:00Z' },
    { id: '3', clip_date: '2026-11-04', editor_id: 'e2', created_at: '2026-11-04T08:00:00Z' },
  ]);
  assert.deepEqual(Array.from(grid['2026-11-03'].e1, (c) => c.id), ['1', '2']);
  assert.equal(grid['2026-11-04'].e2.length, 1);
  assert.deepEqual({ ...clips.countByEditor([{ editor_id: 'e1' }, { editor_id: 'e1' }, { editor_id: 'e2' }]) }, { e1: 2, e2: 1 });
});
