const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Panneau Lumina (sidepanel.js + agnes-bridge.js) avec une fausse Agnes au bout du BroadcastChannel.
function panel(agnesData, { pilotDemande } = {}) {
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, { value: '', hidden: false, dataset: {}, checked: false,
      addEventListener() {}, classList: { toggle() {} }, click() {} });
    return nodes.get(id);
  };
  const sent = [];
  const toAgnes = [];
  const reported = [];
  let channel;
  class FakeChannel {
    constructor() { channel = this; this.listeners = []; }
    addEventListener(_t, fn) { this.listeners.push(fn); }
    postMessage(m) {
      toAgnes.push(m);
      const reply = (type, body) => setTimeout(() => channel.listeners.forEach((fn) =>
        fn({ data: { to: 'lumina', type, rid: m.rid, ...body } })), 1);
      if (m.type === 'ping') reply('pong', { project: { id: 'P1', name: 'Mon Film', shots: 2 }, projects: [{ id: 'P1', name: 'Mon Film', shots: 2 }] });
      if (m.type === 'export') reply('export:result', { data: agnesData });
      if (m.type === 'take') reply('take:ok', { shotId: m.shotId });
    }
  }
  const context = {
    document: { querySelector: node, querySelectorAll: () => [] },
    setTimeout, clearTimeout,
    BroadcastChannel: FakeChannel,
    chrome: {
      runtime: {
        getURL: (p) => 'chrome-extension://lumina/' + p,
        async sendMessage({ payload }) {
          if (payload.type === 'PING') return { ok: true };
          sent.push(payload);
          return { ok: true, urls: [`https://grok.test/${sent.length}.${payload.mediaKind === 'video' ? 'mp4' : 'jpg'}`] };
        },
      },
      tabs: { query: async () => [], create: async () => ({ id: 1 }) },
    },
    fetch: async (url, init) => {
      if (url.includes('/pilote/prendre')) return { ok: true, json: async () => ({ demande: pilotDemande }) };
      if (url.includes('/pilote/fini')) { reported.push(JSON.parse(init.body)); return { ok: true, json: async () => ({}) }; }
      return { ok: true, blob: async () => 'BLOB:' + url };
    },
  };
  vm.createContext(context);
  const panelSrc = fs.readFileSync(path.join(__dirname, '..', 'sidepanel.js'), 'utf8');
  vm.runInContext(panelSrc.replace(/renderAll\(\);\s*$/, `
    persist = renderJobs = renderJournal = startProgressTick = stopProgressTick = renderAll = () => {};
    saveDownload = makeContactSheet = assembleComplete = async () => {};
    resizeFile = async (b) => 'DATA:' + b;
    globalThis.state = state;
    globalThis.run = runBatch;
    globalThis.pilotTick = pilotTick;
  `), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'agnes-bridge.js'), 'utf8') + `
    globalThis.importFromAgnes = importFromAgnes;
  `, context);
  context.state.settings.delay = 0;
  context.state.settings.step = false;
  context.state.settings.lint = false;
  context.state.settings.referenceSelection = 'matching';
  const settle = () => new Promise((r) => setTimeout(r, 30));
  return { context, state: context.state, run: (...a) => context.run(...a), sent, toAgnes, reported, settle };
}

const plain = (x) => JSON.parse(JSON.stringify(x));
const eq = (actual, expected) => assert.deepEqual(plain(actual), expected);
const project = { id: 'P1', name: 'Mon Film', aspect: '9:16' };
const lea = { name: 'Léa', kind: 'personnage', blob: 'LEA' };
const cafe = { name: 'Café', kind: 'decor', blob: 'CAFE' };

test('Plans avec image validée → Stills → Clips, références jointes par nom, rendus renvoyés à Agnes', async () => {
  const p = panel({
    project,
    shots: [
      { shotId: 's1', num: 1, title: 'Léa entre', imagePrompt: '', videoPrompt: 'Léa entre dans le café', duration: 8, still: 'IMG1', refs: ['Léa', 'Café'] },
      { shotId: 's2', num: 2, title: 'Léa sourit', imagePrompt: '', videoPrompt: 'Elle sourit', duration: 5, still: 'IMG2', refs: ['Léa'] },
    ],
    refs: [lea, cafe],
    skipped: [{ num: 3, reason: 'média importé (carton, récap…)' }],
  });
  p.state.refs = [{ id: 'old', kind: 'character', name: 'lea', dataUrl: 'OLD' }, { id: 'x', kind: 'prop', name: 'tasse', dataUrl: 'TASSE' }];
  const err = await p.context.importFromAgnes({});
  assert.equal(err, '');
  assert.equal(p.state.mode, 'montage');
  eq(p.state.stills.map((s) => [s.dataUrl, s.duration, s.agnes.shotId]), [['DATA:IMG1', 10, 's1'], ['DATA:IMG2', 6, 's2']]);
  assert.match(p.state.stills[0].videoPrompt, /^@lea @cafe\n/);
  // « Léa » d'Agnes remplace « lea » de Lumina ; « tasse » reste.
  eq(p.state.refs.map((r) => r.dataUrl), ['DATA:LEA', 'DATA:CAFE', 'TASSE']);

  p.state.settings.step = false; // Stills → Clips active le pas-à-pas à la main ; le test enchaîne
  await p.run(true);
  await p.settle();
  assert.equal(p.sent.length, 2);
  eq(p.sent[0].attachments.map((a) => a.url), ['DATA:IMG1', 'DATA:LEA', 'DATA:CAFE']);
  eq(p.sent[1].attachments.map((a) => a.url), ['DATA:IMG2', 'DATA:LEA']);
  assert.doesNotMatch(p.sent[0].prompt, /@lea/);
  const takes = p.toAgnes.filter((m) => m.type === 'take');
  eq(takes.map((t) => [t.shotId, t.role, t.projectId, t.blob]),
    [['s1', 'video', 'P1', 'BLOB:https://grok.test/1.mp4'], ['s2', 'video', 'P1', 'BLOB:https://grok.test/2.mp4']]);
});

