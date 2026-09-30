/* Agnes → Google Flow (moteur vidéo « flow » de plugins/plugin-moteurs.js).
 * Le vrai code d'envoi tourne contre un faux service FlowKit : aucune génération réelle, aucun crédit.
 * Vérifie : la bonne route par mode, UN seul envoi par vidéo (jamais de renvoi), les garde-fous « Flow bloqué ». */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'agnes', 'plugins', 'plugin-moteurs.js'), 'utf8');
const PROJET = 'e067066d-bb30-4c33-ab39-3507c02eefc9';

function flow({ cfg = {}, status = { connected: true, flow_project_id: PROJET }, submit, polls, submitFails = false, pace = { cooldownLeftMs: 0, strikes: 0, preset: 'normal' },
  projets = { list: [{ id: PROJET, nom: 'Marketing', url: '', compte: 'pro@exemple.fr', tier: 'PAYGATE_TIER_TWO' }], actif: PROJET },
  check = { ok: true, blocking: false, tabs: 1, email: 'pro@exemple.fr', accountChecked: true, warning: '' },
  role = 'tout', pont = null, classement, prepare = null } = {}) {
  const pontCalls = [], clip = [];
  const calls = [], messages = [];
  let recupN = 0;
  let media = 0, pollN = 0;
  const reply = (body, ok = true, st = 200) => Promise.resolve({ ok, status: st, json: () => Promise.resolve(body), blob: () => Promise.resolve({ video: true }) });
  const fetch = (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    // Faux pont local (prod-fruits) : liste des projets et bilan du navigateur Flow
    if (url.startsWith('http://127.0.0.1:8177/')) {
      const r = url.slice('http://127.0.0.1:8177'.length);
      pontCalls.push({ route: r, body });
      if (!pont) return Promise.reject(new TypeError('Failed to fetch'));
      if (r === '/flow/projets') return reply(init.method === 'POST' ? { ok: true } : pont.projets || { list: [], actif: '', maj: 0 });
      if (r === '/flow/etat') return reply(pont.etat || { etat: null, age_s: null });
      if (r === '/flow/recuperer') { const l = pont.recuperer || [{ trouve: false }]; return reply(l[Math.min(recupN++, l.length - 1)]); }
      if (r.startsWith('/classement/lire')) return reply({});
      return reply({ error: 'not found' }, false, 404);
    }
    const route = url.replace('http://127.0.0.1:8100/api', '');
    calls.push({ route, body });
    if (route === '/flow/status') return reply(status);
    if (route === '/flow/upload-image') return reply({ media_id: 'm' + (++media) });
    if (/^\/flow\/generate/.test(route)) {
      if (submitFails) return Promise.reject(new TypeError('Failed to fetch'));
      return reply(submit || { operations: [{ operation: { name: 'op1' }, status: 'MEDIA_GENERATION_STATUS_PENDING' }] });
    }
    if (route === '/flow/check-status' || route === '/flow/check-omni-status') {
      const list = polls || [
        { operations: [{ operation: { name: 'op1' }, status: 'MEDIA_GENERATION_STATUS_PENDING' }] },
        { operations: [{ operation: { name: 'op1', metadata: { video: { fifeUrl: 'https://flow-content.google/video/x' } } }, status: 'MEDIA_GENERATION_STATUS_SUCCESSFUL' }] },
      ];
      return reply(list[Math.min(pollN++, list.length - 1)]);
    }
    if (url.startsWith('https://flow-content.google/')) return reply({});
    throw new Error('route inattendue ' + url);
  };
  let plugin = null;
  const toasts = [];
  const context = {
    fetch, setTimeout, clearTimeout, navigator: { clipboard: { writeText: (t) => { clip.push(t); return Promise.resolve(); } } },
    chrome: {
      runtime: { id: 'lumina', sendMessage(msg, cb) { messages.push(msg); if (msg.type === 'PACE_STATUS') cb(pace); if (msg.type === 'FLOW_CHECK') cb(check); if (msg.type === 'FLOW_PREPARE') cb(prepare); } },
      storage: { local: { get(key, cb) { cb(key === 'luminaRole' ? { luminaRole: role } : { luminaFlowProjects: projets }); }, set() {} } },
    },
    AgnesPlugins: { register(id, obj) { plugin = obj; } },
    window: {}, document: { getElementById: () => null }, console,
    Date, JSON, Promise, Object, Array, String, Number, Math,
  };
  vm.runInNewContext(SRC, context);
  plugin.core = { toast: (m, k) => toasts.push(k + ':' + m) };
  plugin.cfg = Object.assign({ video: 'flow', flowkit: 'http://127.0.0.1:8100', flowProjet: '', flowModel: 'omni_flash', flowRes: '720p', flowMode: 'auto', save() {} }, cfg);
  plugin.A = {
    ready: false, emitJob() {}, sleep: () => Promise.resolve(), esc: (s) => s,
    buildPrompt: (shot) => shot.prompt,
    nearestRatio: (r, list) => (list.includes(r) ? r : list[0]),
    sortedShots: () => [{}, {}],
    classementLocal: classement === undefined ? undefined : () => classement,
  };
  plugin.startImage = (ref) => Promise.resolve(ref ? 'data:image/jpeg;base64,QUJD' + ref : null);
  plugin.libData = (proj, id) => Promise.resolve({ nom: 'Ref ' + id, data: 'data:image/png;base64,UkVG' + id });
  plugin.storeTake = (blob, kind, source) => Promise.resolve({ kind, source });
  const run = (shot) => {
    const job = {};
    return plugin.flowVideoNow(job, Object.assign({ id: 's1', prompt: 'A woman smiles', duration: 8, aspect: '9:16' }, shot), { aspect: '9:16', library: [] })
      .then((takes) => ({ takes, job }), (err) => ({ err, job }));
  };
  const sent = () => calls.filter((c) => /^\/flow\/generate/.test(c.route));
  return { plugin, calls, sent, run, toasts, messages, pontCalls, clip };
}

