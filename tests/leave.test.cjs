const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
function load(file, requireMock) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: requireMock, Intl, Date, URL });
  return exports;
}
function apiFixture(respond) {
  const calls = [];
  const supabase = { from(table) {
    const query = { table, filters: [] }; calls.push(query);
    const builder = {
      select() { return builder; },
      order() { return builder; },
      eq(key, value) { query.filters.push([key, value]); return builder; },
      update(value) { query.payload = value; return builder; },
      range(from, to) { query.range = [from, to]; return Promise.resolve(respond(query)); },
      maybeSingle() { return Promise.resolve(respond(query)); },
    };
    return builder;
  } };
  const api = load('src/lib/leaveApi.ts', (name) => {
    if (name === './supabaseClient') return { supabase, isSupabaseConfigured: true };
    throw new Error(name);
  });
  return { api, calls };
}
test('leave decisions are conditional on pending status and reject stale decisions', async () => {
  const f = apiFixture(() => ({ data: null, error: null }));
  await assert.rejects(f.api.decideLeave('leave', 'approved', 'note'));
  assert.equal(JSON.stringify(f.calls[0].filters), JSON.stringify([['id', 'leave'], ['status', 'pending']]));
});
test('pending leaves load beyond a single server page and never hide database errors', async () => {
  const records = Array.from({ length: 1100 }, (_, id) => ({ id }));
  const f = apiFixture((query) => ({ data: records.slice(query.range[0], query.range[1] + 1), error: null }));
  assert.equal((await f.api.listPendingLeaves()).length, 1100);
  assert.equal(f.calls.length, 3);
  const failed = apiFixture(() => ({ data: null, error: { message: 'denied' } }));
  await assert.rejects(failed.api.listPendingLeaves(), /denied/);
});
test('day boundary uses Bangkok, not UTC or browser timezone', () => {
  const { todayBangkok } = load('src/lib/dates.ts', require);
  assert.equal(todayBangkok(new Date('2026-09-05T16:59:59Z')), '2026-09-05');
  assert.equal(todayBangkok(new Date('2026-09-05T17:00:00Z')), '2026-09-06');
});
