const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 01/10/2026 — Styles de prompt (plugins/plugin-styles.js) : les règles ajoutées aux prompts dépendent du style du projet
// (Réaliste — Marketing inchangé, Série réaliste, Cartoon / satire) ; textes écrits et bruitages entre guillemets ne sont
// plus pris pour des répliques (js/dialogue-propre.js estReplique).
const AGNES = path.join(__dirname, '..', 'agnes');

function ctx() {
  const plugins = {};
  const context = {
    AgnesPlugins: { register(id, obj) { plugins[id] = obj; }, get: (id) => plugins[id], isLoaded: (id) => !!plugins[id] },
    AgnesApp: { esc: (s) => String(s), usesRefs: () => false },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(AGNES, 'js', 'dialogue-propre.js'), 'utf8'), context);
  return { plugins, context };
}
function run(context, file) { vm.runInContext(fs.readFileSync(path.join(AGNES, 'plugins', file), 'utf8'), context); }

test('répliques et textes écrits : la tasse, l\'écran, les bruitages ne sont pas des répliques', () => {
  const { context } = ctx();
  const D = context.AgnesDialogue;
  const kinds = (txt) => {
    const re = /«\s*([^»]*?)\s*»|“([^”]*)”|"([^"]*)"/g; let m; const out = [];
    while ((m = re.exec(txt))) out.push((D.estReplique(txt, m.index, m[0][0]) ? 'R:' : 'E:') + (m[1] || m[2] || m[3]));
    return out;
  };
  assert.deepEqual(kinds('Emmanuel slowly raises the mug marked “TOUT VA BIEN”. French dialogue: Emmanuel says, “Il faut transformer cette contrainte… en opportunité.”'),
    ['E:TOUT VA BIEN', 'R:Il faut transformer cette contrainte… en opportunité.']);
  assert.deepEqual(kinds('Marine begins energetically: “Ce budget est une—” and is immediately interrupted by a loud “DING !”. Jean-Michel says: “Merci Marine.”'),
    ['R:Ce budget est une—', 'E:DING !', 'R:Merci Marine.']);
  assert.deepEqual(kinds('The calculator display changes from “ERREUR” to “BON COURAGE”. A countdown display reading “12 SECONDES”.'),
    ['E:ERREUR', 'E:BON COURAGE', 'E:12 SECONDES']);
  // prompts marketing : « … » reste une réplique, même sans verbe
  assert.deepEqual(kinds('Anthony, face caméra. « Tu perds tes clients au téléphone. »'), ['R:Tu perds tes clients au téléphone.']);
  assert.deepEqual(kinds('Anthony says in French: « Abonne-toi. » A sign reads « OUVERT »'), ['R:Abonne-toi.', 'E:OUVERT']);
  // nettoyage voix : la réplique passe en guillemets droits, le texte écrit reste intact
  const n = D.nettoie('A mug marked “TOUT VA BIEN”. Emmanuel says: “Bonjour . Ça va ?”');
  assert.match(n, /mug marked “TOUT VA BIEN”/);
  assert.match(n, /says: "Bonjour… Ça va\?"/);
});

