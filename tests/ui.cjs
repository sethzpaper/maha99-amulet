const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      await page.route('**/src/lib/authStore.ts*', async (route) => {
        const response = await route.fetch();
        await route.fulfill({ response, body: (await response.text()) + '\nwindow.__testAuthStore = useAuthStore;\n' });
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
      await page.locator('h1').waitFor();
      assert.equal(await page.locator('h1').innerText(), 'แดชบอร์ดองค์กร');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'horizontal overflow');
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR || '.', 'dashboard-' + width + '.png'), fullPage: true });
      if (width < 768) await page.getByRole('button', { name: 'เปิดเมนู' }).click();
      await page.getByRole('link', { name: 'เทียบคู่แข่ง' }).click();
      await page.waitForURL('**/comparison');
      await page.reload();
      assert.equal(await page.locator('h1').innerText(), 'เปรียบเทียบคู่แข่ง');
      await page.goBack();
      await page.waitForURL('http://localhost:3000/');
      await page.goto('http://localhost:3000/settings');
      assert.equal(await page.getByText('แหล่ง Social', { exact: true }).count(), 0);
      await page.evaluate(() => localStorage.setItem('auth-storage', JSON.stringify({ state: { user: { role: 'super_admin' }, isAuthenticated: true }, version: 0 })));
      await page.reload();
      assert.equal(await page.getByText('แหล่ง Social', { exact: true }).count(), 0);
      await page.goto('http://localhost:3000/missing');
      await page.getByText('ไม่พบหน้าที่ต้องการ').waitFor();
      // UI fixture only: database authorization is tested separately in SQL.
      await page.goto('http://localhost:3000/');
      await page.waitForFunction(() => window.__testAuthStore);
      await page.evaluate(() => {
        window.__testAuthStore.setState({ user: { id: 'ui-fixture', username: 'Preview', role: 'admin' }, isAuthenticated: true, isLoading: false });
      });
      if (width < 768) await page.getByRole('button', { name: 'เปิดเมนู' }).click();
      await page.getByRole('link', { name: 'ศูนย์งานวิดีโอ' }).click();
      await page.waitForURL('**/videos');
      await page.getByRole('heading', { name: 'งานวิดีโอ', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'workflow overflow');
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR || '.', 'workflow-' + width + '.png'), fullPage: true });
      assert.deepEqual(errors, []);
      await page.close();
      console.log('PASS viewport', width, ': navigation, reload, back, access gate, forged storage, 404, overflow');
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