test('Flow : durées et projets reconnus (Omni 4/6/8/10 s, Veo 8 s ; lien ou identifiant)', () => {
  const { plugin } = flow();
  assert.deepEqual([3, 6, 7, 8, 10, 12].map((d) => plugin.flowDuration(d)), [4, 6, 6, 8, 10, 10]);
  assert.equal(plugin.flowDuration(4, 'veo'), 8);
  assert.equal(plugin.flowProjectId('https://flow.google.com/fx/tools/flow/project/' + PROJET.toUpperCase()), PROJET);
  assert.equal(plugin.flowProjectId(PROJET), PROJET);
  assert.equal(plugin.flowProjectId(''), '');
  assert.equal(plugin.flowProjectId('pas un projet'), null);
});

test('Flow : image de départ → une image importée, UN envoi /generate-video, prise rangée « flow »', async () => {
  const f = flow();
  const { takes, err } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.equal(err, undefined);
  assert.equal(takes.length, 1);
  assert.equal(takes[0].kind, 'video');
  assert.equal(takes[0].source, 'flow');
  assert.equal(f.calls.filter((c) => c.route === '/flow/upload-image').length, 1);
  assert.equal(f.sent().length, 1);
  const b = f.sent()[0].body;
  assert.equal(f.sent()[0].route, '/flow/generate-video');
  assert.equal(b.model_family, 'omni_flash');
  assert.equal(b.start_image_media_id, 'm1');
  assert.equal(b.end_image_media_id, undefined);
  assert.equal(b.aspect_ratio, 'VIDEO_ASPECT_RATIO_PORTRAIT');
  assert.equal(b.duration_s, 8);
  assert.equal(b.project_id, PROJET);
  assert.equal(b.user_paygate_tier, 'PAYGATE_TIER_TWO');
  assert.match(b.prompt, /subtle restrained acting/);
  assert.match(b.prompt, /No music/);
});

test('Flow : scène verrouillée = même image au début et à la fin, importée une seule fois', async () => {
  const f = flow();
  await f.run({ mode: 'i2v', i2v: 'anchor', sourceRef: 'a' });
  assert.equal(f.calls.filter((c) => c.route === '/flow/upload-image').length, 1);
  const b = f.sent()[0].body;
  assert.equal(b.start_image_media_id, 'm1');
  assert.equal(b.end_image_media_id, 'm1');
});

