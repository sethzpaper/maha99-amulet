const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const mod = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/qrAttendanceApi.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: mod, URL, require: (name) => (name === './supabaseClient' ? { supabase: null, isSupabaseConfigured: false } : require(name)) });
const { extractToken, qrUrl, parseLatLng } = mod;
const token = 'TD1.20000000-0000-0000-0000-000000000001.' + 'a1'.repeat(16);

test('QR link printed on the wall round-trips to the token', () => {
  const url = qrUrl('https://teamday.example/', token);
  assert.equal(url, 'https://teamday.example/scan?t=' + token);
  assert.equal(extractToken(url), token);
  assert.equal(extractToken('  ' + token + '\n'), token);
});
test('foreign or malformed QR codes are ignored', () => {
  assert.equal(extractToken('https://example.com/?t=hello'), null);
  assert.equal(extractToken('WIFI:S:office;T:WPA;P:secret;;'), null);
  assert.equal(extractToken(token.slice(0, -1)), null);
});
test('coordinates pasted from Google Maps are parsed and validated', () => {
  assert.deepEqual({ ...parseLatLng('13.7563, 100.5018') }, { lat: 13.7563, lng: 100.5018 });
  assert.deepEqual({ ...parseLatLng('-33.86,151.2') }, { lat: -33.86, lng: 151.2 });
  assert.equal(parseLatLng('100.5, 13.7'), null);
  assert.equal(parseLatLng('Bangkok'), null);
});
