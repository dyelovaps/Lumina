const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function panel() {
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, { value: '', hidden: false, dataset: {},
      addEventListener() {}, classList: { toggle() {} }, click() {} });
    return nodes.get(id);
  };
  const sent = [];
  let active = 0;
  let maxActive = 0;
  const context = {
    document: { querySelector: node, querySelectorAll: () => [] },
    setTimeout: (fn) => fn(),
    chrome: { runtime: { async sendMessage({ payload }) {
      if (payload.type === 'PING') return { ok: true };
      sent.push(payload);
      maxActive = Math.max(maxActive, ++active);
      await Promise.resolve();
      active--;
      if (context.onSubmit) context.onSubmit(payload);
      if (context.failImage && payload.mediaKind === 'image') return { ok: false, error: 'Image failed' };
      return { ok: true, urls: [`https://example.test/${sent.length}.${payload.mediaKind === 'video' ? 'mp4' : 'jpg'}`] };
    } } },
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'sidepanel.js'), 'utf8');
  vm.runInNewContext(source.replace(/renderAll\(\);\s*$/, `
    persist = renderJobs = renderJournal = startProgressTick = stopProgressTick = () => {};
    saveDownload = makeContactSheet = assembleComplete = async () => {};
    globalThis.state = state;
    globalThis.run = runBatch;
    globalThis.setMode = setMode;
    globalThis.lintPrompt = lintPrompt;
    globalThis.promptForGrok = promptForGrok;
  `), context);
  context.state.settings.delay = 0;
  context.state.settings.step = false;
  context.state.settings.lint = false; // ces tests couvrent l'envoi ; le contrôle a ses propres tests
  node('#prompts').value = 'First scene\n\nSecond scene';
  return { ...context, context, sent, node, maxActive: () => maxActive };
}

const images = ['A', 'B', 'C', 'D'].map(dataUrl => ({ dataUrl, name: dataUrl }));

for (const mode of ['t2v', 't2i', 'i2i', 'ingredients', 'frame2v', 'montage', 'pipeline']) {
  test(`${mode}: sends the correct media and source images`, async () => {
    const p = panel();
    p.state.mode = mode;
    p.state.images = images.slice(0, 2);
    p.state.settings.pass = 'videos'; // Must not affect non-pipeline modes.
    p.state.stills = [{ id: 's1', videoPrompt: 'Animate', dataUrl: 'STILL', duration: 10 }];
    p.state.pairs = [{ id: 'pair', imagePrompt: 'Photo', videoPrompt: 'Motion' }];
    if (mode === 'pipeline') p.state.settings.pass = 'both';
    await p.run(true);
    assert.ok(p.sent.length);
    const expectedKind = ['t2i', 'i2i', 'pipeline'].includes(mode) ? 'image' : 'video';
    assert.equal(p.sent[0].mediaKind, expectedKind);
    assert.deepEqual(Array.from(p.sent[0].images),
      ['t2i', 't2v', 'pipeline'].includes(mode) ? [] :
        mode === 'montage' ? ['STILL'] : mode === 'i2i' ? ['A'] : ['A', 'B']);
    assert.equal(p.sent[0].framePair, mode === 'frame2v' ? 'startEnd' : mode === 'montage' ? 'startOnly' : '');
    assert.equal(p.sent[0].useLatestImage, undefined);
    if (mode === 'pipeline') {
      assert.equal(p.sent[1].grokMode, 'frame2v');
      assert.deepEqual(Array.from(p.sent[1].images), ['https://example.test/1.jpg']);
    }
    assert.ok(p.state.jobs.every(j => j.role && j.mode === mode && j.status === 'done'));
  });
}

test('Images pass then videos pass keeps the matching image for each pair', async () => {
  const p = panel();
  p.state.pairs = ['one', 'two'].map(id => ({ id, imagePrompt: id, videoPrompt: 'Animate ' + id }));
  p.state.settings.pass = 'images';
  await p.run(true);
  p.state.settings.pass = 'videos';
  await p.run(true);
  assert.deepEqual(p.sent.slice(2).map(s => Array.from(s.images)), [
    ['https://example.test/1.jpg'], ['https://example.test/2.jpg'],
  ]);
});