test('Flow : début + fin → deux images, fin = deuxième ; Veo demandé mais impossible → Omni Flash avec avertissement', async () => {
  const f = flow({ cfg: { flowModel: 'veo' } });
  const { job } = await f.run({ mode: 'frames', startRef: 'a', endRef: 'b' });
  const b = f.sent()[0].body;
  assert.equal(b.end_image_media_id, 'm2');
  assert.equal(b.model_family, 'omni_flash');
  assert.match(job.warning, /Veo 3\.1/);
});

test('Flow : Veo sur image de départ seule → Veo, 8 s', async () => {
  const f = flow({ cfg: { flowModel: 'veo' } });
  await f.run({ mode: 'i2v', sourceRef: 'a', duration: 4 });
  const b = f.sent()[0].body;
  assert.equal(b.model_family, 'veo');
  assert.equal(b.duration_s, 8);
});

test('Flow : ingrédients → /generate-video-refs, 7 références au plus', async () => {
  const f = flow();
  const { job } = await f.run({ mode: 'ingr_v', ingredients: ['1', '2', '3', '4', '5', '6', '7', '8'] });
  assert.equal(f.sent()[0].route, '/flow/generate-video-refs');
  assert.equal(f.sent()[0].body.reference_media_ids.length, 7);
  assert.match(job.warning, /7 références au plus/);
});

test('Flow : texte seul → /generate-video-omni-text, suivi par workflow', async () => {
  const wf = [{ name: 'w1', primary_media_id: 'p1', project_id: PROJET }];
  const f = flow({
    submit: { workflows: wf },
    polls: [{ workflows: [{ ...wf[0], done: false }] }, { workflows: [{ ...wf[0], done: true, media: { url: 'https://flow-content.google/video/y' } }] }],
  });
  const { takes } = await f.run({ mode: 't2v' });
  assert.equal(f.sent()[0].route, '/flow/generate-video-omni-text');
  assert.ok(f.calls.some((c) => c.route === '/flow/check-omni-status'));
  assert.equal(takes.length, 1);
});

test('Flow bloqué : aucun appel à FlowKit', async () => {
  const f = flow({ cfg: { flowBloque: 'essai' } });
  const { err } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.match(err.display, /bloqué/);
  assert.equal(f.calls.length, 0);
});

test('Flow : Lumina non connecté à FlowKit → rien n’est importé ni envoyé', async () => {
  const f = flow({ status: { connected: false, flow_project_id: PROJET } });
  const { err } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.match(err.display, /pas connecté/);
  assert.equal(f.calls.length, 1);
});

test('Liste partagée : aucun projet choisi → rien n’est appelé', async () => {
  const f = flow({ projets: { list: [], actif: '' } });
  const { err } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.match(err.display, /Aucun projet Flow choisi/);
  assert.equal(f.calls.length, 0);
});

