const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

function runtime(enabled = false) {
  const listeners = [];
  const sockets = [];
  const tabs = [];
  const alarms = new Map();
  const storage = { luminaFlowEnabled: enabled };
  const event = () => ({ addListener() {} });
  const ctx = {
    console: { log() {}, error() {} }, setTimeout, clearTimeout,
    WebSocket: class {
      static OPEN = 1; static CONNECTING = 0;
      constructor(url) { this.url = url; this.readyState = 0; sockets.push(this); }
      close() { this.readyState = 3; this.onclose?.(); }
    },
    chrome: {
      runtime: { onMessage: { addListener(fn) { listeners.push(fn); } }, onInstalled: event(), onStartup: event(),
        sendMessage: async () => {}, getManifest: () => JSON.parse(read('manifest.json')) },
      storage: { local: { get: async () => storage, set: async data => Object.assign(storage, data) } },
      alarms: { onAlarm: event(), create: (name, config) => alarms.set(name, config), clear: name => alarms.delete(name) },
      webRequest: { onBeforeSendHeaders: event() },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
      tabs: { query: async () => [], create: async options => { tabs.push(options); return { id: 7 }; } },
    },
  };
  vm.runInNewContext(read('flow/background.js'), ctx);
  return { listeners, sockets, tabs, alarms, storage,
    send: msg => new Promise(resolve => listeners[0](msg, {}, resolve)),
  };
}

test('A single manifest isolates Grok and Flow scripts and includes all referenced assets', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.background.service_worker, 'background.js');
  assert.equal(manifest.background.type, 'module');
  assert.match(read('background.js'), /import "\.\/flow\/background.js"/);
  const [grok, flow] = manifest.content_scripts;
  assert.ok(grok.matches.every(m => m.includes('grok.com')));
  assert.ok(flow.matches.every(m => !m.includes('grok.com')));
  for (const p of [...grok.js, ...flow.js, ...manifest.web_accessible_resources.flatMap(r => r.resources),
    ...manifest.declarative_net_request.rule_resources.map(r => r.path)]) assert.ok(fs.existsSync(path.join(root, p)), p);
  assert.match(read('flow/content.js'), /getURL\('flow\/injected.js'\)/);
  assert.doesNotMatch(read('flow/background.js'), /files: \['content.js'\]/);
});

test('Flow remains disconnected until enabled and ignores Grok messages', async () => {
  const r = runtime();
  const status = await r.send({ type: 'STATUS' });
  assert.equal(status.manualDisconnect, true);
  assert.equal(r.sockets.length, 0);
  for (const type of ['SEND_TO_TAB', 'SUBMIT_PROMPT', 'DOWNLOAD', 'ENSURE_IMAGINE']) {
    assert.equal(r.listeners[0]({ type }, {}, () => assert.fail('Unexpected Flow response')), false);
  }
});

test('Flow activation and deactivation persist and maintain separate alarms', async () => {
  const r = runtime();
  await r.send({ type: 'RECONNECT' });
  assert.equal(r.storage.luminaFlowEnabled, true);
  assert.equal(r.sockets[0].url, 'ws://127.0.0.1:9222');
  assert.ok([...r.alarms.keys()].every(name => name.startsWith('lumina-flow-')));
  await r.send({ type: 'DISCONNECT' });
  assert.equal(r.storage.luminaFlowEnabled, false);
  assert.equal(r.alarms.size, 0);
  assert.equal((await r.send({ type: 'STATUS' })).state, 'off');
});

test('An enabled bridge reconnects on worker restart', async () => {
  const r = runtime(true);
  await r.send({ type: 'STATUS' });
  assert.equal(r.sockets.length, 1);
});

test('Open Flow targets Google Flow without opening Grok or activating the service', async () => {
  const r = runtime();
  assert.equal((await r.send({ type: 'OPEN_FLOW_TAB' })).ok, true);
  assert.equal(r.tabs[0].url, 'https://flow.google.com/');
  assert.equal(r.sockets.length, 0);
});

test('Flow iframe and setup documentation are present; the original MIT notice is preserved', () => {
  assert.match(read('sidepanel.html'), /data-tab="flow"/);
  assert.match(read('sidepanel.html'), /src="flow\/side_panel.html"/);
  assert.match(read('flow/setup.html'), /FLOW_PROJECT_ID/);
  assert.match(read('flow/LICENSE'), /Copyright \(c\) 2026 tuannguyenhoangit-droid/);
  assert.doesNotMatch(read('flow/background.js'), /scheduleTelemetry/);
});