test('Videos pass without matching saved images does not use an unrelated visible image', async () => {
  const p = panel();
  p.state.settings.pass = 'videos';
  p.state.pairs = [{ id: 'one', imagePrompt: 'Photo', videoPrompt: 'Motion' }];
  await p.run(true);
  assert.equal(p.sent.length, 0);
  assert.match(p.state.journal.at(-1).msg, /générez d’abord/);
});

test('Failed parent images fail their video jobs instead of leaving them queued', async () => {
  const p = panel();
  p.context.failImage = true;
  p.state.pairs = [{ id: 'one', imagePrompt: 'Photo', videoPrompt: 'Motion' }];
  await p.run(true);
  assert.equal(p.sent.length, 1);
  assert.ok(p.state.jobs.every(j => j.status === 'error'));
});

test('Mode and generation settings stay attached to queued jobs; one tab runs serially', async () => {
  const p = panel();
  p.state.mode = 't2v';
  p.state.settings.concurrent = 3;
  p.context.onSubmit = () => { p.state.mode = 't2i'; p.state.settings.outputs = 4; };
  await p.run(true);
  assert.equal(p.maxActive(), 1);
  assert.ok(p.sent.every(s => s.mediaKind === 'video' && s.outputs === 1));
});

test('Incomplete frame pairs are rejected before submission', async () => {
  for (const [mode, count] of [['frame2v', 1], ['frame2v', 3]]) {
    const p = panel();
    p.state.mode = mode;
    p.state.images = Array.from({ length: count }, (_, i) => ({ dataUrl: String(i) }));
    await p.run(true);
    assert.equal(p.sent.length, 0);
    assert.ok(p.state.journal.length);
  }
});

test('Start, end and library references are distinct attachments without truncation', async () => {
  const p = panel();
  p.state.mode = 'frame2v';
  p.state.settings.referenceSelection = 'all';
  p.state.images = images.slice(0, 2);
  p.state.refs = ['char', 'loc', 'prop'].map(kind => ({ kind, name: kind, dataUrl: kind }));
  await p.run(true);
  assert.deepEqual(Array.from(p.sent[0].attachments, a => a.role), ['first', 'last', 'reference', 'reference', 'reference']);
  assert.deepEqual(Array.from(p.sent[0].attachments, a => a.url), ['A', 'B', 'char', 'loc', 'prop']);
});

test('Stills and mixed-lot videos include the reference library alongside the scene', async () => {
  for (const mode of ['montage', 'pipeline']) {
    const p = panel();
    p.state.mode = mode;
    p.state.settings.referenceSelection = 'all';
    p.state.refs = [{ name: 'Person', dataUrl: 'REF' }];
    p.state.stills = [{ id: 's', videoPrompt: 'Move', dataUrl: 'SCENE' }];
    p.state.pairs = [{ id: 'p', imagePrompt: 'Photo', videoPrompt: 'Move' }];
    await p.run(true);
    const video = p.sent.find(s => s.mediaKind === 'video');
    assert.deepEqual(Array.from(video.attachments, a => a.role), ['first', 'reference']);
    assert.equal(video.attachments[1].url, 'REF');
  }
});

test('References alone can generate an Ingredients clip', async () => {
  const p = panel();
  p.state.mode = 'ingredients';
  p.state.refs = [{ name: 'Character', dataUrl: 'REF' }];
  await p.run(true);
  assert.equal(p.sent[0].attachments.length, 1);
  assert.equal(p.sent[0].attachments[0].role, 'reference');
});