test('Liste partagée : abonnement du compte non précisé → rien n’est envoyé', async () => {
  const f = flow({ projets: { list: [{ id: PROJET, nom: 'Projet par défaut de FlowKit', compte: '', tier: '' }], actif: PROJET } });
  const { err } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.match(err.display, /Précisez l'abonnement/);
  assert.equal(f.calls.length, 0);
});

test('Liste partagée : compte gratuit → envoi au niveau gratuit, sur le projet de la liste', async () => {
  const other = '11111111-2222-3333-4444-555555555555';
  const f = flow({ projets: { list: [{ id: PROJET, nom: 'A', compte: 'a@x.fr', tier: 'PAYGATE_TIER_TWO' }, { id: other, nom: 'B', compte: 'b@x.fr', tier: 'PAYGATE_TIER_ONE' }], actif: other } });
  await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.equal(f.sent()[0].body.project_id, other);
  assert.equal(f.sent()[0].body.user_paygate_tier, 'PAYGATE_TIER_ONE');
  assert.equal(f.messages.find((m) => m.type === 'FLOW_CHECK').compte, 'b@x.fr');
});

test('Vérification : Flow ouvert deux fois (ou mauvais compte) → avertissement, rien n’est importé ni envoyé', async () => {
  const warning = 'Google Flow est ouvert 2 fois (onglets ou fenêtres). Fermez-le partout sauf une fois, dans tous vos navigateurs.';
  const f = flow({ check: { ok: false, blocking: true, tabs: 2, warning } });
  const { err } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.equal(err.display, warning);
  assert.equal(f.calls.filter((c) => c.route !== '/flow/status').length, 0);
});

test('Vérification : compte non lisible dans la page → envoi possible avec un avertissement sur la carte', async () => {
  const f = flow({ check: { ok: true, blocking: false, tabs: 1, email: '', accountChecked: false, warning: '' } });
  const { job } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.equal(f.sent().length, 1);
  assert.match(job.warning, /Compte Google Flow non vérifié/);
});

test('Lumina : même clé de liste des deux côtés, vérification FLOW_CHECK avant chaque génération du panneau', () => {
  const panel = fs.readFileSync(path.join(__dirname, '..', 'flow', 'side_panel.js'), 'utf8');
  const bg = fs.readFileSync(path.join(__dirname, '..', 'flow', 'background.js'), 'utf8');
  assert.match(SRC, /FLOW_PROJECTS_KEY: "luminaFlowProjects"/);
  assert.match(panel, /const FLOW_PROJECTS_KEY = 'luminaFlowProjects';/);
  assert.ok(panel.includes('(generate|edit-image|upload-image)/.test(path)) {\n    const p = await flowGuard();'));
  assert.match(bg, /'FLOW_CHECK', 'FLOW_OPEN_PROJECT', 'FLOW_DESCRIBE'/);
  assert.match(bg, /async function describeFlowPage()/);
  assert.match(bg, /Fermez-le partout sauf une fois, dans tous vos navigateurs/);
});

test('Deux navigateurs : la liste du pont prime sur la copie du navigateur', async () => {
  const autre = '11111111-2222-3333-4444-555555555555';
  const f = flow({ pont: { projets: { list: [{ id: autre, nom: 'Pro 2', compte: 'pro2@x.fr', tier: 'PAYGATE_TIER_TWO' }], actif: autre, maj: 1 } } });
  await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.equal(f.sent()[0].body.project_id, autre);
});

const BILAN_OK = { etat: { role: 'flow', tabs: 1, email: 'pro@exemple.fr', agentConnections: 1, warning: '', blocking: false, flowActive: true, pace: { cooldownLeftMs: 0, strikes: 0 } }, age_s: 5 };

test('Rôle Principal : bilan du navigateur Flow récent et bon → envoi, sans vérifier ce navigateur-ci', async () => {
  const f = flow({ role: 'principal', pont: { etat: BILAN_OK } });
  const { err } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.equal(err, undefined);
  assert.equal(f.sent().length, 1);
  assert.ok(!f.messages.some((m) => m.type === 'FLOW_CHECK'));
});

test('Rôle Principal : navigateur Flow muet (bilan de plus d’une minute) → rien n’est envoyé', async () => {
  const f = flow({ role: 'principal', pont: { etat: { ...BILAN_OK, age_s: 95 } } });
  const { err } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.match(err.display, /ne donne pas de nouvelles depuis 95 s/);
  assert.equal(f.calls.filter((c) => c.route !== '/flow/status').length, 0);
});

test('Rôle Principal : Flow ouvert deux fois dans le navigateur Flow, ou mauvais compte → rien n’est envoyé', async () => {
  const deux = flow({ role: 'principal', pont: { etat: { etat: { ...BILAN_OK.etat, tabs: 2, blocking: true, warning: 'Google Flow est ouvert 2 fois.' }, age_s: 3 } } });
  assert.match((await deux.run({ mode: 'i2v', sourceRef: 'a' })).err.display, /ouvert 2 fois/);
  const compte = flow({ role: 'principal', pont: { etat: { etat: { ...BILAN_OK.etat, email: 'gratuit@x.fr' }, age_s: 3 } } });
  assert.match((await compte.run({ mode: 'i2v', sourceRef: 'a' })).err.display, /gratuit@x\.fr.*pro@exemple\.fr/);
  assert.equal(deux.sent().length + compte.sent().length, 0);
});

test('Rôle Principal : pause anti-restriction du navigateur Flow → rien n’est envoyé', async () => {
  const f = flow({ role: 'principal', pont: { etat: { etat: { ...BILAN_OK.etat, pace: { cooldownLeftMs: 60000, strikes: 1 } }, age_s: 3 } } });
  assert.match((await f.run({ mode: 'i2v', sourceRef: 'a' })).err.display, /pause anti-restriction/);
  assert.equal(f.sent().length, 0);
});

test('Rôle Flow seulement : Agnes refuse d’envoyer', async () => {
  const f = flow({ role: 'flow' });
  assert.match((await f.run({ mode: 'i2v', sourceRef: 'a' })).err.display, /navigateur Principal/);
  assert.equal(f.sent().length, 0);
});

test('Flow en pause anti-restriction (Lumina) → rien n’est importé ni envoyé', async () => {
  const f = flow({ pace: { cooldownLeftMs: 90000, strikes: 1, lastReason: 'HTTP 429' } });
  const { err } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.match(err.display, /pause anti-restriction/);
  assert.match(err.display, /90 s/);
  assert.equal(f.calls.filter((c) => c.route !== '/flow/status').length, 0);
});

test('Flow : pause refusée par FlowKit à l’envoi (FLOW_COOLDOWN) → message clair, pas de blocage', async () => {
  const f = flow();
  f.plugin.flowCall = ((orig) => function (m, p, b, s) {
    if (/^\/flow\/generate/.test(p)) return Promise.reject({ display: 'Flow : pause anti-restriction en cours dans Lumina, rien n’a été envoyé.', status: 502 });
    return orig.call(this, m, p, b, s);
  })(f.plugin.flowCall);
  const { err } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.match(err.display, /pause anti-restriction/);
  assert.equal(f.plugin.cfg.flowBloque, undefined);
});

test('Flow : sondage espacé (15 s puis 20 s) pour ménager le compte', () => {
  assert.match(SRC, /A\.sleep\(Date\.now\(\) - start < 120000 \? 15000 : 20000, job\.signal\)/);
});

test('Flow : envoi coupé en route → pas de renvoi, Flow bloqué (la vidéo est peut-être partie)', async () => {
  const f = flow({ submitFails: true });
  const { err } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.ok(err);
  assert.equal(f.sent().length, 1);
  assert.match(f.plugin.cfg.flowBloque, /peut-être partie/);
});

test('Flow : plusieurs vidéos lancées pour un envoi → Flow bloqué, une seule prise', async () => {
  const op = (n) => ({ operation: { name: n }, status: 'MEDIA_GENERATION_STATUS_PENDING' });
  const f = flow({ submit: { operations: [op('op1'), op('op2')] } });
  const { takes } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.equal(takes.length, 1);
  assert.match(f.plugin.cfg.flowBloque, /2 vidéos/);
});

test('Flow : échec signalé par Flow → erreur claire, jamais de renvoi', async () => {
  const f = flow({ polls: [{ operations: [{ operation: { name: 'op1' }, status: 'MEDIA_GENERATION_STATUS_FAILED', error: 'contenu refusé' }] }] });
  const { err } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.match(err.display, /contenu refusé/);
  assert.equal(f.sent().length, 1);
  assert.equal(f.plugin.cfg.flowBloque, undefined);
});

test('Flow : Sorties > 1 ignoré (1 vidéo par envoi, crédits)', async () => {
  const f = flow();
  const { job } = await f.run({ mode: 'i2v', sourceRef: 'a', outputs: 3 });
  assert.equal(f.sent().length, 1);
  assert.match(job.warning, /1 vidéo par envoi/);
});

test('Agnes : Flow = troisième moteur vidéo, en plus d’Agnes et Grok (rien de retiré), sans emojis', () => {
  assert.match(SRC, /VIDEOS: \["agnes", "grok", "flow"\]/);
  assert.match(SRC, /<option value="agnes">Agnes Video 2\.5/);
  assert.match(SRC, /<option value="grok">Grok Imagine/);
  assert.match(SRC, /<option value="flow">Google Flow/);
  assert.doesNotMatch(SRC, /[\u{1F300}-\u{1FAFF}⛔⚠✔✗✕]/u);
  const state = fs.readFileSync(path.join(__dirname, '..', 'agnes', 'js', 'app-state.js'), 'utf8');
  assert.match(state, /s === "flow" \? "Flow"/);
});

// ---------- Flow MANUEL (Google refuse les générations lancées par une extension depuis le 22/09/2026) ----------
const LOC = { base: 'Marketing/Anthony/20260930 - accroche', video: 'Marketing/Anthony/20260930 - accroche/Video', nom: 'Carte 01 - accroche' };

test('Flow manuel (défaut) : image envoyée dans le projet, prompt copié, AUCUNE génération par Agnes, vidéo reprise et rangée', async () => {
  const f = flow({ cfg: { flowMode: undefined }, classement: LOC,
    pont: { recuperer: [{ trouve: false, attente: 'aucune nouvelle vidéo' }, { trouve: true, chemin: LOC.video + '/Carte 01 - accroche.mp4', autres: 0 }] } });
  const { takes, err, job } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.equal(err, undefined);
  assert.equal(f.sent().length, 0, 'jamais de /flow/generate en manuel');
  assert.equal(f.calls.filter((c) => c.route === '/flow/upload-image').length, 1);
  assert.match(f.calls.find((c) => c.route === '/flow/upload-image').body.file_name, /^Carte 01 - accroche - \d{6}\.jpg$/);
  assert.match(f.clip[0], /A woman smiles[\s\S]*No music/);
  const rec = f.pontCalls.filter((c) => c.route === '/flow/recuperer');
  assert.equal(rec.length, 2);
  assert.equal(rec[0].body.dest, LOC.video);
  assert.equal(rec[0].body.nom, 'Carte 01 - accroche');
  assert.ok(rec[0].body.depuis > 0);
  assert.equal(takes[0].source, 'flow');
  assert.equal(takes[0].localPath, LOC.video + '/Carte 01 - accroche.mp4');
  assert.match(job.info, /Vidéo reçue/);
});

test('Flow manuel : sans thématique de classement, rangé dans Production/_A_classer/<projet>/Video, avec un avertissement', async () => {
  const f = flow({ cfg: { flowMode: 'manuel' }, pont: { recuperer: [{ trouve: true, chemin: '_A_classer/Marketing/Video/Carte 01.mp4' }] } });
  const { job } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  const rec = f.pontCalls.find((c) => c.route === '/flow/recuperer');
  assert.equal(rec.body.dest, '_A_classer/Projet/Video');
  assert.match(job.warning, /_A_classer/);
});

test('Flow manuel : Flow ouvert deux fois → rien n’est préparé', async () => {
  const f = flow({ cfg: { flowMode: 'manuel' }, classement: LOC, check: { ok: false, blocking: true, tabs: 2, warning: 'Google Flow est ouvert 2 fois.' } });
  const { err } = await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.match(err.display, /ouvert 2 fois/);
  assert.equal(f.calls.length, 0);
  assert.equal(f.pontCalls.filter((c) => c.route === '/flow/recuperer').length, 0);
});

test('Flow manuel : réglage proposé dans ⚙, « Manuel » par défaut, « Automatique » gardé', () => {
  assert.match(SRC, /flowMode: "manuel" \}\);/);
  assert.match(SRC, /<option value="manuel">Manuel : Agnes prépare/);
  assert.match(SRC, /<option value="auto">Automatique par FlowKit \(refusé par Google depuis le 22\/09\/2026\)/);
});

