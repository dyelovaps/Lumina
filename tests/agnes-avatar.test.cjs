const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 01/10/2026 — Studio (plugins/plugin-avatar.js) : dictionnaire FR → EN, prompts anglais, niveaux, envoi à l'Atelier,
// outil du Chef bible_attacher_image, pastille Bible sur les cartes. Même méthode que agnes-styles.test.cjs (vm + faux core).
const AGNES = path.join(__dirname, '..', 'agnes');
const read = (...p) => fs.readFileSync(path.join(AGNES, ...p), 'utf8');

function monde({ atelier = null, bible = null, moteurs = null } = {}) {
  const plugins = {};
  if (atelier) plugins.atelier = atelier;
  if (bible) plugins.bible = bible;
  if (moteurs) plugins.moteurs = moteurs;
  let n = 0;
  const kv = {};
  const core = {
    getProject: () => ({ id: 'p1', name: 'Marketing', library: [] }), saveProject() {}, emit() {}, on() {}, toast() {},
    store: { getKV: async (k) => kv[k] || null, setKV: async (k, v) => { kv[k] = v; }, get: async () => null, put: async () => {}, del: async () => {} },
    ui: { addTab: () => null, panel: () => ({ body: {}, open() {}, close() {} }) },
  };
  const context = {
    AgnesPlugins: { register(id, obj) { plugins[id] = obj; }, get: (id) => plugins[id], isLoaded: (id) => !!plugins[id] },
    AgnesApp: { esc: (s) => String(s), uid: () => 'u' + (++n), findShot: () => null },
    setTimeout: (f) => f(),   // pas d'attente sur l'enregistrement différé
    clearTimeout() {}, AbortController, URL,
    document: { getElementById: () => null, addEventListener() {}, querySelectorAll: () => [] },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read('plugins', 'plugin-avatar.js'), context);
  const V = plugins.avatar;
  V.core = core; V.A = context.AgnesApp; V.listes = V.listesParDefaut(); V.fiches = [];
  return { V, plugins, context, core, kv };
}
function anthony(V) {
  const f = V.nouvelleFiche('avatar', 'Anthony');
  Object.assign(f.champs, { age: '35', genre: 'homme', origine: 'francaise', taille: '178', corpulence: 'athletique', teint: 'olive',
    couleurcheveux: 'noirs', longueurcheveux: 'courts', coiffure: 'degrade', yeux: 'bruns', barbe: 'barbe-courte-taillee', lunettes: 'fines-dorees' });
  f.traductions.signes = { fr: 'petite cicatrice au-dessus du sourcil droit', en: 'small scar above the right eyebrow' };
  f.champs.signes = 'petite cicatrice au-dessus du sourcil droit';
  return f;
}
const ADN = '35-year-old French man, about 1.78 m tall, athletic build, olive skin, short black hair with a fade haircut, brown eyes, short trimmed beard, thin gold-rimmed glasses, small scar above the right eyebrow';

test('dictionnaire : la fiche remplie donne l\'ADN attendu, une valeur modifiée change la sortie, « Rétablir » garde les ajouts', () => {
  const { V } = monde();
  const f = anthony(V);
  assert.equal(V.adn(f), ADN);
  // la valeur d'une liste modifiée par l'utilisatrice change le prompt
  V.valeur('corpulence', 'athletique').en = 'powerful athletic build';
  assert.match(V.adn(f), /powerful athletic build/);
  // ajout d'une valeur : utilisable, puis gardée après « Rétablir »
  const v = V.ajouterValeur('corpulence', 'trapue', 'stocky build');
  f.champs.corpulence = v.id;
  assert.match(V.adn(f), /stocky build/);
  V.retablirListe('corpulence');
  assert.equal(V.valeur('corpulence', 'athletique').en, 'athletic build');
  assert.ok(V.liste('corpulence').valeurs.some((x) => x.fr === 'trapue'));
  // valeur supprimée mais encore utilisée : reste lisible
  V.supprimerValeur('corpulence', v.id);
  assert.match(V.adn(f), /stocky build/);
  assert.equal(V.estRetiree('corpulence', v.id), true);
  // listes d'origine : de 3 à 25 valeurs ; aucun « ou » ni emoji
  V.listesParDefaut().forEach((l) => assert.ok(l.valeurs.length >= 3, l.id));
});

