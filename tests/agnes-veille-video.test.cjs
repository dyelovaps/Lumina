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
  assert.equal(plugin.version, '2.2');

  const modules = fs.readFileSync(path.join(AGNES, 'Module-reglage', 'active-module.js'), 'utf8');
  assert.match(modules, /key: "veille_video", id: "veille-video"[^\n]*plugin-veille\.js\?v=2\.2"[^\n]*defaultOn: true/);
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
  assert.match(SOURCE, /data-extract/);
  const extract = fs.readFileSync(path.join(AGNES, 'plugins', 'plugin-extract.js'), 'utf8');
  const modules = fs.readFileSync(path.join(AGNES, 'Module-reglage', 'active-module.js'), 'utf8');
  assert.match(extract, /version: "2\.0\.1"/);
  assert.match(extract, /openUrl: function \(url\)/);
  assert.match(extract, /downloadForAnalysis: function/);
  assert.match(extract, /\/video\/importer/);
  assert.match(extract, /prepareReference: function/);
  assert.match(modules, /plugin-extract\.js\?v=2\.0\.1/);
  assert.match(SOURCE, /id="vvAuto"/);
});

test('le filtre de publication masque les anciennes vidéos et les dates inconnues', () => {
  const { plugin } = load();
  const now = Math.floor(Date.now() / 1000);
  const recent = { id: 'recent', published: now - 5 * 86400 };
  const old = { id: 'old', published: now - 400 * 86400 };
  const unknown = { id: 'unknown', published: null };
  const project = { videoVeille: { filters: { period: 30 }, videos: [recent, old, unknown], references: {} } };
  plugin.core = { getProject: () => project };
  assert.deepEqual(plugin.visibleVideos().map((video) => video.id), ['recent']);
  project.videoVeille.filters.period = 0;
  assert.deepEqual(plugin.visibleVideos().map((video) => video.id), ['recent', 'old', 'unknown']);
});

test('les quatre objectifs créatifs ont des consignes distinctes', () => {
  const { plugin } = load();
  assert.match(plugin.purposeProfile('marketing').creationTitle, /Anthony/);
  assert.match(plugin.purposeProfile('court_metrage').creationTitle, /court métrage/);
  assert.match(plugin.purposeProfile('serie').creationTitle, /série/);
  assert.match(plugin.purposeProfile('film').creationTitle, /film/);
  assert.notEqual(plugin.purposeProfile('serie').create, plugin.purposeProfile('film').create);
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

test('film et série utilisent le contrôle générique sans dépendre du pont Marketing', async () => {
  let fetchCalls = 0;
  const { plugin } = load(async () => { fetchCalls += 1; throw new Error('route Marketing interdite'); });
  const reference = {
    purpose: 'film', source: 'Une pâtissière résout une disparition dans une petite ville.', translation: '',
    creation: 'Dans une station orbitale, un botaniste découvre que chaque plante efface un souvenir collectif.', control: null,
  };
  const guard = { textContent: '' }, atelierButton = { disabled: true };
  plugin.core = { saveProject() {}, toast() {} };
  plugin.view = { querySelector: (selector) => selector === '#vvGuard' ? guard : atelierButton };
  plugin.saveDraft = () => {};
  plugin.selected = () => reference;
  plugin.atelier = () => ({ chat: async () => ({ content: '{"risque":"faible","motif":"univers et intrigue différents"}' }) });
  const result = await plugin.checkOriginality();
  assert.equal(fetchCalls, 0);
  assert.equal(result.autorise, true);
  assert.equal(atelierButton.disabled, false);
});

test('le bouton Extraire transmet le lien au téléchargement intégré sans ouvrir la page source', () => {
  const { plugin, plugins } = load();
  let received = '';
  plugins.extracteur = { importUrl(url) { received = url; return Promise.resolve(true); } };
  plugin.core = { getProject: () => ({ videoVeille: { filters: {}, references: {}, videos: [{ url: 'https://youtu.be/abcdefghijk' }] } }), toast() {} };
  plugin.sendToExtract(0);
  assert.equal(received, 'https://youtu.be/abcdefghijk');
});

test('Extraire reçoit le lien une seule fois et ouvre son propre onglet', () => {
  const plugins = {}, shown = [], links = { value: 'https://example.com/deja', scrollIntoView() {} }, state = {};
  const context = {
    AgnesPlugins: { register(id, plugin) { plugins[id] = plugin; }, get(id) { return plugins[id]; } },
    URL, console,
  };
  context.window = { AgnesApp: { showView(id) { shown.push(id); } } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(AGNES, 'plugins', 'plugin-extract.js'), 'utf8'), context);
  const extract = plugins.extracteur;
  extract.core = { toast() {} };
  extract.$ = () => links;
  extract.st = () => state;
  extract.saveSoon = () => {};
  assert.equal(extract.openUrl('https://www.youtube.com/watch?v=abcdefghijk'), true);
  assert.equal(extract.openUrl('https://www.youtube.com/watch?v=abcdefghijk'), true);
  assert.equal(links.value.split('\n').filter((line) => line.includes('youtube.com')).length, 1);
  assert.equal(state.links, links.value);
  assert.deepEqual(shown, ['view_extraire', 'view_extraire']);
});

test('Extraire charge le fichier rendu par yt-dlp directement dans l’étape 2', async () => {
  const plugins = {}, calls = [];
  const context = {
    AgnesPlugins: { register(id, plugin) { plugins[id] = plugin; }, get(id) { return plugins[id]; }, isLoaded() { return false; } },
    URL, Blob, console,
    fetch: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return {
        ok: true,
        headers: { get(name) { return name === 'X-File-Name' ? 'reference-youtube.mp4' : ''; } },
        blob: async () => new Blob([new Uint8Array(25000)], { type: 'video/mp4' }),
      };
    },
  };
  context.window = { AgnesApp: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(AGNES, 'plugins', 'plugin-extract.js'), 'utf8'), context);
  const extract = plugins.extracteur;
  const button = { disabled: false, textContent: 'Télécharger pour analyser' };
  let loaded = null;
  extract.core = { toast() {} };
  extract.cfg = { dlQuality: '720' };
  extract.links = () => ['https://www.youtube.com/watch?v=abcdefghijk'];
  extract.bridgeBase = () => 'http://127.0.0.1:8177';
  extract.$ = (id) => id === 'exImport' ? button : { scrollIntoView() {} };
  extract.setSource = (blob, name, restoring, sourceUrl) => { loaded = { blob, name, restoring, sourceUrl }; };
  assert.equal(await extract.downloadForAnalysis(), true);
  assert.equal(calls[0].url, 'http://127.0.0.1:8177/video/importer');
  assert.equal(calls[0].body.hauteur, 720);
  assert.equal(loaded.name, 'reference-youtube.mp4');
  assert.equal(loaded.sourceUrl, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(loaded.blob.type, 'video/mp4');
});

