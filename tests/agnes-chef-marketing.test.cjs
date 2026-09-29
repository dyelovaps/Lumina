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
  return { P, queued, calls, docs, context };
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

test('journée renvoyée : update_shots document + cartes applique le LOT aux cartes existantes, sans en créer', () => {
  const { P, docs, context } = atelier();
  const shots = [{ id: 's1', mode: 't2v', prompt: 'a' }, { id: 's2', mode: 't2v', prompt: 'b' }, { id: 's3', mode: 't2v', prompt: 'c' },
    { id: 's4', mode: 't2v', prompt: 'vieux 4', imagePrompt: 'vieille image 4' }, { id: 's5', mode: 't2v', prompt: 'vieux 5' }];
  Object.assign(context.AgnesApp, { sortedShots: () => shots, modeKind: () => 'video', renderShots() {} });
  P.core.getProject = () => ({ shots });
  docs.push({ name: 'Marketing — 2026-09-30', content: '# Livrable\n\n## LOT (à envoyer tel quel avec send_to_lot)\n\n```text\n' +
    '01 — educatif · Un.\nIMAGE : image 1\nVIDÉO : « réplique 1 »\nRÉF : Anthony\n\n02 — probleme · Deux.\nIMAGE : image 2\nVIDÉO : « réplique 2 »\n```\n\n## CADRAGES\n01 — ignoré\nIMAGE : non\n' });
  assert.deepEqual([...P.parseLot(docs[0].content).map((b) => b.video)], ['« réplique 1 »', '« réplique 2 »']);
  assert.throws(() => P.applyLotToCards('Marketing — 2026-09-30', [4]), (e) => /2 bloc\(s\) mais 1 carte/.test(e.display));
  assert.match(P.describe({ name: 'update_shots', args: { document: 'Marketing — 2026-09-30', cartes: [4, 5] } }), /cartes existantes #4, #5.*aucune nouvelle carte/);
  const out = P.applyLotToCards('Marketing — 2026-09-30', [4, 5]);
  assert.match(out, /2 carte\(s\) du Storyboard : 4, 5/);
  assert.equal(shots.length, 5);                                              // aucune carte créée
  assert.equal(shots[3].prompt, '« réplique 1 »');
  assert.equal(shots[3].imagePrompt, 'image 1');
  assert.equal(shots[4].prompt, '« réplique 2 »');
  assert.equal(shots[0].prompt, 'a');                                         // les autres cartes ne bougent pas
});

test('règle du Chef : renvoi marketing sans doublon, et consignes des histoires (épisodes, scénario, Bible) intactes', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'agnes', 'plugins', 'plugin-atelier.js'), 'utf8');
  assert.match(src, /N'UTILISE PAS send_to_lot, qui créerait des cartes en double/);
  for (const r of ['Un seul épisode à la fois pour les étapes 5 à 15', 'confie-les à a16 (Directeur de plans)',
    'Tu n\'écris pas toi-même le contenu créatif', 'send_to_scenario']) assert.ok(src.includes(r), r);
});

test('ressources locales : sans Extraire, le Chef le dit et rien ne casse', async () => {
  const { P, calls } = atelier();
  assert.equal(P.NEEDS_AUTH.transcrire_ressource, true);
  assert.equal(P.NEEDS_AUTH.marketing_extraire_fiche, true);
  assert.ok(!P.NEEDS_AUTH.marketing_ressources);
  const out = await P.execTool({ name: 'transcrire_ressource', args: { fiche: 'la-methode-aida', video: 0 } });
  assert.match(out, /Extraire n'est pas active/);
  assert.equal(calls.length, 0);                                   // aucun appel au pont
});

test('ressources locales : vidéo du pont → Extraire (Whisper) → contrôle → fiche + document de l’Atelier', async () => {
  const { P, context } = atelier();
  const plugins = {};
  const posted = [];
  const fakeEx = { transcribeBlob: async (blob, name) => ({ text: 'la methode aida commence par attirer l attention du prospect', segments: [], name }) };
  context.AgnesPlugins.get = (id) => (id === 'extracteur' ? fakeEx : plugins[id]);
  context.AgnesApp.uid = () => 'u1';
  context.fetch = async (url, init) => {
    if (url.includes('/marketing/ressource-video')) return { ok: true, blob: async () => ({ size: 10 }) };
    posted.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ fiche: 'la-methode-aida', mots: 10, mots_sources: 900, controle: true, par: 'Codex',
      corriges: 1, morceaux: 1, gardes_bruts: 0, texte_controle: 'La méthode AIDA commence par attirer l’attention du prospect.' }) };
  };
  const out = await P.execTool({ name: 'transcrire_ressource', args: { fiche: 'la-methode-aida', video: 1 } });
  assert.match(out, /contrôlée par Codex/);
  assert.equal(posted.length, 1);
  assert.match(posted[0].url, /\/marketing\/transcription$/);
  assert.equal(posted[0].body.fiche, 'la-methode-aida');
  assert.match(posted[0].body.texte, /methode aida/);
  const saved = P.project().docs;                                   // addDoc(…, replace) remplace la liste
  assert.equal(saved.length, 1);
  assert.match(saved[0].name, /Transcription — la-methode-aida \(vidéo 1\)/);
});

test('Extraire expose transcribeBlob sans dépendre de l’Atelier', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'agnes', 'plugins', 'plugin-extract.js'), 'utf8');
  const body = src.slice(src.indexOf('transcribeBlob: function'), src.indexOf('WHISPER_DIR'));
  assert.ok(body.length > 50);
  assert.ok(!/AgnesPlugins\.get\("atelier"\)/.test(body));
});
