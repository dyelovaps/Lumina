const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 02/10/2026 — Commandes pour que Claude pilote Agnes de A à Z : Bible (lire, écrire, image), Bibliothèque, extensions,
// réglages et suppression de projet, cartes (références, notes, suppression, prompt final), Chef (historique, effacer),
// Studio (générer, valider, image du disque). Le run() de plugin-claude.js est appelé avec un faux Agnes.
const AGNES = path.join(__dirname, '..', 'agnes');
const read = (...p) => fs.readFileSync(path.join(AGNES, ...p), 'utf8');

function monde() {
  const plugins = {}, chargees = new Set(['bible', 'atelier', 'avatar']);
  const shots = [{ id: 's1', prompt: 'Anthony says: « Bonjour. »', mode: 't2v', ingredients: [] }, { id: 's2', prompt: 'b', mode: 't2v' }];
  const p1 = { id: 'p1', name: 'Marketing', shots, library: [{ id: 'L1', name: 'Anthony', kind: 'personnage', bibleId: 'b1' }, { id: 'L2', name: 'Bureau', kind: 'decor' }] };
  const p2 = { id: 'p2', name: 'Test chaîne', shots: [{ id: 'x' }], library: [] };
  const db = { projects: { p1, p2 }, currentProjectId: 'p1' };
  const fetches = [];
  const A = {
    db, getProject: () => db.projects[db.currentProjectId], sortedShots: () => db.projects[db.currentProjectId].shots,
    touch() {}, render() {}, renderShots() {}, saveDB() {}, clamp: (v, a, b) => Math.max(a, Math.min(b, +v)),
    deleteShot: (s, pr) => { pr.shots = pr.shots.filter((x) => x !== s); }, isTwoStep: () => false, modeKind: () => 'video',
    buildPrompt: (s) => s.prompt + ' + règles du style',
    extensionsEtat: () => [{ cle: 'bible', cochee: true, chargee: true, erreur: '' }],
  };
  const core = { openProject: (id) => { db.currentProjectId = id; }, saveProject() {}, store: { put: async () => {} } };
  const ctx = {
    AgnesPlugins: { register(id, o) { plugins[id] = o; }, get: (id) => plugins[id], isLoaded: (id) => chargees.has(id) },
    AgnesApp: A, Blob: class { constructor(p) { this.p = p; } },
    fetch: async (url) => { fetches.push(url); return { ok: !/introuvable/.test(url), blob: async () => ({ blob: url }) }; },
    document: { querySelector: () => null }, setTimeout: (f) => f(),
  };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('plugins', 'plugin-claude.js'), ctx);
  const C = plugins.claude; C.A = A; C.core = core; C.cfg = { actif: true };
  const entries = [{ id: 'b1', name: 'Anthony', kind: 'personnage', dna: 'man', refs: [{}] }, { id: 'b2', name: 'Café', kind: 'lieu', dna: 'a café', auto: false, refs: [] }];
  plugins.bible = { series: () => ({ name: 'Marketing', style: '', entries }), attacherImage: async (nom, b) => ({ name: nom, b }) };
  plugins.moteurs = { cfg: { pont: 'http://127.0.0.1:8177' } };
  const chat = [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'y' }];
  plugins.atelier = { project: () => ({ chat }), pending: { call: { name: 'set_replique' } }, describe: () => 'Remplacer la réplique', bibleUpsert: (e, s) => 'Bible mise à jour : ' + e.map((x) => x.name).join(', ') + (s ? ' + style' : ''), renderChat() {} };
  const fiche = { id: 'av1', nom: 'Anthony', essais: [{ cle: 'k1', format: '16:9' }], priseDeVue: { format: '16:9' } };
  plugins.avatar = { trouver: (r) => (r === 'Anthony' || r === 'av1' ? fiche : null), nomDe: (f) => f.nom, touch() {}, render() {}, imageValidee: async () => ({ img: 1 }),
    generer: async (f) => { f.essais.push({ cle: 'k2', format: f.priseDeVue.format, moteur: 'chatgpt', prompt: 'P' }); } };
  return { C, A, db, plugins, fetches, fiche, chat, p1, p2, entries };
}