test('Flow manuel : image (par son nom) et prompt déposés dans Flow SANS envoi ; réglages différents signalés', async () => {
  const f = flow({ cfg: { flowMode: 'manuel' }, classement: LOC,
    prepare: { ok: true, prompt: true, images: 1, reglages: 'Vidéo · 720p · 8 s 9:16 x1', etapes: ['image début : Carte 01 - accroche.jpg', 'prompt écrit'] },
    pont: { recuperer: [{ trouve: true, chemin: LOC.video + '/Carte 01 - accroche.mp4' }] } });
  const { job, err } = await f.run({ mode: 'i2v', sourceRef: 'a', duration: 10 });
  assert.equal(err, undefined);
  const prep = f.messages.find((m) => m.type === 'FLOW_PREPARE');
  assert.match(prep.images[0], /^Carte 01 - accroche - \d{6}\.jpg$/);
  assert.equal(prep.images[0], f.calls.find((c) => c.route === '/flow/upload-image').body.file_name, 'Lumina cherche exactement le nom envoyé');
  assert.match(prep.prompt, /A woman smiles/);
  assert.equal(JSON.stringify(prep.reglages), JSON.stringify({ modele: 'Omni 1.1 Flash', mode: 'Images', format: '9:16', resolution: '720p', duree: '10 s' }));
  assert.match(job.warning, /8 s.*la carte demande 10 s/);
  assert.equal(f.sent().length, 0);
});