test("Grok vidéo uniquement (défaut) : un plan sans image n'est jamais confié à Grok, il est signalé", async () => {
  const p = panel({ project, shots: [
    { shotId: "s1", num: 1, title: "Rue", imagePrompt: "Rue de nuit", videoPrompt: "Elle marche", duration: 6, still: null, refs: [] },
    { shotId: "s2", num: 2, title: "Porte", imagePrompt: "", videoPrompt: "La porte", duration: 6, still: "IMG", refs: [] },
  ], refs: [], skipped: [] });
  const err = await p.context.importFromAgnes({});
  assert.equal(err, "");
  assert.equal(p.state.mode, "montage");
  eq(p.state.stills.map((s) => s.agnes.shotId), ["s2"]);
  p.state.settings.step = false;
  await p.run(true);
  eq(p.sent.map((s) => s.mediaKind), ["video"]);
});

test('Plans sans image → Lot mixte : Grok fait l’image puis le clip, les deux reviennent dans Agnes', async () => {
  // (règle désactivée pour ce test : Lot mixte autorisé)
  const p = panel({
    project,
    shots: [
      { shotId: 's1', num: 4, title: 'Rue', imagePrompt: 'Rue de nuit, Léa', videoPrompt: 'Léa marche', duration: 6, still: null, refs: ['Léa'] },
      { shotId: 's2', num: 5, title: 'Porte', imagePrompt: '', videoPrompt: 'La porte s’ouvre', duration: 12, still: null, refs: [] },
    ],
    refs: [lea],
    skipped: [],
  });
  p.state.settings.grokVideoOnly = false;
  await p.context.importFromAgnes({});
  assert.equal(p.state.mode, 'pipeline');
  assert.equal(p.state.settings.pass, 'both');
  eq(p.state.pairs.map((x) => [x.imagePrompt, x.duration]), [['@lea\nRue de nuit, Léa', 6], ['La porte s’ouvre', 10]]);
  p.state.settings.step = false; // Stills → Clips active le pas-à-pas à la main ; le test enchaîne
  await p.run(true);
  await p.settle();
  eq(p.sent.map((s) => s.mediaKind), ['image', 'video', 'image', 'video']);
  const takes = p.toAgnes.filter((m) => m.type === 'take');
  eq(takes.map((t) => [t.shotId, t.role]), [['s1', 'image'], ['s1', 'video'], ['s2', 'image'], ['s2', 'video']]);
});

test('Renvoi désactivé : aucun rendu n’est envoyé à Agnes', async () => {
  const p = panel({ project, shots: [{ shotId: 's1', num: 1, title: 'A', imagePrompt: 'img', videoPrompt: 'vid', duration: 6, still: 'I', refs: [] }], refs: [], skipped: [] });
  p.state.settings.agnesReturn = false;
  await p.context.importFromAgnes({});
  p.state.settings.step = false; // Stills → Clips active le pas-à-pas à la main ; le test enchaîne
  await p.run(true);
  await p.settle();
  assert.equal(p.sent.length, 1);
  assert.equal(p.toAgnes.filter((m) => m.type === 'take').length, 0);
});

test('Pilote auto : une demande « lancer-agnes » importe le projet par son nom, lance et rend chaque plan', async () => {
  const p = panel({
    project,
    shots: [
      { shotId: 's1', num: 1, title: 'A', imagePrompt: '', videoPrompt: 'Plan A', duration: 6, still: 'I1', refs: [] },
      { shotId: 's2', num: 2, title: 'B', imagePrompt: '', videoPrompt: 'Plan B', duration: 6, still: 'I2', refs: [] },
    ],
    refs: [], skipped: [],
  }, { pilotDemande: { id: 'p9', agnes: { projet: 'mon film', mode: 'auto', scope: 'all' } } });
  p.state.settings.pilot = true;
  await p.context.pilotTick();
  await p.settle();
  const exp = p.toAgnes.find((m) => m.type === 'export');
  assert.equal(exp.projectId, 'P1');
  assert.equal(exp.scope, 'all');
  assert.equal(p.sent.length, 2);
  assert.equal(p.reported.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(p.reported[0].clips)), [{ num: 1, ok: true, erreur: null }, { num: 2, ok: true, erreur: null }]);
});

test('Projet Agnes inconnu : le pilote rend une erreur claire', async () => {
  const p = panel({ project, shots: [], refs: [], skipped: [] }, { pilotDemande: { id: 'p10', agnes: { projet: 'Autre' } } });
  p.state.settings.pilot = true;
  await p.context.pilotTick();
  assert.match(p.reported[0].erreur, /projet « Autre » introuvable/);
  assert.equal(p.sent.length, 0);
});
