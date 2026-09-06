const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const mockApi = `
import { validateVideo } from '/src/lib/workflow.ts';
const read = () => JSON.parse(localStorage.getItem('workflow-fixture'));
const write = (value) => localStorage.setItem('workflow-fixture', JSON.stringify(value));
export async function listWorkflow() { return read().videos; }
export async function listAssignees() { return [{ id: 'owner', nickname: 'ทีมผลิต', is_active: true }]; }
export async function listPendingLeaves() { return read().leaves.filter(row => row.status === 'pending'); }
export async function saveWorkflow(draft, previous) {
  if (window.__failSave) throw new Error('ทดสอบบันทึกไม่สำเร็จ');
  validateVideo(draft, previous?.workflow_status);
  const state = read();
  const saved = { ...draft, id: previous?.id || 'new-video', workflow_version: (previous?.workflow_version || 0) + 1 };
  state.videos = [...state.videos.filter(row => row.id !== saved.id), saved];
  write(state); return saved;
}
export async function decideLeave(id, status, note) {
  const state = read(); const leave = state.leaves.find(row => row.id === id);
  if (leave.status !== 'pending') throw new Error('Already handled');
  leave.status = status; leave.manager_note = note; write(state);
}
`;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/src/lib/authStore.ts*', async (route) => {
        const response = await route.fetch();
        await route.fulfill({ response, body: (await response.text()) + '\nwindow.__testAuthStore = useAuthStore;\n' });
      });
      await page.route('**/src/lib/workflowApi.ts*', (route) => route.fulfill({ contentType: 'text/javascript', body: mockApi }));
      await page.addInitScript(() => {
        if (localStorage.getItem('workflow-fixture')) return;
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
        const base = { assignee_id: 'owner', due_date: today, productName: 'พระสมเด็จ', brief: '', driveLink: '', workflow_version: 1 };
        localStorage.setItem('workflow-fixture', JSON.stringify({
          videos: [
            { ...base, id: 'review-task', fileName: 'คลิปรอตรวจ', workflow_status: 'review', due_date: '2020-01-01' },
            { ...base, id: 'production-task', fileName: 'คลิปครบกำหนดวันนี้', workflow_status: 'production' },
            { ...base, id: 'published-task', fileName: 'คลิปเผยแพร่แล้ว', workflow_status: 'published', due_date: '2020-01-01' },
          ],
          leaves: [{ id: 'leave-1', user_name: 'ผู้ขอลา', leave_date: today, leave_type: 'personal', reason: 'ธุระครอบครัว', status: 'pending' }],
        }));
      });
      async function visit(url) {
        await page.goto('http://localhost:3000' + url, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__testAuthStore);
        await page.evaluate(() => window.__testAuthStore.setState({ user: { id: 'ui-fixture', username: 'Preview', role: 'admin' }, isAuthenticated: true, isLoading: false }));
      }
      await visit('/');
      await page.getByRole('tab', { name: 'วิดีโอรอตรวจ 1' }).waitFor();
      await page.getByRole('tab', { name: 'งานเลยกำหนด 1' }).waitFor();
      await page.getByRole('tab', { name: 'ครบกำหนดวันนี้ 1' }).waitFor();
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR || '.', 'today-work-' + width + '.png'), fullPage: false });
      await page.getByRole('tabpanel').getByRole('link', { name: 'จัดการ' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ timeout: 10000 }).catch(async (error) => { console.log(await page.locator('body').innerText()); throw error; });
      await dialog.getByLabel('สถานะ', { exact: true }).selectOption('approved');
      await dialog.getByRole('button', { name: 'บันทึก', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'เพิ่มไอเดีย' }).click();
      await dialog.getByLabel('ชื่องาน', { exact: true }).fill('งานใหม่สำหรับทีมผลิต');
      await dialog.getByLabel('ผู้รับผิดชอบ', { exact: true }).selectOption('owner');
      await dialog.getByLabel('กำหนดส่ง', { exact: true }).fill('2026-12-20');
      await dialog.getByRole('button', { name: 'บันทึก', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      for (const stage of ['production', 'review', 'approved', 'published']) {
        await page.getByRole('button', { name: 'งานใหม่สำหรับทีมผลิต', exact: true }).click();
        await dialog.getByLabel('สถานะ', { exact: true }).selectOption(stage);
        await dialog.getByRole('button', { name: 'บันทึก', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
      }
      await page.getByRole('button', { name: 'งานใหม่สำหรับทีมผลิต', exact: true }).click();
      await page.evaluate(() => { window.__failSave = true; });
      await dialog.getByLabel('ชื่องาน', { exact: true }).fill('ต้องไม่ถูกบันทึก');
      await dialog.getByRole('button', { name: 'บันทึก', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
      await visit('/videos?task=new-video');
      await dialog.getByLabel('ชื่องาน', { exact: true }).waitFor();
      assert.equal(await dialog.getByLabel('ชื่องาน', { exact: true }).inputValue(), 'งานใหม่สำหรับทีมผลิต');
      assert.equal(await dialog.getByLabel('สถานะ', { exact: true }).inputValue(), 'published');
      await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
      await page.getByLabel('กรองผู้รับผิดชอบ').selectOption('unassigned');
      assert.equal(await page.getByRole('button', { name: 'งานใหม่สำหรับทีมผลิต', exact: true }).count(), 0);
      await page.getByLabel('กรองผู้รับผิดชอบ').selectOption('');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR || '.', 'video-board-' + width + '.png'), fullPage: false });
      await visit('/');
      await page.getByRole('tab', { name: 'ใบลารออนุมัติ 1' }).click();
      await page.getByRole('tabpanel').getByRole('button', { name: 'จัดการ' }).click();
      await dialog.getByLabel('หมายเหตุ').fill('อนุมัติตามคำขอ');
      await dialog.getByRole('button', { name: 'อนุมัติ', exact: true }).click();
      await page.getByRole('tab', { name: 'ใบลารออนุมัติ 0' }).waitFor();
      await visit('/');
      await page.getByRole('tab', { name: 'ใบลารออนุมัติ 0' }).waitFor();
      assert.deepEqual(errors, []);
      await page.close();
      console.log('PASS workflow viewport', width, ': counts, deep links, create, stages, save failure, reload, filters, leave approval');
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