test('Bible : lecture (style, fiches, auto), écriture directe, image rattachée depuis le Studio ou un fichier de Production', async () => {
  const m = monde();
  const b = m.C.run('bible', {});
  assert.equal(b.serie, 'Marketing'); assert.deepEqual(b.fiches.map((f) => [f.nom, f.type, f.auto]), [['Anthony', 'personnage', true], ['Café', 'lieu', false]]);
  assert.equal(m.C.run('bible', { type: 'lieu' }).fiches.length, 1);
  assert.match(m.C.run('bible_maj', { entries: [{ name: 'Léa', kind: 'personnage' }] }), /Bible mise à jour : Léa$/);
  assert.match(await m.C.run('bible_image', { nom: 'Anthony', fiche: 'av1' }), /rattachée à « Anthony »/);
  await m.C.run('bible_image', { nom: 'Anthony', chemin: 'D:\\Rmaopn\\a classser\\Dernier_projet\\TitTok_Histoires_vraie\\_BlackLow\\Production\\Marketing\\Anthony_Lieux\\Anthony_sheet.png' });
  assert.match(m.fetches.pop(), /\/classement\/lire\?chemin=Marketing%2FAnthony_Lieux%2FAnthony_sheet\.png$/);
  await m.C.run('bible_image', { nom: 'Anthony', chemin: 'agnes/test/x.png' });
  assert.match(m.fetches.pop(), /\/file\?path=agnes%2Ftest%2Fx\.png$/);
  assert.throws(() => m.C.run('bible_image', { fiche: 'av1' }), /nom=/);
  assert.deepEqual(m.C.run('bibliotheque', {}).map((l) => [l.nom, l.bible]), [['Anthony', true], ['Bureau', false]]);
});

test('Projet : réglages, suppression protégée (confirmer, jamais le dernier) ; cartes : références, notes, suppression, prompt final', () => {
  const m = monde();
  const r = m.C.run('projet_reglages', { style_base: 'cinematic', negatif: 'blur', format: '9:16', duree: 10 });
  assert.deepEqual(Array.from(r.modifie), ['style de base', 'prompt négatif', 'format', 'durée']); assert.equal(m.p1.styleGuide, 'cinematic');
  assert.match(m.C.run('references', { plan: 1, noms: 'Anthony, Bureau' }), /Anthony, Bureau/); assert.deepEqual(Array.from(m.p1.shots[0].ingredients), ['L1', 'L2']);
  assert.throws(() => m.C.run('references', { plan: 1, noms: 'Anthony,Inconnu' }), /Inconnu/);
  m.C.run('notes', { plan: 1, texte: 'CARTON : Abonne-toi.' }); m.C.run('notes', { plan: 1, texte: 'Suite à 12 h 30', ajouter: true });
  assert.equal(m.p1.shots[0].notes, 'CARTON : Abonne-toi.\nSuite à 12 h 30');
  assert.match(m.C.run('prompt_final', { plan: 1 }).prompt, /\+ règles du style$/);
  assert.throws(() => m.C.run('supprimer_cartes', { cartes: [2] }), /confirmer=oui/);
  assert.match(m.C.run('supprimer_cartes', { cartes: [2], confirmer: true }), /1 carte\(s\) supprimée/); assert.equal(m.p1.shots.length, 1);
  assert.throws(() => m.C.run('supprimer_projet', { projet: 'Test chaîne' }), /confirmer=oui/);
  assert.match(m.C.run('supprimer_projet', { projet: 'Test chaîne', confirmer: true }), /supprimé/); assert.ok(!m.db.projects.p2);
  assert.throws(() => m.C.run('supprimer_projet', { projet: 'Marketing', confirmer: true }), /dernier projet/);
});

test('Chef : historique (avec la demande en attente) et effacement ; Studio : générer (attendu), valider, image du disque validée', async () => {
  const m = monde();
  const h = m.C.run('chef_historique', { n: 1 });
  assert.equal(h.en_attente, 'Remplacer la réplique'); assert.equal(h.messages.length, 1);
  assert.match(m.C.run('chef_effacer', {}), /effacée/); assert.equal(m.plugins.atelier.pending, null);
  const g = await m.C.run('studio_generer', { nom: 'Anthony', format: '9:16' });
  assert.equal(g.essai, 'k2'); assert.equal(g.format, '9:16');
  assert.match(m.C.run('studio_valider', { nom: 'Anthony' }), /validée/); assert.equal(m.fiche.imageValidee, 'k2');
  assert.match(await m.C.run('studio_image', { nom: 'Anthony', chemin: 'D:/x/_BlackLow/Production/Marketing/Anthony_Lieux/Anthony_sheet.png' }), /importée et validée/);
  assert.match(m.fiche.imageValidee, /^avatar:img:av1:/); assert.equal(m.fiche.essais[m.fiche.essais.length - 1].moteur, 'fichier');
  assert.throws(() => m.C.run('studio_valider', { nom: 'Zoé' }), /introuvable/);
});

test('Chef : outil bible_lire déclaré (lecture), consignes contre les annonces après refus et le style commun non demandé', () => {
  const src = read('plugins', 'plugin-atelier.js');
  assert.match(src, /name: "bible_lire"/);
  assert.match(src, /n'annonce JAMAIS l'action comme faite/);
  assert.match(src, /ne change le style commun \(series_style\) que si l'utilisatrice le demande explicitement/);
});
