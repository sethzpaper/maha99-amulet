const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const exportsForTest = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/workflow.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsForTest, Intl, Date });
const { validateVideo, overdue, dueToday, todayBangkok } = exportsForTest;
const draft = { fileName: 'Video', assignee_id: 'owner', due_date: '2026-09-06', workflow_status: 'idea' };
test('complete workflow and review revisions are supported', () => {
  for (const [before, after] of [['idea','production'], ['production','review'], ['review','approved'], ['approved','published'], ['review','production'], ['published','production']]) {
    assert.doesNotThrow(() => validateVideo({ ...draft, workflow_status: after }, before));
  }
});
test('cannot skip review or omit ownership/deadline', () => {
  assert.throws(() => validateVideo({ ...draft, workflow_status: 'published' }, 'idea'));
  assert.throws(() => validateVideo({ ...draft, workflow_status: 'production', assignee_id: null }, 'idea'));
  assert.throws(() => validateVideo({ ...draft, workflow_status: 'production', due_date: null }, 'idea'));
  assert.throws(() => validateVideo({ ...draft, fileName: '  ' }));
});
test('published tasks are excluded from overdue and today', () => {
  assert.equal(overdue({ ...draft, due_date: '2026-09-05' }, '2026-09-06'), true);
  assert.equal(overdue(draft, '2026-09-06'), false);
  assert.equal(dueToday(draft, '2026-09-06'), true);
  assert.equal(overdue({ ...draft, due_date: null }, '2026-09-06'), false);
  assert.equal(overdue({ ...draft, due_date: '2026-09-05', workflow_status: 'published' }, '2026-09-06'), false);
  assert.equal(dueToday({ ...draft, workflow_status: 'published' }, '2026-09-06'), false);
});
test('day boundary uses Bangkok, not UTC or browser timezone', () => {
  assert.equal(todayBangkok(new Date('2026-09-05T16:59:59Z')), '2026-09-05');
  assert.equal(todayBangkok(new Date('2026-09-05T17:00:00Z')), '2026-09-06');
});