test('Flow manuel, rôle Principal : pas de dépôt (Flow est dans l’autre navigateur), prompt copié', async () => {
  const BON = { etat: { role: 'flow', tabs: 1, email: 'pro@exemple.fr', agentConnections: 1, warning: '', blocking: false, flowActive: true, pace: { cooldownLeftMs: 0 } }, age_s: 3 };
  const f = flow({ cfg: { flowMode: 'manuel' }, role: 'principal', classement: LOC,
    pont: { etat: BON, recuperer: [{ trouve: true, chemin: LOC.video + '/x.mp4' }] } });
  await f.run({ mode: 'i2v', sourceRef: 'a' });
  assert.ok(!f.messages.some((m) => m.type === 'FLOW_PREPARE'));
  assert.equal(f.clip.length, 1);
});

test('Lumina : la préparation de Flow ne clique jamais « Lancer la génération »', () => {
  const bg = fs.readFileSync(path.join(__dirname, '..', 'flow', 'background.js'), 'utf8');
  const fn = bg.slice(bg.indexOf('async function prepareFlowComposer'), bg.indexOf('// Ouvre un projet dans l'));
  assert.match(fn, /if \(!el \|\| \/lancer la g\[ée\]n\[ée\]ration\/i\.test\(el\.getAttribute\('aria-label'\) \|\| ''\)\) throw new Error\('bouton interdit'\);/);
  assert.doesNotMatch(fn, /Lancer la génération'\)\s*\.click|aria-label="Lancer/);
  assert.match(bg, /'FLOW_DESCRIBE', 'FLOW_PREPARE'\]/);
});

