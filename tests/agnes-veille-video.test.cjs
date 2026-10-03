const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const AGNES = path.join(ROOT, 'agnes');
const SOURCE = fs.readFileSync(path.join(AGNES, 'plugins', 'plugin-veille.js'), 'utf8');

function load(fetchImpl = async () => { throw new Error('appel réseau inattendu'); }) {
  const plugins = {};
  const context = {
    AgnesPlugins: {
      register(id, plugin) { plugins[id] = plugin; },
      get(id) { return plugins[id]; },
      isLoaded(id) { return !!plugins[id]; },
    },
    fetch: fetchImpl,
    URL,
    console,
  };
  context.window = { AgnesApp: { esc: (value) => String(value) }, confirm: () => true };
  vm.createContext(context);
  vm.runInContext(SOURCE, context);
  return { plugin: plugins['veille-video'], plugins };
}

test('Veille vidéo est une extension Agnes indépendante, active par défaut', () => {
  const { plugin } = load();
  assert.equal(plugin.name, 'Veille vidéo TikTok et YouTube');
  assert.equal(plugin.version, '2.0');

  const modules = fs.readFileSync(path.join(AGNES, 'Module-reglage', 'active-module.js'), 'utf8');
  assert.match(modules, /key: "veille_video", id: "veille-video"[^\n]*plugin-veille\.js\?v=2\.0"[^\n]*defaultOn: true/);
  assert.ok(fs.existsSync(path.join(AGNES, 'docs', '32-veille-video.md')));
  assert.match(SOURCE, /AgnesPlugins\.isLoaded\("extracteur"\)\s*&&\s*AgnesPlugins\.get\("extracteur"\)/);
});

test('la veille garde son état dans le projet et reprend le pont configuré', () => {
  const { plugin, plugins } = load();
  const project = {};
  plugin.core = { getProject: () => project };
  assert.deepEqual(JSON.parse(JSON.stringify(plugin.state())), { filters: {}, videos: [], references: {} });
  assert.equal(plugin.state(), project.videoVeille);
  assert.equal(plugin.bridgeBase(), 'http://127.0.0.1:8177');

  plugins.moteurs = { cfg: { pont: 'http://127.0.0.1:9000/' } };
  assert.equal(plugin.bridgeBase(), 'http://127.0.0.1:9000');
});

test('la recherche et les exports utilisent seulement les routes publiques prévues', () => {
  assert.match(SOURCE, /\/video\/veille/);
  assert.match(SOURCE, /\/marketing\/video-veille/);
  assert.match(SOURCE, /\/marketing\/video-script\/verifier/);
  assert.doesNotMatch(SOURCE, /\/video\/telecharger|downloads?\.|chrome\.downloads/);
  assert.match(SOURCE, /source \|\| "—"/);
  assert.match(SOURCE, /verified_at \|\| "—"/);
});

async function controlWith(risque, local = { autorise: true, raisons: [], mots: 26, duree_estimee_s: 10, limite: '25 à 28 mots' }) {
  let aiCalls = 0;
  const { plugin } = load(async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:8177/marketing/video-script/verifier');
    const body = JSON.parse(options.body);
    assert.equal(body.source, 'Texte original');
    assert.equal(body.traduction, 'Traduction fidèle');
    assert.equal(body.creation, 'Création originale de vingt-six mots pour le test');
    return { ok: true, json: async () => structuredClone(local) };
  });
  const reference = {
    source: 'Texte original',
    translation: 'Traduction fidèle',
    creation: 'Création originale de vingt-six mots pour le test',
    control: null,
  };
  const guard = { textContent: '' };
  const atelierButton = { disabled: true };
  plugin.core = { saveProject() {}, toast() {} };
  plugin.view = { querySelector: (selector) => selector === '#vvGuard' ? guard : atelierButton };
  plugin.saveDraft = () => {};
  plugin.selected = () => reference;
  plugin.bridgeBase = () => 'http://127.0.0.1:8177';
  plugin.atelier = () => ({
    chat: async () => {
      aiCalls += 1;
      return { content: JSON.stringify({ risque, motif: 'comparaison sémantique' }) };
    },
  });
  const result = await plugin.checkOriginality();
  return { result, reference, guard, atelierButton, aiCalls };
}

test('un contrôle lexical et sémantique faible autorise le dossier Atelier', async () => {
  const checked = await controlWith('faible');
  assert.equal(checked.result.autorise, true);
  assert.equal(checked.reference.control.examen_semantique.risque, 'faible');
  assert.equal(checked.atelierButton.disabled, false);
  assert.match(checked.guard.textContent, /Contrôles lexical et du sens passés/);
});

test('une proximité sémantique moyenne bloque le dossier Atelier', async () => {
  const checked = await controlWith('moyen');
  assert.equal(checked.result.autorise, false);
  assert.equal(checked.atelierButton.disabled, true);
  assert.match(checked.guard.textContent, /Bloqué/);
  assert.match(checked.result.raisons.join(' '), /proximité de sens moyen/);
});

test('un refus local bloque sans appeler l’IA', async () => {
  const checked = await controlWith('faible', { autorise: false, raisons: ['texte trop proche'], mots: 26, duree_estimee_s: 10, limite: '' });
  assert.equal(checked.result.autorise, false);
  assert.equal(checked.aiCalls, 0);
  assert.equal(checked.atelierButton.disabled, true);
});
