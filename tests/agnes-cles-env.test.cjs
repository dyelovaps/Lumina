const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Agnes : clés API reçues du pont (fichier .env hors de l'app) → en mémoire, jamais dans le stockage du navigateur.
function agnes({ cles = null, pontEnPanne = false, store = {} } = {}) {
  const storage = { ...store };
  const toasts = [];
  const context = {
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => { storage[k] = String(v); },
    },
    fetch: async (url) => {
      if (pontEnPanne) throw new Error('Failed to fetch');
      assert.equal(url, 'http://127.0.0.1:8177/cles');
      return { ok: true, json: async () => ({ fichier: 'D:/Rmaopn/cles/agnes.env', cles }) };
    },
    setTimeout: (fn) => fn(),
    console, EventTarget, CustomEvent: globalThis.CustomEvent || class extends Event { constructor(t, o) { super(t); this.detail = o && o.detail; } }, Event,
  };
  context.window = context;
  vm.createContext(context);
  const dir = path.join(__dirname, '..', 'agnes', 'js');
  vm.runInContext(fs.readFileSync(path.join(dir, 'agnes-core.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(dir, 'cles-env.js'), 'utf8'), context);
  // fausse app : réglages ⚙ enregistrés comme app-state.js
  const A = {
    settings: JSON.parse(storage.agnes_studio_settings_v3 || '{"apiKey":"","imgbbKey":""}'),
    persistSettings() { storage.agnes_studio_settings_v3 = JSON.stringify(context.AgnesCles.strip('settings', A.settings)); },
    toast: (m, t) => toasts.push([m, t]),
  };
  context.AgnesApp = A;
  return { ctx: context, A, storage, toasts, core: context.AgnesCore, C: context.AgnesCles };
}
const tick = () => new Promise((r) => setImmediate(r));

test('les clés du .env sont utilisées en mémoire et jamais enregistrées', async () => {
  const { A, storage, core, C, toasts } = agnes({ cles: { AGNES_API_KEY: 'k-agnes', GROQ_API_KEY: 'k-groq', ELEVENLABS_API_KEY: 'k-11' } });
  await tick(); await tick();
  const atelier = core.pluginSettings('atelier', { keys: {}, model: 'm' });
  const tts = core.pluginSettings('tts', { elevenKey: '', openaiKey: '' });
  assert.equal(A.settings.apiKey, 'k-agnes');
  assert.equal(atelier.keys.groq, 'k-groq');
  assert.equal(tts.elevenKey, 'k-11');
  atelier.save(); tts.save(); A.persistSettings();
  const dump = JSON.stringify(storage);
  assert.ok(!/k-agnes|k-groq|k-11/.test(dump), dump);
  assert.equal(JSON.parse(storage.agnes_plugin_atelier).model, 'm');   // le reste des réglages est bien enregistré
  assert.equal(storage.agnes_cles_env, '1');
  assert.ok(C.actif);
  assert.match(toasts[0][0], /Clés chargées depuis D:\/Rmaopn\/cles\/agnes\.env : 3/);
});

test('les anciennes copies des clés sont effacées du navigateur', async () => {
  const store = {
    agnes_studio_settings_v3: JSON.stringify({ apiKey: 'ANCIENNE', imgbbKey: 'img-garde', baseUrl: 'x' }),
    agnes_plugin_atelier: JSON.stringify({ keys: { gemini: 'ANCIENNE-G', mistral: 'garde-m' } }),
  };
  const { storage, core } = agnes({ store, cles: { AGNES_API_KEY: 'k1', GEMINI_API_KEY: 'k2' } });
  core.pluginSettings('atelier', { keys: {} });
  await tick(); await tick();
  const s = JSON.parse(storage.agnes_studio_settings_v3), a = JSON.parse(storage.agnes_plugin_atelier);
  assert.equal(s.apiKey, undefined);
  assert.equal(s.imgbbKey, 'img-garde');        // clé absente du .env : réglée comme avant dans ⚙
  assert.equal(a.keys.gemini, undefined);
  assert.equal(a.keys.mistral, 'garde-m');
});

test('les réglages rechargés récupèrent les clés du .env', async () => {
  const { A, C } = agnes({ cles: { AGNES_API_KEY: 'k1' } });
  await tick(); await tick();
  A.settings = { apiKey: '', imgbbKey: '' };      // A.loadSettings remplace l'objet
  C.remplir('settings');
  assert.equal(A.settings.apiKey, 'k1');
});

test('pont éteint : message seulement si le mode .env était actif', async () => {
  const a = agnes({ pontEnPanne: true });
  await tick(); await tick();
  assert.equal(a.toasts.length, 0);
  const b = agnes({ pontEnPanne: true, store: { agnes_cles_env: '1' } });
  await tick(); await tick();
  assert.match(b.toasts[0][0], /lancer_pont\.bat/);
});

test('sans clé dans le fichier, rien ne change', async () => {
  const { A, storage, C } = agnes({ cles: {}, store: { agnes_studio_settings_v3: JSON.stringify({ apiKey: 'saisie' }) } });
  await tick(); await tick();
  assert.equal(C.actif, false);
  A.persistSettings();
  assert.equal(JSON.parse(storage.agnes_studio_settings_v3).apiKey, 'saisie');
});