test('Extraire distingue un transfert interrompu d’un pont réellement arrêté', async () => {
  const plugins = {}, calls = [], toasts = [];
  const context = {
    AgnesPlugins: { register(id, plugin) { plugins[id] = plugin; }, get(id) { return plugins[id]; }, isLoaded() { return false; } },
    URL, Blob, TypeError, console,
    fetch: async (url) => {
      calls.push(url);
      if (url.endsWith('/video/importer')) throw new TypeError('Failed to fetch');
      if (url.endsWith('/health')) return { ok: true, status: 200 };
      throw new Error('adresse inattendue');
    },
  };
  context.window = { AgnesApp: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(AGNES, 'plugins', 'plugin-extract.js'), 'utf8'), context);
  const extract = plugins.extracteur;
  const button = { disabled: false, textContent: 'Télécharger pour analyser' };
  extract.core = { toast(message) { toasts.push(message); } };
  extract.cfg = { dlQuality: '720' };
  extract.links = () => ['https://www.youtube.com/watch?v=abcdefghijk'];
  extract.bridgeBase = () => 'http://127.0.0.1:8177';
  extract.$ = (id) => id === 'exImport' ? button : { scrollIntoView() {} };

  assert.equal(await extract.downloadForAnalysis(), false);
  assert.deepEqual(calls, [
    'http://127.0.0.1:8177/video/importer',
    'http://127.0.0.1:8177/health',
  ]);
  assert.match(toasts.at(-1), /pont répond/);
  assert.match(toasts.at(-1), /disque C:/);
});

test('le déclencheur IA remplit le parcours dans l’ordre depuis Extraire', async () => {
  const { plugin, plugins } = load();
  const reference = { video: { url: 'https://youtu.be/abcdefghijk', language: 'en' }, source: '', visual: '', translation: '', analysis: '', creation: '' };
  const button = { disabled: false, textContent: '✨ Remplir le parcours avec l’IA' }, status = { textContent: '' };
  plugins.extracteur = {
    video: new Blob([new Uint8Array(25000)], { type: 'video/mp4' }),
    sourceUrl: reference.video.url,
    prepareReference: async () => ({ source: 'Original words', visual: 'Plan serré.', name: 'reference.mp4', url: reference.video.url }),
  };
  plugin.selected = () => reference;
  plugin.view = { querySelector: (selector) => selector === '#vvAuto' ? button : status };
  plugin.core = { saveProject() {}, toast() {} };
  plugin.renderWorkflow = () => {};
  plugin.translate = async () => { reference.translation = 'Traduction'; return reference.translation; };
  plugin.analyze = async () => { reference.analysis = 'Analyse'; return reference.analysis; };
  plugin.createScript = async () => { reference.creation = 'Création'; return reference.creation; };
  assert.equal(await plugin.autoFill(), true);
  assert.equal(reference.source, 'Original words');
  assert.equal(reference.visual, 'Plan serré.');
  assert.equal(reference.translation, 'Traduction');
  assert.equal(reference.analysis, 'Analyse');
  assert.equal(reference.creation, 'Création');
  assert.match(status.textContent, /Parcours rempli/);
});
