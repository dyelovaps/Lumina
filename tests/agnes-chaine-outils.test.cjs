const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 02/10/2026 — Essai de la chaîne : « Création d'avatar » devient « Studio » ; nouveaux outils du Chef (studio_fiches,
// studio_fiche, style_projet, choisir_style, classer_cartes) ; classement local sans fenêtre (Claude : agnes.py classer).
const AGNES = path.join(__dirname, '..', 'agnes');
const read = (...p) => fs.readFileSync(path.join(AGNES, ...p), 'utf8');

function charge(fichiers, extra = {}) {
  const plugins = {};
  const ctx = Object.assign({ AgnesPlugins: { register(id, o) { plugins[id] = o; }, get: (id) => plugins[id], isLoaded: (id) => !!plugins[id] },
    AgnesApp: { uid: () => 'u', esc: (s) => String(s) }, fetch: async () => ({}), Blob: class { constructor(p, o) { this.parts = p; this.type = (o && o.type) || ''; } } }, extra);
  ctx.window = ctx; vm.createContext(ctx);
  fichiers.forEach((f) => vm.runInContext(read('plugins', f), ctx));
  return { plugins, ctx };
}

test("Studio : nom de l'onglet, de l'extension et des documents envoyés au Chef", () => {
  assert.match(read('plugins', 'plugin-avatar.js'), /addTab\("avatar", "Studio"/);
  assert.match(read('Module-reglage', 'active-module.js'), /key: "avatar", id: "avatar", label: "Studio — /);
  assert.doesNotMatch(read('plugins', 'plugin-avatar.js') + read('plugins', 'plugin-atelier.js'), /Création d'avatar/);
});

test('Chef : nouveaux outils déclarés, lecture sans autorisation, choix du style et classement avec autorisation', () => {
  const { plugins } = charge(['plugin-atelier.js']);
  const P = plugins.atelier, noms = P.TOOLS.map((t) => t.function.name);
  ['studio_fiches', 'studio_fiche', 'style_projet', 'choisir_style', 'classer_cartes'].forEach((n) => assert.ok(noms.includes(n), n));
  assert.equal(P.NEEDS_AUTH.choisir_style, true); assert.equal(P.NEEDS_AUTH.classer_cartes, true);
  assert.ok(!P.NEEDS_AUTH.studio_fiches && !P.NEEDS_AUTH.studio_fiche && !P.NEEDS_AUTH.style_projet);
  assert.match(P.describe({ name: 'classer_cartes', args: { cartes: [1, 2], thematique: 'Serie', nom: 'Test', episode: 1 } }), /Classer les cartes #1, #2 dans Production\\Serie\\Test\\Ep1/);
  assert.match(P.describe({ name: 'choisir_style', args: { style: 'Série réaliste' } }), /Série réaliste/);
  assert.match(P.managerSystem.toString(), /classer_cartes copie les cartes/);
  // extensions désactivées : message clair, rien ne casse
  assert.match(P.outilsExtensions('studio_fiches', {}), /Studio indisponible/);
  assert.match(P.outilsExtensions('style_projet', {}), /Styles de prompt indisponibles/);
  assert.match(P.outilsExtensions('classer_cartes', {}), /Classement indisponible/);
});

test('Chef : studio_fiches / studio_fiche / style_projet / choisir_style appellent les extensions', () => {
  const { plugins } = charge(['plugin-atelier.js']);
  const P = plugins.atelier;
  plugins.avatar = { cmdListe: (t) => [{ id: 'av1', type: t || 'avatar', nom: 'Nicolas' }], cmdFiche: (r) => { if (r !== 'Nicolas') throw new Error('introuvable'); return { id: 'av1', adn: 'ADN' }; } };
  assert.match(P.outilsExtensions('studio_fiches', { type: 'tenue' }), /"type": "tenue"/);
  assert.match(P.outilsExtensions('studio_fiche', { fiche: 'Nicolas' }), /"adn": "ADN"/);
  assert.match(P.outilsExtensions('studio_fiche', { fiche: 'Zoé' }), /Fiche introuvable/);
  let choisi = null; const serie = { nom: 'Série réaliste', image: 'i', video: 'v', texteEcran: false, musique: false, repliques: 'serie' };
  plugins.styles = { list: [serie, { nom: 'Cartoon / satire' }], courant: () => serie, choisir: (s) => { if (!/s[ée]rie|cartoon/i.test(s)) throw new Error('style « ' + s + ' » introuvable'); choisi = s; } };
  plugins.repliques = { reglageProjet: () => 'serie' };
  assert.match(P.outilsExtensions('style_projet', {}), /"compteur_repliques": "serie"/);
  assert.match(P.outilsExtensions('choisir_style', { style: 'Série réaliste' }), /^Style choisi/); assert.equal(choisi, 'Série réaliste');
  assert.match(P.outilsExtensions('choisir_style', { style: 'Inconnu' }), /Style introuvable.*Cartoon \/ satire/);
});

test('Classement sans fenêtre : classerLocal envoie image, vidéo et fiche au pont dans Production/Thématique/…', async () => {
  const envois = [];
  const fetch = async (url, init) => { envois.push({ url, chemin: decodeURIComponent((init && init.headers && init.headers['X-Chemin']) || '') }); return { json: async () => ({ ok: true }) }; };
  const shot = { id: 's1', prompt: 'Malik says: « Bonjour. »', imagePrompt: 'Malik at the door', aspect: '9:16', duration: 10, mode: 't2v' };
  const proj = { name: 'Le Double des clés — Ep1', library: [], shots: [shot] };
  const { plugins, ctx } = charge(['plugin-classement.js'], { fetch });
  const C = plugins.classement;
  const img = { kind: 'image' }, vid = { kind: 'video' };
  C.core = { getProject: () => proj, saveProject() {} };
  C.A = { sortedShots: () => [shot], selectedTake: () => vid, keyTake: () => img, modeKind: () => 'video', renderShots() {},
    getTakeBlobOrFetch: async (t) => new ctx.Blob(['x'], { type: t.kind === 'image' ? 'image/png' : 'video/mp4' }) };
  C.cfg = { pont: 'http://127.0.0.1:8177' };
  const r = await C.classerLocal(shot, { thematique: 'Serie', nom: 'Le Double des clés', episode: 1 });
  assert.equal(r.dossier, 'Production/Serie/Le Double des clés/Ep01');
  assert.deepEqual(envois.map((e) => e.chemin).sort(), [
    'Serie/Le Double des clés/Ep01/Fiches/Carte 01 - Malik at the door.md',
    'Serie/Le Double des clés/Ep01/Images/Carte 01 - Malik at the door.png',
    'Serie/Le Double des clés/Ep01/Video/Carte 01 - Malik at the door.mp4']);
  assert.ok(envois.every((e) => /\/classement\/fichier$/.test(e.url)));
  assert.equal(shot.classement.dossier, r.dossier); assert.equal(proj.classement.thematique, 'Serie');
  // sans thématique : refus clair, rien n'est envoyé
  envois.length = 0; delete proj.classement;   // projet jamais classé
  await assert.rejects(C.classerLocal(shot, {}), /thématique manquante/); assert.equal(envois.length, 0);
});

test("Claude : commande classer déclarée dans plugin-claude.js et dans l'aide d'agnes.py", () => {
  assert.match(read('plugins', 'plugin-claude.js'), /case "classer": \{[\s\S]*classerLocal/);
  const pf = 'D:\\Rmaopn\\a classser\\Dernier_projet\\TitTok_Histoires_vraie\\_BlackLow\\Production\\App\\prod-fruits\\agnes.py';
  if (fs.existsSync(pf)) assert.match(fs.readFileSync(pf, 'utf8'), /python agnes\.py classer cartes=1,2 thematique=Serie/);
});

test('Studio : prompts plus propres (majuscule après un point, « and » dans les listes, pas de « fabric fabrics »)', () => {
  const { plugins, ctx } = charge(['plugin-avatar.js'], { setTimeout: (f) => f(), clearTimeout() {}, document: { getElementById: () => null, addEventListener() {}, querySelectorAll: () => [] } });
  const V = plugins.avatar;
  V.core = { getProject: () => ({ name: 'X', library: [] }), store: { setKV: async () => {} } }; V.A = ctx.AgnesApp; V.listes = V.listesParDefaut(); V.fiches = [];
  assert.equal(V.propre('plain grey background. eye level, 35 mm lens'), 'plain grey background. Eye level, 35 mm lens');
  assert.equal(V.et('navy blue, dusty pink'), 'navy blue and dusty pink');
  const t = V.nouvelleFiche('tenue', 'Tenue test');
  const L = V.liste('matieres');
  t.champs.matieres = [L.valeurs[0].id];
  assert.doesNotMatch(V.adn(t), /fabric fabrics/);
  // nom affiché : le prénom quand la fiche n'a pas de nom ; recherche par prénom
  const a = V.nouvelleFiche('avatar', ''); a.champs.prenom = 'Nicolas'; V.fiches.push(a);
  assert.equal(V.nomDe(a), 'Nicolas'); assert.equal(V.trouver('nicolas'), a);
});
