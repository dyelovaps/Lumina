/* Agnes → extension Montage (plugins/plugin-montage.js), étape 1 : montage par carte via le pont local.
 * Le vrai code tourne contre un faux pont : aucun ffmpeg, aucun fichier écrit.
 * Vérifie : carton lu dans les notes, chemin de la vidéo (prise Flow ou classement), réglages envoyés,
 * copie de la prise quand la vidéo manque dans Production, suivi jusqu'au résultat, refus d'une carte non classée. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'agnes', 'plugins', 'plugin-montage.js'), 'utf8');

function charger({ pont = {}, classement = null, extracteur = null, captions = null } = {}) {
  let def = null;
  const appels = [];
  const reply = (body, st = 200) => Promise.resolve({ ok: st < 400, status: st, json: () => Promise.resolve(body) });
  let etatN = 0, carteN = 0;
  const fetch = (url, init = {}) => {
    const route = url.replace('http://127.0.0.1:8177', '');
    appels.push({ route, init, body: init.body && typeof init.body === 'string' ? JSON.parse(init.body) : init.body });
    if (route === '/montage/carte') { const l = pont.carte || [{ ok: true, id: 'm1', position: 1 }]; const r = l[Math.min(carteN++, l.length - 1)]; return reply(r.body || r, r.st || 200); }
    if (route.startsWith('/montage/etat')) { const l = pont.etat || [{ statut: 'fini', resultat: { nom: 'x', chemin: 'C:/x', son: { apres_lufs: -14.1, apres_crete: -1 } } }]; return reply(l[Math.min(etatN++, l.length - 1)]); }
    if (route === '/classement/fichier') return reply({ ok: true });
    if (route === '/montage/polices') return reply({ polices: [] });
    if (route === '/montage/apercu') return reply(pont.apercu || { garder: [[0, 10]], vitesse: 1, duree_sortie: 10, t0: 8.2, mots: [{ mot: 'Relance-le', debut: 3.4, fin: 3.9 }] });
    return reply({ error: 'not found' }, 404);
  };
  const ctx = { fetch, setTimeout: (f) => setTimeout(f, 0), console, AgnesPlugins: { register: (id, d) => { def = d; } } };
  const ext = { extracteur, captions };
  ctx.window = { AgnesPlugins: { isLoaded: (id) => !!ext[id], get: (id) => ext[id] } };
  vm.runInNewContext(SRC, ctx);
  const saved = [];
  def.cfg = Object.assign({ pont: def.PONT, save() {} }, def.DEFAUTS);
  def.etats = {};
  def.view = { querySelector: () => null };
  def.core = { saveProject: () => saved.push(1), toast() {}, getProject: () => ({}) };
  def.A = {
    esc: (s) => String(s), sortedShots: () => [],
    selectedTake: (s) => (s.takes || [])[0] || null,
    getTakeBlobOrFetch: () => Promise.resolve({ blob: true }),
    classementLocal: classement,
  };
  return { def, appels, saved };
}

test('carton lu dans la ligne CARTON DE FIN des notes (texte + sous-texte)', () => {
  const { def } = charger();
  const n = '- Réplique : « bla »\n- CARTON DE FIN (montage, 8.0–10 s, par-dessus Anthony qui sourit) : « Abonne-toi pour la suite. » + « Nouveau sujet demain à 8 h »';
  const k = def.cartonDesNotes(n);
  assert.equal(k.texte, 'Abonne-toi pour la suite.');
  assert.equal(k.sous, 'Nouveau sujet demain à 8 h');
  assert.deepEqual({ ...def.cartonDesNotes('rien') }, { texte: '', sous: '' });
  // texte saisi dans Montage prioritaire sur les notes
  assert.equal(def.carton({ notes: n, montage: { carton: 'Like et partage', sous: '' } }).texte, 'Like et partage');
});

test('vidéo : chemin de la prise Flow, sinon dossier de classement de la carte', () => {
  const { def } = charger({ classement: () => ({ video: 'Marketing/Accroche/20260930 - A/Video', nom: 'Carte 02 - Anthony' }) });
  assert.equal(def.video({ takes: [{ kind: 'video', localPath: 'Marketing/X/Video/Carte 01 - Anthony.mp4' }] }).chemin, 'Marketing/X/Video/Carte 01 - Anthony.mp4');
  assert.equal(def.video({ takes: [{ kind: 'video' }] }).chemin, 'Marketing/Accroche/20260930 - A/Video/Carte 02 - Anthony.mp4');
});

test('monter : réglages + carton envoyés au pont, suivi jusqu\'au résultat, rangé sur la carte', async () => {
  const { def, appels, saved } = charger({ pont: { etat: [{ statut: 'en_cours', etape: 'rendu' }, { statut: 'fini', resultat: { nom: 'Carte 01 - Anthony - final.mp4', chemin: 'D:/P/Final/Carte 01 - Anthony - final.mp4', son: { apres_lufs: -14.2, apres_crete: -1.0 } } }] } });
  def.cfg.vitesse = 1.1;
  const shot = { id: 's1', notes: 'CARTON DE FIN : « Abonne-toi »', takes: [{ kind: 'video', localPath: 'Marketing/X/Video/Carte 01 - Anthony.mp4' }] };
  const res = await def.monter(shot);
  const envoi = appels.find((a) => a.route === '/montage/carte').body;
  assert.equal(envoi.video, 'Marketing/X/Video/Carte 01 - Anthony.mp4');
  assert.equal(envoi.reglages.vitesse, 1.1);
  assert.equal(envoi.reglages.carton_texte, 'Abonne-toi');
  assert.equal(envoi.reglages.resserrer, false, 'pauses gardées par défaut (carte 1 parfaite)');
  assert.equal(envoi.reglages.ranger, undefined, 'le rangement des onglets n\'est pas un réglage du moteur');
  assert.equal(res.nom, 'Carte 01 - Anthony - final.mp4');
  assert.equal(shot.montage.dernier.lufs, -14.2);
  assert.ok(saved.length >= 1);
  assert.equal(appels.filter((a) => a.route === '/montage/carte').length, 1, 'un seul envoi');
});

test('resserrer les pauses : choix par carte, envoyé au moteur', async () => {
  const { def, appels } = charger();
  await def.monter({ id: 's6', montage: { resserrer: true }, takes: [{ kind: 'video', localPath: 'M/V/c.mp4' }] });
  const r = appels.find((a) => a.route === '/montage/carte').body.reglages;
  assert.equal(r.resserrer, true);
  assert.equal(r.pauses_longues, 1);
  assert.equal(r.animation, 'fondu');
});

test('karaoké : Whisper (Extraire) écoute une fois, mots + réplique exacte envoyés, gardés sur la carte', async () => {
  let ecoutes = 0;
  const extracteur = { motsBlob: (blob, onEtat) => { ecoutes++; onEtat('écoute'); return Promise.resolve([{ text: 'Relance', start: 3.4, end: 3.9 }]); } };
  const recu = [];
  const captions = { assFromChunks: (W, H, ch) => { recu.push(ch); return '[Script Info]\nstyle AutoCaption'; }, srtFromChunks: () => '1\n', temoin: () => ({ texte: 'QUARANTE HUIT', largeur: 889 }),
    chunksFromWords: (w) => [{ start: w[0].start, end: w[0].end + 0.4, words: w }] };
  const { def, appels } = charger({ extracteur, captions });
  const shot = { id: 's7', prompt: 'He says: « Relance-le dans quarante-huit heures. » Vertical.', montage: { karaoke: true },
    takes: [{ id: 't1', kind: 'video', localPath: 'M/V/c.mp4' }] };
  await def.monter(shot);
  const r = appels.find((a) => a.route === '/montage/carte').body.reglages;
  assert.equal(r.karaoke, true);
  assert.equal(r.replique, 'Relance-le dans quarante-huit heures.');
  assert.equal(r.mots[0].text, 'Relance');
  assert.equal(shot.montage.mots.cle, 't1');
  // style : celui d'AutoCaption (fichier .ass fait par AutoCaption, mots déjà calés par le pont, mot témoin pour la taille)
  assert.equal(r.ass, '[Script Info]\nstyle AutoCaption');
  assert.equal(recu[0][0].words[0].text, 'Relance-le');
  assert.equal(r.ass_temoin.largeur, 889);
  assert.equal(r.st_taille, undefined, 'plus de réglage de style en double dans Montage');
  await def.monter(shot);
  assert.equal(ecoutes, 1, 'pas de nouvelle écoute pour la même prise');
  shot.takes[0].id = 't2';
  await def.monter(shot);
  assert.equal(ecoutes, 2, 'nouvelle prise : Whisper réécoute');
});

test('karaoké sans AutoCaption ou sans Extracteur : refus clair, rien envoyé', async () => {
  const carte = () => ({ id: 's8', montage: { karaoke: true }, takes: [{ id: 't', kind: 'video', localPath: 'M/V/c.mp4' }] });
  const a = charger({ captions: { assFromChunks() {} } });
  await assert.rejects(a.def.monter(carte()), /Extracteur/);
  assert.equal(a.appels.filter((x) => x.route === '/montage/carte').length, 0);
  const b = charger({ extracteur: { motsBlob() {} } });
  await assert.rejects(b.def.monter(carte()), /AutoCaption/);
  assert.equal(b.appels.length, 0);
});

test("lecteur : temps de la vidéo finale <-> temps de la vidéo d'origine, en sautant les coupes", () => {
  const { def } = charger();
  const g = [[0, 2.8], [3.3, 5.2], [5.6, 10]];
  assert.equal(def.versSortie(1, g), 1);
  assert.ok(Math.abs(def.versSortie(4, g) - 3.5) < 1e-9);       // 2,8 + (4 - 3,3)
  assert.ok(Math.abs(def.versSource(3.5, g) - 4) < 1e-9);
  assert.ok(Math.abs(def.versSortie(3.0, g) - 2.8) < 1e-9);     // dans une coupe : collé au morceau précédent
  assert.deepEqual([...def.lignes('Abonne-toi pour la suite.', 22)], ['Abonne-toi pour', 'la suite.']);
});

test('format de sortie : comme la vidéo (16:9 gardé) ou imposé, même règle que le moteur ; envoyé au pont', async () => {
  const { def, appels } = charger();
  assert.deepEqual([...def.dims(1280, 720)], [1920, 1080]);
  assert.deepEqual([...def.dims(720, 1280)], [1080, 1920]);
  assert.deepEqual([...def.dims(1440, 1080)], [1440, 1080]);
  def.cfg.format = '9:16';
  assert.deepEqual([...def.dims(1280, 720)], [1080, 1920]);
  await def.monter({ id: 's9', takes: [{ kind: 'video', localPath: 'M/V/c.mp4' }] });
  assert.equal(appels.find((a) => a.route === '/montage/carte').body.reglages.format, '9:16');
});

test('texte du carton : visible à chaque lettre (sans enregistrer à chaque frappe)', () => {
  const { def, saved } = charger();
  const shot = { id: 's10', notes: 'CARTON DE FIN : « Abonne-toi »' };
  def.cartes = () => [shot];
  def.texteDirect({ getAttribute: (k) => (k === 'data-mtk' ? 's10' : 'carton'), value: 'La suite demain' });
  assert.equal(def.carton(shot).texte, 'La suite demain');
  assert.equal(saved.length, 0);
});

test('modèles de montage : enregistrés pour tous les projets, chaque projet retient ses réglages et son modèle', () => {
  const { def } = charger();
  const kv = {}, projets = { a: { id: 'a' }, b: { id: 'b' } };
  let courant = projets.a;
  def.core.store = { setKV: (k, v) => { kv[k] = JSON.parse(JSON.stringify(v)); return Promise.resolve(); } };
  def.core.getProject = () => courant;
  def.mods = { cartons: [], montages: [], favoris: [] };
  def.render = () => {};
  def.nouveauModele('montage', 'Marketing', true);
  def.cfg.format = '16:9'; def.cfg.vitesse = 1.1;
  courant = projets.b;
  const serie = def.nouveauModele('montage', 'Série 16:9', true);
  assert.deepEqual(kv['montage:modeles'].montages.map((m) => m.nom), ['Marketing', 'Série 16:9']);
  // projet A : Marketing (format auto, x1)
  courant = projets.a; def.appliquerModele('montage', def.mods.montages[0].id);
  assert.equal(def.cfg.format, 'auto'); assert.equal(def.cfg.vitesse, 1);
  // projet B garde « Série 16:9 » : on le recharge
  courant = projets.b; def.chargerProjet();
  assert.equal(def.cfg.format, '16:9'); assert.equal(def.cfg.vitesse, 1.1);
  assert.equal(def.etatModele('montage').m.id, serie);
  assert.equal(def.etatModele('montage').modifie, false);
  def.cfg.vitesse = 1.2;
  assert.equal(def.etatModele('montage').modifie, true, 'réglage changé : « (modifié) »');
});

test('modèles de carton : seuls les réglages du carton sont appliqués ; favoris en tête de liste', () => {
  const { def } = charger();
  const projet = { id: 'a' };
  def.core.store = { setKV: () => Promise.resolve() };
  def.core.getProject = () => projet;
  def.mods = { cartons: [], montages: [], favoris: [] };
  def.render = () => {};
  def.cfg.couleur = '#FFE600'; def.cfg.animation = 'machine';
  const jaune = def.nouveauModele('carton', 'Jaune machine', true);
  def.cfg.couleur = '#FFFFFF'; def.cfg.animation = 'fondu';
  const blanc = def.nouveauModele('carton', 'Blanc', true);
  def.cfg.vitesse = 1.25; def.cfg.couleur = '#000000';
  def.appliquerModele('carton', jaune);
  assert.equal(def.cfg.couleur, '#FFE600'); assert.equal(def.cfg.animation, 'machine');
  assert.equal(def.cfg.vitesse, 1.25, 'la vitesse ne fait pas partie du carton');
  def.mods.favoris.push(blanc);
  assert.deepEqual(def.liste('carton').map((m) => m.nom), ['Blanc', 'Jaune machine']);
  assert.equal(projet.montageCarte.carton, jaune);
});

test('appel de fin au choix par carte : carton (défaut), pas de carton, voix-off rangée dans Production', async () => {
  const { def, appels } = charger();
  const blobs = { 'montage:appel:s20': { type: 'audio/mpeg' } };
  def.core.store = { get: (k) => Promise.resolve(blobs[k] || null), put: () => Promise.resolve() };
  const carte = (montage) => ({ id: 's20', notes: 'CARTON DE FIN : « Abonne-toi » + « Suite demain »', montage, takes: [{ kind: 'video', localPath: 'Marketing/A/20260930/Video/Carte 03 - Anthony.mp4' }] });
  assert.equal(def.appelDe(carte()), 'carton');
  assert.equal(def.reglages(carte()).carton, true);
  assert.equal(def.reglages(carte({ appel: 'aucun' })).carton, false);
  assert.equal(def.texteAppel(carte()), 'Abonne-toi. Suite demain');
  // voix-off pas encore faite : refus clair, rien d'envoyé (aucune génération automatique)
  await assert.rejects(def.monter(carte({ appel: 'voixoff' })), /faites d'abord la voix-off/);
  assert.equal(appels.length, 0);
  // texte du carton changé depuis la voix-off : à refaire
  await assert.rejects(def.monter(carte({ appel: 'voixoff', appelInfo: { texte: 'ancien', duree: 2 } })), /refaites-la/);
  // voix-off prête : rangée dans <journée>/Audio, chemin et durée envoyés au pont
  const ok = carte({ appel: 'voixoff', appelInfo: { texte: 'Abonne-toi. Suite demain', duree: 2.4 } });
  await def.monter(ok);
  const depot = appels.find((x) => x.route === '/classement/fichier');
  assert.equal(decodeURIComponent(depot.init.headers['X-Chemin']), 'Marketing/A/20260930/Audio/Carte 03 - Anthony - appel.mp3');
  const r = appels.find((x) => x.route === '/montage/carte').body.reglages;
  assert.equal(r.appel_audio, 'Marketing/A/20260930/Audio/Carte 03 - Anthony - appel.mp3');
  assert.equal(r.appel_duree, 2.4);
});

test('vidéo absente de Production : la prise de la carte y est copiée, puis un seul nouvel envoi', async () => {
  const { def, appels } = charger({ pont: { carte: [{ st: 404, body: { error: 'vidéo introuvable', introuvable: true } }, { ok: true, id: 'm2' }] },
    classement: () => ({ video: 'Marketing/A/20260930/Video', nom: 'Carte 03 - Anthony' }) });
  await def.monter({ id: 's3', takes: [{ kind: 'video' }] });
  const routes = appels.map((a) => a.route).filter((r) => !r.startsWith('/montage/etat'));
  assert.deepEqual(routes, ['/montage/carte', '/classement/fichier', '/montage/carte']);
  const copie = appels.find((a) => a.route === '/classement/fichier');
  assert.equal(decodeURIComponent(copie.init.headers['X-Chemin']), 'Marketing/A/20260930/Video/Carte 03 - Anthony.mp4');
});

test('carte non classée : refus clair, rien envoyé ; erreur du moteur rendue telle quelle', async () => {
  const { def, appels } = charger();
  await assert.rejects(def.monter({ id: 's4', takes: [] }), /Classer/);
  assert.equal(appels.length, 0);
  const b = charger({ pont: { etat: [{ statut: 'erreur', erreur: 'ffmpeg a échoué : x' }] } });
  await assert.rejects(b.def.monter({ id: 's5', takes: [{ kind: 'video', localPath: 'M/V/c.mp4' }] }), /ffmpeg a échoué/);
  assert.equal(b.def.etats.s5.statut, 'erreur');
});

test('interface sans emojis ni pictogrammes', () => {
  assert.doesNotMatch(SRC, /[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u2B06\u2B07\u2705\u2714\u26A0]/u);
});

test('AutoCaption : modèles de sous-titres personnels + préréglages d\'origine, favoris en tête', () => {
  const CAP = fs.readFileSync(path.join(__dirname, '..', 'agnes', 'plugins', 'plugin-captions.js'), 'utf8');
  let cap = null;
  vm.runInNewContext(CAP, { AgnesPlugins: { register: (id, d) => { cap = d; } } });
  const projet = { captions: { style: Object.assign({ preset: 'tiktok' }, cap.PRESETS.tiktok) } };
  const kv = {};
  cap.core = { getProject: () => projet, saveProject() {}, store: { setKV: (k, v) => { kv[k] = JSON.parse(JSON.stringify(v)); } }, toast() {} };
  cap.save = () => {}; cap.render = () => {}; cap.renderPresets = () => {};
  cap.mod = { modeles: [], favoris: [] };
  projet.captions.style.size = 9; projet.captions.style.margin = 30;
  const id = cap.nouveauModele('Anthony TikTok');
  assert.equal(kv['captions:modeles'].modeles[0].style.size, 9);
  assert.equal(projet.captions.style.preset, id);
  cap.appliquerModele('karaoke');
  assert.equal(projet.captions.style.size, cap.PRESETS.karaoke.size);
  cap.mod.favoris.push(id);
  assert.equal(cap.modeles()[0].nom, 'Anthony TikTok');
  assert.equal(cap.modeles().length, Object.keys(cap.PRESETS).length + 1);
  cap.appliquerModele(id);
  assert.equal(projet.captions.style.margin, 30);
});
