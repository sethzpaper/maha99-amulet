const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(user, options = {}) {
  let callback;
  let subscriptions = 0;
  let stored = { role: 'super_admin', isAuthenticated: true };
  const auth = {
    getUser: async () => ({ data: { user }, error: options.revoked ? new Error('revoked') : null }),
    signInWithPassword: async () => ({ error: options.badPassword ? new Error('invalid') : null }),
    signOut: async () => { callback?.('SIGNED_OUT'); },
    onAuthStateChange: (cb) => { callback = cb; subscriptions++; },
  };
  const source = ts.transpileModule(fs.readFileSync('src/lib/authStore.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: (name) => name === './supabaseClient'
      ? { supabase: { auth }, isSupabaseConfigured: true } : require(name),
    localStorage: { removeItem: () => { stored = null; } },
    setTimeout,
  });
  return { store: exports.useAuthStore, subscriptions: () => subscriptions, stored: () => stored };
}

test('user-editable metadata and forged local state cannot grant admin', async () => {
  const f = fixture({ id: 'user', user_metadata: { role: 'super_admin' }, app_metadata: {} });
  assert.equal(f.store.getState().isAuthenticated, false);
  await f.store.getState().loadSession();
  assert.equal(f.store.getState().user.role, 'user');
  assert.equal(f.stored(), null);
});
test('verified server role is accepted; logout clears privileges', async () => {
  const f = fixture({ id: 'admin', user_metadata: {}, app_metadata: { role: 'admin' } });
  assert.equal(await f.store.getState().login('admin@example.com', 'secret'), true);
  assert.equal(f.store.getState().user.role, 'admin');
  await f.store.getState().logout();
  assert.equal(f.store.getState().user, null);
});
test('revoked sessions fail closed', async () => {
  const f = fixture({ id: 'admin', app_metadata: { role: 'super_admin' } }, { revoked: true });
  await f.store.getState().loadSession();
  assert.equal(f.store.getState().isAuthenticated, false);
  assert.equal(f.store.getState().isLoading, false);
});
test('repeated initialization installs only one subscription', async () => {
  const f = fixture(null);
  await f.store.getState().loadSession();
  await f.store.getState().loadSession();
  assert.equal(f.subscriptions(), 1);
});
test('legacy admin password has no local bypass', async () => {
  const f = fixture(null, { badPassword: true });
  assert.equal(await f.store.getState().login('admin', '11221122'), false);
  assert.equal(f.store.getState().isAuthenticated, false);
});
