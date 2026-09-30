const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 29/09/2026 — Atelier IA plus clair (adresses cliquables, bouton Copier, fiches à valider, notes des cartes)
// et extension Classement (Projet / Saison / Épisode).
const AGNES = path.join(__dirname, '..', 'agnes');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function load(file, extra = {}) {
  const plugins = {};
  const shots = [{ id: 's1', prompt: 'a' }, { id: 's2', prompt: 'b' }, { id: 's3', prompt: 'c' }, { id: 's4', prompt: 'd' }];
  const calls = [];
  const context = {
    AgnesPlugins: { register(id, obj) { plugins[id] = obj; }, get: (id) => plugins[id] },
    AgnesApp: { esc, sortedShots: () => shots, uid: () => 'u' + Math.random(), renderShots() {}, selectedTake: () => null, keyTake: () => null, modeKind: () => 'video' },
    fetch: async (url, init) => {
      calls.push({ url, body: init && init.body ? JSON.parse(init.body) : null });
      return { ok: true, json: async () => extra.reponse || {} };
    },
    Blob: class { constructor(parts, o) { this.parts = parts; this.type = (o && o.type) || ''; } },
    ...extra.context,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(AGNES, 'plugins', file), 'utf8'), context);
  return { plugins, shots, calls, context };
}

const LIVRABLE = [
  '# Livrable marketing — 2026-09-28', '', '## VIDÉOS', '',
  '### Carte 01 — Matin — éducative · publication 2026-09-28 08:00 · prête',
  '- Réplique (voix, mot pour mot) : « Un. »',
  '- CARTON DE FIN (montage, 7.7–10 s, par-dessus Anthony qui sourit) : « Abonne-toi. » + « Suite à 12 h 30 »',
  '- DESCRIPTION (à coller sous la vidéo) : Première description.', '- HASHTAGS : #business #marketing', '',
  '### Carte 02 — Journée — problème-solution · publication 2026-09-28 12:30 · prête',
  '- Réplique (voix, mot pour mot) : « Deux. »', '- HASHTAGS : #business', '',
  '## LOT (à envoyer tel quel avec send_to_lot)', '', '```text',
  '01 — educatif · Un', 'IMAGE : image un', 'VIDÉO : vidéo un', 'RÉF : Anthony', '',
  '02 — probleme-solution · Deux', 'IMAGE : image deux', 'VIDÉO : vidéo deux', 'RÉF : Anthony', '```', '',
].join('\n');

function atelier(reponse) {
  const r = load('plugin-atelier.js', { reponse });
  const P = r.plugins.atelier;
  const st = { docs: [{ id: 'd1', name: 'Marketing — 2026-09-28', content: LIVRABLE, on: true, for: 'all' }], chat: [] };
  P.project = () => st;
  P.core = { saveProject() {}, toast() {}, getProject: () => ({ shots: r.shots }) };
  P.pont = () => 'http://127.0.0.1:8177';
  return { P, ...r };
}

test('les blocs de code ont un bouton Copier et les adresses de l’ordinateur sont cliquables', () => {
  const { P } = atelier();
  const html = P.md('Voici la fiche :\n`D:\\Rmaopn\\a classser\\fiche.yaml`\n\n```bash\ncd "D:\\X"\npython -m content_agent connaissances valider aida\n```');
  assert.match(html, /data-copy="1"[^>]*>📋 Copier<\/button><pre><code>cd &quot;D:\\X&quot;/);
  assert.match(html, /<code class="at-path">D:\\Rmaopn\\a classser\\fiche\.yaml<\/code><button[^>]*data-open="D:\\Rmaopn\\a classser\\fiche\.yaml"/);
  assert.doesNotMatch(P.md('`update_shots`'), /at-path/);   // un nom d'outil reste du code simple
});

test('📂 demande au pont d’ouvrir l’Explorateur sur l’adresse', async () => {
  const { P, calls } = atelier({ ok: true });
  P.openPath('D:\\Dossier\\fiche.yaml', null);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls[0].url, 'http://127.0.0.1:8177/ouvrir');
  assert.deepEqual(calls[0].body, { chemin: 'D:\\Dossier\\fiche.yaml' });
});