test('Reference selection supports matching names and explicit exclusion', async () => {
  for (const selection of ['matching', 'none']) {
    const p = panel();
    p.state.mode = 't2v';
    p.state.settings.referenceSelection = selection;
    p.state.refs = [{ name: 'First', dataUrl: 'MATCH' }, { name: 'Unused', dataUrl: 'OTHER' }];
    await p.run(true);
    assert.deepEqual(Array.from(p.sent[0].attachments, a => a.url), selection === 'matching' ? ['MATCH'] : []);
  }
});

test('Pass and frame controls are only shown for their applicable modes', () => {
  const p = panel();
  for (const mode of ['t2v', 't2i', 'i2i', 'ingredients', 'frame2v', 'montage', 'pipeline']) {
    p.setMode(mode, true);
    assert.equal(p.node('#pass-wrap').hidden, mode !== 'pipeline');
    assert.equal(p.node('#frame-pills').hidden, mode !== 'frame2v');
    assert.equal(p.node('#video-settings').hidden, ['t2i', 'i2i'].includes(mode));
  }
});

const PLAN = `## Scène 02 — La démission (6s)
@orangella @cassiano @commissariat
IMAGE: OVER-THE-SHOULDER on Orangella. Orangella, her head is a realistic orange. Cassiano, his head is a blackcurrant. Orangella looks directly at Cassiano. No text, no subtitles.
VIDEO:
Orangella, her head is a realistic orange. Cassiano, his head is a blackcurrant. Orangella looks directly at Cassiano and says: « On a envoyé ma démission. » Cassiano listens, eyes on her. Only Orangella speaks in this shot. No music.`;

test('@tags pick the references (location named by tag), and never reach Grok', async () => {
  const p = panel();
  p.state.mode = 'pipeline';
  p.state.settings.pass = 'images';
  p.state.refs = ['Orangella', 'Cassiano', 'Papayino', 'Commissariat', 'Quai'].map((name) =>
    ({ name, kind: name === 'Commissariat' || name === 'Quai' ? 'location' : 'character', dataUrl: name }));
  const [head, video] = PLAN.split('VIDEO:');
  p.state.pairs = [{ id: 'p1', imagePrompt: head.split('\n').slice(1).join('\n'), videoPrompt: video.trim() }];
  await p.run(true);
  const img = p.sent.find((s) => s.mediaKind === 'image');
  assert.deepEqual(Array.from(img.images).sort(), ['Cassiano', 'Commissariat', 'Orangella']);
  assert.ok(!/@orangella|IMAGE:/.test(img.prompt));
});

test('Image prompts lose their dialogue and gain a no-text clause', () => {
  const p = panel();
  const out = p.promptForGrok('@a\nIMAGE: Orangella at the counter, and says in a tired voice: « Bonjour. » Soft light.', 'image');
  assert.ok(!/«|Bonjour|says/.test(out));
  assert.match(out, /No text, no letters, no subtitles/);
});

test('The prompt check flags long dialogue, two speakers and missing eyelines', () => {
  const p = panel();
  const bad = 'Orangella, the adult orange woman. Cassiano, the adult blackcurrant man. Orangella says: « Donc vous pouvez savoir qui l a envoyé ? » Cassiano answers: « On demandera les logs. Mais ceux qui font ça, madame, ils se servent souvent du compte d un autre. »';
  const issues = Array.from(p.lintPrompt(bad, 'video', 6, ['orangella', 'cassiano'])).join(' | ');
  assert.match(issues, /trop long/);
  assert.match(issues, /2 locuteurs/);
  assert.match(issues, /regards/);
  assert.match(issues, /No music/);
  const good = PLAN.split('VIDEO:')[1];
  assert.deepEqual(Array.from(p.lintPrompt(good, 'video', 6, ['orangella', 'cassiano'])), []);
});

test('A flagged lot needs a second click on « Lancer le lot »', async () => {
  const p = panel();
  p.state.settings.lint = true;
  p.state.mode = 't2v';
  p.node('#prompts').value = 'Orangella, the adult orange woman, says: « Un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze. »';
  await p.run(true);
  assert.equal(p.sent.length, 0);
  await p.run(true);
  assert.equal(p.sent.filter((s) => s.mediaKind === 'video').length, 1);
});

