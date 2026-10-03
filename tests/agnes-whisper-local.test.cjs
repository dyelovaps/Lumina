const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Extracteur d'Agnes : d'où vient le moteur Whisper selon la façon dont Agnes est ouverte.
function extracteur(href) {
  const plugins = {};
  const u = new URL(href);
  const context = {
    AgnesPlugins: { register(id, obj) { plugins[id] = obj; }, get: (id) => plugins[id] },
    location: { protocol: u.protocol, href },
    document: { baseURI: href },
    URL,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'agnes', 'plugins', 'plugin-extract.js'), 'utf8'), context);
  return plugins.extracteur;
}
const CDN = /^https:\/\/cdn\.jsdelivr\.net\//;

test('dans Lumina : moteur local uniquement, sans repli sur internet', () => {
  const srcs = extracteur('chrome-extension://abcdefgh/agnes/index.html').whisperSources();
  assert.equal(srcs.length, 1);
  assert.equal(srcs[0].lib, 'chrome-extension://abcdefgh/agnes/vendor/transformers/transformers.min.js');
  assert.equal(srcs[0].wasm, 'chrome-extension://abcdefgh/agnes/vendor/transformers/');
  assert.equal(srcs[0].proxy, false);
});

test('Agnes seule en localhost / Live Server : moteur local, puis internet en secours', () => {
  for (const href of ['http://localhost:8000/index.html', 'http://127.0.0.1:5500/Agnes_production/index.html']) {
    const srcs = extracteur(href).whisperSources();
    assert.equal(srcs[0].lib, new URL('vendor/transformers/transformers.min.js', href).href);
    assert.match(srcs[1].lib, CDN);
  }
});

test('Agnes ouverte en fichier : internet, comme avant', () => {
  const srcs = extracteur('file:///D:/Agnes_production/index.html').whisperSources();
  assert.equal(srcs.length, 1);
  assert.match(srcs[0].lib, CDN);
});

test('les fichiers du moteur sont livrés avec Agnes', () => {
  const dir = path.join(__dirname, '..', 'agnes', 'vendor', 'transformers');
  for (const f of ['transformers.min.js', 'ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.jsep.mjs']) {
    assert.ok(fs.statSync(path.join(dir, f)).size > 10000, f);
  }
});

test('le manifeste autorise le WebAssembly local et n’expose rien aux sites', () => {
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));
  assert.match(m.content_security_policy.extension_pages, /'wasm-unsafe-eval'/);
  assert.doesNotMatch(m.content_security_policy.extension_pages, /https?:/);
  assert.ok(!JSON.stringify(m.web_accessible_resources).includes('transformers'));
  for (const host of ['https://huggingface.co/*', 'https://*.huggingface.co/*', 'https://*.hf.co/*']) {
    assert.ok(m.host_permissions.includes(host), `permission modèle manquante : ${host}`);
  }
});

test('Whisper local utilise un seul chargement WASM q8 stable', async () => {
  const ex = extracteur('chrome-extension://abcdefgh/agnes/index.html');
  let calls = 0;
  let options = null;
  const asr = () => Promise.resolve({ text: '' });
  ex.importWhisper = async () => ({
    env: { allowLocalModels: true, allowRemoteModels: false, useBrowserCache: false, backends: { onnx: { wasm: {} } } },
    pipeline: async (_task, _model, opts) => {
      calls += 1;
      options = opts;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return asr;
    },
  });
  const statusA = { textContent: '' };
  const statusB = { textContent: '' };
  const [first, second] = await Promise.all([
    ex.loadWhisper('Xenova/whisper-base', statusA),
    ex.loadWhisper('Xenova/whisper-base', statusB),
  ]);
  assert.equal(calls, 1);
  assert.equal(first, asr);
  assert.equal(second, asr);
  assert.equal(options.device, 'wasm');
  assert.equal(options.dtype, 'q8');
});