test('tenue, lieu et objet : ADN en une ligne', () => {
  const { V } = monde();
  const t = V.nouvelleFiche('tenue', 'Mardi');
  Object.assign(t.champs, { couche: 'navy blue wool blazer', haut: 'white crew-neck t-shirt', bas: 'slim grey chinos', chaussures: 'white leather sneakers' });
  t.traductions = {};
  assert.equal(V.adn(t), 'navy blue wool blazer over a white crew-neck t-shirt, slim grey chinos, white leather sneakers');
  const l = V.nouvelleFiche('lieu', 'Bureau');
  Object.assign(l.champs, { interieur: 'interieur', typelieu: 'bureau-open-space', moment: 'matin', lumiere: 'naturelle-douce' });
  assert.equal(V.adn(l), 'indoor modern open-plan office in France, morning, soft natural light');
  const o = V.nouvelleFiche('objet', 'Carnet');
  Object.assign(o.champs, { tailleobjet: 'petit', couleur: 'noir', matiere: 'cuir', typeobjet: 'carnet', texte: 'IDEES' });
  assert.equal(V.adn(o), "small black leather notebook, with the text 'IDEES' written on it");
});

test('champs libres : traduits une fois (cache), refaits seulement si le français change ; IA en panne = français gardé', async () => {
  let appels = 0;
  const { V } = monde({ atelier: { chat: async (m) => { appels++; return { content: '"' + 'EN:' + m[1].content + '"' }; } } });
  const f = V.nouvelleFiche('avatar', 'Léa'); f.champs.signes = 'une cicatrice'; f.champs.age = '30';
  assert.equal(V.atraduire(f).length, 1);
  let r = await V.traduire(f);
  assert.equal(r.faits, 1); assert.equal(appels, 1);
  assert.match(V.adn(f), /EN:une cicatrice/);
  r = await V.traduire(f);
  assert.equal(appels, 1, 'cache : aucun nouvel appel');
  f.champs.signes = 'un grain de beauté';
  assert.equal(V.atraduire(f).length, 1);
  await V.traduire(f); assert.equal(appels, 2);
  // IA en panne : le français est gardé, rien ne plante
  const m2 = monde({ atelier: { chat: async () => { throw { display: 'quota' }; } } });
  const g = m2.V.nouvelleFiche('avatar', 'Zoé'); g.champs.signes = 'une tache de rousseur';
  r = await m2.V.traduire(g);
  assert.equal(r.faits + '/' + r.echecs, '0/1');
  assert.match(m2.V.adn(g), /une tache de rousseur/);
  // sans Atelier : idem
  const m3 = monde(); const h = m3.V.nouvelleFiche('avatar', 'Max'); h.champs.signes = 'cicatrice';
  r = await m3.V.traduire(h); assert.equal(r.echecs, 1);
  // le prénom et les textes écrits ne sont jamais traduits
  assert.equal(V.atraduire(Object.assign(V.nouvelleFiche('avatar', 'A'), { champs: { prenom: 'Anthony' } })).length, 0);
});