test('le Chef parle clairement : adresses, commandes, pas de noms d’outils', () => {
  const { P } = atelier();
  P.ordered = () => [];
  P.bibleText = () => ''; P.libraryText = () => ''; P.docsIndex = () => '';
  P.core.getProject = () => ({ name: 'P', shots: [] });
  const sys = P.managerSystem();
  assert.match(sys, /ADRESSE COMPLÈTE/);
  assert.match(sys, /bloc ```bash/);
  assert.match(sys, /Ne lui parle jamais en noms d'outils/);
  assert.match(sys, /garder/);
});

test('valider une fiche : outil sous autorisation, décision envoyée au pont', async () => {
  const { P, calls } = atelier({ fiche: 'la-methode-aida', statut: 'valide', fichier: 'D:\\c\\la-methode-aida.yaml' });
  const names = P.TOOLS.map((t) => t.function.name);
  for (const n of ['marketing_fiches', 'marketing_fiche', 'marketing_decider_fiche', 'marketing_notes_cartes']) assert.ok(names.includes(n), n);
  assert.equal(P.NEEDS_AUTH.marketing_decider_fiche, true);
  assert.ok(!P.NEEDS_AUTH.marketing_fiche && !P.NEEDS_AUTH.marketing_fiches);
  const out = await P.execTool({ name: 'marketing_decider_fiche', args: { fiche: 'la-methode-aida', decision: 'valider' } });
  assert.equal(calls[0].url, 'http://127.0.0.1:8177/marketing/fiche/decision');
  assert.deepEqual(calls[0].body, { fiche: 'la-methode-aida', decision: 'valider' });
  assert.match(out, /VALIDÉE par l'utilisatrice/);
});

test('garder part avec la journée réécrite', async () => {
  const { P, calls } = atelier({ date: '2026-09-28', methodes: ['aida'], pilier: 'x', pret: true, videos: [], dossier: 'D:\\o', livrable_nom: 'Marketing — 2026-09-28', livrable: LIVRABLE });
  P.addDoc = () => {};
  P.marketingModel = () => null;
  const out = await P.marketingDay({ date: '2026-09-28', garder: 'educatif' });
  assert.equal(calls[0].body.garder, 'educatif');
  assert.match(out, /Dossier des fichiers de la journée : `D:\\o`/);
  assert.match(P.describe({ name: 'marketing_generate_day', args: { date: '2026-09-28', garder: 'educatif' } }), /réécrire la journée du 2026-09-28 en gardant « educatif »/);
});

test('les notes (réplique, carton, description, hashtags) vont sur les cartes indiquées', () => {
  const { P, shots } = atelier();
  const out = P.applyCardNotes('Marketing — 2026-09-28', [3, 4]);
  assert.match(shots[2].notes, /^Carte 01 — Matin[\s\S]*CARTON DE FIN[\s\S]*DESCRIPTION[\s\S]*HASHTAGS : #business #marketing/);
  assert.match(shots[3].notes, /^Carte 02[\s\S]*Deux/);
  assert.doesNotMatch(shots[3].notes, /LOT/);
  assert.equal(shots[0].notes, undefined);
  assert.match(out, /#3, #4/);
});

test('journée renvoyée : les prompts ET les notes sont mis à jour, sans nouvelle carte', () => {
  const { P, shots } = atelier();
  P.applyPlans = (plans) => { plans.forEach((x) => { shots[x.plan - 1].prompt = x.video; }); return 'ok.'; };
  P.applyLotToCards('Marketing — 2026-09-28', [1, 2]);
  assert.equal(shots.length, 4);
  assert.equal(shots[1].prompt, 'vidéo deux');
  assert.match(shots[1].notes, /Carte 02/);
});

test('Classement : extension indépendante, chemin Projet / Saison / Épisode / Carte', () => {
  const actions = [];
  const { plugins, shots } = load('plugin-classement.js');
  const C = plugins.classement;
  const proj = { name: 'Anthony', shots, library: [{ id: 'l1', name: 'Anthony' }], publish: { serie: 'La méthode AIDA', ep: 2 } };
  const core = { ui: { panel: () => ({ body: { addEventListener() {} } }), addShotAction: (l) => actions.push(l) }, getProject: () => proj, store: {} };
  C.init(core);
  assert.deepEqual(actions, ['Classer']);
  shots[1].notes = 'Carte 02 — Journée — problème-solution · publication\n- Réplique : « Deux. »\n- PUBLICATION : serie = AIDA - 02 · titre = Tu laisses un blanc ? · appel = Suis la page.';
  shots[1].ingredients = ['l1'];
  const v = C.defaults(shots[1]);
  assert.equal(v.projet, 'La méthode AIDA');
  assert.equal(v.episode, 2);
  assert.equal(v.carte, 'Carte 02 - Tu laisses un blanc');
  assert.equal(C.defaults(Object.assign({}, shots[1], { notes: 'Carte 02 — Journée · 12:30' })).carte, 'Carte 02 - Journée');
  assert.deepEqual(Array.from(C.pathOf({ projet: 'A/B: C', saison: 1, episode: 12, carte: 'x?' })), ['A B C', 'Saison 01', 'Episode 12', 'x']);
  const sheet = C.sheet(shots[1], v);
  assert.match(sheet, /Références : Anthony/);
  assert.match(sheet, /## Notes[\s\S]*Réplique : « Deux. »/);
  assert.doesNotMatch(fs.readFileSync(path.join(AGNES, 'plugins', 'plugin-classement.js'), 'utf8'), /AgnesPlugins\.get\(/);
});

test('Classement local (30/09/2026) : Production/<Thématique>/…, dates AAAAMMJJ, sans sélecteur de dossier', () => {
  const { plugins, shots } = load('plugin-classement.js');
  const C = plugins.classement;
  const proj = { name: 'Anthony', shots, library: [], publish: {} };
  C.init({ ui: { panel: () => ({ body: { addEventListener() {} } }), addShotAction() {} }, getProject: () => proj, store: {} });
  assert.deepEqual(Array.from(C.localBase({ thematique: 'Serie', nom: 'Engrenage', episode: 3 })), ['Serie', 'Engrenage', 'Ep03']);
  assert.deepEqual(Array.from(C.localBase({ thematique: 'Marketing', nom: 'Anthony', date: '20260930', sujet: "L'accroche : AIDA" })), ['Marketing', 'Anthony', "20260930 - L'accroche AIDA"]);
  assert.deepEqual(Array.from(C.localBase({ thematique: 'Marketing', nom: 'Anthony', date: '30/09' })).slice(0, 2), ['Marketing', 'Anthony']);
  assert.match(C.localBase({ thematique: 'Marketing', nom: 'Anthony', date: 'mauvais' })[2], /^\d{8}$/);
  assert.deepEqual(Array.from(C.localBase({ thematique: 'Court_metrage', nom: 'Le bus' })), ['Court_metrage', 'Le bus']);
  assert.equal(C.localOf(shots[0]), null, 'aucune thématique réglée : rien de local');
  proj.classement = { thematique: 'Marketing', nom: 'Anthony', date: '20260930', sujet: 'accroche' };
  const loc = C.localOf(shots[0]);
  assert.equal(loc.video, 'Marketing/Anthony/20260930 - accroche/Video');
  assert.match(loc.nom, /^Carte 01 - /);
  assert.equal(C.defaults(shots[0]).mode, 'local');
  // copie de la carte (pendant une génération) : numéro retrouvé par l'identifiant, pas « 01 »
  assert.match(C.localOf(Object.assign({}, shots[1])).nom, /^Carte 02 - /);
  const src = fs.readFileSync(path.join(AGNES, 'plugins', 'plugin-classement.js'), 'utf8');
  assert.match(src, /"\/classement\/fichier", \{ method: "POST", headers: \{ "X-Chemin": encodeURIComponent\(chemin\) \}/);
  assert.doesNotMatch(src, /📁/);
});

test('Classement est proposé dans ⚙ et actif par défaut', () => {
  const src = fs.readFileSync(path.join(AGNES, 'Module-reglage', 'active-module.js'), 'utf8');
  assert.match(src, /key: "classement", id: "classement"[^\n]*plugins\/plugin-classement\.js", defaultOn: true/);
});

test('Calculateur de répliques : caractères, durée, nom exclu, réglage Anthony', () => {
  const store = {};
  const { plugins } = load('plugin-repliques.js');
  const R = plugins.repliques;
  R.core = { store: { getKV: async (k) => store[k], setKV: async (k, v) => { store[k] = v; } } };
  R.A = { esc };
  R.reglages = R.DEFAULTS.map((r) => Object.assign({}, r)); R.current = 'anthony';
  const m = R.mesurer("Ton accroche reste trop vague ? Alors le spectateur ne se sentira pas concerné. Décris clairement son problème.\nLÉA : Tu l'as vu partir ?", 'anthony');
  assert.equal(m.repliques.length, 2);
  assert.match(m.repliques[0].dit, /concerné, décris clairement/);          // points internes → virgules, minuscule
  assert.equal(m.repliques[0].caracteres, m.repliques[0].dit.length);
  assert.equal(m.repliques[1].nom, 'LÉA');
  assert.equal(m.repliques[1].dit, "Tu l'as vu partir ?".replace(' ?', '?'));
  assert.equal(m.repliques[1].statut, 'court');
  assert.match(R.resume('LÉA : Tu l’as vu partir ?', 'serie'), /Série — dialogue[\s\S]*LÉA — \d+ car\./);
  const long = 'Mot '.repeat(60).trim() + '.';
  assert.equal(R.mesurer(long, 'anthony').repliques[0].statut, 'long');
});

test('le Chef mesure une réplique avec le calculateur (ou demande de l’activer)', async () => {
  const { P, context } = atelier();
  assert.ok(P.TOOLS.some((t) => t.function.name === 'mesurer_replique'));
  assert.ok(!P.NEEDS_AUTH.mesurer_replique);
  assert.match(await P.execTool({ name: 'mesurer_replique', args: { texte: 'x' } }), /activez l'extension « Calculateur de répliques »/);
  context.AgnesPlugins.get = (id) => (id === 'repliques' ? { resume: (t, r) => `mesuré:${t}:${r}` } : null);
  assert.equal(await P.execTool({ name: 'mesurer_replique', args: { texte: 'Bonjour.', reglage: 'serie' } }), 'mesuré:Bonjour.:serie');
});

test('compteur des cartes : répliques entre guillemets, remplacement ciblé par le Chef', () => {
  const { plugins } = load('plugin-repliques.js');
  const R = plugins.repliques;
  assert.deepEqual(Array.from(R.extraire('He says: « Un. » then "Deux." and “Trois.”')).map((x) => x.texte), ['Un.', 'Deux.', 'Trois.']);
  assert.deepEqual(Array.from(R.extraire('Pas de réplique ici.')), []);
  const { P, shots } = atelier();
  shots[1].prompt = 'Anthony says: « Ancienne réplique. » Camera steady. Then: « Deuxième. »';
  const out = P.setReplique(2, 'Nouvelle réplique, plus courte.', 2);
  assert.equal(shots[1].prompt, 'Anthony says: « Ancienne réplique. » Camera steady. Then: « Nouvelle réplique, plus courte. »');
  assert.match(out, /Réplique 2 de la carte #2 remplacée/);
  assert.throws(() => P.setReplique(2, 'x', 3));
  assert.equal(P.NEEDS_AUTH.set_replique, true);
  assert.ok(P.TOOLS.some((t) => t.function.name === 'set_replique'));
});

test('le cœur signale le dessin des cartes aux extensions', () => {
  assert.match(fs.readFileSync(path.join(AGNES, 'js', 'app-ui.js'), 'utf8'), /AgnesCore\.emit\("shots:render", proj\)/);
});

test('plusieurs interlocuteurs : noms, maximum par réplique, minimum et durée sur l’échange', () => {
  const { plugins } = load('plugin-repliques.js');
  const R = plugins.repliques;
  R.reglages = R.DEFAULTS.map((r) => Object.assign({}, r));
  R.core = { getProject: () => ({ library: [{ name: 'Léa' }, { name: 'Marc Dupont' }] }) };
  const items = R.extraire("Léa, at the counter, says in French: « Tu l'as vu partir ? » Marc Dupont looks away and replies: « Non. » Then Paul asks: « Et maintenant ? »");
  assert.deepEqual(Array.from(items, (x) => x.nom), ['Léa', 'Marc Dupont', 'Paul']);
  const c = R.mesurerCarte(items, 'anthony');                     // 150 min : sur l'échange, pas sur chaque réplique
  assert.equal(c.lignes.filter((x) => x.statut === 'court').length, 0);
  assert.equal(c.statut, 'court');
  assert.match(c.alertes.join(' '), /Échange trop court/);
  assert.equal(c.caracteres, c.lignes.reduce((a, x) => a + x.caracteres, 0));
  assert.ok(c.duree_s >= c.lignes.reduce((a, x) => a + x.duree_s, 0) + 0.8 - 0.01);   // + 2 pauses entre interlocuteurs
  const long = R.mesurerCarte([{ texte: 'Mot '.repeat(40).trim() + '.', nom: 'Léa' }, { texte: 'Oui.', nom: 'Marc' }], 'serie');
  assert.equal(long.lignes[0].statut, 'long');
  assert.match(long.alertes[0], /^Léa : trop longue/);
  assert.match(R.summaryOf(R.mesurerCarte([{ texte: 'Bonjour à toi.', nom: 'Léa' }, { texte: 'Salut.', nom: 'Marc' }], 'serie')), /^💬 Léa \d+ · Marc \d+ → \d+ car\./);
});

test('série : la durée de la carte sert de limite, et les pastilles viennent des références cochées', () => {
  const { plugins } = load('plugin-repliques.js');
  const R = plugins.repliques;
  R.reglages = R.DEFAULTS.map((r) => Object.assign({}, r));
  R.core = { getProject: () => ({ library: [{ id: 'l1', name: 'Léa', thumb: 'data:x' }, { id: 'l2', name: 'Marc' }] }) };
  const items = R.extraire('Léa says: « Oui. » Marc replies: « Non. »', { ingredients: ['l1'] });
  assert.equal(items[0].ref.cochee, true);
  assert.equal(items[1].ref.cochee, false);
  const long = [{ texte: 'Un deux trois quatre. '.repeat(5).trim(), nom: 'Léa' }, { texte: 'Cinq six sept huit. '.repeat(5).trim(), nom: 'Marc' }];
  assert.equal(R.mesurerCarte(long, 'serie', 0).statut, 'ok');       // pas de durée imposée
  const c = R.mesurerCarte(long, 'serie', 10);                        // carte de 10 s
  assert.equal(c.statut, 'long');
  assert.match(c.alertes.join(' '), /L'échange dure .* il faut finir avant 10 s/);
});

test('garde-fou : réplique validée en amont ou gardée par vous, « phrase longue » = simple conseil', () => {
  const { plugins } = load('plugin-repliques.js');
  const R = plugins.repliques;
  R.reglages = R.DEFAULTS.map((r) => Object.assign({}, r));
  const line = "Tu gardes les respirations au montage? Après chaque phrase, coupe le silence avant de reprendre, ainsi, tes idées s'enchaînent et le spectateur suit sans attendre.";
  R.core = { getProject: () => ({ library: [], atelier: { docs: [{ content: '- Réplique (voix, mot pour mot) : « ' + line + ' »' }] } }) };
  // réglage Anthony (voix d'une traite) : plus de « phrase longue », la réplique de 163 caractères est bonne
  const c = R.mesurerCarte([{ texte: line, nom: 'Anthony' }], 'anthony', 10, {});
  assert.equal(c.statut, 'ok');
  assert.deepEqual(Array.from(c.lignes[0].conseils), []);
  // réplique trop longue mais validée par l'agent Marketing (document de l'Atelier) : pas d'alerte de caractères
  const long = line + ' Encore quelques mots pour dépasser.';
  const v = R.valides({ notes: '- Réplique (voix, mot pour mot) : « ' + long + ' »' });
  assert.equal(v[R.norm(line)], 'marketing');
  assert.equal(v[R.norm(long)], 'marketing');
  const c2 = R.mesurerCarte([{ texte: long, nom: 'Anthony' }], 'anthony', 0, v);
  assert.equal(c2.lignes[0].valide, 'marketing');
  assert.equal(c2.lignes[0].alertes.length, 0);
  // gardée par vous ; modifiée → de nouveau contrôlée
  assert.equal(R.valides({ repliquesValidees: [R.norm('Salut.')] })[R.norm('Salut.')], 'vous');
  assert.equal(R.mesurerCarte([{ texte: long + ' Et plus.' }], 'anthony', 0, v).statut, 'long');
  // série (pas d'enchaînement) : « phrase longue » reste un conseil, sans rouge
  const c3 = R.mesurerCarte([{ texte: 'Mot '.repeat(25).trim() + '.' }], 'serie', 0, {});
  assert.equal(c3.statut, 'ok');
  assert.match(c3.lignes[0].conseils[0], /^phrase longue/);
});

test('garde-fou du Chef : une réplique hors réglage ou avec deux-points lui revient avant votre autorisation', () => {
  const { P, context } = atelier();
  const R = load('plugin-repliques.js').plugins.repliques;
  R.reglages = R.DEFAULTS.map((r) => Object.assign({}, r));
  R.core = { getProject: () => ({}) };
  context.AgnesPlugins.get = (id) => (id === 'repliques' ? R : null);
  const ok = 'Ton logo apparaît encore en premier ? Montre le problème directement, par exemple un client qui ne rappelle jamais après ton devis, et ton audience comprend aussitôt le sujet.';
  assert.equal(P.repliqueHorsReglage({ replique: ok }), '');
  assert.match(P.repliqueHorsReglage({ replique: 'Trop court.' }), /^REFUSÉ avant de la montrer.*trop court/);
  assert.match(P.repliqueHorsReglage({ replique: ok.replace('par exemple', 'ex:') }), /deux-points/);
  context.AgnesPlugins.get = () => null;                     // sans le calculateur : aucun blocage
  assert.equal(P.repliqueHorsReglage({ replique: 'x' }), '');
});
