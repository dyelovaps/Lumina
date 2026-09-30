const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

function worker(rpcResult, storage = { luminaFlowEnabled: false }) {
  const listeners = [];
  const executed = [];
  const event = () => ({ addListener() {} });
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, setTimeout, clearTimeout,
    WebSocket: class { static OPEN = 1; static CONNECTING = 0; },
    chrome: {
      runtime: { onMessage: { addListener(fn) { listeners.push(fn); } }, onInstalled: event(), onStartup: event(),
        sendMessage: async () => {}, getManifest: () => JSON.parse(read('manifest.json')) },
      storage: { local: { get: async () => storage, set: async d => Object.assign(storage, d) }, onChanged: event() },
      alarms: { onAlarm: event(), create() {}, clear() {} },
      webRequest: { onBeforeSendHeaders: event() },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
      tabs: { query: async () => [{ id: 1 }], get: async () => ({ id: 1 }), sendMessage: async () => ({ token: 'tok' }) },
      scripting: { executeScript: async (o) => { executed.push(o); return [{ result: rpcResult() }]; } },
    },
  };
  vm.runInNewContext(read('flow/background.js'), ctx);
  return { ctx, executed, send: msg => new Promise(r => listeners[0](msg, {}, r)) };
}

test('A throttled generate puts Flow in cooldown and the next generate fails fast without a captcha', async () => {
  const w = worker(() => ({ status: 429, text: '' }));
  const first = await w.ctx.pacedRpc({ id: 'a', rpcid: 'x', freq: '__CAPTCHA__', captchaAction: 'IMAGE_GENERATION' });
  assert.equal(first.status, 429);
  const st = await w.send({ type: 'PACE_STATUS' });
  assert.ok(st.cooldownLeftMs > 30000, 'cooldown armed');
  assert.equal(st.strikes, 1);
  const calls = w.executed.length;
  const second = await w.ctx.pacedRpc({ id: 'b', rpcid: 'x', freq: '__CAPTCHA__', captchaAction: 'IMAGE_GENERATION' });
  assert.match(second.error, /FLOW_COOLDOWN/);
  assert.equal(w.executed.length, calls, 'no RPC sent during cooldown');
  const reset = await w.send({ type: 'PACE_RESET' });
  assert.equal(reset.cooldownLeftMs, 0);
});

test('Google’s embedded RESOURCE_EXHAUSTED answer is detected; a normal answer is not', async () => {
  const bad = worker(() => ({ status: 200, text: ')]}\'\n[["er",null,null,null,null,429,"RESOURCE_EXHAUSTED"]]' }));
  await bad.ctx.pacedRpc({ id: 'a', rpcid: 'x', freq: 'f', captchaAction: 'VIDEO_GENERATION' });
  assert.ok((await bad.send({ type: 'PACE_STATUS' })).cooldownLeftMs > 0);
  const ok = worker(() => ({ status: 200, text: ')]}\'\n[["wrb.fr","x","[\\"media\\"]"]]' }));
  await ok.ctx.pacedRpc({ id: 'a', rpcid: 'x', freq: 'f', captchaAction: 'VIDEO_GENERATION' });
  assert.equal((await ok.send({ type: 'PACE_STATUS' })).cooldownLeftMs, 0);
});

test('RPCs are serialised: two concurrent calls never run in the page at the same time', async () => {
  let active = 0, max = 0;
  const w = worker(() => ({ status: 200, text: 'ok' }));
  w.ctx.chrome.scripting.executeScript = async () => {
    max = Math.max(max, ++active);
    await new Promise(r => setTimeout(r, 5));
    active--;
    return [{ result: { status: 200, text: 'ok' } }];
  };
  w.ctx.chrome.storage.local.get = async () => ({ luminaFlowPace: 'rapide' });
  await Promise.all([
    w.ctx.pacedRpc({ id: '1', rpcid: 'x', freq: 'f' }),
    w.ctx.pacedRpc({ id: '2', rpcid: 'x', freq: 'f' }),
  ]);
  assert.equal(max, 1);
});

test('Folder pickers are loaded in both panels before their scripts', () => {
  const grok = read('sidepanel.html');
  const flow = read('flow/side_panel.html');
  assert.ok(grok.indexOf('src="folders.js"') < grok.indexOf('src="sidepanel.js"'));
  assert.ok(flow.indexOf('src="../folders.js"') < flow.indexOf('src="side_panel.js"'));
  for (const key of ['images', 'clips', 'complete', 'script']) assert.match(grok, new RegExp(`data-folder-key="${key}"`));
  for (const key of ['flowImages', 'flowVideos']) assert.match(flow, new RegExp(`data-folder-key="${key}"`));
  assert.match(flow, /id="flow-pace"/);
});