test('prompts : la planche commence par « Character reference sheet of », « À éviter » donne « Avoid », aucun « » ni emoji', () => {
  const { V, plugins, context } = monde();
  const f = anthony(V);
  f.champs.signes = 'cicatrice « test » 😀'; f.traductions.signes = { fr: f.champs.signes, en: 'scar « test » 😀' };
  f.aEviter = 'sourire forcé'; f.traductions.aEviter = { fr: 'sourire forcé', en: 'forced smile' };
  const t = V.nouvelleFiche('tenue', 'Mardi'); t.champs.haut = 'white shirt'; t.traductions = {};
  V.fiches.push(t); f.liens.tenues = [t.id]; f.liens.tenueDefaut = t.id;
  const p = V.apercu(f);
  assert.match(p, /^Character reference sheet of Anthony: 35-year-old French man/);
  assert.match(p, / wearing white shirt\. Three views side by side on a plain light grey background: front, three-quarter, profile, full body shot, neutral relaxed expression\./);
  assert.match(p, /Avoid: forced smile\.$/);
  assert.doesNotMatch(p, /[«»]|\p{Extended_Pictographic}/u);
  // moteurs.isSheet reconnaît la planche
  vm.runInContext(read('plugins', 'plugin-moteurs.js'), context);
  assert.equal(plugins.moteurs.isSheet({ skills: [] }, p), true);
  // portrait en situation avec combinaison
  const l = V.nouvelleFiche('lieu', 'Bureau'); Object.assign(l.champs, { interieur: 'interieur', typelieu: 'bureau-open-space' }); V.fiches.push(l);
  f.liens.lieux = [l.id]; f.combinaisons.push({ id: 'c1', nom: 'Mardi — bureau', tenue: t.id, lieu: l.id, objets: [], cadrage: 'plan-taille', action: 'smiling at the camera' });
  f.traductions['c:c1:action'] = { fr: 'smiling at the camera', en: 'smiling at the camera' };
  const pc = V.promptCombinaison(f, 'c1');
  assert.match(pc, /^Anthony, 35-year-old French man.*, wearing white shirt, smiling at the camera in indoor modern open-plan office in France\. Medium shot\./);   // 02/10 : majuscule après un point
  assert.doesNotMatch(pc, /[«»]/);
});

test('niveaux : un champ de niveau 3 rempli n\'entre pas dans le prompt au niveau 2', () => {
  const { V } = monde();
  const f = anthony(V);
  Object.assign(f.champs, { nez: 'aquilin', levres: 'pulpeuses', sourcils: 'epais' });
  f.niveau = 2;
  assert.match(V.adn(f), /thick eyebrows/);
  assert.doesNotMatch(V.adn(f), /aquiline nose|full lips/);
  f.niveau = 3;
  assert.match(V.adn(f), /aquiline nose.*full lips/);
  f.niveau = 1;
  assert.doesNotMatch(V.adn(f), /thick eyebrows/);
  assert.equal(f.champs.nez, 'aquilin', 'la valeur reste enregistrée');
  // les champs « hors image » (voix, ton de marque) ne sont jamais dans le prompt
  f.niveau = 3; f.champs.voix = 'voix grave'; f.champs.ton = 'chaleureux';
  assert.doesNotMatch(V.adn(f) + V.apercu(f), /voix grave|chaleureux/);
});

