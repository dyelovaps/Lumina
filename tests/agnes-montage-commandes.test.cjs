/* Agnes → Montage, étape 5 (01/10/2026) : compilation des vidéos finales et commandes (Claude, Chef de l'Atelier).
 * Le vrai code tourne contre un faux pont : aucun ffmpeg, aucun fichier écrit.
 * Vérifie : compilation des finals dans l'ordre du storyboard (refus si une carte n'est pas montée), montage de plusieurs
 * cartes avec options gardées sur les cartes, aucune voix-off générée, commandes de Claude et outils du Chef qui appellent
 * Montage sans le modifier, message clair quand Montage est désactivé. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', 'agnes', 'plugins', f), 'utf8');

function montage({ shots = [], etat = null } = {}) {
  let def = null;
  const appels = [];
  const reply = (body, st = 200) => Promise.resolve({ ok: st < 400, status: st, json: () => Promise.resolve(body) });
  const fetch = (url, init = {}) => {
    const route = url.replace('http://127.0.0.1:8177', '');
    appels.push({ route, body: init.body && typeof init.body === 'string' ? JSON.parse(init.body) : init.body });
    if (route === '/montage/compilation') return reply({ ok: true, id: 'c1', position: 1 });
    if (route === '/montage/carte') return reply({ ok: true, id: 'm1', position: 1 });
    if (route.startsWith('/montage/etat')) return reply(etat || { statut: 'fini', resultat: { nom: 'x.mp4', chemin: 'D:/P/Final/x.mp4', duree: { apres: 9.8 }, son: { apres_lufs: -14, apres_crete: -1 }, alertes: [] } });
    return reply({ error: 'not found' }, 404);
  };
  const ctx = { fetch, setTimeout: (f) => setTimeout(f, 0), console, AgnesPlugins: { register: (id, d) => { def = d; } } };
  ctx.window = { AgnesPlugins: { isLoaded: () => false, get: () => null } };
  vm.runInNewContext(lire('plugin-montage.js'), ctx);
  const projet = {};
  def.cfg = Object.assign({ pont: def.PONT, save() {} }, def.DEFAUTS);
  def.compil = Object.assign({}, def.COMPIL);
  def.mods = { cartons: [], montages: [{ id: 'mm1', nom: 'Marketing', r: { vitesse: 1.1 } }], favoris: ['mm1'] };
  def.etats = {}; def.choix = {};
  def.view = { querySelector: () => null, classList: { contains: () => false } };
  def.core = { saveProject() {}, toast() {}, getProject: () => projet, store: { setKV() {} } };
  def.A = { esc: (s) => String(s), sortedShots: () => shots, selectedTake: (s) => (s.takes || [])[0] || null };
  def.render = () => {};
  return { def, appels, projet };
}

const carte = (id, n, final) => ({ id, notes: 'Carte ' + n, takes: [{ kind: 'video', localPath: `Marketing/J/Video/Carte 0${n} - Anthony.mp4` }],
  montage: final ? { dernier: { chemin: `D:/Production/Marketing/J/Final/Carte 0${n} - Anthony - final.mp4`, date: '01/10/2026' } } : undefined });

test('compilation « tous » : les finals des cartes montées, dans l\'ordre du storyboard, avec les réglages du projet', async () => {
  const shots = [carte('a', 1, true), carte('b', 2, false), carte('c', 3, true)];
  const { def, appels, projet } = montage({ shots, etat: { statut: 'fini', resultat: { chemin: 'D:/P/Final/Compilation - Cartes 01, 03.mp4', nom: 'Compilation - Cartes 01, 03.mp4', alertes: [] } } });
  def.compil.transition = 'fondu';
  const res = await def.compilerFinales('tous');
  const envoi = appels.find((a) => a.route === '/montage/compilation').body;
  assert.deepEqual(Array.from(envoi.videos), ['D:/Production/Marketing/J/Final/Carte 01 - Anthony - final.mp4', 'D:/Production/Marketing/J/Final/Carte 03 - Anthony - final.mp4']);
  assert.equal(envoi.reglages.transition, 'fondu');
  assert.equal(res.nom, 'Compilation - Cartes 01, 03.mp4');
  assert.deepEqual(Array.from(projet.montageCarte.derniereCompilation.cartes), [1, 3]);
});

test('compilation : carte pas encore montée ou une seule carte = refus clair, rien envoyé au pont', async () => {
  const { def, appels } = montage({ shots: [carte('a', 1, true), carte('b', 2, false)] });
  await assert.rejects(def.compilerFinales([1, 2]), /carte\(s\) 2 pas encore montée/);
  await assert.rejects(def.compilerFinales('tous'), /au moins deux cartes montées/);
  await assert.rejects(def.compilerFinales('7'), /carte 7 introuvable/);
  assert.equal(appels.filter((a) => a.route === '/montage/compilation').length, 0);
});

test('monter plusieurs cartes : options gardées sur les cartes comme un clic, résultat carte par carte', async () => {
  const shots = [carte('a', 1), { id: 'b', notes: 'Carte 2', takes: [] }];
  const { def, appels } = montage({ shots });
  const out = await def.monterCartes('1,2', { resserrer: true, karaoke: false, appel: 'aucun', reglages: { vitesse: 1.2 } });
  assert.equal(out.length, 2);
  assert.equal(out[0].ok, true);
  assert.equal(out[0].lufs, -14);
  assert.equal(out[1].ok, false);
  assert.match(out[1].erreur, /non classée/);
  assert.equal(shots[0].montage.resserrer, true);
  assert.equal(shots[0].montage.appel, 'aucun');
  const envoi = appels.find((a) => a.route === '/montage/carte').body;
  assert.equal(envoi.reglages.vitesse, 1.2);
  assert.equal(envoi.reglages.carton, false, 'pas de carton');
  await assert.rejects(def.monterCartes('1', { appel: 'chanter' }), /appel inconnu/);
  await assert.rejects(def.monterCartes('1', { modele: 'Inconnu' }), /introuvable/);
});

test('monter : jamais de voix-off générée — carte « Carton + voix-off » sans voix-off refusée', async () => {
  const shots = [carte('a', 1)];
  const { def, appels } = montage({ shots });
  const out = await def.monterCartes([1], { appel: 'voixoff' });
  assert.equal(out[0].ok, false);
  assert.match(out[0].erreur, /faites d'abord la voix-off/);
  assert.equal(appels.length, 0, 'ni pont ni synthèse vocale');
});

test('état des cartes et modèles lisibles par Claude et le Chef', () => {
  const { def } = montage({ shots: [carte('a', 1, true), { id: 'b', notes: 'CARTON DE FIN : « Abonne-toi »', takes: [], montage: { appel: 'voixoff' } }] });
  const e = def.etatCartes();
  assert.equal(e.cartes[0].final.chemin, 'D:/Production/Marketing/J/Final/Carte 01 - Anthony - final.mp4');
  assert.equal(e.cartes[1].montable, false);
  assert.equal(e.cartes[1].carton, 'Abonne-toi');
  assert.match(e.cartes[1].voix_off, /à faire/);
  const m = def.listeModeles();
  assert.deepEqual(JSON.parse(JSON.stringify(m.montage)), [{ nom: 'Marketing', favori: true }]);
});

test('Claude : etat_montage, monter, compiler appellent Montage ; Montage désactivé = erreur claire', async () => {
  let def = null, actif = true;
  const appelsM = [];
  const M = {
    monterCartes: (c, o) => { appelsM.push(['monter', c, o]); return Promise.resolve([{ carte: 1, ok: true }]); },
    compilerFinales: (c, r) => { appelsM.push(['compiler', c, r]); return Promise.resolve({ chemin: 'x' }); },
    etatCartes: () => ({ cartes: [] }), listeModeles: () => ({ montage: [] }),
  };
  const ctx = { console, AgnesPlugins: { register: (id, d) => { def = d; }, isLoaded: (id) => actif && id === 'montage', get: (id) => (id === 'montage' ? M : null) } };
  ctx.window = ctx;
  vm.runInNewContext(lire('plugin-claude.js'), ctx);
  def.A = {}; def.core = {};
  assert.deepEqual(JSON.parse(JSON.stringify(def.run('etat_montage', {}))), { cartes: [] });
  await def.run('monter', { cartes: [1, 2], karaoke: true, modele: 'Marketing' });
  await def.run('compiler', { cartes: 'tous', transition: 'noir' });
  assert.deepEqual(JSON.parse(JSON.stringify(appelsM[0])), ['monter', [1, 2], { modele: 'Marketing', karaoke: true }]);
  assert.deepEqual(JSON.parse(JSON.stringify(appelsM[1])), ['compiler', 'tous', { transition: 'noir' }]);
  actif = false;
  assert.throws(() => def.run('monter', {}), /Montage inactive/);
});

test('Chef : outils de montage déclarés, montage et compilation sous autorisation, Montage désactivé = message', async () => {
  const plugins = {};
  let actif = false;
  const M = { monterCartes: () => Promise.resolve([{ carte: 2, ok: true, chemin: 'D:/F/c.mp4', lufs: -14.1, crete: -1, alertes: [] }]),
    compilerFinales: () => Promise.resolve({ chemin: 'D:/F/Compilation.mp4', duree: 20, transition: 'coupe franche', son: { lufs: -14 }, srt: null, compte_rendu: 'D:/F/cr.txt', alertes: [] }),
    etatCartes: () => ({ modele: 'Marketing', cartes: [] }), listeModeles: () => ({ montage: [], carton: [], projet: {} }) };
  const ctx = { console, AgnesPlugins: { register(id, o) { plugins[id] = o; }, isLoaded: (id) => actif && id === 'montage', get: (id) => (id === 'montage' ? M : plugins[id]) } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(lire('plugin-atelier.js'), ctx);
  const P = plugins.atelier;
  const noms = P.TOOLS.map((t) => t.function.name);
  for (const n of ['montage_etat', 'montage_modeles', 'monter_cartes', 'compiler_finales']) assert.ok(noms.includes(n), n);
  assert.equal(P.NEEDS_AUTH.monter_cartes, true);
  assert.equal(P.NEEDS_AUTH.compiler_finales, true);
  assert.ok(!P.NEEDS_AUTH.montage_etat);
  assert.match(P.describe({ name: 'monter_cartes', args: { cartes: [2], karaoke: true } }), /Monter les cartes #2.*karaoké/);
  assert.match(await P.execTool({ name: 'monter_cartes', args: {} }), /extension Montage est désactivée/);
  actif = true;
  assert.match(await P.execTool({ name: 'monter_cartes', args: { cartes: [2] } }), /#2 : montée → `D:\/F\/c\.mp4` \(-14,1 LUFS/);
  assert.match(await P.execTool({ name: 'compiler_finales', args: {} }), /Compilation prête : `D:\/F\/Compilation\.mp4`/);
  assert.match(await P.execTool({ name: 'montage_etat', args: {} }), /Modèle du projet : Marketing/);
});

test('épisode de série : plans de l\'Assemblage, image déposée, vidéo manquante copiée, karaoké calé, son réglé une fois', async () => {
  let def = null, planN = 0;
  const appels = [];
  const reply = (body, st = 200) => Promise.resolve({ ok: st < 400, status: st, json: () => Promise.resolve(body) });
  const fetch = (url, init = {}) => {
    const route = url.replace('http://127.0.0.1:8177', '');
    appels.push({ route, init, body: init.body && typeof init.body === 'string' ? JSON.parse(init.body) : null });
    if (route === '/classement/fichier') return reply({ ok: true });
    if (route === '/montage/episode/plan') return planN++ === 0 ? reply({ error: '1 plan', introuvable: true, manquants: [1] }, 404)
      : reply({ largeur: 1920, hauteur: 1080, duree: 9, debuts: [0, 3, 6], longueurs: [3, 3, 3], mots: [{ mot: 'Bonjour', debut: 3.2, fin: 3.6 }] });
    if (route === '/montage/episode') return reply({ ok: true, id: 'e1' });
    if (route.startsWith('/montage/etat')) return reply({ statut: 'fini', resultat: { chemin: 'D:/P/Serie/Final/Ep01.mp4', nom: 'Ep01.mp4', duree: 9, son: { apres_lufs: -16 }, plans: [1, 2, 3], alertes: [] } });
    return reply({ error: 'not found' }, 404);
  };
  const cap = { assFromChunks: (w, h, c) => `[Script Info] ${w}x${h} ${c.length}`, srtFromChunks: () => 'SRT', temoin: () => ({ texte: 'M', largeur: 80 }), chunksFromWords: (m) => [m] };
  const ex = { motsBlob: () => Promise.resolve([{ text: 'Bonjour', start: 0.2, end: 0.6 }]) };
  const ctx = { fetch, setTimeout: (f) => setTimeout(f, 0), console, AgnesPlugins: { register: (id, d) => { def = d; } } };
  ctx.window = { AgnesPlugins: { isLoaded: (id) => id === 'captions' || id === 'extracteur', get: (id) => (id === 'captions' ? cap : ex) } };
  vm.runInNewContext(lire('plugin-montage.js'), ctx);
  const s = (id) => ({ id, prompt: 'Il dit « Bonjour »', takes: [] });
  const shots = [s('a'), s('b'), s('c')];
  const projet = { name: 'Ep01', aspect: '16:9', resolution: '1080p', montage: { opts: { fps: 25, fit: 'contain' } } };
  def.cfg = Object.assign({ pont: def.PONT, save() {} }, def.DEFAUTS);
  def.compil = Object.assign({}, def.COMPIL, { ep_karaoke: true, ep_lufs: -16 });
  def.etats = {}; def.view = { querySelector: () => null, classList: { contains: () => false } };
  def.core = { saveProject() {}, toast() {}, getProject: () => projet };
  def.A = {
    esc: String, computeSize: () => ({ w: 1920, h: 1080 }),
    getTakeBlobOrFetch: (t) => Promise.resolve({ type: t.kind === 'image' ? 'image/jpeg' : 'video/mp4' }),
    classementLocal: (sh) => ({ video: 'Serie/S/Ep01/Video', nom: 'Plan ' + sh.id }),
    gradeActive: () => ({ on: true, skip: ['c'] }), gradeFfmpeg: () => 'eq=contrast=1.10',
    montagePlan: () => [
      { index: 1, shot: shots[0], take: { kind: 'video', localPath: 'Serie/S/Ep01/Video/Plan a.mp4' }, kind: 'video', on: true, tin: 0.5, tout: 3, trans: 'fade', tdur: 0.6 },
      { index: 2, shot: shots[1], take: { kind: 'video', id: 'tb' }, kind: 'video', on: true, tin: 0, tout: null, trans: 'cut', tdur: 0.6 },
      { index: 3, shot: shots[2], take: { kind: 'image' }, kind: 'image', on: true, still: 2, tin: 0, tout: null, trans: 'cut', tdur: 0.6 },
      { index: 4, shot: s('d'), take: { kind: 'video' }, kind: 'video', on: false },
    ],
  };
  const res = await def.compilerEpisode();
  assert.equal(res.nom, 'Ep01.mp4');
  const depots = appels.filter((a) => a.route === '/classement/fichier').map((a) => decodeURIComponent(a.init.headers['X-Chemin']));
  assert.deepEqual(depots, ['Serie/S/Ep01/Images/Plan c - plan.jpg', 'Serie/S/Ep01/Video/Plan b.mp4'], 'image déposée, puis vidéo manquante copiée');
  const envoi = appels.find((a) => a.route === '/montage/episode').body;
  assert.equal(envoi.plans.length, 3, 'plan décoché exclu');
  assert.equal(envoi.plans[0].transition, 'fade');
  assert.equal(envoi.plans[0].debut, 0.5);
  assert.equal(envoi.plans[0].etalonnage, 'eq=contrast=1.10');
  assert.equal(envoi.plans[2].etalonnage, '', 'plan exclu de l\'étalonnage');
  assert.equal(envoi.plans[2].type, 'image');
  assert.equal(envoi.plans[1].replique, 'Bonjour');
  assert.equal(envoi.reglages.lufs, -16);
  assert.equal(envoi.reglages.cadrage, 'adapter');
  assert.equal(envoi.reglages.fps, 25);
  assert.equal(envoi.reglages.carton, false);
  assert.match(envoi.reglages.ass, /1920x1080/);
  assert.equal(projet.montageCarte.derniereCompilation.type, 'episode');
});

test('Claude « episode » et outil du Chef « rendre_episode » (sous autorisation)', async () => {
  let def = null; const vus = [];
  const M = { monterCartes() {}, compilerEpisode: (o) => { vus.push(o); return Promise.resolve({ chemin: 'D:/E.mp4', duree: 9, plans: [1, 2], son: { apres_lufs: -16 }, sous_titres: null, compte_rendu: 'D:/cr.txt', alertes: [] }); } };
  const ctx = { console, AgnesPlugins: { register: (id, d) => { def = d; }, isLoaded: (id) => id === 'montage', get: (id) => (id === 'montage' ? M : null) } };
  ctx.window = ctx;
  vm.runInNewContext(lire('plugin-claude.js'), ctx);
  await def.run('episode', { lufs: '-16', karaoke: true, carton: 'À suivre', nom: 'Ep01' });
  assert.deepEqual(JSON.parse(JSON.stringify(vus[0])), { ep_lufs: -16, ep_karaoke: true, ep_carton: true, ep_carton_texte: 'À suivre', nom: 'Ep01' });
  const plugins = {};
  const c2 = { console, AgnesPlugins: { register(id, o) { plugins[id] = o; }, isLoaded: (id) => id === 'montage', get: (id) => (id === 'montage' ? M : plugins[id]) } };
  c2.window = c2; vm.createContext(c2); vm.runInContext(lire('plugin-atelier.js'), c2);
  const P = plugins.atelier;
  assert.equal(P.NEEDS_AUTH.rendre_episode, true);
  assert.match(await P.execTool({ name: 'rendre_episode', args: { lufs: -16 } }), /Épisode prêt : `D:\/E\.mp4` \(9 s, 2 plans, -16 LUFS\)/);
});

test('interface de la compilation sans emojis ni pictogrammes', () => {
  const src = lire('plugin-montage.js');
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src));
});