test('Stills → clips: a [suite] clip starts from the last frame of the previous clip, and clips are filed via the bridge', async () => {
  const p = panel();
  p.state.mode = 'montage';
  p.state.settings.referenceSelection = 'none';
  const saved = [];
  p.context.fetch = async () => ({ ok: true, blob: async () => 'VIDEO-BLOB' });
  p.context.lastFrameOf = async (blob) => (blob === 'VIDEO-BLOB' ? 'LAST-FRAME' : 'WRONG');
  p.context.saveToBridge = async (url, path) => { saved.push(path); return path; };
  p.state.stills = [
    { id: 'a', stem: '01-a', title: '01', videoPrompt: 'Move A. No music.', dataUrl: 'MASTER', savePath: 'EP/3-clips/01-a.mp4' },
    { id: 'b', stem: '02-b', title: '02', videoPrompt: 'Move B. No music.', dataUrl: null, chainPrev: true, savePath: 'EP/3-clips/02-b.mp4' },
  ];
  await p.run(true);
  const videos = p.sent.filter((s) => s.mediaKind === 'video');
  assert.equal(videos.length, 2);
  assert.equal(videos[0].attachments[0].url, 'MASTER');
  assert.equal(videos[1].attachments[0].url, 'LAST-FRAME');
  assert.equal(videos[1].attachments[0].role, 'first');
  assert.deepEqual(saved, ['EP/3-clips/01-a.mp4', 'EP/3-clips/02-b.mp4']);
});

test('Pilote auto: takes the bridge request, imports the episode, runs without clicks and reports each clip', async () => {
  const p = panel();
  p.state.settings.pilot = true;
  p.state.settings.referenceSelection = 'none';
  const posted = [];
  const episode = { code: 'EP01', titre: 'La plainte', images_manquantes: [], clips: [
    { num: 1, titre: 'Lettre', duree: 6, suite: false, image: 'D:/ep/2-images/01.png', prompt: 'Move 1. No music.', save: 'D:/ep/3-clips/01.mp4' },
    { num: 2, titre: 'Demission', duree: 6, suite: true, image: null, prompt: 'Move 2. No music.', save: 'D:/ep/3-clips/02.mp4' },
  ] };
  p.context.fetch = async (url, init) => {
    if (url.includes('/pilote/prendre')) return { ok: true, json: async () => ({ demande: { id: 'p1', serie: 'fdf', ep: 'ep1', only: [] } }) };
    if (url.includes('/pilote/fini')) { posted.push(JSON.parse(init.body)); return { ok: true, json: async () => ({}) }; }
    if (url.includes('/episode')) return { ok: true, json: async () => episode };
    return { ok: true, blob: async () => 'BLOB' };
  };
  p.context.resizeFile = async () => 'STILL';
  p.context.lastFrameOf = async () => 'LAST';
  p.context.saveToBridge = async (u, path) => path;
  await p.context.pilotTick();
  const videos = p.sent.filter((s) => s.mediaKind === 'video');
  assert.deepEqual(videos.map((v) => v.attachments[0].url), ['STILL', 'LAST']);
  assert.equal(posted.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(posted[0].clips)), [{ num: 1, ok: true, erreur: null }, { num: 2, ok: true, erreur: null }]);
});

test('Permanent rules are appended once: subtle human acting, sharp image, no music', () => {
  const p = panel();
  const v = p.context.promptForGrok('Orangella says: « Bonjour. »', 'video');
  assert.match(v, /subtle restrained acting/);
  assert.match(v, /no film grain/);
  assert.match(v, /No music/);
  const already = 'Subtle acting. Tack-sharp, no film grain. No music.';
  assert.equal(p.context.promptForGrok(already, 'video'), already);
  const img = p.context.promptForGrok('A still of the counter.', 'image');
  assert.match(img, /no film grain/);
  assert.doesNotMatch(img, /No music/);
});