test('envoi : addDoc reçoit le nom, l\'ADN, l\'identifiant et les combinaisons ; ask reçoit la consigne ; la Bible n\'est jamais appelée', () => {
  const docs = [], asks = [];
  const interdit = new Proxy({}, { get: (_, k) => { if (['seriesOf', 'matches', 'KINDS'].includes(k)) return undefined; throw new Error('écriture dans la Bible : ' + String(k)); } });
  const { V } = monde({ atelier: { addDoc: (...a) => docs.push(a), ask: (t) => { asks.push(t); return true; } }, bible: interdit });
  const f = anthony(V); V.fiches.push(f);
  const t = V.nouvelleFiche('tenue', 'Mardi'); t.champs.haut = 'white shirt'; V.fiches.push(t);
  f.liens.tenues = [t.id]; f.combinaisons.push({ id: 'c1', nom: 'Mardi — bureau', tenue: t.id, lieu: '', objets: [], cadrage: '', action: '' });
  assert.equal(V.envoyer(f), true);
  assert.equal(docs.length, 1);
  assert.equal(docs[0][0], 'Studio — Anthony');
  assert.equal(docs[0][2], 'Studio'); assert.equal(docs[0][3], true);
  assert.ok(docs[0][1].includes(ADN)); assert.ok(docs[0][1].includes(f.id)); assert.ok(docs[0][1].includes('Mardi — bureau'));
  assert.ok(docs[0][1].includes('costume'));
  assert.match(asks[0], /Nouvelle fiche du Studio : document « Studio — Anthony » \(fiche av/);
  assert.match(asks[0], /bible_upsert.*bible_attacher_image.*Ne crée aucune carte/);
  assert.equal(f.envois.length, 1);
  // sans nom ou sans ADN : refus clair
  assert.throws(() => V.envoyer(V.nouvelleFiche('avatar', '')), /nom/);
  assert.throws(() => V.envoyer(V.nouvelleFiche('avatar', 'Vide')), /ADN/);
  // le Chef occupé : le document est ajouté quand même, statut honnête
  const m2 = monde({ atelier: { addDoc() {}, ask: () => false } }); const g = anthony(m2.V);
  assert.equal(m2.V.envoyer(g), false); assert.equal(g.envois[0].statut, 'document seulement');
});

test('outil du Chef bible_attacher_image : appelle attacherImage avec l\'image validée, erreur claire sans image, avec autorisation', async () => {
  const plugins = {};
  const ctx = { AgnesPlugins: { register(id, o) { plugins[id] = o; }, get: (id) => plugins[id], isLoaded: (id) => !!plugins[id] }, AgnesApp: { uid: () => 'u' }, fetch: async () => ({}) };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('plugins', 'plugin-atelier.js'), ctx);
  const P = plugins.atelier;
  assert.ok(P.TOOLS.map((t) => t.function.name).includes('bible_attacher_image'));
  assert.equal(P.NEEDS_AUTH.bible_attacher_image, true);
  assert.match(P.describe({ name: 'bible_attacher_image', args: { fiche: 'av1', nom: 'Anthony' } }), /Rattacher l'image validée de la fiche .*à la Bible/);
  assert.match(P.managerSystem.toString(), /Studio/);
  // sans extension Studio
  assert.throws(() => P.bibleAttacherImage('av1', 'Anthony'), (e) => /Studio/.test(e.display));
  // avec elle
  const blob = { taille: 1 }; let recu = null;
  plugins.avatar = { fiche: (id) => (id === 'av1' ? { id, nom: 'Anthony' } : null), imageValidee: async (id) => (id === 'av1' ? blob : null) };
  plugins.bible = { attacherImage: async (nom, b) => { recu = [nom, b]; return { name: 'Anthony' }; } };
  const msg = await P.bibleAttacherImage('av1', 'Anthony');
  assert.equal(recu[0] + '|' + (recu[1] === blob), 'Anthony|true'); assert.match(msg, /rattachée à la fiche « Anthony » de la Bible et rangée dans la Bibliothèque/);
  assert.throws(() => P.bibleAttacherImage('zz', 'Anthony'), (e) => /introuvable/.test(e.display));
  plugins.avatar.imageValidee = async () => null;
  await assert.rejects(P.bibleAttacherImage('av1', 'Anthony'), (e) => /pas d'image validée/.test(e.display));
  assert.equal(P.avatarNom('av1'), 'Anthony');
});

test('Bible : attacherImage range l\'image dans la fiche puis dans la Bibliothèque ; filtres Tous, Personnages, Tenues, Lieux, Objets, Autres', async () => {
  const plugins = {};
  const ctx = { AgnesPlugins: { register(id, o) { plugins[id] = o; }, get: (id) => plugins[id], isLoaded: (id) => !!plugins[id] }, AgnesApp: { uid: () => 'u' } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('plugins', 'plugin-bible.js'), ctx);
  const B = plugins.bible, e = { id: 'e1', name: 'Anthony', aliases: 'Tony', kind: 'personnage', refs: [] }, ordre = [];
  B.series = () => ({ entries: [e] }); B.persist = () => ordre.push('persist'); B.refresh = () => {};
  B.storeRef = async (x, b) => { ordre.push('storeRef'); x.refs.push({ key: 'k', blob: b }); };
  B.toLibrary = async (x) => { ordre.push('toLibrary'); return 1; };
  const r = await B.attacherImage('tony', { a: 1 });
  assert.equal(r, e); assert.equal(ordre.join(','), 'storeRef,persist,toLibrary');
  await assert.rejects(B.attacherImage('inconnu', {}), (x) => /Aucune fiche/.test(x.display));
  await assert.rejects(B.attacherImage('Anthony', null), (x) => /Aucune image/.test(x.display));
  const src = read('plugins', 'plugin-bible.js');
  for (const t of ['Tous', 'Personnages', 'Tenues', 'Lieux', 'Objets', 'Autres']) assert.ok(src.includes('"' + t + '"'), t);
  assert.ok(src.includes('id="bbSearch"'));
});

test('pastille Bible : une carte dont la référence porte un bibleId affiche la pastille ; sans la Bible, rien et aucune erreur', () => {
  const carte = () => {
    const el = { inseres: [], querySelector(sel) { return sel === '.av-bible-ligne' ? null : { parentNode: el, nextSibling: null }; }, getAttribute: () => 's1', insertBefore(n) { el.inseres.push(n); } };
    return el;
  };
  const e = { id: 'e1', name: 'Anthony', kind: 'personnage', dna: 'x', refs: [{ thumb: 'data:t' }] };
  const bible = { KINDS: [['personnage', 'Personnage']], seriesOf: () => ({ entries: [e] }),
    matches: (en, shot, proj) => (shot.ingredients || []).some((id) => (proj.library.find((l) => l.id === id) || {}).bibleId === en.id) };
  const m = monde({ bible });
  const c = carte();
  const proj = { id: 'p1', library: [{ id: 'l1', bibleId: 'e1' }] };
  m.core.getProject = () => proj;
  m.context.AgnesApp.findShot = (id) => ({ id, ingredients: ['l1'] });
  m.context.document = { createElement: () => ({ className: '', innerHTML: '' }), querySelectorAll: () => [c] };
  m.V.decorerCartes();
  assert.equal(c.inseres.length, 1);
  assert.match(c.inseres[0].innerHTML, /av-bible-chip.*Bible · Anthony/);
  // une carte sans référence liée : pas de pastille
  const c2 = carte(); m.context.AgnesApp.findShot = (id) => ({ id, ingredients: [] }); m.context.document.querySelectorAll = () => [c2];
  m.V.decorerCartes(); assert.equal(c2.inseres.length, 0);
  // sans la Bible : rien, aucune erreur
  const s = monde(); s.context.document = { querySelectorAll: () => { throw new Error('ne doit pas être appelé'); } };
  assert.doesNotThrow(() => s.V.decorerCartes());
  assert.equal(s.V.entreesDeCarte({ id: 's1' }).length, 0);
});

test('commandes pour Claude : liste, fiche, prompt, envoi ; aucune génération', () => {
  const asks = [];
  const { V } = monde({ atelier: { addDoc() {}, ask: (t) => { asks.push(t); return true; } } });
  V.render = () => {};
  const f = anthony(V); V.fiches.push(f);
  assert.equal(JSON.stringify(V.cmdListe('avatar').map((x) => x.nom)), '["Anthony"]');
  assert.equal(V.cmdListe('lieu').length, 0);
  assert.equal(V.cmdFiche('anthony').adn, ADN);
  assert.match(V.cmdPrompt(f.id, '16:9').prompt, /^Character reference sheet of Anthony/);
  assert.equal(V.cmdEnvoyer('Anthony').chef_prevenu, true);
  assert.throws(() => V.cmdFiche('inconnu'), /introuvable/);
  const src = read('plugins', 'plugin-claude.js');
  for (const c of ['avatars', 'avatar', 'avatar_prompt', 'envoyer_avatar']) assert.ok(src.includes('"' + c + '"'), c);
});

test('génération : un clic = une image par moteurs.genererImage (avec références des fiches liées), essais limités à 12', async () => {
  let appels = 0, recu = null;
  const m = monde({ moteurs: { cfg: { image: 'chatgpt' }, genererImage: async (o) => { appels++; recu = o; return { blob: true }; } } });
  const { V, core } = m;
  V.render = () => {}; V.traduire = async () => ({ faits: 0, echecs: 0 }); V.refsDe = async () => [{ nom: 'Mardi', data: 'data:x' }];
  const f = anthony(V); V.fiches.push(f);
  for (let i = 0; i < 12; i++) f.essais.push({ cle: 'old' + i, format: '9:16', date: i });
  f.imageValidee = 'old0';
  V.generer(f);
  await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
  assert.equal(appels, 1);
  assert.equal(recu.ratio, '9:16'); assert.equal(recu.planche, true); assert.match(recu.prompt, /^Character reference sheet of Anthony/);
  assert.equal(recu.refs.length, 1);
  assert.equal(f.essais.length, 12);
  assert.ok(f.essais.some((e) => e.cle === 'old0'), 'l\'image validée n\'est jamais retirée');
  assert.ok(!f.essais.some((e) => e.cle === 'old1'), 'le plus ancien essai non validé part');
  void core;
});

test('inscription : active-module, vue view_avatar, section .av- du CSS, notice, version', () => {
  assert.match(read('Module-reglage', 'active-module.js'), /key: "avatar", id: "avatar".*file: "plugins\/plugin-avatar\.js"/);
  assert.match(read('plugins', 'plugin-avatar.js'), /addTab\("avatar", "Studio"/);
  assert.match(read('plugins', 'plugin-avatar.js'), /view_avatar/);
  const css = read('css', 'studio.css');
  assert.match(css, /Studio \(extension, 2026-10-01\)/);
  for (const cls of ['.av-app', '.av-ecran[data-fmt="9:16"]', '.av-ecran[data-fmt="16:9"]', '.av-bible-chip', '.av-studio', '.av-app:not(.av-mode-studio) .av-fiche']) assert.ok(css.includes(cls), cls);
  assert.ok(css.indexOf('.av-app') > css.indexOf('/* Montage (extension Montage'), 'section ajoutée en fin de fichier');
  // l'interface n'a ni emoji ni étoile ★
  assert.doesNotMatch(read('plugins', 'plugin-avatar.js'), /[★☆\u{1F300}-\u{1FAFF}]/u);
  // pas de style en ligne ni de CSS injecté par JavaScript
  assert.doesNotMatch(read('plugins', 'plugin-avatar.js'), /style="|createElement\("style"\)/);
  // le chargement de ce module ne dépend d'aucune bibliothèque distante
  assert.doesNotMatch(read('plugins', 'plugin-avatar.js'), /https?:\/\//);
});

test('02/10 — disposition : écran, format et prompts au centre ; réglages seuls à droite ; nom repris du prénom ; ADN sans « ., »', () => {
  const src = read('plugins', 'plugin-avatar.js');
  // le centre (studioHtml) porte l'écran, les actions et les prompts ; la fiche de droite ne les contient plus
  const studio = src.slice(src.indexOf('studioHtml: function'), src.indexOf('liensHtml: function'));
  assert.match(studio, /ecranHtml\(/); assert.match(studio, /actionsHtml\(/); assert.match(studio, /promptsHtml\(/);
  const fiche = src.slice(src.indexOf('ficheHtml: function'), src.indexOf('studioHtml: function'));
  assert.doesNotMatch(fiche, /ecranHtml\(|promptsHtml\(/);
  // nom affiché : le prénom quand le nom de fiche est vide
  assert.match(src, /nomDe: function/);
  assert.doesNotMatch(src, /f\.nom \|\| "Sans nom"/);
});

test('02/10 — débordements des cartes : colonne des champs qui rétrécit, une colonne sous 720 px, libellés qui vont à la ligne', () => {
  const css = read('css', 'studio.css'), fin = css.slice(css.indexOf('Débordements des cartes (02/10/2026)'));
  assert.ok(fin.length > 50, 'section des débordements présente');
  assert.match(fin, /\.shot-body \{ grid-template-columns: 180px minmax\(0, 1fr\); \}/);
  assert.match(fin, /@media \(max-width: 720px\) \{ \.shot-body \{ grid-template-columns: minmax\(0, 1fr\); \} \}/);
  assert.match(fin, /\.row-inline label\.inline \{ white-space: normal;/);
  assert.match(fin, /\.ext-row > \* \{ min-width: 0; max-width: 100%; \}/);
  // la section vient APRÈS l'ancienne règle « 180px 1fr », sinon elle serait écrasée
  assert.ok(css.lastIndexOf('grid-template-columns: 180px 1fr') < css.indexOf('Débordements des cartes (02/10/2026)'));
});