test('styles : Marketing inchangé, série sans minimum, cartoon garde les textes et la musique', () => {
  const { plugins, context } = ctx();
  let proj = { name: 'Marketing', library: [] };
  const core = {
    getProject: () => proj, saveProject() {}, emit() {}, on() {}, toast() {},
    store: { getKV: () => Promise.resolve(null), setKV: () => Promise.resolve() },
    addPromptFilter() {}, pluginSettings: (id, d) => Object.assign({ save() {} }, d), ui: { addTab: () => null },
  };
  context.document = { getElementById: () => null, addEventListener() {}, querySelectorAll: () => [] };
  run(context, 'plugin-styles.js');
  run(context, 'plugin-repliques.js');
  run(context, 'plugin-moteurs.js');
  const S = plugins.styles, R = plugins.repliques, M = plugins.moteurs;
  S.core = core; S.A = context.AgnesApp; S.list = S.DEFAULTS();
  R.core = core; R.reglages = R.DEFAULTS.map((r) => Object.assign({}, r));
  M.A = context.AgnesApp; M.cfg = { image: 'chatgpt' };
  const shot = { mode: 'i2v', skills: [] };

  // projet Marketing : style automatique « Réaliste — Marketing », règles et réglage d'avant
  assert.equal(S.courant().id, 'realiste-marketing');
  assert.equal(R.reglageProjet(), 'anthony');
  let v = M.quality('Anthony says in French: « Bonjour. »', shot, proj, 'video');
  assert.match(v, /subtle restrained acting/); assert.match(v, /No music/);
  let i = M.quality('Anthony at his desk', shot, proj, 'image');
  assert.match(i, /No text, no letters/); assert.match(i, /subtle restrained expression/);

  // série : style automatique « Série réaliste », compteur Série
  proj = { name: 'Les Heures Bleues', library: [] };
  assert.equal(S.courant().id, 'serie-realiste');
  assert.equal(R.reglageProjet(), 'serie');

  // cartoon choisi : textes écrits gardés, pas de « No music », jeu expressif ; le compteur suit le style
  S.choisir('cartoon');
  assert.equal(proj.styleId, 'cartoon'); assert.equal(R.reglageProjet(), 'serie');
  v = M.quality('Emmanuel holds a mug marked “TOUT VA BIEN”. Emmanuel says: “Tout va bien.” A short circus jingle.', shot, proj, 'video');
  assert.doesNotMatch(v, /No music/); assert.doesNotMatch(v, /subtle/);
  assert.match(v, /Expressive cartoon acting/); assert.match(v, /mug marked “TOUT VA BIEN”/);
  i = M.quality("A mug that reads 'TOUT VA BIEN'", shot, proj, 'image');
  assert.doesNotMatch(i, /No text, no letters/); assert.match(i, /Spell every written word exactly/);

  // style modifié par l'utilisatrice : sa règle remplace l'ancienne ; style vidé = rien d'ajouté
  S.get('cartoon').video = 'Pixar-like comic acting';
  assert.match(M.quality('Coco jumps.', shot, proj, 'video'), /Pixar-like comic acting/);
  S.get('cartoon').video = '';
  assert.doesNotMatch(M.quality('Coco jumps.', shot, proj, 'video'), /acting/);

  // sans l'extension Styles : règles d'origine partout
  context.AgnesPlugins.isLoaded = (id) => id !== 'styles';
  v = M.quality('Coco jumps.', shot, proj, 'video');
  assert.match(v, /subtle restrained acting/); assert.match(v, /No music/);
});

test('Atelier IA : consignes des agents et du Chef selon le style du projet', () => {
  const { plugins, context } = ctx();
  run(context, 'plugin-atelier.js');
  const P = plugins.atelier;
  let style = null;
  context.AgnesPlugins.isLoaded = (id) => id === 'styles' && !!style;
  plugins.styles = { courant: () => style };
  P.core = { getProject: () => ({ name: 'X' }) };
  // sans l'extension Styles : consignes d'origine mot pour mot
  assert.equal(P.common(), P.COMMON);
  // réaliste : interdits gardés
  style = { nom: 'Série réaliste', video: 'subtle restrained acting', texteEcran: false, musique: false, repliques: 'serie' };
  assert.match(P.common(), /Aucun texte écrit dans l'image/); assert.match(P.common(), /Jeu humain et subtil/);
  // cartoon : textes écrits entre apostrophes, musique permise, plus de jeu subtil imposé
  style = { nom: 'Cartoon / satire', video: 'Expressive cartoon acting', texteEcran: true, musique: true, repliques: 'serie' };
  const c = P.common();
  assert.doesNotMatch(c, /Pas de texte, sous-titres ni musique/); assert.doesNotMatch(c, /Jeu humain et subtil/);
  assert.match(c, /reads 'TOUT VA BIEN'/); assert.match(c, /Musique, jingles et bruitages permis/); assert.match(c, /STYLE DU PROJET : « Cartoon \/ satire »/);
});

test("02/10 — styles d'origine protégés : Supprimer ne vise plus « Série réaliste » ; rétablir le remet ; un style ajouté se supprime", () => {
  const { plugins, context } = ctx();
  context.document = { getElementById: () => null, addEventListener() {}, querySelectorAll: () => [] };
  run(context, 'plugin-styles.js');
  const S = plugins.styles; S.list = S.DEFAULTS(); S.save = () => {};
  assert.throws(() => S.supprimer('serie-realiste'), /style d'origine/);
  S.list.push({ id: 'st-x', nom: 'Nouveau style' });
  assert.equal(S.supprimer('Nouveau style').id, 'st-x');
  assert.ok(!S.get('st-x'));
  // la suppression du 02/10 (Série réaliste disparue) se répare : retablir() remet les styles d'origine, garde les ajouts
  S.list = S.list.filter((s) => s.id !== 'serie-realiste'); S.list.push({ id: 'st-y', nom: 'Mon style' });
  S.retablir();
  assert.ok(S.get('serie-realiste')); assert.ok(S.get('st-y'));
});