test('Flow manuel, carte « Ingrédients » : références envoyées (« Carte NN - ref - Nom.jpg ») et ajoutées comme ingrédients, mode Ingrédients', async () => {
  const f = flow({ cfg: { flowMode: 'manuel' }, classement: LOC,
    prepare: { ok: true, prompt: true, images: 0, references: 2, reglages: 'Vidéo · 720p · 10 s 9:16 x1', etapes: [] },
    pont: { recuperer: [{ trouve: true, chemin: LOC.video + '/x.mp4' }] } });
  const { err } = await f.run({ mode: 'ingr_v', ingredients: ['1', '2'] });
  assert.equal(err, undefined);
  const up = f.calls.filter((c) => c.route === '/flow/upload-image').map((c) => c.body.file_name);
  assert.match(up[0], /^Carte 01 - accroche - ref - Ref 1 - \d{6}\.jpg$/);
  assert.match(up[1], /^Carte 01 - accroche - ref - Ref 2 - \d{6}\.jpg$/);
  const prep = f.messages.find((m) => m.type === 'FLOW_PREPARE');
  assert.deepEqual(Array.from(prep.images), []);
  assert.deepEqual(Array.from(prep.ingredients), up);
  assert.equal(prep.reglages.mode, 'Ingrédients');
  assert.equal(f.sent().length, 0);
});

test('Lumina : zone de saisie vidée des images d’une carte précédente, ingrédients par « Ajouter des ingrédients »', () => {
  const bg = fs.readFileSync(path.join(__dirname, '..', 'flow', 'background.js'), 'utf8');
  assert.match(bg, /\/\^Ingrédient\( image\)\?\$\/\.test\(b\.getAttribute\('aria-label'\)/);
  assert.match(bg, /=== 'Ajouter des ingrédients au champ du prompt'/);
});
