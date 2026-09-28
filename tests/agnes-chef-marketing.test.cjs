const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Atelier IA d'Agnes (plugin-atelier.js) avec une fausse app : outils du Chef pour les générations et l'agent Marketing.
function atelier({ grokBloque = '', video = 'grok', canGrok = true, reponse = {} } = {}) {
  const plugins = {};
  const queued = [];
  const calls = [];
  const shots = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];
  const moteurs = { cfg: { image: 'chatgpt', video, pont: 'http://127.0.0.1:8177/', grokBloque }, canGrok: () => canGrok };
  const context = {
    AgnesPlugins: { register(id, obj) { plugins[id] = obj; }, get: (id) => (id === 'moteurs' ? moteurs : plugins[id]) },
    AgnesApp: {
      sortedShots: () => shots,
      enqueueStage: (s, stage) => { queued.push([s.id, stage]); return { id: 'j' }; },
      enqueueShot: (s) => { queued.push([s.id, 'auto']); return { id: 'j' }; },
      uid: () => 'u' + Math.random(),
    },
    fetch: async (url, init) => {
      calls.push({ url, body: init && init.body ? JSON.parse(init.body) : null });
      return { ok: true, json: async () => reponse[url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]] || {} };
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'agnes', 'plugins', 'plugin-atelier.js'), 'utf8'), context);
  const P = plugins.atelier;
  const docs = [];
  const st = { docs, chat: [] };
  P.project = () => st;
  P.core = { saveProject() {}, toast() {} };
  P.renderDocs = () => {};
  P.cfg = { primary: 'agnes', models: {}, keys: {}, fallback: true };
  P.configured = () => ['agnes'];
  P.keyOf = () => 'CLE-AGNES';
  P.baseOf = () => 'https://apihub.agnes-ai.com/v1';
  return { P, queued, calls, docs };
}

test('les nouveaux outils sont déclarés et ceux qui agissent demandent une autorisation', () => {
  const { P } = atelier();
  const names = P.TOOLS.map((t) => t.function.name);
  for (const n of ['generate_shots', 'marketing_state', 'marketing_veille', 'marketing_generate_day', 'marketing_get_day', 'marketing_validate']) {
    assert.ok(names.includes(n), n);
  }
  assert.equal(P.NEEDS_AUTH.generate_shots, true);
  assert.equal(P.NEEDS_AUTH.marketing_generate_day, true);
  assert.equal(P.NEEDS_AUTH.marketing_veille, true);
  assert.ok(!P.NEEDS_AUTH.marketing_state && !P.NEEDS_AUTH.marketing_validate);
});

test('generate_shots met en file les cartes demandées, à l’étape demandée', () => {
  const { P, queued } = atelier();
  const out = P.generateShots({ plans: [1, 3], etape: 'image' });
  assert.deepEqual(queued, [['s1', 'image'], ['s3', 'image']]);
  assert.match(out, /2 carte\(s\) mise\(s\) en file \(étape image\) : 1, 3/);
  assert.match(P.describeGeneration({ plans: [1, 3], etape: 'image' }), /2 génération\(s\) image \(moteur : chatgpt\) — cartes 1, 3/);
});

test('generate_shots ne lance rien si une carte manque', () => {
  const { P, queued } = atelier();
  assert.match(P.generateShots({ plans: [2, 9], etape: 'image' }), /Cartes introuvables : 9/);
  assert.deepEqual(queued, []);
});

test('generate_shots respecte le garde-fou « Grok bloqué » pour les vidéos', () => {
  const { P, queued } = atelier({ grokBloque: 'Grok a généré 6 vidéo(s) en trop.' });
  assert.match(P.generateShots({ plans: [1], etape: 'video' }), /Grok est bloqué/);
  assert.deepEqual(queued, []);
  // les images restent possibles (ChatGPT)
  P.generateShots({ plans: [1], etape: 'image' });
  assert.deepEqual(queued, [['s1', 'image']]);
});

test('generate_shots refuse Grok hors de Lumina', () => {
  const { P, queued } = atelier({ canGrok: false });
  assert.match(P.generateShots({ plans: [1], etape: 'video' }), /Grok indisponible/);
  assert.deepEqual(queued, []);
});

test('marketing_generate_day appelle le pont avec le fournisseur de l’Atelier et dépose le livrable', async () => {
  const reponse = { '/marketing/journee': { date: '2026-10-01', pilier: 'avatar_ia', pret: true, livrable_nom: 'Marketing — 2026-10-01',
    livrable: '# Livrable', videos: [{ type: 'educatif', statut: 'pret_a_produire', duree_s: 9.2, generateur: 'llm', hook: 'Ton avatar paraît figé ?', erreurs: [] }] } };
  const { P, calls } = atelier({ reponse });
  const out = await P.execTool({ name: 'marketing_generate_day', args: { methode: 'pas', date: '2026-10-01', topic: 'Avatar IA' } });
  assert.equal(calls[0].url, 'http://127.0.0.1:8177/marketing/journee');
  assert.equal(calls[0].body.date, '2026-10-01');
  assert.equal(calls[0].body.methode, 'pas');
  assert.match(P.describe({ name: 'marketing_generate_day', args: { methode: 'pas', date: '2026-10-01' } }), /méthode pas/);
  assert.match(P.managerSystem ? String(P.TOOLS.find((t) => t.function.name === 'marketing_generate_day').function.parameters.properties.methode.description) : '', /aida, pas/);
  assert.deepEqual({ ...calls[0].body.llm, min_interval_s: undefined },
    { base: 'https://apihub.agnes-ai.com/v1', key: 'CLE-AGNES', model: 'agnes-2.5-flash', label: 'Agnes AI', min_interval_s: undefined });
  assert.equal(P.project().docs.length, 1);
  assert.equal(P.project().docs[0].name, 'Marketing — 2026-10-01');
  assert.match(out, /3\/3 vidéos prêtes/);
  assert.match(out, /get_document/);
});

test('un livrable régénéré remplace le document du même nom', () => {
  const { P, docs } = atelier();
  P.addDoc('Marketing — 2026-10-01', 'v1', 'agent Marketing', true);
  P.addDoc('Marketing — 2026-10-01', 'v2', 'agent Marketing', true);
  assert.equal(P.project().docs.length, 1);
  assert.equal(P.project().docs[0].content, 'v2');
  assert.equal(docs.length, 0); // l'ancien tableau a été remplacé, pas modifié
});

test('pont injoignable : message clair', async () => {
  const { P } = atelier();
  P.pont = () => 'http://127.0.0.1:1';
  const ctxFetch = async () => { throw new Error('ECONNREFUSED'); };
  P.marketingCall = function (m, p, b) { return ctxFetch().then(null, () => { throw new Error('pont local injoignable : lancez lancer_pont.bat (prod-fruits) puis réessayez'); }); };
  await assert.rejects(P.execTool({ name: 'marketing_state', args: {} }), /lancer_pont\.bat/);
});
